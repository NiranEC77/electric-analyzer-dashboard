import { afterEach, describe, expect, it, vi } from "vitest";
import { openMeteoDegreeDaySource, sumDegreeDays } from "../src/weather/index.js";

function mockArchiveResponse(temps: Array<number | null>, ok = true, status = 200) {
  const time = temps.map((_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
  return {
    ok,
    status,
    json: async () => ({ daily: { time, temperature_2m_mean: temps } }),
  };
}

describe("openMeteoDegreeDaySource", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("computes HDD/CDD from daily mean temperature against a 65F base", async () => {
    // 55F -> 10 HDD, 0 CDD. 75F -> 0 HDD, 10 CDD. 65F -> 0/0 exactly at base.
    const fetchMock = vi.fn().mockResolvedValue(mockArchiveResponse([55, 75, 65]));
    vi.stubGlobal("fetch", fetchMock);

    const points = await openMeteoDegreeDaySource.fetch(40.9, -74.1, "2026-01-01", "2026-01-03");

    expect(points).toEqual([
      { date: "2026-01-01", hdd: 10, cdd: 0 },
      { date: "2026-01-02", hdd: 0, cdd: 10 },
      { date: "2026-01-03", hdd: 0, cdd: 0 },
    ]);
  });

  it("treats a missing daily reading as 0/0 rather than throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockArchiveResponse([60, null]));
    vi.stubGlobal("fetch", fetchMock);

    const points = await openMeteoDegreeDaySource.fetch(40.9, -74.1, "2026-01-01", "2026-01-02");
    expect(points[1]).toEqual({ date: "2026-01-02", hdd: 0, cdd: 0 });
  });

  it("throws on a non-OK response rather than silently returning nothing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockArchiveResponse([], false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(openMeteoDegreeDaySource.fetch(40.9, -74.1, "2026-01-01", "2026-01-02")).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("passes latitude/longitude/date range through as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockArchiveResponse([60]));
    vi.stubGlobal("fetch", fetchMock);

    await openMeteoDegreeDaySource.fetch(41.8781, -87.6298, "2026-01-16", "2026-02-17");

    const calledUrl = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(calledUrl.searchParams.get("latitude")).toBe("41.8781");
    expect(calledUrl.searchParams.get("longitude")).toBe("-87.6298");
    expect(calledUrl.searchParams.get("start_date")).toBe("2026-01-16");
    expect(calledUrl.searchParams.get("end_date")).toBe("2026-02-17");
  });
});

describe("sumDegreeDays", () => {
  it("sums hdd and cdd across points", () => {
    const total = sumDegreeDays([
      { date: "a", hdd: 10, cdd: 0 },
      { date: "b", hdd: 5, cdd: 2 },
    ]);
    expect(total).toEqual({ hdd: 15, cdd: 2 });
  });

  it("returns zero for an empty history", () => {
    expect(sumDegreeDays([])).toEqual({ hdd: 0, cdd: 0 });
  });
});
