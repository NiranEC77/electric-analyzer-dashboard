import type { BillFacts, Traced } from "../src/types/index.js";

function traced<T>(value: T): Traced<T> {
  return { value, provenance: { fileId: "test-fixture", page: 1 }, confidence: 1, userCorrected: false };
}

export interface MakeBillOptions {
  id: string;
  kWh?: number;
  electricSupplyCharge?: number;
  electricDeliveryCharge?: number;
  therms?: number;
  gasSupplyCharge?: number;
  gasDeliveryCharge?: number;
  fixedAndOtherCharges?: Array<{ label: string; amount: number; category: BillFacts["fixedAndOtherCharges"][number]["category"] }>;
  taxes?: number;
}

/** Builds a synthetic BillFacts with totalCharge derived from its parts, for use in tests only. */
export function makeBill(opts: MakeBillOptions): BillFacts {
  const fixedAndOtherCharges = (opts.fixedAndOtherCharges ?? []).map((c) => ({
    label: c.label,
    amount: traced(c.amount),
    category: c.category,
  }));

  const electric =
    opts.kWh !== undefined
      ? {
          kWh: traced(opts.kWh),
          supplyCharge: traced(opts.electricSupplyCharge ?? 0),
          deliveryCharge: traced(opts.electricDeliveryCharge ?? 0),
        }
      : undefined;

  const gas =
    opts.therms !== undefined
      ? {
          therms: traced(opts.therms),
          supplyCharge: traced(opts.gasSupplyCharge ?? 0),
          deliveryCharge: traced(opts.gasDeliveryCharge ?? 0),
        }
      : undefined;

  const taxes = opts.taxes ?? 0;
  const total =
    (electric ? electric.supplyCharge.value + electric.deliveryCharge.value : 0) +
    (gas ? gas.supplyCharge.value + gas.deliveryCharge.value : 0) +
    fixedAndOtherCharges.reduce((sum, c) => sum + c.amount.value, 0) +
    taxes;

  return {
    id: opts.id,
    utility: "Synthetic Test Utility",
    serviceType: electric && gas ? "combined" : gas ? "gas" : "electric",
    periodStart: traced("2026-01-01"),
    periodEnd: traced("2026-01-31"),
    electric,
    gas,
    fixedAndOtherCharges,
    taxes: traced(taxes),
    totalCharge: traced(total),
    sourceRef: { fileId: "test-fixture", fileName: "synthetic.pdf" },
    schemaVersion: 1,
  };
}
