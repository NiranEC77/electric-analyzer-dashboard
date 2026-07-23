import type { BillFacts } from "@electric-analyzer/core";

export interface ParseResult {
  facts: Partial<BillFacts>;
  warnings: string[];
}

/**
 * PDF-to-text extraction (pdfjs-dist in the browser, per the project's
 * client-side-parsing decision) is deliberately kept out of this interface.
 * `parseText` takes already-extracted text and is pure/synchronous, so any
 * adapter — including new utility contributions — is unit-testable without
 * a browser or a PDF runtime. See docs/adapters.md.
 */
export interface UtilityAdapter {
  id: string;
  displayName: string;
  supports(sniffText: string): boolean;
  parseText(text: string, fileId: string): ParseResult;
}

export function detectAdapter(
  adapters: UtilityAdapter[],
  sniffText: string,
): UtilityAdapter | undefined {
  return adapters.find((a) => a.supports(sniffText));
}
