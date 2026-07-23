import type { BillFacts } from "@electric-analyzer/core";

/**
 * The pluggable persistence surface. IndexedDB (lib/storage) is the
 * zero-config default. Supabase is documented as the multi-device-sync
 * option in docs/persistence-adapters.md but not implemented in v0.1 —
 * implementing it means adding an env-configured adapter behind this same
 * interface, no changes needed elsewhere.
 */
export interface PersistenceAdapter {
  id: string;
  getAllBills(): Promise<BillFacts[]>;
  putBill(bill: BillFacts): Promise<void>;
  deleteBill(id: string): Promise<void>;
}
