// Schedule & load — the time lens for Planning.
//   Backward-schedules every active job from its due date (minus a QC/dispatch
//   buffer) into a build-week, then stacks the build HOURS week-by-week against
//   a bench-capacity line. Overloaded weeks light up before they bite.
const { useMemo: scUseMemo, useState: scUseState } = React;

const CAP_KEY = "ready-systems-bench-capacity";
const QC_BUFFER_DAYS = 3;       // reserve before due date for final QC + dispatch
const SC_TRACK_H = 200;         // px height of each week's load track

const SC_STATUS = {
  floor:    { label: "On the floor", color: "var(--status-active)" },
  ready:    { label: "Ready",        color: "var(--primary)" },
  blocked:  { label: "Blocked",      color: "var(--amber)" },
  qc:       { label: "In QC",        color: "var(--status-done)" },
  upstream: { label: "Upstream",     color: "var(--status-pending)" },
};

function scStatusOf(o, shortCount) {
  const { STAGES } = window;
  if (o.stage === "Build") return "floor";
  if (o.stage === "Final QC") return "qc";
  if (STAGES.indexOf(o.stage) < STAGES.indexOf("Approved")) return "upstream";
  return shortCount > 0 || o.stuck ? "blocked" : "ready";
}

const scStartOfWeek = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
};

function ScheduleBoard({ readOnly = false }) {
  const { useStore, getState, procurementForOrder, buildMinutes, openOrder, fmtDate, Pill } = window;
  const orders = useStore(s => s.orders);
  useStore(s => s.pos); useStore(s => s.stock); useStore(s => s.inwards);
  const s = getState();

  const [capacity, setCapacity] = scUseState(() => {
    const raw = Number(localStorage.getItem(CAP_KEY));
    return raw > 0 ? raw : 45;
  });
  const setCap = (v) => { const n = Math.max(1, Number(v) || 0); setCapacity(n); localStorage.setItem(CAP_KEY, String(n)); };

  const { weeks, peak } = scUseMemo(() => {
    const now = new Date();
    const wk0 = scStartOfWeek(now);
    const NWEEKS = 8;
    const weeks = Array.from({ length: NWEEKS }, (_, i) => {
      const start = new Date(wk0); start.setDate(start.getDate() + i * 7);
      return { start, jobs: [], load: 0 };
    });
    const weekIndexFor = (date) => {
      const diff = Math.round((scStartOfWeek(date) - wk0) / (7 * 86400000));
      return Math.min(NWEEKS - 1, Math.max(0, diff));
    };

    orders.filter(o => o.stage !== "Dispatch").forEach(o => {
      const hrs = buildMinutes(o.config, o.qty || 1) / 60;
      const short = procurementForOrder(o, s).filter(r => r.toOrder > 0).length;
      const status = scStatusOf(o, short);
      const schedDate = o.dueDate ? new Date(new Date(o.dueDate).getTime() - QC_BUFFER_DAYS * 86400000) : now;
      const late = !!(o.dueDate && new Date(o.dueDate) < now);
      const wi = weekIndexFor(schedDate);
      weeks[wi].jobs.push({ o, hrs, status, late });
      weeks[wi].load += hrs;
    });

    // bottom-up stacking order: floor, ready, blocked, qc, upstream
    const order = ["floor", "ready", "blocked", "qc", "upstream"];
    weeks.forEach(w => w.jobs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)));
    const peak = weeks.reduce((m, w) => Math.max(m, w.load), 0);
    return { weeks, peak };
  }, [orders, s]);

  const scaleMax = Math.max(capacity * 1.15, peak * 1.05, 1);
  const capY = SC_TRACK_H - (capacity / scaleMax) * SC_TRACK_H;
  const overloaded = weeks.filter(w => w.load > capacity);
  const totalLoad = weeks.reduce((a, w) => a + w.load, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule &amp; load</h1>
          <p className="text-sm text-muted-foreground">Build hours by week, backward-scheduled from due dates. Watch where work piles above the bench line.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Bench capacity</span>
          <input type="number" min="1" value={capacity} onChange={e => setCap(e.target.value)}
            className="w-20 rounded-md border border-input bg-white px-2.5 py-1.5 text-sm shadow-sm num focus:border-primary" />
          <span className="text-muted-foreground">h / week</span>
        </label>
      </div>

      {/* Read on the schedule */}
      <div className="rounded-lg border border-border bg-white px-4 py-3 text-sm">
        {overloaded.length === 0 ? (
          <span><span className="font-medium text-[var(--status-done)]">Bench fits the plan.</span> <span className="text-muted-foreground">≈{totalLoad.toFixed(0)} h queued across 8 weeks, no week over {capacity} h.</span></span>
        ) : (
          <span>
            <span className="font-medium text-[var(--amber)] num">{overloaded.length} week{overloaded.length !== 1 ? "s" : ""} over capacity.</span>{" "}
            <span className="text-muted-foreground">
              Peak {peak.toFixed(0)} h vs {capacity} h bench — pull work forward or add a hand. Drag overloaded jobs left to earlier weeks.
            </span>
          </span>
        )}
      </div>

      {/* Load chart */}
      <div className="card-panel p-5 overflow-x-auto">
        <div className="flex gap-3 min-w-[760px]">
          {/* y-axis */}
          <div className="relative shrink-0 w-10 text-right" style={{ height: SC_TRACK_H }}>
            <span className="absolute right-0 -translate-y-1/2 text-[10px] num text-muted-foreground" style={{ top: 0 }}>{Math.round(scaleMax)}h</span>
            <span className="absolute right-0 -translate-y-1/2 text-[10px] num text-primary font-medium" style={{ top: capY }}>{capacity}h</span>
            <span className="absolute right-0 -translate-y-1/2 text-[10px] num text-muted-foreground" style={{ top: SC_TRACK_H }}>0</span>
          </div>

          {/* week columns */}
          <div className="relative flex-1 flex gap-2">
            {/* capacity line across the plot */}
            <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-primary/70" style={{ top: capY }} />
            {weeks.map((w, i) => {
              const over = w.load > capacity;
              return (
                <div key={i} className="flex-1 min-w-[78px]">
                  <div className={`relative rounded-md ${over ? "bg-[color-mix(in_oklab,var(--amber)_9%,transparent)]" : "bg-muted/40"}`} style={{ height: SC_TRACK_H }}>
                    <div className="absolute inset-x-1 bottom-0 flex flex-col-reverse">
                      {w.jobs.map(({ o, hrs, status, late }) => {
                        const h = Math.max(5, (hrs / scaleMax) * SC_TRACK_H);
                        const tall = h >= 18;
                        return (
                          <button key={o.id} onClick={() => openOrder(o.id)} title={`${o.woNo} · ${o.client} · ${hrs.toFixed(1)}h${late ? " · LATE" : ""}`}
                            className="group relative w-full border-t border-white/40 first:rounded-b-md last:rounded-t-md overflow-hidden hover:brightness-110 transition-all"
                            style={{ height: h, background: SC_STATUS[status].color }}>
                            {tall && <span className="absolute inset-0 flex items-center justify-center px-1 text-[9px] font-medium text-white/95 num truncate">{o.woNo.replace("RS-WO-", "")}</span>}
                            {late && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--status-stuck)] ring-1 ring-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2 text-center">
                    <div className={`text-[11px] font-medium num ${over ? "text-[var(--amber)]" : "text-foreground"}`}>{w.load > 0 ? `${w.load.toFixed(0)}h` : "—"}</div>
                    <div className="text-[10px] text-muted-foreground num">{i === 0 ? "This wk" : fmtDate(w.start.toISOString()).slice(0, 5)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* legend */}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {Object.entries(SC_STATUS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: v.color }} />{v.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[var(--status-stuck)]" />Past due
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-primary">
            <span className="inline-block w-5 border-t border-dashed border-primary/70" />Bench capacity
          </span>
        </div>
      </div>

      {/* This-week detail */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">This week &amp; next</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weeks.slice(0, 3).filter(w => w.jobs.length).map((w, i) => (
            <div key={i} className="card-panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{i === 0 ? "This week" : `Wk of ${fmtDate(w.start.toISOString()).slice(0, 5)}`}</span>
                <Pill tone={w.load > capacity ? "amber" : "active"}>{w.load.toFixed(0)} h</Pill>
              </div>
              <div className="space-y-1.5">
                {w.jobs.map(({ o, hrs, status, late }) => (
                  <button key={o.id} onClick={() => openOrder(o.id)} className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-left hover:border-primary transition-colors">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SC_STATUS[status].color }} />
                      <span className="font-mono text-[11px] num truncate">{o.woNo}</span>
                      <span className="text-[11px] text-muted-foreground truncate">{o.client}</span>
                      {late && <Pill tone="stuck">late</Pill>}
                    </span>
                    <span className="shrink-0 text-[11px] num text-muted-foreground">{hrs.toFixed(1)}h</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ScheduleBoard });
