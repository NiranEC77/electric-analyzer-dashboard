# Architecture

## The one rule everything serves

**No numeral reaches a chart or a suggestion unless it traces to a parsed
fact.** Every other decision here is downstream of that.

- Parsed values are wrapped in `Traced<T>` (`packages/core/src/types`) —
  value + provenance (file, page, raw text) + parser confidence + a
  `userCorrected` flag.
- The rules engine emits `Suggestion`s carrying `triggeringFacts` — the
  exact numbers that fired them.
- The **verifier** (`packages/core/src/verifier`) walks generated prose,
  extracts every numeral, and confirms each one resolves to a grounded value
  in the `AnalysisContext`. `assertGrounded()` throws
  `UngroundedNumeralError` — it never warns. The dashboard renders that
  failure loudly instead of the suggestion.

## Packages

| Package | Responsibility |
|---|---|
| `packages/core` | Decomposition math (single-pair and chained-history), verifier, narrative, rules engine, real degree-day fetch + weather-fit stub, anomaly stub. Framework-agnostic, dependency-light, runs in browser / serverless / CLI. |
| `packages/adapters` | `UtilityAdapter` interface + PSE&G / manual-entry / CSV implementations. Adapters see already-extracted text, never a browser or PDF runtime — so they're pure and unit-testable. |
| `packages/demo-data` | Deterministic synthetic bill history for demo mode. |
| `packages/timeseries` | `TimeSeriesSource` interface stub (Phase E). |
| `apps/web` | Astro + React-islands frontend. Owns the one browser-only seam (`lib/pdf-text.ts`, pdfjs) that turns a `File` into text before handing it to an adapter. |

## Data flow

```
PDF/CSV/manual
   │  (apps/web: pdf-text extraction, client-side only)
   ▼
UtilityAdapter.parseText  ──►  Partial<BillFacts> + warnings
   │  (review-and-confirm screen: user corrects misreads)
   ▼
BillFacts  ──►  IndexedDB (local-first)
   │
   ▼
analyze()  ──►  decompose() + rules  ──►  AnalysisContext
   │
   ▼
charts + suggestions  ──►  verifier gate  ──►  rendered
```

## Why static output / zero env vars

`apps/web` builds to static output. There's no server in the request path:
parsing, storage, decomposition, and rules all run in the browser against
IndexedDB. A fresh Vercel deploy therefore needs no environment variables,
and demo mode renders a full dashboard from `packages/demo-data` with no real
data. Supabase (multi-device sync) is an optional adapter behind the same
`PersistenceAdapter` interface — see
[persistence-adapters.md](persistence-adapters.md).

## Decomposition

Between two bills, per volumetric stream (supply and delivery, electric and
gas), split symmetrically so the effects sum exactly to the total change:

```
price_effect       = (P1 - P0) * (Q0 + Q1) / 2
consumption_effect = (Q1 - Q0) * (P0 + P1) / 2
```

Plus a `fees_effect` bucket for the change in fixed/non-volumetric charges
(customer charge, riders, surcharges, credits, taxes). A property test in
`packages/core/test` asserts the three effects always reconcile to the total
change within a tight epsilon.

`decomposeHistory()` chains this same pairwise math across every consecutive
bill on file and sums each bucket — deliberately not a single first-vs-last
comparison, which could hide a rate hike later offset by a cut. The chain
sum still reconciles exactly to `endCharge - startCharge`; see
`HistoryDecomposition` and its property test (chains of 2-12 bills).

## Weather (real fetch, model still deferred)

`packages/core/src/weather` has two distinct things, at different levels of
completeness:

- **`openMeteoDegreeDaySource`** — a real, tested implementation of the
  `DegreeDaySource` interface, backed by Open-Meteo's free historical
  weather archive (no API key). Given a lat/lon and a date range, it returns
  daily heating/cooling degree days (65°F base). `apps/web`'s "Is it the
  weather?" panel uses this to sanity-check a usage change against real
  temperature data for the user's explicitly-entered location
  (`apps/web/src/lib/location.ts` — geocoded client-side, stored only in
  `localStorage`, never inferred from a bill's service address).
- **`fitWeatherModel()`** — the v0.2 regression (`kWh = baseload + a·CDD +
  b·HDD`) that turns degree-days into a proper weather-normalized baseload
  trend. Still a stub that always returns `suppressed: true`. The degree-day
  *fetch* being real doesn't mean the *fit* is — don't conflate the two when
  reading dashboard copy.

### Plugging in another research source (e.g. a local agent)

Anything that can implement `DegreeDaySource`'s one method —
`fetch(lat, lon, start, end): Promise<DegreeDayPoint[]>` — can replace or
supplement `openMeteoDegreeDaySource`; nothing downstream (the dashboard
panel, a future `fitWeatherModel`) needs to change. If you run a local
research agent (e.g. Hermes) and want it as the source instead of a live
Open-Meteo call — useful for a private/offline deployment, or a source with
better station-level accuracy than a public archive's nearest grid point —
give it the same shape and swap it in. This project's own data is
local-first, so this kind of integration is necessarily something *you*
wire into *your* deployment (env-configured, off by default) rather than
something baked into the shared app — the same pattern as the Supabase
persistence adapter (see [persistence-adapters.md](persistence-adapters.md)).
