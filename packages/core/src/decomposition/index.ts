import type { BillFacts, DecompositionResult, EffectBreakdown } from "../types/index.js";

const RECONCILIATION_EPSILON = 0.01;

interface VolumetricPeriod {
  price: number;
  quantity: number;
}

function toVolumetric(amount: number, quantity: number): VolumetricPeriod {
  return quantity === 0 ? { price: 0, quantity: 0 } : { price: amount / quantity, quantity };
}

/**
 * Symmetric two-factor decomposition. Algebraically exact: priceEffect +
 * consumptionEffect === period1.price*period1.quantity - period0.price*period0.quantity,
 * so residual is 0 up to floating point error — never drop this identity.
 */
function computeEffect(period0: VolumetricPeriod, period1: VolumetricPeriod): EffectBreakdown {
  const priceEffect = ((period1.price - period0.price) * (period0.quantity + period1.quantity)) / 2;
  const consumptionEffect = ((period1.quantity - period0.quantity) * (period0.price + period1.price)) / 2;
  const actualChange = period1.price * period1.quantity - period0.price * period0.quantity;
  const residual = actualChange - (priceEffect + consumptionEffect);
  return { priceEffect, consumptionEffect, residual };
}

function zeroEffect(): EffectBreakdown {
  return { priceEffect: 0, consumptionEffect: 0, residual: 0 };
}

function addEffects(a: EffectBreakdown, b: EffectBreakdown): EffectBreakdown {
  return {
    priceEffect: a.priceEffect + b.priceEffect,
    consumptionEffect: a.consumptionEffect + b.consumptionEffect,
    residual: a.residual + b.residual,
  };
}

function computeFeesBreakdown(
  billA: BillFacts,
  billB: BillFacts,
): Array<{ label: string; delta: number }> {
  const mapA = new Map(billA.fixedAndOtherCharges.map((c) => [c.label, c.amount.value]));
  const mapB = new Map(billB.fixedAndOtherCharges.map((c) => [c.label, c.amount.value]));
  const labels = new Set([...mapA.keys(), ...mapB.keys()]);
  return Array.from(labels)
    .map((label) => ({ label, delta: (mapB.get(label) ?? 0) - (mapA.get(label) ?? 0) }))
    .filter((f) => f.delta !== 0);
}

/**
 * Decomposes the change between two bills into supply/delivery price and
 * consumption effects plus a fees bucket. Electric and gas volumetric
 * effects are summed into the same supply/delivery buckets for a combined
 * bill — the exact-sum identity holds under addition, so this doesn't break
 * the total-change reconciliation, it just doesn't split effects by fuel.
 */
export function decompose(billA: BillFacts, billB: BillFacts): DecompositionResult {
  let supply = zeroEffect();
  let delivery = zeroEffect();

  if (billA.electric && billB.electric) {
    supply = addEffects(
      supply,
      computeEffect(
        toVolumetric(billA.electric.supplyCharge.value, billA.electric.kWh.value),
        toVolumetric(billB.electric.supplyCharge.value, billB.electric.kWh.value),
      ),
    );
    delivery = addEffects(
      delivery,
      computeEffect(
        toVolumetric(billA.electric.deliveryCharge.value, billA.electric.kWh.value),
        toVolumetric(billB.electric.deliveryCharge.value, billB.electric.kWh.value),
      ),
    );
  }

  if (billA.gas && billB.gas) {
    supply = addEffects(
      supply,
      computeEffect(
        toVolumetric(billA.gas.supplyCharge.value, billA.gas.therms.value),
        toVolumetric(billB.gas.supplyCharge.value, billB.gas.therms.value),
      ),
    );
    delivery = addEffects(
      delivery,
      computeEffect(
        toVolumetric(billA.gas.deliveryCharge.value, billA.gas.therms.value),
        toVolumetric(billB.gas.deliveryCharge.value, billB.gas.therms.value),
      ),
    );
  }

  const feesBreakdown = computeFeesBreakdown(billA, billB);
  const feesEffect =
    feesBreakdown.reduce((sum, f) => sum + f.delta, 0) + (billB.taxes.value - billA.taxes.value);

  const totalChange = billB.totalCharge.value - billA.totalCharge.value;
  const computedTotal =
    supply.priceEffect +
    supply.consumptionEffect +
    supply.residual +
    delivery.priceEffect +
    delivery.consumptionEffect +
    delivery.residual +
    feesEffect;

  return {
    periodA: billA.id,
    periodB: billB.id,
    supply,
    delivery,
    feesEffect,
    feesBreakdown,
    totalChange,
    checksPassed: Math.abs(computedTotal - totalChange) < RECONCILIATION_EPSILON,
  };
}
