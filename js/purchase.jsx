// Purchase — the PROCUREMENT DESK. A buyer's cockpit, not a per-job funnel.
// Organised around what a procurement engineer is accountable for:
//   • Buy plan  — replenish stock items to reorder level + buy-to-order project items
//   • Expediting — chase open POs to receipt, ETA vs the job's need-by date
//   • Quotes     — RFQ compare / award (multi-source, above threshold)
//   • Suppliers  — scorecard that informs who to award to
// Per-job buying still happens in the order workspace; cross-job + stock buying lives here.
const { useState: puUseState, useMemo: puUseMemo } = React;

function Kpi_pu({ label, value, tone, hint }) {
  const color = tone === "bad" ? "text-[var(--status-stuck)]" : tone === "warn" ? "text-[var(--amber)]" : tone === "good" ? "text-[var(--status-done)]" : "";
  return <div className="card-panel p-4"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className={`mt-1 text-2xl font-display num ${color}`}>{value}</div>{hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}</div>;
}

function Seg_pu({ value, onChange, options }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/50 p-0.5">
      {options.map(o => (
        <button key={o.key} onClick={() => onChange(o.key)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${value === o.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {o.label}{typeof o.badge === "number" && o.badge > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--amber)] px-1 text-[10px] font-semibold text-white">{o.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function RiskPill_pu({ risk }) {
  const { Pill } = window;
  const map = { overdue: ["stuck", "Overdue"], "at-risk": ["amber", "Late for job"], "due-soon": ["active", "Due soon"], "on-track": ["pending", "On track"] };
  const [tone, label] = map[risk] || ["pending", risk];
  return <Pill tone={tone}>{label}</Pill>;
}

function Purchase({ readOnly = false }) {
  const { useStore, getState, openOrder, replenishmentPlan, projectBuys, openPoBoard, raiseStockPo, setPoConfirmed, Card, Pill, Button, Select, Table, Empty, fmtINR, fmtNum, fmtDate } = window;
  useStore(s => s.orders); useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards); useStore(s => s.supplierRfqs); useStore(s => s.invoices);
  const s = getState();
  const [view, setView] = puUseState("plan");
  const [compareId, setCompareId] = puUseState(null);

  const repl = replenishmentPlan(s);
  const below = repl.filter(r => r.below && r.suggestQty > 0);
  const buys = projectBuys(s);
  const board = openPoBoard(s);
  const overdue = board.filter(b => b.overdue || b.lateForJob);
  const projectVal = buys.reduce((a, b) => a + b.value, 0);
  const replVal = below.reduce((a, r) => a + r.value, 0);
  const { invoiceMatch } = window;
  const invList = (s.invoices || []).map(inv => ({ inv, m: invoiceMatch(inv, s) }));
  const invAlerts = invList.filter(x => (!x.m.matched || x.m.msmeRisk === "overdue" || x.m.msmeRisk === "due-soon") && x.inv.payStatus !== "Paid").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Procurement desk</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">The buyer's cross-job view. Replenish stock consumables to their reorder level, buy made-to-order items against the job that needs them, and chase open POs to receipt. <b className="text-foreground">Per-job buying still lives in the order workspace</b> — this is everything that spans jobs.</p>
        </div>
        <Seg_pu value={view} onChange={setView} options={[
          { key: "plan", label: "Buy plan", badge: below.length + buys.length },
          { key: "expedite", label: "Expediting", badge: overdue.length },
          { key: "quotes", label: "Quotes" },
          { key: "invoices", label: "Invoices", badge: invAlerts },
          { key: "register", label: "PO register" },
          { key: "suppliers", label: "Suppliers" },
        ]} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi_pu label="Below reorder" value={below.length} tone={below.length ? "warn" : "good"} hint={below.length ? `${fmtINR(replVal)} to replenish` : "Stock healthy"} />
        <Kpi_pu label="Project buys" value={buys.length} tone={buys.length ? "warn" : "good"} hint={buys.length ? `${fmtINR(projectVal)} buy-to-order` : "None outstanding"} />
        <Kpi_pu label="Open POs" value={board.length} hint={`${fmtINR(board.reduce((a, b) => a + b.value, 0))} in transit`} />
        <Kpi_pu label="Overdue / at-risk" value={overdue.length} tone={overdue.length ? "bad" : "good"} hint={overdue.length ? "Needs expediting" : "All on track"} />
      </div>

      {view === "plan" && <BuyPlan_pu s={s} below={below} repl={repl} buys={buys} readOnly={readOnly} openOrder={openOrder} raiseStockPo={raiseStockPo} />}
      {view === "expedite" && <Expediting_pu board={board} readOnly={readOnly} openOrder={openOrder} setPoConfirmed={setPoConfirmed} orders={s.orders} />}
      {view === "quotes" && <Quotes_pu rfqs={s.supplierRfqs} onCompare={setCompareId} />}
      {view === "invoices" && <Invoices_pu s={s} readOnly={readOnly} />}
      {view === "register" && <Register_pu s={s} openOrder={openOrder} />}
      {view === "suppliers" && <Suppliers_pu s={s} />}

      {compareId && <CompareModal rfqId={compareId} onClose={() => setCompareId(null)} readOnly={readOnly} />}
    </div>
  );
}

// ---------- Buy plan: replenishment (stock) + project buys (per job) ----------
function BuyPlan_pu({ s, below, repl, buys, readOnly, openOrder, raiseStockPo }) {
  const { Card, Pill, Button, Table, Empty, fmtINR, fmtNum } = window;
  const healthy = repl.filter(r => !r.below);
  const bySupplier = {};
  below.forEach(r => { (bySupplier[r.supplier] = bySupplier[r.supplier] || []).push(r); });

  return (
    <div className="space-y-6">
      {/* Replenishment */}
      <Card title="Replenishment — stock below reorder level" action={<span className="text-xs text-muted-foreground">{healthy.length} of {repl.length} items healthy</span>}>
        {below.length === 0 ? <Empty title="All stock above reorder level" hint="No consumable needs topping up right now." /> : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Consumables are bought to a min/max, not per job. <span className="num">Projected</span> = on hand + on order − demand already committed to live jobs. Below the reorder point, top up to the max in one PO per supplier.</p>
            {Object.entries(bySupplier).map(([supplier, items]) => {
              const total = items.reduce((a, r) => a + r.value, 0);
              return (
                <div key={supplier} className="rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 border-b border-border">
                    <div className="text-sm font-medium">{supplier} <span className="text-muted-foreground font-normal">· {items.length} item{items.length > 1 ? "s" : ""}</span></div>
                    <div className="flex items-center gap-3">
                      <span className="num text-sm font-medium">{fmtINR(total)}</span>
                      {!readOnly && <Button onClick={() => raiseStockPo(supplier, items.map(r => ({ description: r.description, qty: r.suggestQty, unit: r.unit, rate: r.rate })))}>Raise replenishment PO</Button>}
                    </div>
                  </div>
                  <Table headers={["Material", "On hand", "Committed", "On order", "Projected", "Reorder pt", "Suggested buy", "Value"]}>
                    {items.map(r => (
                      <tr key={r.description}>
                        <td className="px-4 py-2.5">{r.description}{r.soleSource && <span className="ml-2 text-[10px] text-muted-foreground">sole-source</span>}</td>
                        <td className="px-4 py-2.5 num text-muted-foreground">{fmtNum(r.onHand)}</td>
                        <td className="px-4 py-2.5 num text-muted-foreground">{r.committed ? `−${fmtNum(r.committed)}` : "—"}</td>
                        <td className="px-4 py-2.5 num text-muted-foreground">{r.onOrder ? fmtNum(r.onOrder) : "—"}</td>
                        <td className="px-4 py-2.5 num font-medium text-[var(--amber)]">{fmtNum(r.projected)}</td>
                        <td className="px-4 py-2.5 num text-muted-foreground">{fmtNum(r.reorderPoint)}</td>
                        <td className="px-4 py-2.5 num font-medium">{fmtNum(r.suggestQty)} {r.unit}</td>
                        <td className="px-4 py-2.5 num">{fmtINR(r.value)}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Project buys */}
      <Card title="Project buys — made-to-order items by job" action={<span className="text-xs text-muted-foreground">Non-stocked items · open the job to buy</span>}>
        {buys.length === 0 ? <Empty title="No project buys outstanding" hint="No live job needs a non-stocked / made-to-order item." /> : (
          <div className="space-y-3">
            {buys.map(({ order, rows, dec, value }) => (
              <button key={order.id} onClick={() => openOrder(order.id, "procurement")} className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/30 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-mono text-sm num">{order.woNo} <span className="font-sans text-muted-foreground">· {order.client} · {order.config} · Qty {order.qty}</span></div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{dec.reason}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {dec.recommendRfq ? <Pill tone="amber">Get quotes · {fmtINR(value)}</Pill> : <Pill tone="active">Direct PO · {dec.preferred}</Pill>}
                    <span className="text-xs font-medium text-primary whitespace-nowrap">Open procurement →</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {rows.map(r => <span key={r.description} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-xs num">{r.description} <b className="text-[var(--amber)]">{fmtNum(r.toOrder)} {r.unit}</b></span>)}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Expediting: chase open POs to receipt ----------
function Expediting_pu({ board, readOnly, openOrder, setPoConfirmed, orders }) {
  const { Card, Pill, Button, Empty, fmtINR, fmtNum, fmtDate } = window;
  return (
    <Card title="Expediting — open purchase orders" action={<span className="text-xs text-muted-foreground">Overdue first · ETA from supplier lead time</span>}>
      {board.length === 0 ? <Empty title="No open POs" hint="Nothing is on order — raise POs from the buy plan." /> : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">PO</th>
                <th className="px-4 py-3 text-left font-medium">Supplier</th>
                <th className="px-4 py-3 text-left font-medium">For</th>
                <th className="px-4 py-3 text-left font-medium">Items</th>
                <th className="px-4 py-3 text-right font-medium">Value</th>
                <th className="px-4 py-3 text-left font-medium">ETA</th>
                <th className="px-4 py-3 text-left font-medium">Need-by</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Ack</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-white">
              {board.map(b => {
                const ord = b.isStock ? null : orders.find(o => o.woNo === b.woNo);
                return (
                  <tr key={b.po.id} className={b.overdue ? "bg-[color-mix(in_oklab,var(--status-stuck)_5%,transparent)]" : ""}>
                    <td className="px-4 py-3 font-mono text-xs num">{b.po.poNo}{b.po.status === "Partially Received" && <span className="ml-1.5 text-[10px] text-[var(--amber)]">partial</span>}</td>
                    <td className="px-4 py-3">{b.supplier}</td>
                    <td className="px-4 py-3 text-xs">{b.isStock ? <span className="text-muted-foreground">Stock top-up</span> : <button onClick={() => ord && openOrder(ord.id, "delivery")} className="font-mono num text-primary hover:underline">{b.woNo}</button>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">{b.po.items.map(i => `${i.description} (${fmtNum(i.qty)} ${i.unit})`).join(", ")}</td>
                    <td className="px-4 py-3 num text-right">{fmtINR(b.value)}</td>
                    <td className="px-4 py-3 num text-xs">{fmtDate(b.eta)}<div className={`text-[10px] ${b.overdue ? "text-[var(--status-stuck)]" : "text-muted-foreground"}`}>{b.overdue ? `${Math.abs(b.daysToEta)}d late` : `in ${b.daysToEta}d`}</div></td>
                    <td className="px-4 py-3 num text-xs text-muted-foreground">{b.needBy ? fmtDate(b.needBy) : "—"}</td>
                    <td className="px-4 py-3"><RiskPill_pu risk={b.risk} /></td>
                    <td className="px-4 py-3">
                      {b.confirmed ? <span className="inline-flex items-center gap-1 text-xs text-[var(--status-done)]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>Confirmed</span>
                        : readOnly ? <span className="text-xs text-muted-foreground">Unconfirmed</span>
                        : <button onClick={() => setPoConfirmed(b.po.id, true)} className="text-xs font-medium text-primary hover:underline">Mark confirmed</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Receipt stays automatic — a PO clears this board when Inventory logs its goods inward in Stores. "Confirmed" records that the supplier has acknowledged the order.</p>
    </Card>
  );
}

// ---------- Quotes: RFQ register ----------
function Quotes_pu({ rfqs, onCompare }) {
  const { Card, Pill, Table, Empty } = window;
  return (
    <Card title="Supplier quotes (RFQs)" action={<span className="text-xs text-muted-foreground">Floated per-job from the workspace · awarding raises the PO</span>}>
      {rfqs.length === 0 ? <Empty title="No open RFQs" hint="Quotes are floated from a job's Procurement tab when material is multi-source and above the quote threshold." /> : (
        <Table headers={["RFQ No", "W/O", "Items", "Bids in", "Status", ""]}>
          {rfqs.map(r => {
            const submitted = r.bids.filter(b => b.submitted).length;
            return (
              <tr key={r.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => onCompare(r.id)}>
                <td className="px-4 py-3 font-mono text-xs num">{r.rfqNo}</td>
                <td className="px-4 py-3 font-mono text-xs num">{r.woNo}</td>
                <td className="px-4 py-3 num text-xs">{r.items.length}</td>
                <td className="px-4 py-3 num text-xs">{submitted}/{r.bids.length}</td>
                <td className="px-4 py-3">{r.status === "Awarded" ? <Pill tone="done">Awarded · {r.awardedSupplier}</Pill> : <Pill tone="active">Open</Pill>}</td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">Compare →</td>
              </tr>
            );
          })}
        </Table>
      )}
    </Card>
  );
}

// ---------- Invoices: 3-way match + MSME payment clock (Procure-to-Pay) ----------
function Invoices_pu({ s, readOnly }) {
  const { invoiceMatch, setInvoicePay, MSME_DAYS, Card, Pill, Button, Empty, fmtINR, fmtDate } = window;
  const rows = (s.invoices || []).map(inv => ({ inv, m: invoiceMatch(inv, s) }));
  const matched = rows.filter(r => r.m.matched).length;
  const exceptions = rows.filter(r => !r.m.matched);
  const msmeOpen = rows.filter(r => r.inv.msme && r.inv.payStatus !== "Paid");
  const msmeAtRisk = msmeOpen.filter(r => r.m.msmeRisk !== "ok");
  const payableVal = rows.filter(r => r.m.matched && r.inv.payStatus !== "Paid").reduce((a, r) => a + r.inv.amount, 0);

  const matchPill = (m) => m.isDuplicate ? <Pill tone="stuck">Duplicate</Pill> : m.matched ? <Pill tone="done">3-way matched</Pill> : <Pill tone="amber">{m.issues.length} exception{m.issues.length > 1 ? "s" : ""}</Pill>;
  const payPill = (inv) => inv.payStatus === "Paid" ? <Pill tone="done">Paid</Pill> : inv.payStatus === "Approved" ? <Pill tone="active">Approved to pay</Pill> : inv.payStatus === "Hold" ? <Pill tone="stuck">On hold</Pill> : <Pill tone="pending">Unpaid</Pill>;
  const msmeBadge = (m) => m.msmeRisk === "overdue" ? <span className="text-[var(--status-stuck)] font-medium">MSME overdue · {Math.abs(m.daysLeft)}d</span> : m.msmeRisk === "due-soon" ? <span className="text-[var(--amber)] font-medium">MSME due in {m.daysLeft}d</span> : m.daysLeft != null ? <span className="text-muted-foreground">MSME {m.daysLeft}d left</span> : <span className="text-muted-foreground">—</span>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi_pu label="Invoices on file" value={rows.length} hint={`${matched} matched`} />
        <Kpi_pu label="Match exceptions" value={exceptions.length} tone={exceptions.length ? "warn" : "good"} hint="Price / qty / duplicate" />
        <Kpi_pu label="MSME at risk" value={msmeAtRisk.length} tone={msmeAtRisk.length ? "bad" : "good"} hint={`${MSME_DAYS}-day statutory clock`} />
        <Kpi_pu label="Approved & payable" value={fmtINR(payableVal)} hint="Cleared, awaiting payment" />
      </div>

      <Card title="Supplier invoices" action={<span className="text-xs text-muted-foreground">PO · GRN · Invoice — three-way match before pay</span>}>
        {rows.length === 0 ? <Empty title="No invoices" hint="Supplier invoices land here once received." /> : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice</th>
                  <th className="px-4 py-3 text-left font-medium">Supplier</th>
                  <th className="px-4 py-3 text-left font-medium">PO · GRN</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 text-left font-medium">Match</th>
                  <th className="px-4 py-3 text-left font-medium">MSME clock</th>
                  <th className="px-4 py-3 text-left font-medium">Payment</th>
                  {!readOnly && <th className="px-4 py-3 text-left font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map(({ inv, m }) => (
                  <tr key={inv.id} className={m.isDuplicate ? "bg-[color-mix(in_oklab,var(--status-stuck)_5%,transparent)]" : m.msmeRisk === "overdue" ? "bg-[color-mix(in_oklab,var(--amber)_6%,transparent)]" : ""}>
                    <td className="px-4 py-3"><div className="font-mono text-xs num">{inv.invNo}</div><div className="text-[10px] text-muted-foreground num">{fmtDate(inv.date)}{inv.msme && <span className="ml-1.5 rounded bg-primary-soft px-1 text-primary">MSME</span>}</div></td>
                    <td className="px-4 py-3 text-xs">{inv.supplier}</td>
                    <td className="px-4 py-3 font-mono text-[11px] num text-muted-foreground">{inv.poNo}<br />{inv.grnNo}</td>
                    <td className="px-4 py-3 num text-right">{fmtINR(inv.amount)}</td>
                    <td className="px-4 py-3">{matchPill(m)}{!m.matched && <div className="mt-1 space-y-0.5">{m.issues.map((iss, i) => <div key={i} className="text-[10px] text-muted-foreground">{iss.text}</div>)}</div>}</td>
                    <td className="px-4 py-3 text-[11px] num">{msmeBadge(m)}</td>
                    <td className="px-4 py-3">{payPill(inv)}</td>
                    {!readOnly && (
                      <td className="px-4 py-3">
                        {inv.payStatus === "Paid" ? <span className="text-[11px] text-muted-foreground">Paid {fmtDate(inv.paidDate)}</span>
                          : m.isDuplicate ? <button onClick={() => setInvoicePay(inv.id, "Hold")} className="text-xs font-medium text-[var(--status-stuck)] hover:underline">Reject duplicate</button>
                          : inv.payStatus === "Approved" ? <button onClick={() => setInvoicePay(inv.id, "Paid")} className="text-xs font-medium text-primary hover:underline">Mark paid</button>
                          : m.matched ? <button onClick={() => setInvoicePay(inv.id, "Approved")} className="text-xs font-medium text-primary hover:underline">Approve to pay</button>
                          : <span className="text-[11px] text-muted-foreground">Resolve exceptions</span>}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Match = invoice price vs PO rate + invoice qty vs GRN-accepted qty. Only matched invoices can be approved to pay. MSME suppliers carry a {MSME_DAYS}-day statutory payment clock (MSMED Act) from acceptance.</p>
      </Card>
    </div>
  );
}

// ---------- PO register: every PO, open + closed ----------
function Register_pu({ s, openOrder }) {
  const { Card, Pill, Table, Empty, fmtINR, fmtNum, fmtDate } = window;
  const [filter, setFilter] = puUseState("all");
  const pos = s.pos;
  const shown = pos.filter(p => filter === "all" ? true : filter === "open" ? p.status !== "Received" : p.status === "Received");
  const chip = (k, label) => <button key={k} onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs border transition-colors ${filter === k ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border text-muted-foreground hover:text-foreground"}`}>{label}</button>;

  return (
    <Card title="Purchase order register" action={<div className="flex items-center gap-1.5">{chip("all", `All ${pos.length}`)}{chip("open", "Open")}{chip("received", "Received")}</div>}>
      {shown.length === 0 ? <Empty title="No purchase orders" hint="Raise POs from the buy plan or a job's Procurement tab." /> : (
        <Table headers={["PO No", "Date", "Supplier", "For", "Items", "Value", "Status", "Receipt"]}>
          {shown.map(p => {
            const val = p.items.reduce((a, b) => a + b.qty * (b.rate || 0), 0);
            const ord = p.woNo && p.woNo !== "STOCK" ? s.orders.find(o => o.woNo === p.woNo) : null;
            return (
              <tr key={p.id} className={ord ? "hover:bg-muted/40 cursor-pointer" : ""} onClick={() => ord && openOrder(ord.id, "procurement")}>
                <td className="px-4 py-3 font-mono text-xs num">{p.poNo}</td>
                <td className="px-4 py-3 num text-xs text-muted-foreground">{fmtDate(p.createdAt)}</td>
                <td className="px-4 py-3">{p.supplier}</td>
                <td className="px-4 py-3 text-xs">{p.woNo === "STOCK" ? <span className="text-muted-foreground">Stock top-up</span> : <span className="font-mono num">{p.woNo}</span>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">{p.items.map(i => `${i.description} (${fmtNum(i.qty)} ${i.unit})`).join(", ")}</td>
                <td className="px-4 py-3 num">{fmtINR(val)}</td>
                <td className="px-4 py-3">{p.status === "Received" ? <Pill tone="done">Received</Pill> : p.status === "Partially Received" ? <Pill tone="amber">Partial</Pill> : <Pill tone="active">Ordered</Pill>}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.status === "Ordered" ? "Awaiting goods" : "via Stores inward"}</td>
              </tr>
            );
          })}
        </Table>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">Receipt is automatic — a PO updates to Partial / Received as Inventory logs goods inward against it in Stores.</p>
    </Card>
  );
}

// ---------- Suppliers: scorecard with reliability from Quality ----------
function RatingPill_pu({ rating }) {
  const { Pill } = window;
  const map = { Preferred: "done", Approved: "active", Watch: "stuck", "No data": "pending" };
  return <Pill tone={map[rating] || "pending"}>{rating}</Pill>;
}

function Suppliers_pu({ s }) {
  const { getState, supplierScorecard, Card, Pill, Empty, fmtINR } = window;
  const rates = s.materialRates || [];
  const score = supplierScorecard(getState());
  const cards = (s.suppliers || []).map(name => {
    const mats = rates.filter(r => r.preferredSupplier === name);
    const sole = mats.filter(r => r.soleSource);
    const openPos = s.pos.filter(p => p.supplier === name && p.status !== "Received");
    const allPos = s.pos.filter(p => p.supplier === name);
    const onOrder = openPos.reduce((a, p) => a + p.items.reduce((x, it) => x + it.qty * (it.rate || 0), 0), 0);
    const spend = allPos.reduce((a, p) => a + p.items.reduce((x, it) => x + it.qty * (it.rate || 0), 0), 0);
    const avgLead = mats.length ? Math.round(mats.reduce((a, r) => a + (r.leadDays || 0), 0) / mats.length) : null;
    const awards = s.supplierRfqs.filter(r => r.awardedSupplier === name).length;
    const sc = score[name] || { rating: "No data", rejPct: null, otdPct: null, lots: 0 };
    return { name, mats, sole, openPos: openPos.length, onOrder, spend, avgLead, awards, sc };
  }).sort((a, b) => (b.sc.score || 0) - (a.sc.score || 0) || b.spend - a.spend);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Reliability comes straight from the Quality module — incoming-QC rejections and on-time GRNs. <span className="text-foreground font-medium">Rating</span> blends on-time (60%) and quality (40%), so awards weigh dependability against price.</p>
      <div className="grid md:grid-cols-2 gap-4">
        {cards.map(c => (
          <Card key={c.name} title={c.name} action={<div className="flex items-center gap-2">{c.sole.length > 0 && <Pill tone="amber">{c.sole.length} sole-source</Pill>}<RatingPill_pu rating={c.sc.rating} /></div>}>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">On-time</div><div className={`num text-lg font-display ${c.sc.otdPct != null && c.sc.otdPct < 90 ? "text-[var(--amber)]" : ""}`}>{c.sc.otdPct != null ? `${c.sc.otdPct}%` : "—"}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Reject</div><div className={`num text-lg font-display ${c.sc.rejPct ? "text-[var(--status-stuck)]" : ""}`}>{c.sc.rejPct != null ? `${c.sc.rejPct}%` : "—"}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">On order</div><div className="num text-lg font-display">{fmtINR(c.onOrder)}</div></div>
              <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">Avg lead</div><div className="num text-lg font-display">{c.avgLead != null ? `${c.avgLead}d` : "—"}</div></div>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">{c.sc.lots ? `${c.sc.lots} inspected lot${c.sc.lots > 1 ? "s" : ""}` : "No inspected lots yet"}{c.awards > 0 ? ` · ${c.awards} RFQ award${c.awards > 1 ? "s" : ""}` : ""}</div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Supplies ({c.mats.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {c.mats.length === 0 ? <span className="text-xs text-muted-foreground">No catalogue items mapped.</span> : c.mats.map(m => (
                <span key={m.description} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${m.soleSource ? "border-[color-mix(in_oklab,var(--amber)_45%,transparent)] bg-[color-mix(in_oklab,var(--amber)_8%,transparent)]" : "border-border bg-muted/40"}`}>{m.description}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewRFQModal({ orderId, onClose }) {
  const { useStore, getState, procurementForOrder, Modal, Field, Select, Input, Button, setStoreState, logActivity, uid, toast, nowISO } = window;
  const suppliers = useStore(s => s.suppliers);
  const orders = useStore(s => s.orders);
  const rates = useStore(s => s.materialRates);
  const seedOrder = orderId ? orders.find(o => o.id === orderId) : null;
  const seedItems = seedOrder ? procurementForOrder(seedOrder, getState()).filter(r => r.toOrder > 0).map(r => ({ description: r.description, qty: r.toOrder, unit: r.unit })) : [{ description: rates[0].description, qty: 100, unit: rates[0].unit }];

  const [woNo, setWoNo] = puUseState(seedOrder ? seedOrder.woNo : (orders[0]?.woNo ?? ""));
  const [selected, setSelected] = puUseState(suppliers.slice(0, 3));
  const [items, setItems] = puUseState(seedItems.length ? seedItems : [{ description: rates[0].description, qty: 1, unit: rates[0].unit }]);

  const toggle = (x) => setSelected(p => p.includes(x) ? p.filter(y => y !== x) : [...p, x]);
  const upd = (i, patch) => { const n = [...items]; n[i] = { ...n[i], ...patch }; if (patch.description) { const r = rates.find(rt => rt.description === patch.description); if (r) n[i].unit = r.unit; } setItems(n); };

  function save() {
    if (selected.length < 2) { toast("Pick at least 2 suppliers"); return; }
    const rfqNo = `SRFQ-24-${String(Math.floor(Math.random() * 900) + 100)}`;
    setStoreState(st => { st.supplierRfqs.unshift({ id: uid(), rfqNo, woNo, createdAt: nowISO(), status: "Open", items: items.map(i => ({ ...i })), bids: selected.map(sup => ({ supplier: sup, rates: items.map(() => 0), submitted: false })) }); return st; });
    logActivity("Planning", `RFQ ${rfqNo} floated to ${selected.length} suppliers (${woNo})`);
    toast("RFQ floated"); onClose();
  }

  return (
    <Modal open={true} onClose={onClose} title="Float supplier RFQ" maxW="max-w-3xl">
      <Field label="Against W/O"><Select value={woNo} onChange={e => setWoNo(e.target.value)}>{orders.map(o => <option key={o.id} value={o.woNo}>{o.woNo} — {o.client}</option>)}</Select></Field>
      <div className="mt-4"><div className="text-xs font-medium text-muted-foreground mb-2">Send to (pick 2–3)</div>
        <div className="flex flex-wrap gap-2">{suppliers.map(x => <button key={x} type="button" onClick={() => toggle(x)} className={`rounded-full px-3 py-1.5 text-xs border ${selected.includes(x) ? "bg-primary text-primary-foreground border-primary" : "bg-white border-border"}`}>{selected.includes(x) ? "✓ " : ""}{x}</button>)}</div>
      </div>
      <div className="mt-5 flex items-center justify-between"><div className="text-sm font-medium">Items</div><Button variant="secondary" onClick={() => setItems([...items, { description: rates[0].description, qty: 1, unit: rates[0].unit }])}>+ Add</Button></div>
      <div className="mt-2 space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-7"><Field label="Description"><Select value={it.description} onChange={e => upd(i, { description: e.target.value })}>{rates.map(r => <option key={r.description}>{r.description}</option>)}</Select></Field></div>
            <div className="col-span-2"><Field label="Qty"><Input type="number" value={it.qty} onChange={e => upd(i, { qty: Number(e.target.value) })} /></Field></div>
            <div className="col-span-2"><Field label="Unit"><Select value={it.unit} onChange={e => upd(i, { unit: e.target.value })}><option value="m">m</option><option value="nos">nos</option></Select></Field></div>
            <div className="col-span-1 pb-2 text-right"><button onClick={() => setItems(items.filter((_, x) => x !== i))} className="text-xs text-[var(--status-stuck)]">✕</button></div>
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Float RFQ</Button></div>
    </Modal>
  );
}

function CompareModal({ rfqId, onClose, readOnly }) {
  const { useStore, getState, supplierScorecard, Modal, Button, Input, Pill, setStoreState, logActivity, uid, toast, fmtINR, fmtNum, nowISO } = window;
  const rfq = useStore(s => s.supplierRfqs.find(r => r.id === rfqId));
  const [bids, setBids] = puUseState(() => rfq ? rfq.bids.map(b => ({ ...b, rates: [...b.rates] })) : []);
  if (!rfq) return null;
  const score = supplierScorecard(getState());

  const setRate = (bi, ii, v) => { const n = bids.map(b => ({ ...b, rates: [...b.rates] })); n[bi].rates[ii] = v; n[bi].submitted = true; setBids(n); };
  const setMeta = (bi, patch) => { const n = bids.map(b => ({ ...b, rates: [...b.rates] })); n[bi] = { ...n[bi], ...patch }; setBids(n); };
  const totals = bids.map(b => rfq.items.reduce((a, it, i) => a + it.qty * (b.rates[i] || 0), 0));
  const subT = totals.map((t, i) => bids[i].submitted ? t : Infinity);
  const lowest = subT.indexOf(Math.min(...subT));
  // best reliability among SUBMITTED bidders
  let bestRated = -1, bestScore = -1;
  bids.forEach((b, i) => { const sc = score[b.supplier]; if (b.submitted && sc && sc.score != null && sc.score > bestScore) { bestScore = sc.score; bestRated = i; } });
  const ratingTone = { Preferred: "done", Approved: "active", Watch: "stuck", "No data": "pending" };
  const splitPick = lowest >= 0 && bestRated >= 0 && lowest !== bestRated;

  function save() { setStoreState(s => { const r = s.supplierRfqs.find(x => x.id === rfq.id); r.bids = bids; return s; }); toast("Bids saved"); }
  function award(bi) {
    const b = bids[bi]; const poNo = "PO-" + (2400 + Math.floor(Math.random() * 600));
    setStoreState(s => {
      const r = s.supplierRfqs.find(x => x.id === rfq.id); r.bids = bids; r.status = "Awarded"; r.awardedSupplier = b.supplier;
      s.pos.unshift({ id: uid(), poNo, supplier: b.supplier, woNo: rfq.woNo, status: "Ordered", createdAt: nowISO(), items: rfq.items.map((it, i) => ({ description: it.description, qty: it.qty, unit: it.unit, rate: b.rates[i] || 0 })) });
      const o = s.orders.find(x => x.woNo === rfq.woNo); if (o && o.stage === "Approved") o.stage = "PO";
      return s;
    });
    logActivity("Planning", `Awarded ${rfq.rfqNo} to ${b.supplier} → ${poNo}`); toast(`Awarded to ${b.supplier}`); onClose();
  }

  return (
    <Modal open={true} onClose={onClose} title={`Compare bids — ${rfq.rfqNo} · ${rfq.woNo}`} maxW="max-w-5xl">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-wider text-muted-foreground"><tr>
            <th className="px-3 py-3 text-left font-medium">Item</th><th className="px-3 py-3 text-right font-medium">Qty</th>
            {bids.map((b, i) => <th key={b.supplier} className={`px-3 py-3 text-right font-medium ${i === lowest && b.submitted ? "text-[var(--status-done)]" : ""}`}>{b.supplier}{i === lowest && b.submitted ? " · L1" : ""}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-border bg-white">
            {rfq.items.map((it, idx) => (
              <tr key={idx}><td className="px-3 py-2">{it.description}</td><td className="px-3 py-2 num text-right">{fmtNum(it.qty)} {it.unit}</td>
                {bids.map((b, bi) => <td key={b.supplier} className="px-3 py-2"><Input type="number" value={b.rates[idx] || 0} disabled={readOnly || rfq.status === "Awarded"} onChange={e => setRate(bi, idx, Number(e.target.value))} className="text-right" /></td>)}
              </tr>
            ))}
            <tr className="bg-muted/40 font-medium"><td className="px-3 py-2 text-right" colSpan={2}>Total</td>
              {bids.map((b, bi) => <td key={b.supplier} className={`px-3 py-2 num text-right ${bi === lowest && b.submitted ? "text-[var(--status-done)]" : ""}`}>{b.submitted ? fmtINR(totals[bi]) : "—"}</td>)}
            </tr>
            <tr><td className="px-3 py-2 text-xs text-muted-foreground" colSpan={2}>Lead time (days)</td>
              {bids.map((b, bi) => <td key={b.supplier} className="px-3 py-2"><Input type="number" value={b.leadTimeDays ?? 0} disabled={readOnly || rfq.status === "Awarded"} onChange={e => setMeta(bi, { leadTimeDays: Number(e.target.value) })} className="text-right" /></td>)}
            </tr>
            <tr><td className="px-3 py-2 text-xs text-muted-foreground align-top" colSpan={2}>Reliability<div className="text-[10px] normal-case">from Quality records</div></td>
              {bids.map((b) => { const sc = score[b.supplier] || { rating: "No data" }; return (
                <td key={b.supplier} className="px-3 py-2 text-right">
                  <Pill tone={ratingTone[sc.rating] || "pending"}>{sc.rating}</Pill>
                  <div className="mt-1 text-[10px] text-muted-foreground num">{sc.otdPct != null ? `${sc.otdPct}% OTD` : "—"}{sc.rejPct != null ? ` · ${sc.rejPct}% rej` : ""}</div>
                </td>
              ); })}
            </tr>
            {!readOnly && rfq.status !== "Awarded" && (
              <tr><td className="px-3 py-2" colSpan={2}></td>
                {bids.map((b, bi) => <td key={b.supplier} className="px-3 py-2 text-right"><Button variant={bi === lowest ? "primary" : "secondary"} onClick={() => award(bi)} disabled={!b.submitted}>Award</Button></td>)}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {splitPick && rfq.status !== "Awarded" && (
        <div className="mt-3 rounded-md border border-[color-mix(in_oklab,var(--amber)_40%,transparent)] bg-[color-mix(in_oklab,var(--amber)_7%,transparent)] px-3 py-2 text-xs text-foreground">
          <b>L1 isn't the best-rated.</b> {bids[lowest].supplier} is cheapest, but {bids[bestRated].supplier} rates higher on quality &amp; on-time delivery ({score[bids[bestRated].supplier].rating}). Weigh the saving against the reliability risk before awarding.
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">{!readOnly && rfq.status !== "Awarded" && <Button variant="secondary" onClick={save}>Save bids</Button>}<Button variant="secondary" onClick={onClose}>Close</Button></div>
    </Modal>
  );
}

Object.assign(window, { Purchase, NewRFQModal, CompareModal });
