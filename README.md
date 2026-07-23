# Electric Analyzer Dashboard

Open-source utility bill analytics that answers one question: **why is my
electric/gas bill going up?** Upload your bills, get a decomposition of the
increase into price vs. consumption vs. fees, weather-normalized usage
trends, and grounded next-step suggestions — no numbers ever appear that
don't trace back to something parsed from your actual bills.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/NiranEC77/electric-analyzer-dashboard)

## 60-second quickstart

```bash
git clone https://github.com/NiranEC77/electric-analyzer-dashboard.git
cd electric-analyzer-dashboard
pnpm install
pnpm dev
```

Open `http://localhost:4321` — you'll land in **demo mode** with a fully
populated dashboard built from seeded synthetic bills. No account, no API
key, no database. Upload your own bills when you're ready; everything stays
in your browser (IndexedDB) unless you explicitly opt into the Supabase sync
adapter — see [docs/persistence-adapters.md](docs/persistence-adapters.md).

## Why this exists

Utility bills bundle rate changes, usage changes, and fee/surcharge changes
into one number. This project decomposes that number, grounded entirely in
what's actually on your bills:

- **Price effect** — did the $/kWh or $/therm rate change?
- **Consumption effect** — did you use more or less?
- **Fees effect** — did fixed charges, riders, surcharges, or credits change?

Every chart traces back to a parsed fact with provenance (which file, which
line). A verifier step checks every numeral in any generated text against the
facts store and fails loudly on anything unsourced — see
[docs/architecture.md](docs/architecture.md) for how that's enforced.

## Project layout

```
apps/web/          Astro + React islands frontend, deploys to Vercel
packages/core/      Framework-agnostic analysis engine (decomposition, weather
                     normalization, rules engine, numeral verifier)
packages/adapters/   Utility bill parsers behind a common interface
packages/demo-data/  Seeded synthetic bill history for demo mode
packages/timeseries/ Interval-data source interface (stubbed, future phase)
```

## Contributing a utility adapter

The main extensibility point is `packages/adapters` — see
[docs/adapters.md](docs/adapters.md) for the interface and a worked example.

## Privacy

This repo is the system, not your data. See
[docs/privacy.md](docs/privacy.md) for the guarantees and how they're
enforced (gitignore rules, pre-commit hook, CI secret scan).

## License

MIT — see [LICENSE](LICENSE).
