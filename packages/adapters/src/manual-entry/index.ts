import type { BillFacts, ChargeCategory, ServiceType, Traced } from "@electric-analyzer/core";

export interface ManualEntryInput {
  utility: string;
  serviceType: ServiceType;
  periodStart: string;
  periodEnd: string;
  electric?: { kWh: number; supplyCharge: number; deliveryCharge: number };
  gas?: { therms: number; supplyCharge: number; deliveryCharge: number };
  fixedAndOtherCharges?: Array<{ label: string; amount: number; category: ChargeCategory }>;
  taxes: number;
  totalCharge: number;
}

function manualTraced<T>(value: T): Traced<T> {
  return { value, provenance: { fileId: "manual-entry", page: 0 }, confidence: 1, userCorrected: true };
}

/**
 * Builds BillFacts directly from user-typed values — the fallback for
 * bills that won't parse. No OCR, no confidence below 1, and
 * userCorrected is always true since a human typed every field.
 */
export function buildManualBillFacts(input: ManualEntryInput, billId: string): BillFacts {
  return {
    id: billId,
    utility: input.utility,
    serviceType: input.serviceType,
    periodStart: manualTraced(input.periodStart),
    periodEnd: manualTraced(input.periodEnd),
    electric: input.electric
      ? {
          kWh: manualTraced(input.electric.kWh),
          supplyCharge: manualTraced(input.electric.supplyCharge),
          deliveryCharge: manualTraced(input.electric.deliveryCharge),
        }
      : undefined,
    gas: input.gas
      ? {
          therms: manualTraced(input.gas.therms),
          supplyCharge: manualTraced(input.gas.supplyCharge),
          deliveryCharge: manualTraced(input.gas.deliveryCharge),
        }
      : undefined,
    fixedAndOtherCharges: (input.fixedAndOtherCharges ?? []).map((c) => ({
      label: c.label,
      amount: manualTraced(c.amount),
      category: c.category,
    })),
    taxes: manualTraced(input.taxes),
    totalCharge: manualTraced(input.totalCharge),
    sourceRef: { fileId: "manual-entry", fileName: "manual-entry" },
    reviewedAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}
