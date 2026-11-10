import "server-only";
import type { QuantityUnit, WasteType } from "@/lib/domain";
import { mlFlags } from "./flags";
import type { MaybePrediction } from "./types";

/**
 * Deferred ML features (Phase 2) — the seam.
 *
 * One function per deferred requirement. Each is already called from its real
 * code path, and today each returns null, so the caller uses its rule-based
 * fallback (documented next to each function and in the README). When a
 * model ships, implement the body behind its flag; callers do not change.
 */

/**
 * FR-3.6 — suggest the waste category from a listing photo.
 * Called by: the listing wizard after the first photo is uploaded
 * (getListingSuggestionsAction).
 * Fallback: the provider picks the category manually (always available; a
 * suggestion would only pre-select it, overridably).
 */
export async function suggestCategory(photoUrl: string): MaybePrediction<WasteType> {
  if (!mlFlags.suggestCategory() || !photoUrl) return null;
  return null;
}

/**
 * FR-3.7 — estimate quantity / resource value from a photo.
 * Called by: the listing wizard after a photo upload.
 * Fallback: the provider enters the quantity.
 */
export async function estimateQuantity(
  photoUrl: string,
  wasteType: WasteType | null,
): MaybePrediction<{ value: number; unit: QuantityUnit }> {
  if (!mlFlags.estimateQuantity() || !photoUrl) return null;
  void wasteType;
  return null;
}

/**
 * FR-3.8 — freshness indicator for edible food.
 * Called by: the listing detail page.
 * Fallback: the availability window and time remaining are shown instead.
 */
export async function freshnessIndicator(listing: {
  wasteType: WasteType;
  availableFrom: string;
  availableUntil: string;
  photoUrl: string | null;
}): MaybePrediction<"fresh" | "use_soon" | "check_carefully"> {
  if (!mlFlags.freshness() || listing.wasteType !== "edible_food") return null;
  return null;
}

/**
 * FR-4.5 — personalised ordering of marketplace listings.
 * Called by: getMarketplacePage.
 * Fallback: distance (milestone 5), then freshness of posting (newest first).
 */
export async function recommendListings(userId: string | null, listingIds: string[]): MaybePrediction<string[]> {
  if (!mlFlags.recommendations() || !userId || listingIds.length === 0) return null;
  return null;
}

/**
 * FR-4.6 — supply / demand forecast for a provider's area and stream.
 * Called by: the provider dashboard.
 * Fallback: not shown.
 */
export async function forecastSupplyDemand(params: { userId: string; area: string | null }): MaybePrediction<{
  stream: WasteType;
  trend: "rising" | "steady" | "falling";
}> {
  if (!mlFlags.forecast() || !params.userId) return null;
  return null;
}

/**
 * FR-6.4 — group nearby pickups into efficient routes for a taker.
 * Called by: the requests overview (milestone 6).
 * Fallback: left out of the UI entirely.
 */
export async function clusterRoutes(pickupIds: string[]): MaybePrediction<string[][]> {
  if (!mlFlags.routeClustering() || pickupIds.length < 2) return null;
  return null;
}

/**
 * FR-6.5 — likelihood that an accepted exchange completes.
 * Called by: the exchange workspace (milestone 6).
 * Fallback: not shown.
 */
export async function completionLikelihood(requestId: string): MaybePrediction<number> {
  if (!mlFlags.completionLikelihood() || !requestId) return null;
  return null;
}

/**
 * FR-7.4 — fair price suggestion for a for-sale listing.
 * Called by: the listing wizard, step 3 (getPriceSuggestionAction).
 * Fallback: the recent median price for the same stream and unit from paid
 * transactions, shown only with at least 5 samples (price_reference() SQL).
 */
export async function suggestPrice(params: { wasteType: WasteType; unit: QuantityUnit; quantity: number }): MaybePrediction<number> {
  if (!mlFlags.priceSuggestion() || params.quantity <= 0) return null;
  return null;
}

/**
 * FR-11.4 — flag unusual activity for moderators.
 * Called by: the admin dashboard (milestone 11).
 * Fallback: admins review user reports.
 */
export async function detectAnomalies(params: { since: string }): MaybePrediction<{ targetType: "listing" | "user"; targetId: string }[]> {
  if (!mlFlags.anomalyDetection() || !params.since) return null;
  return null;
}

/**
 * FR-11.5 — screen listing text and photos before publishing.
 * Called by: createListingAction / updateListingAction.
 * Fallback: manual user reports only; nothing is blocked automatically.
 * A positive result only sets flagged_for_review — it never rejects a listing.
 */
export async function screenContent(content: { title: string; description: string; photoPaths: string[] }): MaybePrediction<{
  flag: boolean;
  reasons: string[];
}> {
  if (!mlFlags.contentScreening() || !content.title) return null;
  return null;
}
