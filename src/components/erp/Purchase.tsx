import { useMemo, useState } from "react";
import { useStore, setState, logActivity, uid, type PO, type SupplierRFQ } from "@/lib/erp-store";
import { Card, Pill, Button, Field, Input, Select, Modal, Table, Empty, toast } from "./ui";
import { fmtDate, fmtINR, fmtNum, todayISO } from "@/lib/format";

export function Purchase({ readOnly = false }: { readOnly?: boolean }) {
  const [tab, setTab] = useState<"po" | "rfq">("po");
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase</h1>
          <p className="text-sm text-muted-foreground">Float supplier RFQs, compare bids, award and convert to a PO. Stock arrival goes to Inventory for QC.</p>
        </div>
        <div className="inline-flex rounded-md border border-border bg-muted p-0.5 text-xs">
          <button onClick={() => setTab("rfq")} className={`px-3 py-1.5 rounded ${tab === "rfq" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Supplier RFQs</button>
          <button onClick={() => setTab("po")} className={`px-3 py-1.5 rounded ${tab === "po" ? "bg-white shadow-sm" : "text-muted-foreground"}`}>Purchase orders</button>
        </div>
      </div>
      {tab === "po" ? <POList readOnly={readOnly} /> : <RFQList readOnly={readOnly} />}
    </div>
  );
}

function POList({ readOnly }: { readOnly: boolean }) {
  const pos = useStore(s => s.pos);
  const [show, setShow] = useState(false);

  function markReceived(po: PO) {
    setState(s => {
      const p = s.pos.find(x => x.id === po.id)!;
      p.status = "Received";
      for (const it of po.items) {
        s.inwards.unshift({
          id: uid(), date: todayISO(), grnNo: `GRN-${1000 + Math.floor(Math.random() * 9000)}`,
          poNo: po.poNo, lotNo: `L-${Math.floor(Math.random() * 9999)}`, lrNo: `LR-${Math.floor(Math.random() * 9999)}`,
          partyName: po.supplier, itemDescription: it.description, challanNo: `CH/${Math.floor(Math.random() * 9999)}`,
          qty: it.qty, unit: it.unit, rate: it.rate, qcStatus: "Pending", woNo: po.woNo,
          coils: it.unit === "m" ? Math.max(1, Math.round(it.qty / 200)) : undefined,
        });
      }
      // Only advance stage when ALL POs for this W/O are received
      const allPos = s.pos.filter(x => x.woNo === po.woNo);
      const allReceived = allPos.every(x => x.status === "Received");
      const o = s.orders.find(x => x.woNo === po.woNo);
      if (o && o.stage === "PO" && allReceived) o.stage = "Purchase Received";
      return s;
    });
    logActivity("Planning", `${po.poNo} received from ${po.supplier} (${po.woNo})`);
    toast("Marked as received");
  }

  return (
    <>
      <div className="flex justify-end">{!readOnly && <Button onClick={() => setShow(true)}>+ Raise PO</Button>}</div>
      <Card>
        {pos.length === 0 ? <Empty title="No purchase orders yet" /> : (
          <Table headers={["PO No", "Supplier", "W/O", "Items", "Value", "Status", "Created", ""]}>
            {pos.map(p => {
              const val = p.items.reduce((a, b) => a + b.qty * b.rate, 0);
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-mono text-xs num">{p.poNo}</td>
                  <td className="px-4 py-3">{p.supplier}</td>
                  <td className="px-4 py-3 font-mono text-xs num">{p.woNo}</td>
                  <td className="px-4 py-3 text-xs">{p.items.map(i => `${i.description} (${fmtNum(i.qty)} ${i.unit})`).join(", ")}</td>
                  <td className="px-4 py-3 num">{fmtINR(val)}</td>
                  <td className="px-4 py-3">{p.status === "Received" ? <Pill tone="done">Received</Pill> : p.status === "Partially Received" ? <Pill tone="amber">{p.status}</Pill> : <Pill tone="active">Ordered</Pill>}</td>
                  <td className="px-4 py-3 num text-xs">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3 text-right">{!readOnly && p.status !== "Received" && <Button variant="secondary" onClick={() => markReceived(p)}>Mark received</Button>}</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <NewPOModal open={show} onClose={() => setShow(false)} />
    </>
  );
}

function NewPOModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suppliers = useStore(s => s.suppliers);
  const orders = useStore(s => s.orders);
  const rates = useStore(s => s.materialRates);
  const [supplier, setSupplier] = useState(suppliers[0]);
  const [woNo, setWoNo] = useState(orders[0]?.woNo ?? "");
  const [items, setItems] = useState<{ description: string; qty: number; unit: "m" | "nos"; rate: number }[]>([
    { description: rates[0].description, qty: 100, unit: rates[0].unit, rate: rates[0].rate },
  ]);

  function add() { setItems([...items, { description: rates[0].description, qty: 1, unit: "m", rate: rates[0].rate }]); }
  function rem(i: number) { setItems(items.filter((_, x) => x !== i)); }
  function upd(i: number, patch: Partial<typeof items[number]>) {
    const next = [...items]; next[i] = { ...next[i], ...patch };
    if (patch.description) {
      const r = rates.find(rt => rt.description === patch.description);
      if (r) { next[i].rate = r.rate; next[i].unit = r.unit; }
    }
    setItems(next);
  }

  function save() {
    if (!woNo || items.length === 0) { toast("Add an item and pick a W/O"); return; }
    const poNo = `PO-${2400 + Math.floor(Math.random() * 600)}`;
    setState(s => {
      s.pos.unshift({ id: uid(), poNo, supplier, woNo, items, status: "Ordered", createdAt: todayISO() });
      const o = s.orders.find(x => x.woNo === woNo);
      if (o && (o.stage === "Quote" || o.stage === "Costing")) o.stage = "PO";
      return s;
    });
    logActivity("Planning", `${poNo} raised to ${supplier} for ${woNo}`);
    toast("PO raised");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise PO" maxW="max-w-3xl">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Supplier"><Select value={supplier} onChange={e => setSupplier(e.target.value)}>{suppliers.map(x => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Against W/O"><Select value={woNo} onChange={e => setWoNo(e.target.value)}>{orders.map(o => <option key={o.id} value={o.woNo}>{o.woNo} — {o.client}</option>)}</Select></Field>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm font-medium">Items</div>
        <Button variant="secondary" onClick={add}>+ Add item</Button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-5"><Field label="Description"><Select value={it.description} onChange={e => upd(i, { description: e.target.value })}>{rates.map(r => <option key={r.description}>{r.description}</option>)}</Select></Field></div>
            <div className="col-span-2"><Field label="Qty"><Input type="number" value={it.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></Field></div>
            <div className="col-span-2"><Field label="Unit"><Select value={it.unit} onChange={e => upd(i, { unit: e.target.value as "m" | "nos" })}><option value="m">m</option><option value="nos">nos</option></Select></Field></div>
            <div className="col-span-2"><Field label="Rate"><Input type="number" value={it.rate} onChange={e => upd(i, { rate: Number(e.target.value) })} /></Field></div>
            <div className="col-span-1 pb-2 text-right"><button onClick={() => rem(i)} className="text-xs text-[var(--status-stuck)]">✕</button></div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-muted-foreground">Total: <span className="num text-foreground">{fmtINR(items.reduce((a, b) => a + b.qty * b.rate, 0))}</span></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Raise PO</Button>
        </div>
      </div>
    </Modal>
  );
}

// =================== Supplier RFQ + comparison ===================

function RFQList({ readOnly }: { readOnly: boolean }) {
  const rfqs = useStore(s => s.supplierRfqs);
  const [show, setShow] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rfqs.find(r => r.id === openId) ?? null;

  return (
    <>
      <div className="flex justify-end">{!readOnly && <Button onClick={() => setShow(true)}>+ New supplier RFQ</Button>}</div>
      <Card>
        {rfqs.length === 0 ? <Empty title="No supplier RFQs yet" hint="Float an RFQ to 2-3 suppliers, then compare bids." /> : (
          <Table headers={["RFQ No", "W/O", "Items", "Suppliers", "Bids in", "Status", "Created", ""]}>
            {rfqs.map(r => {
              const submitted = r.bids.filter(b => b.submitted).length;
              return (
                <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setOpenId(r.id)}>
                  <td className="px-4 py-3 font-mono text-xs num">{r.rfqNo}</td>
                  <td className="px-4 py-3 font-mono text-xs num">{r.woNo}</td>
                  <td className="px-4 py-3 num text-xs">{r.items.length}</td>
                  <td className="px-4 py-3 text-xs">{r.bids.map(b => b.supplier).join(", ")}</td>
                  <td className="px-4 py-3 num text-xs">{submitted}/{r.bids.length}</td>
                  <td className="px-4 py-3">{r.status === "Awarded" ? <Pill tone="done">Awarded · {r.awardedSupplier}</Pill> : <Pill tone="active">Open</Pill>}</td>
                  <td className="px-4 py-3 num text-xs">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">Compare →</td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <NewRFQModal open={show} onClose={() => setShow(false)} />
      {open && <CompareModal rfq={open} onClose={() => setOpenId(null)} readOnly={readOnly} />}
    </>
  );
}

function NewRFQModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const suppliers = useStore(s => s.suppliers);
  const orders = useStore(s => s.orders);
  const rates = useStore(s => s.materialRates);
  const [woNo, setWoNo] = useState(orders[0]?.woNo ?? "");
  const [selected, setSelected] = useState<string[]>(suppliers.slice(0, 3));
  const [items, setItems] = useState<{ description: string; qty: number; unit: "m" | "nos" }[]>([
    { description: rates[0].description, qty: 100, unit: rates[0].unit },
  ]);

  function toggleSupplier(s: string) {
    setSelected(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function addItem() { setItems([...items, { description: rates[0].description, qty: 1, unit: rates[0].unit }]); }
  function rem(i: number) { setItems(items.filter((_, x) => x !== i)); }
  function upd(i: number, patch: Partial<typeof items[number]>) {
    const next = [...items]; next[i] = { ...next[i], ...patch };
    if (patch.description) {
      const r = rates.find(rt => rt.description === patch.description);
      if (r) next[i].unit = r.unit;
    }
    setItems(next);
  }

  function save() {
    if (selected.length < 2) { toast("Pick at least 2 suppliers"); return; }
    if (items.length === 0) { toast("Add at least 1 item"); return; }
    const rfqNo = `SRFQ-24-${String(Math.floor(Math.random() * 900) + 100)}`;
    setState(s => {
      s.supplierRfqs.unshift({
        id: uid(), rfqNo, woNo, createdAt: todayISO(), status: "Open",
        items: items.map(i => ({ ...i })),
        bids: selected.map(sup => ({ supplier: sup, rates: items.map(() => 0), submitted: false })),
      });
      return s;
    });
    logActivity("Planning", `Supplier RFQ ${rfqNo} floated to ${selected.length} suppliers (${woNo})`);
    toast("Supplier RFQ floated");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Float supplier RFQ" maxW="max-w-3xl">
      <Field label="Against W/O"><Select value={woNo} onChange={e => setWoNo(e.target.value)}>{orders.map(o => <option key={o.id} value={o.woNo}>{o.woNo} — {o.client}</option>)}</Select></Field>

      <div className="mt-5">
        <div className="text-xs font-medium text-muted-foreground mb-2">Send RFQ to (multi-select)</div>
        <div className="flex flex-wrap gap-2">
          {suppliers.map(s => (
            <button key={s} type="button" onClick={() => toggleSupplier(s)}
              className={`rounded-full px-3 py-1.5 text-xs border ${selected.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-foreground"}`}>
              {selected.includes(s) ? "✓ " : ""}{s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="text-sm font-medium">Items</div>
        <Button variant="secondary" onClick={addItem}>+ Add item</Button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-7"><Field label="Description"><Select value={it.description} onChange={e => upd(i, { description: e.target.value })}>{rates.map(r => <option key={r.description}>{r.description}</option>)}</Select></Field></div>
            <div className="col-span-2"><Field label="Qty"><Input type="number" value={it.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></Field></div>
            <div className="col-span-2"><Field label="Unit"><Select value={it.unit} onChange={e => upd(i, { unit: e.target.value as "m" | "nos" })}><option value="m">m</option><option value="nos">nos</option></Select></Field></div>
            <div className="col-span-1 pb-2 text-right"><button onClick={() => rem(i)} className="text-xs text-[var(--status-stuck)]">✕</button></div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Float RFQ</Button>
      </div>
    </Modal>
  );
}

function CompareModal({ rfq, onClose, readOnly }: { rfq: SupplierRFQ; onClose: () => void; readOnly: boolean }) {
  // editable working copy of bids
  const [bids, setBids] = useState(() => rfq.bids.map(b => ({ ...b, rates: [...b.rates] })));

  function setRate(bidIdx: number, itemIdx: number, v: number) {
    const next = bids.map(b => ({ ...b, rates: [...b.rates] }));
    next[bidIdx].rates[itemIdx] = v;
    next[bidIdx].submitted = true;
    setBids(next);
  }
  function setMeta(bidIdx: number, patch: Partial<(typeof bids)[number]>) {
    const next = bids.map(b => ({ ...b, rates: [...b.rates] }));
    next[bidIdx] = { ...next[bidIdx], ...patch };
    setBids(next);
  }

  function saveBids() {
    setState(s => { const r = s.supplierRfqs.find(x => x.id === rfq.id)!; r.bids = bids; return s; });
    toast("Bids saved");
  }

  function award(bidIdx: number) {
    const b = bids[bidIdx];
    const total = rfq.items.reduce((a, it, i) => a + it.qty * (b.rates[i] || 0), 0);
    const poNo = `PO-${2400 + Math.floor(Math.random() * 600)}`;
    setState(s => {
      const r = s.supplierRfqs.find(x => x.id === rfq.id)!;
      r.bids = bids;
      r.status = "Awarded";
      r.awardedSupplier = b.supplier;
      s.pos.unshift({
        id: uid(), poNo, supplier: b.supplier, woNo: rfq.woNo, status: "Ordered", createdAt: todayISO(),
        items: rfq.items.map((it, i) => ({ description: it.description, qty: it.qty, unit: it.unit, rate: b.rates[i] || 0 })),
      });
      const o = s.orders.find(x => x.woNo === rfq.woNo);
      if (o && (o.stage === "Quote" || o.stage === "Costing")) o.stage = "PO";
      return s;
    });
    logActivity("Planning", `Awarded ${rfq.rfqNo} to ${b.supplier} → ${poNo} (${fmtINR(total)})`);
    toast(`Awarded to ${b.supplier} · PO raised`);
    onClose();
  }

  const totals = bids.map(b => rfq.items.reduce((a, it, i) => a + it.qty * (b.rates[i] || 0), 0));
  const submittedTotals = totals.map((t, i) => bids[i].submitted ? t : Infinity);
  const lowestIdx = submittedTotals.indexOf(Math.min(...submittedTotals));

  return (
    <Modal open={true} onClose={onClose} title={`Compare bids — ${rfq.rfqNo} · ${rfq.woNo}`} maxW="max-w-5xl">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 text-left font-medium">Item</th>
              <th className="px-3 py-3 text-right font-medium">Qty</th>
              {bids.map((b, i) => (
                <th key={b.supplier} className={`px-3 py-3 text-right font-medium ${i === lowestIdx && b.submitted ? "bg-[color-mix(in_oklab,var(--status-done)_12%,transparent)] text-[var(--status-done)]" : ""}`}>
                  {b.supplier}{i === lowestIdx && b.submitted && " · L1"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {rfq.items.map((it, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2">{it.description}</td>
                <td className="px-3 py-2 num text-right">{fmtNum(it.qty)} {it.unit}</td>
                {bids.map((b, bi) => (
                  <td key={b.supplier} className="px-3 py-2">
                    <Input type="number" value={b.rates[idx] || 0} disabled={readOnly || rfq.status === "Awarded"}
                      onChange={e => setRate(bi, idx, Number(e.target.value))} className="text-right" />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-muted/40 font-medium">
              <td className="px-3 py-2 text-right" colSpan={2}>Total</td>
              {bids.map((b, bi) => (
                <td key={b.supplier} className={`px-3 py-2 num text-right ${bi === lowestIdx && b.submitted ? "text-[var(--status-done)]" : ""}`}>
                  {b.submitted ? fmtINR(totals[bi]) : <span className="text-muted-foreground">—</span>}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>Lead time (days)</td>
              {bids.map((b, bi) => (
                <td key={b.supplier} className="px-3 py-2">
                  <Input type="number" value={b.leadTimeDays ?? 0} disabled={readOnly || rfq.status === "Awarded"} onChange={e => setMeta(bi, { leadTimeDays: Number(e.target.value) })} className="text-right" />
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>Validity (days)</td>
              {bids.map((b, bi) => (
                <td key={b.supplier} className="px-3 py-2">
                  <Input type="number" value={b.validityDays ?? 0} disabled={readOnly || rfq.status === "Awarded"} onChange={e => setMeta(bi, { validityDays: Number(e.target.value) })} className="text-right" />
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>Notes</td>
              {bids.map((b, bi) => (
                <td key={b.supplier} className="px-3 py-2">
                  <Input value={b.notes ?? ""} disabled={readOnly || rfq.status === "Awarded"} onChange={e => setMeta(bi, { notes: e.target.value })} />
                </td>
              ))}
            </tr>
            {!readOnly && rfq.status !== "Awarded" && (
              <tr>
                <td className="px-3 py-2" colSpan={2}></td>
                {bids.map((b, bi) => (
                  <td key={b.supplier} className="px-3 py-2 text-right">
                    <Button variant={bi === lowestIdx ? "primary" : "secondary"} onClick={() => award(bi)} disabled={!b.submitted}>Award &amp; raise PO</Button>
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {!readOnly && rfq.status !== "Awarded" && <Button variant="secondary" onClick={saveBids}>Save bids</Button>}
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
