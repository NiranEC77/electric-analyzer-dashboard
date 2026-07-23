import type { AnalysisContext, DecompositionResult, Suggestion } from "../types/index.js";

export interface RuleThresholds {
  /** Share of |totalChange| an effect must exceed to be called "dominant". */
  dominantEffectShare: number;
  /** Minimum bills required before baseload/weather rules are allowed to fire. */
  minBillsForBaseload: number;
}

export const DEFAULT_THRESHOLDS: RuleThresholds = {
  dominantEffectShare: 0.5,
  minBillsForBaseload: 6,
};

export interface Rule {
  id: string;
  condition(ctx: AnalysisContext, thresholds: RuleThresholds): boolean;
  fire(ctx: AnalysisContext, thresholds: RuleThresholds): Suggestion;
}

function priceEffectTotal(d: DecompositionResult): number {
  return d.supply.priceEffect + d.delivery.priceEffect;
}

const priceEffectDominant: Rule = {
  id: "price-effect-dominant",
  condition(ctx, thresholds) {
    const d = ctx.decomposition;
    if (!d || d.totalChange === 0) return false;
    return Math.abs(priceEffectTotal(d)) / Math.abs(d.totalChange) > thresholds.dominantEffectShare;
  },
  fire(ctx) {
    const d = ctx.decomposition as DecompositionResult;
    const price = priceEffectTotal(d);
    return {
      id: "price-effect-dominant",
      title: "Your rate is driving the increase",
      body: `$${price.toFixed(2)} of your $${d.totalChange.toFixed(2)} change comes from rate/price changes rather than usage. Consider comparing competitive supply offers, community solar, rooftop solar, and time-of-use eligibility.`,
      confidence: "high",
      triggeringFacts: [{ path: "decomposition.supply.priceEffect+delivery.priceEffect", value: price }],
      category: "price",
    };
  },
};

const feesEffectDominant: Rule = {
  id: "fees-effect-dominant",
  condition(ctx, thresholds) {
    const d = ctx.decomposition;
    if (!d || d.totalChange === 0) return false;
    return Math.abs(d.feesEffect) / Math.abs(d.totalChange) > thresholds.dominantEffectShare;
  },
  fire(ctx) {
    const d = ctx.decomposition as DecompositionResult;
    const grown = [...d.feesBreakdown].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const top = grown[0];
    const detail = top ? ` The largest single change is "${top.label}" ($${top.delta.toFixed(2)}).` : "";
    return {
      id: "fees-effect-dominant",
      title: "Fixed charges and fees are driving the increase",
      body: `$${d.feesEffect.toFixed(2)} of your $${d.totalChange.toFixed(2)} change is from fixed/non-volumetric charges, not rate or usage.${detail} Check for expired credits or riders.`,
      confidence: "high",
      triggeringFacts: [
        { path: "decomposition.feesEffect", value: d.feesEffect },
        ...(top ? [{ path: `decomposition.feesBreakdown[label=${top.label}]`, value: top.delta }] : []),
      ],
      category: "fees",
    };
  },
};

const insufficientData: Rule = {
  id: "insufficient-data",
  condition(ctx) {
    return ctx.bills.length < 2 || !ctx.decomposition;
  },
  fire(ctx) {
    return {
      id: "insufficient-data",
      title: "Not enough bills yet to explain the change",
      body: `Only ${ctx.bills.length} bill${ctx.bills.length === 1 ? " is" : "s are"} on file. At least two are needed to compute a decomposition — upload another billing period.`,
      confidence: "high",
      triggeringFacts: [{ path: "bills.length", value: ctx.bills.length }],
      category: "insufficient_data",
    };
  },
};

/**
 * v0.1 rule set. Baseload-rising and weather-coefficient-dominant rules are
 * deferred to v0.2 alongside the weather normalization module they depend
 * on — see STATE.md.
 */
export const DEFAULT_RULES: Rule[] = [insufficientData, priceEffectDominant, feesEffectDominant];

export function evaluateRules(
  ctx: AnalysisContext,
  rules: Rule[] = DEFAULT_RULES,
  thresholds: RuleThresholds = DEFAULT_THRESHOLDS,
): Suggestion[] {
  return rules.filter((r) => r.condition(ctx, thresholds)).map((r) => r.fire(ctx, thresholds));
}
