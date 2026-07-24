import type { AnalysisContext } from "../types/index.js";

export interface VerificationFailure {
  numeral: number;
  matchedText: string;
}

export interface VerificationResult {
  ok: boolean;
  failures: VerificationFailure[];
}

const NUMERAL_PATTERN = /-?\$?\d[\d,]*(\.\d+)?%?/g;

export function extractNumerals(text: string): Array<{ value: number; matchedText: string }> {
  const matches = text.match(NUMERAL_PATTERN) ?? [];
  return matches
    .map((matchedText) => ({
      matchedText,
      value: Number(matchedText.replace(/[$,%]/g, "")),
    }))
    .filter((m) => Number.isFinite(m.value));
}

/**
 * Every value that a piece of generated prose is allowed to cite. Anything
 * not derivable from a BillFacts field or a computed analysis result is,
 * by construction, not grounded.
 */
export function collectGroundedValues(context: AnalysisContext): number[] {
  const values: number[] = [];

  for (const bill of context.bills) {
    values.push(bill.totalCharge.value, bill.taxes.value);
    if (bill.currentCharges) values.push(bill.currentCharges.value);
    if (bill.previousBalance) values.push(bill.previousBalance.value);
    if (bill.payments) values.push(bill.payments.value);
    if (bill.electric) {
      values.push(
        bill.electric.kWh.value,
        bill.electric.supplyCharge.value,
        bill.electric.deliveryCharge.value,
      );
    }
    if (bill.gas) {
      values.push(bill.gas.therms.value, bill.gas.supplyCharge.value, bill.gas.deliveryCharge.value);
    }
    for (const charge of bill.fixedAndOtherCharges) {
      values.push(charge.amount.value);
    }
  }

  if (context.decomposition) {
    const d = context.decomposition;
    values.push(
      d.supply.priceEffect,
      d.supply.consumptionEffect,
      d.delivery.priceEffect,
      d.delivery.consumptionEffect,
      d.feesEffect,
      d.totalChange,
      d.shares.price,
      d.shares.consumption,
      d.shares.fees,
    );
    for (const f of d.feesBreakdown) values.push(f.delta);
  }

  if (context.weatherFit) {
    const w = context.weatherFit;
    values.push(w.baseload, w.rSquared, w.n);
    if (w.cddCoefficient !== undefined) values.push(w.cddCoefficient);
    if (w.hddCoefficient !== undefined) values.push(w.hddCoefficient);
  }

  for (const a of context.anomalies) values.push(a.magnitude);

  return values;
}

export function verifyNumerals(
  text: string,
  context: AnalysisContext,
  epsilon = 0.01,
): VerificationResult {
  const grounded = collectGroundedValues(context);
  const failures: VerificationFailure[] = [];

  for (const { value, matchedText } of extractNumerals(text)) {
    const matched = grounded.some(
      (g) => Math.abs(g - value) < epsilon || Math.abs(Math.abs(g) - value) < epsilon,
    );
    if (!matched) failures.push({ numeral: value, matchedText });
  }

  return { ok: failures.length === 0, failures };
}

export class UngroundedNumeralError extends Error {
  failures: VerificationFailure[];

  constructor(failures: VerificationFailure[]) {
    super(
      `Ungrounded numeral(s) detected: ${failures.map((f) => f.matchedText).join(", ")}`,
    );
    this.name = "UngroundedNumeralError";
    this.failures = failures;
  }
}

/** Hard gate for anything rendered to the user. Throws — never warns. */
export function assertGrounded(text: string, context: AnalysisContext, epsilon = 0.01): void {
  const result = verifyNumerals(text, context, epsilon);
  if (!result.ok) throw new UngroundedNumeralError(result.failures);
}
