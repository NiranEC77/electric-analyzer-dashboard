import { describe, expect, it } from "vitest";
import { generateDemoBills } from "../src/index.js";
import { decompose } from "@electric-analyzer/core";

describe("generateDemoBills", () => {
  it("generates the requested number of chronologically ordered bills", () => {
    const bills = generateDemoBills(24);
    expect(bills).toHaveLength(24);
    const starts = bills.map((b) => b.periodStart.value);
    expect(starts).toEqual([...starts].sort());
  });

  it("every bill's totalCharge equals the sum of its own line items", () => {
    for (const bill of generateDemoBills(24)) {
      const sum =
        (bill.electric ? bill.electric.supplyCharge.value + bill.electric.deliveryCharge.value : 0) +
        (bill.gas ? bill.gas.supplyCharge.value + bill.gas.deliveryCharge.value : 0) +
        bill.fixedAndOtherCharges.reduce((s, c) => s + c.amount.value, 0) +
        bill.taxes.value;
      expect(Math.abs(sum - bill.totalCharge.value)).toBeLessThan(0.01);
    }
  });

  it("produces a rate hike that decomposition attributes to price, not usage", () => {
    const bills = generateDemoBills(24);
    const before = bills[12]!;
    const after = bills[13]!;
    const result = decompose(before, after);
    const priceEffect = result.supply.priceEffect + result.delivery.priceEffect;
    expect(priceEffect).toBeGreaterThan(0);
    expect(priceEffect).toBeGreaterThan(Math.abs(result.feesEffect));
  });

  it("produces an expired credit that decomposition attributes to fees", () => {
    const bills = generateDemoBills(24);
    const before = bills[9]!;
    const after = bills[10]!;
    const result = decompose(before, after);
    expect(result.feesEffect).toBeGreaterThan(0);
  });
});
