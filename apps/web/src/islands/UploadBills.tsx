import { useState } from "react";
import type { BillFacts, ServiceType, Traced } from "@electric-analyzer/core";
import { buildManualBillFacts, detectAdapter, parseCsv, psegAdapter, type ManualEntryInput } from "@electric-analyzer/adapters";
import { indexedDbAdapter } from "../lib/storage/indexeddb";
import { extractPdfText } from "../lib/pdf-text";

interface PendingReview {
  fileId: string;
  fileName: string;
  facts: Partial<BillFacts>;
  warnings: string[];
}

const ADAPTERS = [psegAdapter];

function emptyManualInput(): ManualEntryInput {
  return {
    utility: "",
    serviceType: "electric",
    periodStart: "",
    periodEnd: "",
    taxes: 0,
    totalCharge: 0,
  };
}

function numberInputValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function tracedFromInput(
  original: Traced<number> | undefined,
  rawInput: string,
  fileId: string,
): Traced<number> | undefined {
  if (rawInput.trim() === "") return undefined;
  const value = Number(rawInput);
  if (!Number.isFinite(value)) return undefined;
  if (original && original.value === value) return original;
  return { value, provenance: original?.provenance ?? { fileId, page: 1 }, confidence: 1, userCorrected: true };
}

export function UploadBills() {
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [pendingComplete, setPendingComplete] = useState<BillFacts[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState<ManualEntryInput>(emptyManualInput());
  const [saving, setSaving] = useState(false);

  async function handleFiles(files: FileList) {
    const errors: string[] = [];
    const reviews: PendingReview[] = [];
    const complete: BillFacts[] = [];

    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith(".csv")) {
        const text = await file.text();
        const result = parseCsv(text, file.name);
        complete.push(...result.facts);
        errors.push(...result.errors.map((e) => `${file.name}: ${e}`));
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const text = await extractPdfText(file);
          const adapter = detectAdapter(ADAPTERS, text);
          if (!adapter) {
            errors.push(`${file.name}: no adapter recognized this bill — use manual entry instead.`);
            continue;
          }
          const result = adapter.parseText(text, file.name);
          reviews.push({ fileId: file.name, fileName: file.name, facts: result.facts, warnings: result.warnings });
        } catch {
          errors.push(`${file.name}: couldn't read this PDF — use manual entry instead.`);
        }
      } else {
        errors.push(`${file.name}: unsupported file type (expected .pdf or .csv)`);
      }
    }

    setPendingReviews((prev) => [...prev, ...reviews]);
    setPendingComplete((prev) => [...prev, ...complete]);
    setFileErrors(errors);
  }

  function confirmReview(review: PendingReview, form: Record<string, string>) {
    const fileId = review.fileId;
    const kWh = tracedFromInput(review.facts.electric?.kWh, form.kWh ?? "", fileId);
    const electricSupply = tracedFromInput(review.facts.electric?.supplyCharge, form.electricSupply ?? "", fileId);
    const electricDelivery = tracedFromInput(review.facts.electric?.deliveryCharge, form.electricDelivery ?? "", fileId);
    const therms = tracedFromInput(review.facts.gas?.therms, form.therms ?? "", fileId);
    const gasSupply = tracedFromInput(review.facts.gas?.supplyCharge, form.gasSupply ?? "", fileId);
    const gasDelivery = tracedFromInput(review.facts.gas?.deliveryCharge, form.gasDelivery ?? "", fileId);
    const taxes = tracedFromInput(review.facts.taxes, form.taxes ?? "", fileId);
    const totalCharge = tracedFromInput(review.facts.totalCharge, form.totalCharge ?? "", fileId);

    if (!taxes || !totalCharge) return;

    const electric = kWh && electricSupply && electricDelivery ? { kWh, supplyCharge: electricSupply, deliveryCharge: electricDelivery } : undefined;
    const gas = therms && gasSupply && gasDelivery ? { therms, supplyCharge: gasSupply, deliveryCharge: gasDelivery } : undefined;

    const facts: BillFacts = {
      id: `${fileId}-${Date.now()}`,
      utility: review.facts.utility ?? form.utility ?? "Unknown utility",
      serviceType: (electric && gas ? "combined" : gas ? "gas" : "electric") as ServiceType,
      periodStart: review.facts.periodStart ?? {
        value: form.periodStart ?? "",
        provenance: { fileId, page: 1 },
        confidence: 1,
        userCorrected: true,
      },
      periodEnd: review.facts.periodEnd ?? {
        value: form.periodEnd ?? "",
        provenance: { fileId, page: 1 },
        confidence: 1,
        userCorrected: true,
      },
      electric,
      gas,
      fixedAndOtherCharges: review.facts.fixedAndOtherCharges ?? [],
      taxes,
      totalCharge,
      sourceRef: { fileId, fileName: review.fileName },
      reviewedAt: new Date().toISOString(),
      schemaVersion: 1,
    };

    setPendingComplete((prev) => [...prev, facts]);
    setPendingReviews((prev) => prev.filter((r) => r.fileId !== review.fileId));
  }

  function addManualBill() {
    const facts = buildManualBillFacts(manualInput, `manual-${Date.now()}`);
    setPendingComplete((prev) => [...prev, facts]);
    setManualInput(emptyManualInput());
  }

  async function saveAll() {
    setSaving(true);
    for (const bill of pendingComplete) {
      await indexedDbAdapter.putBill(bill);
    }
    setPendingComplete([]);
    setSaving(false);
    window.dispatchEvent(new CustomEvent("bills-saved"));
  }

  return (
    <div className="container">
      <h1>Upload bills</h1>

      <section className="section card">
        <h2>PDF or CSV</h2>
        <input
          type="file"
          multiple
          accept=".pdf,.csv"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        {fileErrors.length > 0 && (
          <ul className="fact-list verification-error">
            {fileErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>

      {pendingReviews.map((review) => (
        <ReviewForm key={review.fileId} review={review} onConfirm={confirmReview} />
      ))}

      <section className="section card">
        <h2>Manual entry</h2>
        <ManualEntryForm value={manualInput} onChange={setManualInput} />
        <button type="button" onClick={addManualBill}>
          Add bill
        </button>
      </section>

      {pendingComplete.length > 0 && (
        <section className="section card">
          <h2>{pendingComplete.length} bill(s) ready to save</h2>
          <button type="button" onClick={saveAll} disabled={saving}>
            {saving ? "Saving..." : "Save to this browser"}
          </button>
        </section>
      )}
    </div>
  );
}

function ReviewForm({
  review,
  onConfirm,
}: {
  review: PendingReview;
  onConfirm: (review: PendingReview, form: Record<string, string>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    utility: review.facts.utility ?? "",
    periodStart: review.facts.periodStart?.value ?? "",
    periodEnd: review.facts.periodEnd?.value ?? "",
    kWh: numberInputValue(review.facts.electric?.kWh.value),
    electricSupply: numberInputValue(review.facts.electric?.supplyCharge.value),
    electricDelivery: numberInputValue(review.facts.electric?.deliveryCharge.value),
    therms: numberInputValue(review.facts.gas?.therms.value),
    gasSupply: numberInputValue(review.facts.gas?.supplyCharge.value),
    gasDelivery: numberInputValue(review.facts.gas?.deliveryCharge.value),
    taxes: numberInputValue(review.facts.taxes?.value),
    totalCharge: numberInputValue(review.facts.totalCharge?.value),
  });

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section className="section card">
      <h2>Review: {review.fileName}</h2>
      {review.warnings.length > 0 && (
        <ul className="fact-list verification-error">
          {review.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <p>Never silently trusted — correct anything that misread before saving.</p>
      <label>
        Period start
        <input value={form.periodStart} onChange={(e) => set("periodStart", e.target.value)} placeholder="YYYY-MM-DD" />
      </label>
      <label>
        Period end
        <input value={form.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} placeholder="YYYY-MM-DD" />
      </label>
      <label>
        Electric kWh
        <input value={form.kWh} onChange={(e) => set("kWh", e.target.value)} />
      </label>
      <label>
        Electric supply charge
        <input value={form.electricSupply} onChange={(e) => set("electricSupply", e.target.value)} />
      </label>
      <label>
        Electric delivery charge
        <input value={form.electricDelivery} onChange={(e) => set("electricDelivery", e.target.value)} />
      </label>
      <label>
        Gas therms
        <input value={form.therms} onChange={(e) => set("therms", e.target.value)} />
      </label>
      <label>
        Gas supply charge
        <input value={form.gasSupply} onChange={(e) => set("gasSupply", e.target.value)} />
      </label>
      <label>
        Gas delivery charge
        <input value={form.gasDelivery} onChange={(e) => set("gasDelivery", e.target.value)} />
      </label>
      <label>
        Taxes
        <input value={form.taxes} onChange={(e) => set("taxes", e.target.value)} />
      </label>
      <label>
        Total charge
        <input value={form.totalCharge} onChange={(e) => set("totalCharge", e.target.value)} />
      </label>
      <button type="button" onClick={() => onConfirm(review, form)}>
        Confirm & queue
      </button>
    </section>
  );
}

function ManualEntryForm({
  value,
  onChange,
}: {
  value: ManualEntryInput;
  onChange: (v: ManualEntryInput) => void;
}) {
  function set<K extends keyof ManualEntryInput>(key: K, v: ManualEntryInput[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <>
      <label>
        Utility
        <input value={value.utility} onChange={(e) => set("utility", e.target.value)} />
      </label>
      <label>
        Service type
        <select value={value.serviceType} onChange={(e) => set("serviceType", e.target.value as ServiceType)}>
          <option value="electric">Electric</option>
          <option value="gas">Gas</option>
          <option value="combined">Combined</option>
        </select>
      </label>
      <label>
        Period start
        <input value={value.periodStart} onChange={(e) => set("periodStart", e.target.value)} placeholder="YYYY-MM-DD" />
      </label>
      <label>
        Period end
        <input value={value.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} placeholder="YYYY-MM-DD" />
      </label>
      {value.serviceType !== "gas" && (
        <>
          <label>
            Electric kWh
            <input
              type="number"
              value={value.electric?.kWh ?? ""}
              onChange={(e) =>
                set("electric", {
                  kWh: Number(e.target.value),
                  supplyCharge: value.electric?.supplyCharge ?? 0,
                  deliveryCharge: value.electric?.deliveryCharge ?? 0,
                })
              }
            />
          </label>
          <label>
            Electric supply charge
            <input
              type="number"
              value={value.electric?.supplyCharge ?? ""}
              onChange={(e) =>
                set("electric", {
                  kWh: value.electric?.kWh ?? 0,
                  supplyCharge: Number(e.target.value),
                  deliveryCharge: value.electric?.deliveryCharge ?? 0,
                })
              }
            />
          </label>
          <label>
            Electric delivery charge
            <input
              type="number"
              value={value.electric?.deliveryCharge ?? ""}
              onChange={(e) =>
                set("electric", {
                  kWh: value.electric?.kWh ?? 0,
                  supplyCharge: value.electric?.supplyCharge ?? 0,
                  deliveryCharge: Number(e.target.value),
                })
              }
            />
          </label>
        </>
      )}
      {value.serviceType !== "electric" && (
        <>
          <label>
            Gas therms
            <input
              type="number"
              value={value.gas?.therms ?? ""}
              onChange={(e) =>
                set("gas", {
                  therms: Number(e.target.value),
                  supplyCharge: value.gas?.supplyCharge ?? 0,
                  deliveryCharge: value.gas?.deliveryCharge ?? 0,
                })
              }
            />
          </label>
          <label>
            Gas supply charge
            <input
              type="number"
              value={value.gas?.supplyCharge ?? ""}
              onChange={(e) =>
                set("gas", {
                  therms: value.gas?.therms ?? 0,
                  supplyCharge: Number(e.target.value),
                  deliveryCharge: value.gas?.deliveryCharge ?? 0,
                })
              }
            />
          </label>
          <label>
            Gas delivery charge
            <input
              type="number"
              value={value.gas?.deliveryCharge ?? ""}
              onChange={(e) =>
                set("gas", {
                  therms: value.gas?.therms ?? 0,
                  supplyCharge: value.gas?.supplyCharge ?? 0,
                  deliveryCharge: Number(e.target.value),
                })
              }
            />
          </label>
        </>
      )}
      <label>
        Taxes
        <input type="number" value={value.taxes} onChange={(e) => set("taxes", Number(e.target.value))} />
      </label>
      <label>
        Total charge
        <input type="number" value={value.totalCharge} onChange={(e) => set("totalCharge", Number(e.target.value))} />
      </label>
    </>
  );
}
