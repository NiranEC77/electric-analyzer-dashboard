# devlog

Running narrative of this project, for future blog-post mining. Newest
entries at the bottom.

## 2026-07-23 — Kickoff and scaffold

Started from a fully-specified brief: an open-source dashboard that
decomposes rising electric/gas bills into price, consumption, and fees
effects, grounded entirely in parsed bill facts — no model-generated
numbers allowed anywhere near a chart or a suggestion. That grounding
discipline (a verifier that fails loudly on any unsourced numeral) is the
thing this project is actually about; everything else is in service of it.

Walked through five architecture decisions before writing anything:

- Local-first IndexedDB storage by default, with Supabase as an optional
  pluggable persistence adapter rather than a required backend — this was
  the one real negotiation. The brief's own non-negotiable is "zero required
  env vars, demo mode works out of the box," so Supabase had to become the
  documented multi-device-sync option instead of the default, or that
  guarantee breaks.
- One shared TypeScript analysis core instead of a separate Python engine,
  so the same decomposition/verifier/rules code runs unmodified in the
  browser, in a Vercel serverless function, and from a CLI.
- Client-side PDF parsing — bills never transit a server.
- A monorepo (`packages/core` / `packages/adapters` / `apps/web`, pnpm
  workspaces) — the only way to make "one core, three runtimes" actually
  true rather than aspirational.
- v0.1 scope locked to a lean MVP: decomposition + verifier + core charts +
  price/fees rules. Weather normalization (NOAA degree-day regression,
  baseload trend) pushed to v0.2 deliberately — it pulls in an external data
  fetch and a regression fit that deserve their own pass, and it's not
  needed to prove the grounding discipline works end to end.

Target repo confirmed: `NiranEC77/electric-analyzer-dashboard`, empty, no
refs yet.

Minor environment friction worth remembering: this box has Node 18.19.1 but
no system pnpm, and `npm install -g pnpm` needed pinning to `pnpm@9`
specifically since latest pnpm requires Node ≥22. The global bin also isn't
on `PATH` for non-interactive shells because `~/.bashrc` early-returns
before the `PATH` export for non-interactive sessions — used the full
binary path as a workaround rather than fighting shell init order.

Scaffolding the repo skeleton now: workspace config, repo hygiene docs, then
`packages/core` (types, decomposition math, verifier) as the load-bearing
piece.
