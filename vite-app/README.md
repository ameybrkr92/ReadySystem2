# Ready Systems — Operations Console

Role-based operations console for an MV-switchgear & wire-harness contract-assembly shop.
Vite + React 18 + TypeScript + Tailwind v4. Builds to static files — deploys to Vercel with no server.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # → dist/
npm run preview  # serve the production build locally
```

## Deploy to Vercel

**Option A — Git (auto-redeploys)**
1. Push this folder to a GitHub repo.
2. In Vercel: *Add New → Project → Import* the repo.
3. Vercel auto-detects Vite (build `vite build`, output `dist`). Deploy.

**Option B — CLI**
```bash
npm install
npx vercel        # links/creates the project
npx vercel --prod # promote to production
```

**Option C — drag & drop (no Git)**
Run `npm run build`, then drag the `dist/` folder onto vercel.com.

`vercel.json` is included (framework `vite`, SPA rewrite). No env vars needed yet.

## Demo login

`mihir@readysystems.in` / `demo@123` — switch role (Director / Planning / Inventory / Quality)
from the avatar menu. "Reset demo data" lives in the Director sidebar.

## Layout

```
src/
  App.tsx              # session-aware shell + module router
  main.tsx             # entry
  index.css            # Tailwind v4 + design tokens
  lib/
    erp-store.ts        # state, seed data, mutations (localStorage-backed)
    format.ts           # ₹ / date helpers
  components/erp/
    Login, Shell, Director, Planning, Costing, Purchase, Stores, Quality, ui
public/
  layout-3d.html        # standalone Three.js layout-board visualiser
```

## Notes

- **State** is in the browser (localStorage) — great for a prototype, blocker for multi-user.
  Replace `lib/erp-store.ts` reads/writes with an API client when the backend lands.
- **Documents** (schematics / layout boards) attach to a work order in Planning. In this
  prototype files are stored inline in the browser (8 MB cap); move to object storage in production.
- **3D layout board**: the *View 3D* link on any "Layout board" document opens `/layout-3d.html`.

See `Ready-Systems-Presentation.html` (project root) for the full product brief, review and roadmap.
