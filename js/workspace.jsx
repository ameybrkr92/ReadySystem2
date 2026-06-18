// Order Workspace — a GUIDED, GATED pipeline for one work order.
// Steps unlock in sequence: Documents → BOM (lock) → Costing & Quote → Approval → Procurement.
// Each gate prevents downstream chaos: no costing on an unlocked BOM, no buying before approval.
const { useState: wsUseState, useRef: wsUseRef, useMemo: wsUseMemo } = React;

const wsBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const DOC_TONE = { "Schematic": "active", "Layout board": "amber", "GA drawing": "done", "Datasheet": "pending", "Other": "pending" };

// ---- derive the whole pipeline state for an order ----
function pipeline(o) {
  const { procurementForOrder, getState, quoteStale, STAGES, fmtDate } = window;
  const bomLocked = !!o.bomLocked;
  const bomRev = o.bomRev || 1;
  const hasQuote = !!o.quote;
  const quoteStatus = o.quote ? o.quote.status : null;       // 'sent' | 'approved'
  const stale = quoteStale(o);
  const approved = quoteStatus === "approved" && !stale;
  const shortages = bomLocked ? procurementForOrder(o, getState()).filter(r => r.toOrder > 0) : [];
  const pos = getState().pos.filter(p => p.woNo === o.woNo);
  const allReceived = pos.length > 0 && pos.every(p => p.status === "Received");
  const sIdx = STAGES.indexOf(o.stage);
  const inDelivery = sIdx >= STAGES.indexOf("Build");   // Build / Final QC / Dispatch

  // single source of truth for "what to do next"
  let next;
  if (inDelivery) {
    if (o.stage === "Dispatch") next = { tab: "delivery", label: `Dispatched ${fmtDate(o.dispatchedDate)}`, hint: "Order complete — followable end to end below.", muted: true };
    else if (o.stage === "Final QC") next = o.stuck
      ? { tab: "delivery", label: "Final QC hold", hint: o.stuck.reason, warn: true }
      : { tab: "delivery", label: "In final QC", hint: "Quality runs the pre-dispatch inspection.", muted: true };
    else next = { tab: "delivery", label: "On the floor — building", hint: "Material issued; final QC is next.", muted: true };
  }
  else if (!bomLocked) next = { tab: "bom", label: "Review & lock the BOM", hint: "Freeze the harness so costing can begin." };
  else if (stale) next = { tab: "costing", label: "BOM changed — re-send the quote", hint: `BOM is now Rev ${bomRev}; the last quote is out of date.`, warn: true };
  else if (!hasQuote) next = { tab: "costing", label: "Set margin & send the quote", hint: "Price the locked BOM and send it for approval." };
  else if (quoteStatus === "sent") next = { tab: "costing", label: "Mark the quote approved", hint: "Once the client confirms, approve to open procurement." };
  else if (approved && shortages.length) next = { tab: "procurement", label: `Raise PO for ${shortages.length} short item${shortages.length > 1 ? "s" : ""}`, hint: "Order the material this job is missing." };
  else if (approved && pos.length && !allReceived) next = { tab: "procurement", label: "Awaiting material", hint: "POs raised — receipt updates automatically from Stores.", muted: true };
  else if (approved) next = { tab: "procurement", label: "Material covered — ready to release", hint: "Everything is in stock or received; release from the board.", muted: true };
  else next = null;

  return { bomLocked, bomRev, hasQuote, quoteStatus, approved, stale, shortages, pos, allReceived, inDelivery, sIdx, next };
}

const STEPS = [
  { key: "docs", n: 1, label: "Documents" },
  { key: "bom", n: 2, label: "BOM" },
  { key: "costing", n: 3, label: "Costing & Quote" },
  { key: "approval", n: 4, label: "Approval" },
  { key: "procurement", n: 5, label: "Procurement" },
  { key: "delivery", n: 6, label: "Build & delivery" },
];

function stepState(key, p, o) {
  // returns { status: 'done'|'current'|'locked'|'todo'|'warn', sub }
  switch (key) {
    case "docs": return { status: (o.docs && o.docs.length) ? "done" : "todo", sub: (o.docs && o.docs.length) ? `${o.docs.length} file${o.docs.length > 1 ? "s" : ""}` : "Optional" };
    case "bom": return p.bomLocked ? { status: "done", sub: `Locked · Rev ${p.bomRev}` } : { status: "current", sub: "Draft — needs lock" };
    case "costing":
      if (!p.bomLocked) return { status: "locked", sub: "Lock BOM first" };
      if (p.stale) return { status: "warn", sub: "Out of date" };
      if (!p.hasQuote) return { status: "current", sub: "Not quoted" };
      return { status: "done", sub: `Quoted · Rev ${o.quote.rev}` };
    case "approval":
      if (!p.hasQuote) return { status: "locked", sub: "Quote first" };
      if (p.approved) return { status: "done", sub: "Approved" };
      return { status: "current", sub: "Awaiting client" };
    case "procurement":
      if (!p.approved) return p.inDelivery ? { status: "done", sub: "Secured" } : { status: "locked", sub: "Needs approval" };
      if (p.shortages.length) return { status: "current", sub: `${p.shortages.length} to order` };
      if (p.pos.length && !p.allReceived) return { status: "current", sub: "Awaiting goods" };
      return { status: "done", sub: "Covered" };
    case "delivery": {
      const STAGE_LIST = window.STAGES;
      const si = STAGE_LIST.indexOf(o.stage);
      if (si < STAGE_LIST.indexOf("Build")) return { status: "locked", sub: "After release" };
      if (o.stage === "Build") return { status: "current", sub: "Building" };
      if (o.stage === "Final QC") return o.stuck ? { status: "warn", sub: "QC hold" } : { status: "current", sub: "In final QC" };
      if (o.stage === "Dispatch") return { status: "done", sub: "Dispatched" };
      return { status: "todo", sub: "" };
    }
    default: return { status: "todo", sub: "" };
  }
}

function Stepper({ p, o, active, onGo }) {
  const COLORS = {
    done: "bg-[var(--status-done)] text-white border-[var(--status-done)]",
    current: "bg-primary text-white border-primary",
    warn: "bg-[var(--status-stuck)] text-white border-[var(--status-stuck)]",
    locked: "bg-muted text-muted-foreground border-border",
    todo: "bg-white text-muted-foreground border-border",
  };
  return (
    <div className="flex items-stretch gap-1 overflow-x-auto">
      {STEPS.map((step, i) => {
        const ss = stepState(step.key, p, o);
        const locked = ss.status === "locked";
        const isActive = active === step.key || (step.key === "approval" && active === "costing");
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <div className="self-center h-px w-3 sm:w-5 bg-border shrink-0" />}
            <button
              disabled={locked}
              onClick={() => onGo(step.key === "approval" ? "costing" : step.key)}
              className={`group flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors shrink-0 ${locked ? "cursor-not-allowed opacity-70" : "hover:border-primary"} ${isActive ? "ring-2 ring-primary/30 border-primary" : "border-border"} bg-white`}
            >
              <span className={`grid place-items-center h-6 w-6 rounded-full border text-[11px] font-semibold ${COLORS[ss.status]}`}>
                {ss.status === "done" ? "✓" : ss.status === "locked" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3"><rect x="5" y="11" width="14" height="9" rx="1" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>
                ) : step.n}
              </span>
              <span className="text-left">
                <span className="block text-[13px] font-medium leading-tight whitespace-nowrap">{step.label}</span>
                <span className={`block text-[10px] leading-tight whitespace-nowrap ${ss.status === "warn" ? "text-[var(--status-stuck)]" : "text-muted-foreground"}`}>{ss.sub}</span>
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OrderWorkspace() {
  const { useStore, useOpenOrder, closeOrder, Pill, Button } = window;
  const { id, tab: initialTab } = useOpenOrder();
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const order = orders.find(o => o.id === id) || null;
  const [tab, setTab] = wsUseState(initialTab || "overview");
  React.useEffect(() => { if (id) setTab(initialTab || "overview"); }, [id, initialTab]);

  if (!order) return null;
  const o = order;
  const p = pipeline(o);

  const go = (t) => setTab(t);

  return (
    <div className="space-y-5">
      <button onClick={closeOrder} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Back to list
      </button>

      <div className="card-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm num text-muted-foreground">{o.woNo}</span>
              {o.stuck ? <Pill tone="stuck">{o.stage} · stuck</Pill> : o.stage === "Dispatch" ? <Pill tone="done">Dispatched</Pill> : <Pill tone="active">{o.stage}</Pill>}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight truncate">{o.client} · {o.project || "—"}</h2>
            <div className="mt-0.5 text-sm text-muted-foreground">{o.product} · <span className="font-mono">{o.config}</span> · Qty {o.qty}{o.motorised ? " · Motorised" : ""}</div>
          </div>
          <button onClick={() => go("overview")} className={`shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md transition-colors ${tab === "overview" ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5"><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="2.5" /></svg>
            Overview
          </button>
        </div>

        <div className="mt-5">
          <Stepper p={p} o={o} active={tab} onGo={go} />
        </div>

        {p.next && tab !== "overview" && (
          <div className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${p.next.warn ? "border-[color-mix(in_oklab,var(--status-stuck)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_7%,transparent)]" : p.next.muted ? "border-border bg-muted/40" : "border-primary/30 bg-primary-soft"}`}>
            <div className="min-w-0">
              <div className={`text-sm font-medium ${p.next.warn ? "text-[var(--status-stuck)]" : p.next.muted ? "text-muted-foreground" : "text-primary"}`}>{p.next.muted ? "" : "Next: "}{p.next.label}</div>
              <div className="text-[11px] text-muted-foreground truncate">{p.next.hint}</div>
            </div>
            {!p.next.muted && tab !== p.next.tab && <Button onClick={() => go(p.next.tab)} variant={p.next.warn ? "danger" : "primary"}>Go →</Button>}
          </div>
        )}
      </div>

      <div>
        {tab === "overview" && <OverviewTab order={o} p={p} go={go} />}
        {tab === "docs" && <DocsTab order={o} />}
        {tab === "bom" && <BomTab order={o} p={p} />}
        {tab === "costing" && <CostingTab order={o} p={p} />}
        {tab === "procurement" && <ProcurementTab order={o} p={p} />}
        {tab === "delivery" && <DeliveryTab order={o} p={p} />}
      </div>
    </div>
  );
}

// ---------- Overview ----------
function OverviewTab({ order, p, go }) {
  const { computeCosting, parseConfig, FEEDER_LEGEND, buildMinutes, Card, Pill, fmtINR, fmtDate } = window;
  const o = order;
  const cost = computeCosting(o);
  const feeders = parseConfig(o.config);
  const Info = ({ label, value }) => (<div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 text-sm">{value}</div></div>);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="card-panel p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{o.quote ? `Quote · Rev ${o.quote.rev}` : "Engine estimate"}</div>
          <div className="mt-1 text-2xl font-display num text-primary">{o.quote ? fmtINR(o.quote.total) : fmtINR(cost.total)}</div>
          <div className="text-[11px] text-muted-foreground num">{o.quote ? (p.approved ? "Approved" : "Sent — awaiting approval") : "Not quoted yet"} · {cost.marginPct}% margin</div>
        </div>
        <div className="card-panel p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">Build effort</div><div className="mt-1 text-2xl font-display num">{Math.round(buildMinutes(o.config, o.qty) / 60)}h</div><div className="text-[11px] text-muted-foreground num">{o.qty} units · {feeders.length} feeders each</div></div>
        <div className="card-panel p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Procurement</div>
          <div className={`mt-1 text-2xl font-display num ${!p.approved ? "text-muted-foreground" : p.shortages.length ? "text-[var(--status-stuck)]" : "text-[var(--status-done)]"}`}>{!p.approved ? "Locked" : p.shortages.length ? `${p.shortages.length} short` : "Covered"}</div>
          <div className="text-[11px] text-muted-foreground">{!p.approved ? "Opens after approval" : p.shortages.length ? "Items to order" : "Stock + POs cover demand"}</div>
        </div>
      </div>

      {o.stuck && (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--status-stuck)_30%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_7%,transparent)] p-4">
          <div className="text-sm font-medium text-[var(--status-stuck)]">⚠ Order is stuck</div>
          <div className="mt-1 text-sm">{o.stuck.reason}</div>
        </div>
      )}

      {p.next && (
        <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 ${p.next.warn ? "border-[color-mix(in_oklab,var(--status-stuck)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_7%,transparent)]" : p.next.muted ? "border-border bg-muted/40" : "border-primary/30 bg-primary-soft"}`}>
          <div><div className={`text-sm font-medium ${p.next.warn ? "text-[var(--status-stuck)]" : p.next.muted ? "text-muted-foreground" : "text-primary"}`}>{p.next.muted ? p.next.label : "Next step: " + p.next.label}</div><div className="text-[11px] text-muted-foreground">{p.next.hint}</div></div>
          {!p.next.muted && <button onClick={() => go(p.next.tab)} className="text-sm font-medium text-primary whitespace-nowrap">Open →</button>}
        </div>
      )}

      <Card title="Configuration">
        <div className="flex flex-wrap gap-2 mb-4">{feeders.map((f, i) => <Pill key={i} tone="pending">{f} — {FEEDER_LEGEND[f] || f}</Pill>)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Info label="Client" value={o.client} />
          <Info label="Project" value={o.project || "—"} />
          <Info label="Product · Config" value={`${o.product} · ${o.config}`} />
          <Info label="Quantity" value={`${o.qty} units`} />
          <Info label="PO date" value={fmtDate(o.poDate)} />
          <Info label="Due date" value={fmtDate(o.dueDate)} />
          <Info label="BOM locked" value={p.bomLocked ? `Rev ${p.bomRev} · ${fmtDate(o.bomSentDate)}` : "Not yet"} />
          <Info label="Quote" value={o.quote ? `Rev ${o.quote.rev} · ${p.approved ? "Approved" : "Sent"}` : "—"} />
          <Info label="Dispatched" value={fmtDate(o.dispatchedDate)} />
        </div>
      </Card>
    </div>
  );
}

// ---------- Documents ----------
function DocsTab({ order }) {
  const { addOrderDoc, removeOrderDoc, logActivity, toast, uid, todayISO, fmtDate, DOC_KINDS, MAX_DOC_BYTES, Field, Input, Select, Empty, Pill, Card } = window;
  const o = order;
  const docs = o.docs || [];
  const [kind, setKind] = wsUseState("Schematic");
  const [rev, setRev] = wsUseState("");
  const [drag, setDrag] = wsUseState(false);
  const inputRef = wsUseRef(null);

  function ingest(files) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const finish = (dataUrl) => { addOrderDoc(o.id, { id: uid(), name: file.name, kind, size: file.size, mime: file.type || "application/octet-stream", dataUrl, rev: rev || undefined, uploadedAt: todayISO(), uploadedBy: "Planning" }); logActivity("Planning", `${kind} attached to ${o.woNo} — ${file.name}`); };
      if (file.size <= MAX_DOC_BYTES) { const r = new FileReader(); r.onload = () => finish(r.result); r.onerror = () => finish(undefined); r.readAsDataURL(file); }
      else finish(undefined);
    });
    setRev(""); toast("Document attached"); if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <Card title="Engineering documents" action={<span className="text-xs text-muted-foreground">{docs.length} {docs.length === 1 ? "file" : "files"}</span>}>
      <p className="text-sm text-muted-foreground mb-4">Schematics, layout boards, GA drawings &amp; datasheets — attached to the job before you build the BOM, visible to every role.</p>
      <div className="mb-4 grid sm:grid-cols-[10rem_8rem_1fr] gap-2 items-end">
        <Field label="Document type"><Select value={kind} onChange={e => setKind(e.target.value)}>{DOC_KINDS.map(k => <option key={k}>{k}</option>)}</Select></Field>
        <Field label="Revision"><Input value={rev} onChange={e => setRev(e.target.value)} placeholder="Rev A" /></Field>
        <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); ingest(e.dataTransfer.files); }} onClick={() => inputRef.current && inputRef.current.click()}
          className={`flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 text-xs transition-colors ${drag ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Drop PDF/DWG/PNG here or click to browse
        </div>
        <input ref={inputRef} type="file" multiple accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg" className="hidden" onChange={e => ingest(e.target.files)} />
      </div>
      {docs.length === 0 ? <Empty title="No documents yet" hint="Attach the client schematic and your layout board." /> : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-9 w-9 shrink-0 rounded-md bg-muted text-muted-foreground"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
                <div className="min-w-0"><div className="truncate text-sm font-medium">{d.name}</div><div className="text-[11px] text-muted-foreground num">{wsBytes(d.size)} · {fmtDate(d.uploadedAt)}{d.uploadedBy ? ` · ${d.uploadedBy}` : ""}</div></div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.rev && <span className="text-[11px] text-muted-foreground num">{d.rev}</span>}
                <Pill tone={DOC_TONE[d.kind]}>{d.kind}</Pill>
                {d.kind === "Layout board" && <a href="layout-3d.html" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View 3D</a>}
                {d.dataUrl && <a href={d.dataUrl} download={d.name} className="text-xs text-primary hover:underline">Download</a>}
                <button onClick={() => removeOrderDoc(o.id, d.id)} className="text-xs text-[var(--status-stuck)]">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ---------- BOM (lock / revise) ----------
function BomTab({ order, p }) {
  const { parseConfig, FEEDER_LIBRARY, FEEDER_LEGEND, buildMinutes, regenerateHarness, lockBom, reviseBom, setStoreState, logActivity, uid, toast, Card, Pill, Button, Table, Input, Select, Empty, Modal, fmtNum, fmtINR2 } = window;
  const o = order;
  const oid = o.id;
  const locked = p.bomLocked;
  const feeders = parseConfig(o.config);
  const harness = (o.bom || []).filter(b => b.source !== "addition");
  const additions = (o.bom || []).filter(b => b.source === "addition");
  const harnessTotal = harness.reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const addTotal = additions.reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const [confirmRevise, setConfirmRevise] = wsUseState(false);

  const update = (id, patch) => setStoreState(s => { const ord = s.orders.find(x => x.id === oid); const it = ord.bom.find(b => b.id === id); if (it) Object.assign(it, patch); return s; });
  const removeLine = (id) => setStoreState(s => { const ord = s.orders.find(x => x.id === oid); ord.bom = ord.bom.filter(b => b.id !== id); return s; });
  const addLine = () => setStoreState(s => { const ord = s.orders.find(x => x.id === oid); ord.bom = ord.bom || []; ord.bom.push({ id: uid(), description: "New item", qty: 1, unit: "nos", rate: 0, source: "addition" }); return s; });

  return (
    <div className="space-y-6">
      {/* Lock banner */}
      {locked ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--status-done)]/30 bg-[color-mix(in_oklab,var(--status-done)_8%,transparent)] px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 text-[var(--status-done)]"><rect x="5" y="11" width="14" height="9" rx="1" /><path d="M8 11V8a4 4 0 018 0v3" strokeLinecap="round" /></svg>
            <span><b>BOM locked</b> · Rev {p.bomRev}. Read-only — revise to change it.</span>
          </div>
          <Button variant="secondary" onClick={() => setConfirmRevise(true)}>Revise BOM</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary-soft px-4 py-3">
          <div className="text-sm text-primary">Draft BOM — edit freely, then lock to start costing. {p.hasQuote ? "Locking creates Rev " + p.bomRev + "; the quote will need re-sending." : ""}</div>
          <Button onClick={() => { lockBom(oid); logActivity("Planning", `BOM locked (Rev ${o.bomRev}) — ${o.woNo}`); toast("BOM locked"); }} disabled={(o.bom || []).length === 0}>🔒 Finalize &amp; lock BOM</Button>
        </div>
      )}

      <Card title="Costing engine — config → harness" action={!locked && <Button variant="secondary" onClick={() => { regenerateHarness(oid); logActivity("Planning", `Harness rebuilt from ${o.config} (${o.woNo})`); toast("Harness rebuilt from config"); }}>↻ Rebuild from config</Button>}>
        <p className="text-sm text-muted-foreground mb-3">The engine parses <span className="font-mono text-foreground">{o.config}</span> into feeders, then assembles the harness from the feeder library — priced from the material master.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {feeders.map((f, i) => {
            const lib = FEEDER_LIBRARY[f];
            return (<div key={i} className="rounded-md border border-border p-3"><div className="flex items-center justify-between"><span className="font-mono text-sm">{f}</span><span className="text-[11px] text-muted-foreground">{lib ? `${lib.buildMin} min` : ""}</span></div><div className="text-xs text-muted-foreground mt-0.5">{lib ? lib.name : (FEEDER_LEGEND[f] || "Unknown")}</div></div>);
          })}
        </div>
        <div className="mt-3 text-xs text-muted-foreground num">Total build: {fmtNum(buildMinutes(o.config, o.qty))} min for {o.qty} units.</div>
      </Card>

      <Card title="Harness BOM" action={<span className="text-xs text-muted-foreground">{harness.length} lines · engine-generated</span>}>
        <Table headers={["Description", "Qty", "Unit", "Rate ₹", "Subtotal", ""]}>
          {harness.length === 0 ? <tr><td colSpan={6} className="px-4 py-6"><Empty title="No harness yet" hint="Click Rebuild from config" /></td></tr> : harness.map(b => (
            <tr key={b.id}>
              <td className="px-4 py-2">{b.description}</td>
              <td className="px-4 py-2 w-24"><Input type="number" value={b.qty} disabled={locked} onChange={e => update(b.id, { qty: Number(e.target.value) })} /></td>
              <td className="px-4 py-2 text-xs">{b.unit}</td>
              <td className="px-4 py-2 w-24"><Input type="number" value={b.rate ?? 0} disabled={locked} onChange={e => update(b.id, { rate: Number(e.target.value) })} /></td>
              <td className="px-4 py-2 num text-right">{fmtINR2((b.qty || 0) * (b.rate || 0))}</td>
              <td className="px-4 py-2 text-right">{!locked && <button className="text-xs text-[var(--status-stuck)]" onClick={() => removeLine(b.id)}>✕</button>}</td>
            </tr>
          ))}
        </Table>
        <div className="mt-2 text-right text-sm">Harness material: <span className="num font-medium">{fmtINR2(harnessTotal)}</span></div>
      </Card>

      <Card title="Manual additions" action={!locked && <Button variant="secondary" onClick={addLine}>+ Add line</Button>}>
        <p className="text-xs text-muted-foreground mb-3">Anything beyond the engine — special hardware, client-supplied items, one-off extras.</p>
        {additions.length === 0 ? <Empty title="No additions" hint={locked ? "" : "Most orders need none — the engine covers the harness."} /> : (
          <Table headers={["Description", "Qty", "Unit", "Rate ₹", "Subtotal", ""]}>
            {additions.map(b => (
              <tr key={b.id}>
                <td className="px-4 py-2"><Input value={b.description} disabled={locked} onChange={e => update(b.id, { description: e.target.value })} /></td>
                <td className="px-4 py-2 w-24"><Input type="number" value={b.qty} disabled={locked} onChange={e => update(b.id, { qty: Number(e.target.value) })} /></td>
                <td className="px-4 py-2 w-24"><Select value={b.unit} disabled={locked} onChange={e => update(b.id, { unit: e.target.value })}><option value="m">m</option><option value="nos">nos</option></Select></td>
                <td className="px-4 py-2 w-24"><Input type="number" value={b.rate ?? 0} disabled={locked} onChange={e => update(b.id, { rate: Number(e.target.value) })} /></td>
                <td className="px-4 py-2 num text-right">{fmtINR2((b.qty || 0) * (b.rate || 0))}</td>
                <td className="px-4 py-2 text-right">{!locked && <button className="text-xs text-[var(--status-stuck)]" onClick={() => removeLine(b.id)}>✕</button>}</td>
              </tr>
            ))}
          </Table>
        )}
        {additions.length > 0 && <div className="mt-2 text-right text-sm">Additions: <span className="num font-medium">{fmtINR2(addTotal)}</span></div>}
      </Card>

      <Modal open={confirmRevise} onClose={() => setConfirmRevise(false)} title="Revise the BOM?" maxW="max-w-md">
        <p className="text-sm text-muted-foreground">This unlocks the BOM as <b className="text-foreground">Rev {p.bomRev + 1}</b>. {p.hasQuote && <span>The current quote (Rev {o.quote && o.quote.rev}) will be flagged <b className="text-[var(--status-stuck)]">out of date</b> and must be re-sent{p.approved ? ", and the approval is voided" : ""}.</span>}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmRevise(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { reviseBom(oid); logActivity("Planning", `BOM revised to Rev ${(o.bomRev || 1) + 1} — ${o.woNo}`, "warn"); toast(`BOM unlocked as Rev ${(o.bomRev || 1) + 1}`); setConfirmRevise(false); }}>Revise &amp; unlock</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Costing & Quote (gated behind BOM lock) ----------
function CostingTab({ order, p }) {
  const { computeCosting, updateOrderCosting, saveQuote, approveQuote, logActivity, toast, Card, Button, Field, Input, Empty, Pill, fmtINR, fmtINR2, fmtNum } = window;
  const o = order;
  const c = computeCosting(o);
  const editable = p.bomLocked && !p.approved;       // can't tweak price after approval (unless revised)
  const setC = (patch) => updateOrderCosting(o.id, patch);
  const bump = (key, delta, min, max) => { const v = Math.min(max, Math.max(min, (c[key]) + delta)); setC({ [key]: +v.toFixed(1) }); };

  const Line = ({ label, value, hint, strong }) => (
    <div className={`flex items-center justify-between py-2 ${strong ? "border-t border-border mt-1 pt-3" : ""}`}>
      <div><div className={`text-sm ${strong ? "font-semibold" : ""}`}>{label}</div>{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}</div>
      <div className={`num ${strong ? "text-lg font-semibold" : "text-sm"}`}>{fmtINR2(value)}</div>
    </div>
  );

  if (!p.bomLocked) {
    return (
      <Card title="Costing & Quote">
        <Empty title="🔒 Locked — finalize the BOM first" hint="Costing is intentionally unavailable until the BOM is locked, so a quote can never be built on a moving target." action={<Button onClick={() => window.openOrder(o.id, "bom")}>Go to BOM</Button>} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {p.stale && (
        <div className="rounded-lg border border-[color-mix(in_oklab,var(--status-stuck)_40%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_7%,transparent)] px-4 py-3 text-sm text-[var(--status-stuck)]">
          ⚠ The BOM was revised to <b>Rev {p.bomRev}</b> after this quote (Rev {o.quote.rev}, on BOM Rev {o.quote.bomRevAtQuote}). Re-send the quote to bring it up to date.
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <Card title="Cost build-up">
          <Line label="Material" hint="Locked BOM, from material master" value={c.material} />
          <Line label={`Wastage (${c.wastagePct}%)`} hint="Cutting offcuts & rejects" value={c.wastage} />
          <Line label="Labour" hint={`${fmtNum(c.minutes)} build-min × ₹${c.labourRate}/min`} value={c.labour} />
          <Line label={`Overhead (${c.overheadPct}%)`} hint="Power, floor, supervision" value={c.overhead} />
          <Line label="Works cost" value={c.cost} strong />
          <Line label={`Margin (${c.marginPct}%)`} value={c.margin} />
          <Line label="Quote total" value={c.total} strong />
          <div className="mt-3 flex items-center justify-between rounded-md bg-primary-soft px-4 py-3"><span className="text-sm text-primary">Per unit ({o.qty} units)</span><span className="num text-xl font-display text-primary">{fmtINR2(c.perUnit)}</span></div>
        </Card>

        <div className="space-y-4">
          <Card title="Margin">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => bump("marginPct", -1, 0, 60)} disabled={!editable}>−</Button>
              <div className="flex-1 text-center"><span className="num text-3xl font-display text-primary">{c.marginPct}%</span></div>
              <Button variant="secondary" onClick={() => bump("marginPct", 1, 0, 60)} disabled={!editable}>+</Button>
            </div>
            <input type="range" min="0" max="40" step="1" value={c.marginPct} disabled={!editable} onChange={e => setC({ marginPct: Number(e.target.value) })} className="w-full mt-3 accent-[var(--primary)]" />
            <div className="mt-2 text-center text-sm">→ <span className="num font-medium">{fmtINR(c.total)}</span> total</div>
          </Card>
          <Card title="Cost drivers">
            <div className="space-y-3">
              <Field label="Wastage %"><Input type="number" value={c.wastagePct} disabled={!editable} onChange={e => setC({ wastagePct: Number(e.target.value) })} /></Field>
              <Field label="Labour rate (₹/min)"><Input type="number" value={c.labourRate} disabled={!editable} onChange={e => setC({ labourRate: Number(e.target.value) })} /></Field>
              <Field label="Overhead %"><Input type="number" value={c.overheadPct} disabled={!editable} onChange={e => setC({ overheadPct: Number(e.target.value) })} /></Field>
            </div>
          </Card>
        </div>
      </div>

      {/* Quote + approval action bar */}
      <Card title="Quote & approval">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm">
            {!p.hasQuote && <span className="text-muted-foreground">Not quoted yet — send the quote to the client for approval.</span>}
            {p.hasQuote && !p.approved && <span>Quote <b>Rev {o.quote.rev}</b> · {fmtINR(o.quote.total)} · <Pill tone={p.stale ? "stuck" : "active"}>{p.stale ? "Out of date" : "Sent — awaiting approval"}</Pill></span>}
            {p.approved && <span>Quote <b>Rev {o.quote.rev}</b> · {fmtINR(o.quote.total)} · <Pill tone="done">Approved</Pill> — costing is now locked.</span>}
          </div>
          <div className="flex items-center gap-2">
            {(!p.hasQuote || p.stale) && <Button onClick={() => { saveQuote(o.id); logActivity("Planning", `Quote ${p.hasQuote ? "re-sent" : "sent"} — ${o.woNo} (${fmtINR(c.total)})`); toast("Quote sent for approval"); }}>{p.stale ? "Re-send quote" : "Send quote"} →</Button>}
            {p.hasQuote && !p.approved && !p.stale && <Button onClick={() => { approveQuote(o.id); logActivity("Planning", `Quote approved — ${o.woNo}. Procurement open.`); toast("Quote approved — procurement unlocked"); window.openOrder(o.id, "procurement"); }}>✓ Mark approved</Button>}
          </div>
        </div>
        {p.approved && <p className="mt-3 text-[11px] text-muted-foreground">To change the price, revise the BOM (Rev {p.bomRev + 1}) — that re-opens costing and voids this approval.</p>}
      </Card>
    </div>
  );
}

// ---------- Procurement (gated behind approval) ----------
function ProcurementTab({ order, p }) {
  const { getState, useStore, setStoreState, logActivity, uid, nowISO, rateOf, materialMeta, procurementDecision, toast, Card, Pill, Button, Select, Table, Empty, fmtNum, fmtINR, NewRFQModal, CompareModal } = window;
  useStore(s => s.pos); useStore(s => s.inwards); useStore(s => s.stock);
  const rfqs = useStore(s => s.supplierRfqs);
  const suppliers = useStore(s => s.suppliers);
  const o = order;
  const dec = procurementDecision(o, getState());
  const [supplier, setSupplier] = wsUseState(dec.preferred || suppliers[0]);
  const [rfqOpen, setRfqOpen] = wsUseState(false);
  const [compareId, setCompareId] = wsUseState(null);

  if (!p.approved) {
    return (
      <Card title="Procurement">
        <Empty title="🔒 Locked — quote not approved yet" hint="You can't order material until the client approves the quote. This prevents buying against a job that may still change." action={<Button onClick={() => window.openOrder(o.id, "costing")}>Go to Costing & Quote</Button>} />
      </Card>
    );
  }

  const rows = window.procurementForOrder(o, getState());
  const shortages = rows.filter(r => r.toOrder > 0);
  const pos = getState().pos.filter(p2 => p2.woNo === o.woNo);
  const jobRfqs = rfqs.filter(r => r.woNo === o.woNo);

  function raisePo() {
    if (!shortages.length) { toast("Nothing to order"); return; }
    const poNo = "PO-" + (2400 + Math.floor(Math.random() * 600));
    setStoreState(s => {
      s.pos.unshift({ id: uid(), poNo, supplier, woNo: o.woNo, status: "Ordered", createdAt: nowISO(), items: shortages.map(r => ({ description: r.description, qty: r.toOrder, unit: r.unit, rate: rateOf(r.description) })) });
      const ord = s.orders.find(x => x.id === o.id); if (ord && ord.stage === "Approved") ord.stage = "PO";
      return s;
    });
    logActivity("Planning", `${poNo} raised to ${supplier} — ${shortages.length} items (${o.woNo})`);
    toast("PO raised");
  }

  const tone = (st) => st === "To order" ? "stuck" : st === "Ordered" ? "active" : st === "Received" ? "done" : "pending";

  return (
    <div className="space-y-6">
      {/* Decision banner — RFQ is the exception, not the gate */}
      {shortages.length > 0 && (
        dec.recommendRfq ? (
          <div className="rounded-lg border border-[color-mix(in_oklab,var(--amber)_45%,transparent)] bg-[color-mix(in_oklab,var(--amber)_8%,transparent)] p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Pill tone="amber">Get quotes recommended</Pill></div>
                <div className="mt-1.5 text-sm text-foreground">{dec.reason}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">Compare 2–3 suppliers, then award — awarding raises the PO automatically.</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button onClick={() => setRfqOpen(true)}>Get quotes →</Button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-[color-mix(in_oklab,var(--amber)_25%,transparent)] pt-3">
              <span className="text-[11px] text-muted-foreground">Or skip quoting:</span>
              <Select value={supplier} onChange={e => setSupplier(e.target.value)} className="!w-auto">{suppliers.map(s => <option key={s}>{s}</option>)}</Select>
              <Button variant="secondary" onClick={raisePo}>Raise PO anyway · {shortages.length}</Button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-primary/30 bg-primary-soft p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2"><Pill tone="active">Direct PO recommended</Pill></div>
                <div className="mt-1.5 text-sm text-foreground">{dec.reason}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">One click raises a PO to <b className="text-foreground">{dec.preferred}</b> for all {shortages.length} short item{shortages.length > 1 ? "s" : ""}.</div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <Select value={supplier} onChange={e => setSupplier(e.target.value)} className="!w-auto">{suppliers.map(s => <option key={s}>{s}</option>)}</Select>
                  <Button onClick={raisePo}>Raise PO · {fmtINR(dec.value)}</Button>
                </div>
                <button onClick={() => setRfqOpen(true)} className="text-[11px] text-primary hover:underline">or get quotes instead →</button>
              </div>
            </div>
          </div>
        )
      )}

      <Card title="Material status — demand vs cover">
        <p className="text-sm text-muted-foreground mb-3">What this job needs, netted against stock on hand and open POs — so you order only the shortfall, never what you already have or have coming.</p>
        <Table headers={["Material", "Required", "In stock", "On order", "Received", "To order", "Source", "Status"]}>
          {rows.map(r => {
            const meta = materialMeta(r.description);
            return (
              <tr key={r.description}>
                <td className="px-4 py-2.5">{r.description}</td>
                <td className="px-4 py-2.5 num">{fmtNum(r.required)} {r.unit}</td>
                <td className="px-4 py-2.5 num text-muted-foreground">{fmtNum(r.inStock)}</td>
                <td className="px-4 py-2.5 num text-muted-foreground">{fmtNum(r.onOrder)}</td>
                <td className="px-4 py-2.5 num text-muted-foreground">{fmtNum(r.received)}</td>
                <td className="px-4 py-2.5 num font-medium">{r.toOrder > 0 ? `${fmtNum(r.toOrder)} ${r.unit}` : "—"}</td>
                <td className="px-4 py-2.5 text-xs"><div className="text-foreground">{meta.preferredSupplier || "—"}</div><div className="text-[10px] text-muted-foreground">{meta.soleSource ? "Sole-source" : "Multi-source"}</div></td>
                <td className="px-4 py-2.5"><Pill tone={tone(r.status)}>{r.status}</Pill></td>
              </tr>
            );
          })}
        </Table>
      </Card>

      {jobRfqs.length > 0 && (
        <Card title="Supplier quotes for this job">
          <Table headers={["RFQ No", "Items", "Bids in", "Status", ""]}>
            {jobRfqs.map(r => {
              const submitted = r.bids.filter(b => b.submitted).length;
              return (
                <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setCompareId(r.id)}>
                  <td className="px-4 py-2.5 font-mono text-xs num">{r.rfqNo}</td>
                  <td className="px-4 py-2.5 num text-xs">{r.items.length}</td>
                  <td className="px-4 py-2.5 num text-xs">{submitted}/{r.bids.length}</td>
                  <td className="px-4 py-2.5">{r.status === "Awarded" ? <Pill tone="done">Awarded · {r.awardedSupplier}</Pill> : <Pill tone="active">Open</Pill>}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">Compare →</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      <Card title="Purchase orders for this job">
        {pos.length === 0 ? <Empty title="No POs raised yet" hint={shortages.length ? "Raise one for the shortages above." : "Stock covers this job."} /> : (
          <Table headers={["PO No", "Supplier", "Items", "Status", "Receipt"]}>
            {pos.map(po => {
              const recvNote = po.status === "Received" ? "Fully received in Stores" : po.status === "Partially Received" ? "Partial — see Stores inward" : "Awaiting goods";
              return (
                <tr key={po.id}>
                  <td className="px-4 py-2.5 font-mono text-xs num">{po.poNo}</td>
                  <td className="px-4 py-2.5">{po.supplier}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{po.items.map(i => i.description).join(", ")}</td>
                  <td className="px-4 py-2.5"><Pill tone={po.status === "Received" ? "done" : po.status === "Partially Received" ? "amber" : "active"}>{po.status}</Pill></td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{recvNote}</td>
                </tr>
              );
            })}
          </Table>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Receipt is automatic — a PO becomes Partial / Received as Inventory logs goods inward in Stores. No "mark received" step.</p>
      </Card>

      {rfqOpen && <NewRFQModal orderId={o.id} onClose={() => setRfqOpen(false)} />}
      {compareId && <CompareModal rfqId={compareId} onClose={() => setCompareId(null)} />}
    </div>
  );
}

// ---------- Build & delivery (read-only downstream — owned by Inventory & Quality) ----------
function DeliveryTab({ order, p }) {
  const { useStore, getState, buildMinutes, Card, Pill, Empty, fmtDate, fmtDateTime, fmtNum, STAGES } = window;
  useStore(s => s.issues); useStore(s => s.finalQcJobs); useStore(s => s.qcRecords); useStore(s => s.orders);
  const o = order;
  const s = getState();
  const si = STAGES.indexOf(o.stage);

  if (si < STAGES.indexOf("Build")) {
    return (
      <Card title="Build & delivery">
        <Empty title="🔒 Not on the floor yet" hint="This opens once the job is released to build. Material must be covered and the job released from the Release board first." action={<button onClick={() => window.openOrder(o.id, "procurement")} className="text-sm font-medium text-primary">Go to Procurement</button>} />
      </Card>
    );
  }

  const issues = s.issues.filter(i => i.woNo === o.woNo);
  const qcJob = s.finalQcJobs.find(j => j.woNo === o.woNo);
  const finalRecords = s.qcRecords.filter(r => r.kind === "Final" && r.refId === o.woNo);
  const buildHrs = buildMinutes(o.config, o.qty || 1) / 60;

  const phaseStatus = (phaseStage) => {
    const pIdx = STAGES.indexOf(phaseStage);
    if (si > pIdx) return "done";
    if (si === pIdx) return o.stuck && phaseStage === "Final QC" ? "warn" : "current";
    return "todo";
  };
  const dot = { done: "var(--status-done)", current: "var(--status-active)", warn: "var(--status-stuck)", todo: "var(--border)" };
  const Phase = ({ stage, title, status, children }) => (
    <div className="relative pl-8">
      <span className="absolute left-0 top-1 grid h-5 w-5 place-items-center rounded-full" style={{ background: dot[status] }}>
        {status === "done" ? <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="h-3 w-3"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> : status === "warn" ? <span className="text-white text-[11px] font-bold">!</span> : <span className="h-2 w-2 rounded-full bg-white" />}
      </span>
      <div className="flex items-center gap-2">
        <h4 className="text-[15px] font-semibold tracking-tight">{title}</h4>
        {status === "done" ? <Pill tone="done">Done</Pill> : status === "current" ? <Pill tone="active">In progress</Pill> : status === "warn" ? <Pill tone="stuck">Hold</Pill> : <Pill tone="pending">Pending</Pill>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Read-only floor view.</span> Build runs at the bench, final QC &amp; dispatch are run by Quality — Planning follows it here. Actions live in those modules.
      </div>

      <Card title="Build → Final QC → Dispatch">
        <div className="space-y-7 before:absolute relative">
          <div className="absolute left-[9px] top-3 bottom-3 w-px bg-border" />

          <Phase stage="Build" title="Build" status={phaseStatus("Build")}>
            <div className="text-[11px] text-muted-foreground num mb-2">≈ {buildHrs.toFixed(1)} h estimated · {o.qty} unit{o.qty > 1 ? "s" : ""}</div>
            {issues.length === 0 ? (
              <p className="text-xs text-muted-foreground">No material issued to this job yet.</p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Issued</th><th className="px-3 py-2 text-left font-medium">Material</th><th className="px-3 py-2 text-right font-medium">Qty</th></tr></thead>
                  <tbody className="divide-y divide-border bg-white">
                    {issues.map(i => (
                      <tr key={i.id}><td className="px-3 py-2 num text-xs text-muted-foreground">{fmtDate(i.date)}</td><td className="px-3 py-2 text-xs">{i.itemDescription}</td><td className="px-3 py-2 num text-xs text-right">{fmtNum(i.qty)} {i.unit}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Phase>

          <Phase stage="Final QC" title="Final QC" status={phaseStatus("Final QC")}>
            {o.stuck && o.stage === "Final QC" && (
              <div className="mb-2 rounded-md border border-[color-mix(in_oklab,var(--status-stuck)_30%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_7%,transparent)] px-3 py-2 text-xs text-[var(--status-stuck)]">{o.stuck.reason}</div>
            )}
            {finalRecords.length === 0 ? (
              <p className="text-xs text-muted-foreground">{qcJob ? `Status: ${qcJob.status}` : "Not yet inspected."}</p>
            ) : (
              <div className="space-y-2">
                {finalRecords.map(r => (
                  <div key={r.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs text-muted-foreground num">{fmtDateTime(r.date)} · {r.checkedBy}</span>
                      <Pill tone={r.disposition === "Pass" ? "done" : "stuck"}>{r.disposition}</Pill>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                      {r.rows.map((row, i) => <div key={i} className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground truncate">{row.parameter}</span><span className="num">{row.observation || "—"}</span></div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Phase>

          <Phase stage="Dispatch" title="Dispatch" status={phaseStatus("Dispatch")}>
            {o.stage === "Dispatch" ? (
              <p className="text-sm">Dispatched <span className="num font-medium">{fmtDate(o.dispatchedDate)}</span> · due was {fmtDate(o.dueDate)}.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Ships once final QC passes.</p>
            )}
          </Phase>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { OrderWorkspace });
