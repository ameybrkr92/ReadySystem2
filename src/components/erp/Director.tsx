import { useEffect, useMemo, useState } from "react";
import { useStore, STAGES } from "@/lib/erp-store";
import { Card, Pill, StageTracker, Empty } from "./ui";
import { fmtDateTime, fmtINR } from "@/lib/format";

export function Director() {
  const orders = useStore(s => s.orders);
  const activity = useStore(s => s.activity);
  const pos = useStore(s => s.pos);
  const stock = useStore(s => s.stock);
  const rates = useStore(s => s.materialRates);
  const qcRecords = useStore(s => s.qcRecords);

  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(x => x + 1), 5000); return () => clearInterval(t); }, []);

  const now = Date.now();

  const metrics = useMemo(() => {
    const dispatched = orders.filter(o => o.stage === "Dispatch");
    const onTime = dispatched.filter(o => o.dispatchedDate && o.dueDate && new Date(o.dispatchedDate) <= new Date(o.dueDate)).length;
    const onTimePct = dispatched.length ? Math.round((onTime / dispatched.length) * 100) : 100;
    const overdue = orders.filter(o => o.stage !== "Dispatch" && o.dueDate && new Date(o.dueDate).getTime() < now).length;
    const stuck = orders.filter(o => o.stuck);
    const avgStuckAge = stuck.length === 0 ? 0 : Math.round(stuck.reduce((a, o) => {
      // approximate using PO date as anchor
      const t = o.poDate ? (now - new Date(o.poDate).getTime()) / 86400000 : 0;
      return a + t;
    }, 0) / stuck.length);

    // cycle time per stage based on completed orders' PO -> dispatch
    const avgCycleDays = dispatched.length === 0 ? 0 : Math.round(dispatched.reduce((a, o) => {
      if (!o.poDate || !o.dispatchedDate) return a;
      return a + (new Date(o.dispatchedDate).getTime() - new Date(o.poDate).getTime()) / 86400000;
    }, 0) / Math.max(1, dispatched.length));

    const qcPass = qcRecords.filter(r => r.disposition === "Accept" || r.disposition === "Pass").length;
    const qcPassPct = qcRecords.length ? Math.round((qcPass / qcRecords.length) * 100) : 100;

    const inventoryValue = stock.reduce((a, r) => a + r.onHand * (rates.find(x => x.description === r.description)?.rate ?? 0), 0);
    const openPOValue = pos.filter(p => p.status !== "Received").reduce((a, p) => a + p.items.reduce((aa, b) => aa + b.qty * b.rate, 0), 0);
    const pipelineValue = orders.filter(o => o.stage !== "Dispatch").reduce((a, o) => a + (o.quote?.total ?? 0), 0);
    const bookedValue = orders.filter(o => o.stage === "Dispatch").reduce((a, o) => a + (o.quote?.total ?? 0), 0);

    return { onTimePct, overdue, avgCycleDays, avgStuckAge, qcPassPct, inventoryValue, openPOValue, pipelineValue, bookedValue, stuckCount: stuck.length, dispatchedCount: dispatched.length, activeCount: orders.length - dispatched.length };
  }, [orders, qcRecords, stock, rates, pos, now]);

  // project rollup (by client)
  const projects = useMemo(() => {
    const m = new Map<string, { name: string; orders: typeof orders; overdue: number; stuck: number }>();
    for (const o of orders) {
      const entry = m.get(o.client) ?? { name: o.client, orders: [] as typeof orders, overdue: 0, stuck: 0 };
      entry.orders.push(o);
      if (o.dueDate && new Date(o.dueDate).getTime() < now && o.stage !== "Dispatch") entry.overdue++;
      if (o.stuck) entry.stuck++;
      m.set(o.client, entry);
    }
    return Array.from(m.values()).sort((a, b) => b.orders.length - a.orders.length);
  }, [orders, now]);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Director — shop floor live</h1>
          <p className="text-sm text-muted-foreground">Every order, every stage, every metric that matters for harness + panel ops.</p>
        </div>
        <div className="text-xs text-muted-foreground num">Synced {fmtDateTime(new Date().toISOString())}</div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="On-time delivery" value={`${metrics.onTimePct}%`} sub={`${metrics.dispatchedCount} dispatched`} tone={metrics.onTimePct >= 85 ? "good" : "warn"} />
        <Kpi label="Overdue (open)" value={metrics.overdue} sub="Past due, not yet dispatched" tone={metrics.overdue > 0 ? "bad" : "good"} />
        <Kpi label="Stuck orders" value={metrics.stuckCount} sub={metrics.stuckCount ? `Avg age ${metrics.avgStuckAge}d` : "All moving"} tone={metrics.stuckCount > 0 ? "bad" : "good"} />
        <Kpi label="Avg cycle time" value={`${metrics.avgCycleDays}d`} sub="PO → Dispatch" />
        <Kpi label="QC pass rate" value={`${metrics.qcPassPct}%`} sub={`${qcRecords.length} inspections`} tone={metrics.qcPassPct >= 90 ? "good" : "warn"} />
        <Kpi label="Inventory value" value={fmtINR(metrics.inventoryValue)} sub="Raw + consumables" />
        <Kpi label="Open PO value" value={fmtINR(metrics.openPOValue)} sub={`${pos.filter(p => p.status !== "Received").length} POs in flight`} />
        <Kpi label="Order book value" value={fmtINR(metrics.pipelineValue)} sub={`Booked: ${fmtINR(metrics.bookedValue)}`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Order status board" action={<span className="text-xs text-muted-foreground">Hover any segment for the stage name</span>}>
            <div className="space-y-5">
              {orders.map(o => (
                <div key={o.id} className="grid grid-cols-12 gap-4 items-center pb-5 border-b border-border last:border-0 last:pb-0">
                  <div className="col-span-12 md:col-span-3">
                    <div className="font-mono text-sm num">{o.woNo}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.client}</div>
                  </div>
                  <div className="col-span-12 md:col-span-2 text-xs">
                    <div className="text-foreground">{o.product} · {o.config}</div>
                    <div className="text-muted-foreground">Qty {o.qty} · {o.motorised ? "Motorised" : "Manual"}</div>
                  </div>
                  <div className="col-span-12 md:col-span-5 pt-5"><StageTracker stage={o.stage} stuck={!!o.stuck} /></div>
                  <div className="col-span-12 md:col-span-2 flex md:justify-end">
                    {o.stuck ? <Pill tone="stuck">{o.stage} · stuck</Pill> : o.stage === "Dispatch" ? <Pill tone="done">Dispatched</Pill> : <Pill tone="active">{o.stage}</Pill>}
                  </div>
                  {o.stuck && (
                    <div className="col-span-12 -mt-2 text-xs text-[var(--status-stuck)]">⚠ {o.stuck.reason}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Stage distribution">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
              {STAGES.map(s => {
                const n = orders.filter(o => o.stage === s).length;
                return (
                  <div key={s} className="rounded-md border border-border p-3">
                    <div className="text-xs text-muted-foreground truncate">{s}</div>
                    <div className="mt-1 text-xl font-display num">{n}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Project rollup (by client)">
            <div className="space-y-2">
              {projects.map(p => (
                <div key={p.name} className="grid grid-cols-12 gap-3 items-center rounded-md border border-border p-3">
                  <div className="col-span-5 text-sm">{p.name}</div>
                  <div className="col-span-2 text-xs"><span className="num font-medium">{p.orders.length}</span> W/Os</div>
                  <div className="col-span-2 text-xs">{p.overdue > 0 ? <Pill tone="amber">{p.overdue} overdue</Pill> : <span className="text-muted-foreground">—</span>}</div>
                  <div className="col-span-2 text-xs">{p.stuck > 0 ? <Pill tone="stuck">{p.stuck} stuck</Pill> : <Pill tone="done">OK</Pill>}</div>
                  <div className="col-span-1 text-xs text-right text-muted-foreground num">
                    {p.orders.filter(o => o.stage === "Dispatch").length}/{p.orders.length}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Alerts" action={<Pill tone="stuck">{orders.filter(o => o.stuck).length}</Pill>}>
            {orders.filter(o => o.stuck).length === 0 ? (
              <Empty title="No active alerts" hint="Everything is moving." />
            ) : (
              <ul className="space-y-3">
                {orders.filter(o => o.stuck).map(o => (
                  <li key={o.id} className="rounded-md border border-[color-mix(in_oklab,var(--status-stuck)_30%,transparent)] bg-[color-mix(in_oklab,var(--status-stuck)_6%,transparent)] p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs num">{o.woNo}</div>
                      <Pill tone="stuck">{o.stage}</Pill>
                    </div>
                    <div className="mt-1 text-sm">{o.stuck!.reason}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{o.client}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Low stock">
            <ul className="space-y-2 text-sm">
              {stock.filter(s => s.onHand < 200).length === 0 ? <Empty title="All items healthy" /> : stock.filter(s => s.onHand < 200).map(s => (
                <li key={s.description} className="flex items-center justify-between rounded-md border border-border p-2">
                  <div className="text-xs">{s.description}</div>
                  <Pill tone="amber">{s.onHand} {s.unit}</Pill>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Activity feed">
            <ul className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
              {activity.map(a => (
                <li key={a.id} className="flex gap-3">
                  <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${a.level === "alert" ? "bg-[var(--status-stuck)]" : a.level === "warn" ? "bg-[var(--amber)]" : "bg-[var(--status-active)]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{a.text}</div>
                    <div className="text-[11px] text-muted-foreground num">{a.role} · {fmtDateTime(a.ts)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: any; sub?: string; tone?: "good" | "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[var(--status-stuck)]" : tone === "warn" ? "text-[var(--amber)]" : tone === "good" ? "text-[var(--status-done)]" : "";
  return (
    <div className="card-panel p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-display num ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
