// Planning — order register + Projects rollup. Detail lives in the Order Workspace.
const { useMemo: plUseMemo, useState: plUseState } = React;

function NewOrderModal({ open, onClose }) {
  const { Modal, Field, Input, Select, Button, setStoreState, logActivity, uid, toast, toISODate, generateHarness, openOrder, parseConfig, FEEDER_LEGEND } = window;
  const [f, setF] = plUseState({ woNo: "", client: "", project: "", product: "8DJHST", config: "RRL", motorised: false, qty: 1, poDate: "", dueDate: "" });
  const [err, setErr] = plUseState({});
  const feeders = parseConfig(f.config);

  function submit() {
    const e = {};
    if (!f.woNo) e.woNo = "Enter a W/O number";
    if (!f.client) e.client = "Enter a client";
    if (!f.qty || f.qty < 1) e.qty = "Enter a quantity";
    setErr(e);
    if (Object.keys(e).length) return;
    const id = uid();
    setStoreState(s => {
      s.orders.unshift({ id, woNo: f.woNo, client: f.client, project: f.project || undefined, product: f.product, config: f.config, motorised: f.motorised, qty: Number(f.qty), poDate: toISODate(f.poDate), dueDate: toISODate(f.dueDate), stage: "Final BOM", costing: {}, bom: generateHarness(f.config, Number(f.qty)) });
      return s;
    });
    logActivity("Planning", `New order ${f.woNo} (${f.client}) — engine built harness from ${f.config}`);
    toast("Order created — harness generated");
    setF({ woNo: "", client: "", project: "", product: "8DJHST", config: "RRL", motorised: false, qty: 1, poDate: "", dueDate: "" });
    onClose();
    openOrder(id, "bom");
  }

  return (
    <Modal open={open} onClose={onClose} title="New order">
      <div className="grid grid-cols-2 gap-4">
        <Field label="W/O No" error={err.woNo}><Input value={f.woNo} onChange={e => setF({ ...f, woNo: e.target.value })} placeholder="RS-WO-24-00XX" /></Field>
        <Field label="Client" error={err.client}><Input value={f.client} onChange={e => setF({ ...f, client: e.target.value })} placeholder="Client A" /></Field>
        <Field label="Project" hint="Group multiple W/Os under one project"><Input value={f.project} onChange={e => setF({ ...f, project: e.target.value })} placeholder="e.g. Project Alpha" /></Field>
        <Field label="Product"><Select value={f.product} onChange={e => setF({ ...f, product: e.target.value })}><option>8DJHST</option><option>8FB20</option></Select></Field>
        <Field label="Config" hint="e.g. RRL, RRL+ME, LRRL+ME"><Input value={f.config} onChange={e => setF({ ...f, config: e.target.value })} /></Field>
        <Field label="Motorised"><Select value={f.motorised ? "yes" : "no"} onChange={e => setF({ ...f, motorised: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></Select></Field>
        <Field label="Qty" error={err.qty}><Input type="number" value={f.qty} onChange={e => setF({ ...f, qty: Number(e.target.value) })} /></Field>
        <Field label="PO date"><Input type="date" value={f.poDate} onChange={e => setF({ ...f, poDate: e.target.value })} /></Field>
        <Field label="Due date"><Input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
      <div className="mt-2 rounded-md bg-primary-soft/50 border border-primary/20 px-3 py-2 text-xs text-primary">
        Engine will build the harness for <span className="font-mono">{f.config}</span> → {feeders.length} feeder{feeders.length !== 1 ? "s" : ""}: {feeders.map(x => FEEDER_LEGEND[x] || x).join(", ") || "—"}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>Create &amp; open</Button>
      </div>
    </Modal>
  );
}

function Planning({ readOnly = false }) {
  const { useStore, openOrder, Card, Pill, Button, Select, Input, Table, StageTracker, computeCosting, procurementForOrder, getState, fmtINR, fmtDate } = window;
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const [showNew, setShowNew] = plUseState(false);
  const [filter, setFilter] = plUseState("All");
  const [q, setQ] = plUseState("");

  const clients = plUseMemo(() => ["All", ...Array.from(new Set(orders.map(o => o.client)))], [orders]);
  const visible = orders.filter(o => (filter === "All" || o.client === filter) && (!q || (o.woNo + o.client + (o.project || "") + o.config).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders &amp; BOM</h1>
          <p className="text-sm text-muted-foreground">Every work order. Click one to open its workspace — config → harness, costing, procurement, drawings, all in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search W/O, client, config…" className="!w-56" />
          <Select value={filter} onChange={e => setFilter(e.target.value)} className="!w-auto min-w-[10rem]">{clients.map(c => <option key={c}>{c}</option>)}</Select>
          {!readOnly && <Button onClick={() => setShowNew(true)}>+ New order</Button>}
        </div>
      </div>

      <Card>
        <Table headers={["W/O No", "Client / Project", "Config", "Qty", "Due", "Quote", "Procurement", "Progress", ""]}>
          {visible.map(o => {
            const c = computeCosting(o);
            const proc = procurementForOrder(o, getState());
            const short = proc.filter(r => r.toOrder > 0).length;
            const overdue = o.dueDate && new Date(o.dueDate) < new Date() && o.stage !== "Dispatch";
            return (
              <tr key={o.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openOrder(o.id)}>
                <td className="px-4 py-3 font-mono text-xs num">{o.woNo}</td>
                <td className="px-4 py-3"><div className="text-sm">{o.client}</div><div className="text-[11px] text-muted-foreground">{o.project || "—"}</div></td>
                <td className="px-4 py-3 font-mono text-xs">{o.config}</td>
                <td className="px-4 py-3 num">{o.qty}</td>
                <td className="px-4 py-3 num text-xs">{overdue ? <span className="text-[var(--status-stuck)]">{fmtDate(o.dueDate)}</span> : fmtDate(o.dueDate)}</td>
                <td className="px-4 py-3 num text-xs">{o.quote ? fmtINR(o.quote.total) : <span className="text-muted-foreground">{fmtINR(c.total)}*</span>}</td>
                <td className="px-4 py-3">{short > 0 ? <Pill tone="amber">{short} to order</Pill> : <Pill tone="done">Covered</Pill>}</td>
                <td className="px-4 py-3 min-w-[180px]">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`text-[11px] font-medium ${o.stuck ? "text-[var(--status-stuck)]" : o.stage === "Dispatch" ? "text-[var(--status-done)]" : "text-muted-foreground"}`}>{o.stuck ? `${o.stage} · stuck` : o.stage}</span>
                  </div>
                  <StageTracker stage={o.stage} stuck={!!o.stuck} />
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">Open →</td>
              </tr>
            );
          })}
        </Table>
        <p className="mt-2 text-[11px] text-muted-foreground">* indicative quote from the engine — not yet sent to client.</p>
      </Card>

      <NewOrderModal open={showNew} onClose={() => setShowNew(false)} />
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-display num ${tone === "stuck" && value > 0 ? "text-[var(--status-stuck)]" : tone === "amber" && value > 0 ? "text-[var(--amber)]" : ""}`}>{value}</div>
    </div>
  );
}

function Kpi_pl({ label, value, sub, tone }) {
  const color = tone === "bad" ? "text-[var(--status-stuck)]" : tone === "warn" ? "text-[var(--amber)]" : tone === "good" ? "text-[var(--status-done)]" : tone === "active" ? "text-[var(--status-active)]" : "";
  return (
    <div className="card-panel p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-display num ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PlanningDashboard({ readOnly = false }) {
  const { useStore, openOrder, Card, Pill, Select, Empty, StageTracker, computeCosting, procurementForOrder, getState, fmtINR, fmtDate } = window;
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const [clientFilter, setClientFilter] = plUseState("All");
  const [stageFilter, setStageFilter] = plUseState("All");
  const s = getState();
  const now = Date.now();

  const clients = plUseMemo(() => ["All", ...Array.from(new Set(orders.map(o => o.client)))], [orders]);

  const m = plUseMemo(() => {
    const active = orders.filter(o => o.stage !== "Dispatch");
    const toQuote = orders.filter(o => ["RFQ", "Final BOM", "Costing"].includes(o.stage));
    const toOrder = active.filter(o => procurementForOrder(o, s).some(r => r.toOrder > 0));
    const overdue = active.filter(o => o.dueDate && new Date(o.dueDate).getTime() < now);
    const dueSoon = active.filter(o => { if (!o.dueDate) return false; const d = new Date(o.dueDate).getTime(); return d >= now && d < now + 7 * 86400000; });
    const stuck = orders.filter(o => o.stuck);
    const book = active.reduce((a, o) => a + ((o.quote || {}).total ?? computeCosting(o).total), 0);
    return { active, toQuote, toOrder, overdue, dueSoon, stuck, book };
  }, [orders, s, now]);

  const attention = plUseMemo(() => {
    const items = [];
    orders.forEach(o => {
      if (o.stuck) items.push({ o, kind: "Stuck", tone: "stuck", note: o.stuck.reason, pr: 0 });
      else if (o.dueDate && new Date(o.dueDate).getTime() < now && o.stage !== "Dispatch") items.push({ o, kind: "Overdue", tone: "stuck", note: `Due ${fmtDate(o.dueDate)}`, pr: 1 });
      else if (o.stage !== "Dispatch" && procurementForOrder(o, s).some(r => r.toOrder > 0)) items.push({ o, kind: "To order", tone: "amber", note: `${procurementForOrder(o, s).filter(r => r.toOrder > 0).length} items short`, pr: 2 });
      else if (["RFQ", "Final BOM", "Costing"].includes(o.stage)) items.push({ o, kind: "To quote", tone: "active", note: `At ${o.stage}`, pr: 3 });
    });
    return items.sort((a, b) => a.pr - b.pr);
  }, [orders, s, now]);

  const filteredOrders = plUseMemo(() => orders.filter(o => {
    if (clientFilter !== "All" && o.client !== clientFilter) return false;
    if (stageFilter === "Active") return o.stage !== "Dispatch";
    if (stageFilter === "Overdue") return o.dueDate && new Date(o.dueDate) < new Date() && o.stage !== "Dispatch";
    if (stageFilter === "Stuck") return !!o.stuck;
    if (stageFilter === "Dispatched") return o.stage === "Dispatch";
    return true;
  }), [orders, clientFilter, stageFilter]);

  const groups = plUseMemo(() => {
    const map = new Map();
    for (const o of filteredOrders) { const l = map.get(o.client) || []; l.push(o); map.set(o.client, l); }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planning dashboard</h1>
        <p className="text-sm text-muted-foreground">Where every job stands and what needs you next. Click anything to open its workspace.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi_pl label="Active orders" value={m.active.length} sub={`${orders.length} total`} />
        <Kpi_pl label="To quote" value={m.toQuote.length} sub="RFQ → Costing" tone={m.toQuote.length ? "active" : undefined} />
        <Kpi_pl label="To order" value={m.toOrder.length} sub="Material short" tone={m.toOrder.length ? "warn" : "good"} />
        <Kpi_pl label="Due this week" value={m.dueSoon.length} sub="Next 7 days" tone={m.dueSoon.length ? "warn" : undefined} />
        <Kpi_pl label="Overdue" value={m.overdue.length} sub="Past due" tone={m.overdue.length ? "bad" : "good"} />
        <Kpi_pl label="Order book" value={fmtINR(m.book)} sub="Active value" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="Needs your attention" action={<Pill tone={attention.length ? "amber" : "done"}>{attention.length}</Pill>}>
          {attention.length === 0 ? <Empty title="All clear" hint="Nothing waiting on planning." /> : (
            <ul className="space-y-2 max-h-[22rem] overflow-y-auto pr-1">
              {attention.map(({ o, kind, tone, note }) => (
                <li key={o.id}>
                  <button onClick={() => openOrder(o.id)} className="w-full flex items-center justify-between gap-3 rounded-md border border-border p-3 text-left hover:border-primary hover:bg-muted/40 transition-colors">
                    <div className="min-w-0">
                      <div className="font-mono text-xs num">{o.woNo} <span className="font-sans text-muted-foreground">· {o.client}</span></div>
                      <div className="text-[11px] text-muted-foreground truncate">{note}</div>
                    </div>
                    <Pill tone={tone}>{kind}</Pill>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Pipeline by stage">
          <div className="space-y-2">
            {window.STAGES.map(st => {
              const list = orders.filter(o => o.stage === st);
              if (list.length === 0) return null;
              const pct = Math.round((list.length / Math.max(1, orders.length)) * 100);
              return (
                <div key={st} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-xs text-muted-foreground">{st}</div>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary/70" style={{ width: `${Math.max(pct, 6)}%` }} /></div>
                  <div className="w-8 text-right num text-sm">{list.length}</div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-semibold tracking-tight">By client</h2>
        <div className="flex items-center gap-2">
          <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="!w-auto min-w-[10rem]">{clients.map(c => <option key={c}>{c}</option>)}</Select>
          <Select value={stageFilter} onChange={e => setStageFilter(e.target.value)} className="!w-auto min-w-[10rem]">
            <option value="All">All stages</option><option value="Active">Active only</option><option value="Overdue">Overdue</option><option value="Stuck">Stuck</option><option value="Dispatched">Dispatched</option>
          </Select>
        </div>
      </div>

      {groups.length === 0 ? <Empty title="No projects match the filter" /> : (
        <div className="grid lg:grid-cols-2 gap-5">
          {groups.map(([client, list]) => {
            const active = list.filter(o => o.stage !== "Dispatch").length;
            const overdue = list.filter(o => o.dueDate && new Date(o.dueDate) < new Date() && o.stage !== "Dispatch").length;
            const stuck = list.filter(o => o.stuck).length;
            const toOrder = list.reduce((a, o) => a + procurementForOrder(o, s).filter(r => r.toOrder > 0).length, 0);
            const value = list.reduce((a, b) => a + ((b.quote || {}).total ?? 0), 0);
            return (
              <Card key={client} title={client} action={<Pill tone={stuck ? "stuck" : overdue ? "amber" : "active"}>{list.length} W/Os</Pill>}>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <Mini label="Active" value={active} />
                  <Mini label="Overdue" value={overdue} tone="stuck" />
                  <Mini label="Stuck" value={stuck} tone="stuck" />
                  <Mini label="To order" value={toOrder} tone="amber" />
                </div>
                <div className="space-y-2">
                  {list.map(o => {
                    const short = procurementForOrder(o, s).filter(r => r.toOrder > 0).length;
                    return (
                      <button key={o.id} onClick={() => openOrder(o.id)} className="w-full text-left rounded-md border border-border p-3 hover:border-primary hover:bg-muted/40 transition-colors">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <div className="font-mono text-xs num">{o.woNo} <span className="text-muted-foreground font-sans">· {o.config} · Qty {o.qty}</span></div>
                            <div className="text-[11px] text-muted-foreground truncate">{o.project || "—"}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {short > 0 && <Pill tone="amber">{short} to order</Pill>}
                            {o.stuck ? <Pill tone="stuck">{o.stage}</Pill> : o.stage === "Dispatch" ? <Pill tone="done">{o.stage}</Pill> : <Pill tone="active">{o.stage}</Pill>}
                          </div>
                        </div>
                        <StageTracker stage={o.stage} stuck={!!o.stuck} />
                      </button>
                    );
                  })}
                </div>
                {value > 0 && <div className="mt-3 text-xs text-muted-foreground">Quoted value: <span className="num text-foreground">{fmtINR(value)}</span></div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { Planning, PlanningDashboard, Projects: PlanningDashboard });
