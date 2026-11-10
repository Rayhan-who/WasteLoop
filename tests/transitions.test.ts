import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidTransitionError,
  canDeleteListing,
  canEditListing,
  listingActionsFrom,
  nextListingStatus,
} from "@/lib/exchange/transitions";
import type { ListingStatus } from "@/lib/domain";

const now = new Date("2026-11-10T12:00:00+06:00");
const hours = (h: number) => new Date(now.getTime() + h * 3_600_000);
const ctx = (status: ListingStatus, from = hours(-1), until = hours(5)) => ({ status, availableFrom: from, availableUntil: until, now });

const throwsWith = (fn: () => unknown, reason: InvalidTransitionError["reason"]) =>
  assert.throws(fn, (e: unknown) => e instanceof InvalidTransitionError && e.reason === reason);

describe("listing transitions — allowed", () => {
  it("draft → available (publish)", () => assert.equal(nextListingStatus("publish", ctx("draft")), "available"));
  it("expired → available (republish with a new window)", () => assert.equal(nextListingStatus("publish", ctx("expired")), "available"));
  it("available → paused (pause)", () => assert.equal(nextListingStatus("pause", ctx("available")), "paused"));
  it("paused → available (resume)", () => assert.equal(nextListingStatus("resume", ctx("paused")), "available"));
});

describe("listing transitions — guards throw", () => {
  for (const status of ["available", "reserved", "collected", "paused", "removed"] as const) {
    it(`cannot publish from ${status}`, () => throwsWith(() => nextListingStatus("publish", ctx(status)), "not_allowed"));
  }
  for (const status of ["draft", "reserved", "collected", "paused", "expired", "removed"] as const) {
    it(`cannot pause from ${status}`, () => throwsWith(() => nextListingStatus("pause", ctx(status)), "not_allowed"));
  }
  for (const status of ["draft", "available", "reserved", "collected", "expired", "removed"] as const) {
    it(`cannot resume from ${status}`, () => throwsWith(() => nextListingStatus("resume", ctx(status)), "not_allowed"));
  }

  it("cannot publish when the window has already ended (FR-3.5)", () =>
    throwsWith(() => nextListingStatus("publish", ctx("draft", hours(-10), hours(-1))), "window_passed"));
  it("cannot resume when the window has already ended", () =>
    throwsWith(() => nextListingStatus("resume", ctx("paused", hours(-10), hours(-1))), "window_passed"));
  it("rejects a window that ends before it starts", () =>
    throwsWith(() => nextListingStatus("publish", ctx("draft", hours(5), hours(2))), "window_invalid"));
  it("pausing does not need a valid window", () =>
    assert.equal(nextListingStatus("pause", ctx("available", hours(-10), hours(-1))), "paused"));
});

describe("listing permissions", () => {
  it("lists the actions available from each status", () => {
    assert.deepEqual(listingActionsFrom("draft"), ["publish"]);
    assert.deepEqual(listingActionsFrom("available"), ["pause"]);
    assert.deepEqual(listingActionsFrom("paused"), ["resume"]);
    assert.deepEqual(listingActionsFrom("reserved"), []);
  });

  it("reserved, collected and removed listings are locked", () => {
    for (const s of ["reserved", "collected", "removed"] as const) {
      assert.equal(canEditListing(s), false);
      assert.equal(canDeleteListing(s), false);
    }
    for (const s of ["draft", "available", "paused", "expired"] as const) {
      assert.equal(canEditListing(s), true);
      assert.equal(canDeleteListing(s), true);
    }
  });
});
