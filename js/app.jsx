// App root — session-aware shell + module router
const { useEffect: appUseEffect, useMemo: appUseMemo, useState: appUseState } = React;

function renderModule(role, key) {
  const { Director, DirectorProjects, Planning, PlanningDashboard, Projects, ReleaseBoard, ScheduleBoard, Costing, Purchase, ProcurementDashboard, Stores, Quality, QualityDashboard } = window;
  if (role === "Director") {
    if (key === "dashboard") return <Director />;
    if (key === "orders") return <Planning readOnly />;
    if (key === "projects") return <DirectorProjects />;
    if (key === "release") return <ReleaseBoard readOnly />;
    if (key === "purchase") return <Purchase readOnly />;
    if (key === "costing") return <Costing readOnly />;
    if (key === "inventory") return <Stores view="stock" readOnly />;
    if (key === "quality-kpi") return <QualityDashboard readOnly />;
    if (key === "quality") return <Quality view="records" readOnly />;
  }
  if (role === "Planning") {
    if (key === "orders") return <Planning />;
    if (key === "release") return <ReleaseBoard />;
    if (key === "schedule") return <ScheduleBoard />;
    return <PlanningDashboard />;
  }
  if (role === "Procurement") {
    if (key === "dashboard") return <ProcurementDashboard />;
    if (key === "costing") return <Costing />;
    if (["sourcing", "orders", "bills", "suppliers"].includes(key)) return <Purchase view={key} />;
    return <ProcurementDashboard />;
  }
  if (role === "Inventory") {
    if (key === "stock") return <Stores view="stock" />;
    if (key === "issue") return <Stores view="issue" />;
    return <Stores view="inward" />;
  }
  if (role === "Quality") {
    if (key === "dashboard") return <QualityDashboard />;
    if (key === "records") return <Quality view="records" />;
    return <Quality view="final" />;
  }
  return null;
}

function App() {
  const { useSession, getRoleNav, Shell, Login, Toaster, OrderWorkspace, useOpenOrder, closeOrder } = window;
  const [session, setSession] = useSession();
  const nav = appUseMemo(() => (session ? getRoleNav(session.role) : []), [session]);
  const [current, setCurrent] = appUseState("");
  const open = useOpenOrder();

  appUseEffect(() => {
    if (session && (!current || !nav.find(n => n.key === current))) setCurrent(nav[0]?.key ?? "");
  }, [session, nav, current]);

  if (!session) return (<React.Fragment><Login onLogin={setSession} /><Toaster /></React.Fragment>);

  const goNav = (k) => { closeOrder(); setCurrent(k); };
  window.__goNav = goNav;   // lets modules (e.g. the procurement dashboard) deep-link a sidebar view
  // switch role in place (keeps the open order) — used by the workspace "view only" chip
  window.__switchRole = (role) => { const u = (window.DEMO_USERS || []).find(x => x.role === role); if (u) setSession({ role: u.role, name: u.name }); };

  return (
    <React.Fragment>
      <Shell session={session} onLogout={() => { closeOrder(); setSession(null); }} onSwitchRole={(v) => { closeOrder(); setSession(v); }} nav={nav} current={current} onNav={goNav}>
        {open.id ? <OrderWorkspace /> : renderModule(session.role, current)}
      </Shell>
      <Toaster />
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
