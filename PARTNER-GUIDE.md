# Ready Systems — Operations Console · Partner Guide

A complete, plain-English walkthrough of the application — what it is, the problem it
solves, how every screen works, and how to demo it with confidence. Written to be read
**before** giving a presentation, by someone who hasn't built the app.

> **Last updated:** 21 Jun 2026 · reflects the current build (Procurement module renamed to
> *Client quotes / Sourcing*, with the upgraded Sourcing desk).

---

## Table of contents

1. [The 60-second pitch](#1-the-60-second-pitch)
2. [The problem it solves](#2-the-problem-it-solves)
3. [How it's built (and "is it safe / hard to run?")](#3-how-its-built)
4. [Logging in, the five roles & navigation](#4-logging-in-the-five-roles--navigation)
5. [The spine: one job number & the 11-stage lifecycle](#5-the-spine)
6. [The order workspace (the 6 tabs) & separation of duties](#6-the-order-workspace)
7. [The costing engine (the crown jewel)](#7-the-costing-engine)
8. [The Procurement module](#8-the-procurement-module)
9. [Inventory / Stores](#9-inventory--stores)
10. [Quality + KPIs](#10-quality--kpis)
11. [Director view](#11-director-view)
12. [The demo dataset](#12-the-demo-dataset)
13. [Recommended demo flow (a presentation script)](#13-recommended-demo-flow)
14. [Rules worth knowing (the "why did it do that?" answers)](#14-rules-worth-knowing)
15. [Value-proposition talking points](#15-value-proposition-talking-points)
16. [Glossary](#16-glossary)
17. [FAQ / troubleshooting](#17-faq--troubleshooting)

---

## 1. The 60-second pitch

**Ready Systems Operations Console** is a purpose-built operations system for a **panel &
wire-harness contract assembly** shop (the kind that builds Siemens **8DJHST / 8FB20**
switchgear harnesses to order).

It takes a job from **enquiry → quote → approval → buying → goods-in → build → quality →
dispatch**, all tied to **one job number**. Because every module hangs off that single ID,
the owner gets one always-current view of the whole shop — no spreadsheets to reconcile, no
"let me get back to you on where that order is."

The standout piece is a **costing engine**: type a switchgear configuration (e.g. `RRL+ME`)
and it builds the wiring Bill of Materials, the labour minutes, and a priced quote — turning
a half-day estimating job into a few clicks.

---

## 2. The problem it solves

A small contract-assembly shop typically runs on **WhatsApp, email, and a stack of Excel
files**. The pain that creates:

- **Quoting is slow and inconsistent** — every estimate is rebuilt by hand from memory.
- **No single source of truth** — the order is in one sheet, the PO in another, QC on paper.
- **Things fall through the cracks** — material ordered late, a job ships without final QC,
  an MSME invoice goes past its statutory payment date.
- **The owner is the system** — only they know the real status of everything.

The console replaces that with a connected flow where **each step unlocks the next**, the
**right person owns each step**, and **status is a fact, not a phone call**.

---

## 3. How it's built

Plain answers to the questions a technical partner (or a cautious client) will ask:

- **It's a static web app.** No server, no install, no database to administer. You open an
  HTML file (or a URL) and it runs in the browser.
- **Built in React**, compiled on the fly in the browser, styled with Tailwind.
- **All data lives in the browser** (`localStorage`), pre-loaded with realistic demo data.
  **"Reset demo data"** (Director) returns everything to the clean starting state.
- **Nothing leaves the laptop.** There are no network calls for data — so "is our data safe?"
  is easy: there's nowhere for it to go.
- **It's a prototype / proof-of-concept.** A production version would swap the browser storage
  for a shared backend so the whole team sees the same data live. The code is already split
  into modules that anticipate that change.

**What's where (so nothing surprises you):**

| File | What it is |
|---|---|
| `Ready Systems Console.html` | The application itself |
| `index.html` | Redirects to the console |
| `js/*.jsx` | The app's modules (data/engine, workspace, procurement, stores, quality, etc.) |
| `layout-3d.html` | A 3D harness/layout-board visualiser (opened from a job's documents) |
| `Ready-Systems-Presentation.html` | The pitch deck |
| `PARTNER-GUIDE.md` (this file) | The full plain-English reference |
| `APPLICATION-GUIDE.md` | An earlier, more detailed reference (some Procurement naming predates this build) |

**Live demo:** `https://ready-system2.vercel.app` (same login as below).

---

## 4. Logging in, the five roles & navigation

**Login:** `mihir@readysystems.in` / `demo@123` — the same credentials work for every role in
the demo. After signing in you can **switch role from the avatar menu (top-right)**; one login
hops between all five roles, which is realistic for a small shop where a few people wear many hats.

The five roles, the demo person behind each, and what they do:

| Role | Demo name | Responsible for |
|---|---|---|
| **Director** | Mihir Borker | Read-only oversight of the entire shop |
| **Planning** | Prakash | Order entry, documents, BOM, releasing jobs to the floor, scheduling |
| **Procurement** | Poonam | Pricing/quoting to the client, buying material, POs, bills, suppliers |
| **Inventory** | Anjali | Goods inward + incoming QC, stock, issuing material to jobs |
| **Quality** | Rohan | The final QC gate, QC records, quality KPIs |

**The shell:** the **left sidebar** shows the modules available to the current role; the top bar
shows who you're signed in as. The sidebar also has a **"Presentation ↗"** link and, for the
Director, the **"Reset demo data"** button.

**Each role's sidebar:**

- **Director:** Dashboard · Work orders · Projects · Release board · Purchase · Client quotes · Inventory · Quality KPIs · Quality
- **Planning:** Dashboard · Work orders · Release board · Schedule & load
- **Procurement:** Dashboard · Client quotes · Sourcing · Purchase orders · Bills · Suppliers
- **Inventory:** Inward + QC · Stock on hand · Issue to job
- **Quality:** Quality KPIs · Final QC · QC records

---

## 5. The spine

Everything centres on the **work order number** (the Siemens **W/O No**, e.g. `RS-WO-24-0011`).
Every module hangs off it — which is exactly what makes the Director's single live view possible.

**The 11 stages** — a job moves left to right; the three **gates** are in bold:

`RFQ → Final BOM → Costing → Quote → `**`Approved`**` → PO → `**`Incoming QC`**` → Stores → Build → `**`Final QC`**` → Dispatch`

| Stage | Meaning | What advances it |
|---|---|---|
| RFQ | Order just entered | — |
| Final BOM | Harness BOM being finalised | **Lock the BOM** → Costing |
| Costing | Pricing the locked BOM | **Send the quote** → Quote |
| Quote | Quote sent, awaiting the client | **Record the client's approval** → Approved |
| **Approved** ✓ | Client approved — **buying unlocks** | Raise / award a PO → PO |
| PO | Material on order | **Goods inward in Stores** → Incoming QC |
| **Incoming QC** ⛬ | Received material being inspected | **Accept** the lot → Stores |
| Stores | Material accepted into stock | **Issue to the job** → Build |
| Build | On the floor, being assembled | **Mark build complete** → Final QC |
| **Final QC** ⛬ | Pre-dispatch inspection | **Pass** → Dispatch (Reject → back to Build) |
| Dispatch | Shipped | — |

**The three gates are the heart of the process discipline:**

1. **Approval** — you cannot buy material until the client approves the quote.
2. **Incoming QC** — received material is inspected before it enters stock.
3. **Final QC** — nothing ships without passing the pre-dispatch check.

Any order can also be flagged **stuck** with a reason (e.g. "Material short"), which surfaces
on the dashboards so it can't be quietly forgotten.

---

## 6. The order workspace

Open any order (from Work orders, a dashboard, or the release board) to get a **guided, gated
pipeline for that one job**. A tab strip shows each step; a locked step can't be opened until its
precondition is met, and a **"Next" banner** always points to the single most useful next action.

The six tabs:

| # | Tab | What happens here | Owned by |
|---|---|---|---|
| 1 | **Documents** | Attach the files that travel with the job — schematic, layout board, GA drawing, datasheet. "Layout board" docs get a **View 3D** link. | Planning |
| 2 | **BOM** | The harness Bill of Materials (auto-generated from the config; manual lines allowed). **Lock BOM** freezes it and opens costing. **Revise BOM** bumps the revision and *voids any existing approval* so a price can't sit on a moving target. | Planning |
| 3 | **Costing & Quote** | The cost build-up and the quote. Tune the **margin**, then **Send quote**. *(Locked until the BOM is locked.)* | Procurement |
| 4 | **Approval** | The client handshake. **Record the client's decision:** Approved (capture their PO/email reference + date) or Rejected (capture a reason). Approval unlocks buying. | Procurement |
| 5 | **Procurement** | The material status for this job — required vs in-stock vs on-order — so you only order the **shortfall**. Raise a direct PO or float an RFQ. *(Locked until approved.)* | Procurement |
| 6 | **Build & recovery** | Follows the job on the floor: Build → Final QC → Dispatch. **Mark build complete** is the only thing that sends a job to the QC gate. If QC rejects, a recovery banner + the failed report appear here. | Planning |

**Separation of duties (a deliberate design point worth calling out):** **Planning defines** the
job (documents, BOM, build/release), while **Procurement prices and buys** it (costing, quoting,
purchasing). One person can still do both in the demo by switching roles, but the system makes the
ownership explicit — which is what stops the old "whoever's free does whatever" chaos.

---

## 7. The costing engine

This is the highest-value piece — it turns a Siemens configuration into a harness BOM and a price.

**Step 1 — decode the config.** A config like `RRL+ME` is parsed into **feeder codes**:

| Code | Feeder | Build time |
|---|---|---|
| (base) | Base harness (every panel has one) | 25 min |
| **R** | Ring-main feeder (load-break switch, ring in/out) | 35 min |
| **L** | Circuit-breaker feeder (VCB with control wiring) | 55 min |
| **T** | Transformer feeder (switch-fuse / transformer protection) | 45 min |
| **K** | Cable feeder (cable connection compartment) | 30 min |
| **ME** | Metering unit (CT/PT metering compartment) | 40 min |

**Step 2 — assemble the BOM.** Each feeder maps to a set of wires (metres), hardware (lugs,
sleeves, ferrules, ties — in nos) and a build time. The engine sums them across the config and
multiplies by the **quantity** of panels.

**Step 3 — the cost build-up** (defaults shown; all adjustable per order):

| Line | How it's computed | Default |
|---|---|---|
| **Material** | Locked BOM × material-master rates | — |
| **+ Wastage** | % of material (offcuts & rejects) | 4% |
| **+ Labour** | total build-minutes × labour rate | ₹6/min (~₹360/hr) |
| **+ Overhead** | % of works (power, floor, supervision) | 12% |
| **= Works cost** | material + wastage + labour + overhead | — |
| **+ Margin** | the one dial you turn per quote | 18% |
| **= Quote total** | shown as a total **and per-unit** | — |

Example build minutes: `RRL` = 25 (base) + 35 + 35 + 55 = **150 min/unit**, × qty.

**The material master** holds, per item: rate, whether it's **stocked** (held to a min/max) or
**made-to-order**, reorder point/level, **lead days**, **preferred supplier**, and whether it's
**sole-source**. These fields are what drive every buying decision downstream.

> **Be honest in the demo:** the feeder library, build times and rates are **sensible
> placeholders**. The whole point of a pilot is to calibrate them against the owner's real costing
> sheet and a handful of past orders.

---

## 8. The Procurement module

> **Naming note (you will be asked this):** "Client quotes" and the RFQ are *opposite sides of the
> deal*. **Client quotes** is the price you send **to the customer** (sell-side). The **RFQ** under
> Sourcing is the price suppliers send **to you** (buy-side). They used to both be called "quote",
> which was confusing — they're now named distinctly, the way mainstream ERPs (SAP, Oracle) keep
> them apart.

The Procurement sidebar has five entries:

### Dashboard
The buyer's start-of-day view — KPIs for spend and supply health, plus a prioritised queue of
what needs action (job shortfalls, bids to award, overdue POs, stock below reorder, invoice
alerts). Everything is click-through to the relevant desk.

### Client quotes (sell-side)
The worklist of jobs awaiting pricing. Open one to run the **costing engine** (see §7), set the
margin, and send the customer a quote. *This is the price to the customer — not supplier cost.*

### Sourcing (buy-side) — the upgraded desk
One page covering the whole "decide what to buy and from whom" flow, with **two sub-tabs** and a
summary KPI strip at the top (**To commit · Jobs short · Open RFQs · Bids to award**):

- **To buy** — all demand in one list:
  - **Job shortfalls** — material a live job is missing. Each shortfall shows the job's
    **need-by date and an urgency pill**, sorted **most-urgent first**. If the supplier's lead
    time can't make the date, it flags **"lead won't make it — order now"** — so you instantly see
    what's already too late to source the normal way.
  - **Replenishment** — consumables below their reorder level, grouped into **one PO per supplier**.
  - **Consolidate** — when a single supplier feeds **more than one demand source** (several jobs,
    or a job plus stock), it offers a **single combined PO** to cut paperwork and hit price breaks.
    (It only appears when there's a real overlap, so it never nags.)
  - Every row raises a PO (or floats an RFQ) through one shared form.
- **RFQ** — the request-for-quotation register. Float an RFQ to 2–3 suppliers, then **compare
  bids** side by side. The register shows **how long each RFQ has been open** (flagged "stale" once
  it ages), and a **"Remind"** action that nudges only the suppliers who haven't responded yet.
  **Comparing** shows each supplier's total, lead time and **reliability rating** (from Quality
  records), flags the cheapest (**L1**), and warns if L1 isn't the best-rated. **Awarding a bid
  raises the PO automatically** and moves the job forward.

> **When does the system suggest an RFQ vs a direct PO?** For multi-source material above a
> **₹25,000** threshold it recommends getting quotes; for low-value or sole-source items it
> recommends a direct PO. Once an RFQ is open for a job, the direct-PO button is hidden so you
> can't double-order.

### Purchase orders
Every PO, in two views: **Expediting** (open POs, ETA from supplier lead time, overdue first,
"Mark confirmed" to record the supplier's acknowledgement) and the full **register** (filter
all / open / received). **Receipt is automatic** — a PO updates to *Partial* then *Received* as
Inventory logs goods inward in Stores. There is no manual "mark received".

### Bills
Supplier invoices with a **3-way match**: invoice price vs **PO** rate, invoice qty vs
**GRN-accepted** qty, plus **duplicate** detection. Only **matched** invoices can be "Approved to
pay" → "Mark paid". Carries the **MSME payment clock**: a 45-day statutory clock (MSMED Act) from
acceptance, flagged "due soon" near the deadline and "overdue" past it.

### Suppliers
A **scorecard** per supplier: **on-time delivery %** and **rejection %**, pulled straight from the
Quality module's records. The rating blends **60% on-time + 40% quality** → **Preferred (≥90)**,
**Approved (≥75)**, or **Watch**. Also shows spend, open POs, average lead time, and which
materials each supplies (sole-source flagged).

---

## 9. Inventory / Stores

Inventory's three screens:

- **Inward + QC** — log goods inward against a PO (**GRN** number, lot, LR, challan, qty, coils).
  Each lot gets an **incoming-QC disposition — Accept / Rework / Reject** — which writes an
  audit-ready record and updates the supplier scorecard. Logging inward moves the job to **Incoming
  QC**; accepting moves it to **Stores**. *(This inward is also what auto-updates the PO to
  Partial/Received — the "receipt is automatic" rule.)*
- **Stock on hand** — live running stock by item (with coil counts). This is what procurement nets
  demand against, so you only ever buy the shortfall.
- **Issue to job** — issue material from stock to a work order. Issuing moves the job to **Build**.

---

## 10. Quality + KPIs

### Final QC (the dispatch gate)
The queue is **order-driven** — a job appears here only once the floor has **marked the build
complete** (jobs still building don't clutter the gate). For each job you run the inspection
(continuity, connector seating, visual/dress, label/marking) and set a disposition:

| Disposition | Effect |
|---|---|
| **Pass** | → Dispatch (dated, ready to ship) |
| **Hold** | Stays at the gate for an in-place fix & re-inspection; reason recorded |
| **Reject → rework** | Sends the job **back to Build** as recovery; it must be reworked, marked build-complete again, and re-inspected. The failed report stays on the job. |

Every disposition writes a **Final-QC record**.

### QC records
The **audit archive** — every inspection, Incoming (Inventory) + Final (Quality), with date,
reference, inspector and disposition. **"Export audit pack"** downloads them as a file.

### Quality KPIs
Seven metrics chosen for a low-volume, multi-client contract shop, **computed live** from the QC,
inward and dispatch records:

- **First-pass yield** — assemblies that passed Final QC clean first time
- **On-time delivery** — dispatched on/before the committed date
- **Supplier rejection** — rework + reject share of inspected incoming lots
- **COPQ (proxy)** — value of rejected/reworked material ÷ booked revenue
- **Open complaints** + average time to resolve
- **Audit observations open** + average closure time

Plus a supplier-quality table (lots / accepted / rework / rejected / rejection %).

> *PPM and NPS are deliberately not tracked — they mislead at this volume. Rejection-by-lot and
> complaint-closure speed are the honest equivalents.*

---

## 11. Director view

Everything **read-only**. The Director (the owner) sees live **KPIs**, the **order board** (every
job and its stage), **projects**, the **release board**, **purchase** and **client quotes**,
**inventory**, the **Quality KPIs** and **records**, plus an **activity feed** and **stuck-job
alerts**. Because everything hangs off one job ID, this view is always current — there is no report
to compile. The **"Reset demo data"** button lives here.

---

## 12. The demo dataset

Knowing the seed means nothing surprises you mid-demo. There are **nine orders**
(`RS-WO-24-0011` … `0019`) spread across the lifecycle so every screen has something to show:

| W/O | Client | Config | Stage (≈) | Good for showing |
|---|---|---|---|---|
| 0011 | Client A | RRL | Build | a job on the floor; issued material |
| 0012 | Client B | LRRL+ME | Approved (material short) | procurement / raising a PO / RFQ |
| 0013 | Client C | RRL+ME | Costing | BOM lock → costing; an open RFQ |
| 0014 | Client D | LRRL+ME | Final QC (Hold) | the QC gate / a held job + its report |
| 0015 | Client E | RRRL | Dispatch | a completed job |
| 0016 | Client F | RRL+ME (8FB20) | Final BOM | early-stage / BOM building |
| 0017 | Client G | RRL | Quote | the **quote → record approval** flow |
| 0018 | Client H | RRL | Costing | costing |
| 0019 | Client H | RRL+ME | Final BOM | a second job for the same client |

**Suppliers in the seed:** RR Kabel Limited, NPS Engineers, Aviza Technologies, Terminal
Technologies. There are also seeded GRNs/inwards, invoices (some MSME, one duplicate, one
price-mismatch), complaints, audit observations, and one open RFQ.

---

## 13. Recommended demo flow

A clean, end-to-end story that touches every part of the system. Reset demo data first.

1. **Start as the Director** → show the dashboard: every job, its stage, the KPIs, stuck alerts.
   *"This is the whole shop on one screen, always live."*
2. **Open W/O 0017 (Quote stage)** → the order workspace. Walk the tab strip, point out the
   gates. On **Costing & Quote**, nudge the margin to show the live price. Then on **Approval**,
   **record the client's approval** (capture their PO reference). *Buying just unlocked.*
3. **Switch to Procurement → Sourcing → To buy.** Show **W/O 0012's shortfall** with its urgency
   pill and need-by date. Raise a PO (or float an RFQ and **compare bids** under the RFQ tab —
   point out the reliability rating and the L1 flag).
4. **Switch to Inventory → Inward + QC** → log goods inward against the PO, **accept** the lot.
   Note the PO updated itself to Received, and the job moved into Stores. Then **Issue to job**.
5. **Back to the order's Build & recovery tab → Mark build complete.** The job now appears at the
   QC gate.
6. **Switch to Quality → Final QC** → run the inspection. **Try a Reject** to show the job bounce
   back to the floor with its failed report, then pass it on the second pass.
7. **Finish on Quality KPIs and the Director dashboard** → show that everything you just did is
   already reflected, with no manual reporting.

> The single most impressive moment is usually **the costing engine** (config → BOM → price) and
> **the Director's always-current view**. Lead with whichever fits your audience.

---

## 14. Rules worth knowing

The "why did it do that?" answers, handy if a click doesn't behave as a viewer expects:

- **Costing is locked** until the BOM is locked; **buying is locked** until the quote is approved.
  These are intentional gates, not bugs.
- **Revising a locked BOM voids the approval** and re-opens costing (and bumps the revision).
- **You only order the shortfall** — procurement nets required vs stock vs open POs vs received.
- **Receipt is automatic** — POs update from Stores goods-inward; there is no "mark received".
- **A job reaches Final QC only via "Mark build complete"** — not when material is issued.
- **Reject ≠ Hold:** Reject sends a job back to the floor (rework); Hold keeps it at the gate.
- **RFQ open ⇒ direct-PO button hidden** for that job (no double-ordering).
- **Only matched invoices can be paid;** MSME invoices carry the 45-day statutory clock.
- **A consolidated PO covers multiple jobs**, so it's tagged `MULTI` rather than one W/O — the same
  trade-off real ERPs make when one order serves several jobs.
- **Data is per-browser.** Two people on two laptops have independent data. "Reset demo data"
  (Director) restores the clean seed.

---

## 15. Value-proposition talking points

Use these to frame *why it matters*, not just what it does:

- **From "the owner is the system" to "the system is the system."** Status becomes a fact anyone
  can read, instead of a question only the owner can answer.
- **Quotes in minutes, consistently.** The costing engine removes the slow, error-prone, "redo it
  from scratch every time" estimating.
- **Process discipline by design.** The three gates mean you *can't* buy before approval, *can't*
  stock un-inspected material, and *can't* ship without final QC — the mistakes that cost real
  money are structurally prevented.
- **Buying that thinks.** Sourcing surfaces what's urgent, chases slow suppliers, and consolidates
  demand — the things a busy buyer forgets.
- **Compliance built in.** Audit-ready QC records and the MSME payment clock are handled as a
  by-product of normal work, not a separate chore.
- **One number ties it together.** Because everything hangs off the W/O number, the owner gets a
  single live view for free — no reporting overhead.

---

## 16. Glossary

- **W/O No** — Work Order number; the Siemens job ID everything hangs off.
- **BOM** — Bill of Materials; the harness parts list.
- **Feeder** — a switchgear compartment type (R / L / T / K / ME); drives the harness content.
- **Client quote** — the price sent **to the customer** (sell-side).
- **RFQ** — Request for Quotation; floated **to suppliers** to compare prices (buy-side).
- **PO** — Purchase Order.
- **GRN** — Goods Receipt Note; logged when material arrives.
- **Incoming QC / Final QC** — inspection gates (on receipt / before dispatch).
- **3-way match** — invoice vs PO price vs GRN-accepted qty.
- **MSME** — Micro/Small/Medium Enterprise supplier; statutory 45-day payment clock.
- **OTD** — On-Time Delivery.
- **COPQ** — Cost of Poor Quality (here, value of rejected/reworked material).
- **Sole-source vs multi-source** — material available from one supplier vs several.
- **L1** — the lowest bid in an RFQ comparison.
- **Consolidation** — combining demand for one supplier across jobs/stock into a single PO.

---

## 17. FAQ / troubleshooting

**The data looks messy after I clicked around.** Switch to **Director → Reset demo data**.

**I can't open the Costing / Procurement tab on a job.** They're gated — lock the BOM first
(for Costing) and record the client's approval first (for Procurement). The "Next" banner tells
you exactly what's needed.

**A job I issued material to isn't in the Final QC queue.** Correct — open its **Build & recovery**
tab and **Mark build complete**. That's the gate into QC.

**Why are "Client quotes" and "RFQ" different things?** Client quotes is the price you send the
customer; an RFQ is suppliers quoting you. Opposite sides of the deal — see §8.

**Is anything sent anywhere / is our data safe?** No backend, no network calls for data —
everything stays in the browser on the laptop.

**Can it handle our exact feeders/configs?** The library is built around the R/L/T/K + ME codes;
a pilot/owner walkthrough is where we lock the exact wires, lengths, build times and rates per
feeder against real past orders.

**Where do I demo / present from?** Live app: `https://ready-system2.vercel.app`. Deck:
`Ready-Systems-Presentation.html`.
