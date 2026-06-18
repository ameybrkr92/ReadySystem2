// Quality KPIs — a focused dashboard for a contract panel/harness assembler.
//   Seven metrics that actually fit a low-volume, high-mix job shop, each
//   computed from records the console already holds — not vanity numbers.
//   First-pass yield · on-time delivery · supplier rejection · COPQ ·
//   customer complaints (+ response/resolve) · audit-observation closure.
const { useMemo: qkUseMemo } = React;

const QK_DAY = 86400000;
const qkDiff = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / QK_DAY);
const qkMean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function QKpi({ label, value, sub, tone }) {
  const color = tone === "bad" ? "text-[var(--status-stuck)]" : tone === "warn" ? "text-[var(--amber)]" : tone === "good" ? "text-[var(--status-done)]" : "";
  const dot = tone === "bad" ? "var(--status-stuck)" : tone === "warn" ? "var(--amber)" : tone === "good" ? "var(--status-done)" : "var(--border)";
  return (
    <div className="card-panel p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      </div>
      <div className={`mt-2 text-2xl font-display num ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

// lower-is-better tone (rejection %, COPQ, days, open counts)
const loTone = (v, good, warn) => (v <= good ? "good" : v <= warn ? "warn" : "bad");
// higher-is-better tone (yield %, OTD %)
const hiTone = (v, good, warn) => (v >= good ? "good" : v >= warn ? "warn" : "bad");

function QualityDashboard({ readOnly = false }) {
  const { useStore, Card, Pill, Table, Empty, fmtINR, fmtDate } = window;
  const orders = useStore(s => s.orders);
  const inwards = useStore(s => s.inwards) || [];
  const finalQc = useStore(s => s.finalQcJobs) || [];
  const complaints = useStore(s => s.complaints) || [];
  const audits = useStore(s => s.auditObservations) || [];
  const now = Date.now();

  const m = qkUseMemo(() => {
    // First-pass yield — finished assemblies passing Final QC first time
    const finalDone = finalQc.filter(j => j.status && j.status !== "Pending");
    const fpyPass = finalDone.filter(j => j.status === "Pass").length;
    const fpy = finalDone.length ? Math.round((fpyPass / finalDone.length) * 100) : 100;

    // On-time delivery — dispatched on or before the committed due date
    const dispatched = orders.filter(o => o.stage === "Dispatch");
    const onTime = dispatched.filter(o => o.dispatchedDate && o.dueDate && new Date(o.dispatchedDate) <= new Date(o.dueDate)).length;
    const otd = dispatched.length ? Math.round((onTime / dispatched.length) * 100) : 100;

    // Supplier rejection — by inspected lot (rework + reject count as defect)
    const inspected = inwards.filter(i => i.qcStatus && i.qcStatus !== "Pending");
    const bySupplier = new Map();
    inspected.forEach(i => {
      const e = bySupplier.get(i.partyName) || { supplier: i.partyName, lots: 0, accepted: 0, rework: 0, rejected: 0 };
      e.lots++;
      if (i.qcStatus === "Accepted") e.accepted++;
      else if (i.qcStatus === "Rework") e.rework++;
      else if (i.qcStatus === "Rejected") e.rejected++;
      bySupplier.set(i.partyName, e);
    });
    const suppliers = [...bySupplier.values()].map(e => ({ ...e, rejPct: Math.round(((e.rework + e.rejected) / e.lots) * 100) })).sort((a, b) => b.rejPct - a.rejPct);
    const totalDefect = inspected.filter(i => i.qcStatus === "Rework" || i.qcStatus === "Rejected").length;
    const supplierRej = inspected.length ? Math.round((totalDefect / inspected.length) * 100) : 0;

    // COPQ proxy — value of rejected + reworked incoming material ÷ booked revenue
    const failValue = inwards.filter(i => i.qcStatus === "Rejected" || i.qcStatus === "Rework").reduce((a, i) => a + (i.qty || 0) * (i.rate || 0), 0);
    const booked = dispatched.reduce((a, o) => a + ((o.quote || {}).total || 0), 0);
    const copq = booked ? +((failValue / booked) * 100).toFixed(1) : 0;

    // Customer complaints — open count + response/resolution speed
    const openC = complaints.filter(c => c.status !== "Resolved").length;
    const responded = complaints.filter(c => c.responded).map(c => qkDiff(c.responded, c.received));
    const resolved = complaints.filter(c => c.resolved).map(c => qkDiff(c.resolved, c.received));
    const avgRespond = +qkMean(responded).toFixed(1);
    const avgResolve = +qkMean(resolved).toFixed(1);

    // Audit observation closure
    const openA = audits.filter(a => a.status !== "Closed");
    const overdueA = openA.filter(a => a.due && new Date(a.due).getTime() < now).length;
    const closedA = audits.filter(a => a.closed).map(a => qkDiff(a.closed, a.raised));
    const avgClosure = Math.round(qkMean(closedA));

    return {
      fpy, fpyPass, fpyTotal: finalDone.length,
      otd, onTime, dispatched: dispatched.length,
      supplierRej, suppliers, inspectedLots: inspected.length, totalDefect,
      copq, failValue, booked,
      openC, avgRespond, avgResolve, complaintCount: complaints.length,
      openA: openA.length, overdueA, avgClosure, auditCount: audits.length,
    };
  }, [orders, inwards, finalQc, complaints, audits, now]);

  const sevPill = (s) => <Pill tone={s === "Major" ? "stuck" : "amber"}>{s}</Pill>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quality KPIs</h1>
          <p className="text-sm text-muted-foreground">Seven metrics that fit a contract panel &amp; harness shop — computed live from QC, inward, dispatch and complaint records.</p>
        </div>
        {readOnly && <span className="text-xs text-muted-foreground">Read-only · Director view</span>}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QKpi label="First-pass yield" value={`${m.fpy}%`} sub={`${m.fpyPass}/${m.fpyTotal} passed Final QC clean`} tone={hiTone(m.fpy, 95, 85)} />
        <QKpi label="On-time delivery" value={`${m.otd}%`} sub={`${m.onTime}/${m.dispatched} dispatched on time`} tone={hiTone(m.otd, 90, 75)} />
        <QKpi label="Supplier rejection" value={`${m.supplierRej}%`} sub={`${m.totalDefect}/${m.inspectedLots} inspected lots`} tone={loTone(m.supplierRej, 5, 15)} />
        <QKpi label="COPQ (proxy)" value={`${m.copq}%`} sub={`${fmtINR(m.failValue)} scrap/rework ÷ booked`} tone={loTone(m.copq, 2, 5)} />
        <QKpi label="Open complaints" value={m.openC} sub={`${m.complaintCount} logged this period`} tone={loTone(m.openC, 0, 2)} />
        <QKpi label="Avg time to resolve" value={`${m.avgResolve}d`} sub={`Respond in ${m.avgRespond}d avg`} tone={loTone(m.avgResolve, 3, 7)} />
        <QKpi label="Audit obs open" value={m.openA} sub={m.overdueA ? `${m.overdueA} past due date` : "None overdue"} tone={m.overdueA ? "bad" : loTone(m.openA, 0, 3)} />
        <QKpi label="Avg closure time" value={`${m.avgClosure}d`} sub="Raised → closed" tone={loTone(m.avgClosure, 14, 30)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Supplier quality */}
        <Card title="Supplier quality — incoming QC">
          {m.suppliers.length === 0 ? <Empty title="No inspected lots yet" /> : (
            <Table headers={["Supplier", "Lots", "Accepted", "Rework", "Rejected", "Rejection"]}>
              {m.suppliers.map(s => (
                <tr key={s.supplier}>
                  <td className="px-4 py-3"><b>{s.supplier}</b></td>
                  <td className="px-4 py-3 num text-xs">{s.lots}</td>
                  <td className="px-4 py-3 num text-xs text-[var(--status-done)]">{s.accepted}</td>
                  <td className="px-4 py-3 num text-xs">{s.rework || "—"}</td>
                  <td className="px-4 py-3 num text-xs">{s.rejected || "—"}</td>
                  <td className="px-4 py-3"><Pill tone={s.rejPct === 0 ? "done" : s.rejPct <= 15 ? "amber" : "stuck"}>{s.rejPct}%</Pill></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* Final QC outcomes / first-pass yield */}
        <Card title="Final QC — first-pass yield">
          <div className="p-5 space-y-4">
            <div className="flex items-end gap-4">
              <div className="text-4xl font-display num" style={{ color: m.fpy >= 95 ? "var(--status-done)" : m.fpy >= 85 ? "var(--amber)" : "var(--status-stuck)" }}>{m.fpy}%</div>
              <div className="text-sm text-muted-foreground pb-1">{m.fpyPass} of {m.fpyTotal} finished assemblies cleared Final QC without rework or hold.</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted flex">
              <div className="h-full" style={{ width: `${m.fpy}%`, background: "var(--status-done)" }} />
              <div className="h-full" style={{ width: `${100 - m.fpy}%`, background: "var(--status-stuck)" }} />
            </div>
            <div className="flex gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--status-done)" }} />Passed clean</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--status-stuck)" }} />Held / reworked</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-border pt-3">
              First-pass yield is the single best internal quality number for a shop like this — it captures rework cost, schedule risk and customer-facing defects in one figure. Gate 10 (Final QC) already produces the data.
            </p>
          </div>
        </Card>

        {/* Complaints */}
        <Card title={`Customer complaints (${m.openC} open)`}>
          {complaints.length === 0 ? <Empty title="No complaints logged" /> : (
            <Table headers={["Ref", "Client", "Category", "Severity", "Status"]}>
              {complaints.map(c => (
                <tr key={c.id}>
                  <td className="px-4 py-3"><span className="font-mono text-xs num">{c.complaintNo}</span><div className="text-[11px] text-muted-foreground mt-0.5">{c.woNo}</div></td>
                  <td className="px-4 py-3 text-xs">{c.client}</td>
                  <td className="px-4 py-3 text-xs">{c.category}</td>
                  <td className="px-4 py-3">{sevPill(c.severity)}</td>
                  <td className="px-4 py-3">{c.status === "Resolved" ? <Pill tone="done">Resolved · {qkDiff(c.resolved, c.received)}d</Pill> : <Pill tone="stuck">Open · {qkDiff(now, c.received)}d</Pill>}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        {/* Audit observations */}
        <Card title={`Audit observations (${m.openA} open${m.overdueA ? `, ${m.overdueA} overdue` : ""})`}>
          {audits.length === 0 ? <Empty title="No audit observations" /> : (
            <Table headers={["Ref", "Source", "Area", "Severity", "Status"]}>
              {audits.map(a => {
                const overdue = a.status !== "Closed" && a.due && new Date(a.due).getTime() < now;
                return (
                  <tr key={a.id}>
                    <td className="px-4 py-3"><span className="font-mono text-xs num">{a.obsNo}</span></td>
                    <td className="px-4 py-3 text-xs">{a.source}</td>
                    <td className="px-4 py-3 text-xs">{a.area}</td>
                    <td className="px-4 py-3">{sevPill(a.severity)}</td>
                    <td className="px-4 py-3">{a.status === "Closed" ? <Pill tone="done">Closed · {qkDiff(a.closed, a.raised)}d</Pill> : overdue ? <Pill tone="stuck">Overdue</Pill> : <Pill tone="amber">Open</Pill>}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
      </div>

      {/* Honest scope note */}
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <b className="text-foreground">Deliberately not tracked:</b> PPM (per-million) metrics and NPS suit high-volume or many-customer businesses — on builds of a few dozen units for a handful of industrial clients they mislead more than they inform. Rejection rates by lot and complaint/closure speed are the honest equivalents for this shop.
      </div>
    </div>
  );
}

Object.assign(window, { QualityDashboard });
