import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BillFacts } from "@electric-analyzer/core";
import { DataTable } from "../DataTable";

interface Props {
  bills: BillFacts[];
}

function toRow(bill: BillFacts) {
  return {
    period: bill.periodStart.value,
    Supply: round2((bill.electric?.supplyCharge.value ?? 0) + (bill.gas?.supplyCharge.value ?? 0)),
    Delivery: round2((bill.electric?.deliveryCharge.value ?? 0) + (bill.gas?.deliveryCharge.value ?? 0)),
    Fixed: round2(bill.fixedAndOtherCharges.reduce((sum, c) => sum + c.amount.value, 0)),
    Taxes: round2(bill.taxes.value),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Stacked bar: supply / delivery / fixed / taxes composition per bill, over time. */
export function CompositionChart({ bills }: Props) {
  const data = bills.map(toRow);

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="period" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--baseline)" />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12 }}
            labelStyle={{ color: "var(--text-primary)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-secondary)" }} />
          <Bar dataKey="Supply" stackId="composition" fill="var(--series-1)" />
          <Bar dataKey="Delivery" stackId="composition" fill="var(--series-2)" />
          <Bar dataKey="Fixed" stackId="composition" fill="var(--series-3)" />
          <Bar dataKey="Taxes" stackId="composition" fill="var(--series-4)" />
        </BarChart>
      </ResponsiveContainer>
      <DataTable
        caption="Bill composition by period"
        columns={[
          { key: "period", label: "Period" },
          { key: "Supply", label: "Supply ($)" },
          { key: "Delivery", label: "Delivery ($)" },
          { key: "Fixed", label: "Fixed ($)" },
          { key: "Taxes", label: "Taxes ($)" },
        ]}
        rows={data}
      />
    </div>
  );
}
