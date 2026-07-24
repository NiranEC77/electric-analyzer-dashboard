export interface Provenance {
  fileId: string;
  page: number;
  bbox?: [number, number, number, number];
  rawText?: string;
}

export interface Traced<T> {
  value: T;
  provenance: Provenance;
  confidence: number;
  userCorrected: boolean;
}

export type ChargeCategory =
  | "customer_charge"
  | "rider"
  | "surcharge"
  | "credit"
  | "tax"
  | "other";

export interface FixedCharge {
  label: string;
  amount: Traced<number>;
  category: ChargeCategory;
}

export interface ElectricUsage {
  kWh: Traced<number>;
  supplyCharge: Traced<number>;
  deliveryCharge: Traced<number>;
}

export interface GasUsage {
  therms: Traced<number>;
  supplyCharge: Traced<number>;
  deliveryCharge: Traced<number>;
}

export type ServiceType = "electric" | "gas" | "combined";

export interface BillFacts {
  id: string;
  utility: string;
  serviceType: ServiceType;
  periodStart: Traced<string>;
  periodEnd: Traced<string>;
  electric?: ElectricUsage;
  gas?: GasUsage;
  fixedAndOtherCharges: FixedCharge[];
  taxes: Traced<number>;
  /**
   * Total amount due on the bill (the number the customer pays). May include
   * a balance carried over from an unpaid prior bill, so it is NOT the basis
   * for decomposition — see currentCharges.
   */
  totalCharge: Traced<number>;
  /**
   * This billing period's own charges and credits, excluding any balance
   * carried over from a prior unpaid bill. Decomposition runs on this so a
   * missed payment rolling forward never distorts the price/usage/fees split.
   * When absent (older fixtures, simple bills), decomposition falls back to
   * totalCharge — for a fully-paid account the two are equal.
   */
  currentCharges?: Traced<number>;
  /** Unpaid balance carried from the previous bill, if any. Context, not decomposed. */
  previousBalance?: Traced<number>;
  /** Payments/credits applied against the previous balance (stored as a positive amount). */
  payments?: Traced<number>;
  sourceRef: { fileId: string; fileName: string };
  reviewedAt?: string;
  schemaVersion: number;
}

/** The charges figure decomposition reconciles against: this period's charges, or totalCharge if unknown. */
export function decompositionBasis(bill: BillFacts): number {
  return bill.currentCharges?.value ?? bill.totalCharge.value;
}

export interface EffectBreakdown {
  priceEffect: number;
  consumptionEffect: number;
  residual: number;
}

/**
 * Each bucket's share of the overall movement, as a rounded 0-100 integer.
 * Defined as |bucket effect| / (|price|+|consumption|+|fees|) * 100, so it
 * always sums to ~100 (modulo rounding) even when effects partially offset —
 * unlike "% of net change", which is undefined/misleading when, say, a big
 * price drop and a bigger usage increase net out to a small total change.
 * Used to explain "what mostly drove this" in plain language.
 */
export interface EffectShares {
  price: number;
  consumption: number;
  fees: number;
}

export interface DecompositionResult {
  periodA: string;
  periodB: string;
  supply: EffectBreakdown;
  delivery: EffectBreakdown;
  feesEffect: number;
  feesBreakdown: Array<{ label: string; delta: number }>;
  totalChange: number;
  shares: EffectShares;
  checksPassed: boolean;
}

export interface WeatherFit {
  serviceType: "electric" | "gas";
  baseload: number;
  cddCoefficient?: number;
  hddCoefficient?: number;
  rSquared: number;
  n: number;
  suppressed: boolean;
}

export type AnomalyType =
  | "rate_step_change"
  | "credit_expired"
  | "baseload_jump"
  | "other";

export interface AnomalyFlag {
  type: AnomalyType;
  billId: string;
  description: string;
  magnitude: number;
  sourceFacts: string[];
}

export type SuggestionCategory =
  | "price"
  | "fees"
  | "baseload"
  | "weather"
  | "insufficient_data";

export interface Suggestion {
  id: string;
  title: string;
  body: string;
  confidence: "low" | "medium" | "high";
  triggeringFacts: Array<{ path: string; value: number }>;
  category: SuggestionCategory;
}

export interface AnalysisContext {
  bills: BillFacts[];
  decomposition?: DecompositionResult;
  weatherFit?: WeatherFit;
  anomalies: AnomalyFlag[];
}
