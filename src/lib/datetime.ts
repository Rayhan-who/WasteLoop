/**
 * Helpers for <input type="datetime-local"> values, which carry no time zone.
 *
 * Decision (README → Decisions): WasteLoop serves Bangladesh, which has a
 * single time zone with no daylight saving (Asia/Dhaka, always UTC+06:00).
 * Every datetime-local value is therefore read and written as Dhaka time, on
 * the server and in the browser alike. That keeps server-rendered and
 * browser-rendered values identical and avoids a 6-hour shift on servers
 * running in UTC.
 */

export const DHAKA_OFFSET = "+06:00";
const OFFSET_MS = 6 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** A Date shifted so its UTC fields read as Dhaka wall-clock time. */
function dhakaWall(d: Date): Date {
  return new Date(d.getTime() + OFFSET_MS);
}

/** Date → "YYYY-MM-DDTHH:mm" in Dhaka time. */
export function toLocalInputValue(d: Date): string {
  const w = dhakaWall(d);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

/** "YYYY-MM-DDTHH:mm" (Dhaka time) → ISO string in UTC. Accepts an ISO string unchanged. */
export function localInputToIso(value: string): string {
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const withSeconds = /T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  return new Date(hasZone ? value : `${withSeconds}${DHAKA_OFFSET}`).toISOString();
}

/** Round up to the next quarter hour, so presets look tidy. */
export function nextQuarterHour(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(Math.ceil((d.getUTCMinutes() + 1) / 15) * 15);
  return d;
}

export type WindowPreset = "tonight" | "24h" | "3d" | "7d";

/** Availability presets for the wizard: from now until… ("tonight" = 10 pm Dhaka time). */
export function presetWindow(preset: WindowPreset, now: Date = new Date()): { from: Date; until: Date } {
  const from = nextQuarterHour(now);
  const hours = (h: number) => new Date(from.getTime() + h * 3_600_000);
  switch (preset) {
    case "tonight": {
      const wall = dhakaWall(from);
      wall.setUTCHours(22, 0, 0, 0);
      let until = new Date(wall.getTime() - OFFSET_MS);
      if (until.getTime() <= from.getTime() + 3_600_000) until = new Date(until.getTime() + 24 * 3_600_000);
      return { from, until };
    }
    case "24h":
      return { from, until: hours(24) };
    case "3d":
      return { from, until: hours(72) };
    case "7d":
      return { from, until: hours(168) };
  }
}
