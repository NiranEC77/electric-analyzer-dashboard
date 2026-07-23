import type { AnomalyFlag, BillFacts } from "../types/index.js";

/**
 * v0.1 ships no anomaly detection (deferred to v0.3, see STATE.md). Locking
 * the signature now so the rules engine and dashboard don't need to change
 * when rate-step-change / expired-credit / baseload-jump detection lands.
 */
export function detectAnomalies(_bills: BillFacts[]): AnomalyFlag[] {
  return [];
}
