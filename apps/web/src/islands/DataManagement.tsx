import { useState } from "react";
import { exportBillsJson, importBillsJson, indexedDbAdapter } from "../lib/storage/indexeddb";

/**
 * The sanctioned way data leaves the browser: an explicit export you
 * trigger, not an automatic sync. Use it to back up, move between devices,
 * or hand your real parsed bills to a tool you run yourself — nothing here
 * calls out to any server.
 */
export function DataManagement() {
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    const bills = await indexedDbAdapter.getAllBills();
    if (bills.length === 0) {
      setStatus("No bills saved in this browser yet — nothing to export.");
      return;
    }
    const json = exportBillsJson(bills);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `electric-analyzer-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${bills.length} bill(s).`);
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    setStatus(null);
    try {
      const text = await file.text();
      const bills = importBillsJson(text);
      for (const bill of bills) {
        await indexedDbAdapter.putBill(bill);
      }
      setStatus(`Imported ${bills.length} bill(s).`);
      window.dispatchEvent(new CustomEvent("bills-saved"));
    } catch (err) {
      setStatus(`Import failed: ${err instanceof Error ? err.message : "invalid file"}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="section card">
      <h2>Your data</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
        Everything above stays in this browser. Export it to back it up, move it to another device, or hand it to
        a tool you run yourself — nothing here is sent anywhere automatically.
      </p>
      <button type="button" onClick={handleExport}>
        Export all bills as JSON
      </button>
      <div style={{ marginTop: "0.75rem" }}>
        <label htmlFor="import-json">Import from a JSON file previously exported here</label>
        <br />
        <input
          id="import-json"
          type="file"
          accept="application/json"
          disabled={importing}
          onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
        />
      </div>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
