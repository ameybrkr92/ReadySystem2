// Ready Systems ERP — shared store, types, seed data
import { useEffect, useState, useSyncExternalStore } from "react";

export type Role = "Planning" | "Inventory" | "Quality" | "Director";

export const STAGES = [
  "RFQ",
  "Final BOM",
  "Costing",
  "Quote",
  "PO",
  "Purchase Received",
  "Incoming QC",
  "Stores",
  "Build",
  "Final QC",
  "Dispatch",
] as const;
export type Stage = (typeof STAGES)[number];

export type BomSource = "client" | "planner";
export interface BomItem { id: string; description: string; qty: number; unit: "m" | "nos"; rate?: number; source?: BomSource; note?: string }

// Engineering documents attached to a work order (schematics, layout boards, GA drawings)
export type DocKind = "Schematic" | "Layout board" | "GA drawing" | "Datasheet" | "Other";
export const DOC_KINDS: DocKind[] = ["Schematic", "Layout board", "GA drawing", "Datasheet", "Other"];
export const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB inline cap for the prototype
export interface OrderDoc {
  id: string; name: string; kind: DocKind; size: number; mime: string;
  dataUrl?: string;        // inline copy for preview/download in the prototype
  rev?: string;            // drawing revision, e.g. "Rev C"
  uploadedAt: string; uploadedBy?: string;
}
export interface Order {
  id: string;
  woNo: string;
  client: string;
  project?: string;
  product: "8DJHST" | "8FB20";
  config: string;
  motorised: boolean;
  qty: number;
  poDate?: string;       // ISO
  dueDate?: string;
  bomSentDate?: string;
  costingSentDate?: string;
  dispatchedDate?: string;
  stage: Stage;
  stuck?: { reason: string } | null;
  bom: BomItem[];
  docs?: OrderDoc[];
  quote?: { subtotal: number; labour: number; wastagePct: number; marginPct: number; total: number; createdAt: string };
}
export interface PO {
  id: string; poNo: string; supplier: string; woNo: string;
  items: { description: string; qty: number; unit: "m" | "nos"; rate: number }[];
  status: "Ordered" | "Partially Received" | "Received";
  createdAt: string;
}
export interface SupplierBid {
  supplier: string;
  rates: number[];          // indexed by SupplierRFQ.items
  leadTimeDays?: number;
  validityDays?: number;
  notes?: string;
  submitted: boolean;
}
export interface SupplierRFQ {
  id: string;
  rfqNo: string;
  woNo: string;
  createdAt: string;
  items: { description: string; qty: number; unit: "m" | "nos" }[];
  bids: SupplierBid[];
  status: "Open" | "Awarded";
  awardedSupplier?: string;
}
export interface InwardEntry {
  id: string; date: string; grnNo: string; poNo: string; lotNo: string; lrNo: string;
  partyName: string; itemDescription: string; challanNo: string;
  qty: number; coils?: number; unit: "m" | "nos"; rate: number; woNo?: string;
  qcStatus: "Pending" | "Accepted" | "Rejected" | "Rework";
}
export interface StockRow { description: string; unit: "m" | "nos"; onHand: number; coils?: number }
export interface Issue { id: string; date: string; woNo: string; itemDescription: string; qty: number; unit: "m" | "nos" }
export interface QCRecord {
  id: string; kind: "Incoming" | "Final"; refId: string; refLabel: string;
  plan?: string; checkedBy: string; date: string;
  rows: { parameter: string; spec: string; method: string; frequency: string; observation: string }[];
  disposition: "Accept" | "Rework" | "Scrap" | "Return" | "Pass" | "Hold";
  notes?: string;
}
export interface FinalQCJob { id: string; woNo: string; status: "Pending" | "Pass" | "Hold"; createdAt: string }
export interface Activity { id: string; ts: string; role: Role; text: string; level?: "info" | "warn" | "alert" }

export interface State {
  orders: Order[];
  pos: PO[];
  supplierRfqs: SupplierRFQ[];
  inwards: InwardEntry[];
  stock: StockRow[];
  issues: Issue[];
  qcRecords: QCRecord[];
  finalQcJobs: FinalQCJob[];
  activity: Activity[];
  materialRates: { description: string; rate: number; unit: "m" | "nos" }[];
  suppliers: string[];
}

const KEY = "ready-systems-erp-v4";
const SESSION_KEY = "ready-systems-session-v3";

const uid = () => Math.random().toString(36).slice(2, 10);
export const nowISO = () => new Date().toISOString();

// Planner template — common consumables / hardware NOT in client BOM
export const PLANNER_TEMPLATE: Omit<BomItem, "id">[] = [
  { description: "Snap-on Terminal", qty: 80, unit: "nos", rate: 1.68, source: "planner", note: "Per feeder count" },
  { description: "Ring Lug 2.5sqmm", qty: 40, unit: "nos", rate: 3.20, source: "planner", note: "Termination hardware" },
  { description: "PVC Sleeve 16mm Black", qty: 12, unit: "m", rate: 14.63, source: "planner", note: "Dressing" },
  { description: "Heat-shrink 6mm", qty: 4, unit: "m", rate: 22.0, source: "planner", note: "Joint protection" },
  { description: "Cable Tie 200mm", qty: 25, unit: "nos", rate: 1.10, source: "planner", note: "Loom dressing" },
  { description: "Ferrule (printed)", qty: 60, unit: "nos", rate: 0.85, source: "planner", note: "Wire ID" },
];

function seedBom(config: string): BomItem[] {
  const client: BomItem[] = [
    { id: uid(), description: "PVC Insu HV 2.5sqmm Red", qty: 45, unit: "m", rate: 29.62, source: "client" },
    { id: uid(), description: "PVC Insu HV 2.5sqmm Black", qty: 45, unit: "m", rate: 29.62, source: "client" },
    { id: uid(), description: "PVC Insu HV 2.5sqmm Blue", qty: 45, unit: "m", rate: 29.62, source: "client" },
    { id: uid(), description: "PVC Insu HV 1.5sqmm Grey", qty: 30, unit: "m", rate: 18.03, source: "client" },
  ];
  const planner: BomItem[] = PLANNER_TEMPLATE.map(t => ({ id: uid(), ...t }));
  if (config.includes("ME")) client.push({ id: uid(), description: "Metering Harness Loom", qty: 1, unit: "nos", rate: 1850, source: "client" });
  return [...client, ...planner];
}

function seed(): State {
  const today = new Date();
  const iso = (d: Date) => d.toISOString();
  const days = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };

  // Anonymised clients/projects (no signed NDAs yet)
  const orders: Order[] = [
    { id: uid(), woNo: "RS-WO-24-0011", client: "Client A", project: "Project Alpha — MV switchgear Q4", product: "8DJHST", config: "RRL", motorised: false, qty: 4, poDate: days(-20), dueDate: days(15), bomSentDate: days(-18), costingSentDate: days(-16), stage: "Build", docs: [
      { id: uid(), name: "8DJHST-RRL-schematic.pdf", kind: "Schematic", size: 486000, mime: "application/pdf", rev: "Rev C", uploadedAt: days(-18), uploadedBy: "Planning" },
      { id: uid(), name: "layout-board-8DJHST.pdf", kind: "Layout board", size: 1240000, mime: "application/pdf", rev: "Rev B", uploadedAt: days(-18), uploadedBy: "Planning" },
    ], bom: seedBom("RRL") },
    { id: uid(), woNo: "RS-WO-24-0012", client: "Client B", project: "Project Bravo — Substation 7", product: "8DJHST", config: "ME+LRRL-", motorised: true, qty: 2, poDate: days(-25), dueDate: days(5), bomSentDate: days(-22), costingSentDate: days(-20), stage: "PO", stuck: { reason: "Material short — supplier PO pending" }, bom: seedBom("ME+LRRL-") },
    { id: uid(), woNo: "RS-WO-24-0013", client: "Client C", project: "Project Charlie — LOT 3", product: "8DJHST", config: "RRL+ME", motorised: false, qty: 3, poDate: days(-10), dueDate: days(25), bomSentDate: days(-8), stage: "Costing", docs: [
      { id: uid(), name: "RRL-ME-schematic.pdf", kind: "Schematic", size: 512000, mime: "application/pdf", rev: "Rev A", uploadedAt: days(-8), uploadedBy: "Planning" },
    ], bom: seedBom("RRL+ME") },
    { id: uid(), woNo: "RS-WO-24-0014", client: "Client D", project: "Project Delta — Maintenance", product: "8DJHST", config: "LRRL+ME", motorised: true, qty: 1, poDate: days(-35), dueDate: days(-2), bomSentDate: days(-33), costingSentDate: days(-30), stage: "Final QC", stuck: { reason: "Final QC HOLD — continuity fail on feeder 2" }, bom: seedBom("LRRL+ME") },
    { id: uid(), woNo: "RS-WO-24-0015", client: "Client E", project: "Project Echo — Phase 4", product: "8DJHST", config: "RRRL", motorised: false, qty: 6, poDate: days(-60), dueDate: days(-10), bomSentDate: days(-58), costingSentDate: days(-55), dispatchedDate: days(-3), stage: "Dispatch", bom: seedBom("RRRL") },
    { id: uid(), woNo: "RS-WO-24-0016", client: "Client F", project: "Project Foxtrot — Phase 2", product: "8FB20", config: "RRL+ME", motorised: true, qty: 2, poDate: days(-5), dueDate: days(40), stage: "Final BOM", bom: seedBom("RRL+ME") },
    { id: uid(), woNo: "RS-WO-24-0017", client: "Client G", project: "Project Golf — DT", product: "8FB20", config: "RRL", motorised: false, qty: 4, poDate: days(-12), dueDate: days(20), bomSentDate: days(-10), costingSentDate: days(-7), stage: "Quote", bom: seedBom("RRL") },
    { id: uid(), woNo: "RS-WO-24-0018", client: "Client H", project: "Project Hotel — Cabinets", product: "8FB20", config: "RRL", motorised: false, qty: 8, poDate: days(-8), dueDate: days(30), bomSentDate: days(-5), stage: "Costing", bom: seedBom("RRL") },
    { id: uid(), woNo: "RS-WO-24-0019", client: "Client H", project: "Project Hotel — Cabinets", product: "8FB20", config: "RRL+ME", motorised: false, qty: 4, poDate: days(-8), dueDate: days(35), stage: "Final BOM", bom: seedBom("RRL+ME") },
  ];

  const stock: StockRow[] = [
    { description: "PVC Insu HV 2.5sqmm Red", unit: "m", onHand: 1240, coils: 6 },
    { description: "PVC Insu HV 2.5sqmm Black", unit: "m", onHand: 980, coils: 5 },
    { description: "PVC Insu HV 2.5sqmm Blue", unit: "m", onHand: 1100, coils: 6 },
    { description: "PVC Insu HV 1.5sqmm Grey", unit: "m", onHand: 320, coils: 2 },
    { description: "PVC Sleeve 16mm Black", unit: "m", onHand: 90, coils: 1 },
    { description: "Heat-shrink 6mm", unit: "m", onHand: 140, coils: 1 },
    { description: "Snap-on Terminal", unit: "nos", onHand: 1850 },
    { description: "Ring Lug 2.5sqmm", unit: "nos", onHand: 920 },
    { description: "Cable Tie 200mm", unit: "nos", onHand: 4200 },
    { description: "Ferrule (printed)", unit: "nos", onHand: 2750 },
    { description: "Metering Harness Loom", unit: "nos", onHand: 4 },
  ];

  const inwards: InwardEntry[] = [
    { id: uid(), date: days(-1), grnNo: "GRN-0112", poNo: "PO-2401", lotNo: "L-9981", lrNo: "LR-4421", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 2.5sqmm Red", challanNo: "CH/24/991", qty: 500, coils: 3, unit: "m", rate: 29.62, qcStatus: "Pending", woNo: "RS-WO-24-0011" },
    { id: uid(), date: days(-2), grnNo: "GRN-0111", poNo: "PO-2401", lotNo: "L-9978", lrNo: "LR-4418", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 2.5sqmm Black", challanNo: "CH/24/990", qty: 500, coils: 3, unit: "m", rate: 29.62, qcStatus: "Accepted", woNo: "RS-WO-24-0011" },
    { id: uid(), date: days(-3), grnNo: "GRN-0110", poNo: "PO-2400", lotNo: "L-9970", lrNo: "LR-4410", partyName: "Terminal Technologies", itemDescription: "Snap-on Terminal", challanNo: "TT/24/220", qty: 1000, unit: "nos", rate: 1.68, qcStatus: "Accepted", woNo: "RS-WO-24-0013" },
    { id: uid(), date: days(-4), grnNo: "GRN-0109", poNo: "PO-2399", lotNo: "L-9961", lrNo: "LR-4402", partyName: "Aviza Technologies", itemDescription: "PVC Sleeve 16mm Black", challanNo: "AV/24/118", qty: 200, coils: 1, unit: "m", rate: 14.63, qcStatus: "Rework", woNo: "RS-WO-24-0013" },
    { id: uid(), date: days(-5), grnNo: "GRN-0108", poNo: "PO-2398", lotNo: "L-9955", lrNo: "LR-4395", partyName: "NPS Engineers", itemDescription: "Ring Lug 2.5sqmm", challanNo: "NPS/24/077", qty: 500, unit: "nos", rate: 3.20, qcStatus: "Rejected", woNo: "RS-WO-24-0014" },
    { id: uid(), date: days(-6), grnNo: "GRN-0107", poNo: "PO-2397", lotNo: "L-9942", lrNo: "LR-4380", partyName: "RR Kabel Limited", itemDescription: "PVC Insu HV 1.5sqmm Grey", challanNo: "CH/24/981", qty: 300, coils: 2, unit: "m", rate: 18.03, qcStatus: "Accepted", woNo: "RS-WO-24-0015" },
  ];

  const issues: Issue[] = [
    { id: uid(), date: days(-1), woNo: "RS-WO-24-0011", itemDescription: "PVC Insu HV 2.5sqmm Red", qty: 180, unit: "m" },
    { id: uid(), date: days(-2), woNo: "RS-WO-24-0013", itemDescription: "Snap-on Terminal", qty: 320, unit: "nos" },
    { id: uid(), date: days(-3), woNo: "RS-WO-24-0011", itemDescription: "Ring Lug 2.5sqmm", qty: 160, unit: "nos" },
  ];

  const qcRecords: QCRecord[] = [
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
    { id: uid(), kind: "Incoming", refId: "i3", refLabel: "GRN-0108 · Ring Lug 2.5sqmm", plan: "QA-IQP-011 Rev 9", checkedBy: "Sunil Yadav", date: days(-5),
      rows: [
        { parameter: "Type / make", spec: "Per spec", method: "Visual", frequency: "100%", observation: "Wrong barrel size" },
        { parameter: "Size", spec: "2.5 sqmm", method: "Vernier", frequency: "1/lot", observation: "3.0 sqmm" },
        { parameter: "Surface finish", spec: "Tin plated", method: "Visual", frequency: "100%", observation: "OK" },
        { parameter: "Markings / label", spec: "Per PO", method: "Visual", frequency: "100%", observation: "OK" },
      ], disposition: "Return", notes: "Wrong barrel — return to supplier" },
    { id: uid(), kind: "Final", refId: "RS-WO-24-0015", refLabel: "Final assembly · RS-WO-24-0015", checkedBy: "Meera Joshi", date: days(-4),
      rows: [
        { parameter: "Continuity — all feeders", spec: "0 Ω", method: "Tester", frequency: "100%", observation: "Pass" },
        { parameter: "Connector seating", spec: "Click", method: "Tactile", frequency: "100%", observation: "Pass" },
        { parameter: "Visual / dress", spec: "Clean", method: "Visual", frequency: "100%", observation: "Pass" },
        { parameter: "Label / marking", spec: "Per drawing", method: "Visual", frequency: "100%", observation: "Pass" },
      ], disposition: "Pass" },
  ];

  const activity: Activity[] = [
    { id: uid(), ts: days(-1), role: "Inventory", text: "GRN-0112 received — RR Kabel, 2.5sqmm Red 500m" },
    { id: uid(), ts: days(-1), role: "Quality", text: "Final QC HOLD on RS-WO-24-0014", level: "alert" },
    { id: uid(), ts: days(-2), role: "Planning", text: "PO pending — delaying RS-WO-24-0012", level: "warn" },
    { id: uid(), ts: days(-3), role: "Planning", text: "Quote sent for RS-WO-24-0017" },
    { id: uid(), ts: days(-5), role: "Inventory", text: "Ring Lug lot RETURNED — wrong barrel size", level: "warn" },
  ];

  const supplierRfqs: SupplierRFQ[] = [
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

  return {
    orders,
    pos: [
      { id: uid(), poNo: "PO-2401", supplier: "RR Kabel Limited", woNo: "RS-WO-24-0011", items: [{ description: "PVC Insu HV 2.5sqmm Red", qty: 500, unit: "m", rate: 29.62 }, { description: "PVC Insu HV 2.5sqmm Black", qty: 500, unit: "m", rate: 29.62 }], status: "Received", createdAt: days(-15) },
      { id: uid(), poNo: "PO-2402", supplier: "NPS Engineers", woNo: "RS-WO-24-0012", items: [{ description: "Metering Harness Loom", qty: 2, unit: "nos", rate: 1850 }], status: "Ordered", createdAt: days(-6) },
      { id: uid(), poNo: "PO-2403", supplier: "Terminal Technologies", woNo: "RS-WO-24-0011", items: [{ description: "Snap-on Terminal", qty: 500, unit: "nos", rate: 1.68 }], status: "Ordered", createdAt: days(-4) },
    ],
    supplierRfqs,
    inwards,
    stock,
    issues,
    qcRecords,
    finalQcJobs: [
      { id: uid(), woNo: "RS-WO-24-0014", status: "Hold", createdAt: days(-2) },
      { id: uid(), woNo: "RS-WO-24-0015", status: "Pass", createdAt: days(-4) },
    ],
    activity,
    materialRates: [
      { description: "PVC Insu HV 1.5sqmm Grey", rate: 18.03, unit: "m" },
      { description: "PVC Insu HV 2.5sqmm Grey", rate: 29.62, unit: "m" },
      { description: "PVC Insu HV 2.5sqmm Red", rate: 29.62, unit: "m" },
      { description: "PVC Insu HV 2.5sqmm Black", rate: 29.62, unit: "m" },
      { description: "PVC Insu HV 2.5sqmm Blue", rate: 29.62, unit: "m" },
      { description: "PVC Sleeve 16mm Black", rate: 14.63, unit: "m" },
      { description: "Heat-shrink 6mm", rate: 22.0, unit: "m" },
      { description: "Snap-on Terminal", rate: 1.68, unit: "nos" },
      { description: "Ring Lug 2.5sqmm", rate: 3.20, unit: "nos" },
      { description: "Cable Tie 200mm", rate: 1.10, unit: "nos" },
      { description: "Ferrule (printed)", rate: 0.85, unit: "nos" },
      { description: "Metering Harness Loom", rate: 1850, unit: "nos" },
    ],
    suppliers: ["NPS Engineers", "Aviza Technologies", "RR Kabel Limited", "Terminal Technologies"],
  };
}

// ---- Subscribable store ----
let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw);
  } catch { return seed(); }
}
function persist() {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach(l => l());
}
export function setState(updater: (s: State) => State) {
  state = updater(structuredClone(state));
  persist();
}
export function getState(): State { return state; }
export function resetDemo() { state = seed(); persist(); }

function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

// ---- Session ----
export interface Session { name: string; role: Role }
export function useSession(): [Session | null, (s: Session | null) => void] {
  const [s, setS] = useState<Session | null>(null);
  useEffect(() => {
    try { const raw = localStorage.getItem(SESSION_KEY); if (raw) setS(JSON.parse(raw)); } catch {}
  }, []);
  const update = (v: Session | null) => {
    setS(v);
    if (typeof window !== "undefined") {
      if (v) localStorage.setItem(SESSION_KEY, JSON.stringify(v));
      else localStorage.removeItem(SESSION_KEY);
    }
  };
  return [s, update];
}

// ---- Activity logger ----
export function logActivity(role: Role, text: string, level?: Activity["level"]) {
  setState(s => {
    s.activity.unshift({ id: uid(), ts: nowISO(), role, text, level });
    s.activity = s.activity.slice(0, 80);
    return s;
  });
}

// ---- Mutations ----
export function advanceOrder(woNo: string, to: Stage, clearStuck = true) {
  setState(s => {
    const o = s.orders.find(o => o.woNo === woNo);
    if (o) { o.stage = to; if (clearStuck) o.stuck = null; }
    return s;
  });
}

export function addOrderDoc(orderId: string, doc: OrderDoc) {
  setState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o) { o.docs = o.docs ?? []; o.docs.unshift(doc); }
    return s;
  });
}

export function removeOrderDoc(orderId: string, docId: string) {
  setState(s => {
    const o = s.orders.find(x => x.id === orderId);
    if (o && o.docs) o.docs = o.docs.filter(d => d.id !== docId);
    return s;
  });
}

export function addToStock(description: string, unit: "m" | "nos", qty: number, coils?: number) {
  setState(s => {
    const row = s.stock.find(r => r.description === description && r.unit === unit);
    if (row) { row.onHand += qty; if (coils && row.coils != null) row.coils += coils; }
    else s.stock.push({ description, unit, onHand: qty, coils });
    return s;
  });
}

export function newId() { return uid(); }
export { uid };
