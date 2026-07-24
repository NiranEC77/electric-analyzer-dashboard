# STATE.md — context continuity

Last updated: 2026-07-23

## Phase

v0.1 scaffold complete, pushed, CI green, deployed. Full lean-MVP surface
implemented and tested (core decomposition + verifier + rules, adapters,
demo-data, web dashboard). Live at
`https://electric-analyzer-dashboard.vercel.app` (Vercel auto-deploys `main`).
CI (GitHub Actions) passing: secret-scan + typecheck/lint/test/build.

Next real work is v0.2 (weather normalization) — see below.

## Locked decisions (v0.1)

- **Storage:** local-first IndexedDB is the zero-config default. Supabase is
  the pluggable persistence adapter for multi-device sync — optional, off by
  default, configured via env vars documented in
  `docs/persistence-adapters.md`.
- **Analysis core:** single shared TypeScript package (`packages/core`),
  runs unmodified in browser, Vercel serverless, and CLI.
- **PDF parsing:** client-side (bills never leave the browser). Reversible —
  can move to a serverless-assisted path later without touching the data
  model.
- **Repo layout:** monorepo, pnpm workspaces — `packages/core`,
  `packages/adapters`, `packages/demo-data`, `packages/timeseries`,
  `apps/web`.
- **v0.1 scope (Lean MVP):** upload/parse (PSE&G adapter + manual entry +
  CSV import) → review-and-confirm screen → local IndexedDB store with
  JSON export/import → three-way decomposition (supply/delivery split +
  fees bucket) → verifier → headline cards, waterfall chart, stacked-bar
  composition chart, effective-rate line chart → price/fees/insufficient-
  data rules only → demo mode → deploys to Vercel with zero required env
  vars.
- **Deferred to v0.2:** weather normalization (NOAA GHCN fetch + regression),
  baseload trend chart, scatter-vs-degree-days chart, baseload/weather rules,
  anomaly-flag refinement.
- **Deferred to v0.3:** additional utility adapters, refined anomaly
  detection.
- **Phase E (interfaces only, not implemented):** `TimeSeriesSource` for
  Green Button / sensor ingestion — stubbed in `packages/timeseries`.

## Target repo

`github.com/NiranEC77/electric-analyzer-dashboard` — confirmed empty
(no refs) as of 2026-07-23. Nothing pushed yet; local commit only until
explicitly confirmed with Niran.

## Environment notes (this working machine, not the app)

- Repo lives at `~/code/electric-dashboard-analyzer`. Git repos go under
  `~/code`, not `~/chats` (the latter is for non-git working dirs).
- Node v18.19.1, no system pnpm — installed via `npm install -g pnpm@9`
  (pnpm 9.15.9 lands in `~/.npm-global/bin`, not on PATH by default in
  non-interactive shells because `~/.bashrc` early-returns for non-
  interactive sessions). Use the full path or prepend
  `~/.npm-global/bin` to `PATH` per command until this is resolved properly.
- No `GITHUB_TOKEN`/`GH_TOKEN`/`VERCEL_*`/`SUPABASE_*` env vars present as of
  scaffold time — needed later for push/deploy/Supabase wiring, to be read
  from env at use time only, never requested in chat.

## Deploy / CI notes

- Vercel project `electric-analyzer-dashboard` (team `nirans-projects`),
  auto-deploys `main` from GitHub. Monorepo config lives in root
  `vercel.json` (build `pnpm --filter web build`, output `apps/web/dist`).
  Root Directory is repo root, not `apps/web`.
- GitHub push uses a fine-grained PAT with Contents + Workflows scope, stored
  at `~/.secrets/github.env` (owned by `claude-orch`, 600), sourced at push
  time only — never in `.git/config` or the transcript.
- CI pins pnpm via `packageManager` in package.json only (do NOT also set
  `version:` in pnpm/action-setup — it errors).

## Next steps

1. v0.2: weather normalization (NOAA GHCN degree-day fetch + regression),
   baseload trend chart, scatter-vs-degree-days chart, baseload/weather
   rules. Interfaces already stubbed in `packages/core/src/weather`.
2. Consider rotating the PAT to drop `workflow` scope once no further
   workflow edits are expected.
