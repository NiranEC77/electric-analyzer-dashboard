import type { Traced } from "@electric-analyzer/core";

export function tracedValue<T>(
  value: T,
  fileId: string,
  rawText: string,
  confidence = 0.8,
): Traced<T> {
  return { value, provenance: { fileId, page: 1, rawText }, confidence, userCorrected: false };
}

/** Extracts the first capture group as a number, with provenance from the full match. */
export function extractTraced(
  text: string,
  regex: RegExp,
  fileId: string,
  confidence = 0.8,
): Traced<number> | undefined {
  const m = regex.exec(text);
  if (!m || m[1] === undefined) return undefined;
  const value = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return undefined;
  return tracedValue(value, fileId, m[0], confidence);
}

export function extractTracedString(
  text: string,
  regex: RegExp,
  fileId: string,
  confidence = 0.8,
): Traced<string> | undefined {
  const m = regex.exec(text);
  if (!m || m[1] === undefined) return undefined;
  return tracedValue(m[1], fileId, m[0], confidence);
}
