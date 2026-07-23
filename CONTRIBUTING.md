# Contributing

## Ground rules

1. **No numeral without provenance.** Anything that reaches a chart or a
   suggestion must trace back to a `Traced<T>` fact in `packages/core`. If
   you're adding a rule or a chart and can't point at the fact it came from,
   it doesn't ship.
2. **No PII in the repo, ever.** No real bills, no parsed bill data, no
   account numbers, no addresses, no coordinates. All fixtures under
   `packages/adapters/test/fixtures` are synthetic and redacted. The
   pre-commit hook (`scripts/secret-scan.sh`) and CI both block `*.pdf`,
   `/data/**`, and `.env*`.
3. **Location/utility/rate settings are runtime config**, entered by the
   user at use time — never hardcoded into adapters, tests, or demo data
   beyond clearly-synthetic examples.

## Adding a utility adapter

This is the main way to extend the project. See
[docs/adapters.md](docs/adapters.md) for the `UtilityAdapter` interface and
a walkthrough building one against a synthetic fixture.

## Working in the analysis core

`packages/core` is dependency-light and framework-agnostic on purpose — it
has to run unmodified in the browser, in a Vercel serverless function, and
from a CLI. Don't reach for browser or Node-only APIs there.

The decomposition math (`packages/core/src/decomposition`) and the verifier
(`packages/core/src/verifier`) carry the deepest test coverage in the repo,
including a property test asserting price + consumption + fees effects
always sum to the total change within a tight epsilon. Any change to that
math needs a passing property test, not just example-based tests.

## Commit style

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, ...), small
and reviewable. Run `pnpm typecheck && pnpm lint && pnpm test` before opening
a PR — CI runs the same three plus a secret scan.
