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

## 2026-07-23 — Full v0.1 scaffold, pushed, deployed

Built the whole lean MVP in one pass and got it green end to end: core
(decomposition + verifier + rules, 10 tests incl. a 500-run property test
proving the three effects always reconcile to the total change), adapters
(PSE&G/manual/CSV against synthetic fixtures), demo-data, the Astro + React
dashboard, CI, and the pre-commit secret hook. 21 tests, lint clean, build
clean.

A few things worth remembering for the blog:

- **The verifier earned its keep conceptually but so did testing the
  secret-scanner.** My first `secret-scan.sh` had two bugs I only caught by
  actually running it against planted secrets: it false-positived on
  `.env.example` (matched the *variable name* `SUPABASE_ANON_KEY`, not a
  value) and it *missed* a real account number because the regex was
  lowercase and grep wasn't case-insensitive. Rewrote it to match secret
  *values* (JWTs, `ghp_`/`github_pat_` tokens, PEM blocks) and made the
  account scan case-insensitive. Lesson: a guardrail you didn't try to break
  is not a guardrail.
- **`exactOptionalPropertyTypes` fought the domain.** Adapters produce
  "maybe this field parsed" partials; that flag turns every optional into
  ceremony. Dropped it.
- **Two failures that only show up off your laptop.** CI died on the first
  push because pnpm was version-pinned in *both* the workflow and
  `packageManager` (action-setup rejects that). Then Vercel errored because
  it built from the repo root and never found the Astro app in `apps/web`
  ("No Output Directory named public") — fixed with a root `vercel.json`
  pointing at the workspace build and `apps/web/dist`. Both are the class of
  bug local green never catches.
- **Secret hygiene under a real PAT.** Token lived only in
  `~/.secrets/github.env` (600, owned by the tool user), sourced at push
  time, redacted from all output; never written to `.git/config`. Amusing
  detour: the first paste was mangled by terminal *focus-event* escape
  sequences (`ESC[I`/`ESC[O`) landing in stdin ahead of the token — 99 chars
  instead of 93, 401 every time — until we disabled focus reporting and
  pattern-extracted the real `github_pat_`.

Live at `https://electric-analyzer-dashboard.vercel.app`. v0.2 (weather
normalization) is the next real chunk.
