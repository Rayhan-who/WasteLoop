"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import type { ListingStatus, QuantityUnit, WasteType } from "@/lib/domain";
import { InvalidTransitionError, canDeleteListing, canEditListing, nextListingStatus, type ListingAction } from "@/lib/exchange/transitions";
import { toEwkt } from "@/lib/geo/bounds";
import { geocode, reverseGeocode, type GeocodeResult } from "@/lib/geo/geocode";
import { estimateQuantity, screenContent, suggestCategory, suggestPrice } from "@/lib/ml";
import type { MLPrediction } from "@/lib/ml/types";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { fieldErrors } from "@/lib/validation/common";
import { listingSchema, type ListingData, type ListingInput } from "@/lib/validation/listing";
import { fail, type ActionFailure, type ActionResult } from "./result";

const PHOTO_BUCKET = "listing-photos";

function revalidateListing(id?: string) {
  revalidatePath("/my-listings");
  revalidatePath("/marketplace");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/listings/${id}`);
}

/** Photos must be in the uploader's own folder (Storage RLS enforces the upload; this guards the reference). */
function ownPhotoPaths(userId: string, paths: string[]): string[] | null {
  const unique = [...new Set(paths)];
  return unique.every((p) => p.startsWith(`${userId}/`) && !p.includes("..")) ? unique : null;
}

function listingRow(v: ListingData) {
  return {
    waste_type: v.wasteType,
    title: v.title,
    description: v.description ?? "",
    quantity_value: v.quantityValue,
    quantity_unit: v.quantityUnit,
    offer_type: v.offerType,
    price_amount: v.priceAmount,
    available_from: new Date(v.availableFrom).toISOString(),
    available_until: new Date(v.availableUntil).toISOString(),
    pickup_point: toEwkt({ lat: v.pickupLat, lng: v.pickupLng }),
    pickup_address_exact: v.pickupAddressExact,
    pickup_area_label: v.pickupAreaLabel,
  };
}

type ProviderContext =
  | { ok: false; failure: ActionFailure }
  | { ok: true; user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; supabase: Awaited<ReturnType<typeof createClient>> };

async function requireProvider(): Promise<ProviderContext> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, failure: fail("sessionExpired") };
  const supabase = await createClient();
  const { data: isProvider } = await supabase.rpc("has_role", { p_role: "provider" });
  if (!isProvider) return { ok: false, failure: fail("notProvider") };
  return { ok: true, user, supabase };
}

/**
 * FR-11.5 hook (deferred ML): screen content before it goes live. Today this
 * returns null and nothing happens — the fallback is manual user reports.
 */
async function screen(v: ListingData, photoPaths: string[]) {
  const result = await screenContent({ title: v.title, description: v.description ?? "", photoPaths });
  if (result?.value.flag) console.warn("content screening flagged listing", result.value.reasons);
}

/** FR-3.1 create a listing (draft, or published straight away). */
export async function createListingAction(input: ListingInput, publish: boolean): Promise<ActionResult<{ id: string }>> {
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const ctx = await requireProvider();
  if (!ctx.ok) return ctx.failure;
  const { user, supabase } = ctx;

  const photos = ownPhotoPaths(user.id, parsed.data.photoPaths);
  if (!photos) return fail("validation", { photoPaths: "invalid" });
  await screen(parsed.data, photos);

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({ ...listingRow(parsed.data), provider_id: user.id, status: publish ? "available" : "draft" })
    .select("id")
    .single();
  if (error || !listing) {
    console.error("createListingAction", error);
    return fail(error?.code === "42501" ? "notProvider" : "generic");
  }

  if (photos.length > 0) {
    const { error: photoError } = await supabase
      .from("listing_photos")
      .insert(photos.map((storage_path, sort_order) => ({ listing_id: listing.id, storage_path, sort_order })));
    if (photoError) {
      console.error("createListingAction photos", photoError);
      await supabase.from("listings").delete().eq("id", listing.id);
      return fail("uploadFailed");
    }
  }

  revalidateListing(listing.id);
  return { ok: true, data: { id: listing.id } };
}

/** FR-3.2 edit a listing. `publish` also makes a draft or expired listing available. */
export async function updateListingAction(id: string, input: ListingInput, publish: boolean): Promise<ActionResult<{ id: string }>> {
  const parsed = listingSchema.safeParse(input);
  if (!parsed.success) return fail("validation", fieldErrors(parsed.error));
  const ctx = await requireProvider();
  if (!ctx.ok) return ctx.failure;
  const { user, supabase } = ctx;

  const { data: current } = await supabase.from("listings").select("id, status, provider_id").eq("id", id).maybeSingle();
  if (!current || current.provider_id !== user.id) return fail("notFound");
  const status = current.status as ListingStatus;
  if (!canEditListing(status)) return fail("listingLocked");

  const photos = ownPhotoPaths(user.id, parsed.data.photoPaths);
  if (!photos) return fail("validation", { photoPaths: "invalid" });
  await screen(parsed.data, photos);

  let nextStatus = status;
  if (publish && (status === "draft" || status === "expired")) {
    try {
      nextStatus = nextListingStatus("publish", {
        status,
        availableFrom: new Date(parsed.data.availableFrom),
        availableUntil: new Date(parsed.data.availableUntil),
      });
    } catch (e) {
      if (e instanceof InvalidTransitionError) return fail(e.reason === "window_passed" ? "windowPassed" : "listingLocked");
      throw e;
    }
  }

  const { error } = await supabase.from("listings").update({ ...listingRow(parsed.data), status: nextStatus }).eq("id", id);
  if (error) {
    console.error("updateListingAction", error);
    return fail("generic");
  }

  // Replace the photo set: remove dropped photos (rows and files), then rewrite the order.
  const { data: existing } = await supabase.from("listing_photos").select("storage_path").eq("listing_id", id);
  const removed = (existing ?? []).map((p) => p.storage_path).filter((p) => !photos.includes(p));
  await supabase.from("listing_photos").delete().eq("listing_id", id);
  if (photos.length > 0) {
    const { error: photoError } = await supabase
      .from("listing_photos")
      .insert(photos.map((storage_path, sort_order) => ({ listing_id: id, storage_path, sort_order })));
    if (photoError) {
      console.error("updateListingAction photos", photoError);
      return fail("uploadFailed");
    }
  }
  if (removed.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(removed);

  revalidateListing(id);
  return { ok: true, data: { id } };
}

/** FR-3.3 publish, pause or resume, via the guarded state machine. */
export async function setListingStatusAction(id: string, action: ListingAction): Promise<ActionResult> {
  const ctx = await requireProvider();
  if (!ctx.ok) return ctx.failure;
  const { user, supabase } = ctx;

  const { data: current } = await supabase
    .from("listings")
    .select("status, provider_id, available_from, available_until")
    .eq("id", id)
    .maybeSingle();
  if (!current || current.provider_id !== user.id) return fail("notFound");

  let next: ListingStatus;
  try {
    next = nextListingStatus(action, {
      status: current.status as ListingStatus,
      availableFrom: new Date(current.available_from),
      availableUntil: new Date(current.available_until),
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError) return fail(e.reason === "window_passed" ? "windowPassed" : "listingLocked");
    throw e;
  }

  const { error } = await supabase.from("listings").update({ status: next }).eq("id", id);
  if (error) {
    console.error("setListingStatusAction", error);
    return fail("generic");
  }
  revalidateListing(id);
  return { ok: true };
}

/** FR-3.3 delete a listing that has never received a request (otherwise: pause it). */
export async function deleteListingAction(id: string): Promise<ActionResult> {
  const ctx = await requireProvider();
  if (!ctx.ok) return ctx.failure;
  const { user, supabase } = ctx;

  const { data: current } = await supabase.from("listings").select("status, provider_id").eq("id", id).maybeSingle();
  if (!current || current.provider_id !== user.id) return fail("notFound");
  if (!canDeleteListing(current.status as ListingStatus)) return fail("listingLocked");

  const { count } = await supabase.from("requests").select("id", { count: "exact", head: true }).eq("listing_id", id);
  if ((count ?? 0) > 0) return fail("hasRequests");

  const { data: photos } = await supabase.from("listing_photos").select("storage_path").eq("listing_id", id);
  const { error } = await supabase.from("listings").delete().eq("id", id);
  if (error) {
    console.error("deleteListingAction", error);
    return fail(error.code === "23503" ? "hasRequests" : "generic");
  }
  const paths = (photos ?? []).map((p) => p.storage_path);
  if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);

  revalidateListing();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Wizard helpers
// ---------------------------------------------------------------------------

export type Suggestion<T> = Pick<MLPrediction<T>, "value" | "confidence" | "explanation"> | null;

/** FR-3.6 / FR-3.7 (deferred ML): advisory category and quantity from the first photo. Null today. */
export async function getListingSuggestionsAction(
  photoPath: string,
  wasteType: WasteType | null,
): Promise<{ category: Suggestion<WasteType>; quantity: Suggestion<{ value: number; unit: QuantityUnit }> }> {
  const user = await getCurrentUser();
  if (!user || !photoPath.startsWith(`${user.id}/`)) return { category: null, quantity: null };
  const supabase = await createClient();
  const url = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(photoPath).data.publicUrl;
  const [category, quantity] = await Promise.all([suggestCategory(url), estimateQuantity(url, wasteType)]);
  const pick = <T,>(p: MLPrediction<T> | null): Suggestion<T> =>
    p ? { value: p.value, confidence: p.confidence, explanation: p.explanation } : null;
  return { category: pick(category), quantity: pick(quantity) };
}

export type PriceHint =
  | { source: "model"; total: number; explanation: string }
  | { source: "history"; perUnit: number; samples: number }
  | null;

/** FR-7.4 (deferred ML) with its rule-based fallback: the recent median price per unit (≥ 5 sales). */
export async function getPriceSuggestionAction(params: { wasteType: WasteType; unit: QuantityUnit; quantity: number }): Promise<PriceHint> {
  const user = await getCurrentUser();
  if (!user) return null;
  const model = await suggestPrice(params);
  if (model) return { source: "model", total: model.value, explanation: model.explanation };

  const supabase = await createClient();
  const { data } = await supabase.rpc("price_reference", { p_waste_type: params.wasteType, p_unit: params.unit });
  const row = data?.[0];
  if (!row || row.median_per_unit === null || row.samples === null) return null;
  return { source: "history", perUnit: Number(row.median_per_unit), samples: row.samples };
}

/** Address search for the pickup location (Nominatim, server-side and rate-limited). */
export async function geocodeAction(query: string): Promise<GeocodeResult[]> {
  if (!(await getCurrentUser())) return [];
  return geocode(query, await getLocale());
}

/** Area label for a map point, to pre-fill the public "pickup area". */
export async function reverseGeocodeAction(lat: number, lng: number): Promise<string | null> {
  if (!(await getCurrentUser())) return null;
  return reverseGeocode({ lat, lng }, await getLocale());
}
