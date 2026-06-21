# Ready Systems — Presenter's Guide

A practical companion to **`Ready-Systems-Presentation.html`** (the interactive deck) and
**`Ready-Systems-Presentation.pdf`** (the print/share version). It gives you the narrative,
the talking points per section, a live-demo script, and answers to the questions Ready
Systems is likely to ask.

> **One-line pitch:** *"You're experts at the build — we make the paperwork around it digital,
> searchable and connected, starting by proving the costing engine."*

---

## 1. Before the meeting

**Have open, in this order of tabs:**
1. `Ready-Systems-Presentation.html` — full screen (press F11). This is what you present from.
2. The live console — **https://ready-system2.vercel.app** — logged in and ready for the demo.
3. The PDF as a backup (if a screen/projector won't run the animations).

**Logins for the demo:** `mihir@readysystems.in` / `demo@123`. Switch role from the avatar
menu (top-right). "Reset demo data" lives in the Director sidebar if you need a clean slate.

**Timing:** the deck is ~6 sections. Budget **10–12 min** for the deck + **8–10 min** live
demo + **Q&A**. If short on time, the must-hit sections are **#3 (costing engine)** and the
**ask (#6)** — everything else supports those two.

**Golden rule:** lead with respect for their craft. We are *not* telling them how to build
harnesses — we're fixing the admin, coordination and quoting around the build.

---

## 2. The narrative arc (why this order)

| # | Section | What it does in the story |
|---|---|---|
| 1 | **Hero** | Sets the promise: one connected system. |
| 2 | **The situation** | Names the pain they feel daily (slow/fragile/invisible/audit). |
| 3 | **The costing engine** | The hero feature — the thing that makes them say "we can't go back". |
| 4 | **One system** | Shows it's not a toy — a real lifecycle with gates, one job ID. |
| 5 | **Live now** | Proof of momentum: real metrics + five improvements already shipped. |
| 6 | **The ask** | A small, low-risk next step. Close here. |

The arc is **problem → crown jewel → system → proof → ask**. Don't reorder it; each section
earns the right to the next.

---

## 3. Section-by-section talking points

### Slide 1 — Hero ("Your shop floor, one connected system")
- **Goal:** land the promise in one sentence.
- **Say:** *"Today your shop runs on registers and Excel. We're proposing one connected system
  for the whole job — built specifically for panel and wire-harness assembly, not a generic ERP."*
- **Point at:** the three numbers — *4 modules, 11 stages, 3 quality gates, zero infrastructure
  to set up.* "Zero infrastructure" matters — it runs in a browser, nothing to install.

### Slide 2 — The situation
- **Goal:** show we understand their world.
- **Say:** *"The build isn't the problem — you're experts at that. The pain is the paperwork:
  quoting depends on one person's memory, files get lost, there's no live view of stock or
  status, and quality records sit on paper."*
- **Key reassurance (say it out loud): "Tally stays."** We connect to their accounting, we
  don't rebuild it. Free pilot, graceful exit.

### Slide 3 — The costing engine (THE crown jewel)
- **Goal:** this is the slide that wins the deal. Slow down here.
- **Say:** *"We prove the hardest, highest-value thing first — turning a Siemens config like
  `8DJHST RRL+ME` into a harness BOM and a price, consistently, without depending on memory."*
- **Walk the flow on screen:** config → feeder library → harness BOM → cost & quote.
- **Walk the cost build-up bar:** Material → +Wastage → +Labour → +Overhead → +Margin = the
  quote total (₹32,010 in the example). *"Margin is the one dial you turn per quote — everything
  under it is captured once and applied the same way every time."*
- **Be honest:** *"The numbers you see are sensible placeholders. To make this trustworthy we
  need a short walkthrough with the owner."* (This sets up the ask.)

### Slide 4 — One system, eleven stages, three gates
- **Goal:** show maturity — this is a real process tool, not a calculator.
- **Walk the pipeline:** RFQ → … → Dispatch. Point at the three pulsing gates:
  - **Approval** — you can't buy until the client approves.
  - **Incoming QC** and **Final QC** — material can't move without an inspection record.
- **Point at the hub diagram:** *"Everything hangs off one job number — your Siemens W/O. That
  single ID is what lets the owner see the whole shop on one screen."*

### Slide 5 — Live now (metrics + improvements)
- **Goal:** prove momentum and responsiveness.
- **Say:** *"These quality KPIs are computed live from the shop's own records — first-pass yield,
  on-time delivery, supplier rejection, cost of poor quality."* (Note the values are illustrative.)
- **The five improvements:** *"Every one of these came from a walkthrough — we listened, then
  shipped. Quoting is now a proper client handshake; jobs only reach QC when the floor says
  build's done; you can't double-order; rejected jobs loop back for rework with their report;
  and the buyer gets a 'Today' action queue."*

### Slide 6 — The ask (close here)
- **Goal:** make saying yes almost risk-free.
- **From them:** a 30–45 min costing walkthrough, one filled costing sheet, 3–5 past orders with
  their quoted price.
- **From us:** validate the engine on their real orders, a **free pilot with a graceful exit**,
  and on success → Phase 1 (the four modules online).
- **Close line:** *"All we need to take the next step is 45 minutes with the owner. If it doesn't
  prove out, you walk away — no cost, no lock-in."*

---

## 4. Live demo script (8–10 min)

Run this in the console after the deck. Narrate as you click.

1. **Sign in as Procurement** (the person who prices & buys). *"Planning enters the order,
   documents and BOM; Procurement prices it and buys the material — one login switches between
   them, so I'll show both sides."*
2. **Open an order** (e.g. `RS-WO-24-0017`) → **Costing & Quote** tab. Show the cost build-up
   and margin slider. *"Change the margin, the quote updates live."*
3. **Send the quote**, then **Record client decision → Approved** with a client reference.
   *"Notice procurement was locked until I recorded a real client approval — with their PO
   reference and date kept as evidence."*
4. **Procurement** tab → show the shortfall, then **Raise PO** (or float an RFQ). *"It only asks
   you to order the shortfall — it nets against stock and open POs."*
5. **Switch role → Inventory** → **Issue to job**. *"Issuing material puts the job on the floor."*
6. **Switch role → Planning** → open the order → **Build & recovery** → **Mark build complete**.
   *"The floor decides when it's ready for QC — not the system."*
7. **Switch role → Quality** → **Final QC** → Inspect → try **Reject → rework**. *"A failed job
   goes back to the floor with its report attached, then comes back through the gate."*
8. **Quality KPIs** → show the dashboard. **Switch role → Director** → *"And the owner sees all
   of it, live, on one screen."*

**Demo tips:** if anything looks off, "Reset demo data" (Director sidebar) gives a clean start.
Keep narrating the *why*, not the clicks.

---

## 5. Likely questions & how to answer

**"Will this replace Tally / our accounting?"**
> No. Tally stays. We connect to it; we don't rebuild accounting. This is operations — quoting,
> BOM, purchase, stores, quality.

**"We're not very technical — is it hard to use / set up?"**
> There's nothing to install — it runs in a browser. Each role sees one focused screen, and the
> system always points to the next action. The pilot is free and we set it up.

**"How do we know the costing is right?"**
> That's exactly what the pilot proves. We run the engine against 3–5 of your real past orders
> and compare to what you actually quoted. Today's rates are placeholders until your walkthrough.

**"What if it doesn't work for us?"**
> Graceful exit, by design. The pilot is free and there's no lock-in — your data is your data.

**"What does it cost?"**
> The proof-of-concept pilot is free. We only talk commercials once the engine has proven itself
> on your real orders and you've decided you want Phase 1.

**"Who keeps it running / where's our data?"**
> In the prototype, everything lives in the browser — no servers, no accounts. For Phase 1 we
> move to a shared, backed-up system; the modules are already built to swap to that.

**"Can it handle our specific feeder types / configs?"**
> The feeder library is built around your R/L/T/K + ME codes. The walkthrough is where we lock in
> the exact wires, lengths and build times per feeder so it matches your shop.

---

## 6. TL;DR cheat sheet

- **Open with respect:** they're great at building; we fix the paperwork.
- **Spend most time on the costing engine** — it's the "can't go back" moment.
- **"Tally stays"** removes the biggest fear — say it early.
- **The gates** (approval + 2× QC) show this is a real process, not a calculator.
- **Close on the free pilot + graceful exit** — the ask is just *45 minutes with the owner*.
- **Files:** present from the `.html`; share/print the `.pdf`; demo at the live Vercel URL.
