// App root — session-aware shell + module router
const { useEffect: appUseEffect, useMemo: appUseMemo, useState: appUseState } = React;

function renderModule(role, key) {
  const { Director, DirectorProjects, Planning, PlanningDashboard, Projects, ReleaseBoard, ScheduleBoard, Costing, Purchase, Stores, Quality, QualityDashboard } = window;
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
    if (key === "release") return <ReleaseBoard />;
    if (key === "schedule") return <ScheduleBoard />;
    if (key === "orders") return <Planning />;
    if (key === "costing") return <Costing />;
    if (key === "purchase") return <Purchase />;
    return <PlanningDashboard />;
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
