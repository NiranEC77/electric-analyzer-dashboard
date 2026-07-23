import { describe, expect, it } from "vitest";
import { parseCsv } from "../src/csv-import/index.js";

const HEADER =
  "utility,service_type,period_start,period_end,kwh,electric_supply,electric_delivery,therms,gas_supply,gas_delivery,taxes,total_charge";

describe("parseCsv", () => {
  it("parses a well-formed CSV into BillFacts", () => {
    const csv = [
      HEADER,
      "Test Utility,electric,2026-01-01,2026-01-31,500,50,25,,,,5,80",
    ].join("\n");

    const result = parseCsv(csv);

    expect(result.errors).toHaveLength(0);
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0]?.electric?.kWh.value).toBe(500);
    expect(result.facts[0]?.totalCharge.value).toBe(80);
  });

  it("reports missing required columns instead of guessing", () => {
    const result = parseCsv("utility,service_type\nTest,electric");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.facts).toHaveLength(0);
  });

  it("flags rows with an invalid service_type rather than defaulting silently", () => {
    const csv = [HEADER, "Test Utility,solar,2026-01-01,2026-01-31,,,,,,,5,80"].join("\n");
    const result = parseCsv(csv);
    expect(result.errors.some((e) => e.includes("invalid service_type"))).toBe(true);
    expect(result.facts).toHaveLength(0);
  });
});
