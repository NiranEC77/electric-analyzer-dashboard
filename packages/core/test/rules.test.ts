import { describe, expect, it } from "vitest";
import { evaluateRules } from "../src/rules/index.js";
import { decompose } from "../src/decomposition/index.js";
import type { AnalysisContext } from "../src/types/index.js";
import { makeBill } from "./helpers.js";

describe("evaluateRules", () => {
  it("fires insufficient-data with fewer than two bills", () => {
    const ctx: AnalysisContext = { bills: [makeBill({ id: "a", kWh: 500 })], anomalies: [] };
    const suggestions = evaluateRules(ctx);
    expect(suggestions.map((s) => s.id)).toContain("insufficient-data");
  });

  it("fires price-effect-dominant when a rate hike explains most of the change", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 505, electricSupplyCharge: 80, electricDeliveryCharge: 25 });
    const ctx: AnalysisContext = { bills: [a, b], decomposition: decompose(a, b), anomalies: [] };

    const suggestions = evaluateRules(ctx);
    expect(suggestions.map((s) => s.id)).toContain("price-effect-dominant");
    expect(suggestions.map((s) => s.id)).not.toContain("fees-effect-dominant");
  });

  it("fires fees-effect-dominant when a fee/credit change explains most of the change", () => {
    const a = makeBill({
      id: "a",
      kWh: 500,
      electricSupplyCharge: 50,
      electricDeliveryCharge: 25,
      fixedAndOtherCharges: [{ label: "efficiency-credit", amount: -30, category: "credit" }],
    });
    const b = makeBill({ id: "b", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const ctx: AnalysisContext = { bills: [a, b], decomposition: decompose(a, b), anomalies: [] };

    const suggestions = evaluateRules(ctx);
    expect(suggestions.map((s) => s.id)).toContain("fees-effect-dominant");
  });

  it("every suggestion's triggering facts resolve to real numbers, never invented ones", () => {
    const a = makeBill({ id: "a", kWh: 500, electricSupplyCharge: 50, electricDeliveryCharge: 25 });
    const b = makeBill({ id: "b", kWh: 505, electricSupplyCharge: 80, electricDeliveryCharge: 25 });
    const ctx: AnalysisContext = { bills: [a, b], decomposition: decompose(a, b), anomalies: [] };

    for (const suggestion of evaluateRules(ctx)) {
      for (const fact of suggestion.triggeringFacts) {
        expect(Number.isFinite(fact.value)).toBe(true);
      }
    }
  });
});
