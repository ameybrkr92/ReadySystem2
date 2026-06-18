// UI primitives (Card, Pill, Button, Table, Modal, Toaster, etc.)
const { useEffect: uiUseEffect, useState: uiUseState } = React;
const { STAGES } = window;

function Card({ title, action, children, className = "" }) {
  return (
    <div className={`card-panel ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          {title && <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Pill({ tone = "pending", children }) {
  const map = {
    done: "bg-[color-mix(in_oklab,var(--status-done)_14%,transparent)] text-[var(--status-done)] ring-[color-mix(in_oklab,var(--status-done)_30%,transparent)]",
    active: "bg-[color-mix(in_oklab,var(--status-active)_14%,transparent)] text-[var(--status-active)] ring-[color-mix(in_oklab,var(--status-active)_30%,transparent)]",
    stuck: "bg-[color-mix(in_oklab,var(--status-stuck)_14%,transparent)] text-[var(--status-stuck)] ring-[color-mix(in_oklab,var(--status-stuck)_30%,transparent)]",
    pending: "bg-muted text-muted-foreground ring-border",
    amber: "bg-[color-mix(in_oklab,var(--amber)_14%,transparent)] text-[var(--amber)] ring-[color-mix(in_oklab,var(--amber)_30%,transparent)]",
  };
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[tone]}`}>{children}</span>;
}

function StageBadge({ stage, stuck }) {
  if (stuck) return <Pill tone="stuck">● {stage} — stuck</Pill>;
  if (stage === "Dispatch") return <Pill tone="done">● {stage}</Pill>;
  return <Pill tone="active">● {stage}</Pill>;
}

function StageTracker({ stage, stuck }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div className="flex items-center gap-1 num">
      {STAGES.map((s, i) => {
        const done = i < idx || (i === idx && stage === "Dispatch");
        const current = i === idx && stage !== "Dispatch";
        const isStuck = current && stuck;
        const cls = done ? "bg-[var(--status-done)]"
          : isStuck ? "bg-[var(--status-stuck)] animate-pulse"
          : current ? "bg-[var(--status-active)]"
          : "bg-border";
        return (
          <div key={s} className="group relative flex-1 min-w-0">
            <div className={`h-1.5 rounded-full transition-colors ${cls}`} />
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-0.5 text-[10px] text-paper opacity-0 group-hover:opacity-100 pointer-events-none z-10">
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children, hint, error }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-[var(--status-stuck)]">{error}</span>}
    </label>
  );
}

const inputCls = "w-full rounded-md border border-input bg-white px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:border-primary";

function Input(props) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
function Select(props) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
function Textarea(props) {
  return <textarea {...props} className={`${inputCls} min-h-[80px] ${props.className ?? ""}`} />;
}

function Button({ variant = "primary", className = "", ...p }) {
  const map = {
    primary: "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_85%,black)]",
    secondary: "bg-secondary text-foreground hover:bg-accent border border-border",
    ghost: "text-foreground hover:bg-muted",
    danger: "bg-[var(--status-stuck)] text-white hover:opacity-90",
  };
  return <button {...p} className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50 disabled:pointer-events-none ${map[variant]} ${className}`} />;
}

// Toast
let toastQueue = [];
const toastListeners = new Set();
function toast(text) {
  const id = Math.random().toString(36).slice(2);
  toastQueue.push({ id, text });
  toastListeners.forEach(l => l());
  setTimeout(() => { toastQueue = toastQueue.filter(t => t.id !== id); toastListeners.forEach(l => l()); }, 3200);
}
function Toaster() {
  const [, force] = uiUseState(0);
  uiUseEffect(() => { const l = () => force(x => x + 1); toastListeners.add(l); return () => { toastListeners.delete(l); }; }, []);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toastQueue.map(t => (
        <div key={t.id} className="card-panel px-4 py-3 text-sm shadow-lg animate-in flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--status-done)]" />
          {t.text}
        </div>
      ))}
    </div>
  );
}

function Empty({ title, hint, action }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Modal({ open, onClose, title, children, maxW = "max-w-2xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-6 backdrop-blur-sm">
      <div className={`card-panel w-full ${maxW} mt-12`}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Table({ headers, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>{headers.map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border bg-white">{children}</tbody>
      </table>
    </div>
  );
}

Object.assign(window, {
  Card, Pill, StageBadge, StageTracker, Field, Input, Select, Textarea,
  Button, toast, Toaster, Empty, Modal, Table,
});
