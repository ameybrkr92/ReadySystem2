// Login, Brand, Shell (sidebar + header + role switcher)
const { useEffect: shUseEffect, useRef: shUseRef, useState: shUseState } = React;
const { resetDemo, toast } = window;

const DEMO_USERS = [
  { email: "mihir@readysystems.in", password: "demo@123", role: "Director",  name: "Mihir Borker" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Planning",  name: "Rohan Deshpande" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Inventory", name: "Anjali Kulkarni" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Quality",   name: "Sameer Joshi" },
];

function Brand({ light = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`grid place-items-center h-10 w-10 rounded-md ${light ? "bg-paper text-primary" : "bg-primary text-primary-foreground"} font-display font-bold`}>R</div>
      <div>
        <div className={`text-base font-semibold tracking-tight ${light ? "text-paper" : ""}`}>Ready Systems</div>
        <div className={`text-[11px] uppercase tracking-[0.18em] ${light ? "text-paper/50" : "text-muted-foreground"}`}>Operations console</div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const { Button, Field, Input } = window;
  const [email, setEmail] = shUseState("mihir@readysystems.in");
  const [password, setPassword] = shUseState("demo@123");
  const [error, setError] = shUseState(null);

  function submit(e) {
    e.preventDefault();
    const u = DEMO_USERS.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
    if (!u) { setError("Invalid email or password."); return; }
    onLogin({ role: u.role, name: u.name });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[var(--ink)] text-paper p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(var(--paper) 1px, transparent 1px), linear-gradient(90deg, var(--paper) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative z-10">
          <Brand light />
          <p className="mt-12 max-w-md text-sm leading-relaxed text-paper/70">
            Wire-harness &amp; medium-voltage switchgear contract assembly. One operations console — Planning, Inventory, Quality and a live Director view of every order on the floor.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-6 text-xs text-paper/60">
          <div><div className="text-2xl font-display text-paper">9</div>active W/Os</div>
          <div><div className="text-2xl font-display text-paper">2</div>need attention</div>
          <div><div className="text-2xl font-display text-paper">11</div>lifecycle stages</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Brand /></div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your work email to access the operations console.</p>

          <div className="mt-8 grid gap-4">
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={e => { setEmail(e.target.value); setError(null); }} placeholder="you@readysystems.in" />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(null); }} placeholder="••••••••" />
            </Field>
            {error && <div className="text-xs text-[var(--status-stuck)]">{error}</div>}
            <Button type="submit" className="mt-2">Sign in →</Button>
          </div>

          <div className="mt-8 rounded-md border border-border bg-muted/50 p-3 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Demo:</span> mihir@readysystems.in · demo@123 — switch role any time from the avatar menu.
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground">
            Forgot your password? Contact your administrator.
          </p>
        </form>
      </div>
    </div>
  );
}

// ---- Sidebar nav icons ----
function Icon({ path }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">
      <path d={path} />
    </svg>
  );
}
const ICONS = {
  dashboard: <Icon path="M3 12h7V3H3v9zm0 9h7v-7H3v7zm11 0h7V12h-7v9zm0-18v7h7V3h-7z" />,
  orders: <Icon path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
  costing: <Icon path="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />,
  purchase: <Icon path="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />,
  stores: <Icon path="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
  quality: <Icon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
  stock: <Icon path="M4 7v10a2 2 0 002 2h12a2 2 0 002-2V7M4 7l8-4 8 4M4 7l8 4 8-4M12 11v10" />,
  records: <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  project: <Icon path="M2 7l10-5 10 5-10 5L2 7zm0 5l10 5 10-5M2 17l10 5 10-5" />,
  release: <Icon path="M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v6h-4z" />,
  schedule: <Icon path="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z" />,
  kpi: <Icon path="M9 19V13m4 6V5m4 14v-8M5 19h14a1 1 0 001-1V6a1 1 0 00-1-1H5a1 1 0 00-1 1v12a1 1 0 001 1z" />,
};

function getRoleNav(role) {
  switch (role) {
    case "Director": return [
      { key: "dashboard", label: "Dashboard", icon: ICONS.dashboard },
      { key: "orders", label: "Orders", icon: ICONS.orders },
      { key: "projects", label: "Projects", icon: ICONS.project },
      { key: "release", label: "Release board", icon: ICONS.release },
      { key: "purchase", label: "Purchase", icon: ICONS.purchase },
      { key: "costing", label: "Costing", icon: ICONS.costing },
      { key: "inventory", label: "Inventory", icon: ICONS.stores },
      { key: "quality-kpi", label: "Quality KPIs", icon: ICONS.kpi },
      { key: "quality", label: "Quality", icon: ICONS.quality },
    ];
    case "Planning": return [
      { key: "dashboard", label: "Dashboard", icon: ICONS.dashboard },
      { key: "release", label: "Release board", icon: ICONS.release },
      { key: "schedule", label: "Schedule & load", icon: ICONS.schedule },
      { key: "orders", label: "Orders & BOM", icon: ICONS.orders },
      { key: "costing", label: "Costing", icon: ICONS.costing },
      { key: "purchase", label: "Purchase", icon: ICONS.purchase },
    ];
    case "Inventory": return [
      { key: "inward", label: "Inward + QC", icon: ICONS.records },
      { key: "stock", label: "Stock on hand", icon: ICONS.stock },
      { key: "issue", label: "Issue to job", icon: ICONS.stores },
    ];
    case "Quality": return [
      { key: "dashboard", label: "Quality KPIs", icon: ICONS.kpi },
      { key: "final", label: "Final QC", icon: ICONS.quality },
      { key: "records", label: "QC records", icon: ICONS.records },
    ];
    default: return [];
  }
}

function Shell({ session, onLogout, onSwitchRole, nav, current, onNav, children }) {
  const [open, setOpen] = shUseState(false);
  const [menuOpen, setMenuOpen] = shUseState(false);
  const menuRef = shUseRef(null);
  shUseEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-sidebar text-sidebar-foreground p-4 flex flex-col transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0`}>
        <div className="px-2 py-2"><Brand light /></div>

        <nav className="mt-6 flex-1 space-y-0.5">
          <div className="px-3 text-[10px] uppercase tracking-[0.18em] text-paper/40">{session.role} module</div>
          <div className="mt-2">
            {nav.map(n => (
              <button key={n.key} onClick={() => { onNav(n.key); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${current === n.key ? "bg-sidebar-accent text-paper" : "text-paper/70 hover:bg-sidebar-accent/60 hover:text-paper"}`}>
                {n.icon}<span>{n.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {session.role === "Director" && (
          <button onClick={() => { resetDemo(); toast("Demo data reset"); }}
            className="mb-2 rounded-md border border-sidebar-border px-3 py-2 text-xs text-paper/70 hover:bg-sidebar-accent">
            Reset demo data
          </button>
        )}
        <div className="rounded-md border border-sidebar-border p-3 text-xs text-paper/60">
          Ready Systems · Wire harness · MV switchgear · 8DJHST / 8FB20 contract assembly.
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
            <div className="text-xs text-muted-foreground">{session.role} · {(nav.find(n => n.key === current) || {}).label}</div>
          </div>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-tight">{session.name}</div>
                <div className="text-[11px] text-muted-foreground">Logged in as {session.role}</div>
              </div>
              <div className="grid place-items-center h-9 w-9 rounded-full bg-primary-soft text-primary text-sm font-semibold">
                {session.name.split(" ").map(s => s[0]).slice(0, 2).join("")}
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-muted-foreground"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-72 card-panel p-2 z-30 shadow-lg">
                <div className="px-3 py-2 border-b border-border">
                  <div className="text-sm font-medium">{session.name}</div>
                  <div className="text-[11px] text-muted-foreground">Currently {session.role}</div>
                </div>
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Switch role</div>
                <div className="max-h-72 overflow-y-auto">
                  {DEMO_USERS.map(u => {
                    const active = u.role === session.role;
                    return (
                      <button
                        key={u.role}
                        onClick={() => { onSwitchRole && onSwitchRole({ role: u.role, name: u.name }); setMenuOpen(false); }}
                        className={`w-full flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${active ? "bg-primary-soft text-primary" : "hover:bg-muted"}`}
                      >
                        <div>
                          <div className="font-medium">{u.role}</div>
                          <div className="text-[11px] text-muted-foreground">{u.name}</div>
                        </div>
                        {active && <span className="text-[10px] uppercase tracking-wider">Current</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-border mt-1 pt-1">
                  <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

Object.assign(window, { DEMO_USERS, Brand, Login, getRoleNav, Shell });
