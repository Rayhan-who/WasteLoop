import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { localInputToIso, nextQuarterHour, presetWindow, toLocalInputValue } from "@/lib/datetime";

describe("Dhaka datetime-local helpers", () => {
  it("formats a UTC instant as Dhaka wall-clock time (UTC+6)", () => {
    assert.equal(toLocalInputValue(new Date("2026-11-10T08:30:00Z")), "2026-11-10T14:30");
    assert.equal(toLocalInputValue(new Date("2026-11-10T20:15:00Z")), "2026-11-11T02:15");
  });

  it("reads a datetime-local value as Dhaka time", () => {
    assert.equal(localInputToIso("2026-11-10T14:30"), "2026-11-10T08:30:00.000Z");
  });

  it("round-trips", () => {
    const iso = "2026-12-31T23:45:00.000Z";
    assert.equal(localInputToIso(toLocalInputValue(new Date(iso))), iso);
  });

  it("passes values that already carry a zone through unchanged", () => {
    assert.equal(localInputToIso("2026-11-10T08:30:00.000Z"), "2026-11-10T08:30:00.000Z");
    assert.equal(localInputToIso("2026-11-10T14:30:00+06:00"), "2026-11-10T08:30:00.000Z");
  });

  it("rounds up to the next quarter hour", () => {
    assert.equal(nextQuarterHour(new Date("2026-11-10T08:07:30Z")).toISOString(), "2026-11-10T08:15:00.000Z");
    assert.equal(nextQuarterHour(new Date("2026-11-10T08:15:00Z")).toISOString(), "2026-11-10T08:30:00.000Z");
  });
});

describe("availability presets", () => {
  const now = new Date("2026-11-10T06:00:00Z"); // 12:00 in Dhaka

  it("'tonight' ends at 10 pm Dhaka time", () => {
    assert.equal(toLocalInputValue(presetWindow("tonight", now).until), "2026-11-10T22:00");
  });

  it("'tonight' late in the evening rolls over to the next night", () => {
    const late = new Date("2026-11-10T15:30:00Z"); // 21:30 in Dhaka
    assert.equal(toLocalInputValue(presetWindow("tonight", late).until), "2026-11-11T22:00");
  });

  it("24h / 3d / 7d windows have the right length", () => {
    for (const [p, h] of [["24h", 24], ["3d", 72], ["7d", 168]] as const) {
      const w = presetWindow(p, now);
      assert.equal((w.until.getTime() - w.from.getTime()) / 3_600_000, h);
    }
  });
});
