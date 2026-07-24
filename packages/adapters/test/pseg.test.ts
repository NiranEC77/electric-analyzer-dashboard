import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { psegAdapter } from "../src/pseg/index.js";

const fixturePath = fileURLToPath(
  new URL("./fixtures/synthetic-pseg-bill.txt", import.meta.url),
);
const fixtureText = readFileSync(fixturePath, "utf-8");

describe("psegAdapter", () => {
  it("detects a PSE&G bill, tolerant of pdf.js fragmenting the ampersand", () => {
    expect(psegAdapter.supports(fixtureText)).toBe(true);
    expect(psegAdapter.supports("PSE &G balance from last bill")).toBe(true); // fragmented
    expect(psegAdapter.supports("visit pseg.com for details")).toBe(true); // fallback
    expect(psegAdapter.supports("Some other utility entirely")).toBe(false);
  });

  it("parses electric and gas usage/charges with provenance", () => {
    const { facts, warnings } = psegAdapter.parseText(fixtureText, "fixture-file-id");

    expect(facts.serviceType).toBe("combined");
    expect(facts.periodStart?.value).toBe("2026-03-16");
    expect(facts.periodEnd?.value).toBe("2026-04-15");

    expect(facts.electric?.kWh.value).toBe(700);
    expect(facts.electric?.supplyCharge.value).toBe(120);
    expect(facts.electric?.deliveryCharge.value).toBe(45);
    expect(facts.electric?.kWh.provenance.fileId).toBe("fixture-file-id");
    expect(facts.electric?.kWh.provenance.rawText).toContain("700");

    expect(facts.gas?.therms.value).toBe(300);
    expect(facts.gas?.supplyCharge.value).toBe(110);
    expect(facts.gas?.deliveryCharge.value).toBe(180);

    expect(warnings).toHaveLength(0);
  });

  it("parses the fee lines and the carried-balance fields", () => {
    const { facts } = psegAdapter.parseText(fixtureText, "x");

    const feeLabels = facts.fixedAndOtherCharges?.map((c) => c.label) ?? [];
    expect(feeLabels).toContain("WorryFree Protection Plan");
    expect(feeLabels).toContain("Other charges and credits");

    expect(facts.currentCharges?.value).toBe(490);
    expect(facts.previousBalance?.value).toBe(50);
    expect(facts.payments?.value).toBe(30);
    expect(facts.totalCharge?.value).toBe(510);
  });

  it("reconciles: current charges = usage+fees, and amount due = current + prior − payment", () => {
    const { facts } = psegAdapter.parseText(fixtureText, "x");

    const elec = (facts.electric?.supplyCharge.value ?? 0) + (facts.electric?.deliveryCharge.value ?? 0);
    const gas = (facts.gas?.supplyCharge.value ?? 0) + (facts.gas?.deliveryCharge.value ?? 0);
    const fees = (facts.fixedAndOtherCharges ?? []).reduce((s, c) => s + c.amount.value, 0);
    expect(elec + gas + fees).toBeCloseTo(facts.currentCharges!.value, 2);

    const due = facts.currentCharges!.value + (facts.previousBalance?.value ?? 0) - (facts.payments?.value ?? 0);
    expect(due).toBeCloseTo(facts.totalCharge!.value, 2);
  });

  it("warns instead of silently guessing when a field is missing", () => {
    const result = psegAdapter.parseText("PSE&G bill with nothing parseable in it", "x");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.facts.electric).toBeUndefined();
    expect(result.facts.gas).toBeUndefined();
  });
});
