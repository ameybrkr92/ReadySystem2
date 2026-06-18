// Release board — material-gated kanban. Planning's daily driver:
//   "What can I send to the floor today, and what's holding the rest back?"
// Every card is derived from data the engine already computes (procurement
// coverage, build minutes, stage, due date). The Release action advances a
// job to Build — turning the board from a report into a decision tool.
const { useMemo: rbUseMemo, useState: rbUseState } = React;

const REL_COLS = [
  { key: "approval", title: "Awaiting approval", hint: "Upstream — not yet cleared to buy/build", tone: "pending" },
  { key: "blocked",  title: "Blocked on material", hint: "Approved, but material is short", tone: "stuck" },
  { key: "ready",    title: "Ready to release", hint: "Material covered · approved · idle", tone: "primary", hero: true },
  { key: "floor",    title: "On the floor", hint: "Building now", tone: "active" },
  { key: "qc",       title: "QC & dispatch", hint: "Final check → out the door", tone: "done" },
];

function columnOf(o, shortCount) {
  const { STAGES } = window;
  if (o.stage === "Dispatch" || o.stage === "Final QC") return "qc";
  if (o.stage === "Build") return "floor";
  const approved = STAGES.indexOf(o.stage) >= STAGES.indexOf("Approved");
  if (!approved) return "approval";
  if (shortCount > 0 || o.stuck) return "blocked";
  return "ready";
}

function DueBadge({ o }) {
  const { Pill, fmtDate } = window;
  if (!o.dueDate || o.stage === "Dispatch") return o.dueDate ? <span className="text-[10px] text-muted-foreground num">{fmtDate(o.dueDate)}</span> : null;
  const now = Date.now();
  const d = new Date(o.dueDate).getTime();
  if (d < now) return <Pill tone="stuck">Overdue</Pill>;
  if (d < now + 7 * 86400000) return <Pill tone="amber">Due {fmtDate(o.dueDate)}</Pill>;
  return <span className="text-[10px] text-muted-foreground num">{fmtDate(o.dueDate)}</span>;
}

function ReleaseCard({ o, s, readOnly }) {
  const { Pill, openOrder, procurementForOrder, buildMinutes, advanceOrder, logActivity, toast } = window;
  const proc = procurementForOrder(o, s);
  const total = proc.length;
  const short = proc.filter(r => r.toOrder > 0);
  const ready = total - short.length;
  const pct = total ? Math.round((ready / total) * 100) : 100;
  const hrs = buildMinutes(o.config, o.qty || 1) / 60;
  const col = columnOf(o, short.length);

  function release(e) {
    e.stopPropagation();
    advanceOrder(o.woNo, "Build");
    logActivity("Planning", `Released ${o.woNo} (${o.client}) to the floor`);
    toast(`${o.woNo} released to the floor`);
  }
  function go(tab) { return (e) => { e.stopPropagation(); openOrder(o.id, tab); }; }

  return (
    <div onClick={() => openOrder(o.id)}
      className="group cursor-pointer rounded-lg border border-border bg-white p-3 shadow-sm transition-colors hover:border-primary">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs num">{o.woNo}</span>
        <DueBadge o={o} />
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground truncate">
        {o.client} · <span className="font-mono">{o.config}</span> · Qty {o.qty}
      </div>

      {o.stuck && (
        <div className="mt-2 rounded-md bg-[color-mix(in_oklab,var(--status-stuck)_8%,transparent)] px-2 py-1 text-[10px] text-[var(--status-stuck)] leading-snug">
          {o.stuck.reason}
        </div>
      )}

      <div className="mt-2.5">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Material</span>
          <span className={short.length ? "text-[var(--amber)]" : "text-[var(--status-done)]"}>
            {short.length ? `${ready}/${total} · ${short.length} short` : `${total}/${total} covered`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%`, background: short.length ? "var(--amber)" : "var(--status-done)" }} />
        </div>
        {short.length > 0 && col === "blocked" && (
          <div className="mt-1.5 text-[10px] text-muted-foreground truncate">
            Short: {short.slice(0, 2).map(r => r.description.replace(/ HV /, " ")).join(", ")}{short.length > 2 ? ` +${short.length - 2}` : ""}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground num">≈ {hrs.toFixed(1)} h build</span>
        {col === "qc" && o.stage === "Dispatch" && <Pill tone="done">Dispatched</Pill>}
        {col === "qc" && o.stage !== "Dispatch" && !o.stuck && <Pill tone="active">{o.stage}</Pill>}
      </div>

      {col === "ready" && !readOnly && (
        <button onClick={release}
          className="mt-3 w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]">
          Release to floor →
        </button>
      )}
      {col === "blocked" && (
        <button onClick={go("procurement")}
          className="mt-3 w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
          Open procurement →
        </button>
      )}
    </div>
  );
}

function ReleaseColumn({ col, orders, s, readOnly }) {
  const { buildMinutes } = window;
  const hero = col.hero;
  const load = orders.reduce((a, o) => a + buildMinutes(o.config, o.qty || 1) / 60, 0);
  const accent = { primary: "var(--primary)", stuck: "var(--status-stuck)", active: "var(--status-active)", done: "var(--status-done)", pending: "var(--muted-foreground)" }[col.tone];

  return (
    <div className={`flex min-w-[260px] flex-1 flex-col rounded-xl border ${hero ? "border-primary/30 bg-primary-soft/25" : "border-border bg-muted/30"}`}>
      <div className="px-3.5 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
            <h3 className={`text-[13px] font-semibold tracking-tight ${hero ? "text-primary" : ""}`}>{col.title}</h3>
          </div>
          <span className={`num rounded-full px-2 py-0.5 text-[11px] font-medium ${hero ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground ring-1 ring-inset ring-border"}`}>{orders.length}</span>
        </div>
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{col.hint}</p>
        {(col.key === "ready" || col.key === "floor") && orders.length > 0 && (
          <p className="mt-1.5 text-[10px] num text-muted-foreground">≈ {load.toFixed(1)} h of work</p>
        )}
      </div>
      <div className="flex-1 space-y-3 px-3 pb-3.5">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
            {col.key === "ready" ? "Nothing cleared yet — clear blockers at left" : "Empty"}
          </div>
        ) : orders.map(o => <ReleaseCard key={o.id} o={o} s={s} readOnly={readOnly} />)}
      </div>
    </div>
  );
}

function ReleaseBoard({ readOnly = false }) {
  const { useStore, getState, procurementForOrder, buildMinutes, Select } = window;
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const s = getState();
  const [clientFilter, setClientFilter] = rbUseState("All");

  const clients = rbUseMemo(() => ["All", ...Array.from(new Set(orders.map(o => o.client)))], [orders]);

  const buckets = rbUseMemo(() => {
    const b = { approval: [], blocked: [], ready: [], floor: [], qc: [] };
    orders
      .filter(o => clientFilter === "All" || o.client === clientFilter)
      .forEach(o => {
        const short = procurementForOrder(o, s).filter(r => r.toOrder > 0).length;
        b[columnOf(o, short)].push(o);
      });
    // Within each column, sort by urgency: stuck → overdue → soonest due
    const score = (o) => (o.stuck ? 0 : 1e12) + (o.dueDate ? new Date(o.dueDate).getTime() : 2e12);
    Object.values(b).forEach(list => list.sort((a, c) => score(a) - score(c)));
    return b;
  }, [orders, s, clientFilter]);

  const readyLoad = buckets.ready.reduce((a, o) => a + buildMinutes(o.config, o.qty || 1) / 60, 0);
  const floorLoad = buckets.floor.reduce((a, o) => a + buildMinutes(o.config, o.qty || 1) / 60, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Release board</h1>
          <p className="text-sm text-muted-foreground">What's cleared for the floor and what's holding the rest back. Drag of the day, left to right.</p>
        </div>
        <Select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="!w-auto min-w-[10rem]">{clients.map(c => <option key={c}>{c}</option>)}</Select>
      </div>

      {/* Insight strip — the one-line read on the floor */}
      <div className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
        {buckets.ready.length > 0 ? (
          <span>
            <span className="font-medium text-primary num">{buckets.ready.length} job{buckets.ready.length !== 1 ? "s" : ""}</span> ready to release
            <span className="text-muted-foreground"> (≈{readyLoad.toFixed(1)} h)</span>.
            {buckets.blocked.length > 0 && <span className="text-muted-foreground"> {buckets.blocked.length} blocked on material, {buckets.floor.length} on the floor (≈{floorLoad.toFixed(1)} h).</span>}
          </span>
        ) : (
          <span>
            <span className="font-medium text-[var(--status-stuck)]">Nothing is cleared for the floor.</span>{" "}
            <span className="text-muted-foreground">
              {buckets.blocked.length > 0 && `${buckets.blocked.length} job${buckets.blocked.length !== 1 ? "s" : ""} blocked on material`}
              {buckets.blocked.length > 0 && buckets.approval.length > 0 && ", "}
              {buckets.approval.length > 0 && `${buckets.approval.length} still upstream awaiting approval`}
              {(buckets.blocked.length || buckets.approval.length) ? " — clear these to feed the bench." : ""}
            </span>
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {REL_COLS.map(col => <ReleaseColumn key={col.key} col={col} orders={buckets[col.key]} s={s} readOnly={readOnly} />)}
      </div>
    </div>
  );
}

Object.assign(window, { ReleaseBoard });
