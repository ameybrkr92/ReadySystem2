// Ready Systems ERP — shared store, costing engine, seed data, helpers
const { useEffect, useState, useSyncExternalStore } = React;

const STAGES = [
  "RFQ", "Final BOM", "Costing", "Quote", "Approved", "PO",
  "Incoming QC", "Stores", "Build", "Final QC", "Dispatch",
];

const KEY = "ready-systems-erp-v8";
const SESSION_KEY = "ready-systems-session-v3";

const DOC_KINDS = ["Schematic", "Layout board", "GA drawing", "Datasheet", "Other"];
const MAX_DOC_BYTES = 8 * 1024 * 1024;

const uid = () => Math.random().toString(36).slice(2, 10);
const nowISO = () => new Date().toISOString();

// ===================================================================
// MATERIAL MASTER — rates + sourcing + STOCKING POLICY (Phase-1)
//   preferredSupplier / soleSource  → drive the RFQ-vs-direct-PO decision
//   stocked                          → high-runner consumable held to a min/max
//                                      reorder level (bought to replenish stock,
//                                      NOT against any one job)
//   reorderPoint / reorderTo         → min/max for replenishment buys
//   leadDays                         → supplier lead time (drives PO ETA / expediting)
//   stocked:false                    → buy-to-order item (e.g. made-to-order loom):
//                                      not held, bought per job
// ===================================================================
const MATERIAL_RATES = [
  { description: "PVC Insu HV 2.5sqmm Red", rate: 29.62, unit: "m", preferredSupplier: "RR Kabel Limited", soleSource: false, stocked: true, reorderPoint: 600, reorderTo: 1600, leadDays: 7 },
  { description: "PVC Insu HV 2.5sqmm Black", rate: 29.62, unit: "m", preferredSupplier: "RR Kabel Limited", soleSource: false, stocked: true, reorderPoint: 600, reorderTo: 1600, leadDays: 7 },
  { description: "PVC Insu HV 2.5sqmm Blue", rate: 29.62, unit: "m", preferredSupplier: "RR Kabel Limited", soleSource: false, stocked: true, reorderPoint: 600, reorderTo: 1600, leadDays: 7 },
  { description: "PVC Insu HV 1.5sqmm Grey", rate: 18.03, unit: "m", preferredSupplier: "RR Kabel Limited", soleSource: false, stocked: true, reorderPoint: 400, reorderTo: 1200, leadDays: 7 },
  { description: "PVC Sleeve 16mm Black", rate: 14.63, unit: "m", preferredSupplier: "Aviza Technologies", soleSource: false, stocked: true, reorderPoint: 150, reorderTo: 500, leadDays: 10 },
  { description: "Heat-shrink 6mm", rate: 22.0, unit: "m", preferredSupplier: "Aviza Technologies", soleSource: false, stocked: true, reorderPoint: 120, reorderTo: 400, leadDays: 10 },
  { description: "Snap-on Terminal", rate: 1.68, unit: "nos", preferredSupplier: "Terminal Technologies", soleSource: true, stocked: true, reorderPoint: 800, reorderTo: 3000, leadDays: 14 },
  { description: "Ring Lug 2.5sqmm", rate: 3.20, unit: "nos", preferredSupplier: "NPS Engineers", soleSource: false, stocked: true, reorderPoint: 500, reorderTo: 2000, leadDays: 7 },
  { description: "Cable Tie 200mm", rate: 1.10, unit: "nos", preferredSupplier: "Aviza Technologies", soleSource: false, stocked: true, reorderPoint: 2000, reorderTo: 6000, leadDays: 5 },
  { description: "Ferrule (printed)", rate: 0.85, unit: "nos", preferredSupplier: "NPS Engineers", soleSource: false, stocked: true, reorderPoint: 1500, reorderTo: 4000, leadDays: 5 },
  { description: "Metering Harness Loom", rate: 1850, unit: "nos", preferredSupplier: "NPS Engineers", soleSource: true, stocked: false, leadDays: 21 },
];
const rateOf = (description) => (MATERIAL_RATES.find(r => r.description === description) || {}).rate ?? 0;
const materialMeta = (description) => MATERIAL_RATES.find(r => r.description === description) || {};

// RFQ is the EXCEPTION, not the gate. Below this shortfall value, or for
// sole-source material, we skip quoting and raise a direct PO to the
// preferred supplier. Above it AND multi-source → recommend getting quotes.
const RFQ_THRESHOLD = 25000;

// ===================================================================
// THE COSTING ENGINE — Siemens config  →  harness BOM  →  cost
//   Feeder library: each feeder type maps to a harness set + build time.
//   This is the POC "crown jewel": parse the config, assemble the BOM.
// ===================================================================
const LABOUR_RATE_PER_MIN = 6;   // ₹/min  (~₹360/hr shop rate)

// per single unit (one panel) — wires in m, hardware in nos, build in minutes
const BASE_HARNESS = {
  name: "Base panel harness",
  buildMin: 25,
  lines: [
    { description: "PVC Sleeve 16mm Black", qty: 3, unit: "m" },
    { description: "Heat-shrink 6mm", qty: 1.5, unit: "m" },
    { description: "Cable Tie 200mm", qty: 20, unit: "nos" },
    { description: "Ferrule (printed)", qty: 10, unit: "nos" },
  ],
};

const FEEDER_LIBRARY = {
  R: { code: "R", name: "Ring-main feeder", desc: "Load-break switch, ring in/out", buildMin: 35, lines: [
    { description: "PVC Insu HV 2.5sqmm Red", qty: 5, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Black", qty: 5, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Blue", qty: 5, unit: "m" },
    { description: "Ring Lug 2.5sqmm", qty: 6, unit: "nos" },
    { description: "Snap-on Terminal", qty: 9, unit: "nos" },
    { description: "Ferrule (printed)", qty: 9, unit: "nos" },
  ]},
  L: { code: "L", name: "Circuit-breaker feeder", desc: "VCB feeder with control wiring", buildMin: 55, lines: [
    { description: "PVC Insu HV 2.5sqmm Red", qty: 6, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Black", qty: 6, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Blue", qty: 6, unit: "m" },
    { description: "PVC Insu HV 1.5sqmm Grey", qty: 8, unit: "m" },
    { description: "Ring Lug 2.5sqmm", qty: 8, unit: "nos" },
    { description: "Snap-on Terminal", qty: 14, unit: "nos" },
    { description: "Ferrule (printed)", qty: 16, unit: "nos" },
  ]},
  T: { code: "T", name: "Transformer feeder", desc: "Switch-fuse / transformer protection", buildMin: 45, lines: [
    { description: "PVC Insu HV 2.5sqmm Red", qty: 5, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Black", qty: 5, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Blue", qty: 5, unit: "m" },
    { description: "PVC Insu HV 1.5sqmm Grey", qty: 5, unit: "m" },
    { description: "Ring Lug 2.5sqmm", qty: 6, unit: "nos" },
    { description: "Snap-on Terminal", qty: 10, unit: "nos" },
    { description: "Ferrule (printed)", qty: 12, unit: "nos" },
  ]},
  K: { code: "K", name: "Cable feeder", desc: "Cable connection compartment", buildMin: 30, lines: [
    { description: "PVC Insu HV 2.5sqmm Red", qty: 4, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Black", qty: 4, unit: "m" },
    { description: "PVC Insu HV 2.5sqmm Blue", qty: 4, unit: "m" },
    { description: "Ring Lug 2.5sqmm", qty: 5, unit: "nos" },
    { description: "Snap-on Terminal", qty: 7, unit: "nos" },
    { description: "Ferrule (printed)", qty: 8, unit: "nos" },
  ]},
  ME: { code: "ME", name: "Metering unit", desc: "CT/PT metering compartment", buildMin: 40, lines: [
    { description: "PVC Insu HV 1.5sqmm Grey", qty: 12, unit: "m" },
    { description: "Metering Harness Loom", qty: 1, unit: "nos" },
    { description: "Ring Lug 2.5sqmm", qty: 4, unit: "nos" },
    { description: "Snap-on Terminal", qty: 12, unit: "nos" },
    { description: "Ferrule (printed)", qty: 14, unit: "nos" },
  ]},
};
const FEEDER_LEGEND = { R: "Ring-main", L: "Circuit-breaker", T: "Transformer", K: "Cable", ME: "Metering" };

// Parse a Siemens config string → ordered list of feeder codes
function parseConfig(config) {
  const feeders = [];
  let s = (config || "").toUpperCase();
  const meCount = (s.match(/ME/g) || []).length;
  s = s.replace(/ME/g, "");
  for (const ch of s.replace(/[^RLTK]/g, "")) feeders.push(ch);
  for (let i = 0; i < meCount; i++) feeders.push("ME");
  return feeders;
}

// Build minutes for the whole order (all units)
function buildMinutes(config, qty = 1) {
  let m = BASE_HARNESS.buildMin;
  for (const f of parseConfig(config)) { const lib = FEEDER_LIBRARY[f]; if (lib) m += lib.buildMin; }
  return m * qty;
}

// THE ENGINE: config + qty → fully-priced harness BOM (aggregated)
function generateHarness(config, qty = 1) {
  const agg = new Map();
  const add = (l) => {
    const k = l.description + "|" + l.unit;
    const e = agg.get(k) || { description: l.description, unit: l.unit, perUnit: 0 };
    e.perUnit += l.qty; agg.set(k, e);
  };
  BASE_HARNESS.lines.forEach(add);
  for (const f of parseConfig(config)) { const lib = FEEDER_LIBRARY[f]; if (lib) lib.lines.forEach(add); }
  return [...agg.values()].map(e => ({
    id: uid(), description: e.description, unit: e.unit,
    qty: +(e.perUnit * qty).toFixed(2), rate: rateOf(e.description), source: "harness",
  }));
}

// Full cost build-up for an order
function computeCosting(order) {
  const c = order.costing || {};
  const wastagePct = c.wastagePct ?? 4;
  const labourRate = c.labourRate ?? LABOUR_RATE_PER_MIN;
  const overheadPct = c.overheadPct ?? 12;
  const marginPct = c.marginPct ?? 18;

  const material = (order.bom || []).reduce((a, b) => a + (b.qty || 0) * (b.rate || 0), 0);
  const wastage = material * (wastagePct / 100);
  const minutes = buildMinutes(order.config, order.qty || 1);
  const labour = minutes * labourRate;
  const overhead = (material + labour) * (overheadPct / 100);
  const cost = material + wastage + labour + overhead;
  const margin = cost * (marginPct / 100);
  const total = cost + margin;
  const perUnit = (order.qty || 1) > 0 ? total / order.qty : total;
  return { wastagePct, labourRate, overheadPct, marginPct, material, wastage, minutes, labour, overhead, cost, margin, total, perUnit };
}

// Procurement status for an order: demand vs stock vs on-order vs received.
// Once a job reaches "Stores" its material has been received & taken in (and is
// consumed from Build onward), so procurement for that job is settled — we never
// recompute a shortfall against current global stock for a built/shipped job,
// which would otherwise show phantom "to order" lines on Dispatched orders.
function procurementForOrder(order, s) {
  const STAGE_LIST = ["RFQ", "Final BOM", "Costing", "Quote", "Approved", "PO", "Incoming QC", "Stores", "Build", "Final QC", "Dispatch"];
  const materialSecured = STAGE_LIST.indexOf(order.stage) >= STAGE_LIST.indexOf("Stores");
  const demand = new Map();
  (order.bom || []).forEach(b => {
    const k = b.description + "|" + b.unit;
    const e = demand.get(k) || { description: b.description, unit: b.unit, required: 0 };
    e.required += (b.qty || 0); demand.set(k, e);
  });
  return [...demand.values()].map(e => {
    const stockRow = s.stock.find(r => r.description === e.description && r.unit === e.unit);
    const inStock = stockRow ? stockRow.onHand : 0;
    let onOrder = 0;
    s.pos.filter(p => p.woNo === order.woNo && p.status !== "Received").forEach(p =>
      p.items.forEach(it => { if (it.description === e.description && it.unit === e.unit) onOrder += it.qty; }));
    let received = 0;
    s.inwards.filter(i => i.woNo === order.woNo && i.itemDescription === e.description).forEach(i => received += i.qty);
    const toOrder = materialSecured ? 0 : Math.max(0, +(e.required - inStock - onOrder).toFixed(2));
    const status = materialSecured ? (received > 0 ? "Received" : "Covered")
      : toOrder > 0 ? "To order" : onOrder > 0 ? "Ordered" : received > 0 ? "Received" : "Covered";
    return { ...e, inStock, onOrder, received, toOrder, status };
  });
}

// RFQ-vs-direct-PO decision for an approved-but-short order.
//   recommendRfq  → value over threshold AND there's a multi-source item worth quoting
//   otherwise     → raise a direct PO to the preferred supplier
// Surfaced as a recommendation in Procurement; the user can always override.
function procurementDecision(order, s) {
  const rows = procurementForOrder(order, s).filter(r => r.toOrder > 0);
  const value = rows.reduce((a, r) => a + r.toOrder * (rateOf(r.description) || 0), 0);
  const sole = rows.filter(r => materialMeta(r.description).soleSource);
  const multi = rows.filter(r => !materialMeta(r.description).soleSource);
  const bySup = {};
  rows.forEach(r => { const sup = materialMeta(r.description).preferredSupplier; if (sup) bySup[sup] = (bySup[sup] || 0) + r.toOrder * (rateOf(r.description) || 0); });
  const preferred = Object.keys(bySup).sort((a, b) => bySup[b] - bySup[a])[0] || ((s.suppliers || [])[0]);
  const recommendRfq = value >= RFQ_THRESHOLD && multi.length > 0;
  let reason;
  if (rows.length === 0) reason = "Nothing to order — stock and open POs cover this job.";
  else if (recommendRfq) reason = `${fmtINR(value)} of multi-source material — above the ${fmtINR(RFQ_THRESHOLD)} quote threshold. Worth comparing suppliers.`;
  else if (multi.length === 0) reason = `${rows.length > 1 ? "All short items are sole-source" : "Sole-source material"} — only ${preferred} supplies it, so quoting adds nothing.`;
  else reason = `${fmtINR(value)} shortfall — below the ${fmtINR(RFQ_THRESHOLD)} quote threshold. Not worth floating an RFQ.`;
  return { rows, value, soleCount: sole.length, multiCount: multi.length, preferred, recommendRfq, reason, threshold: RFQ_THRESHOLD };
}

// ===================================================================
// PROCUREMENT DESK ENGINE — the buyer's cross-job lenses.
// A wire-harness shop buys two different ways and the desk separates them:
//   1. REPLENISHMENT  — high-runner consumables held to a min/max reorder level.
//                       Bought to top stock back up, independent of any one job.
//   2. PROJECT BUYS   — non-stocked / made-to-order items (e.g. metering loom)
//                       bought against the specific job that needs them.
//   3. EXPEDITING     — chase open POs to receipt, ETA vs the job's need-by date.
// ===================================================================
const DAY_MS = 86400000;
const addDaysISO = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + (n || 0)); return d.toISOString(); };
const PRE_STORES = (stage) => ["RFQ", "Final BOM", "Costing", "Quote", "Approved", "PO", "Incoming QC"].includes(stage);

// Gross material demand from jobs that are approved but not yet material-secured.
function liveDemand(s) {
  const m = new Map();
  s.orders.filter(o => o.quote && o.quote.status === "approved" && PRE_STORES(o.stage)).forEach(o => {
    (o.bom || []).forEach(b => {
      const e = m.get(b.description) || { description: b.description, unit: b.unit, required: 0, jobs: [] };
      e.required += (b.qty || 0);
      const j = e.jobs.find(x => x.id === o.id);
      if (j) j.qty += (b.qty || 0); else e.jobs.push({ wo: o.woNo, id: o.id, qty: (b.qty || 0), dueDate: o.dueDate });
      m.set(b.description, e);
    });
  });
  return m;
}
function openPoQty(s, description) {
  let q = 0;
  s.pos.filter(p => p.status !== "Received").forEach(p => p.items.forEach(it => { if (it.description === description) q += it.qty; }));
  return q;
}

// 1. Replenishment plan — stock items vs reorder point, net of committed demand.
//    projected = on hand + on order − demand already committed to live jobs.
//    Below the reorder point → suggest topping up to the max (reorderTo).
function replenishmentPlan(s) {
  const dem = liveDemand(s);
  return (s.materialRates || MATERIAL_RATES).filter(m => m.stocked).map(m => {
    const stk = s.stock.find(r => r.description === m.description);
    const onHand = stk ? stk.onHand : 0;
    const onOrder = openPoQty(s, m.description);
    const committed = (dem.get(m.description) || {}).required || 0;
    const projected = +(onHand + onOrder - committed).toFixed(2);
    const rop = m.reorderPoint || 0;
    const below = projected < rop;
    const suggestQty = below ? Math.max(0, Math.round((m.reorderTo || rop) - projected)) : 0;
    return { description: m.description, unit: m.unit, rate: m.rate, supplier: m.preferredSupplier, soleSource: !!m.soleSource,
      onHand, onOrder, committed, projected, reorderPoint: rop, reorderTo: m.reorderTo, leadDays: m.leadDays || 7, below, suggestQty, value: suggestQty * (m.rate || 0) };
  });
}

// 2. Project buys — non-stocked items a live job needs, grouped by job.
function projectBuys(s) {
  return s.orders.filter(o => o.quote && o.quote.status === "approved" && PRE_STORES(o.stage)).map(o => {
    const rows = procurementForOrder(o, s).filter(r => r.toOrder > 0 && !materialMeta(r.description).stocked);
    if (!rows.length) return null;
    return { order: o, rows, dec: procurementDecision(o, s), value: rows.reduce((a, r) => a + r.toOrder * (rateOf(r.description) || 0), 0) };
  }).filter(Boolean);
}

// 3. Expediting board — open POs to chase, ETA vs the job's need-by date.
function openPoBoard(s) {
  const now = Date.now();
  return s.pos.filter(p => p.status !== "Received").map(p => {
    const maxLead = Math.max(7, ...p.items.map(it => materialMeta(it.description).leadDays || 7));
    const eta = p.etaDate || addDaysISO(p.createdAt, maxLead);
    const order = s.orders.find(o => o.woNo === p.woNo);
    const needBy = order ? order.dueDate : null;
    const etaMs = new Date(eta).getTime();
    const daysToEta = Math.round((etaMs - now) / DAY_MS);
    const overdue = etaMs < now;
    const lateForJob = needBy ? etaMs > new Date(needBy).getTime() : false;
    const value = p.items.reduce((a, it) => a + it.qty * (it.rate || 0), 0);
    const risk = overdue ? "overdue" : lateForJob ? "at-risk" : daysToEta <= 3 ? "due-soon" : "on-track";
    return { po: p, eta, needBy, daysToEta, overdue, lateForJob, value, risk, supplier: p.supplier, woNo: p.woNo, confirmed: !!p.confirmed, isStock: !order };
  }).sort((a, b) => (b.overdue - a.overdue) || (new Date(a.eta) - new Date(b.eta)));
}

// Raise a stock-replenishment PO (no job — it tops up inventory).
function raiseStockPo(supplier, items) {
  const poNo = "PO-" + (2400 + Math.floor(Math.random() * 600));
  setStoreState(s => {
    s.pos.unshift({ id: uid(), poNo, supplier, woNo: "STOCK", kind: "Replenishment", status: "Ordered", createdAt: nowISO(), items: items.map(i => ({ description: i.description, qty: i.qty, unit: i.unit, rate: i.rate })) });
    return s;
  });
  logActivity("Planning", `${poNo} raised to ${supplier} — stock replenishment (${items.length} item${items.length > 1 ? "s" : ""})`);
  if (window.toast) window.toast("Replenishment PO raised");
  return poNo;
}
function setPoConfirmed(poId, confirmed) {
  setStoreState(s => { const p = s.pos.find(x => x.id === poId); if (p) p.confirmed = confirmed; return s; });
}

// Supplier scorecard — reliability from the Quality module's own records.
//   reject %  from incoming-QC dispositions on goods inward (rework + reject)
//   OTD %     from on-time GRN deliveries
//   score     composite (60% OTD, 40% quality) → Preferred / Approved / Watch
// One source of truth, consumed by the Procurement desk and bid comparison so
// awards weigh reliability against price — not lowest rupee blind.
function supplierScorecard(s) {
  const sup = {};
  const ensure = (name) => sup[name] || (sup[name] = { supplier: name, lots: 0, accepted: 0, rework: 0, rejected: 0, deliveries: 0, onTimeCount: 0 });
  (s.inwards || []).forEach(i => {
    const e = ensure(i.partyName);
    e.deliveries++;
    if (i.onTime !== false) e.onTimeCount++;
    if (i.qcStatus && i.qcStatus !== "Pending") {
      e.lots++;
      if (i.qcStatus === "Accepted") e.accepted++;
      else if (i.qcStatus === "Rework") e.rework++;
      else if (i.qcStatus === "Rejected") e.rejected++;
    }
  });
  const out = {};
  Object.values(sup).forEach(e => {
    const rejPct = e.lots ? Math.round(((e.rework + e.rejected) / e.lots) * 100) : null;
    const otdPct = e.deliveries ? Math.round((e.onTimeCount / e.deliveries) * 100) : null;
    const hasData = e.lots > 0 || e.deliveries > 0;
    const score = hasData ? Math.round(0.6 * (otdPct == null ? 100 : otdPct) + 0.4 * (100 - (rejPct == null ? 0 : rejPct))) : null;
    const rating = score == null ? "No data" : score >= 90 ? "Preferred" : score >= 75 ? "Approved" : "Watch";
    out[e.supplier] = { ...e, rejPct, otdPct, score, rating };
  });
  return out;
}

// ===================================================================
// INVOICE — 3-way match + MSME payment clock. Closes the loop to PAY.
//   3-way match: invoice line price vs PO rate, invoice qty vs GRN-accepted qty.
//   Duplicate:   same supplier + invoice number seen more than once.
//   MSME clock:  45 days from acceptance (MSMED Act §15); we flag at 38 ("due soon").
// ===================================================================
const MSME_DAYS = 45, MSME_WARN_DAYS = 38;
function invoiceMatch(inv, s) {
  const po = s.pos.find(p => p.poNo === inv.poNo);
  const grn = (s.inwards || []).find(g => g.grnNo === inv.grnNo);
  const issues = [];
  // duplicate detection
  const dupes = (s.invoices || []).filter(x => x.supplier === inv.supplier && x.invNo === inv.invNo);
  const isDuplicate = dupes.length > 1 && dupes[0].id !== inv.id;
  if (isDuplicate) issues.push({ kind: "duplicate", text: `Duplicate of ${inv.invNo} already on file` });
  // price + qty match, line by line
  (inv.lines || []).forEach(l => {
    const poItem = po && po.items.find(it => it.description === l.description);
    if (!po) issues.push({ kind: "po", text: "No matching PO" });
    else if (!poItem) issues.push({ kind: "price", text: `${l.description}: not on PO` });
    else if (Math.abs((poItem.rate || 0) - l.rate) > 0.001) issues.push({ kind: "price", text: `${l.description}: billed ₹${l.rate} vs PO ₹${poItem.rate}` });
    if (grn && grn.itemDescription === l.description && grn.qty != null && l.qty > grn.qty)
      issues.push({ kind: "qty", text: `${l.description}: billed ${l.qty} vs received ${grn.qty}` });
  });
  const matched = issues.length === 0;
  // MSME clock from acceptance (use GRN date as proxy for acceptance)
  let due = null, daysLeft = null, msmeRisk = null;
  if (inv.msme && inv.payStatus !== "Paid") {
    const base = grn ? grn.date : inv.date;
    due = addDaysISO(base, MSME_DAYS);
    daysLeft = Math.round((new Date(due).getTime() - Date.now()) / DAY_MS);
    msmeRisk = daysLeft < 0 ? "overdue" : daysLeft <= (MSME_DAYS - MSME_WARN_DAYS) ? "due-soon" : "ok";
  }
  return { po, grn, issues, matched, isDuplicate, due, daysLeft, msmeRisk };
}
function setInvoicePay(invId, payStatus) {
  setStoreState(s => { const i = (s.invoices || []).find(x => x.id === invId); if (i) { i.payStatus = payStatus; if (payStatus === "Paid") i.paidDate = nowISO(); } return s; });
  logActivity("Planning", `Invoice marked ${payStatus}`);
}

// ===================================================================
// SEED
// ===================================================================
function seedBom(config, qty) { return generateHarness(config, qty); }

function seed() {
  const today = new Date();
  const iso = (d) => d.toISOString();
  const days = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

  const orders = [
    { id: uid(), woNo: "RS-WO-24-0011", client: "Client A", project: "Project Alpha — MV switchgear Q4", product: "8DJHST", config: "RRL", motorised: false, qty: 4, poDate: days(-20), dueDate: days(15), bomSentDate: days(-18), costingSentDate: days(-16), stage: "Build", costing: { marginPct: 18 }, docs: [
      { id: uid(), name: "8DJHST-RRL-schematic.pdf", kind: "Schematic", size: 486000, mime: "application/pdf", rev: "Rev C", uploadedAt: days(-18), uploadedBy: "Planning" },
      { id: uid(), name: "layout-board-8DJHST.pdf", kind: "Layout board", size: 1240000, mime: "application/pdf", rev: "Rev B", uploadedAt: days(-18), uploadedBy: "Planning" },
    ], bom: seedBom("RRL", 4) },
    { id: uid(), woNo: "RS-WO-24-0012", client: "Client B", project: "Project Bravo — Substation 7", product: "8DJHST", config: "LRRL+ME", motorised: true, qty: 2, poDate: days(-25), dueDate: days(5), bomSentDate: days(-22), costingSentDate: days(-20), stage: "Approved", stuck: { reason: "Material short — metering looms not yet on order" }, costing: { marginPct: 20 }, bom: seedBom("LRRL+ME", 2) },
    { id: uid(), woNo: "RS-WO-24-0013", client: "Client C", project: "Project Charlie — LOT 3", product: "8DJHST", config: "RRL+ME", motorised: false, qty: 3, poDate: days(-10), dueDate: days(25), bomSentDate: days(-8), stage: "Costing", docs: [
      { id: uid(), name: "RRL-ME-schematic.pdf", kind: "Schematic", size: 512000, mime: "application/pdf", rev: "Rev A", uploadedAt: days(-8), uploadedBy: "Planning" },
    ], bom: seedBom("RRL+ME", 3) },
    { id: uid(), woNo: "RS-WO-24-0014", client: "Client D", project: "Project Delta — Maintenance", product: "8DJHST", config: "LRRL+ME", motorised: true, qty: 1, poDate: days(-35), dueDate: days(-2), bomSentDate: days(-33), costingSentDate: days(-30), stage: "Final QC", stuck: { reason: "Final QC HOLD — continuity fail on feeder 2" }, bom: seedBom("LRRL+ME", 1) },
    { id: uid(), woNo: "RS-WO-24-0015", client: "Client E", project: "Project Echo — Phase 4", product: "8DJHST", config: "RRRL", motorised: false, qty: 6, poDate: days(-60), dueDate: days(-10), bomSentDate: days(-58), costingSentDate: days(-55), dispatchedDate: days(-3), stage: "Dispatch", bom: seedBom("RRRL", 6) },
    { id: uid(), woNo: "RS-WO-24-0016", client: "Client F", project: "Project Foxtrot — Phase 2", product: "8FB20", config: "RRL+ME", motorised: true, qty: 2, poDate: days(-5), dueDate: days(40), stage: "Final BOM", bom: seedBom("RRL+ME", 2) },
    { id: uid(), woNo: "RS-WO-24-0017", client: "Client G", project: "Project Golf — DT", product: "8FB20", config: "RRL", motorised: false, qty: 4, poDate: days(-12), dueDate: days(20), bomSentDate: days(-10), costingSentDate: days(-7), stage: "Quote", bom: seedBom("RRL", 4) },
    { id: uid(), woNo: "RS-WO-24-0018", client: "Client H", project: "Project Hotel — Cabinets", product: "8FB20", config: "RRL", motorised: false, qty: 8, poDate: days(-8), dueDate: days(30), bomSentDate: days(-5), stage: "Costing", bom: seedBom("RRL", 8) },
    { id: uid(), woNo: "RS-WO-24-0019", client: "Client H", project: "Project Hotel — Cabinets", product: "8FB20", config: "RRL+ME", motorised: false, qty: 4, poDate: days(-8), dueDate: days(35), stage: "Final BOM", bom: seedBom("RRL+ME", 4) },
  ];
  // BOM lock + quote status so the pipeline gates read sensibly
  orders.forEach(o => {
    o.bomRev = 1;
    o.bomLocked = !["RFQ", "Final BOM"].includes(o.stage);
    if (["Quote", "Approved", "PO", "Incoming QC", "Stores", "Build", "Final QC", "Dispatch"].includes(o.stage)) {
      const c = computeCosting(o);
      const status = o.stage === "Quote" ? "sent" : "approved";
      o.quote = { total: c.total, perUnit: c.perUnit, marginPct: c.marginPct, createdAt: o.costingSentDate || days(-10), rev: 1, status, bomRevAtQuote: 1, approvedAt: status === "approved" ? (o.costingSentDate || days(-9)) : undefined };
    }
  });

  const stock = [
    { description: "PVC Insu HV 2.5sqmm Red", unit: "m", onHand: 1240, coils: 6 },
    { description: "PVC Insu HV 2.5sqmm Black", unit: "m", onHand: 980, coils: 5 },
    { description: "PVC Insu HV 2.5sqmm Blue", unit: "m", onHand: 1100, coils: 6 },
    { description: "PVC Insu HV 1.5sqmm Grey", unit: "m", onHand: 320, coils: 2 },
    { description: "PVC Sleeve 16mm Black", unit: "m", onHand: 280, coils: 2 },
    { description: "Heat-shrink 6mm", unit: "m", onHand: 90, coils: 1 },
    { description: "Snap-on Terminal", unit: "nos", onHand: 1850 },
    { description: "Ring Lug 2.5sqmm", unit: "nos", onHand: 920 },
    { description: "Cable Tie 200mm", unit: "nos", onHand: 4200 },
    { description: "Ferrule (printed)", unit: "nos", onHand: 2750 },
    { description: "Metering Harness Loom", unit: "nos", onHand: 0 },
  ];

  const inwards = [
    { id: uid(), date: days(-1), grnNo: "GRN-0112", poNo: "PO-2401", lotNo: "L-9981", lrNo: "LR-4421", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 2.5sqmm Red", challanNo: "CH/24/991", qty: 500, coils: 3, unit: "m", rate: 29.62, qcStatus: "Pending", onTime: true, woNo: "RS-WO-24-0011" },
    { id: uid(), date: days(-2), grnNo: "GRN-0111", poNo: "PO-2401", lotNo: "L-9978", lrNo: "LR-4418", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 2.5sqmm Black", challanNo: "CH/24/990", qty: 500, coils: 3, unit: "m", rate: 29.62, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0011" },
    { id: uid(), date: days(-3), grnNo: "GRN-0110", poNo: "PO-2400", lotNo: "L-9970", lrNo: "LR-4410", partyName: "Terminal Technologies", itemDescription: "Snap-on Terminal", challanNo: "TT/24/220", qty: 1000, unit: "nos", rate: 1.68, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0013" },
    { id: uid(), date: days(-4), grnNo: "GRN-0109", poNo: "PO-2399", lotNo: "L-9961", lrNo: "LR-4402", partyName: "Aviza Technologies", itemDescription: "PVC Sleeve 16mm Black", challanNo: "AV/24/118", qty: 200, coils: 1, unit: "m", rate: 14.63, qcStatus: "Rework", onTime: false, woNo: "RS-WO-24-0013" },
    { id: uid(), date: days(-5), grnNo: "GRN-0108", poNo: "PO-2398", lotNo: "L-9955", lrNo: "LR-4395", partyName: "NPS Engineers", itemDescription: "Ring Lug 2.5sqmm", challanNo: "NPS/24/077", qty: 500, unit: "nos", rate: 3.20, qcStatus: "Rejected", onTime: false, woNo: "RS-WO-24-0014" },
    { id: uid(), date: days(-6), grnNo: "GRN-0107", poNo: "PO-2397", lotNo: "L-9942", lrNo: "LR-4380", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 1.5sqmm Grey", challanNo: "CH/24/981", qty: 300, coils: 2, unit: "m", rate: 18.03, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0015" },
    { id: uid(), date: days(-9), grnNo: "GRN-0106", poNo: "PO-2395", lotNo: "L-9930", lrNo: "LR-4366", partyName: "Aviza Technologies", itemDescription: "Heat-shrink 6mm", challanNo: "AV/24/110", qty: 250, unit: "m", rate: 22.0, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0015" },
    { id: uid(), date: days(-12), grnNo: "GRN-0105", poNo: "PO-2393", lotNo: "L-9921", lrNo: "LR-4351", partyName: "Aviza Technologies", itemDescription: "Cable Tie 200mm", challanNo: "AV/24/104", qty: 4000, unit: "nos", rate: 1.10, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0014" },
    { id: uid(), date: days(-15), grnNo: "GRN-0104", poNo: "PO-2391", lotNo: "L-9910", lrNo: "LR-4338", partyName: "Aviza Technologies", itemDescription: "PVC Sleeve 16mm Black", challanNo: "AV/24/098", qty: 300, coils: 2, unit: "m", rate: 14.63, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0014" },
    { id: uid(), date: days(-11), grnNo: "GRN-0103", poNo: "PO-2390", lotNo: "L-9905", lrNo: "LR-4330", partyName: "NPS Engineers", itemDescription: "Ferrule (printed)", challanNo: "NPS/24/070", qty: 2000, unit: "nos", rate: 0.85, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0015" },
    { id: uid(), date: days(-17), grnNo: "GRN-0102", poNo: "PO-2388", lotNo: "L-9890", lrNo: "LR-4312", partyName: "NPS Engineers", itemDescription: "Ring Lug 2.5sqmm", challanNo: "NPS/24/061", qty: 1000, unit: "nos", rate: 3.20, qcStatus: "Rework", onTime: false, woNo: "RS-WO-24-0014" },
    { id: uid(), date: days(-20), grnNo: "GRN-0101", poNo: "PO-2386", lotNo: "L-9881", lrNo: "LR-4298", partyName: "NPS Engineers", itemDescription: "Ferrule (printed)", challanNo: "NPS/24/052", qty: 3000, unit: "nos", rate: 0.85, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0015" },
    { id: uid(), date: days(-43), grnNo: "GRN-0096", poNo: "PO-2380", lotNo: "L-9852", lrNo: "LR-4260", partyName: "NPS Engineers", itemDescription: "Ferrule (printed)", challanNo: "NPS/24/038", qty: 2500, unit: "nos", rate: 0.85, qcStatus: "Accepted", onTime: true, woNo: "RS-WO-24-0013" },
  ];

  const issues = [
    { id: uid(), date: days(-1), woNo: "RS-WO-24-0011", itemDescription: "PVC Insu HV 2.5sqmm Red", qty: 180, unit: "m" },
    { id: uid(), date: days(-2), woNo: "RS-WO-24-0013", itemDescription: "Snap-on Terminal", qty: 320, unit: "nos" },
    { id: uid(), date: days(-3), woNo: "RS-WO-24-0011", itemDescription: "Ring Lug 2.5sqmm", qty: 160, unit: "nos" },
  ];

  const qcRecords = [
    { id: uid(), kind: "Incoming", refId: "i1", refLabel: "GRN-0111 · PVC Insu HV 2.5sqmm Black", plan: "QA-IQP-011 Rev 9", checkedBy: "Sunil Yadav", date: days(-2),
      rows: [
        { parameter: "Type / make", spec: "RR Kabel HV", method: "Visual", frequency: "100%", observation: "OK" },
        { parameter: "Size", spec: "2.5 sqmm ±5%", method: "Vernier", frequency: "1/lot", observation: "2.48" },
        { parameter: "Surface finish", spec: "No nicks", method: "Visual", frequency: "100%", observation: "OK" },
        { parameter: "Markings / label", spec: "Per PO", method: "Visual", frequency: "100%", observation: "OK" },
      ], disposition: "Accept" },
    { id: uid(), kind: "Incoming", refId: "i2", refLabel: "GRN-0110 · Snap-on Terminal", plan: "QA-IQP-011 Rev 9", checkedBy: "Sunil Yadav", date: days(-3),
      rows: [
        { parameter: "Type / make", spec: "TT brand", method: "Visual", frequency: "100%", observation: "OK" },
        { parameter: "Size", spec: "2.5 sq", method: "Vernier", frequency: "1/lot", observation: "OK" },
        { parameter: "Surface finish", spec: "Tin plated", method: "Visual", frequency: "100%", observation: "OK" },
        { parameter: "Markings / label", spec: "Lot stamped", method: "Visual", frequency: "100%", observation: "OK" },
      ], disposition: "Accept" },
    { id: uid(), kind: "Final", refId: "RS-WO-24-0015", refLabel: "Final assembly · RS-WO-24-0015", checkedBy: "Meera Joshi", date: days(-4),
      rows: [
        { parameter: "Continuity — all feeders", spec: "0 Ω", method: "Tester", frequency: "100%", observation: "Pass" },
        { parameter: "Connector seating", spec: "Click", method: "Tactile", frequency: "100%", observation: "Pass" },
        { parameter: "Visual / dress", spec: "Clean", method: "Visual", frequency: "100%", observation: "Pass" },
        { parameter: "Label / marking", spec: "Per drawing", method: "Visual", frequency: "100%", observation: "Pass" },
      ], disposition: "Pass" },
  ];

  const activity = [
    { id: uid(), ts: days(-1), role: "Inventory", text: "GRN-0112 received — RR Kabel, 2.5sqmm Red 500m" },
    { id: uid(), ts: days(-1), role: "Quality", text: "Final QC HOLD on RS-WO-24-0014", level: "alert" },
    { id: uid(), ts: days(-2), role: "Planning", text: "PO pending — delaying RS-WO-24-0012", level: "warn" },
    { id: uid(), ts: days(-3), role: "Planning", text: "Quote sent for RS-WO-24-0017" },
    { id: uid(), ts: days(-5), role: "Inventory", text: "Ring Lug lot RETURNED — wrong barrel size", level: "warn" },
  ];

  const supplierRfqs = [
    { id: uid(), rfqNo: "SRFQ-24-007", woNo: "RS-WO-24-0013", createdAt: days(-4), status: "Open",
      items: [
        { description: "PVC Insu HV 2.5sqmm Red", qty: 500, unit: "m" },
        { description: "PVC Sleeve 16mm Black", qty: 100, unit: "m" },
      ],
      bids: [
        { supplier: "RR Kabel Limited", rates: [29.62, 14.50], leadTimeDays: 7, validityDays: 15, submitted: true, notes: "EX-works Vadodara" },
        { supplier: "Aviza Technologies", rates: [30.10, 13.95], leadTimeDays: 10, validityDays: 30, submitted: true },
        { supplier: "NPS Engineers", rates: [0, 0], submitted: false, notes: "Awaited" },
      ],
    },
  ];

  // ---- Customer complaints (Quality KPI source) ----
  const complaints = [
    { id: uid(), complaintNo: "CMP-24-004", client: "Client E", woNo: "RS-WO-24-0015", category: "Labelling / marking", severity: "Minor", received: days(-20), responded: days(-19), resolved: days(-16), status: "Resolved", summary: "Ferrule print smudged on two cores — re-printed and re-fitted." },
    { id: uid(), complaintNo: "CMP-24-005", client: "Client D", woNo: "RS-WO-24-0014", category: "Workmanship", severity: "Major", received: days(-12), responded: days(-12), resolved: days(-7), status: "Resolved", summary: "Continuity fail on feeder 2 reported on site — re-terminated, retested OK." },
    { id: uid(), complaintNo: "CMP-24-006", client: "Client E", woNo: "RS-WO-24-0015", category: "Workmanship", severity: "Minor", received: days(-9), responded: days(-8), resolved: days(-5), status: "Resolved", summary: "Loose cable-tie dressing in metering compartment — re-dressed." },
    { id: uid(), complaintNo: "CMP-24-007", client: "Client A", woNo: "RS-WO-24-0011", category: "Documentation", severity: "Minor", received: days(-4), responded: days(-3), resolved: null, status: "Open", summary: "As-built schematic rev not matching delivered panel — under review." },
    { id: uid(), complaintNo: "CMP-24-008", client: "Client C", woNo: "RS-WO-24-0013", category: "Late delivery", severity: "Major", received: days(-2), responded: days(-1), resolved: null, status: "Open", summary: "Partial dispatch slipped two weeks past committed date." },
  ];

  // ---- Audit observations (Quality KPI source) ----
  const auditObservations = [
    { id: uid(), obsNo: "OBS-24-011", source: "ISO 9001 surveillance", area: "Instrument calibration", severity: "Major", raised: days(-30), due: days(-10), closed: days(-12), status: "Closed" },
    { id: uid(), obsNo: "OBS-24-012", source: "Internal audit — Q2", area: "Incoming QC records", severity: "Minor", raised: days(-22), due: days(-2), closed: days(-6), status: "Closed" },
    { id: uid(), obsNo: "OBS-24-013", source: "Internal audit — Q2", area: "Lot traceability", severity: "Minor", raised: days(-22), due: days(8), closed: null, status: "Open" },
    { id: uid(), obsNo: "OBS-24-014", source: "Customer audit — Client B", area: "Final QC tooling control", severity: "Major", raised: days(-9), due: days(-1), closed: null, status: "Open" },
    { id: uid(), obsNo: "OBS-24-015", source: "ISO 9001 surveillance", area: "Document control", severity: "Minor", raised: days(-30), due: days(-15), closed: days(-18), status: "Closed" },
  ];

  // ---- Supplier invoices (Procure-to-Pay: 3-way match + MSME payment clock) ----
  // Linked to a PO; matched against PO price and GRN-accepted qty. MSME suppliers
  // carry a 45-day statutory payment clock from the date of acceptance (MSMED Act).
  const invoices = [
    { id: uid(), invNo: "RRK/INV/24/881", supplier: "RR Kabel Limited", poNo: "PO-2401", grnNo: "GRN-0111", date: days(-2), amount: 14810, msme: false,
      lines: [{ description: "PVC Insu HV 2.5sqmm Black", qty: 500, rate: 29.62 }], status: "Matched", payStatus: "Approved" },
    { id: uid(), invNo: "NPS/24/541", supplier: "NPS Engineers", poNo: "PO-2398", grnNo: "GRN-0108", date: days(-4), amount: 1600, msme: true,
      lines: [{ description: "Ring Lug 2.5sqmm", qty: 500, rate: 3.20 }], status: "Pending", payStatus: "Unpaid" },
    { id: uid(), invNo: "AVZ/24/233", supplier: "Aviza Technologies", poNo: "PO-2393", grnNo: "GRN-0105", date: days(-11), amount: 5060, msme: true,
      lines: [{ description: "Cable Tie 200mm", qty: 4600, rate: 1.10 }], status: "Pending", payStatus: "Unpaid" },
    { id: uid(), invNo: "TT/24/198", supplier: "Terminal Technologies", poNo: "PO-2400", grnNo: "GRN-0110", date: days(-3), amount: 1680, msme: false,
      lines: [{ description: "Snap-on Terminal", qty: 1000, rate: 1.68 }], status: "Matched", payStatus: "Paid", paidDate: days(-1) },
    { id: uid(), invNo: "NPS/24/541", supplier: "NPS Engineers", poNo: "PO-2398", grnNo: "GRN-0108", date: days(-1), amount: 1600, msme: true,
      lines: [{ description: "Ring Lug 2.5sqmm", qty: 500, rate: 3.20 }], status: "Pending", payStatus: "Unpaid" },
    { id: uid(), invNo: "NPS/24/498", supplier: "NPS Engineers", poNo: "PO-2380", grnNo: "GRN-0096", date: days(-41), amount: 2125, msme: true,
      lines: [{ description: "Ferrule (printed)", qty: 2500, rate: 0.85 }], status: "Matched", payStatus: "Approved" },
  ];

  return {
    orders,
    pos: [
      { id: uid(), poNo: "PO-2401", supplier: "RR Kabel Limited", woNo: "RS-WO-24-0011", items: [{ description: "PVC Insu HV 2.5sqmm Red", qty: 500, unit: "m", rate: 29.62 }, { description: "PVC Insu HV 2.5sqmm Black", qty: 500, unit: "m", rate: 29.62 }], status: "Partially Received", createdAt: days(-15) },
      { id: uid(), poNo: "PO-2403", supplier: "Terminal Technologies", woNo: "RS-WO-24-0011", items: [{ description: "Snap-on Terminal", qty: 500, unit: "nos", rate: 1.68 }], status: "Ordered", createdAt: days(-4) },
      { id: uid(), poNo: "PO-2400", supplier: "Terminal Technologies", woNo: "RS-WO-24-0013", items: [{ description: "Snap-on Terminal", qty: 1000, unit: "nos", rate: 1.68 }], status: "Received", createdAt: days(-10) },
      { id: uid(), poNo: "PO-2398", supplier: "NPS Engineers", woNo: "RS-WO-24-0014", items: [{ description: "Ring Lug 2.5sqmm", qty: 500, unit: "nos", rate: 3.20 }], status: "Received", createdAt: days(-12) },
      { id: uid(), poNo: "PO-2393", supplier: "Aviza Technologies", woNo: "RS-WO-24-0014", items: [{ description: "Cable Tie 200mm", qty: 4000, unit: "nos", rate: 1.10 }], status: "Received", createdAt: days(-16) },
      { id: uid(), poNo: "PO-2380", supplier: "NPS Engineers", woNo: "RS-WO-24-0013", items: [{ description: "Ferrule (printed)", qty: 2500, unit: "nos", rate: 0.85 }], status: "Received", createdAt: days(-45) },
    ],
    supplierRfqs,
    inwards, stock, issues, qcRecords,
    finalQcJobs: [
      { id: uid(), woNo: "RS-WO-24-0014", status: "Hold", createdAt: days(-2) },
      { id: uid(), woNo: "RS-WO-24-0015", status: "Pass", createdAt: days(-4) },
    ],
    activity,
    complaints, auditObservations,
    invoices,
    materialRates: MATERIAL_RATES.map(r => ({ ...r })),
    suppliers: ["NPS Engineers", "Aviza Technologies", "RR Kabel Limited", "Terminal Technologies"],
  };
}

// ===================================================================
// Subscribable store
// ===================================================================
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { const s = seed(); localStorage.setItem(KEY, JSON.stringify(s)); return s; }
    const parsed = JSON.parse(raw);
    // Non-destructive migration: backfill any top-level keys added in later
    // versions (e.g. complaints, auditObservations) without wiping user edits.
    const base = seed();
    let patched = false;
    for (const k of Object.keys(base)) if (parsed[k] === undefined) { parsed[k] = base[k]; patched = true; }
    if (patched) localStorage.setItem(KEY, JSON.stringify(parsed));
    return parsed;
  } catch { return seed(); }
}
let state = load();
const listeners = new Set();
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach(l => l());
}
function setStoreState(updater) { state = updater(structuredClone(state)); persist(); }
function getState() { return state; }
function resetDemo() { state = seed(); persist(); }
function subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); }
function useStore(selector) {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ---- Session ----
function useSession() {
  const [s, setS] = useState(null);
  useEffect(() => {
    try { const raw = localStorage.getItem(SESSION_KEY); if (raw) setS(JSON.parse(raw)); } catch {}
  }, []);
  const update = (v) => {
    setS(v);
    if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v));
    else localStorage.removeItem(SESSION_KEY);
  };
  return [s, update];
}

// ---- Global "open this order" signal — lets any module open the workspace ----
let openState = { id: null, tab: "overview" };
const openListeners = new Set();
function openOrder(id, tab = "overview") { openState = { id, tab }; openListeners.forEach(l => l()); }
function closeOrder() { openState = { id: null, tab: openState.tab }; openListeners.forEach(l => l()); }
function useOpenOrder() {
  return useSyncExternalStore(
    (cb) => { openListeners.add(cb); return () => openListeners.delete(cb); },
    () => openState, () => openState
  );
}

// ---- Activity logger ----
function logActivity(role, text, level) {
  setStoreState(s => { s.activity.unshift({ id: uid(), ts: nowISO(), role, text, level }); s.activity = s.activity.slice(0, 80); return s; });
}

// ---- Mutations ----
function advanceOrder(woNo, to, clearStuck = true) {
  setStoreState(s => { const o = s.orders.find(o => o.woNo === woNo); if (o) { o.stage = to; if (clearStuck) o.stuck = null; } return s; });
}
function addToStock(description, unit, qty, coils) {
  setStoreState(s => {
    const row = s.stock.find(r => r.description === description && r.unit === unit);
    if (row) { row.onHand += qty; if (coils && row.coils != null) row.coils += coils; }
    else s.stock.push({ description, unit, onHand: qty, coils });
    return s;
  });
}
function addOrderDoc(orderId, doc) {
  setStoreState(s => { const o = s.orders.find(x => x.id === orderId); if (o) { o.docs = o.docs || []; o.docs.unshift(doc); } return s; });
}
function removeOrderDoc(orderId, docId) {
  setStoreState(s => { const o = s.orders.find(x => x.id === orderId); if (o && o.docs) o.docs = o.docs.filter(d => d.id !== docId); return s; });
}
// Re-run the engine on an order, replacing its harness lines (keeps manual additions)
function regenerateHarness(orderId) {
  setStoreState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o) { const additions = (o.bom || []).filter(b => b.source === "addition"); o.bom = [...generateHarness(o.config, o.qty), ...additions]; }
    return s;
  });
}
function updateOrderCosting(orderId, patch) {
  setStoreState(s => { const o = s.orders.find(x => x.id === orderId); if (o) o.costing = { ...(o.costing || {}), ...patch }; return s; });
}
// Lock the BOM — freezes the lines; nothing downstream can start until this happens
function lockBom(orderId) {
  setStoreState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o) { o.bomLocked = true; o.bomRev = o.bomRev || 1; o.bomSentDate = nowISO(); if (["RFQ", "Final BOM"].includes(o.stage)) o.stage = "Costing"; }
    return s;
  });
}
// Revise a locked BOM — bumps the revision, flags the quote out of date, and VOIDS approval
function reviseBom(orderId) {
  setStoreState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o) {
      o.bomLocked = false;
      o.bomRev = (o.bomRev || 1) + 1;
      if (o.quote && o.quote.status === "approved") { o.quote.status = "sent"; o.quote.approvedAt = undefined; }
      if (!["RFQ", "Final BOM"].includes(o.stage)) o.stage = "Costing";
    }
    return s;
  });
}
function saveQuote(orderId) {
  setStoreState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o) {
      const c = computeCosting(o);
      const prevRev = (o.quote && o.quote.rev) || 0;
      o.quote = { total: c.total, perUnit: c.perUnit, marginPct: c.marginPct, createdAt: nowISO(), rev: prevRev + 1, status: "sent", bomRevAtQuote: o.bomRev || 1 };
      o.costingSentDate = nowISO();
      if (["RFQ", "Final BOM", "Costing"].includes(o.stage)) o.stage = "Quote";
    }
    return s;
  });
}
// Client approves the quote — the gate that opens procurement
function approveQuote(orderId) {
  setStoreState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o && o.quote) { o.quote.status = "approved"; o.quote.approvedAt = nowISO(); if (["Costing", "Quote"].includes(o.stage)) o.stage = "Approved"; }
    return s;
  });
}
// Is a quote out of date because the BOM was revised after it was sent?
function quoteStale(o) { return !!(o.quote && (o.quote.bomRevAtQuote !== (o.bomRev || 1))); }
// Recompute a PO's status from received inwards — the "receipt = inward" rule
function recomputePoStatus(s, poNo) {
  const p = s.pos.find(x => x.poNo === poNo); if (!p) return;
  const recv = (desc) => s.inwards.filter(i => i.poNo === poNo && i.itemDescription === desc).reduce((a, i) => a + i.qty, 0);
  const all = p.items.every(it => recv(it.description) >= it.qty - 0.001);
  const any = p.items.some(it => recv(it.description) > 0);
  p.status = all ? "Received" : any ? "Partially Received" : "Ordered";
}

// ---- Format helpers ----
const fmtINR = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
const fmtINR2 = (n) => "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const todayISO = () => new Date().toISOString();
const toISODate = (s) => { if (!s) return undefined; return new Date(s).toISOString(); };
const isoToInputDate = (iso) => { if (!iso) return ""; return new Date(iso).toISOString().slice(0, 10); };

Object.assign(window, {
  STAGES, uid, nowISO, DOC_KINDS, MAX_DOC_BYTES,
  FEEDER_LIBRARY, FEEDER_LEGEND, BASE_HARNESS, LABOUR_RATE_PER_MIN,
  parseConfig, buildMinutes, generateHarness, computeCosting, procurementForOrder, procurementDecision, rateOf, materialMeta, RFQ_THRESHOLD, MATERIAL_RATES,
  liveDemand, replenishmentPlan, projectBuys, openPoBoard, raiseStockPo, setPoConfirmed, addDaysISO, supplierScorecard,
  invoiceMatch, setInvoicePay, MSME_DAYS,
  setStoreState, getState, resetDemo, useStore, useSession,
  openOrder, closeOrder, useOpenOrder,
  logActivity, advanceOrder, addToStock, addOrderDoc, removeOrderDoc,
  regenerateHarness, updateOrderCosting, saveQuote, recomputePoStatus,
  lockBom, reviseBom, approveQuote, quoteStale,
  fmtINR, fmtINR2, fmtNum, fmtDate, fmtDateTime, todayISO, toISODate, isoToInputDate,
});
