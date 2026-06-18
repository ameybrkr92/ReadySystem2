import { useMemo, useRef, useState } from "react";
import { useStore, setState, logActivity, uid, PLANNER_TEMPLATE, addOrderDoc, removeOrderDoc, DOC_KINDS, MAX_DOC_BYTES, type Order, type BomItem, type OrderDoc, type DocKind } from "@/lib/erp-store";
import { Card, Pill, Button, Field, Input, Select, Modal, Table, Empty, StageTracker, toast, Textarea } from "./ui";
import { fmtDate, fmtNum, fmtINR, toISODate, todayISO } from "@/lib/format";

const FEEDER_LEGEND: Record<string, string> = { R: "Ring-main", L: "Circuit-breaker", T: "Transformer", K: "Cable", S: "Sectionalizer" };

function parseFeeders(config: string) {
  const parts: string[] = [];
  for (const ch of config.replace(/[+\-]/g, "")) {
    if (FEEDER_LEGEND[ch]) parts.push(`${ch} — ${FEEDER_LEGEND[ch]}`);
    else if (ch === "M" || ch === "E") parts.push("ME — Metering");
  }
  return [...new Set(parts)];
}

export function Planning({ readOnly = false }: { readOnly?: boolean }) {
  const orders = useStore(s => s.orders);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const order = orders.find(o => o.id === selected) || null;

  const clients = useMemo(() => ["All", ...Array.from(new Set(orders.map(o => o.client)))], [orders]);
  const visible = filter === "All" ? orders : orders.filter(o => o.client === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders &amp; BOM</h1>
          <p className="text-sm text-muted-foreground">Planner owns the full work-order lifecycle — from client BOM intake to additions, costing handoff and purchase.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onChange={e => setFilter(e.target.value)} className="!w-auto min-w-[12rem]">
            {clients.map(c => <option key={c}>{c}</option>)}
          </Select>
          {!readOnly && <Button onClick={() => setShowNew(true)}>+ New order</Button>}
        </div>
      </div>

      <Card>
        <Table headers={["W/O No", "Client / Project", "Product · Config", "Qty", "PO date", "Due", "BOM", "Stage", ""]}>
          {visible.map(o => {
            const client = o.bom.filter(b => (b.source ?? "client") === "client").length;
            const planner = o.bom.filter(b => b.source === "planner").length;
            return (
              <tr key={o.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelected(o.id)}>
                <td className="px-4 py-3 font-mono text-xs num">{o.woNo}</td>
                <td className="px-4 py-3"><div>{o.client}</div><div className="text-[11px] text-muted-foreground">{o.project ?? "—"}</div></td>
                <td className="px-4 py-3 text-xs">{o.product} · {o.config} {o.motorised && <span className="text-muted-foreground">· Motorised</span>}</td>
                <td className="px-4 py-3 num">{o.qty}</td>
                <td className="px-4 py-3 num text-xs">{fmtDate(o.poDate)}</td>
                <td className="px-4 py-3 num text-xs">{fmtDate(o.dueDate)}</td>
                <td className="px-4 py-3 text-xs num">{client}<span className="text-muted-foreground"> + {planner}</span></td>
                <td className="px-4 py-3">{o.stuck ? <Pill tone="stuck">{o.stage}</Pill> : o.stage === "Dispatch" ? <Pill tone="done">{o.stage}</Pill> : <Pill tone="active">{o.stage}</Pill>}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">Open →</td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <NewOrderModal open={showNew} onClose={() => setShowNew(false)} />
      <OrderDetail order={order} onClose={() => setSelected(null)} readOnly={readOnly} />
    </div>
  );
}

function NewOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ woNo: "", client: "", project: "", product: "8DJHST" as Order["product"], config: "RRL", motorised: false, qty: 1, poDate: "", dueDate: "" });
  const [err, setErr] = useState<Record<string, string>>({});

  function submit() {
    const e: Record<string, string> = {};
    if (!f.woNo) e.woNo = "Enter a W/O number";
    if (!f.client) e.client = "Enter a client";
    if (!f.qty || f.qty < 1) e.qty = "Enter a quantity";
    setErr(e);
    if (Object.keys(e).length) return;

    setState(s => {
      s.orders.unshift({
        id: uid(), woNo: f.woNo, client: f.client, project: f.project || undefined,
        product: f.product, config: f.config, motorised: f.motorised, qty: Number(f.qty),
        poDate: toISODate(f.poDate), dueDate: toISODate(f.dueDate),
        stage: "RFQ", bom: [],
      });
      return s;
    });
    logActivity("Planning", `New order created — ${f.woNo} (${f.client})`);
    toast("Order created");
    setF({ woNo: "", client: "", project: "", product: "8DJHST", config: "RRL", motorised: false, qty: 1, poDate: "", dueDate: "" });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New order">
      <div className="grid grid-cols-2 gap-4">
        <Field label="W/O No" error={err.woNo}><Input value={f.woNo} onChange={e => setF({ ...f, woNo: e.target.value })} placeholder="3009XXXXXX/100" /></Field>
        <Field label="Client" error={err.client}><Input value={f.client} onChange={e => setF({ ...f, client: e.target.value })} placeholder="Client A" /></Field>
        <Field label="Project" hint="Group multiple W/Os under one project"><Input value={f.project} onChange={e => setF({ ...f, project: e.target.value })} placeholder="e.g. Project Alpha — MV switchgear" /></Field>
        <Field label="Product"><Select value={f.product} onChange={e => setF({ ...f, product: e.target.value as Order["product"] })}><option>8DJHST</option><option>8FB20</option></Select></Field>
        <Field label="Config (Typical)" hint="e.g. RRL, RRL+ME, LRRL+ME"><Input value={f.config} onChange={e => setF({ ...f, config: e.target.value })} /></Field>
        <Field label="Motorised">
          <Select value={f.motorised ? "yes" : "no"} onChange={e => setF({ ...f, motorised: e.target.value === "yes" })}><option value="no">No</option><option value="yes">Yes</option></Select>
        </Field>
        <Field label="Qty" error={err.qty}><Input type="number" value={f.qty} onChange={e => setF({ ...f, qty: Number(e.target.value) })} /></Field>
        <Field label="PO date"><Input type="date" value={f.poDate} onChange={e => setF({ ...f, poDate: e.target.value })} /></Field>
        <Field label="Due date"><Input type="date" value={f.dueDate} onChange={e => setF({ ...f, dueDate: e.target.value })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit}>Create order</Button>
      </div>
    </Modal>
  );
}

function OrderDetail({ order, onClose, readOnly }: { order: Order | null; onClose: () => void; readOnly: boolean }) {
  const feeders = useMemo(() => (order ? parseFeeders(order.config) : []), [order]);
  const [importOpen, setImportOpen] = useState<null | "client" | "planner">(null);
  if (!order) return null;
  const o = order;
  const oid = o.id;

  function addItem(source: "client" | "planner") {
    setState(s => {
      const t = s.orders.find(x => x.id === oid)!;
      t.bom.push({ id: uid(), description: source === "client" ? "New client-BOM item" : "Harness / lug / consumable", qty: 1, unit: source === "client" ? "m" : "nos", rate: 0, source });
      return s;
    });
  }
  function updateItem(id: string, patch: Partial<BomItem>) {
    setState(s => {
      const t = s.orders.find(x => x.id === oid)!;
      const it = t.bom.find(b => b.id === id);
      if (it) Object.assign(it, patch);
      return s;
    });
  }
  function removeItem(id: string) {
    setState(s => { const t = s.orders.find(x => x.id === oid)!; t.bom = t.bom.filter(b => b.id !== id); return s; });
  }
  function importPlannerTemplate() {
    setState(s => {
      const t = s.orders.find(x => x.id === oid)!;
      const existing = new Set(t.bom.filter(b => b.source === "planner").map(b => b.description));
      for (const tpl of PLANNER_TEMPLATE) {
        if (!existing.has(tpl.description)) t.bom.push({ id: uid(), ...tpl });
      }
      return s;
    });
    toast("Planner template imported");
  }
  function finalise() {
    setState(s => {
      const t = s.orders.find(x => x.id === oid)!;
      t.bomSentDate = todayISO();
      if (["RFQ", "Final BOM"].includes(t.stage)) t.stage = "Costing";
      return s;
    });
    logActivity("Planning", `BOM finalised — sent to Costing (${o.woNo})`);
    toast("BOM finalised");
  }

  const clientBom = o.bom.filter(b => (b.source ?? "client") === "client");
  const plannerBom = o.bom.filter(b => b.source === "planner");
  const clientTotal = clientBom.reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const plannerTotal = plannerBom.reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);

  return (
    <Modal open={!!order} onClose={onClose} title={`Order ${o.woNo}`} maxW="max-w-5xl">
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        <Info label="Client" value={o.client} />
        <Info label="Project" value={o.project ?? "—"} />
        <Info label="Product · Config" value={`${o.product} · ${o.config}`} />
        <Info label="Qty" value={o.qty} />
        <Info label="PO date" value={fmtDate(o.poDate)} />
        <Info label="Due date" value={fmtDate(o.dueDate)} />
        <Info label="BOM → Costing on" value={fmtDate(o.bomSentDate)} />
        <Info label="Costing → Client on" value={fmtDate(o.costingSentDate)} />
        <Info label="Stage" value={<Pill tone={o.stuck ? "stuck" : o.stage === "Dispatch" ? "done" : "active"}>{o.stage}</Pill>} />
      </div>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Lifecycle</div>
        <StageTracker stage={o.stage} stuck={!!o.stuck} />
      </div>

      <div className="mb-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Feeders parsed from config</div>
        <div className="flex flex-wrap gap-2">{feeders.map(f => <Pill key={f} tone="pending">{f}</Pill>)}</div>
      </div>

      <DocsSection order={o} readOnly={readOnly} />

      <BomSection title="Client BOM" subtitle="From client drawing / customer BOM"
        items={clientBom} total={clientTotal} readOnly={readOnly}
        onAdd={() => addItem("client")} onUpdate={updateItem} onRemove={removeItem}
        extraActions={!readOnly && <Button variant="secondary" onClick={() => setImportOpen("client")}>Import (paste)</Button>} />

      <div className="mt-6">
        <BomSection title="Planner additions" subtitle="Harness, lugs, sleeves, consumables — engineered by planner, not in client BOM"
          items={plannerBom} total={plannerTotal} readOnly={readOnly}
          onAdd={() => addItem("planner")} onUpdate={updateItem} onRemove={removeItem} accent
          extraActions={!readOnly && (<>
            <Button variant="secondary" onClick={importPlannerTemplate}>Use template</Button>
            <Button variant="secondary" onClick={() => setImportOpen("planner")}>Import (paste)</Button>
          </>)} />
      </div>

      <div className="mt-5 grid md:grid-cols-3 gap-4 text-sm">
        <Tot label="Client BOM" value={clientTotal} />
        <Tot label="Planner additions" value={plannerTotal} />
        <Tot label="Combined material cost" value={clientTotal + plannerTotal} big />
      </div>

      {!readOnly && (
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={finalise} disabled={o.bom.length === 0}>Finalise BOM &amp; send to Costing</Button>
        </div>
      )}

      <ImportBomModal open={!!importOpen} source={importOpen ?? "client"} onClose={() => setImportOpen(null)} orderId={oid} />
    </Modal>
  );
}

function ImportBomModal({ open, source, onClose, orderId }: { open: boolean; source: "client" | "planner"; onClose: () => void; orderId: string }) {
  const [text, setText] = useState("");
  function importNow() {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items: BomItem[] = [];
    for (const ln of lines) {
      const parts = ln.split(/[\t,;]/).map(p => p.trim());
      if (parts.length < 2) continue;
      const [description, qtyStr, unitStr, rateStr] = parts;
      const qty = Number(qtyStr);
      if (!description || !Number.isFinite(qty) || qty <= 0) continue;
      const unit: "m" | "nos" = (unitStr?.toLowerCase() === "nos") ? "nos" : "m";
      const rate = Number(rateStr);
      items.push({ id: uid(), description, qty, unit, rate: Number.isFinite(rate) ? rate : 0, source });
    }
    if (items.length === 0) { toast("Nothing parsed — check format"); return; }
    setState(s => { const t = s.orders.find(x => x.id === orderId)!; t.bom.push(...items); return s; });
    logActivity("Planning", `Imported ${items.length} ${source} BOM lines`);
    toast(`${items.length} lines imported`);
    setText("");
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={`Import ${source === "client" ? "client" : "planner"} BOM`}>
      <p className="text-xs text-muted-foreground mb-3">
        Paste one line per item: <span className="font-mono">description, qty, unit (m|nos), rate</span>. Tabs, commas or semicolons all work — paste straight from Excel / drawing extract.
      </p>
      <Textarea value={text} onChange={e => setText(e.target.value)} placeholder={`PVC Insu HV 2.5sqmm Red, 45, m, 29.62\nRing Lug 2.5sqmm, 40, nos, 3.20`} className="min-h-[180px] font-mono text-xs" />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={importNow}>Import lines</Button>
      </div>
    </Modal>
  );
}

function BomSection({ title, subtitle, items, total, readOnly, onAdd, onUpdate, onRemove, accent, extraActions }: {
  title: string; subtitle: string; items: BomItem[]; total: number; readOnly: boolean;
  onAdd: () => void; onUpdate: (id: string, patch: Partial<BomItem>) => void; onRemove: (id: string) => void;
  accent?: boolean; extraActions?: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border ${accent ? "border-primary/30 bg-primary-soft/30" : "border-border"} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">{title} <span className="text-xs font-normal text-muted-foreground">· {items.length} {items.length === 1 ? "line" : "lines"}</span></h4>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          {!readOnly && <Button variant="secondary" onClick={onAdd}>+ Add line</Button>}
        </div>
      </div>
      <Table headers={["Description", "Qty", "Unit", "Rate (₹)", "Subtotal", "Note", ""]}>
        {items.length === 0 ? (
          <tr><td colSpan={7} className="px-4 py-6"><Empty title="No lines" hint={readOnly ? "" : "Click + Add line"} /></td></tr>
        ) : items.map(b => (
          <tr key={b.id}>
            <td className="px-4 py-2"><Input value={b.description} disabled={readOnly} onChange={e => onUpdate(b.id, { description: e.target.value })} /></td>
            <td className="px-4 py-2 w-24"><Input type="number" value={b.qty} disabled={readOnly} onChange={e => onUpdate(b.id, { qty: Number(e.target.value) })} /></td>
            <td className="px-4 py-2 w-24"><Select value={b.unit} disabled={readOnly} onChange={e => onUpdate(b.id, { unit: e.target.value as "m" | "nos" })}><option value="m">m</option><option value="nos">nos</option></Select></td>
            <td className="px-4 py-2 w-28"><Input type="number" value={b.rate ?? 0} disabled={readOnly} onChange={e => onUpdate(b.id, { rate: Number(e.target.value) })} /></td>
            <td className="px-4 py-2 num text-right">{fmtNum((b.qty || 0) * (b.rate || 0))}</td>
            <td className="px-4 py-2 w-40"><Input value={b.note ?? ""} disabled={readOnly} placeholder="—" onChange={e => onUpdate(b.id, { note: e.target.value })} /></td>
            <td className="px-4 py-2 text-right">{!readOnly && <button className="text-xs text-[var(--status-stuck)]" onClick={() => onRemove(b.id)}>Remove</button>}</td>
          </tr>
        ))}
      </Table>
      <div className="mt-2 text-right text-sm">Subtotal: <span className="num font-medium">{fmtINR(total)}</span></div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

function Tot({ label, value, big }: { label: string; value: number; big?: boolean }) {
  return (
    <div className={`rounded-md border border-border p-4 ${big ? "bg-primary-soft border-primary" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 num ${big ? "text-2xl font-display text-primary" : "text-base"}`}>{fmtINR(value)}</div>
    </div>
  );
}

// ===== Documents (schematics / layout boards / GA drawings) =====
const fmtBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const DOC_TONE: Record<DocKind, "active" | "amber" | "done" | "pending"> = {
  "Schematic": "active", "Layout board": "amber", "GA drawing": "done", "Datasheet": "pending", "Other": "pending",
};

function DocsSection({ order, readOnly }: { order: Order; readOnly: boolean }) {
  const docs = order.docs ?? [];
  const [kind, setKind] = useState<DocKind>("Schematic");
  const [rev, setRev] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function ingest(files: FileList | null) {
    if (!files || readOnly) return;
    Array.from(files).forEach(file => {
      if (file.size > MAX_DOC_BYTES) { toast(`${file.name} is over ${fmtBytes(MAX_DOC_BYTES)} — stored as a reference only`); }
      const finish = (dataUrl?: string) => {
        const doc: OrderDoc = { id: uid(), name: file.name, kind, size: file.size, mime: file.type || "application/octet-stream", dataUrl, rev: rev || undefined, uploadedAt: todayISO(), uploadedBy: "Planning" };
        addOrderDoc(order.id, doc);
        logActivity("Planning", `${kind} attached to ${order.woNo} — ${file.name}`);
      };
      if (file.size <= MAX_DOC_BYTES) {
        const reader = new FileReader();
        reader.onload = () => finish(reader.result as string);
        reader.onerror = () => finish(undefined);
        reader.readAsDataURL(file);
      } else { finish(undefined); }
    });
    setRev("");
    toast("Document attached");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mb-5 rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">Engineering documents <span className="text-xs font-normal text-muted-foreground">· {docs.length} {docs.length === 1 ? "file" : "files"}</span></h4>
          <p className="text-[11px] text-muted-foreground">Schematics, layout boards, GA drawings & datasheets for this work order.</p>
        </div>
      </div>

      {!readOnly && (
        <div className="mb-4 grid sm:grid-cols-[10rem_8rem_1fr] gap-2 items-end">
          <Field label="Document type">
            <Select value={kind} onChange={e => setKind(e.target.value as DocKind)}>
              {DOC_KINDS.map(k => <option key={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Revision" hint="">
            <Input value={rev} onChange={e => setRev(e.target.value)} placeholder="Rev A" />
          </Field>
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); ingest(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex h-[42px] cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed px-4 text-xs transition-colors ${drag ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4"><path d="M12 16V4m0 0L8 8m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Drop PDF/DWG/PNG here or click to browse
          </div>
          <input ref={inputRef} type="file" multiple accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.svg" className="hidden" onChange={e => ingest(e.target.files)} />
        </div>
      )}

      {docs.length === 0 ? (
        <Empty title="No documents yet" hint={readOnly ? "" : "Attach the client schematic and your layout board."} />
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid place-items-center h-9 w-9 shrink-0 rounded-md bg-muted text-muted-foreground">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="text-[11px] text-muted-foreground num">{fmtBytes(d.size)} · {fmtDate(d.uploadedAt)}{d.uploadedBy ? ` · ${d.uploadedBy}` : ""}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {d.rev && <span className="text-[11px] text-muted-foreground num">{d.rev}</span>}
                <Pill tone={DOC_TONE[d.kind]}>{d.kind}</Pill>
                {d.kind === "Layout board" && (
                  <a href="layout-3d.html" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View 3D</a>
                )}
                {d.dataUrl && <a href={d.dataUrl} download={d.name} className="text-xs text-primary hover:underline">Download</a>}
                {!readOnly && <button onClick={() => removeOrderDoc(order.id, d.id)} className="text-xs text-[var(--status-stuck)]">Remove</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ===== Projects view =====
export function Projects({ readOnly = false }: { readOnly?: boolean }) {
  const orders = useStore(s => s.orders);
  const [clientFilter, setClientFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState<"All" | "Active" | "Overdue" | "Stuck" | "Dispatched">("All");

  const clients = useMemo(() => ["All", ...Array.from(new Set(orders.map(o => o.client)))], [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (clientFilter !== "All" && o.client !== clientFilter) return false;
      if (stageFilter === "Active") return o.stage !== "Dispatch";
      if (stageFilter === "Overdue") return o.dueDate && new Date(o.dueDate) < new Date() && o.stage !== "Dispatch";
      if (stageFilter === "Stuck") return !!o.stuck;
      if (stageFilter === "Dispatched") return o.stage === "Dispatch";
      return true;
    });
  }, [orders, clientFilter, stageFilter]);

  const groups = useMemo(() => {
    const byClient = new Map<string, Order[]>();
    for (const o of filteredOrders) {
      const list = byClient.get(o.client) ?? [];
      list.push(o);
      byClient.set(o.client, list);
    }
    return Array.from(byClient.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredOrders]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Every work-order rolled up by client — see where each project stands at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="!w-auto min-w-[10rem]">
            {clients.map(c => <option key={c}>{c}</option>)}
          </Select>
          <Select value={stageFilter} onChange={e => setStageFilter(e.target.value as any)} className="!w-auto min-w-[10rem]">
            <option value="All">All stages</option>
            <option value="Active">Active only</option>
            <option value="Overdue">Overdue</option>
            <option value="Stuck">Stuck</option>
            <option value="Dispatched">Dispatched</option>
          </Select>
        </div>
      </div>

      {groups.length === 0 ? <Empty title="No projects match the filter" /> : (
        <div className="grid lg:grid-cols-2 gap-5">
          {groups.map(([client, list]) => {
            const active = list.filter(o => o.stage !== "Dispatch").length;
            const overdue = list.filter(o => o.dueDate && new Date(o.dueDate) < new Date() && o.stage !== "Dispatch").length;
            const stuck = list.filter(o => o.stuck).length;
            const totalQty = list.reduce((a, b) => a + b.qty, 0);
            const value = list.reduce((a, b) => a + (b.quote?.total ?? 0), 0);
            return (
              <Card key={client} title={client} action={<Pill tone={stuck ? "stuck" : overdue ? "amber" : "active"}>{list.length} W/Os</Pill>}>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <Mini label="Active" value={active} />
                  <Mini label="Overdue" value={overdue} tone={overdue ? "stuck" : undefined} />
                  <Mini label="Stuck" value={stuck} tone={stuck ? "stuck" : undefined} />
                  <Mini label="Total qty" value={totalQty} />
                </div>
                <div className="space-y-3">
                  {list.map(o => (
                    <div key={o.id} className="rounded-md border border-border p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="font-mono text-xs num">{o.woNo}</div>
                          <div className="text-[11px] text-muted-foreground">{o.project ?? "—"} · {o.product} · {o.config} · Qty {o.qty}</div>
                        </div>
                        {o.stuck ? <Pill tone="stuck">{o.stage}</Pill> : o.stage === "Dispatch" ? <Pill tone="done">{o.stage}</Pill> : <Pill tone="active">{o.stage}</Pill>}
                      </div>
                      <StageTracker stage={o.stage} stuck={!!o.stuck} />
                    </div>
                  ))}
                </div>
                {value > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">Quoted value (so far): <span className="num text-foreground">{fmtINR(value)}</span></div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: "stuck" }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-display num ${tone === "stuck" && value > 0 ? "text-[var(--status-stuck)]" : ""}`}>{value}</div>
    </div>
  );
}
