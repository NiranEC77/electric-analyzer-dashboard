import { useState } from "react";
import { computeUsageFromReadings, parseMeterReadingHistory } from "@electric-analyzer/adapters";
import { putMeterReadings } from "../lib/storage/indexeddb";

/**
 * A separate data source from bills: raw cumulative meter-register readings
 * exported from a utility's account portal. Pasted directly (that's the
 * shape it comes in — a copied table, not a file) rather than uploaded.
 * Independently verifies bill-parsed usage and fills in dates bills don't
 * cover.
 */
export function MeterReadingsUpload() {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(null);
    const { readings, errors: parseErrors } = parseMeterReadingHistory(text);
    setErrors(parseErrors);

    if (readings.length === 0) {
      setSaving(false);
      return;
    }

    const { warnings: usageWarnings } = computeUsageFromReadings(readings);
    setWarnings(usageWarnings);

    await putMeterReadings(readings);
    setSaved(readings.length);
    setSaving(false);
    window.dispatchEvent(new CustomEvent("bills-saved"));
  }

  return (
    <section className="section card">
      <h2>Meter readings</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        If your utility's account site shows a raw meter-reading history (date, service, meter ID, reading
        type, register value), paste it below. This is independent of your bills — it lets the app verify
        billed usage against the utility's own raw readings, and fill in dates between bills.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste the meter-reading history table here (tab-separated)"
        rows={8}
        style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
      />
      <button type="button" onClick={handleSave} disabled={saving || text.trim().length === 0}>
        {saving ? "Saving..." : "Parse & save"}
      </button>
      {errors.length > 0 && (
        <ul className="fact-list verification-error">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul className="fact-list verification-error">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      {saved !== null && <p role="status">Saved {saved} reading(s).</p>}
    </section>
  );
}
