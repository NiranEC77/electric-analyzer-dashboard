import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { decompositionBasis, type BillFacts } from "@electric-analyzer/core";
import { DataTable } from "../DataTable";

interface Props {
  bills: BillFacts[];
}

interface Row {
  period: string;
  amount: number;
  totalDue: number;
  carried: number;
}

function toRow(bill: BillFacts): Row {
  return {
    period: bill.periodStart.value,
    amount: Math.round(decompositionBasis(bill) * 100) / 100,
    totalDue: Math.round(bill.totalCharge.value * 100) / 100,
    carried: Math.round((bill.previousBalance?.value ?? 0) * 100) / 100,
  };
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, padding: "0.5rem 0.75rem", borderRadius: 6 }}>
      <div style={{ color: "var(--text-primary)", marginBottom: 4 }}>{row.period}</div>
      <div className="num">This bill&apos;s charges: ${row.amount.toFixed(2)}</div>
      {row.carried > 0 && (
        <div className="num" style={{ color: "var(--text-secondary)" }}>
          + ${row.carried.toFixed(2)} carried from a prior bill (amount due: ${row.totalDue.toFixed(2)})
        </div>
      )}
    </div>
  );
}

/**
 * The histogram: your bill, one bar per period. Uses this-period charges
 * (not amount due), so a carried-over unpaid balance never makes a bar look
 * taller than the period it actually covers — see the tooltip for that detail.
 */
export function MonthlyTotalsChart({ bills }: Props) {
  const data = bills.map(toRow);

  return (
    <div>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 0 }}>
        Each bar is what that billing period actually charged you — a balance carried over from an unpaid prior
        bill is called out separately, not baked into the bar, so the trend isn&apos;t skewed by a late payment.
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barCategoryGap={8}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" width={56} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((row) => (
              <Cell key={row.period} fill={row.carried > 0 ? "var(--series-2)" : "var(--series-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data.some((r) => r.carried > 0) && (
        <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--series-2)" }}>■</span> bills that carried a balance from a prior unpaid
          bill (see tooltip) &nbsp; <span style={{ color: "var(--series-1)" }}>■</span> bills paid in full
        </p>
      )}
      <DataTable
        caption="Bill amount by period"
        columns={[
          { key: "period", label: "Period" },
          { key: "amount", label: "This period's charges ($)" },
          { key: "carried", label: "Carried from prior bill ($)" },
          { key: "totalDue", label: "Total amount due ($)" },
        ]}
        rows={data.map((row) => ({ ...row }))}
      />
    </div>
  );
}
