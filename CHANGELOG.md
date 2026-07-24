# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Terse and
technical.

## [Unreleased]

### Added

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

### Deployed

- Live at `https://electric-analyzer-dashboard.vercel.app` (Vercel
  auto-deploys `main`).
