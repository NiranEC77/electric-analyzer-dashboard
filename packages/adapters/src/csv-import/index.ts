import type { BillFacts } from "@electric-analyzer/core";
import { buildManualBillFacts, type ManualEntryInput } from "../manual-entry/index.js";

/**
 * Documented flat schema, one row per bill:
 * utility,service_type,period_start,period_end,kwh,electric_supply,electric_delivery,therms,gas_supply,gas_delivery,taxes,total_charge
 *
 * service_type is "electric", "gas", or "combined". Leave the electric_*
 * or gas_* columns blank for the service type that doesn't apply. Fixed
 * charges beyond taxes aren't supported by CSV import in v0.1 — use manual
 * entry for bills with riders/surcharges you want itemized.
 */
const REQUIRED_COLUMNS = [
  "utility",
  "service_type",
  "period_start",
  "period_end",
  "taxes",
  "total_charge",
] as const;

export interface CsvImportResult {
  facts: BillFacts[];
  errors: string[];
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function toNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function parseCsv(csvText: string, idPrefix = "csv-import"): CsvImportResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const errors: string[] = [];
  if (lines.length === 0) return { facts: [], errors: ["CSV is empty"] };

  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  for (const col of REQUIRED_COLUMNS) {
    if (!header.includes(col)) errors.push(`Missing required column: ${col}`);
  }
  if (errors.length > 0) return { facts: [], errors };

  const facts: BillFacts[] = [];
  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    const cells = splitCsvLine(lines[rowIndex] ?? "");
    const row: Record<string, string> = {};
    header.forEach((col, i) => (row[col] = cells[i] ?? ""));

    const serviceType = row.service_type as ManualEntryInput["serviceType"];
    if (serviceType !== "electric" && serviceType !== "gas" && serviceType !== "combined") {
      errors.push(`Row ${rowIndex + 1}: invalid service_type "${row.service_type}"`);
      continue;
    }

    const kWh = toNumber(row.kwh);
    const electricSupply = toNumber(row.electric_supply);
    const electricDelivery = toNumber(row.electric_delivery);
    const therms = toNumber(row.therms);
    const gasSupply = toNumber(row.gas_supply);
    const gasDelivery = toNumber(row.gas_delivery);
    const taxes = toNumber(row.taxes);
    const totalCharge = toNumber(row.total_charge);

    if (taxes === undefined || totalCharge === undefined) {
      errors.push(`Row ${rowIndex + 1}: taxes and total_charge must be numbers`);
      continue;
    }

    const input: ManualEntryInput = {
      utility: row.utility ?? "",
      serviceType,
      periodStart: row.period_start ?? "",
      periodEnd: row.period_end ?? "",
      electric:
        kWh !== undefined && electricSupply !== undefined && electricDelivery !== undefined
          ? { kWh, supplyCharge: electricSupply, deliveryCharge: electricDelivery }
          : undefined,
      gas:
        therms !== undefined && gasSupply !== undefined && gasDelivery !== undefined
          ? { therms, supplyCharge: gasSupply, deliveryCharge: gasDelivery }
          : undefined,
      taxes,
      totalCharge,
    };

    facts.push(buildManualBillFacts(input, `${idPrefix}-${rowIndex}`));
  }

  return { facts, errors };
}
