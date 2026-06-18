// Director — shop floor live dashboard
const { useEffect: dirUseEffect, useMemo: dirUseMemo, useState: dirUseState } = React;

function Kpi({ label, value, sub, tone }) {
  const color = tone === "bad" ? "text-[var(--status-stuck)]" : tone === "warn" ? "text-[var(--amber)]" : tone === "good" ? "text-[var(--status-done)]" : "";
  return (
    <div className="card-panel p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-display num ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Director() {
  const { useStore, STAGES, Card, Pill, StageTracker, Empty, fmtDateTime, fmtINR } = window;
  const orders = useStore(s => s.orders);
  const activity = useStore(s => s.activity);
  const pos = useStore(s => s.pos);
  const stock = useStore(s => s.stock);
  const rates = useStore(s => s.materialRates);
  const qcRecords = useStore(s => s.qcRecords);

  const [, force] = dirUseState(0);
  dirUseEffect(() => { const t = setInterval(() => force(x => x + 1), 5000); return () => clearInterval(t); }, []);

  const now = Date.now();

  const metrics = dirUseMemo(() => {
    const dispatched = orders.filter(o => o.stage === "Dispatch");
    const onTime = dispatched.filter(o => o.dispatchedDate && o.dueDate && new Date(o.dispatchedDate) <= new Date(o.dueDate)).length;
    const onTimePct = dispatched.length ? Math.round((onTime / dispatched.length) * 100) : 100;
    const overdue = orders.filter(o => o.stage !== "Dispatch" && o.dueDate && new Date(o.dueDate).getTime() < now).length;
    const stuck = orders.filter(o => o.stuck);
    const avgStuckAge = stuck.length === 0 ? 0 : Math.round(stuck.reduce((a, o) => {
      const t = o.poDate ? (now - new Date(o.poDate).getTime()) / 86400000 : 0;
      return a + t;
    }, 0) / stuck.length);

    const avgCycleDays = dispatched.length === 0 ? 0 : Math.round(dispatched.reduce((a, o) => {
      if (!o.poDate || !o.dispatchedDate) return a;
      return a + (new Date(o.dispatchedDate).getTime() - new Date(o.poDate).getTime()) / 86400000;
    }, 0) / Math.max(1, dispatched.length));

    const qcPass = qcRecords.filter(r => r.disposition === "Accept" || r.disposition === "Pass").length;
    const qcPassPct = qcRecords.length ? Math.round((qcPass / qcRecords.length) * 100) : 100;

    const inventoryValue = stock.reduce((a, r) => a + r.onHand * ((rates.find(x => x.description === r.description) || {}).rate ?? 0), 0);
    const openPOValue = pos.filter(p => p.status !== "Received").reduce((a, p) => a + p.items.reduce((aa, b) => aa + b.qty * b.rate, 0), 0);
    const pipelineValue = orders.filter(o => o.stage !== "Dispatch").reduce((a, o) => a + ((o.quote || {}).total ?? 0), 0);
    const bookedValue = orders.filter(o => o.stage === "Dispatch").reduce((a, o) => a + ((o.quote || {}).total ?? 0), 0);

    return { onTimePct, overdue, avgCycleDays, avgStuckAge, qcPassPct, inventoryValue, openPOValue, pipelineValue, bookedValue, stuckCount: stuck.length, dispatchedCount: dispatched.length, activeCount: orders.length - dispatched.length };
  }, [orders, qcRecords, stock, rates, pos, now]);

  const projects = dirUseMemo(() => {
    const m = new Map();
    for (const o of orders) {
      const entry = m.get(o.client) || { name: o.client, orders: [], overdue: 0, stuck: 0 };
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
                    <div className="mt-1 text-sm">{o.stuck.reason}</div>
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

// Director — Project portfolio: cross-client, value-first, leadership view
function DirectorProjects() {
  const { useStore, openOrder, Card, Pill, Empty, computeCosting, procurementForOrder, getState, fmtINR } = window;
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const s = getState();
  const now = Date.now();

  const portfolio = dirUseMemo(() => {
    const m = new Map();
    for (const o of orders) {
      const e = m.get(o.client) || { client: o.client, projects: new Set(), orders: [], value: 0, dispatched: 0, overdue: 0, stuck: 0, toOrder: 0 };
      e.orders.push(o);
      if (o.project) e.projects.add(o.project);
      e.value += (o.quote || {}).total ?? computeCosting(o).total;
      if (o.stage === "Dispatch") e.dispatched++;
      if (o.dueDate && new Date(o.dueDate).getTime() < now && o.stage !== "Dispatch") e.overdue++;
      if (o.stuck) e.stuck++;
      if (o.stage !== "Dispatch" && procurementForOrder(o, s).some(r => r.toOrder > 0)) e.toOrder++;
      m.set(o.client, e);
    }
    return Array.from(m.values()).sort((a, b) => b.value - a.value);
  }, [orders, s, now]);

  const totalValue = portfolio.reduce((a, p) => a + p.value, 0);
  const maxValue = Math.max(1, ...portfolio.map(p => p.value));
  const dispatchedValue = orders.filter(o => o.stage === "Dispatch").reduce((a, o) => a + ((o.quote || {}).total ?? computeCosting(o).total), 0);
  const atRisk = portfolio.filter(p => p.stuck > 0 || p.overdue > 0).length;
  const activeProjects = portfolio.reduce((a, p) => a + p.orders.filter(o => o.stage !== "Dispatch").length, 0);

  const urgentOrder = (p) => {
    const active = p.orders.filter(o => o.stage !== "Dispatch");
    return active.find(o => o.stuck) || active.find(o => o.dueDate && new Date(o.dueDate).getTime() < now) || active[0] || p.orders[0];
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Project portfolio</h1>
        <p className="text-sm text-muted-foreground">Every client account by value and health. Click a row to open its most urgent order.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Clients" value={portfolio.length} />
        <Kpi label="Active orders" value={activeProjects} sub={`${orders.length} total`} />
        <Kpi label="Order book" value={fmtINR(totalValue)} sub="Quoted value" />
        <Kpi label="Dispatched" value={fmtINR(dispatchedValue)} sub="Booked" tone="good" />
        <Kpi label="At-risk clients" value={atRisk} sub="Stuck or overdue" tone={atRisk ? "bad" : "good"} />
      </div>

      <Card title="Accounts by value">
        {portfolio.length === 0 ? <Empty title="No projects yet" /> : (
          <div className="space-y-2">
            {portfolio.map(p => {
              const total = p.orders.length;
              const pct = Math.round((p.dispatched / Math.max(1, total)) * 100);
              const health = p.stuck > 0 ? "stuck" : p.overdue > 0 ? "amber" : "active";
              const u = urgentOrder(p);
              return (
                <button key={p.client} onClick={() => u && openOrder(u.id)} className="w-full text-left rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/30 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-12 md:col-span-3">
                      <div className="font-medium">{p.client}</div>
                      <div className="text-[11px] text-muted-foreground">{p.projects.size || 1} project{p.projects.size === 1 ? "" : "s"} · {total} W/O{total === 1 ? "" : "s"}</div>
                    </div>
                    <div className="col-span-7 md:col-span-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-[var(--status-done)]" style={{ width: `${pct}%` }} /></div>
                        <span className="text-[11px] text-muted-foreground num w-20 shrink-0">{p.dispatched}/{total} done</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary/60" style={{ width: `${Math.round((p.value / maxValue) * 100)}%` }} /></div>
                        <span className="num text-xs w-24 shrink-0 text-right">{fmtINR(p.value)}</span>
                      </div>
                    </div>
                    <div className="col-span-5 md:col-span-3 flex flex-wrap gap-1.5 md:justify-center">
                      {p.stuck > 0 && <Pill tone="stuck">{p.stuck} stuck</Pill>}
                      {p.overdue > 0 && <Pill tone="amber">{p.overdue} overdue</Pill>}
                      {p.toOrder > 0 && <Pill tone="amber">{p.toOrder} to order</Pill>}
                      {p.stuck === 0 && p.overdue === 0 && p.toOrder === 0 && <Pill tone="done">On track</Pill>}
                    </div>
                    <div className="col-span-12 md:col-span-2 md:text-right text-xs text-muted-foreground">
                      {u ? <span className="num">{u.woNo} →</span> : "—"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

Object.assign(window, { Director, DirectorProjects });
