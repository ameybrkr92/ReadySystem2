# Ready Systems — Operations Console (POC)

A domain-specific operations console for **panel & wire-harness contract assembly**.
This is the **prototype-first POC**: it proves the crown-jewel **costing engine** (type a Siemens
config → get a harness BOM and a cost) and shows the four target modules — Planning/BOM,
Purchase, Stores, Quality — connected by one job ID (the Siemens W/O No).

> No backend by design. All state lives in the browser (localStorage) so the POC runs
> anywhere with zero infrastructure. The roadmap (see `Ready-Systems-Presentation.html`) covers
> Phase 1 (bring everything online) and Phase 2 (the intelligence layer).

## What's here

| File | What it is |
|---|---|
| `index.html` | Entry — redirects to the app |
| `Ready Systems Console.html` | The app (loads `js/*.jsx` via in-browser Babel) |
| `js/` | App modules: store + costing engine, order workspace, planning, costing, purchase, stores, quality |
| `layout-3d.html` | 3D layout-board & harness visualiser (Three.js) |
| `Ready-Systems-Presentation.html` | **Interactive client deck** — animated, scrolling web presentation (charts, KPI gauges, live pipeline). Present from this; it also has a print stylesheet → clean PDF |
| `Ready-Systems-Presentation.pdf` | Exported PDF of the deck (for sharing / projectors that can't run the animations) |
| `APPLICATION-GUIDE.md` | **Full application reference** — every role, screen, module, the lifecycle, the costing engine and the demo dataset, written so the presenter never feels lost |
| `PRESENTER-GUIDE.md` | **Presenter's guide** — narrative, per-section talking points, a live-demo script and likely Q&A for whoever delivers the pitch |
| `vite-app/` | Optional production build scaffold (Vite+TS) — **behind the static POC**, regenerate from final design before using |

## Run locally

It's a static site — no build step. Serve the folder with anything:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:8000/`. Demo login: **mihir@readysystems.in** / **demo@123**
(switch role from the avatar menu; "Reset demo data" is in the Director sidebar).

## Deploy to Vercel (static, zero config)

**Option A — GitHub → Vercel (auto-redeploys)**
1. Create a repo and push this folder:
   ```bash
   git init && git add . && git commit -m "Ready Systems POC"
   git branch -M main
   git remote add origin https://github.com/<you>/ready-system-poc.git
   git push -u origin main
   ```
2. In Vercel: **Add New → Project → Import** the repo. Framework preset: **Other**
   (no build command, output directory = root). Deploy.

**Option B — Vercel CLI**
```bash
npx vercel          # link/create project, accept static defaults
npx vercel --prod   # promote to production
```

**Option C — drag & drop**
Zip this folder (or just its files) and drop it on vercel.com → it serves as a static site.

`vercel.json` enables clean URLs. No environment variables are needed.

## Notes

- **Costing engine** lives in `js/store.jsx` (`FEEDER_LIBRARY`, `parseConfig`, `generateHarness`,
  `computeCosting`). This is the piece to validate against real orders with the owner.
- **Job-centric workspace** (`js/workspace.jsx`): open any order to get Overview · Harness BOM ·
  Costing · Procurement · Documents in one place.
- **Receipts are automatic** — a PO becomes Partial/Received when Inventory logs goods inward in Stores.
