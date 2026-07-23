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
