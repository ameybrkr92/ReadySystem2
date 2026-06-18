import { useState } from "react";
import { useStore, setState, logActivity, type Order } from "@/lib/erp-store";
import { Card, Pill, Button, Field, Input, Empty, Table, toast } from "./ui";
import { fmtDate, fmtINR, fmtNum, todayISO } from "@/lib/format";

export function Costing({ readOnly = false }: { readOnly?: boolean }) {
  const orders = useStore(s => s.orders);
  const queue = orders.filter(o => o.stage === "Costing" || o.stage === "Quote" || o.stage === "Final BOM");
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);
  const order = orders.find(o => o.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Costing</h1>
        <p className="text-sm text-muted-foreground">Price each finalised BOM (client + planner additions). Run scenarios, see per-unit price and margin, then send the quote.</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card title="Queue">
          {queue.length === 0 ? <Empty title="Nothing waiting" /> : (
            <ul className="space-y-1">
              {queue.map(o => (
                <li key={o.id}>
                  <button onClick={() => setSelectedId(o.id)}
                    className={`w-full text-left rounded-md p-3 border transition-colors ${selectedId === o.id ? "border-primary bg-primary-soft" : "border-border hover:bg-muted"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs num">{o.woNo}</span>
                      <Pill tone={o.stage === "Quote" ? "done" : "active"}>{o.stage}</Pill>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{o.client}</div>
                    {o.quote && <div className="text-[11px] text-muted-foreground mt-1 num">Quoted {fmtINR(o.quote.total)}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {order ? <CostingForm key={order.id} order={order} readOnly={readOnly} /> : <Card><Empty title="Pick an order" hint="Select one from the queue." /></Card>}
      </div>
    </div>
  );
}

function CostingForm({ order, readOnly }: { order: Order; readOnly: boolean }) {
  const [labour, setLabour] = useState(order.quote?.labour ?? 2500);
  const [wastagePct, setWastage] = useState(order.quote?.wastagePct ?? 3);
  const [marginPct, setMargin] = useState(order.quote?.marginPct ?? 18);
  const [overhead, setOverhead] = useState(0);
  const [freight, setFreight] = useState(0);
  const [validityDays, setValidity] = useState(15);
  const [deliveryWeeks, setDelivery] = useState(4);
  const [history, setHistory] = useState<{ rev: number; ts: string; total: number; marginPct: number }[]>(
    order.quote ? [{ rev: 1, ts: order.quote.createdAt, total: order.quote.total, marginPct: order.quote.marginPct }] : []
  );

  const clientSub = order.bom.filter(b => (b.source ?? "client") === "client").reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const plannerSub = order.bom.filter(b => b.source === "planner").reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const subtotal = clientSub + plannerSub;
  const wastage = subtotal * (wastagePct / 100);
  const baseCost = subtotal + wastage + labour + overhead + freight;
  const margin = baseCost * (marginPct / 100);
  const total = baseCost + margin;
  const perUnit = order.qty > 0 ? total / order.qty : 0;

  const scenarios = [10, 15, 18, 22, 25].map(m => ({ pct: m, total: baseCost * (1 + m / 100), per: order.qty > 0 ? (baseCost * (1 + m / 100)) / order.qty : 0 }));

  function send() {
    setState(s => {
      const o = s.orders.find(x => x.id === order.id)!;
      o.quote = { subtotal, labour, wastagePct, marginPct, total, createdAt: todayISO() };
      o.costingSentDate = todayISO();
      o.stage = "Quote";
      return s;
    });
    setHistory(h => [{ rev: h.length + 1, ts: todayISO(), total, marginPct }, ...h]);
    logActivity("Planning", `Quote sent — ${order.woNo} (${fmtINR(total)} · ${marginPct}% margin · valid ${validityDays}d · ETA ${deliveryWeeks}w)`);
    toast("Quote sent to client");
  }

  function saveRevision() {
    setHistory(h => [{ rev: h.length + 1, ts: todayISO(), total, marginPct }, ...h]);
    toast("Revision saved");
  }

  return (
    <div className="space-y-6">
      <Card title={`Order ${order.woNo}`} action={<span className="text-xs text-muted-foreground">{order.client} · {order.product} · {order.config}</span>}>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div><div className="text-xs text-muted-foreground">BOM lines</div><div className="num">{order.bom.length}</div></div>
          <div><div className="text-xs text-muted-foreground">Project</div><div>{order.project ?? "—"}</div></div>
          <div><div className="text-xs text-muted-foreground">BOM sent on</div><div className="num">{fmtDate(order.bomSentDate)}</div></div>
          <div><div className="text-xs text-muted-foreground">Qty</div><div className="num">{order.qty}</div></div>
        </div>
      </Card>

      <Card title="Material build-up">
        <Table headers={["Source", "Description", "Qty", "Unit", "Rate", "Subtotal"]}>
          {order.bom.map(b => (
            <tr key={b.id}>
              <td className="px-4 py-2"><Pill tone={b.source === "planner" ? "amber" : "active"}>{b.source === "planner" ? "Planner" : "Client"}</Pill></td>
              <td className="px-4 py-2">{b.description}</td>
              <td className="px-4 py-2 num">{fmtNum(b.qty)}</td>
              <td className="px-4 py-2">{b.unit}</td>
              <td className="px-4 py-2 num">{fmtINR(b.rate || 0)}</td>
              <td className="px-4 py-2 num text-right">{fmtINR((b.qty || 0) * (b.rate || 0))}</td>
            </tr>
          ))}
          <tr className="bg-muted/40">
            <td colSpan={5} className="px-4 py-2 text-right font-medium">Material subtotal (Client {fmtINR(clientSub)} + Planner {fmtINR(plannerSub)})</td>
            <td className="px-4 py-2 num text-right font-medium">{fmtINR(subtotal)}</td>
          </tr>
        </Table>
      </Card>

      <Card title="Quote build-up">
        <div className="grid md:grid-cols-4 gap-4">
          <Field label="Labour (₹)"><Input type="number" value={labour} disabled={readOnly} onChange={e => setLabour(Number(e.target.value))} /></Field>
          <Field label="Overhead (₹)"><Input type="number" value={overhead} disabled={readOnly} onChange={e => setOverhead(Number(e.target.value))} /></Field>
          <Field label="Freight / Packing (₹)"><Input type="number" value={freight} disabled={readOnly} onChange={e => setFreight(Number(e.target.value))} /></Field>
          <Field label="Wastage %"><Input type="number" value={wastagePct} disabled={readOnly} onChange={e => setWastage(Number(e.target.value))} /></Field>
          <Field label="Margin %"><Input type="number" value={marginPct} disabled={readOnly} onChange={e => setMargin(Number(e.target.value))} /></Field>
          <Field label="Validity (days)"><Input type="number" value={validityDays} disabled={readOnly} onChange={e => setValidity(Number(e.target.value))} /></Field>
          <Field label="Delivery (weeks)"><Input type="number" value={deliveryWeeks} disabled={readOnly} onChange={e => setDelivery(Number(e.target.value))} /></Field>
        </div>

        <div className="mt-6 grid md:grid-cols-5 gap-3 text-sm">
          <Tot label="Material" value={subtotal} />
          <Tot label={`Wastage (${wastagePct}%)`} value={wastage} />
          <Tot label="Labour + OH + Frt" value={labour + overhead + freight} />
          <Tot label={`Margin (${marginPct}%)`} value={margin} />
          <Tot label="Quote total" value={total} big />
        </div>
        <div className="mt-3 text-xs text-muted-foreground text-right">
          Per-unit price: <span className="num text-foreground font-medium">{fmtINR(perUnit)}</span> · Cost basis: <span className="num text-foreground">{fmtINR(baseCost)}</span>
        </div>

        {!readOnly && (
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={saveRevision} disabled={order.bom.length === 0}>Save revision</Button>
            <Button onClick={send} disabled={order.bom.length === 0}>Send quote to client</Button>
          </div>
        )}
      </Card>

      <Card title="Margin scenarios">
        <Table headers={["Margin %", "Quote total", "Per unit", ""]}>
          {scenarios.map(s => (
            <tr key={s.pct} className={s.pct === marginPct ? "bg-primary-soft/60" : ""}>
              <td className="px-4 py-2 num">{s.pct}%</td>
              <td className="px-4 py-2 num">{fmtINR(s.total)}</td>
              <td className="px-4 py-2 num">{fmtINR(s.per)}</td>
              <td className="px-4 py-2 text-right">{!readOnly && s.pct !== marginPct && <button className="text-xs text-primary" onClick={() => setMargin(s.pct)}>Apply</button>}</td>
            </tr>
          ))}
        </Table>
      </Card>

      {history.length > 0 && (
        <Card title="Revision history">
          <Table headers={["Rev", "When", "Margin %", "Total"]}>
            {history.map(h => (
              <tr key={h.rev}>
                <td className="px-4 py-2 num">R{h.rev}</td>
                <td className="px-4 py-2 num text-xs">{fmtDate(h.ts)}</td>
                <td className="px-4 py-2 num">{h.marginPct}%</td>
                <td className="px-4 py-2 num">{fmtINR(h.total)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
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
