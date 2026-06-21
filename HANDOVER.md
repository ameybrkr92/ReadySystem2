# Ready Systems — Project Handover

> Paste this whole file into a new chat (or say "read HANDOVER.md") to continue work with full context.

## What this is
A **domain-specific operations console** for **panel & wire-harness contract assembly** (Siemens 8DJHST / 8FB20 switchgear). It is a working **POC/prototype**, not production software — all state lives in the browser (localStorage), logins are demo-only, no backend.

**Core pitch:** digitize the shop *first*, add intelligence *later*. Four modules connected by one Work Order ID. The "crown jewel" is the **costing engine**: parse a Siemens config code (e.g. `RRL+ME`) → assemble a harness BOM → price it → quote.

## How to run / edit
- **Live app:** `Ready Systems Console.html` — loads all `js/*.jsx` via Babel (in-browser JSX). This is the file to open and demo.
- The app is plain React + Babel `<script type="text/babel">`, **not** the Vite build. Each module is a separate `.jsx` in `js/` that attaches its component to `window` at the end.
- `src/` and `vite-app/` are a **parallel TypeScript rebuild** — NOT what the live HTML runs. Don't confuse them; the js/ versions are authoritative for the demo. (Note: their seed data has diverged — see Known Issues.)

## Architecture (js/ folder)
| File | Role |
|------|------|
| `store.jsx` | Shared store, seed data, costing engine (`FEEDER_LIBRARY`, `parseConfig`, `generateHarness`, `computeCosting`, `procurementForOrder`), persistence (`KEY = "ready-systems-erp-v7"`), `openOrder`/`useOpenOrder` |
| `app.jsx` | Root: session + module router (`renderModule(role, key)`) |
| `shell.jsx` | Login, sidebar nav per role (`getRoleNav`), header, role switcher, `ICONS` |
| `ui.jsx` | Primitives: Card, Pill, Button, Table, Modal, Select, Empty, Toaster, formatters |
| `workspace.jsx` | **Order workspace** — guided gated pipeline for one W/O. Tabs: Overview · Documents · BOM · Costing & Quote · Approval · Procurement · Build & recovery. **Separation of duties:** `canDefine=role==="Planning"` (docs/BOM/delivery), `canCommerce=role==="Procurement"` (costing/approval/procurement) |
| `planning.jsx` | Orders & BOM register + Planning dashboard |
| `release.jsx` | **Release board** (added) — material-gated kanban: Awaiting approval / Blocked / Ready / On floor / QC |
| `schedule.jsx` | **Schedule & load** (added) — week-by-week build hours vs editable bench capacity, backward-scheduled from due dates |
| `costing.jsx` | **Client quotes** worklist (sell-side; thin — real costing is in workspace) |
| `purchase.jsx` | **Procurement desk** — `Purchase` renders sidebar views: **Sourcing** group (`GROUPS.sourcing` = To buy + RFQ sub-tabs), Purchase orders (expedite + register), Bills (3-way match + MSME), Suppliers. Internal RFQ view key is `rfq` (was `sourcing`). Director sees the combined Seg desk |
| `stores.jsx` | Inventory: goods inward + incoming QC (calls `addToStock` on accept), stock, issue-to-job |
| `quality-kpi.jsx` | **Quality KPI dashboard** (added) — FPY, OTD, supplier rejection, COPQ, complaints, audit closure |
| `director.jsx` | Read-only oversight dashboard |

## Lifecycle (11 stages, in `STAGES`)
RFQ → Final BOM → Costing → Quote → Approved → PO → Incoming QC → Stores → Build → Final QC → Dispatch

**Stage / tab ownership (separation of duties):** Planning *defines* (Documents, BOM, Build & recovery); **Procurement** *prices & buys* (Costing & Quote, Approval, Procurement). Inventory owns Incoming QC→Stores; Quality owns Final QC→Dispatch. Workspace has 6 steps + Overview.

## Roles
Director · Planning · **Procurement** · Inventory · Quality (demo names: Mihir Borker / Prakash / Poonam / Anjali / Rohan — all log in with the same `mihir@readysystems.in` / `demo@123`, switch via avatar menu). Per-role nav (`getRoleNav` in `shell.jsx`):
- **Director:** Dashboard · Work orders · Projects · Release board · Purchase · Client quotes · Inventory · Quality KPIs · Quality
- **Planning:** Dashboard · Work orders · Release board · Schedule & load
- **Procurement:** Dashboard · Client quotes · Sourcing · Purchase orders · Bills · Suppliers
- **Inventory:** Inward + QC · Stock on hand · Issue to job
- **Quality:** Quality KPIs · Final QC · QC records

## Recently completed (Jun 2026 — Procurement clarity, Sourcing upgrades, docs)

- **Procurement naming de-collided.** Sidebar `Quoting` → **Client quotes** (`costing.jsx`, sell-side) and `Buy plan` + `Quotes` merged into **Sourcing** (`purchase.jsx`) with **To buy** + **RFQ** sub-tabs. A dedicated **Procurement** role was split out in `getRoleNav` (Planning no longer carries costing/purchase). Internal RFQ view key renamed `sourcing` → `rfq`; `GROUPS.sourcing` drives the grouped sub-tab page.
- **Sourcing desk upgraded** (`purchase.jsx`):
  1. **KPI strip** on the Sourcing page — To commit (₹) / Jobs short / Open RFQs / Bids to award.
  2. **Urgency-first To buy** — job shortfalls show need-by date + `RiskPill_pu`, sorted most-urgent first; flags `lateForJob` when `maxLead > daysToNeed` ("lead won't make it — order now").
  3. **Demand consolidation** — `ToBuy_pu` aggregates direct-PO + replenishment lines by preferred supplier; when one supplier spans ≥2 sources it offers a single combined PO (`woNo: "MULTI"`). Additive — per-job/per-supplier paths untouched.
  4. **RFQ aging + chase** — `Quotes_pu` adds an **Age** column (stale ≥5d, uses `createdAt`) and a **Remind** action targeting non-responding bidders (toast + `logActivity`). `readOnly` threaded through `Sourcing_pu`.
- **Docs refreshed.** Added `PARTNER-GUIDE.md` (plain-English partner/presentation reference). Updated `APPLICATION-GUIDE.md`, `README.md`, `PRESENTER-GUIDE.md` and this file for the new roles/nav/Procurement naming and separation of duties.

## Recently completed (earlier session)

### Backlog cleared (all four items)
1. **Workspace dead-end closed.** New 6th step **Build & delivery** (`DeliveryTab` in `workspace.jsx`) — read-only timeline of Build → Final QC → Dispatch pulling live `issues` / `finalQcJobs` / `qcRecords` from the store. Opens once a job is at Build or beyond; locked with a pointer before that. `pipeline()` is now downstream-aware (`inDelivery`, delivery `next` states) and `stepState` covers the new step.
2. **RFQ-vs-direct-PO wired into Procurement.** `procurementDecision(order, s)` in `store.jsx`: sole-source / multi-source split + shortfall value vs `RFQ_THRESHOLD` (₹25,000). Procurement tab shows a decision banner — **Direct PO recommended** (one-click raise to preferred supplier) or **Get quotes recommended** (float RFQ), with the other path always available as a secondary action. RFQ modals (`NewRFQModal`/`CompareModal`) now exported from `purchase.jsx` and reused in-workspace.
3. **Purchase reframed as a procurement desk** (was a thin per-job funnel). `purchase.jsx` now a 6-view segmented cockpit — **Buy plan** (Replenishment: stock items below reorder level, grouped by supplier with one-click top-up PO + Project buys: non-stocked items per job, funnel to workspace), **Expediting** (open POs to chase, ETA from supplier lead time vs job need-by, overdue-first, mark-confirmed), **Quotes** (RFQ register/compare), **Invoices** (3-way match + MSME clock — see below), **PO register** (every PO, All/Open/Received filter), **Suppliers** (reliability scorecard). New store engines: `replenishmentPlan` / `projectBuys` / `openPoBoard` / `raiseStockPo` / `setPoConfirmed` / `supplierScorecard`. Material master gained `stocked` / `reorderPoint` / `reorderTo` / `leadDays`.
   - **Supplier reliability wired from Quality.** `supplierScorecard(s)` derives reject % (incoming-QC dispositions) + OTD % (on-time GRNs, new `onTime` flag on inwards) → composite score → **Preferred / Approved / Watch**. Surfaced on Suppliers cards AND inside `CompareModal` next to each bid, with an “L1 isn't the best-rated” banner so awards weigh dependability vs price. Seed has a believable spread: RR Kabel/Terminal Preferred, Aviza Approved, NPS (sole-source loom vendor) on Watch.
   - **Invoices — Procure-to-Pay close (POC-tight).** New `invoices` seed key (auto-migrated, no `KEY` bump). `invoiceMatch(inv, s)` does a 3-way match (invoice price vs PO rate, invoice qty vs GRN-accepted qty) + duplicate detection (same supplier+invNo) + MSME 45-day statutory clock from acceptance (`MSME_DAYS`, warns at 7d left). `setInvoicePay` drives Unpaid → Approved → Paid; only matched invoices can be approved. Seed tells the full story: matched/approved, MSME clock running, qty exception, paid, duplicate (flagged red), and one MSME due-in-2-days. Deliberately NOT built: vendor portal, AI copilot, commodity/risk feeds, auto-approval — out of scope for a single-shop POC.
4. **Seed aligned + `KEY` bumped to `v8`.** Stock seed raised to realistic levels (grey 320, bulk wire 980–1240m, sleeve/heat-shrink in stock) so the only genuine shortage is the **sole-source made-to-order metering loom** — which now drives a clean Direct-PO demo. WO-0012 reverted to *Approved* with its loom PO removed so the decision banner shows live. `v8` wipes persisted demo state (acceptable per backlog note).

### Earlier this session
1. **Release board** (`release.jsx`) + Director read-only copy.
2. **Schedule & load** (`schedule.jsx`) — editable bench capacity persisted to localStorage.
3. **Quality KPI dashboard** (`quality-kpi.jsx`) — added `complaints` + `auditObservations` to store with a non-destructive migration in `load()`. KPIs chosen for a low-volume/high-mix shop; deliberately NOT PPM or NPS.
4. **Presentation decks:** `Ready Systems Deck.html` (tight 6-slide) and `Ready Systems Deck (long).html` (15-slide). Built on `deck-stage.js`. PPTX export works in screenshots mode.
5. **Data bug fix:** `procurementForOrder` treats any order at **Stores or beyond** as material-secured (0 to order).

## Known issues / open decisions
- **Overview button** restyled as an eye-icon tab (no longer reads as an action button). Resolved.
- **`src/` + `vite-app/` TS rebuild still diverges** from `js/` (the authoritative demo). The new material-master sourcing fields and `procurementDecision` are **not** ported there yet.
- **RFQ award → PO** still flows through the existing `CompareModal` award path; the in-workspace “Get quotes” uses the same modals, so awarding from either place behaves identically.

## Deployment
Static site; `vercel.json` set (cleanUrls). Deploy by drag-dropping the project folder to Vercel (preset: Other, no build, root output) or via Git import. The in-browser Babel compile is fine for demo; harden via the `vite-app/` build later.

## Important conventions
- **Procurement has two motives** (see `store.jsx`): `stocked` consumables are bought to a **min/max reorder level** (`reorderPoint`/`reorderTo`) via the Purchase desk's *Replenishment* view — NOT per job; `stocked:false` items (e.g. the metering loom) are **buy-to-order** per job via the workspace. `replenishmentPlan` / `projectBuys` / `openPoBoard` are the desk's three engines.
- **Two doors to buying:** per-job, decision-driven buys happen in the **workspace** Procurement tab; cross-job stock replenishment + expediting live in the **Purchase desk**. Replenishment POs use `woNo: "STOCK"`, `kind: "Replenishment"`. Don't reintroduce per-job PO-raising on the Purchase page.
- **Sourcing lives in the material master:** `MATERIAL_RATES` rows carry `preferredSupplier` + `soleSource` + `leadDays`. `procurementDecision()` is the single source of truth for the RFQ-vs-PO recommendation — reuse it, don't re-derive.
- Each `js/*.jsx` ends with `Object.assign(window, { ComponentName })`. Babel scripts don't share scope otherwise.
- Never name a styles object just `styles` — collisions break the page. Use prefixed names.
- Don't wipe localStorage you didn't write. The migration in `store.jsx load()` backfills new top-level keys without destroying user edits.
- Decks: built on `deck-stage.js` starter; each slide is a `<section>`. Export PPTX in **screenshots** mode (editable mode mis-measures the shadow-DOM deck).
