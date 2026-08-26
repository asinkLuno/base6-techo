import { useEffect, useState } from "react";

export type City = {
  id: number; name: string; latitude: number; longitude: number; timezone: string;
  country?: string; admin1?: string;
};

export function CityField({ value, onChange }: {
  value: string | null; onChange: (city: City | null, label: string) => void;
}) {
  const [query, setQuery] = useState(value ?? "");
  const [results, setResults] = useState<City[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => setQuery(value ?? ""), [value]);
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); setMessage(""); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMessage("Searching…");
      try {
        const params = new URLSearchParams({ name: query.trim(), count: "8", language: "zh", format: "json" });
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const body = await response.json() as { results?: City[] };
        setResults(body.results ?? []);
        setMessage(body.results?.length ? "" : "No city found");
      } catch {
        if (!controller.signal.aborted) setMessage("City search needs a network connection");
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return <div className="field city-field"><span>City</span><input value={query} placeholder="Search city" onChange={(event) => { setQuery(event.target.value); onChange(null, event.target.value); }} />
    {results.length > 0 ? <div className="city-results">{results.map((city) => {
      const label = [city.name, city.admin1, city.country].filter(Boolean).join(" · ");
      return <button type="button" key={city.id} onClick={() => { setQuery(label); setResults([]); setMessage(""); onChange(city, label); }}>{label}<small>{city.timezone}</small></button>;
    })}</div> : null}
    {message ? <small className="field-note">{message}</small> : null}
  </div>;
}
