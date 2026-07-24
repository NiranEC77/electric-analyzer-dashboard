import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decompose } from "../src/decomposition/index.js";
import { makeBill } from "./helpers.js";

describe("decompose", () => {
  it("attributes a pure rate increase entirely to priceEffect", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 60, electricDeliveryCharge: 25 });
    const result = decompose(a, b);

    expect(result.supply.priceEffect).toBeCloseTo(10, 6);
    expect(result.supply.consumptionEffect).toBeCloseTo(0, 6);
    expect(result.checksPassed).toBe(true);
  });

  it("attributes a pure usage increase entirely to consumptionEffect", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 600, electricSupplyCharge: 60, electricDeliveryCharge: 30 });
    const result = decompose(a, b);

    // rate is flat at $0.10/kWh + $0.05/kWh in both periods, so all $15 of
    // increase should land in consumptionEffect, not priceEffect
    expect(result.supply.priceEffect).toBeCloseTo(0, 6);
    expect(result.delivery.priceEffect).toBeCloseTo(0, 6);
    expect(result.supply.consumptionEffect + result.delivery.consumptionEffect).toBeCloseTo(15, 6);
  });

  it("attributes an expired credit entirely to feesEffect", () => {
    const a = makeBill({
      id: "a",
      kWh: 500,
      electricSupplyCharge: 50,
      electricDeliveryCharge: 25,
      fixedAndOtherCharges: [{ label: "efficiency-credit", amount: -20, category: "credit" }],
    });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const result = decompose(a, b);

    expect(result.feesEffect).toBeCloseTo(20, 6);
    expect(result.supply.priceEffect + result.supply.consumptionEffect).toBeCloseTo(0, 6);
    expect(result.delivery.priceEffect + result.delivery.consumptionEffect).toBeCloseTo(0, 6);
  });

  it("ignores a carried-over unpaid balance: decomposes current charges, not amount due", () => {
    // Identical usage/rates both months. Month B carries an unpaid balance
    // from month A, so its total amount due is far higher — but nothing about
    // price, usage, or fees changed. The decomposition must report ~0 change.
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({
      id: "b",
      kWh: 500,
      electricSupplyCharge: 50,
      electricDeliveryCharge: 25,
      previousBalance: 75,
      payments: 0,
    });

    // Sanity: amount due really did jump by the carried balance.
    expect(b.totalCharge.value - a.totalCharge.value).toBeCloseTo(75, 6);

    const result = decompose(a, b);
    expect(result.totalChange).toBeCloseTo(0, 6);
    expect(result.supply.priceEffect + result.supply.consumptionEffect).toBeCloseTo(0, 6);
    expect(result.delivery.priceEffect + result.delivery.consumptionEffect).toBeCloseTo(0, 6);
    expect(result.feesEffect).toBeCloseTo(0, 6);
    expect(result.checksPassed).toBe(true);
  });

  it("property: price + consumption + fees effects always sum to totalChange", () => {
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
          taxA: fc.float({ min: 0, max: 100, noNaN: true }),
          taxB: fc.float({ min: 0, max: 100, noNaN: true }),
        }),
        ({ kWhA, kWhB, supplyA, supplyB, deliveryA, deliveryB, feeA, feeB, taxA, taxB }) => {
          const a = makeBill({
            id: "a",
            kWh: kWhA,
            electricSupplyCharge: supplyA,
            electricDeliveryCharge: deliveryA,
            fixedAndOtherCharges: [{ label: "rider", amount: feeA, category: "rider" }],
            taxes: taxA,
          });
          const b = makeBill({
            id: "b",
            kWh: kWhB,
            electricSupplyCharge: supplyB,
            electricDeliveryCharge: deliveryB,
            fixedAndOtherCharges: [{ label: "rider", amount: feeB, category: "rider" }],
            taxes: taxB,
          });

          const result = decompose(a, b);
          const sumOfEffects =
            result.supply.priceEffect +
            result.supply.consumptionEffect +
            result.delivery.priceEffect +
            result.delivery.consumptionEffect +
            result.feesEffect;

          expect(Math.abs(sumOfEffects - result.totalChange)).toBeLessThan(0.01);
          expect(Math.abs(result.supply.residual)).toBeLessThan(1e-6);
          expect(Math.abs(result.delivery.residual)).toBeLessThan(1e-6);
          expect(result.checksPassed).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
