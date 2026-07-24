import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DecompositionResult } from "@electric-analyzer/core";
import { DataTable } from "../DataTable";

interface Props {
  /** One entry per consecutive bill pair, oldest to newest (HistoryDecomposition.perPeriod). */
  perPeriod: DecompositionResult[];
  /** The "to" period label for each entry — same length/order as perPeriod. */
  periodLabels: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Bill-by-bill breakdown across the whole history: what pushed each bill up
 * or down from the one before it — rate, usage, or fees/credits. Bars above
 * zero increased that bill; bars below zero decreased it. This is the "when
 * did what happen" complement to the cumulative summary above it.
 */
export function DriversOverTimeChart({ perPeriod, periodLabels }: Props) {
  const data = perPeriod.map((d, i) => ({
    period: periodLabels[i] ?? `#${i + 1}`,
    Rate: round2(d.supply.priceEffect + d.delivery.priceEffect),
    Usage: round2(d.supply.consumptionEffect + d.delivery.consumptionEffect),
    "Fees & credits": round2(d.feesEffect),
  }));

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 0 }}>
        Each bar shows why that bill changed from the one before it. Above the line pushed the bill up that
        period; below the line pulled it down.
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <ReferenceLine y={0} stroke="var(--baseline)" />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
          <Bar dataKey="Rate" stackId="drivers" fill="var(--series-1)" />
          <Bar dataKey="Usage" stackId="drivers" fill="var(--series-2)" />
          <Bar dataKey="Fees & credits" stackId="drivers" fill="var(--series-3)" />
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        caption="What drove each bill's change, period by period"
        columns={[
          { key: "period", label: "Period" },
          { key: "Rate", label: "Rate ($)" },
          { key: "Usage", label: "Usage ($)" },
          { key: "Fees & credits", label: "Fees & credits ($)" },
        ]}
        rows={data.map((row) => ({ ...row }))}
      />
    </div>
  );
}
