/** Geography shared by the browser and the server. */

export type LatLng = { lat: number; lng: number };

/** Default map centre: central Dhaka. */
export const DHAKA_CENTRE: LatLng = { lat: 23.7808, lng: 90.4074 };

/** Generous bounding box around Bangladesh; points outside it are rejected. */
export const BANGLADESH_BOUNDS = { minLat: 20.4, maxLat: 26.8, minLng: 87.9, maxLng: 92.8 } as const;

export function isInBangladesh({ lat, lng }: LatLng): boolean {
  const b = BANGLADESH_BOUNDS;
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}

/** PostGIS EWKT for a point, as PostgREST accepts for geography columns. Longitude first. */
export function toEwkt({ lat, lng }: LatLng): string {
  return `SRID=4326;POINT(${lng.toFixed(6)} ${lat.toFixed(6)})`;
}
