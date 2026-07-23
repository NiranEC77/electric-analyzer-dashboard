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
  totalCharge: Traced<number>;
  sourceRef: { fileId: string; fileName: string };
  reviewedAt?: string;
  schemaVersion: number;
}

export interface EffectBreakdown {
  priceEffect: number;
  consumptionEffect: number;
  residual: number;
}

export interface DecompositionResult {
  periodA: string;
  periodB: string;
  supply: EffectBreakdown;
  delivery: EffectBreakdown;
  feesEffect: number;
  feesBreakdown: Array<{ label: string; delta: number }>;
  totalChange: number;
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
