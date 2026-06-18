// Stores (Inward+QC, Stock, Issue) + Quality (Final QC, Records)
const { useState: stUseState } = React;

function Info_st({ label, value }) {
  return <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-0.5 text-sm">{value}</div></div>;
}

const IQP_ROWS = [
  { parameter: "Type / make", spec: "As per spec sheet", method: "Visual", frequency: "100%", observation: "" },
  { parameter: "Size", spec: "Per drawing ± tolerance", method: "Steel ruler / vernier", frequency: "1 per lot", observation: "" },
  { parameter: "Surface finish", spec: "Smooth, no nicks / cuts", method: "Visual", frequency: "100%", observation: "" },
  { parameter: "Markings / label", spec: "Per PO + lot traceability", method: "Visual", frequency: "100%", observation: "" },
];

function QCModal({ entry, onClose }) {
  const { Modal, Field, Input, Select, Button, Table, setStoreState, logActivity, uid, addToStock, toast, todayISO } = window;
  const [rows, setRows] = stUseState(() => IQP_ROWS.map(r => ({ ...r })));
  const [checkedBy, setCheckedBy] = stUseState("Sunil Yadav");
  const [disp, setDisp] = stUseState("Accept");
  const [notes, setNotes] = stUseState("");
  if (!entry) return null;
  const e0 = entry;

  function save() {
    setStoreState(s => {
      const e = s.inwards.find(x => x.id === e0.id);
      e.qcStatus = disp === "Accept" ? "Accepted" : disp === "Rework" ? "Rework" : "Rejected";
      s.qcRecords.unshift({
        id: uid(), kind: "Incoming", refId: e0.id, refLabel: `${e0.grnNo} · ${e0.itemDescription}`,
        plan: "QA-IQP-011 Rev 9", checkedBy, date: todayISO(), rows, disposition: disp, notes,
      });
      if (disp === "Accept") {
        addToStock(e0.itemDescription, e0.unit, e0.qty, e0.coils);
        const o = s.orders.find(x => x.woNo === e0.woNo);
        if (o && o.stage === "Incoming QC") o.stage = "Stores";
      }
      return s;
    });
    logActivity("Inventory", `Inward QC ${disp.toUpperCase()} — ${e0.grnNo} (${e0.itemDescription})`, disp === "Accept" ? undefined : "warn");
    toast(`QC: ${disp}`);
    onClose();
  }

  return (
    <Modal open={!!entry} onClose={onClose} title={`Incoming QC — ${e0.itemDescription}`} maxW="max-w-4xl">
      <div className="grid md:grid-cols-4 gap-4 mb-5">
        <Info_st label="Material" value={e0.itemDescription} />
        <Info_st label="GRN" value={e0.grnNo} />
        <Info_st label="Lot" value={e0.lotNo} />
        <Info_st label="Party" value={e0.partyName} />
      </div>
      <Field label="Checked by"><Input value={checkedBy} onChange={e => setCheckedBy(e.target.value)} /></Field>
      <div className="mt-5">
        <Table headers={["Parameter", "Spec", "Method", "Frequency", "Observation"]}>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-4 py-2">{r.parameter}</td>
              <td className="px-4 py-2 text-xs">{r.spec}</td>
              <td className="px-4 py-2 text-xs">{r.method}</td>
              <td className="px-4 py-2 text-xs">{r.frequency}</td>
              <td className="px-4 py-2"><Input value={r.observation} onChange={e => { const n = [...rows]; n[i] = { ...n[i], observation: e.target.value }; setRows(n); }} placeholder="OK / measurement" /></td>
            </tr>
          ))}
        </Table>
      </div>
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <Field label="Disposition">
          <Select value={disp} onChange={e => setDisp(e.target.value)}>
            <option value="Accept">Accept → add to stock</option>
            <option value="Rework">Rework</option>
            <option value="Scrap">Scrap</option>
            <option value="Return">Return to supplier</option>
          </Select>
        </Field>
        <Field label="Notes (optional)"><Input value={notes} onChange={e => setNotes(e.target.value)} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Submit inspection</Button>
      </div>
    </Modal>
  );
}

function NewInwardModal({ open, onClose }) {
  const { useStore, Modal, Field, Input, Select, Button, setStoreState, logActivity, uid, toast, fmtNum, todayISO, isoToInputDate, recomputePoStatus } = window;
  const orders = useStore(s => s.orders);
  const pos = useStore(s => s.pos);
  const rates = useStore(s => s.materialRates);
  const [f, setF] = stUseState({
    date: isoToInputDate(todayISO()), grnNo: "", poNo: pos[0]?.poNo ?? "",
    lotNo: "", lrNo: "", partyName: "", itemDescription: rates[0].description, challanNo: "",
    qty: 100, coils: 1, unit: "m", rate: rates[0].rate, woNo: orders[0]?.woNo ?? "",
  });

  function save() {
    if (!f.grnNo || !f.partyName) { toast("GRN No and Party are required"); return; }
    setStoreState(s => {
      s.inwards.unshift({
        id: uid(), date: new Date(f.date).toISOString(), grnNo: f.grnNo, poNo: f.poNo, lotNo: f.lotNo, lrNo: f.lrNo,
        partyName: f.partyName, itemDescription: f.itemDescription, challanNo: f.challanNo,
        qty: f.qty, coils: f.unit === "m" ? f.coils : undefined, unit: f.unit, rate: f.rate, woNo: f.woNo, qcStatus: "Pending",
      });
      const o = s.orders.find(x => x.woNo === f.woNo);
      if (o && (o.stage === "PO" || o.stage === "Purchase Received")) o.stage = "Incoming QC";
      if (f.poNo) recomputePoStatus(s, f.poNo);
      return s;
    });
    logActivity("Inventory", `GRN ${f.grnNo} received — ${f.partyName} (${f.itemDescription}, ${fmtNum(f.qty)} ${f.unit}) → PO auto-updated`);
    toast("Inward entry saved");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New inward entry" maxW="max-w-3xl">
      <div className="grid grid-cols-3 gap-4">
        <Field label="Date"><Input type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="GRN No"><Input value={f.grnNo} onChange={e => setF({ ...f, grnNo: e.target.value })} placeholder="GRN-0113" /></Field>
        <Field label="PO No"><Select value={f.poNo} onChange={e => setF({ ...f, poNo: e.target.value })}>{pos.map(p => <option key={p.id}>{p.poNo}</option>)}{pos.length === 0 && <option>—</option>}</Select></Field>
        <Field label="Lot No"><Input value={f.lotNo} onChange={e => setF({ ...f, lotNo: e.target.value })} /></Field>
        <Field label="LR No"><Input value={f.lrNo} onChange={e => setF({ ...f, lrNo: e.target.value })} /></Field>
        <Field label="Party name"><Input value={f.partyName} onChange={e => setF({ ...f, partyName: e.target.value })} /></Field>
        <Field label="Item description">
          <Select value={f.itemDescription} onChange={e => { const r = rates.find(x => x.description === e.target.value); setF({ ...f, itemDescription: r.description, rate: r.rate, unit: r.unit }); }}>
            {rates.map(r => <option key={r.description}>{r.description}</option>)}
          </Select>
        </Field>
        <Field label="Challan / Invoice No"><Input value={f.challanNo} onChange={e => setF({ ...f, challanNo: e.target.value })} /></Field>
        <Field label="Against W/O"><Select value={f.woNo} onChange={e => setF({ ...f, woNo: e.target.value })}>{orders.map(o => <option key={o.id} value={o.woNo}>{o.woNo}</option>)}</Select></Field>
        <Field label="Qty"><Input type="number" value={f.qty} onChange={e => setF({ ...f, qty: Number(e.target.value) })} /></Field>
        <Field label="Unit"><Select value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })}><option value="m">metres</option><option value="nos">nos</option></Select></Field>
        {f.unit === "m" && <Field label="Coils"><Input type="number" value={f.coils} onChange={e => setF({ ...f, coils: Number(e.target.value) })} /></Field>}
        <Field label="Rate (₹)"><Input type="number" value={f.rate} onChange={e => setF({ ...f, rate: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save inward entry</Button>
      </div>
    </Modal>
  );
}

function Inward({ readOnly }) {
  const { useStore, Card, Pill, Button, Table, Empty, fmtDate, fmtINR, fmtNum } = window;
  const inwards = useStore(s => s.inwards);
  const [show, setShow] = stUseState(false);
  const [qcEntry, setQcEntry] = stUseState(null);
  const pending = inwards.filter(i => i.qcStatus === "Pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inward + Incoming QC</h1>
          <p className="text-sm text-muted-foreground">Receive material, inspect on the spot, route accepted stock to inventory.</p>
        </div>
        <div className="flex items-center gap-3">
          <Pill tone={pending ? "amber" : "done"}>{pending} pending QC</Pill>
          {!readOnly && <Button onClick={() => setShow(true)}>+ New inward entry</Button>}
        </div>
      </div>

      <Card>
        {inwards.length === 0 ? <Empty title="No inward entries yet" hint="Add the first one." action={!readOnly && <Button onClick={() => setShow(true)}>+ New inward entry</Button>} /> : (
          <Table headers={["Date", "GRN", "PO", "Lot", "LR", "Party", "Item", "Qty", "Rate", "QC", ""]}>
            {inwards.map(i => (
              <tr key={i.id}>
                <td className="px-4 py-3 num text-xs">{fmtDate(i.date)}</td>
                <td className="px-4 py-3 font-mono text-xs">{i.grnNo}</td>
                <td className="px-4 py-3 font-mono text-xs">{i.poNo}</td>
                <td className="px-4 py-3 font-mono text-xs">{i.lotNo}</td>
                <td className="px-4 py-3 font-mono text-xs">{i.lrNo}</td>
                <td className="px-4 py-3 text-xs">{i.partyName}</td>
                <td className="px-4 py-3 text-xs">{i.itemDescription}</td>
                <td className="px-4 py-3 num text-xs">{fmtNum(i.qty)} {i.unit}{i.coils ? ` · ${i.coils} coils` : ""}</td>
                <td className="px-4 py-3 num text-xs">{fmtINR(i.rate)}</td>
                <td className="px-4 py-3">{i.qcStatus === "Accepted" ? <Pill tone="done">Accepted</Pill> : i.qcStatus === "Rejected" ? <Pill tone="stuck">Rejected</Pill> : i.qcStatus === "Rework" ? <Pill tone="amber">Rework</Pill> : <Pill tone="pending">Pending</Pill>}</td>
                <td className="px-4 py-3 text-right">{!readOnly && i.qcStatus === "Pending" && <Button variant="secondary" onClick={() => setQcEntry(i)}>Inspect</Button>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <NewInwardModal open={show} onClose={() => setShow(false)} />
      <QCModal entry={qcEntry} onClose={() => setQcEntry(null)} />
    </div>
  );
}

function Stock() {
  const { useStore, Card, Pill, Table, fmtINR, fmtNum } = window;
  const stock = useStore(s => s.stock);
  const rates = useStore(s => s.materialRates);
  const totalValue = stock.reduce((a, r) => {
    const rt = (rates.find(x => x.description === r.description) || {}).rate ?? 0;
    return a + r.onHand * rt;
  }, 0);
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock on hand</h1>
          <p className="text-sm text-muted-foreground">Wire in metres + coil count. Hardware in nos.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Inventory value</div>
          <div className="text-xl font-display num">{fmtINR(totalValue)}</div>
        </div>
      </div>
      <Card>
        <Table headers={["Item", "On hand", "Unit", "Coils", "Status"]}>
          {stock.map(r => {
            const low = r.onHand < 200;
            return (
              <tr key={r.description}>
                <td className="px-4 py-3">{r.description}</td>
                <td className="px-4 py-3 num font-medium">{fmtNum(r.onHand)}</td>
                <td className="px-4 py-3">{r.unit}</td>
                <td className="px-4 py-3 num">{r.coils ?? "—"}</td>
                <td className="px-4 py-3">{low ? <Pill tone="stuck">Low stock</Pill> : <Pill tone="done">OK</Pill>}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </div>
  );
}

function IssueToJob({ readOnly }) {
  const { useStore, Card, Field, Input, Select, Button, Table, Empty, setStoreState, logActivity, uid, toast, fmtDate, fmtNum, todayISO } = window;
  const stock = useStore(s => s.stock);
  const orders = useStore(s => s.orders);
  const issues = useStore(s => s.issues);
  const [item, setItem] = stUseState(stock[0]?.description ?? "");
  const [woNo, setWoNo] = stUseState(orders[0]?.woNo ?? "");
  const [qty, setQty] = stUseState(10);

  function issue() {
    const row = stock.find(s => s.description === item);
    if (!row) return;
    if (qty > row.onHand) { toast("Not enough stock"); return; }
    setStoreState(s => {
      const r = s.stock.find(x => x.description === item);
      const prev = r.onHand;
      r.onHand -= qty;
      if (r.coils && row.unit === "m") r.coils = Math.max(0, Math.round((r.onHand / prev) * r.coils));
      s.issues.unshift({ id: uid(), date: todayISO(), woNo, itemDescription: item, qty, unit: row.unit });
      const o = s.orders.find(x => x.woNo === woNo);
      if (o && (o.stage === "Stores" || o.stage === "Incoming QC")) o.stage = "Build";
      return s;
    });
    logActivity("Inventory", `Issued ${fmtNum(qty)} ${row.unit} ${item} to ${woNo}`);
    toast("Material issued");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Issue material to job</h1>
        <p className="text-sm text-muted-foreground">Pull stock against a live W/O. Recorded as consumption.</p>
      </div>
      <Card>
        <div className="grid md:grid-cols-4 gap-4">
          <Field label="Item"><Select value={item} onChange={e => setItem(e.target.value)} disabled={readOnly}>{stock.map(s => <option key={s.description}>{s.description}</option>)}</Select></Field>
          <Field label="W/O"><Select value={woNo} onChange={e => setWoNo(e.target.value)} disabled={readOnly}>{orders.map(o => <option key={o.id} value={o.woNo}>{o.woNo}</option>)}</Select></Field>
          <Field label="Qty"><Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} disabled={readOnly} /></Field>
          <div className="flex items-end"><Button onClick={issue} disabled={readOnly}>Issue material</Button></div>
        </div>
      </Card>

      <Card title="Recent issues">
        {issues.length === 0 ? <Empty title="No issues yet" /> : (
          <Table headers={["Date", "W/O", "Item", "Qty"]}>
            {issues.map(i => (
              <tr key={i.id}>
                <td className="px-4 py-3 num text-xs">{fmtDate(i.date)}</td>
                <td className="px-4 py-3 font-mono text-xs">{i.woNo}</td>
                <td className="px-4 py-3">{i.itemDescription}</td>
                <td className="px-4 py-3 num">{fmtNum(i.qty)} {i.unit}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Stores({ view, readOnly = false }) {
  if (view === "inward") return <Inward readOnly={readOnly} />;
  if (view === "stock") return <Stock />;
  return <IssueToJob readOnly={readOnly} />;
}

// ===================== Quality =====================

function FinalModal({ woNo, onClose }) {
  const { Modal, Field, Input, Select, Button, Table, setStoreState, logActivity, uid, toast, todayISO } = window;
  const [rows, setRows] = stUseState([
    { parameter: "Continuity — all feeders", spec: "0 Ω end-to-end", method: "Continuity tester", frequency: "100%", observation: "" },
    { parameter: "Connector seating", spec: "Audible click, no play", method: "Tactile + visual", frequency: "100%", observation: "" },
    { parameter: "Visual / dress", spec: "No nicks, sleeves square", method: "Visual", frequency: "100%", observation: "" },
    { parameter: "Label / marking", spec: "Per drawing", method: "Visual", frequency: "100%", observation: "" },
  ]);
  const [checkedBy, setCheckedBy] = stUseState("Meera Joshi");
  const [disp, setDisp] = stUseState("Pass");
  const [notes, setNotes] = stUseState("");

  function save() {
    const recId = uid();
    setStoreState(s => {
      const existing = s.finalQcJobs.find(j => j.woNo === woNo);
      if (existing) { existing.status = disp; existing.createdAt = todayISO(); }
      else s.finalQcJobs.unshift({ id: uid(), woNo, status: disp, createdAt: todayISO() });
      s.qcRecords.unshift({
        id: recId, kind: "Final", refId: woNo, refLabel: `Final assembly · ${woNo}`,
        checkedBy, date: todayISO(), rows, disposition: disp,
      });
      const o = s.orders.find(x => x.woNo === woNo);
      if (o) {
        if (disp === "Pass") { o.stage = "Dispatch"; o.dispatchedDate = todayISO(); o.stuck = null; o.rework = null; }
        else if (disp === "Reject") {
          // Reject → back to the floor for rework (recovery loop). Must be re-built
          // and re-sent to QC via "Mark build complete".
          o.stage = "Build";
          o.rework = { reason: notes || "Final QC reject — rework required", since: todayISO(), qcRecordId: recId };
          o.stuck = null;
        } else { // Hold
          o.stage = "Final QC";
          o.stuck = { reason: notes ? `Final QC HOLD — ${notes}` : "Final QC HOLD" };
        }
      }
      return s;
    });
    logActivity("Quality", `Final QC ${disp.toUpperCase()} — ${woNo}`, (disp === "Hold" || disp === "Reject") ? "alert" : undefined);
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
      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <Field label="Disposition">
          <Select value={disp} onChange={e => setDisp(e.target.value)}>
            <option value="Pass">Pass → ready to dispatch</option>
            <option value="Hold">Hold → fix in place, re-inspect</option>
            <option value="Reject">Reject → back to floor for rework</option>
          </Select>
        </Field>
        <Field label={disp === "Pass" ? "Notes (optional)" : "Reason / defect"}>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder={disp === "Reject" ? "e.g. continuity fail on feeder 2" : "Optional note"} />
        </Field>
      </div>
      {disp !== "Pass" && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {disp === "Reject"
            ? "Reject sends the job back to Build for rework — it must be re-built and marked complete again before it returns to this gate."
            : "Hold keeps the job at this gate for in-place fixing and re-inspection."}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Submit final QC</Button></div>
    </Modal>
  );
}

function FinalQC({ readOnly }) {
  const { useStore, Card, Pill, Button, Table, Empty, fmtDate, todayISO } = window;
  const jobs = useStore(s => s.finalQcJobs);
  const orders = useStore(s => s.orders);
  // Order-driven queue: a job only reaches Final QC once the floor marks the build
  // complete (stage → "Final QC"). Jobs still in Build (incl. rework) never appear here.
  const merged = orders
    .filter(o => o.stage === "Final QC" || o.stage === "Dispatch")
    .map(o => {
      const j = jobs.find(x => x.woNo === o.woNo);
      const status = o.stage === "Dispatch" ? "Pass" : (j && j.status === "Hold" ? "Hold" : "Pending");
      return { id: `q-${o.id}`, woNo: o.woNo, status, createdAt: (j && j.createdAt) || o.dispatchedDate || o.dueDate, rework: o.rework };
    })
    .sort((a, b) => (a.status === "Pass" ? 1 : 0) - (b.status === "Pass" ? 1 : 0));
  const [open, setOpen] = stUseState(null);

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

function Records() {
  const { useStore, Card, Pill, Button, Table, Empty, toast, fmtDateTime } = window;
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
                <td className="px-4 py-3"><Pill tone={r.disposition === "Accept" || r.disposition === "Pass" ? "done" : r.disposition === "Hold" || r.disposition === "Reject" || r.disposition === "Scrap" || r.disposition === "Return" ? "stuck" : "amber"}>{r.disposition}</Pill></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function Quality({ view, readOnly = false }) {
  if (view === "records") return <Records />;
  return <FinalQC readOnly={readOnly} />;
}

Object.assign(window, { Stores, Quality });
