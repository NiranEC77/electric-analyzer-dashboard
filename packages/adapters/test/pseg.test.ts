import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { psegAdapter } from "../src/pseg/index.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/synthetic-pseg-bill.txt", import.meta.url),
);
const fixtureText = readFileSync(fixturePath, "utf-8");

describe("psegAdapter", () => {
  it("detects a PSE&G bill by header text", () => {
    expect(psegAdapter.supports(fixtureText)).toBe(true);
    expect(psegAdapter.supports("Some other utility entirely")).toBe(false);
  });

  it("parses electric and gas usage/charges with provenance", () => {
    const result = psegAdapter.parseText(fixtureText, "fixture-file-id");

    expect(result.facts.electric?.kWh.value).toBe(650);
    expect(result.facts.electric?.supplyCharge.value).toBe(71.5);
    expect(result.facts.electric?.deliveryCharge.value).toBe(38.2);
    expect(result.facts.electric?.kWh.provenance.fileId).toBe("fixture-file-id");
    expect(result.facts.electric?.kWh.provenance.rawText).toContain("650");

    expect(result.facts.gas?.therms.value).toBe(12);
    expect(result.facts.gas?.supplyCharge.value).toBe(9.6);
    expect(result.facts.gas?.deliveryCharge.value).toBe(14.4);

    expect(result.facts.taxes?.value).toBe(6.87);
    expect(result.facts.totalCharge?.value).toBe(145.57);
    expect(result.facts.periodStart?.value).toBe("2026-05-01");
    expect(result.facts.periodEnd?.value).toBe("2026-05-31");
    expect(result.facts.serviceType).toBe("combined");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns instead of silently guessing when a field is missing", () => {
    const result = psegAdapter.parseText("PSE&G bill with nothing parseable in it", "x");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.facts.electric).toBeUndefined();
    expect(result.facts.gas).toBeUndefined();
  });
});
