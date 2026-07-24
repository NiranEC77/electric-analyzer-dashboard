/**
 * Location is runtime config the user explicitly enters — never scraped
 * from a parsed bill's service address (that stays out of BillFacts on
 * purpose). Stored only in this browser's localStorage.
 */
export interface StoredLocation {
  label: string;
  latitude: number;
  longitude: number;
}

const KEY = "electric-analyzer:location";

export function getStoredLocation(): StoredLocation | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredLocation;
  } catch {
    return null;
  }
}

export function setStoredLocation(loc: StoredLocation): void {
  window.localStorage.setItem(KEY, JSON.stringify(loc));
}

export function clearStoredLocation(): void {
  window.localStorage.removeItem(KEY);
}

interface GeocodeResult {
  name: string;
  admin1?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
}

/** Free, no-key geocoding (Open-Meteo) — turns a typed city/ZIP into coordinates. */
export async function geocode(query: string): Promise<StoredLocation | undefined> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Geocoding failed: HTTP ${response.status}`);
  const body = (await response.json()) as { results?: GeocodeResult[] };

  const top = body.results?.[0];
  if (!top) return undefined;
  const label = [top.name, top.admin1, top.country_code].filter(Boolean).join(", ");
  return { label, latitude: top.latitude, longitude: top.longitude };
}
