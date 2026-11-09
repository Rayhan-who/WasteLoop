import "server-only";
import { LISTING_OFFER_TYPES, WASTE_TYPES, type ListingOfferType, type WasteType } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { Views } from "@/lib/supabase/database.types";

/**
 * Marketplace reads. Every query goes through listings_public (no exact
 * address, coarse point) and filters, sorts and paginates in SQL (§4.1).
 */
export const PAGE_SIZE = 20;

export type MarketplaceFilters = {
  type?: WasteType;
  offer?: ListingOfferType;
  page: number;
};

export const LISTING_CARD_COLUMNS =
  "id, title, waste_type, quantity_value, quantity_unit, offer_type, price_amount, currency, available_until, pickup_area_label, status, created_at, provider_display_name, provider_org_name, provider_verified, cover_photo_path" as const;

export type ListingCardData = Pick<
  Views<"listings_public">,
  | "id"
  | "title"
  | "waste_type"
  | "quantity_value"
  | "quantity_unit"
  | "offer_type"
  | "price_amount"
  | "currency"
  | "available_until"
  | "pickup_area_label"
  | "status"
  | "created_at"
  | "provider_display_name"
  | "provider_org_name"
  | "provider_verified"
  | "cover_photo_path"
>;

/** Parse untrusted search params into filters. */
export function parseMarketplaceFilters(params: Record<string, string | string[] | undefined>): MarketplaceFilters {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const type = one(params.type);
  const offer = one(params.offer);
  const page = Number.parseInt(one(params.page) ?? "1", 10);
  return {
    type: (WASTE_TYPES as readonly string[]).includes(type ?? "") ? (type as WasteType) : undefined,
    offer: (LISTING_OFFER_TYPES as readonly string[]).includes(offer ?? "") ? (offer as ListingOfferType) : undefined,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}

/**
 * One page of listings, newest first.
 * ML fallback (FR-4.5 personalised recommendations, deferred): until the
 * saved location and distance sort arrive in milestone 5, order by freshness.
 */
export async function getMarketplacePage(filters: MarketplaceFilters) {
  const supabase = await createClient();
  const from = (filters.page - 1) * PAGE_SIZE;
  let query = supabase
    .from("listings_public")
    .select(LISTING_CARD_COLUMNS, { count: "exact" })
    .order("status", { ascending: true }) // 'available' sorts before 'reserved'
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (filters.type) query = query.eq("waste_type", filters.type);
  if (filters.offer) query = query.eq("offer_type", filters.offer);

  const { data, count, error } = await query;
  if (error) throw error;
  return { listings: (data ?? []) as ListingCardData[], total: count ?? 0 };
}

/** Listing count per stream, for the category tabs. */
export async function getCategoryCounts(offer?: ListingOfferType): Promise<Record<WasteType | "all", number>> {
  const supabase = await createClient();
  const countFor = async (type?: WasteType) => {
    let q = supabase.from("listings_public").select("id", { count: "exact", head: true });
    if (type) q = q.eq("waste_type", type);
    if (offer) q = q.eq("offer_type", offer);
    const { count } = await q;
    return count ?? 0;
  };
  const [all, ...perType] = await Promise.all([countFor(), ...WASTE_TYPES.map((t) => countFor(t))]);
  return Object.fromEntries([["all", all], ...WASTE_TYPES.map((t, i) => [t, perType[i]])]) as Record<WasteType | "all", number>;
}

/** Latest public listings, for the landing page preview. */
export async function getLatestListings(limit: number): Promise<ListingCardData[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings_public")
    .select(LISTING_CARD_COLUMNS)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ListingCardData[];
}

/** Public URL of a listing photo in the public listing-photos bucket. */
export async function listingPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  return supabase.storage.from("listing-photos").getPublicUrl(path).data.publicUrl;
}
