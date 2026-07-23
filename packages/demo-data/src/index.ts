import type { BillFacts, ChargeCategory, FixedCharge, Traced } from "@electric-analyzer/core";

/**
 * Deterministic synthetic bill history for demo mode: seasonal usage,
 * a supply-rate hike at month 13 (a price-effect story), and an efficiency
 * credit that expires after month 10 (a fees-effect story). Slow upward
 * baseload drift is baked in for the v0.2 weather/baseload charts to
 * eventually pick up. Every number here is generated, never real.
 */

const BASE_SUPPLY_RATE = 0.11;
const RATE_HIKE_MONTH_INDEX = 13;
const RATE_HIKE_FACTOR = 1.09;
const DELIVERY_RATE = 0.055;
const GAS_SUPPLY_RATE = 0.85;
const GAS_DELIVERY_RATE = 0.42;
const CUSTOMER_CHARGE = 5;
const CREDIT_MONTHS = 10;
const CREDIT_AMOUNT = 15;
const TAX_RATE = 0.06;

function demoTraced<T>(value: T): Traced<T> {
  return { value, provenance: { fileId: "demo-data", page: 0 }, confidence: 1, userCorrected: false };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function monthPeriod(year: number, monthOfYear: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, monthOfYear - 1, 1));
  const end = new Date(Date.UTC(year, monthOfYear, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

function seasonalKWh(monthOfYear: number, baseloadDrift: number): number {
  const summerAc = Math.max(0, Math.cos(((monthOfYear - 7) / 12) * 2 * Math.PI)) * 250;
  const winterHeat = Math.max(0, Math.cos(((monthOfYear - 1) / 12) * 2 * Math.PI)) * 80;
  const baseload = 380 + baseloadDrift;
  return Math.round(baseload + summerAc + winterHeat);
}

function seasonalTherms(monthOfYear: number): number {
  const winterHeat = Math.max(0, Math.cos(((monthOfYear - 1) / 12) * 2 * Math.PI)) * 90;
  return Math.round(10 + winterHeat);
}

export function generateDemoBills(months = 24, startYear = 2024, startMonth = 7): BillFacts[] {
  const bills: BillFacts[] = [];

  for (let i = 0; i < months; i++) {
    const totalMonthIndex = startMonth - 1 + i;
    const year = startYear + Math.floor(totalMonthIndex / 12);
    const monthOfYear = (totalMonthIndex % 12) + 1;
    const { start, end } = monthPeriod(year, monthOfYear);

    const baseloadDrift = i * 0.6;
    const kWh = seasonalKWh(monthOfYear, baseloadDrift);
    const therms = seasonalTherms(monthOfYear);
    const supplyRate = i >= RATE_HIKE_MONTH_INDEX ? BASE_SUPPLY_RATE * RATE_HIKE_FACTOR : BASE_SUPPLY_RATE;

    const electricSupplyCharge = round2(kWh * supplyRate);
    const electricDeliveryCharge = round2(kWh * DELIVERY_RATE);
    const gasSupplyCharge = round2(therms * GAS_SUPPLY_RATE);
    const gasDeliveryCharge = round2(therms * GAS_DELIVERY_RATE);

    const fixedAndOtherCharges: FixedCharge[] = [
      {
        label: "Customer Charge",
        amount: demoTraced(CUSTOMER_CHARGE),
        category: "customer_charge" as ChargeCategory,
      },
    ];
    if (i < CREDIT_MONTHS) {
      fixedAndOtherCharges.push({
        label: "Efficiency Credit",
        amount: demoTraced(-CREDIT_AMOUNT),
        category: "credit" as ChargeCategory,
      });
    }

    const subtotal =
      electricSupplyCharge +
      electricDeliveryCharge +
      gasSupplyCharge +
      gasDeliveryCharge +
      fixedAndOtherCharges.reduce((sum, c) => sum + c.amount.value, 0);
    const taxes = round2(subtotal * TAX_RATE);
    const totalCharge = round2(subtotal + taxes);

    bills.push({
      id: `demo-${start}`,
      utility: "Demo Utility Co.",
      serviceType: "combined",
      periodStart: demoTraced(start),
      periodEnd: demoTraced(end),
      electric: {
        kWh: demoTraced(kWh),
        supplyCharge: demoTraced(electricSupplyCharge),
        deliveryCharge: demoTraced(electricDeliveryCharge),
      },
      gas: {
        therms: demoTraced(therms),
        supplyCharge: demoTraced(gasSupplyCharge),
        deliveryCharge: demoTraced(gasDeliveryCharge),
      },
      fixedAndOtherCharges,
      taxes: demoTraced(taxes),
      totalCharge: demoTraced(totalCharge),
      sourceRef: { fileId: "demo-data", fileName: "demo-data" },
      schemaVersion: 1,
    });
  }

  return bills;
}
