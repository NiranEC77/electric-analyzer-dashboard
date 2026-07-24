# STATE.md — context continuity

Last updated: 2026-07-23

## Phase

Initial scaffold, pre-first-commit. No code implemented beyond types and
interface stubs. Nothing pushed to the remote yet.

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

## Next steps

1. Finish scaffold: `packages/core` types + decomposition math + verifier +
   property test, `packages/adapters` interface + manual-entry + PSE&G stub,
   `packages/demo-data`, `packages/timeseries` stub, `apps/web` Astro shell,
   CI workflow, pre-commit hook.
2. Local git init + first commit.
3. Confirm with Niran before pushing to the GitHub remote or wiring up any
   Vercel deploy.
