import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { UsageInterval } from "@electric-analyzer/adapters";
import { DataTable } from "../DataTable";

interface Props {
  title: string;
  unitLabel: string;
  intervals: UsageInterval[];
}

/**
 * Usage derived from raw meter-register deltas, not bill totals — a second,
 * independent read on consumption. One bar per interval between two
 * consecutive readings (which may not align with billing periods).
 */
export function MeterUsageChart({ title, unitLabel, intervals }: Props) {
  const data = intervals.map((iv) => ({
    period: iv.periodEnd,
    [unitLabel]: Math.round(iv.quantity * 100) / 100,
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" width={56} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Bar dataKey={unitLabel} fill="var(--series-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        caption={title}
        columns={[
          { key: "period", label: "Through" },
          { key: unitLabel, label: unitLabel },
        ]}
        rows={data.map((row) => ({ ...row }))}
      />
    </div>
  );
}
