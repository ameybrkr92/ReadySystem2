import { useState } from "react";
import { useStore, setState, logActivity, uid } from "@/lib/erp-store";
import { Card, Pill, Button, Field, Input, Select, Modal, Table, Empty, toast } from "./ui";
import { fmtDate, fmtDateTime, todayISO } from "@/lib/format";

export function Quality({ view, readOnly = false }: { view: "final" | "records"; readOnly?: boolean }) {
  if (view === "records") return <Records />;
  return <FinalQC readOnly={readOnly} />;
}

function FinalQC({ readOnly }: { readOnly: boolean }) {
  const jobs = useStore(s => s.finalQcJobs);
  const orders = useStore(s => s.orders);
  const merged = [
    ...jobs,
    ...orders.filter(o => (o.stage === "Build" || o.stage === "Final QC") && !jobs.some(j => j.woNo === o.woNo)).map(o => ({ id: `auto-${o.id}`, woNo: o.woNo, status: "Pending" as const, createdAt: todayISO() })),
  ];
  const [open, setOpen] = useState<{ woNo: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Final QC — pre-dispatch gate</h1>
        <p className="text-sm text-muted-foreground">Finished harness / assembly inspection before dispatch.</p>
      </div>
      <Card title={`Queue (${merged.filter(j => j.status === "Pending").length})`}>
        {merged.length === 0 ? <Empty title="Nothing in build" /> : (
          <Table headers={["W/O", "Status", "Created", ""]}>
            {merged.map(j => (
              <tr key={j.id}>
                <td className="px-4 py-3 font-mono text-xs">{j.woNo}</td>
                <td className="px-4 py-3">{j.status === "Pass" ? <Pill tone="done">Pass</Pill> : j.status === "Hold" ? <Pill tone="stuck">Hold</Pill> : <Pill tone="active">Pending</Pill>}</td>
                <td className="px-4 py-3 num text-xs">{fmtDate(j.createdAt)}</td>
                <td className="px-4 py-3 text-right">{!readOnly && j.status !== "Pass" && <Button variant="secondary" onClick={() => setOpen({ woNo: j.woNo })}>Inspect</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {open && <FinalModal woNo={open.woNo} onClose={() => setOpen(null)} />}
    </div>
  );
}

function FinalModal({ woNo, onClose }: { woNo: string; onClose: () => void }) {
  const [rows, setRows] = useState([
    { parameter: "Continuity — all feeders", spec: "0 Ω end-to-end", method: "Continuity tester", frequency: "100%", observation: "" },
    { parameter: "Connector seating", spec: "Audible click, no play", method: "Tactile + visual", frequency: "100%", observation: "" },
    { parameter: "Visual / dress", spec: "No nicks, sleeves square", method: "Visual", frequency: "100%", observation: "" },
    { parameter: "Label / marking", spec: "Per drawing", method: "Visual", frequency: "100%", observation: "" },
  ]);
  const [checkedBy, setCheckedBy] = useState("Meera Joshi");
  const [disp, setDisp] = useState<"Pass" | "Hold">("Pass");

  function save() {
    setState(s => {
      const existing = s.finalQcJobs.find(j => j.woNo === woNo);
      if (existing) existing.status = disp;
      else s.finalQcJobs.unshift({ id: uid(), woNo, status: disp, createdAt: todayISO() });
      s.qcRecords.unshift({
        id: uid(), kind: "Final", refId: woNo, refLabel: `Final assembly · ${woNo}`,
        checkedBy, date: todayISO(), rows, disposition: disp,
      });
      const o = s.orders.find(x => x.woNo === woNo);
      if (o) {
        if (disp === "Pass") { o.stage = "Dispatch"; o.dispatchedDate = todayISO(); o.stuck = null; }
        else { o.stage = "Final QC"; o.stuck = { reason: "Final QC HOLD" }; }
      }
      return s;
    });
    logActivity("Quality", `Final QC ${disp.toUpperCase()} — ${woNo}`, disp === "Hold" ? "alert" : undefined);
    toast(`Final QC: ${disp}`);
    onClose();
  }

  return (
    <Modal open={true} onClose={onClose} title={`Final QC — ${woNo}`} maxW="max-w-3xl">
      <Field label="Checked by"><Input value={checkedBy} onChange={e => setCheckedBy(e.target.value)} /></Field>
      <div className="mt-4">
        <Table headers={["Parameter", "Spec", "Method", "Frequency", "Observation"]}>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2">{r.parameter}</td>
              <td className="px-4 py-2 text-xs">{r.spec}</td>
              <td className="px-4 py-2 text-xs">{r.method}</td>
              <td className="px-4 py-2 text-xs">{r.frequency}</td>
              <td className="px-4 py-2"><Input value={r.observation} onChange={e => { const n = [...rows]; n[i] = { ...n[i], observation: e.target.value }; setRows(n); }} /></td>
            </tr>
          ))}
        </Table>
      </div>
      <div className="mt-5 grid md:grid-cols-2 gap-4 items-end">
        <Field label="Disposition">
          <Select value={disp} onChange={e => setDisp(e.target.value as any)}>
            <option value="Pass">Pass → ready to dispatch</option>
            <option value="Hold">Hold</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Submit final QC</Button></div>
      </div>
    </Modal>
  );
}

function Records() {
  const records = useStore(s => s.qcRecords);
  function exportPack() {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `qc-audit-pack-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
    toast("Audit pack exported");
  }
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">QC records</h1>
          <p className="text-sm text-muted-foreground">All inspections — Incoming (Inventory) + Final (Quality).</p>
        </div>
        <Button variant="secondary" onClick={exportPack}>Export audit pack</Button>
      </div>
      <Card>
        {records.length === 0 ? <Empty title="No inspections recorded yet" /> : (
          <Table headers={["When", "Gate", "Reference", "Checked by", "Disposition"]}>
            {records.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-3 num text-xs">{fmtDateTime(r.date)}</td>
                <td className="px-4 py-3"><Pill tone={r.kind === "Incoming" ? "active" : "amber"}>{r.kind}</Pill></td>
                <td className="px-4 py-3 text-xs">{r.refLabel}</td>
                <td className="px-4 py-3 text-xs">{r.checkedBy}</td>
                <td className="px-4 py-3"><Pill tone={r.disposition === "Accept" || r.disposition === "Pass" ? "done" : r.disposition === "Hold" || r.disposition === "Scrap" || r.disposition === "Return" ? "stuck" : "amber"}>{r.disposition}</Pill></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
