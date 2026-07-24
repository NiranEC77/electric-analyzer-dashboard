import { describe, expect, it } from "vitest";
import { computeUsageFromReadings, parseMeterReadingHistory } from "../src/meter-readings/index.js";

// Synthetic — fake meter IDs and made-up register values, not a real export.
const FIXTURE = [
  "03/17/2026\tGas - Meter reading by utility company\t1000001\t001\tPeriodic Meter Reading\t5000",
  "04/16/2026\tGas - Meter reading by utility company\t1000001\t001\tPeriodic Meter Reading\t5120",
  "05/18/2026\tGas - Meter reading by utility company\t1000001\t001\tPeriodic Meter Reading\t5200",
  "03/18/2026\tElectric - Meter reading by utility company\t2000002\t002\tPeriodic Meter Reading\t40000",
  "04/17/2026\tElectric - Meter reading by utility company\t2000002\t002\tPeriodic Meter Reading\t41000",
  "05/18/2026\tElectric - Meter reading by utility company\t2000002\t002\tPeriodic Meter Reading\t42500",
].join("\n");

describe("parseMeterReadingHistory", () => {
  it("parses tab-separated rows into structured readings", () => {
    const { readings, errors } = parseMeterReadingHistory(FIXTURE);
    expect(errors).toHaveLength(0);
    expect(readings).toHaveLength(6);
    expect(readings[0]).toEqual({
      date: "2026-03-17",
      service: "gas",
      meterId: "1000001",
      readingType: "Periodic Meter Reading",
      value: 5000,
    });
    expect(readings.filter((r) => r.service === "electric")).toHaveLength(3);
  });

  it("also accepts multi-space-separated rows (paste variance)", () => {
    const line = "03/17/2026    Gas - Meter reading by utility company    1000001    001    Periodic Meter Reading    5000";
    const { readings, errors } = parseMeterReadingHistory(line);
    expect(errors).toHaveLength(0);
    expect(readings[0]?.value).toBe(5000);
  });

  it("reports, per row, what it couldn't parse instead of silently dropping it", () => {
    const bad = [
      "not-a-date\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\t100",
      "03/17/2026\tSolar - something else\t1\t001\tPeriodic Meter Reading\t100",
      "03/17/2026\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\tnot-a-number",
    ].join("\n");
    const { readings, errors } = parseMeterReadingHistory(bad);
    expect(readings).toHaveLength(0);
    expect(errors).toHaveLength(3);
  });
});

describe("computeUsageFromReadings", () => {
  it("deltas consecutive same-service readings into usage intervals", () => {
    const { readings } = parseMeterReadingHistory(FIXTURE);
    const { intervals, warnings } = computeUsageFromReadings(readings);

    expect(warnings).toHaveLength(0);
    expect(intervals).toHaveLength(4); // 2 gas intervals + 2 electric intervals

    const gasIntervals = intervals.filter((i) => i.service === "gas");
    expect(gasIntervals[0]).toEqual({
      service: "gas",
      periodStart: "2026-03-17",
      periodEnd: "2026-04-16",
      quantity: 120,
      startReading: 5000,
      endReading: 5120,
    });
    expect(gasIntervals[1]?.quantity).toBe(80);

    const electricIntervals = intervals.filter((i) => i.service === "electric");
    expect(electricIntervals[0]?.quantity).toBe(1000);
    expect(electricIntervals[1]?.quantity).toBe(1500);
  });

  it("skips (with a warning) an interval where the reading went backwards, instead of emitting negative usage", () => {
    const { readings } = parseMeterReadingHistory(
      [
        "03/17/2026\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\t5000",
        "04/16/2026\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\t4900", // meter reset / misread
        "05/18/2026\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\t5050",
      ].join("\n"),
    );
    const { intervals, warnings } = computeUsageFromReadings(readings);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/lower than the previous reading/);
    // The bad interval is skipped; the next one is still computed against its own prior reading.
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.quantity).toBe(150); // 5050 - 4900
  });

  it("returns nothing for fewer than two readings of a service", () => {
    const { readings } = parseMeterReadingHistory(
      "03/17/2026\tGas - Meter reading by utility company\t1\t001\tPeriodic Meter Reading\t5000",
    );
    const { intervals, warnings } = computeUsageFromReadings(readings);
    expect(intervals).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});
