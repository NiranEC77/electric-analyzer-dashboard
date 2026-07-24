import type { EffectShares, HistoryDecomposition, Movement } from "../types/index.js";

export interface ChangeNarrative {
  /** One-line headline: the bill went up/down by how much. */
  headline: string;
  /** Plain-language explanation of what mostly drove it, ranked by share. */
  explanation: string;
}

const NEAR_ZERO = 0.005;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Shared by describeChange and describeHistory: turns shares into one plain sentence. */
function explainShares(shares: EffectShares): string {
  const buckets = [
    { label: "how much energy you used", pct: shares.consumption },
    { label: "the rate you're charged", pct: shares.price },
    { label: "fees and credits", pct: shares.fees },
  ].sort((a, b) => b.pct - a.pct);

  const [top, second, third] = buckets as [typeof buckets[number], typeof buckets[number], typeof buckets[number]];

  if (top.pct === 0) {
    return "The change was too small to attribute to any single cause.";
  }
  if (top.pct >= 90) {
    return `That's almost entirely because of ${top.label} — it explains about ${top.pct}% of the change.`;
  }
  if (second.pct === 0) {
    return `That's because of ${top.label} — it explains about ${top.pct}% of the change; the rest wasn't attributable to a single cause.`;
  }
  if (third.pct === 0) {
    return `Mostly because of ${top.label} (about ${top.pct}% of the change), with ${second.label} making up the rest (about ${second.pct}%).`;
  }
  return `Mostly because of ${top.label} (about ${top.pct}% of the change). ${capitalize(second.label)} explains about ${second.pct}%, and ${third.label} about ${third.pct}%.`;
}

/**
 * Turns a Movement (a net change + what drove it — satisfied by a single
 * DecompositionResult, or a HistoryDecomposition) into two grounded,
 * human-readable sentences — no jargon like "price effect", no invented
 * numbers. Every numeral used here already lives on the object it describes
 * and is checked by the verifier like any other generated text.
 * Deterministic template, not an LLM — same discipline as the rules engine.
 */
export function describeChange(movement: Movement, referenceLabel = "your last bill"): ChangeNarrative {
  const change = movement.totalChange;
  const amount = Math.abs(change).toFixed(2);

  if (Math.abs(change) < NEAR_ZERO) {
    return {
      headline: `Your bill has stayed about the same, compared to ${referenceLabel}.`,
      explanation: "Rates, usage, and fees were all essentially unchanged.",
    };
  }

  const direction = change > 0 ? "went up" : "went down";
  return {
    headline: `Your bill ${direction} $${amount}, compared to ${referenceLabel}.`,
    explanation: explainShares(movement.shares),
  };
}

/**
 * The full-history version: describes the net change from your earliest bill
 * on file to your latest, using the chained decomposition (see
 * HistoryDecomposition) so every rate hike and cut along the way counts,
 * not just the two endpoints.
 */
export function describeHistory(history: HistoryDecomposition): ChangeNarrative {
  const change = history.totalChange;
  const amount = Math.abs(change).toFixed(2);

  if (Math.abs(change) < NEAR_ZERO) {
    return {
      headline: "Across all the bills you have on file, your bill has stayed about the same overall.",
      explanation: "Rates, usage, and fees have roughly balanced out over this period.",
    };
  }

  const direction = change > 0 ? "up" : "down";
  return {
    headline: `Across all the bills you have on file, your bill is ${direction} $${amount} overall.`,
    explanation: explainShares(history.shares),
  };
}
