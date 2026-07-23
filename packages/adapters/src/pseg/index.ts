import type { ChargeCategory, FixedCharge } from "@electric-analyzer/core";
import type { UtilityAdapter } from "../interface.js";
import { extractTraced, tracedValue } from "../trace.js";

/**
 * Regex patterns below are approximate — modeled on common utility-bill
 * layouts (period / usage / supply / delivery / customer charge / tax /
 * total), not lifted from a real PSE&G bill (none was available, and real
 * bills must never enter this repo per the privacy rules). Treat these as a
 * starting point: refine against redacted real-world OCR text and add
 * fixtures under test/fixtures, synthetic only.
 */

function toIsoDate(mdy: string): string {
  const [month, day, year] = mdy.split("/");
  return `${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}`;
}

const PATTERNS = {
  period: /Billing Period:?\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i,
  kWh: /Total Electric Usage:?\s*([\d,]+)\s*kWh/i,
  electricSupply: /Electric Supply Charges?:?\s*\$?([\d,]+\.\d{2})/i,
  electricDelivery: /Electric Delivery Charges?:?\s*\$?([\d,]+\.\d{2})/i,
  therms: /Total Gas Usage:?\s*([\d,]+)\s*therms/i,
  gasSupply: /Gas Supply Charges?:?\s*\$?([\d,]+\.\d{2})/i,
  gasDelivery: /Gas Delivery Charges?:?\s*\$?([\d,]+\.\d{2})/i,
  customerCharge: /Customer Charge:?\s*\$?([\d,]+\.\d{2})/i,
  tax: /(?:Sales )?Tax(?:es)?:?\s*\$?([\d,]+\.\d{2})/i,
  total: /Total Amount Due:?\s*\$?([\d,]+\.\d{2})/i,
};

function extractPeriod(text: string, fileId: string) {
  const m = PATTERNS.period.exec(text);
  if (!m || m[1] === undefined || m[2] === undefined) return undefined;
  return {
    periodStart: tracedValue(toIsoDate(m[1]), fileId, m[0]),
    periodEnd: tracedValue(toIsoDate(m[2]), fileId, m[0]),
  };
}

export const psegAdapter: UtilityAdapter = {
  id: "pseg-electric-gas",
  displayName: "PSE&G (Public Service Electric and Gas)",
  supports(sniffText) {
    return /PSE&G|Public Service Electric/i.test(sniffText);
  },
  parseText(text, fileId) {
    const warnings: string[] = [];
    const period = extractPeriod(text, fileId);
    if (!period) warnings.push("Could not locate billing period");

    const kWh = extractTraced(text, PATTERNS.kWh, fileId);
    const electricSupply = extractTraced(text, PATTERNS.electricSupply, fileId);
    const electricDelivery = extractTraced(text, PATTERNS.electricDelivery, fileId);
    const electric =
      kWh && electricSupply && electricDelivery
        ? { kWh, supplyCharge: electricSupply, deliveryCharge: electricDelivery }
        : undefined;
    if (!electric && /electric/i.test(text)) {
      warnings.push("Bill appears to include electric service but usage/charges couldn't be parsed");
    }

    const therms = extractTraced(text, PATTERNS.therms, fileId);
    const gasSupply = extractTraced(text, PATTERNS.gasSupply, fileId);
    const gasDelivery = extractTraced(text, PATTERNS.gasDelivery, fileId);
    const gas =
      therms && gasSupply && gasDelivery
        ? { therms, supplyCharge: gasSupply, deliveryCharge: gasDelivery }
        : undefined;
    if (!gas && /gas/i.test(text)) {
      warnings.push("Bill appears to include gas service but usage/charges couldn't be parsed");
    }

    const fixedAndOtherCharges: FixedCharge[] = [];
    const customerCharge = extractTraced(text, PATTERNS.customerCharge, fileId);
    if (customerCharge) {
      fixedAndOtherCharges.push({
        label: "Customer Charge",
        amount: customerCharge,
        category: "customer_charge" as ChargeCategory,
      });
    }

    const taxes = extractTraced(text, PATTERNS.tax, fileId);
    if (!taxes) warnings.push("Could not locate tax line");

    const totalCharge = extractTraced(text, PATTERNS.total, fileId);
    if (!totalCharge) warnings.push("Could not locate total amount due");

    return {
      facts: {
        utility: "PSE&G",
        serviceType: electric && gas ? "combined" : gas ? "gas" : "electric",
        ...period,
        electric,
        gas,
        fixedAndOtherCharges,
        taxes,
        totalCharge,
        sourceRef: { fileId, fileName: fileId },
        schemaVersion: 1,
      },
      warnings,
    };
  },
};

export default psegAdapter;
