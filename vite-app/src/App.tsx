import { useEffect, useMemo, useState } from "react";
import { useSession, type Role } from "@/lib/erp-store";
import { Login } from "@/components/erp/Login";
import { Shell, getRoleNav } from "@/components/erp/Shell";
import { Director } from "@/components/erp/Director";
import { Planning, Projects } from "@/components/erp/Planning";
import { Costing } from "@/components/erp/Costing";
import { Purchase } from "@/components/erp/Purchase";
import { Stores } from "@/components/erp/Stores";
import { Quality } from "@/components/erp/Quality";
import { Toaster } from "@/components/erp/ui";

export default function App() {
  const [session, setSession] = useSession();
  const nav = useMemo(() => (session ? getRoleNav(session.role) : []), [session]);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    if (session && (!current || !nav.find((n) => n.key === current))) setCurrent(nav[0]?.key ?? "");
  }, [session, nav, current]);

  if (!session)
    return (
      <>
        <Login onLogin={setSession} />
        <Toaster />
      </>
    );

  return (
    <>
      <Shell session={session} onLogout={() => setSession(null)} onSwitchRole={setSession} nav={nav} current={current} onNav={setCurrent}>
        {renderModule(session.role, current)}
      </Shell>
      <Toaster />
    </>
  );
}

function renderModule(role: Role, key: string) {
  if (role === "Director") {
    if (key === "dashboard") return <Director />;
    if (key === "orders") return <Planning readOnly />;
    if (key === "projects") return <Projects readOnly />;
    if (key === "purchase") return <Purchase readOnly />;
    if (key === "costing") return <Costing readOnly />;
    if (key === "inventory") return <Stores view="stock" readOnly />;
    if (key === "quality") return <Quality view="records" readOnly />;
  }
  if (role === "Planning") {
    if (key === "projects") return <Projects />;
    if (key === "costing") return <Costing />;
    if (key === "purchase") return <Purchase />;
    return <Planning />;
  }
  if (role === "Inventory") {
    if (key === "stock") return <Stores view="stock" />;
    if (key === "issue") return <Stores view="issue" />;
    return <Stores view="inward" />;
  }
  if (role === "Quality") {
    if (key === "records") return <Quality view="records" />;
    return <Quality view="final" />;
  }
  return null;
}
