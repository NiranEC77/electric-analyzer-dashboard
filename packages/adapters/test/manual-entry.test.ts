import { describe, expect, it } from "vitest";
import { buildManualBillFacts } from "../src/manual-entry/index.js";

describe("buildManualBillFacts", () => {
  it("marks every field as userCorrected with full confidence", () => {
    const facts = buildManualBillFacts(
      {
        utility: "Test Utility",
        serviceType: "electric",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        electric: { kWh: 500, supplyCharge: 50, deliveryCharge: 25 },
        taxes: 5,
        totalCharge: 80,
      },
      "manual-1",
    );

    expect(facts.electric?.kWh.userCorrected).toBe(true);
    expect(facts.electric?.kWh.confidence).toBe(1);
    expect(facts.totalCharge.value).toBe(80);
    expect(facts.gas).toBeUndefined();
  });
});
