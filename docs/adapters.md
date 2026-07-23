# Writing a utility adapter

Adapters are the main extensibility point. An adapter turns the **text of one
bill** into a `Partial<BillFacts>` plus warnings. It never touches a PDF, a
browser, or the network — the app extracts text first (`apps/web/src/lib/pdf-text.ts`),
so your adapter is a pure function and trivially unit-testable.

## The interface

```ts
interface UtilityAdapter {
  id: string;                                   // "pseg-electric-gas"
  displayName: string;
  supports(sniffText: string): boolean;         // cheap header check
  parseText(text: string, fileId: string): ParseResult;
}

interface ParseResult {
  facts: Partial<BillFacts>;   // partial — the user confirms on the review screen
  warnings: string[];          // say what you COULDN'T find; never guess
}
```

Two rules that matter:

1. **Wrap every extracted number in `Traced<T>`** with provenance (use the
   `extractTraced` / `tracedValue` helpers in `packages/adapters/src/trace.ts`).
   A bare number can't be verified and won't be allowed near a chart.
2. **Warn instead of guessing.** If the delivery charge isn't found, push a
   warning and leave the field undefined. The review-and-confirm screen lets
   the user fill it in; a silent zero would corrupt the decomposition.

## Worked example (PSE&G)

See `packages/adapters/src/pseg/index.ts`. It:

- `supports()` — matches `/PSE&G|Public Service Electric/i` in the text.
- `parseText()` — runs labeled regexes for period, kWh, supply/delivery,
  therms, customer charge, tax, and total; wraps each hit in `Traced` with the
  matched substring as `rawText`; collects a warning for every field it
  couldn't locate.

Its test (`packages/adapters/test/pseg.test.ts`) runs against a **synthetic,
redacted** fixture (`test/fixtures/synthetic-pseg-bill.txt`). Real bills must
never enter the repo — see [privacy.md](privacy.md).

## Steps to add one

1. Create `packages/adapters/src/<your-utility>/index.ts` implementing
   `UtilityAdapter`.
2. Add a synthetic fixture under `test/fixtures/` and a test asserting each
   field parses with provenance, plus a "nothing parseable → warnings" case.
3. Export it from `packages/adapters/src/index.ts` and register it in the
   uploader's adapter list (`apps/web/src/islands/UploadBills.tsx`).
4. `pnpm -r test && pnpm lint && pnpm -r typecheck`.

If a bill format is too irregular for regex, that's fine — manual entry and
CSV import are the documented fallbacks, and the review screen exists exactly
for low-confidence parses.
