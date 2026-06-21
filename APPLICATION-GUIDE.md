# Ready Systems — Operations Console · Application Guide

A complete, detailed reference to **what the application does and how every screen works** —
written so you can present and demo with total confidence and answer any question without
feeling lost. Companion to `PRESENTER-GUIDE.md` (the talking-points/pitch script).

> **New:** for a partner-facing, plain-English overview see **`PARTNER-GUIDE.md`** — it's the
> best single document to read before a presentation. This guide is the deeper screen-by-screen
> reference.

> If you read nothing else, read **§2 (roles)**, **§3 (lifecycle)** and **§4 (the order
> workspace)** — those three cover 80% of what you'll show and be asked about.

---

## Table of contents
1. [What it is & how it's built](#1-what-it-is--how-its-built)
2. [Signing in, roles & navigation](#2-signing-in-roles--navigation)
3. [The spine: one job ID & the 11-stage lifecycle](#3-the-spine-one-job-id--the-11-stage-lifecycle)
4. [The order workspace (the 6 tabs)](#4-the-order-workspace-the-6-tabs)
5. [The costing engine (the crown jewel)](#5-the-costing-engine-the-crown-jewel)
6. [Planning module](#6-planning-module)
7. [Procurement desk](#7-procurement-desk)
8. [Stores / Inventory module](#8-stores--inventory-module)
9. [Quality module + KPIs](#9-quality-module--kpis)
10. [Director view](#10-director-view)
11. [The demo dataset (what's already in there)](#11-the-demo-dataset-whats-already-in-there)
12. [Behaviours & rules worth knowing](#12-behaviours--rules-worth-knowing)
13. [Glossary](#13-glossary)
14. [Demo troubleshooting / FAQ](#14-demo-troubleshooting--faq)

---

## 1. What it is & how it's built

**Ready Systems Operations Console** is a domain-specific operations system for **panel &
wire-harness contract assembly** (Siemens 8DJHST / 8FB20 switchgear). It digitises everything
around the build: quoting, BOM, purchase, stores and quality — connected by one job number.

**Architecture (important for "is it hard to run?" questions):**
- **Static web app** — no server, no install, no database. Open the HTML and it runs.
- Built in **React**, compiled in the browser (Babel). Styling via **Tailwind**.
- **All data lives in the browser** (`localStorage`), seeded with realistic demo data. Clearing
  storage or **"Reset demo data"** returns to the clean seed.
- This is a **prototype/POC**. A production build would swap localStorage for a shared backend;
  the code is already split into modules that anticipate that.

**Files (so you know what's what):**
| File | What it is |
|---|---|
| `Ready Systems Console.html` | The app itself |
| `js/*.jsx` | App modules (store/engine, workspace, planning, purchase, stores, quality, KPIs) |
| `layout-3d.html` | 3D harness/layout-board visualiser |
| `Ready-Systems-Presentation.html` / `.pdf` | The pitch deck |
| `PRESENTER-GUIDE.md` | Talking points for the pitch |
| this file | Full app reference |

---

## 2. Signing in, roles & navigation

**Login:** `mihir@readysystems.in` / `demo@123` (same for every role in the demo).

**Switch role** from the **avatar menu** (top-right). One login can hop between all five roles —
realistic for a small shop. The five demo identities:

| Role | Demo name | What they do |
|---|---|---|
| **Director** | Mihir Borker | Read-only oversight of the whole shop |
| **Planning** | Prakash | Order entry, documents, BOM, releasing to the floor, scheduling |
| **Procurement** | Poonam | Pricing/quoting to the client, buying material, POs, bills, suppliers |
| **Inventory** | Anjali | Goods inward + incoming QC, stock, issue to job |
| **Quality** | Rohan | Final QC gate, QC records, quality KPIs |

**The shell:** left **sidebar** = the modules available to the current role; top bar = who you're
signed in as. At the bottom of the sidebar there's a **"Presentation ↗"** link and the
**"Reset demo data"** button (Director only).

**Each role's sidebar menu:**
- **Director:** Dashboard · Work orders · Projects · Release board · Purchase · Client quotes · Inventory · Quality KPIs · Quality
- **Planning:** Dashboard · Work orders · Release board · Schedule & load
- **Procurement:** Dashboard · Client quotes · Sourcing · Purchase orders · Bills · Suppliers
- **Inventory:** Inward + QC · Stock on hand · Issue to job
- **Quality:** Quality KPIs · Final QC · QC records

---

## 3. The spine: one job ID & the 11-stage lifecycle

Everything centres on the **work order number** (the Siemens **W/O No**, e.g. `RS-WO-24-0011`).
Every module hangs off it, which is what makes the Director's single live view possible.

**The 11 stages** (a job moves left to right; **gates** in bold):

`RFQ → Final BOM → Costing → Quote → `**`Approved`**` → PO → `**`Incoming QC`**` → Stores → Build → `**`Final QC`**` → Dispatch`

| Stage | Meaning | What advances it |
|---|---|---|
| RFQ | Order just entered | — |
| Final BOM | Harness BOM being finalised | **Lock the BOM** → Costing |
| Costing | Pricing the locked BOM | **Send the quote** → Quote |
| Quote | Quote sent, awaiting the client | **Record client approval** → Approved |
| **Approved** ✓ | Client approved — **procurement unlocks** | Raise/award a PO → PO |
| PO | Material on order | **Goods inward in Stores** → Incoming QC |
| **Incoming QC** ⛬ | Received material being inspected | **Accept** the lot → Stores |
| Stores | Material accepted into stock | **Issue to the job** → Build |
| Build | On the floor, being assembled | **Mark build complete** → Final QC |
| **Final QC** ⛬ | Pre-dispatch inspection | **Pass** → Dispatch (Reject → back to Build) |
| Dispatch | Shipped | — |

**The three gates** are the heart of the process discipline:
1. **Approval** — you cannot buy material until the client approves the quote.
2. **Incoming QC** — received material is inspected before it enters stock.
3. **Final QC** — nothing ships without passing the pre-dispatch check.

Any order can also be flagged **stuck** with a reason (e.g. "Material short"), which surfaces on
the dashboards.

---

## 4. The order workspace (the 6 tabs)

Open any order (from Work orders, the dashboard, the release board, etc.) to get a **guided, gated
pipeline** for that one job. The tab strip shows each step; locked steps can't be opened until
their precondition is met. There's also an **Overview** tab (summary) and a **"Next" banner**
that always points to the single most useful action.

> **Separation of duties:** the **Planning** role owns Documents, BOM and Build & recovery;
> the **Procurement** role owns Costing & Quote, Approval and Procurement. Other roles see the
> workspace read-only. (One demo login switches between roles, so you can still walk the whole
> flow yourself.)

### Tab 1 — Documents
Attach files that travel with the job: **Schematic, Layout board, GA drawing, Datasheet, Other**.
"Layout board" docs get a **View 3D** link (opens `layout-3d.html`). Optional but useful.

### Tab 2 — BOM
The harness Bill of Materials. The costing engine **auto-generates** it from the config; you can
add manual lines. Two key actions:
- **Lock BOM** — freezes the lines and opens Costing. Nothing downstream can start until this.
- **Revise BOM** — bumps the revision, **re-opens costing, and voids any existing approval**
  (so a price can never be built on a moving target). The quote is flagged "out of date".

### Tab 3 — Costing & Quote
The cost build-up and the quote. **Locked until the BOM is locked.** You see the full build-up
(see §5), tune the **margin** (slider / ± buttons), and:
- **Send quote** → order moves to **"Sent — awaiting client approval"**. Price fields then lock.
- If the BOM was revised, the quote shows **"Out of date"** with a **Re-send** action.

### Tab 4 — Approval
*(Shares the screen with Costing — selecting "Approval" in the stepper jumps here.)*
This is the **client handshake**. When the client responds you click **"Record client decision"**:
- **Approved** — capture the **client's approval reference** (their PO number / email, required)
  and the **approval date**. These are kept on the order as evidence. The order moves to
  **Approved** and **procurement unlocks**.
- **Rejected** — capture a reason. The quote returns to a revisable state ("Revise & re-send").

> **Why this matters (common demo question):** previously the same person who sent a quote could
> instantly self-approve with nothing recorded. Now approval is deliberate and evidenced.

### Tab 5 — Procurement
**Locked until the quote is approved.** Shows the **material status** for this job — required vs
in-stock vs on-order vs received — so you only order the **shortfall**. A decision banner
recommends one of two paths:
- **Direct PO** — for low-value or sole-source items: one click raises a PO to the preferred
  supplier.
- **Get quotes (RFQ)** — for multi-source spend above the **₹25,000** threshold: float an RFQ,
  compare bids, award (awarding raises the PO automatically).

**Mutual exclusion:** once an RFQ is open for the job, the direct-PO button is **hidden** so you
can't double-order. **Receipt is automatic** — a PO becomes *Partial* then *Received* as
Inventory logs goods inward in Stores (no manual "mark received").

### Tab 6 — Build & recovery
Follows the job on the floor: **Build → Final QC → Dispatch**, as a timeline.
- Shows **material issued** to the job and the build estimate.
- **"Mark build complete → Final QC"** — the floor's action; only this sends the job to the QC
  gate (it does **not** auto-appear there when material is issued).
- If Final QC **rejects** the job, this tab shows a **recovery banner + the failed QC report**,
  and the action becomes **"Rework done → back to Final QC"**.

---

## 5. The costing engine (the crown jewel)

This is the highest-value piece — turn a Siemens config into a harness BOM and a price.

**Step 1 — decode the config.** A config like `RRL+ME` is parsed into **feeder codes**:

| Code | Feeder | Build time |
|---|---|---|
| (base) | Base harness (every panel) | 25 min |
| **R** | Ring-main feeder (load-break switch, ring in/out) | 35 min |
| **L** | Circuit-breaker feeder (VCB with control wiring) | 55 min |
| **T** | Transformer feeder (switch-fuse / transformer protection) | 45 min |
| **K** | Cable feeder (cable connection compartment) | 30 min |
| **ME** | Metering unit (CT/PT metering compartment) | 40 min |

**Step 2 — assemble the harness BOM.** Each feeder maps to a set of wires (in metres), hardware
(lugs, sleeves, ferrules, ties — in nos) and a build time. The engine sums them across the config
and multiplies by **quantity** of panels.

**Step 3 — the cost build-up.** (Defaults shown; all are adjustable per order.)

| Line | How it's computed | Default |
|---|---|---|
| **Material** | Locked BOM × material-master rates | — |
| **+ Wastage** | % of material (cutting offcuts & rejects) | **4%** |
| **+ Labour** | total build-minutes × labour rate | **₹6/min** (~₹360/hr) |
| **+ Overhead** | % of works (power, floor, supervision) | **12%** |
| **= Works cost** | material + wastage + labour + overhead | — |
| **+ Margin** | the one dial you turn per quote | **18%** |
| **= Quote total** | shown as total and **per-unit** | — |

**Build minutes** = 25 (base) + sum of the feeder times, × qty. Example: `RRL` = 25 + 35 + 35 +
55 = **150 min/unit**.

**The material master** holds, per material: rate, whether it's **stocked** (held to a min/max)
vs **made-to-order**, reorder point/level, **lead days**, **preferred supplier**, and whether
it's **sole-source**. These drive the buy decisions (stock vs project, RFQ vs direct PO).

> **Be honest in the demo:** the feeder library, build times and rates are **sensible
> placeholders**. The whole point of the pilot is to validate them against the owner's real
> costing sheet and 3–5 past orders.

---

## 6. Planning module

Planning **defines** the job — order entry, documents, BOM, releasing to the floor, scheduling.
(Pricing and buying belong to the **Procurement** role, see §7 — this split is the
*separation of duties* the workspace enforces.) Menu items:

- **Dashboard** — Planning's overview: live order pipeline, what needs attention, quick stats.
- **Work orders** — the full order list (filter/search), the entry point to each order's workspace.
- **Release board** — jobs ready to be released to the floor: shows whether **material is
  covered** and lets Planning **release** an approved, material-secured job to Build.
- **Schedule & load** — capacity/loading view: build hours per job against available bench
  capacity, so you can sequence the floor.

The Director sees read-only versions of most screens.

---

## 7. Procurement module

The buyer's cockpit **across every job**. The Procurement role owns pricing/quoting (sell-side)
and all buying (buy-side). Sidebar: **Dashboard · Client quotes · Sourcing · Purchase orders ·
Bills · Suppliers**.

> **Naming (you'll be asked):** **Client quotes** is the price you send the **customer**
> (sell-side); the **RFQ** under Sourcing is suppliers quoting **you** (buy-side). Opposite sides
> of the deal — they used to both be called "quote", which was confusing, so they're now named
> distinctly the way SAP/Oracle keep them apart.

### Dashboard
The start-of-day view — KPIs for spend and supply health, plus a **prioritised action queue**
(job shortfalls, bids to award, overdue POs, stock below reorder, invoice alerts), each row
click-through to the relevant desk.

### Client quotes (sell-side)
The worklist of jobs awaiting pricing. Open one to run the **costing engine** (see §5), set the
margin, and send the customer a quote. *This is the price to the customer — not supplier cost.*

### Sourcing (buy-side)
One page covering "decide what to buy and from whom", with a summary KPI strip
(**To commit · Jobs short · Open RFQs · Bids to award**) and **two sub-tabs**:

- **To buy** — all demand in one list:
  - **Job shortfalls** — material a live job is missing, each showing the job's **need-by date and
    urgency pill**, sorted **most-urgent first**. If supplier lead time can't make the date it
    flags **"lead won't make it — order now"**.
  - **Replenishment** — consumables below reorder level, grouped into **one PO per supplier**.
  - **Consolidate** — when one supplier feeds 2+ demand sources (several jobs, or a job + stock),
    it offers a **single combined PO** to cut paperwork and hit price breaks (only shown when
    there's a real overlap).
  - Each row raises a PO (or floats an RFQ) through one shared form.
- **RFQ** — the request-for-quotation register. **Float** to 2–3 suppliers, then **Compare bids**
  side by side. The register shows **how long each RFQ has been open** (flagged "stale" once it
  ages) and a **"Remind"** action that nudges only the non-responding suppliers. Compare shows each
  supplier's total, lead time and **reliability rating** (from Quality records), flags the cheapest
  (**L1**), and warns if L1 isn't the best-rated. **Awarding raises the PO automatically.**

> For multi-source material above the **₹25,000** threshold the system recommends an RFQ; for
> low-value or sole-source items, a direct PO. Once an RFQ is open for a job, the direct-PO button
> is hidden so you can't double-order.

### Purchase orders
Every PO in two views: **Expediting** (open POs, ETA from supplier lead time, overdue first,
"Mark confirmed" to record supplier acknowledgement) and the full **register** (filter
all / open / received). Receipt stays automatic from Stores.

### Bills (invoices)
Supplier invoices with a **3-way match**: invoice price vs **PO** rate, invoice qty vs
**GRN-accepted** qty, plus **duplicate** detection. Only **matched** invoices can be "Approved to
pay" → "Mark paid". Carries the **MSME payment clock**: a 45-day statutory clock (MSMED Act) from
acceptance, flagged "due soon" at day 38 and "overdue" past 45.

### Suppliers
A **scorecard** per supplier: **on-time delivery %** and **rejection %** pulled straight from the
Quality module's records. The rating blends **60% on-time + 40% quality** → **Preferred (≥90)**,
**Approved (≥75)**, or **Watch**. Also shows spend, open POs, average lead time, and which
materials they supply (sole-source flagged).

---

## 8. Stores / Inventory module

Inventory's three screens:

- **Inward + QC** — log goods inward against a PO (**GRN** no, lot, LR, challan, qty, coils).
  Each lot gets an **incoming-QC disposition**: **Accept / Rework / Reject** — which writes an
  audit-ready record and updates the supplier scorecard. Logging inward moves the job to
  **Incoming QC**; accepting moves it to **Stores**. *This inward is also what auto-updates the
  PO to Partial/Received — the "receipt is automatic" rule.*
- **Stock on hand** — live running stock by item (with coil counts). This is what procurement
  nets demand against, so you only buy the shortfall.
- **Issue to job** — issue material from stock to a work order. Issuing moves the job to **Build**
  (it's on the floor).

---

## 9. Quality module + KPIs

### Final QC (the dispatch gate)
The queue is **order-driven**: a job appears here only once the floor has **marked the build
complete** (jobs still in Build/rework don't clutter the gate). For each job you run the
inspection (continuity, connector seating, visual/dress, label/marking) and set a **disposition**:

| Disposition | Effect |
|---|---|
| **Pass** | → Dispatch (dated, ready to ship) |
| **Hold** | Stays at the gate for an in-place fix & re-inspection; reason recorded |
| **Reject → rework** | Sends the job **back to Build** as *recovery*; it must be reworked, marked build-complete again, and re-inspected. The failed report stays on the job. |

Every disposition writes a **Final-QC record**.

### QC records
The **audit archive** — all inspections, Incoming (Inventory) + Final (Quality), with date,
reference, inspector and disposition. **"Export audit pack"** downloads them as a file.

### Quality KPIs (dashboard)
Seven metrics chosen for a low-volume, multi-client contract shop, **computed live** from QC,
inward and dispatch records:
- **First-pass yield** — assemblies that passed Final QC clean first time
- **On-time delivery** — dispatched on/before the committed date
- **Supplier rejection** — rework + reject share of inspected incoming lots
- **COPQ (proxy)** — value of rejected/reworked material ÷ booked revenue
- **Open complaints** + **average time to resolve**
- **Audit observations open** + **average closure time**

Plus a **supplier-quality table** (lots / accepted / rework / rejected / rejection %).
*PPM and NPS are deliberately not tracked — they mislead at this volume; rejection-by-lot and
complaint-closure speed are the honest equivalents.*

---

## 10. Director view

Everything **read-only**. The Director (the owner) sees: live **KPIs**, the **order board**
(every job and its stage), **projects**, the **release board**, **purchase** and **costing**,
**inventory**, the **Quality KPIs** and **quality records**, plus an **activity feed** and
**stuck-job alerts**. Because everything hangs off one job ID, this view is always current — no
report to compile. The **"Reset demo data"** button lives here.

---

## 11. The demo dataset (what's already in there)

Knowing the seed means nothing surprises you mid-demo. There are **nine orders**
(`RS-WO-24-0011` … `0019`) spread across the lifecycle so every screen has something to show:

| W/O | Client | Config | Stage (≈) | Good for showing |
|---|---|---|---|---|
| 0011 | Client A | RRL | Build | a job on the floor; issued material |
| 0012 | Client B | LRRL+ME | Approved (material short) | procurement / raising a PO / RFQ |
| 0013 | Client C | RRL+ME | Costing | BOM lock → costing |
| 0014 | Client D | LRRL+ME | Final QC (Hold) | the QC gate / a held job + its report |
| 0015 | Client E | RRRL | Dispatch | a completed job |
| 0016 | Client F | RRL+ME (8FB20) | Final BOM | early-stage / BOM building |
| 0017 | Client G | RRL | Quote | the **quote → record approval** flow |
| 0018 | Client H | RRL | Costing | costing |
| 0019 | Client H | RRL+ME | Final BOM | a second job for the same client |

**Suppliers** in the seed: RR Kabel Limited, NPS Engineers, Aviza Technologies, Terminal
Technologies. There are also seeded **GRNs/inwards**, **invoices** (some MSME, one duplicate, one
price-mismatch), **complaints**, **audit observations**, and one open **RFQ**.

> Best single demo path: open **0017** (quote → record approval), then **0012** (procurement →
> raise PO), switch to **Inventory** (issue), **Build & recovery** (mark complete), **Quality**
> (final QC, try a reject), then **Quality KPIs** and the **Director** dashboard. See
> `PRESENTER-GUIDE.md §4` for the click-by-click script.

---

## 12. Behaviours & rules worth knowing

These are the "why did it do that?" answers — handy if a click doesn't behave as a viewer expects:

- **Costing is locked** until the BOM is locked. **Procurement is locked** until the quote is
  approved. These are intentional gates, not bugs.
- **Revising a locked BOM voids approval** and re-opens costing (bumps the revision).
- **You only order the shortfall** — procurement nets required vs stock vs open POs vs received.
- **Receipt is automatic** — POs update from Stores goods-inward; there's no "mark received".
- **A job reaches Final QC only via "Mark build complete"** — not when material is issued.
- **Reject ≠ Hold:** Reject sends a job back to the floor (rework); Hold keeps it at the gate.
- **RFQ open ⇒ direct PO hidden** for that job (no double-ordering).
- **Only matched invoices can be paid;** MSME invoices carry the 45-day clock.
- **Data is per-browser.** Two people on two laptops have independent data. "Reset demo data"
  (Director) restores the clean seed.

---

## 13. Glossary

- **W/O No** — Work Order number; the Siemens job ID everything hangs off.
- **BOM** — Bill of Materials; the harness parts list.
- **Feeder** — a switchgear compartment type (R/L/T/K/ME); drives the harness content.
- **RFQ** — Request for Quotation; floated to suppliers to compare prices.
- **PO** — Purchase Order.
- **GRN** — Goods Receipt Note; logged when material arrives.
- **Incoming QC / Final QC** — inspection gates (on receipt / before dispatch).
- **3-way match** — invoice vs PO price vs GRN-accepted qty.
- **MSME** — Micro/Small/Medium Enterprise supplier; statutory 45-day payment clock.
- **OTD** — On-Time Delivery.
- **COPQ** — Cost of Poor Quality (here, value of rejected/reworked material).
- **Sole-source vs multi-source** — material available from one supplier vs several.
- **L1** — the lowest bid in an RFQ comparison.

---

## 14. Demo troubleshooting / FAQ

**The data looks messy after I clicked around.** Switch to **Director → Reset demo data**.

**I can't open the Costing / Procurement tab.** They're gated — lock the BOM first (Costing) and
record the client's approval first (Procurement). The "Next" banner tells you what's needed.

**A job I issued material to isn't in the Final QC queue.** Correct — open its **Build & recovery**
tab and **Mark build complete**. That's the gate.

**"Open the live console" / where to demo:** the deployed app is at
**https://ready-system2.vercel.app** (login as above). Present the deck from
`Ready-Systems-Presentation.html`.

**Is anything sent anywhere / is data safe?** No backend, no network calls for data — everything
is in the browser. Nothing leaves the laptop.

**Can it handle our exact feeders/configs?** The library is built around the R/L/T/K + ME codes;
the owner walkthrough is where we lock the exact wires, lengths and build times per feeder.
