import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decomposeHistory } from "../src/decomposition/index.js";
import { makeBill } from "./helpers.js";

describe("decomposeHistory", () => {
  it("returns undefined with fewer than two bills", () => {
    expect(decomposeHistory([])).toBeUndefined();
    expect(decomposeHistory([makeBill({ id: "a", kWh: 500 })])).toBeUndefined();
  });

  it("sorts internally: order of the input array doesn't matter", () => {
    const jan = makeBill({ id: "jan", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const feb = makeBill({ id: "feb", kWh: 500, electricSupplyCharge: 55, electricDeliveryCharge: 25 });
    const mar = makeBill({ id: "mar", kWh: 500, electricSupplyCharge: 60, electricDeliveryCharge: 25 });
    // Give them real distinct periods so sort is meaningful.
    jan.periodStart.value = "2026-01-01";
    feb.periodStart.value = "2026-02-01";
    mar.periodStart.value = "2026-03-01";

    const forward = decomposeHistory([jan, feb, mar]);
    const shuffled = decomposeHistory([mar, jan, feb]);

    expect(forward).toBeDefined();
    expect(shuffled).toBeDefined();
    expect(shuffled!.totalChange).toBeCloseTo(forward!.totalChange, 6);
    expect(shuffled!.periodStart).toBe("2026-01-01");
    expect(shuffled!.periodEnd).toBe("2026-03-01");
    expect(shuffled!.perPeriod).toHaveLength(2);
  });

  it("chains a rate hike followed by a rate cut back to baseline — history sees both, endpoints alone would not", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 80, electricDeliveryCharge: 25 }); // hike
    const c = makeBill({ id: "c", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 }); // back down
    a.periodStart.value = "2026-01-01";
    b.periodStart.value = "2026-02-01";
    c.periodStart.value = "2026-03-01";

    const history = decomposeHistory([a, b, c])!;

    // Endpoints are identical, so a naive first-vs-last comparison would show
    // zero change. The chained history must still show the real movement.
    expect(history.totalChange).toBeCloseTo(0, 6);
    expect(history.cumulativePriceEffect).toBeCloseTo(0, 6); // +30 then -30
    expect(Math.abs(history.perPeriod[0]!.supply.priceEffect)).toBeGreaterThan(20);
    expect(Math.abs(history.perPeriod[1]!.supply.priceEffect)).toBeGreaterThan(20);
  });

  it("property: cumulative effects always reconcile to endCharge - startCharge, for chains of any length", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kWh: fc.float({ min: 1, max: 3000, noNaN: true }),
            supply: fc.float({ min: 0, max: 1000, noNaN: true }),
            delivery: fc.float({ min: 0, max: 1000, noNaN: true }),
            fee: fc.float({ min: -100, max: 100, noNaN: true }),
          }),
          { minLength: 2, maxLength: 12 },
        ),
        (specs) => {
          const bills = specs.map((s, i) => {
            const bill = makeBill({
              id: `b${i}`,
              kWh: s.kWh,
              electricSupplyCharge: s.supply,
              electricDeliveryCharge: s.delivery,
              fixedAndOtherCharges: [{ label: "rider", amount: s.fee, category: "rider" }],
            });
            bill.periodStart.value = `2026-${String((i % 12) + 1).padStart(2, "0")}-01`;
            return bill;
          });

          const history = decomposeHistory(bills)!;
          const computed =
            history.cumulativePriceEffect + history.cumulativeConsumptionEffect + history.cumulativeFeesEffect;

          expect(Math.abs(computed - history.totalChange)).toBeLessThan(0.05);
          expect(Math.abs(history.totalChange - (history.endCharge - history.startCharge))).toBeLessThan(1e-6);
          expect(history.checksPassed).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
});
