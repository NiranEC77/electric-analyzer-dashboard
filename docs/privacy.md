# Privacy

## The stance

**This repo is the system, not your data.** No real bill ever needs to enter
it, and the tooling actively blocks it.

## Where your data lives

- Parsed bills live in **your browser** (IndexedDB). Nothing is uploaded.
- PDF parsing happens **client-side** — the file's bytes never leave the tab.
- Export/import is JSON you save locally, for backup and portability.
- Optional Supabase sync is **off by default** and, when enabled, points at
  *your own* project via *your own* env vars — see
  [persistence-adapters.md](persistence-adapters.md).

## What must never be committed

Bill PDFs, parsed bills, account numbers, addresses, meter IDs, coordinates,
API keys, `.env` files. All test fixtures are synthetic and redacted.
Location / utility / rate details are runtime config the user enters, never
hardcoded.

## How that's enforced

- **`.gitignore`** blocks `*.pdf`, `/data/**`, `**/user-data/**`, and every
  `.env*` except `.env.example`.
- **`scripts/secret-scan.sh`** runs two ways:
  - as a **pre-commit hook** (`bash scripts/install-hooks.sh` to install)
    against staged files, and
  - in **CI** against the whole tree.
  It blocks the paths above plus content matching account-number-like and
  credential patterns.
- **Secrets** (GitHub PAT, Vercel, Supabase) are read from environment
  variables at use time only — never requested in chat, echoed, written to a
  file, or committed.

If the scanner false-positives on a synthetic fixture, put it under a
`fixtures/` directory (excluded from the content scan) or redact the value.
