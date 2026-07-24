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

## 2026-07-23/24 — Real bills, real bugs, and a trust audit

Niran tried uploading his actual 14 monthly PSE&G bills. All 14 failed:
"no adapter recognized this bill." The v0.1 PSE&G adapter had been an
honest stub — regex patterns modeled on a *generic* utility-bill layout,
explicitly commented as never having seen a real bill (real bills can't
enter the repo). Time to fix that properly rather than guess again.

Niran shared one real bill (`/tmp/feb26.pdf`, never committed, deleted from
scratch dirs after use). Reading it top to bottom found three independent,
concrete bugs, not one vague "parsing is hard":

1. The sniff regex was exact-matching `PSE&G`, but pdf.js fragments that
   into `PSE &G` — never matched.
2. pdf.js was emitting this particular bill **one glyph per text item**
   (`"T o t a l   e l e c t r i c"` after a naive `join(" ")`). Rewrote
   extraction to group glyphs into lines by y-coordinate and space only on
   real horizontal gaps — recovered clean text, verified against the real
   bill through the actual browser code path (0 warnings after the fix).
3. The adapter's field patterns didn't match the real layout at all — full
   rewrite from the actual bill structure (multi-column, apostrophes
   flattened to spaces by the PDF text layer, a `previous balance / payment
   received / this month's charges / total due` structure that the v0.1
   stub had no concept of).

That last point turned into a real modeling gap: PSE&G bills carry an
unpaid balance forward. The original decomposition compared *total amount
due* period to period, so a late payment would show up as a huge fake
"price/usage/fees increase." Added `currentCharges` / `previousBalance` /
`payments` to `BillFacts` and moved decomposition to reconcile against
current charges only — carryover shows in its own banner instead of
polluting the analysis.

Then two rounds of "this isn't clear" feedback, both handled by adding real
grounded output rather than restyling:

- **"the graphs are not clear and neither the explanations."** Added a
  `packages/core/src/narrative` module — deterministic plain-English
  sentences ("Your bill went up $67.58... mostly because of how much energy
  you used") verified through the exact same `assertGrounded` gate as
  suggestions, plus a real histogram (bill-over-time bar chart). Property
  test asserts the narrative never emits a numeral that isn't grounded, 300
  runs.
- **"this only analyzes this month vs last... we want the whole history."**
  `decomposeHistory()` chains the existing pairwise decomposition across
  every consecutive bill instead of comparing two endpoints — deliberately,
  since comparing first-vs-last would hide a rate hike that got reversed
  later (wrote a test with exactly that scenario to prove it). Surfaced a
  real bug while wiring this up: several charts were reading bills in
  IndexedDB/upload-insertion order, not chronological order.

Then a direct ask: **"check the numbers... I want to know if it's
trustable. Also I wonder if it's correlated to weather."** Rather than
re-assert the automated tests were enough, re-derived every number in the
real bill by hand against the source text (all matched — found one honest
methodology caveat: PSE&G bundles the flat monthly service charge inside
the volumetric delivery total, which the model currently treats as
volumetric too). For weather: tried dispatching to Hermes first (per
Niran's ask) — came back empty, consistent with an existing fleet note
that Jarvis's web_search lacks an API key. Fell back to Open-Meteo's free
historical archive (no key) and independently computed the actual
degree-day comparison rather than trusting either source blindly: 7.2°F
colder by direct computation vs. PSE&G's own printed "6°F colder" — close
enough to trust both. But heating degree-days were only up 19.5% while gas
usage was up 31.9% and electric 14.9% — weather explains a good chunk of
the gas increase, not all of it, and barely explains electric on a
gas-heated home. That gap is the actual signal worth investigating
(always-on load), not "it was just cold."

Turned that into a real feature, not a one-off chat answer, per "I want the
stuff to be in the system we are creating": `openMeteoDegreeDaySource` as a
tested, real implementation of the already-stubbed `DegreeDaySource`
interface; a user-entered (never bill-scraped) location, geocoded
client-side and stored only in `localStorage`; a dashboard panel comparing
bill periods against real degree-days. Also finally wired the long-stubbed
export/import JSON to actual buttons — the sanctioned way data leaves the
local-first browser store, which is also the answer to "how do I connect
this to my local agents/lab": export, then hand the file to whatever you
run yourself. The full weather-normalization regression fit
(`fitWeatherModel`) stays an honest stub — real degree-days now, real
baseload-vs-weather model still ahead.

38 tests, all green throughout. Still waiting on the other 13 real bills to
verify a real multi-month history end to end instead of demo data.

While asking about weather, Niran mentioned he also has meter readings —
turned out to be a third, independent data source: a raw cumulative
register-reading history exported from PSE&G's account portal (date,
service, meter ID, reading type, register value), not the bill PDFs at
all. Worth pausing to confirm scope before building, since "meter readings"
could just as easily have meant his own more-frequent manual/smart-meter
log — a much bigger interval-data-ingestion feature that the already-stubbed
`packages/timeseries` (`TimeSeriesSource`, untouched) is specifically
reserved for. Asked; it was the portal export.

Built `packages/adapters/src/meter-readings`: parses the tab-separated
export, computes usage per interval from consecutive same-service register
deltas. One real-world edge case handled deliberately rather than
papered over: meters occasionally read lower than the prior reading (reset,
misread) — rather than emit negative usage, that interval is skipped and
reported as a warning. New IndexedDB store, a paste-in textarea (matches
how the data actually arrives — copied text, not a file), dashboard charts,
and a cross-check against bill-parsed kWh/therms whenever a reading
interval's dates closely bracket a bill's period — deliberately not claimed
when the dates don't actually align closely, rather than fuzzy-matching and
overclaiming precision.

Meter IDs are explicitly on this project's own "never commit" PII list
(same tier as account numbers). Grepped the final diff for both of Niran's
real meter IDs before committing — clean; the committed test fixture uses
invented ones.
