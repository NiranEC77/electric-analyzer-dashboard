import type { ChargeCategory, FixedCharge, Traced } from "@electric-analyzer/core";
import type { ParseResult, UtilityAdapter } from "../interface.js";
import { tracedValue } from "../trace.js";

/**
 * PSE&G (NJ) residential electric + gas. Patterns are derived from the real
 * bill layout: after collapsing all whitespace to single spaces, each
 * `label ... value` pair becomes a contiguous run even across the bill's
 * multi-column layout, so simple anchored patterns are reliable. No real
 * bill is committed — the test fixture is synthetic (see
 * test/fixtures/synthetic-pseg-bill.txt).
 *
 * Not handled yet (falls through to the review screen / warnings): itemizing
 * the fixed monthly service charge out of gas delivery, and any separately
 * lined energy tax (PSE&G folds sales/use tax into the rates).
 */

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04", may: "05", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

function toIso(monthName: string, day: string, year: string): string | undefined {
  const mm = MONTHS[monthName.toLowerCase()];
  if (!mm) return undefined;
  return `${year}-${mm}-${day.padStart(2, "0")}`;
}

/** Collapse runs of whitespace and normalize curly apostrophes so labels/values are contiguous. */
function normalize(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}

function num(raw: string): number {
  return Number(raw.replace(/[,$]/g, ""));
}

/** First capture group of `regex` on `text`, as a Traced<number>, or undefined. */
function money(text: string, regex: RegExp, fileId: string): Traced<number> | undefined {
  const m = regex.exec(text);
  if (!m || m[1] === undefined) return undefined;
  const value = num(m[1]);
  return Number.isFinite(value) ? tracedValue(value, fileId, m[0]) : undefined;
}

const P = {
  period: /For the period:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i,
  kWh: /Total electric you used in \d+ days\s+([\d,]+)\s*kWh/i,
  electricDelivery: /Total electric delivery charges\s+\$([\d,]+\.\d{2})/i,
  electricSupply: /Total electric supply charges\s+\$([\d,]+\.\d{2})/i,
  therms: /Total gas you used in \d+ days\s+([\d,]+(?:\.\d+)?)\s*therms/i,
  gasDelivery: /Total gas delivery charges\s+\$([\d,]+\.\d{2})/i,
  gasSupply: /Total gas supply charges\s+\$([\d,]+\.\d{2})/i,
  worryFree: /WorryFree Protection Plan charge\s+\$([\d,]+\.\d{2})/i,
  otherCharges: /Total other charges and credits\s+\$(-?[\d,]+\.\d{2})/i,
  previousBalance: /balance from (?:your )?last bill\s+\$([\d,]+\.\d{2})/i,
  payment: /Less Payment received[^$]*-\$([\d,]+\.\d{2})/i,
  // The apostrophe in "This month's" renders as a plain space in the PDF text
  // layer ("This month s"), so allow any single char (or none) before the s.
  currentCharges: /This month.?s charges and credits\s+\$([\d,]+\.\d{2})/i,
  totalDue: /Total amount due(?: by [A-Za-z]+ \d{1,2}, \d{4})?\s+\$([\d,]+\.\d{2})/i,
};

export const psegAdapter: UtilityAdapter = {
  id: "pseg-electric-gas",
  displayName: "PSE&G (Public Service Electric and Gas)",

  supports(sniffText) {
    // Tolerant of pdf.js fragmenting "PSE&G" into "PSE &G"; pseg.com is a robust fallback.
    return /PSE\s*&\s*G|Public Service Electric|pseg\.com/i.test(sniffText);
  },

  parseText(rawText, fileId): ParseResult {
    const text = normalize(rawText);
    const warnings: string[] = [];

    let periodStart: Traced<string> | undefined;
    let periodEnd: Traced<string> | undefined;
    const pm = P.period.exec(text);
    if (pm) {
      const start = toIso(pm[1]!, pm[2]!, pm[3]!);
      const end = toIso(pm[4]!, pm[5]!, pm[6]!);
      if (start) periodStart = tracedValue(start, fileId, pm[0]);
      if (end) periodEnd = tracedValue(end, fileId, pm[0]);
    }
    if (!periodStart || !periodEnd) warnings.push("Could not locate the billing period");

    const kWh = money(text, P.kWh, fileId);
    const electricSupply = money(text, P.electricSupply, fileId);
    const electricDelivery = money(text, P.electricDelivery, fileId);
    const electric =
      kWh && electricSupply && electricDelivery
        ? { kWh, supplyCharge: electricSupply, deliveryCharge: electricDelivery }
        : undefined;
    if (!electric && /electric/i.test(text)) {
      warnings.push("Electric service detected but usage/charges could not be fully parsed");
    }

    const therms = money(text, P.therms, fileId);
    const gasSupply = money(text, P.gasSupply, fileId);
    const gasDelivery = money(text, P.gasDelivery, fileId);
    const gas =
      therms && gasSupply && gasDelivery
        ? { therms, supplyCharge: gasSupply, deliveryCharge: gasDelivery }
        : undefined;
    if (!gas && /\bgas\b/i.test(text)) {
      warnings.push("Gas service detected but usage/charges could not be fully parsed");
    }

    const fixedAndOtherCharges: FixedCharge[] = [];
    const worryFree = money(text, P.worryFree, fileId);
    if (worryFree) {
      fixedAndOtherCharges.push({
        label: "WorryFree Protection Plan",
        amount: worryFree,
        category: "other" as ChargeCategory,
      });
    }
    const otherCharges = money(text, P.otherCharges, fileId);
    if (otherCharges) {
      fixedAndOtherCharges.push({
        label: "Other charges and credits",
        amount: otherCharges,
        category: "other" as ChargeCategory,
      });
    }

    const currentCharges = money(text, P.currentCharges, fileId);
    const totalCharge = money(text, P.totalDue, fileId);
    if (!totalCharge) warnings.push("Could not locate the total amount due");
    if (!currentCharges) warnings.push("Could not locate this month's charges");

    const previousBalance = money(text, P.previousBalance, fileId);
    const payments = money(text, P.payment, fileId);

    return {
      facts: {
        utility: "PSE&G",
        serviceType: electric && gas ? "combined" : gas ? "gas" : "electric",
        periodStart,
        periodEnd,
        electric,
        gas,
        fixedAndOtherCharges,
        // PSE&G folds sales/use tax into the volumetric rates — no separate line.
        taxes: tracedValue(0, fileId, "tax folded into rates"),
        totalCharge,
        currentCharges,
        previousBalance,
        payments,
        sourceRef: { fileId, fileName: fileId },
        schemaVersion: 1,
      },
      warnings,
    };
  },
};

export default psegAdapter;
