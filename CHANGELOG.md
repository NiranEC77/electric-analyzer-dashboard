# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Terse and
technical.

## [Unreleased]

### Added

- `packages/adapters/src/meter-readings`: parses a utility account portal's
  raw meter-reading-history export (distinct from bill PDF/CSV) and
  computes usage per interval from consecutive register deltas — an
  independent, finer-grained usage source. Non-monotonic readings (meter
  reset/misread) are skipped with a warning, never emitted as negative
  usage. New IndexedDB store, paste-in UI, and dashboard charts
  (`MeterUsageChart`) with a cross-check against bill-parsed usage when
  reading dates closely bracket a bill's period.
- Initial monorepo scaffold: pnpm workspaces (`packages/core`,
  `packages/adapters`, `packages/demo-data`, `packages/timeseries`,
  `apps/web`).
- `packages/core`: `Traced<T>` types, symmetric supply/delivery/fees
  decomposition (property test: effects sum to total change), numeral
  verifier (throws on unsourced numbers), price/fees/insufficient-data rules.
  Weather + anomaly modules stubbed.
- `packages/adapters`: `UtilityAdapter` interface + PSE&G, manual-entry, and
  CSV-import adapters, tested against synthetic fixtures.
- `packages/demo-data`: deterministic synthetic bill history for demo mode.
- `packages/timeseries`: `TimeSeriesSource` interface stub (Phase E).
- `apps/web`: Astro + React-islands dashboard — headline cards, waterfall,
  stacked composition, effective-rate charts; review-and-confirm upload;
  IndexedDB local-first storage; client-side PDF parsing (lazy-loaded).
- CI (secret-scan + typecheck/lint/test/build), pre-commit secret hook,
  root `vercel.json` for monorepo deploy.
- Repo hygiene: LICENSE (MIT), README, CONTRIBUTING, CLAUDE.md, STATE.md,
  devlog.md, docs (architecture/adapters/privacy/persistence-adapters),
  `.env.example`, `.gitignore` with PII/secret guardrails.

- PSE&G adapter rewritten from a real bill's actual layout (real bill never
  committed — synthetic fixture only). `BillFacts` gained
  `currentCharges`/`previousBalance`/`payments`; decomposition reconciles
  against current charges so a carried-over unpaid balance is never
  attributed to price/usage/fees. `apps/web/src/lib/pdf-text.ts` rewritten
  to coordinate-based line reconstruction (pdf.js was emitting one glyph per
  item on this bill).
- `packages/core/src/narrative`: `describeChange`/`describeHistory` turn a
  decomposition into grounded plain-language sentences (verified — no
  jargon like "price effect"). New `EffectShares` on `DecompositionResult`.
- `decomposeHistory()`: chains the pairwise decomposition across the whole
  bill history, not just the last two bills. New `MonthlyTotalsChart`
  (histogram) and `DriversOverTimeChart` (bill-by-bill rate/usage/fees
  breakdown).
- `openMeteoDegreeDaySource`: real, tested heating/cooling-degree-day fetch
  (Open-Meteo, no API key). New `apps/web/src/lib/location.ts`
  (user-entered, geocoded, localStorage-only — never scraped from a bill)
  and a "Is it the weather?" dashboard panel.
- Export/Import JSON wired to real buttons on `/upload` (was stubbed in the
  storage layer only).

### Fixed

- Several charts (`CompositionChart`, `MonthlyTotalsChart`, rate-line
  charts) were reading bills in IndexedDB/upload-insertion order instead of
  chronological order.
- The waterfall chart's start/end bars used `totalCharge` after
  decomposition moved to reconciling against `currentCharges` — they no
  longer matched on any bill carrying a balance. Now both use the same
  basis.

### Deployed

- Live at `https://electric-analyzer-dashboard.vercel.app` (Vercel
  auto-deploys `main`).
