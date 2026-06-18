import { useState } from "react";
import type { Role, Session } from "@/lib/erp-store";
import { Button, Field, Input } from "./ui";

export const DEMO_USERS: { email: string; password: string; role: Role; name: string }[] = [
  { email: "mihir@readysystems.in", password: "demo@123", role: "Director",  name: "Mihir Borker" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Planning",  name: "Rohan Deshpande" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Inventory", name: "Anjali Kulkarni" },
  { email: "mihir@readysystems.in", password: "demo@123", role: "Quality",   name: "Sameer Joshi" },
];

export function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [email, setEmail] = useState("mihir@readysystems.in");
  const [password, setPassword] = useState("demo@123");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
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

          <p className="mt-10 text-[11px] text-muted-foreground">
            Forgot your password? Contact your administrator.
          </p>
        </form>
      </div>
    </div>
  );
}

export function Brand({ light = false }: { light?: boolean }) {
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
