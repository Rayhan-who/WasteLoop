import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageBanner } from "@/components/app-shell/page-banner";
import { ListingWizard } from "@/components/listings/listing-wizard";
import { Button } from "@/components/ui/button";
import { toLocalInputValue } from "@/lib/datetime";
import type { ListingOfferType, ListingStatus, QuantityUnit, WasteType } from "@/lib/domain";
import { canEditListing } from "@/lib/exchange/transitions";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

type Params = { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("listingForm"))("editTitle") };
}

/** FR-3.2 edit a listing — owner only, and only while it is not reserved, collected or removed. */
export default async function EditListingPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, profile, supabase] = await Promise.all([getTranslations("listingForm"), getCurrentProfile(), createClient()]);
  if (!profile) redirect(LOGIN_PATH);

  // The owner gets the exact address and point from get_listing_detail().
  const [{ data }, { data: photos }] = await Promise.all([
    supabase.rpc("get_listing_detail", { p_listing_id: id }),
    supabase.from("listing_photos").select("storage_path").eq("listing_id", id).order("sort_order"),
  ]);
  const listing = data?.[0];
  if (!listing || listing.viewer_relation !== "owner") notFound();

  const status = listing.status as ListingStatus;

  return (
    <>
      <PageBanner eyebrow={t("editEyebrow")} title={listing.title ?? t("editTitle")} />
      <div className="px-4 py-6 md:px-8">
        {canEditListing(status) ? (
          <ListingWizard
            userId={profile.id}
            mode={{ kind: "edit", listingId: id, status: status as "draft" | "available" | "paused" | "expired" }}
            initial={{
              wasteType: listing.waste_type as WasteType,
              title: listing.title ?? "",
              description: listing.description ?? "",
              quantityValue: Number(listing.quantity_value),
              quantityUnit: listing.quantity_unit as QuantityUnit,
              photoPaths: (photos ?? []).map((p) => p.storage_path),
              pickupAreaLabel: listing.pickup_area_label ?? "",
              pickupAddressExact: listing.pickup_address_exact ?? "",
              pickupLat: listing.exact_lat ?? undefined,
              pickupLng: listing.exact_lng ?? undefined,
              availableFrom: listing.available_from ? toLocalInputValue(new Date(listing.available_from)) : "",
              availableUntil: listing.available_until ? toLocalInputValue(new Date(listing.available_until)) : "",
              offerType: listing.offer_type as ListingOfferType,
              priceAmount: listing.price_amount === null ? null : Number(listing.price_amount),
            }}
          />
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-wl-border bg-wl-surface p-8 text-center">
            <Lock aria-hidden className="size-10 text-wl-ink-soft" />
            <h2 className="text-xl font-medium">{t("lockedTitle")}</h2>
            <p className="text-wl-ink-soft">{t("lockedBody")}</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/my-listings">{t("backToMyListings")}</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
