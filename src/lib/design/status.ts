import type { ListingStatus } from "@/lib/domain";

/**
 * Listing status colours (Build Prompt §7.5, rule 6):
 * available → primary, reserved → pending (amber), collected → success,
 * paused/expired → grey-500, removed → danger. Always paired with a text label.
 */
export const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  draft: "border-wl-grey-200 bg-wl-surface text-wl-grey-500",
  available: "border-transparent bg-wl-primary-tint text-wl-primary",
  reserved: "border-transparent bg-wl-pending-tint text-wl-pending-text",
  collected: "border-transparent bg-wl-primary-tint text-wl-success",
  paused: "border-wl-grey-200 bg-wl-paper text-wl-grey-500",
  expired: "border-wl-grey-200 bg-wl-paper text-wl-grey-500",
  removed: "border-wl-danger bg-wl-surface text-wl-danger",
};
