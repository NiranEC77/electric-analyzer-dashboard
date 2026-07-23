# Persistence adapters

By default there is **no backend**. Parsed bills live in your browser's
IndexedDB, and a fresh deploy needs zero environment variables. This document
covers the *optional* path: syncing across devices via a persistence adapter.

## The interface

```ts
interface PersistenceAdapter {
  id: string;
  getAllBills(): Promise<BillFacts[]>;
  putBill(bill: BillFacts): Promise<void>;
  deleteBill(id: string): Promise<void>;
}
```

The default implementation is `indexedDbAdapter`
(`apps/web/src/lib/storage/indexeddb.ts`). Any alternative — Supabase,
Postgres/Neon, anything — implements the same three methods and nothing else
in the app changes.

## Supabase (multi-device sync) — optional, off by default

> Status: interface is in place; the Supabase adapter is planned for a later
> release (v0.3). This section documents the intended shape so the contract is
> clear now.

When enabled, the app detects Supabase env vars at runtime and routes
persistence through a Supabase-backed `PersistenceAdapter` instead of
IndexedDB. If the vars are absent, it silently stays local-first — so the
"zero required env vars, demo mode works out of the box" guarantee holds
either way.

Configuration (your own project, your own keys — never committed):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

These belong in your deployment's environment (e.g. Vercel project settings)
or a local `.env` (which is gitignored). See `.env.example` for the shape.

## Why local-first is the default

It makes the privacy guarantee **structural** rather than a policy promise: if
bills never leave the browser, there's no server-side store to leak. Sync is
a deliberate opt-in you point at infrastructure you control. See
[privacy.md](privacy.md).
