import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decompose } from "../src/decomposition/index.js";
import { describeChange } from "../src/narrative/index.js";
import { verifyNumerals } from "../src/verifier/index.js";
import type { AnalysisContext } from "../src/types/index.js";
import { makeBill } from "./helpers.js";

describe("describeChange", () => {
  it("says 'about the same' when nothing changed", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const narrative = describeChange(decompose(a, b));
    expect(narrative.headline).toMatch(/about the same/i);
  });

  it("attributes a pure rate hike to the rate, not usage", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 65, electricDeliveryCharge: 25 });
    const narrative = describeChange(decompose(a, b));
    expect(narrative.headline).toMatch(/went up/i);
    expect(narrative.explanation).toMatch(/rate you're charged/i);
    expect(narrative.explanation).not.toMatch(/how much energy/i);
  });

  it("never uses internal jargon like 'price effect' or 'consumption effect'", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 600, electricSupplyCharge: 65, electricDeliveryCharge: 30 });
    const narrative = describeChange(decompose(a, b));
    const text = `${narrative.headline} ${narrative.explanation}`;
    expect(text).not.toMatch(/effect/i);
    expect(text).not.toMatch(/decomposition/i);
  });

  it("property: every numeral in the narrative is grounded in the decomposition it describes", () => {
    fc.assert(
      fc.property(
        fc.record({
          kWhA: fc.float({ min: 1, max: 5000, noNaN: true }),
          kWhB: fc.float({ min: 1, max: 5000, noNaN: true }),
          supplyA: fc.float({ min: 0, max: 2000, noNaN: true }),
          supplyB: fc.float({ min: 0, max: 2000, noNaN: true }),
          deliveryA: fc.float({ min: 0, max: 2000, noNaN: true }),
          deliveryB: fc.float({ min: 0, max: 2000, noNaN: true }),
          feeA: fc.float({ min: -200, max: 200, noNaN: true }),
          feeB: fc.float({ min: -200, max: 200, noNaN: true }),
        }),
        ({ kWhA, kWhB, supplyA, supplyB, deliveryA, deliveryB, feeA, feeB }) => {
          const a = makeBill({
            id: "a",
            kWh: kWhA,
            electricSupplyCharge: supplyA,
            electricDeliveryCharge: deliveryA,
            fixedAndOtherCharges: [{ label: "rider", amount: feeA, category: "rider" }],
          });
          const b = makeBill({
            id: "b",
            kWh: kWhB,
            electricSupplyCharge: supplyB,
            electricDeliveryCharge: deliveryB,
            fixedAndOtherCharges: [{ label: "rider", amount: feeB, category: "rider" }],
          });

          const decomposition = decompose(a, b);
          const narrative = describeChange(decomposition);
          const context: AnalysisContext = { bills: [a, b], decomposition, anomalies: [] };

          const text = `${narrative.headline} ${narrative.explanation}`;
          const result = verifyNumerals(text, context, 0.02);
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
