import type { DecompositionResult } from "../types/index.js";

export interface ChangeNarrative {
  /** One-line headline: the bill went up/down by how much. */
  headline: string;
  /** Plain-language explanation of what mostly drove it, ranked by share. */
  explanation: string;
}

const NEAR_ZERO = 0.005;

/**
 * Turns a DecompositionResult into two grounded, human-readable sentences —
 * no jargon like "price effect" or "consumption effect", no invented
 * numbers. Every numeral used here (totalChange, shares.*) already lives on
 * the DecompositionResult and is checked by the verifier like any other
 * generated text. Deterministic template, not an LLM — same discipline as
 * the rules engine.
 */
export function describeChange(d: DecompositionResult): ChangeNarrative {
  const change = d.totalChange;
  const amount = Math.abs(change).toFixed(2);

  if (Math.abs(change) < NEAR_ZERO) {
    return {
      headline: "Your bill was about the same as last time.",
      explanation: "Rates, usage, and fees were all essentially unchanged.",
    };
  }

  const direction = change > 0 ? "went up" : "went down";
  const headline = `Your bill ${direction} $${amount} compared to your last bill.`;

  const buckets = [
    { label: "how much energy you used", pct: d.shares.consumption },
    { label: "the rate you're charged", pct: d.shares.price },
    { label: "fees and credits", pct: d.shares.fees },
  ].sort((a, b) => b.pct - a.pct);

  const [top, second, third] = buckets as [typeof buckets[number], typeof buckets[number], typeof buckets[number]];

  let explanation: string;
  if (top.pct === 0) {
    explanation = "The change was too small to attribute to any single cause.";
  } else if (top.pct >= 90) {
    explanation = `That's almost entirely because of ${top.label} — it explains about ${top.pct}% of the change.`;
  } else if (second.pct === 0) {
    explanation = `That's because of ${top.label} — it explains about ${top.pct}% of the change; the rest wasn't attributable to a single cause.`;
  } else if (third.pct === 0) {
    explanation = `Mostly because of ${top.label} (about ${top.pct}% of the change), with ${second.label} making up the rest (about ${second.pct}%).`;
  } else {
    explanation = `Mostly because of ${top.label} (about ${top.pct}% of the change). ${
      second.label.charAt(0).toUpperCase() + second.label.slice(1)
    } explains about ${second.pct}%, and ${third.label} about ${third.pct}%.`;
  }

  return { headline, explanation };
}
