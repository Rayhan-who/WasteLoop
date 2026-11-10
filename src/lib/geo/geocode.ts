import "server-only";
import { serverEnv } from "@/lib/env.server";
import { isInBangladesh, type LatLng } from "./bounds";

/**
 * Server-side wrapper around OpenStreetMap Nominatim (free, no API key).
 *
 * Nominatim's usage policy: at most 1 request per second, an identifying
 * User-Agent with contact details (NOMINATIM_USER_AGENT), and caching.
 * Calls are serialised per server instance with a minimum gap, and results
 * are cached in memory. Failures return null / [] — geocoding is a
 * convenience, so the wizard still works with the map pin alone (§4.3).
 */

const BASE = "https://nominatim.openstreetmap.org";
const MIN_GAP_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

type CacheEntry<T> = { at: number; value: T };
const cache = new Map<string, CacheEntry<unknown>>();
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;

function cached<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function remember<T>(key: string, value: T): T {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Run `fn` after the previous Nominatim call, at least MIN_GAP_MS apart. */
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => undefined);
  return run;
}

async function nominatim<T>(path: string, params: Record<string, string>, locale: string): Promise<T | null> {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries({ format: "jsonv2", "accept-language": `${locale},en`, ...params })) url.searchParams.set(k, v);
  try {
    const res = await throttled(() =>
      fetch(url, {
        headers: { "User-Agent": serverEnv.nominatimUserAgent, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        cache: "no-store",
      }),
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type NominatimAddress = Partial<
  Record<"neighbourhood" | "suburb" | "quarter" | "city_district" | "town" | "village" | "city" | "county" | "state_district" | "road", string>
>;

/** "Dhanmondi, Dhaka" style label from a Nominatim address: area + city, never a street. */
export function areaLabelFrom(address: NominatimAddress | undefined): string | null {
  if (!address) return null;
  const area = address.suburb ?? address.neighbourhood ?? address.quarter ?? address.city_district ?? address.village ?? address.town;
  const city = address.city ?? address.town ?? address.county ?? address.state_district;
  const parts = [area, city].filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i);
  return parts.length > 0 ? parts.join(", ").slice(0, 120) : null;
}

export type GeocodeResult = LatLng & { label: string; area: string | null };

/** Address search, restricted to Bangladesh. */
export async function geocode(query: string, locale: string): Promise<GeocodeResult[]> {
  const q = query.trim().slice(0, 200);
  if (q.length < 3) return [];
  const key = `s:${locale}:${q.toLowerCase()}`;
  const hit = cached<GeocodeResult[]>(key);
  if (hit) return hit;

  const rows = await nominatim<{ lat: string; lon: string; display_name: string; address?: NominatimAddress }[]>(
    "/search",
    { q, countrycodes: "bd", limit: "5", addressdetails: "1" },
    locale,
  );
  if (!rows) return [];
  const results = rows
    .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon), label: r.display_name, area: areaLabelFrom(r.address) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && isInBangladesh(r));
  return remember(key, results);
}

/** The area label for a point (used to pre-fill the public "pickup area"). */
export async function reverseGeocode(point: LatLng, locale: string): Promise<string | null> {
  if (!isInBangladesh(point)) return null;
  // Round the key to ~100 m so nearby pins share a cache entry.
  const key = `r:${locale}:${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
  const hit = cached<string | null>(key);
  if (hit !== undefined) return hit;

  const row = await nominatim<{ address?: NominatimAddress }>(
    "/reverse",
    { lat: String(point.lat), lon: String(point.lng), zoom: "16", addressdetails: "1" },
    locale,
  );
  return remember(key, areaLabelFrom(row?.address));
}
