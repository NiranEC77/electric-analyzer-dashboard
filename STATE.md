# STATE.md — context continuity

Last updated: 2026-07-23

## Phase

v0.1 shipped and live, then extended past the original lean-MVP scope in
direct response to real usage feedback from Niran (using his own real PSE&G
bills, not just demo data). Live at
`https://electric-analyzer-dashboard.vercel.app` (Vercel auto-deploys
`main`). CI green: secret-scan + typecheck/lint/test/build. 38 tests.

Since the original v0.1 scaffold, in order:
1. **Real PSE&G adapter**, rewritten from an actual bill (never committed —
   synthetic fixture only). Added `currentCharges`/`previousBalance`/
   `payments` to `BillFacts` so a carried-over unpaid balance is never
   attributed to a price/usage/fee change. Fixed pdf.js text extraction
   (was emitting one glyph per item — rewrote to coordinate-based line
   reconstruction).
2. **Plain-language explanation + real histogram**, replacing effect-jargon
   headline cards. New `packages/core/src/narrative` module, verified
   through the same `assertGrounded` gate as suggestions.
3. **Full-history decomposition** (`decomposeHistory`), chaining the
   pairwise math across every bill on file — not just latest-vs-previous.
   Fixed a real bug this surfaced: several charts were reading
   IndexedDB/upload order, not chronological order.
4. **Real degree-day fetch** (`openMeteoDegreeDaySource`, no API key) +
   user-entered location (never scraped from a bill) + an "Is it the
   weather?" dashboard panel. This is `v0.2`'s degree-day piece landing
   early, by direct request — the regression fit (`fitWeatherModel`,
   baseload trend) is still a stub. Also wired the previously-stubbed
   export/import JSON to real UI buttons.
5. **Meter-reading history** (`packages/adapters/src/meter-readings`) — a
   third, independent data source: raw cumulative register readings
   exported from the utility's account portal (not the bill PDFs). New
   IndexedDB store, paste-in UI, usage-per-interval charts, and a cross-check
   against bill-parsed kWh/therms when reading dates closely bracket a
   bill's period. Meter IDs are on the same "never commit" list as account
   numbers — handled locally only, fake ones in the test fixture.

See devlog.md for the narrative version of all of this, including the
verification methodology (hand-derived arithmetic against the real bill,
independent weather corroboration via a second data source).

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
- **Deferred to v0.2 (partially landed — see Phase):** the degree-day fetch
  is real (`openMeteoDegreeDaySource`); still deferred: the
  `kWh = baseload + a·CDD + b·HDD` regression fit, baseload trend chart,
  scatter-vs-degree-days chart, baseload/weather rules, anomaly-flag
  refinement.
- **Deferred to v0.3:** additional utility adapters, refined anomaly
  detection.
- **Phase E (interfaces only, not implemented):** `TimeSeriesSource` for
  Green Button / sensor ingestion — stubbed in `packages/timeseries`.

## Target repo

`github.com/NiranEC77/electric-analyzer-dashboard` — pushed, `main`, CI
green, deployed to Vercel. See "Deploy / CI notes" below.

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

1. **Waiting on Niran:** the remaining ~13 real bills (only `feb26.pdf` has
   been shared for verification so far) — either drop the PDFs at
   `~/bill-samples/` on this machine, or use the new Export-JSON button on
   `/upload` once they're loaded in the browser, so a real multi-month
   history can be verified/analyzed end to end instead of demo data.
2. v0.2 regression: `fitWeatherModel` (still a stub) — fit
   `kWh = baseload + a·CDD + b·HDD` using `openMeteoDegreeDaySource`, add
   the baseload trend chart and scatter-vs-degree-days chart.
3. Hermes/local-agent research: tried once (`dispatch_to_hermes`), came back
   empty — matches an existing fleet note that Jarvis's web_search lacks an
   API key. `openMeteoDegreeDaySource` (free, no key) is filling that gap
   directly for now; if Hermes's search gets fixed, it (or NOAA GHCN) can
   implement `DegreeDaySource` and swap in — see docs/architecture.md.
4. Consider rotating the PAT to drop `workflow` scope once no further
   workflow edits are expected.
