import { describe, expect, it } from "vitest";
import { assertGrounded, UngroundedNumeralError, verifyNumerals } from "../src/verifier/index.js";
import { decompose } from "../src/decomposition/index.js";
import type { AnalysisContext } from "../src/types/index.js";
import { makeBill } from "./helpers.js";

function contextFor(a: ReturnType<typeof makeBill>, b: ReturnType<typeof makeBill>): AnalysisContext {
  return { bills: [a, b], decomposition: decompose(a, b), anomalies: [] };
}

describe("verifyNumerals", () => {
  it("passes when every numeral traces to a grounded fact", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 60, electricDeliveryCharge: 25 });
    const ctx = contextFor(a, b);

    const text = `Your bill changed by $${ctx.decomposition!.totalChange.toFixed(2)}, driven by a $${ctx
      .decomposition!.supply.priceEffect.toFixed(2)} price effect.`;

    expect(verifyNumerals(text, ctx).ok).toBe(true);
  });

  it("fails loudly on a numeral that doesn't trace to any fact", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 60, electricDeliveryCharge: 25 });
    const ctx = contextFor(a, b);

    const text = "You could save $42.17 per month by switching plans.";
    const result = verifyNumerals(text, ctx);

    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.numeral === 42.17)).toBe(true);
    expect(() => assertGrounded(text, ctx)).toThrow(UngroundedNumeralError);
  });
});
