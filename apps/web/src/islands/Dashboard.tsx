import { useEffect, useMemo, useState } from "react";
import { generateDemoBills } from "@electric-analyzer/demo-data";
import {
  assertGrounded,
  decompositionBasis,
  describeChange,
  describeHistory,
  UngroundedNumeralError,
  type AnalysisContext,
  type BillFacts,
} from "@electric-analyzer/core";
import { indexedDbAdapter } from "../lib/storage/indexeddb";
import { analyze, effectiveElectricRate, effectiveGasRate } from "../lib/analysis";
import { CompositionChart } from "./charts/CompositionChart";
import { DriversOverTimeChart } from "./charts/DriversOverTimeChart";
import { MonthlyTotalsChart } from "./charts/MonthlyTotalsChart";
import { RateLineChart } from "./charts/RateLineChart";
import { WaterfallChart, type WaterfallStep } from "./charts/WaterfallChart";
import { ExplainThis } from "./ExplainThis";
import { WeatherPanel } from "./WeatherPanel";

function HeadlineCard({ label, value, sign = false }: { label: string; value: number; sign?: boolean }) {
  const formatted = `${sign && value > 0 ? "+" : ""}$${value.toFixed(2)}`;
  return (
    <div className="card">
      <div className="headline-label">{label}</div>
      <div className="headline-value num">{formatted}</div>
    </div>
  );
}

/**
 * The plain-language summary — grounded and verified exactly like a
 * suggestion. Shared by the "latest bill" and "full history" sections; each
 * computes its own narrative (describeChange vs describeHistory) and passes
 * it in, since the verification/render logic is identical either way.
 */
function NarrativeBlock({
  narrative,
  context,
}: {
  narrative: { headline: string; explanation: string };
  context: AnalysisContext;
}) {
  const text = `${narrative.headline} ${narrative.explanation}`;

  try {
    assertGrounded(text, context);
  } catch (err) {
    const message = err instanceof UngroundedNumeralError ? err.message : "Verification failed";
    return (
      <div className="narrative verification-error">
        <p>Verification failed for the summary: {message}</p>
      </div>
    );
  }

  return (
    <div className="narrative">
      <p className="headline">{narrative.headline}</p>
      <p className="explanation">{narrative.explanation}</p>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  context,
}: {
  suggestion: { id: string; title: string; body: string; confidence: string; triggeringFacts: Array<{ path: string; value: number }> };
  context: Parameters<typeof assertGrounded>[1];
}) {
  try {
    assertGrounded(suggestion.body, context);
  } catch (err) {
    const message = err instanceof UngroundedNumeralError ? err.message : "Verification failed";
    return (
      <div className="suggestion verification-error">
        <h3>Verification failed for "{suggestion.title}"</h3>
        <p>{message}</p>
      </div>
    );
  }

  return (
    <div className="suggestion">
      <h3>{suggestion.title}</h3>
      <span className="confidence">{suggestion.confidence} confidence</span>
      <p>{suggestion.body}</p>
      <ExplainThis facts={suggestion.triggeringFacts.map((f) => ({ label: f.path, value: f.value }))} />
    </div>
  );
}

export function Dashboard() {
  const [bills, setBills] = useState<BillFacts[] | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    indexedDbAdapter
      .getAllBills()
      .then((stored) => {
        if (cancelled) return;
        if (stored.length >= 2) {
          setBills(stored);
          setIsDemoMode(false);
        } else {
          setBills(generateDemoBills());
          setIsDemoMode(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBills(generateDemoBills());
          setIsDemoMode(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const analysis = useMemo(() => analyze(bills ?? []), [bills]);

  if (!bills) {
    return <p className="container">Loading...</p>;
  }

  // analysis.bills is chronologically sorted (analyze() sorts by periodStart) —
  // every chart must read from this, not the raw `bills` state, which reflects
  // IndexedDB/upload insertion order and is NOT guaranteed to be chronological.
  const { bills: sortedBills, decomposition, history, suggestions, context, previous, latest } = analysis;

  // history.perPeriod[i] is the decomposition from sortedBills[i] to
  // sortedBills[i+1], so its label is the "to" bill's period.
  const driverPeriodLabels = sortedBills.slice(1).map((b) => b.periodStart.value);

  // Base/end bars use decompositionBasis (this period's own charges), matching
  // what the decomposition actually reconciles against — see packages/core.
  // Using totalCharge here instead would make the bars not add up whenever a
  // bill carries a balance from a prior unpaid bill.
  const waterfallSteps: WaterfallStep[] | null = decomposition
    ? [
        { label: "Previous bill", delta: decompositionBasis(previous!), isTotal: true },
        { label: "Rate changes", delta: decomposition.supply.priceEffect + decomposition.delivery.priceEffect },
        {
          label: "Usage changes",
          delta: decomposition.supply.consumptionEffect + decomposition.delivery.consumptionEffect,
        },
        { label: "Fees & credits", delta: decomposition.feesEffect },
        { label: "Current bill", delta: decompositionBasis(latest!), isTotal: true },
      ]
    : null;

  const electricRatePoints = sortedBills
    .map((b) => ({ period: b.periodStart.value, rate: effectiveElectricRate(b) }))
    .filter((p): p is { period: string; rate: number } => p.rate !== undefined);

  const gasRatePoints = sortedBills
    .map((b) => ({ period: b.periodStart.value, rate: effectiveGasRate(b) }))
    .filter((p): p is { period: string; rate: number } => p.rate !== undefined);

  return (
    <div className="container">
      {isDemoMode && (
        <div className="banner" role="status">
          Demo mode — showing seeded synthetic bill history, not your data. Upload your own bills to replace it.
        </div>
      )}

      <h1>Why is your bill going up?</h1>

      <section className="section">
        <h2>Your bill over time</h2>
        <MonthlyTotalsChart bills={sortedBills} />
      </section>

      {history && (
        <section className="section">
          <h2>The big picture</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
            {sortedBills.length} bills on file, {history.periodStart} to {history.periodEnd}
          </p>
          <NarrativeBlock narrative={describeHistory(history)} context={context} />
          <div className="headline-grid">
            <HeadlineCard label="Total change" value={history.totalChange} sign />
            <HeadlineCard label="From rate changes" value={history.cumulativePriceEffect} sign />
            <HeadlineCard label="From usage changes" value={history.cumulativeConsumptionEffect} sign />
            <HeadlineCard label="From fees & credits" value={history.cumulativeFeesEffect} sign />
          </div>
          {!history.checksPassed && (
            <p className="verification-error">
              Reconciliation check failed across the bill history: cumulative effects don't sum to the total change
              within tolerance. This should never happen — please file an issue.
            </p>
          )}
          <h3 style={{ fontSize: "1rem", marginTop: "2rem" }}>What drove it, bill by bill</h3>
          <DriversOverTimeChart perPeriod={history.perPeriod} periodLabels={driverPeriodLabels} />
        </section>
      )}

      {latest?.previousBalance && latest.previousBalance.value > 0 && (
        <div className="banner" role="note">
          This bill's <strong>total amount due</strong> includes a{" "}
          <span className="num">${latest.previousBalance.value.toFixed(2)}</span> balance carried from a prior bill
          {latest.payments && latest.payments.value > 0 ? (
            <>
              {" "}(<span className="num">${latest.payments.value.toFixed(2)}</span> in payments applied)
            </>
          ) : null}
          . The summary and breakdown below are based on <strong>this month's charges only</strong>, so a
          carried-over balance is never counted as a rate, usage, or fee increase.
        </div>
      )}

      {decomposition ? (
        <>
          <h2>Your latest bill</h2>
          <NarrativeBlock narrative={describeChange(decomposition)} context={context} />

          <div className="headline-grid">
            <HeadlineCard label="Total change" value={decomposition.totalChange} sign />
            <HeadlineCard
              label="From rate changes"
              value={decomposition.supply.priceEffect + decomposition.delivery.priceEffect}
              sign
            />
            <HeadlineCard
              label="From usage changes"
              value={decomposition.supply.consumptionEffect + decomposition.delivery.consumptionEffect}
              sign
            />
            <HeadlineCard label="From fees & credits" value={decomposition.feesEffect} sign />
          </div>
          {!decomposition.checksPassed && (
            <p className="verification-error">
              Reconciliation check failed: effects don't sum to the total change within tolerance. This should never
              happen — please file an issue with the two bill periods involved.
            </p>
          )}

          <section className="section">
            <h2>Where the change came from</h2>
            {waterfallSteps && <WaterfallChart steps={waterfallSteps} />}
          </section>

          <WeatherPanel previous={previous} latest={latest} />
        </>
      ) : (
        <p>Upload at least two bills to see a decomposition.</p>
      )}

      <section className="section">
        <h2>Bill composition over time</h2>
        <CompositionChart bills={sortedBills} />
      </section>

      {electricRatePoints.length > 1 && (
        <section className="section">
          <h2>Effective electric rate ($/kWh)</h2>
          <RateLineChart title="Effective electric rate" unitLabel="$/kWh" points={electricRatePoints} />
        </section>
      )}

      {gasRatePoints.length > 1 && (
        <section className="section">
          <h2>Effective gas rate ($/therm)</h2>
          <RateLineChart title="Effective gas rate" unitLabel="$/therm" points={gasRatePoints} />
        </section>
      )}

      <section className="section">
        <h2>What to do about it</h2>
        {suggestions.map((s) => (
          <SuggestionCard key={s.id} suggestion={s} context={context} />
        ))}
      </section>
    </div>
  );
}
