import type { ListingStatus } from "@/lib/domain";

/**
 * The exchange state machine (Build Prompt §4), as explicit guarded
 * transitions. Invalid transitions THROW; they never silently pass.
 *
 * Milestone 4 covers the listing transitions a provider performs. The
 * request and pickup machines, and the listing transitions they drive
 * (available → reserved → collected), are added in milestone 6.
 *
 *   draft ──publish──▶ available ──pause──▶ paused
 *                        ▲   │                │
 *                        │   └──(cron)──▶ expired
 *                        └────resume──────────┘
 *   expired ──republish (new window)──▶ available
 */

export type TransitionFailure = "not_allowed" | "window_passed" | "window_invalid";

export class InvalidTransitionError extends Error {
  readonly machine: "listing" | "request" | "pickup";
  readonly from: string;
  readonly action: string;
  readonly reason: TransitionFailure;

  constructor(machine: "listing" | "request" | "pickup", from: string, action: string, reason: TransitionFailure) {
    super(`Invalid ${machine} transition: ${action} from ${from} (${reason})`);
    this.name = "InvalidTransitionError";
    this.machine = machine;
    this.from = from;
    this.action = action;
    this.reason = reason;
  }
}

/** Provider-initiated listing actions. */
export type ListingAction = "publish" | "pause" | "resume";

const LISTING_ACTIONS: Record<ListingAction, { from: readonly ListingStatus[]; to: ListingStatus }> = {
  publish: { from: ["draft", "expired"], to: "available" },
  pause: { from: ["available"], to: "paused" },
  resume: { from: ["paused"], to: "available" },
};

/** Statuses in which the provider may edit the listing's details. */
export const EDITABLE_LISTING_STATUSES: readonly ListingStatus[] = ["draft", "available", "paused", "expired"];

/** Statuses in which the provider may delete the listing (the DB also refuses if it has requests). */
export const DELETABLE_LISTING_STATUSES: readonly ListingStatus[] = ["draft", "available", "paused", "expired"];

export type ListingContext = {
  status: ListingStatus;
  availableFrom: Date;
  availableUntil: Date;
  now?: Date;
};

/**
 * Validate a provider action and return the new status, or throw.
 * Making a listing available requires an availability window that is valid
 * and not already over.
 */
export function nextListingStatus(action: ListingAction, ctx: ListingContext): ListingStatus {
  const rule = LISTING_ACTIONS[action];
  if (!rule.from.includes(ctx.status)) {
    throw new InvalidTransitionError("listing", ctx.status, action, "not_allowed");
  }
  if (rule.to === "available") {
    assertWindow(ctx.availableFrom, ctx.availableUntil, ctx.now ?? new Date(), action, ctx.status);
  }
  return rule.to;
}

/** The actions available from a status, for rendering buttons. */
export function listingActionsFrom(status: ListingStatus): ListingAction[] {
  return (Object.keys(LISTING_ACTIONS) as ListingAction[]).filter((a) => LISTING_ACTIONS[a].from.includes(status));
}

export function canEditListing(status: ListingStatus): boolean {
  return EDITABLE_LISTING_STATUSES.includes(status);
}

export function canDeleteListing(status: ListingStatus): boolean {
  return DELETABLE_LISTING_STATUSES.includes(status);
}

function assertWindow(from: Date, until: Date, now: Date, action: string, status: string): void {
  if (!(until.getTime() > from.getTime())) {
    throw new InvalidTransitionError("listing", status, action, "window_invalid");
  }
  if (until.getTime() <= now.getTime()) {
    throw new InvalidTransitionError("listing", status, action, "window_passed");
  }
}
