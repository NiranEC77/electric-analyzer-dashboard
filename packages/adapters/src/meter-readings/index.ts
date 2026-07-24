/**
 * Parses the meter-reading history export from a utility's online account
 * portal (distinct from a bill PDF/CSV — this is raw cumulative register
 * data, tab-separated: date, "{Service} - {description}", meter ID, a
 * numeric code, reading type, the register value). Meter IDs are handled
 * like any other field here but are explicitly on the "never commit" list
 * (see docs/privacy.md) — test fixtures must use fake ones.
 */

export type MeterService = "electric" | "gas";

export interface MeterReading {
  date: string;
  service: MeterService;
  meterId: string;
  readingType: string;
  value: number;
}

export interface ParseMeterReadingsResult {
  readings: MeterReading[];
  errors: string[];
}

function parseDate(raw: string): string | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return undefined;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function parseService(label: string): MeterService | undefined {
  if (/electric/i.test(label)) return "electric";
  if (/gas/i.test(label)) return "gas";
  return undefined;
}

export function parseMeterReadingHistory(text: string): ParseMeterReadingsResult {
  const readings: MeterReading[] = [];
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  lines.forEach((line, i) => {
    let cols = line.split(/\t+/).map((c) => c.trim());
    if (cols.length < 6) cols = line.split(/\s{2,}/).map((c) => c.trim());
    if (cols.length < 6) {
      errors.push(`Row ${i + 1}: expected 6 columns (date, service, meter ID, code, reading type, value), got ${cols.length}.`);
      return;
    }

    const [dateRaw, serviceLabel, meterId, , readingType, valueRaw] = cols as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    const date = parseDate(dateRaw);
    if (!date) {
      errors.push(`Row ${i + 1}: couldn't parse date "${dateRaw}" (expected MM/DD/YYYY).`);
      return;
    }
    const service = parseService(serviceLabel);
    if (!service) {
      errors.push(`Row ${i + 1}: couldn't tell electric from gas in "${serviceLabel}".`);
      return;
    }
    const value = Number(valueRaw.replace(/,/g, ""));
    if (!Number.isFinite(value)) {
      errors.push(`Row ${i + 1}: couldn't parse reading value "${valueRaw}".`);
      return;
    }

    readings.push({ date, service, meterId, readingType, value });
  });

  return { readings, errors };
}

export interface UsageInterval {
  service: MeterService;
  periodStart: string;
  periodEnd: string;
  quantity: number;
  startReading: number;
  endReading: number;
}

export interface ComputeUsageResult {
  intervals: UsageInterval[];
  warnings: string[];
}

/**
 * Turns a raw reading log into usage-per-interval, by service — consecutive
 * same-service readings, sorted by date, delta the register value. Meters
 * occasionally reset or a reading gets miskeyed; rather than silently
 * emitting negative usage, those intervals are skipped and reported as a
 * warning so a bad row never quietly corrupts a chart.
 */
export function computeUsageFromReadings(readings: MeterReading[]): ComputeUsageResult {
  const intervals: UsageInterval[] = [];
  const warnings: string[] = [];

  const byService = new Map<MeterService, MeterReading[]>();
  for (const r of readings) {
    const list = byService.get(r.service) ?? [];
    list.push(r);
    byService.set(r.service, list);
  }

  for (const [service, list] of byService) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1] as MeterReading;
      const cur = sorted[i] as MeterReading;
      const quantity = cur.value - prev.value;
      if (quantity < 0) {
        warnings.push(
          `${service}: reading on ${cur.date} (${cur.value}) is lower than the previous reading on ${prev.date} (${prev.value}) — skipped, likely a meter reset or misread.`,
        );
        continue;
      }
      intervals.push({
        service,
        periodStart: prev.date,
        periodEnd: cur.date,
        quantity,
        startReading: prev.value,
        endReading: cur.value,
      });
    }
  }

  intervals.sort((a, b) => a.periodStart.localeCompare(b.periodStart) || a.service.localeCompare(b.service));
  return { intervals, warnings };
}
