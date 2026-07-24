import type { BillFacts } from "@electric-analyzer/core";
import type { MeterReading } from "@electric-analyzer/adapters";
import type { PersistenceAdapter } from "../persistence/adapter";

const DB_NAME = "electric-analyzer";
const DB_VERSION = 2;
const STORE_NAME = "bills";
const READINGS_STORE_NAME = "meterReadings";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(READINGS_STORE_NAME)) {
        // No natural single-field primary key on a reading; composite id.
        db.createObjectStore(READINGS_STORE_NAME, { keyPath: "_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const indexedDbAdapter: PersistenceAdapter = {
  id: "indexeddb-local",

  async getAllBills() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as BillFacts[]);
      request.onerror = () => reject(request.error);
    });
  },

  async putBill(bill) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(bill);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async deleteBill(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export function exportBillsJson(bills: BillFacts[]): string {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), bills }, null, 2);
}

export function importBillsJson(json: string): BillFacts[] {
  const parsed = JSON.parse(json) as { bills?: unknown };
  if (!Array.isArray(parsed.bills)) throw new Error("Invalid export file: missing bills array");
  return parsed.bills as BillFacts[];
}

// --- Meter readings: a separate store, distinct shape from BillFacts.
// (date, service) uniquely identifies a reading; used as the key so
// re-importing the same export is idempotent rather than duplicating rows.

type StoredMeterReading = MeterReading & { _id: string };

function readingId(r: MeterReading): string {
  return `${r.service}-${r.date}`;
}

export async function putMeterReadings(readings: MeterReading[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(READINGS_STORE_NAME, "readwrite");
    const store = tx.objectStore(READINGS_STORE_NAME);
    for (const r of readings) {
      const stored: StoredMeterReading = { ...r, _id: readingId(r) };
      store.put(stored);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllMeterReadings(): Promise<MeterReading[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(READINGS_STORE_NAME, "readonly");
    const request = tx.objectStore(READINGS_STORE_NAME).getAll();
    request.onsuccess = () => {
      const rows = request.result as StoredMeterReading[];
      resolve(rows.map(({ _id, ...reading }) => reading));
    };
    request.onerror = () => reject(request.error);
  });
}
