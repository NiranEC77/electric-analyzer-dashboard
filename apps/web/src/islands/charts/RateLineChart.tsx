import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable } from "../DataTable";

interface Point {
  period: string;
  rate: number;
}

interface Props {
  title: string;
  unitLabel: string;
  points: Point[];
}

/** Single-series line: is the effective rate itself going up, independent of usage. */
export function RateLineChart({ title, unitLabel, points }: Props) {
  const data = points.map((p) => ({ period: p.period, [unitLabel]: Math.round(p.rate * 10000) / 10000 }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" width={64} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Line
            type="monotone"
            dataKey={unitLabel}
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--series-1)" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <DataTable
        caption={title}
        columns={[
          { key: "period", label: "Period" },
          { key: unitLabel, label: unitLabel },
        ]}
        rows={data}
      />
    </div>
  );
}
