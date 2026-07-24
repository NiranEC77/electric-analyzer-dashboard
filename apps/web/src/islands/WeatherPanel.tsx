import { useEffect, useState } from "react";
import { openMeteoDegreeDaySource, sumDegreeDays, type BillFacts } from "@electric-analyzer/core";
import { clearStoredLocation, geocode, getStoredLocation, setStoredLocation, type StoredLocation } from "../lib/location";

interface Props {
  previous?: BillFacts;
  latest?: BillFacts;
}

interface WeatherComparison {
  prevHdd: number;
  latestHdd: number;
}

/**
 * "Is it the weather?" — compares your latest two bill periods against real
 * public heating-degree-day data. Deliberately NOT run through the
 * assertGrounded verifier: weather isn't a BillFacts field, it's live
 * external data, clearly labeled with its source and caveats instead.
 * This is a sanity check, not the full v0.2 weather-normalization
 * regression (fitWeatherModel in packages/core is still a stub for that).
 */
export function WeatherPanel({ previous, latest }: Props) {
  const [location, setLocation] = useState<StoredLocation | null>(null);
  const [input, setInput] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherComparison | null>(null);

  useEffect(() => {
    setLocation(getStoredLocation());
  }, []);

  useEffect(() => {
    if (!location || !previous || !latest) return;
    let cancelled = false;
    setFetching(true);
    setError(null);
    Promise.all([
      openMeteoDegreeDaySource.fetch(
        location.latitude,
        location.longitude,
        previous.periodStart.value,
        previous.periodEnd.value,
      ),
      openMeteoDegreeDaySource.fetch(
        location.latitude,
        location.longitude,
        latest.periodStart.value,
        latest.periodEnd.value,
      ),
    ])
      .then(([prevPoints, latestPoints]) => {
        if (cancelled) return;
        setWeather({ prevHdd: sumDegreeDays(prevPoints).hdd, latestHdd: sumDegreeDays(latestPoints).hdd });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Weather fetch failed");
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location, previous, latest]);

  async function handleSave() {
    if (!input.trim()) return;
    setGeocoding(true);
    setError(null);
    try {
      const found = await geocode(input.trim());
      if (!found) {
        setError("Couldn't find that location — try a city and state, or a ZIP code.");
        return;
      }
      setStoredLocation(found);
      setLocation(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  }

  if (!previous || !latest) return null;

  if (!location) {
    return (
      <section className="section card">
        <h2>Is it the weather?</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          Enter your city or ZIP to compare your bill periods against real public weather data. Stored only in
          this browser, used only to fetch weather for your bill dates — nothing about your bills is sent
          anywhere.
        </p>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. Springfield, IL or 62701"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />{" "}
        <button type="button" onClick={handleSave} disabled={geocoding}>
          {geocoding ? "Looking up..." : "Save"}
        </button>
        {error && <p className="verification-error">{error}</p>}
      </section>
    );
  }

  const hddChange = weather ? weather.latestHdd - weather.prevHdd : null;
  const hddPct = weather && weather.prevHdd > 0 ? ((hddChange as number) / weather.prevHdd) * 100 : null;

  return (
    <section className="section card">
      <h2>Is it the weather?</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
        Comparing your last two bill periods against heating degree days near {location.label}. Source:
        Open-Meteo's historical weather archive, 65°F base — nearest weather grid point, not your exact address;
        a sanity check, not a full weather-normalization model.{" "}
        <button
          type="button"
          onClick={() => {
            clearStoredLocation();
            setLocation(null);
            setWeather(null);
          }}
          style={{ background: "none", border: "none", color: "var(--series-1)", cursor: "pointer", padding: 0, font: "inherit" }}
        >
          Change location
        </button>
      </p>
      {fetching && <p>Fetching weather data...</p>}
      {error && <p className="verification-error">{error}</p>}
      {weather && (
        <div className="headline-grid">
          <div className="card">
            <div className="headline-label">Heating degree days, previous period</div>
            <div className="headline-value num">{weather.prevHdd.toFixed(0)}</div>
          </div>
          <div className="card">
            <div className="headline-label">Heating degree days, latest period</div>
            <div className="headline-value num">{weather.latestHdd.toFixed(0)}</div>
          </div>
          <div className="card">
            <div className="headline-label">Change</div>
            <div className="headline-value num">
              {hddChange !== null ? `${hddChange > 0 ? "+" : ""}${hddChange.toFixed(0)}` : "—"}
              {hddPct !== null ? ` (${hddPct > 0 ? "+" : ""}${hddPct.toFixed(0)}%)` : ""}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
