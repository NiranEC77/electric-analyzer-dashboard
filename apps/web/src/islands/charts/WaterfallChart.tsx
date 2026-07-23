import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable } from "../DataTable";

export interface WaterfallStep {
  label: string;
  delta: number;
  isTotal?: boolean;
}

interface Props {
  steps: WaterfallStep[];
}

interface Bar_ {
  label: string;
  base: number;
  value: number;
  delta: number;
  isTotal: boolean;
}

function buildBars(steps: WaterfallStep[]): Bar_[] {
  let cumulative = 0;
  return steps.map((step) => {
    if (step.isTotal) {
      cumulative = step.delta;
      return { label: step.label, base: 0, value: step.delta, delta: step.delta, isTotal: true };
    }
    const start = cumulative;
    cumulative += step.delta;
    return {
      label: step.label,
      base: Math.min(start, cumulative),
      value: Math.abs(step.delta),
      delta: step.delta,
      isTotal: false,
    };
  });
}

function colorFor(bar: Bar_): string {
  if (bar.isTotal) return "var(--diverging-neutral)";
  return bar.delta >= 0 ? "var(--diverging-increase)" : "var(--diverging-decrease)";
}

/** Baseline bill -> price -> consumption -> fees -> current bill. */
export function WaterfallChart({ steps }: Props) {
  const bars = buildBars(steps);

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={bars} barCategoryGap={12}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--text-primary)" }}
            formatter={(_value: number, _name: string, item: { payload?: Bar_ }) =>
              item.payload ? [`$${item.payload.delta.toFixed(2)}`, "Change"] : ["", ""]
            }
          />
          <Bar dataKey="base" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
            {bars.map((bar) => (
              <Cell key={bar.label} fill={colorFor(bar)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        caption="Waterfall breakdown of the bill change"
        columns={[
          { key: "label", label: "Step" },
          { key: "delta", label: "Change ($)" },
        ]}
        rows={bars.map((b) => ({ label: b.label, delta: b.delta.toFixed(2) }))}
      />
    </div>
  );
}
