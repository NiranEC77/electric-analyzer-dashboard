# CLAUDE.md — project rules for this repo

Read this before touching anything. See also @STATE.md for where things
currently stand and @devlog.md for the running narrative.

## Non-negotiables

1. **Grounding.** Every numeral in any chart, brief, or suggestion must trace
   to a parsed fact in the data layer (`Traced<T>` in
   @packages/core/src/types). No model-generated numbers. The verifier
   (@packages/core/src/verifier) checks every numeral in generated prose
   against the facts store and fails loudly on anything unsourced — never
   soften this into a warning.
2. **Zero PII in the repo.** This repo is the system, not data. Never commit
   bill PDFs, parsed bills, account numbers, addresses, meter IDs,
   coordinates, API keys, or `.env` files. All test fixtures are synthetic
   and redacted. Location/utility/rate settings are runtime config, never
   hardcoded. Enforced by @.gitignore, @scripts/secret-scan.sh
   (pre-commit + CI).
3. **Secrets.** Read GitHub/Vercel/Supabase credentials from environment
   variables at use time only. Never ask for them in chat, never echo them,
   never write them to a file or log line. If a GitHub PAT's scope needs to
   change, it gets regenerated — never edited in place.
4. **Local-first by default.** Parsed facts live in the user's browser
   (IndexedDB). Supabase is an optional, documented, pluggable persistence
   adapter (@docs/persistence-adapters.md) — off by default. A fresh Vercel
   deploy must work with zero required environment variables; demo mode
   (@packages/demo-data) proves it.
5. **Suggestions are deterministic, not generative.** The rules engine
   (@packages/core/src/rules) is a fixed set of pure functions over computed
   facts. No LLM in that path. No invented savings estimates — payback
   numbers only come from user-entered assumptions with the math shown.

## Architecture at a glance

- `packages/core` — framework-agnostic analysis engine: decomposition math,
  weather normalization, anomaly detection, rules engine, verifier. Runs
  unmodified in browser / serverless / CLI. Deepest test coverage in the
  repo lives here.
- `packages/adapters` — `UtilityAdapter` interface + implementations
  (PSE&G, manual entry, CSV import). This is the main extensibility surface
  for other deployers — see @docs/adapters.md.
- `packages/demo-data` — seeded synthetic bill history so demo mode works
  with no real data.
- `packages/timeseries` — `TimeSeriesSource` interface, stubbed for a future
  phase (Green Button / sensor ingestion). Don't implement ahead of need.
- `apps/web` — Astro + React islands frontend, deploys to Vercel.

## Decomposition math (do not drift from this)

Volumetric charges split symmetrically so effects sum exactly to the total
change (assert residual ≈ 0), run separately for supply and delivery:

```
price_effect       = (P1 - P0) * (Q0 + Q1) / 2
consumption_effect = (Q1 - Q0) * (P0 + P1) / 2
```

Plus a third bucket, `fees_effect`, for the change in fixed/non-volumetric
charges. Any change to this needs the property test in
`packages/core/test` to keep passing.

## Working conventions

- Conventional commits, small and reviewable. Commits attributed to "Niran"
  with his noreply email.
- Don't add abstractions, error handling, or scope beyond the current phase.
  See @STATE.md for current phase and locked v0.1 scope.
- Weather normalization, baseload trend, and the full rules engine are
  deliberately deferred to v0.2 — don't build them into v0.1 PRs.
