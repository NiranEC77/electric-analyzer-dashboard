import {
  decompose,
  decomposeHistory,
  detectAnomalies,
  evaluateRules,
  type AnalysisContext,
  type BillFacts,
  type DecompositionResult,
  type HistoryDecomposition,
  type Suggestion,
} from "@electric-analyzer/core";

export function sortByPeriodStart(bills: BillFacts[]): BillFacts[] {
  return [...bills].sort((a, b) => a.periodStart.value.localeCompare(b.periodStart.value));
}

export interface Analysis {
  bills: BillFacts[];
  previous?: BillFacts;
  latest?: BillFacts;
  decomposition?: DecompositionResult;
  /** The same decomposition math chained across the whole history on file, not just the last two bills. */
  history?: HistoryDecomposition;
  suggestions: Suggestion[];
  context: AnalysisContext;
}

export function analyze(bills: BillFacts[]): Analysis {
  const sorted = sortByPeriodStart(bills);
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
  const latest = sorted.length >= 1 ? sorted[sorted.length - 1] : undefined;
  const decomposition = previous && latest ? decompose(previous, latest) : undefined;
  const history = decomposeHistory(sorted);
  const anomalies = detectAnomalies(sorted);
  const context: AnalysisContext = { bills: sorted, decomposition, historyDecomposition: history, anomalies };
  const suggestions = evaluateRules(context);

  return { bills: sorted, previous, latest, decomposition, history, suggestions, context };
}

export function effectiveElectricRate(bill: BillFacts): number | undefined {
  if (!bill.electric || bill.electric.kWh.value === 0) return undefined;
  return (bill.electric.supplyCharge.value + bill.electric.deliveryCharge.value) / bill.electric.kWh.value;
}

export function effectiveGasRate(bill: BillFacts): number | undefined {
  if (!bill.gas || bill.gas.therms.value === 0) return undefined;
  return (bill.gas.supplyCharge.value + bill.gas.deliveryCharge.value) / bill.gas.therms.value;
}
