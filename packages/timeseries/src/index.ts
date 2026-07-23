/**
 * Phase E (future): interval-resolution data — Green Button exports,
 * whole-panel monitors (per-circuit), smart plugs (per-device watts).
 * Interface only, per the project brief: stub the contract now, implement
 * behind it later without changing callers. Nothing in this package is
 * wired up yet.
 */

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  unit: string;
}

export interface TimeSeriesChannel {
  id: string;
  label: string;
  unit: string;
}

export interface TimeSeriesQuery {
  start: string;
  end: string;
  resolution?: "15min" | "hour" | "day";
}

export interface TimeSeriesSource {
  id: string;
  displayName: string;
  channels(): Promise<TimeSeriesChannel[]>;
  query(channelId: string, query: TimeSeriesQuery): Promise<TimeSeriesPoint[]>;
}
