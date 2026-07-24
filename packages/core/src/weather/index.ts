import type { WeatherFit } from "../types/index.js";

export interface DegreeDayPoint {
  date: string;
  hdd: number;
  cdd: number;
}

export interface DegreeDaySource {
  fetch(latitude: number, longitude: number, start: string, end: string): Promise<DegreeDayPoint[]>;
}

export interface UsagePoint {
  periodStart: string;
  periodEnd: string;
  quantity: number;
}

const DEGREE_DAY_BASE_F = 65;

interface OpenMeteoArchiveResponse {
  daily: {
    time: string[];
    temperature_2m_mean: Array<number | null>;
  };
}

/**
 * Real degree-day source backed by Open-Meteo's free historical weather
 * archive — no API key, works in browser/serverless/CLI via the standard
 * fetch() global (all three runtimes have it). Computes heating/cooling
 * degree days from each day's mean temperature against the standard 65°F
 * base NOAA and utilities use. This answers "how cold/hot was it" with real
 * public data; it is NOT the v0.2 regression fit (see fitWeatherModel below,
 * still deferred) — that's a separate, bigger piece of work.
 *
 * Other sources (NOAA GHCN directly, a research agent, anything else) can
 * implement the same DegreeDaySource interface and be swapped in — nothing
 * downstream needs to change. See docs/architecture.md.
 */
export const openMeteoDegreeDaySource: DegreeDaySource = {
  async fetch(latitude, longitude, start, end) {
    const url = new URL("https://archive-api.open-meteo.com/v1/archive");
    url.searchParams.set("latitude", String(latitude));
    url.searchParams.set("longitude", String(longitude));
    url.searchParams.set("start_date", start);
    url.searchParams.set("end_date", end);
    url.searchParams.set("daily", "temperature_2m_mean");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("timezone", "auto");

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Weather fetch failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as OpenMeteoArchiveResponse;

    return body.daily.time.map((date, i) => {
      const mean = body.daily.temperature_2m_mean[i];
      if (mean === null || mean === undefined) return { date, hdd: 0, cdd: 0 };
      return {
        date,
        hdd: Math.max(0, DEGREE_DAY_BASE_F - mean),
        cdd: Math.max(0, mean - DEGREE_DAY_BASE_F),
      };
    });
  },
};

export function sumDegreeDays(points: DegreeDayPoint[]): { hdd: number; cdd: number } {
  return points.reduce((acc, p) => ({ hdd: acc.hdd + p.hdd, cdd: acc.cdd + p.cdd }), { hdd: 0, cdd: 0 });
}

/**
 * v0.2: fits kWh/therms = baseload + a*CDD + b*HDD against NOAA GHCN degree
 * days. Stubbed for v0.1 (see STATE.md) — always returns a suppressed fit
 * so callers never mistake "not implemented yet" for "no correlation found".
 */
export function fitWeatherModel(
  serviceType: "electric" | "gas",
  _usage: UsagePoint[],
  _degreeDays: DegreeDayPoint[],
): WeatherFit {
  return { serviceType, baseload: 0, rSquared: 0, n: 0, suppressed: true };
}
