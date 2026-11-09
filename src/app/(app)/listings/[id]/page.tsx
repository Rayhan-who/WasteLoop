import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Lock, MapPin, ShieldAlert, Star } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { OfferBadge, ProviderName, Quantity } from "@/components/listings/listing-bits";
import { ListingImage } from "@/components/listings/listing-card";
import { StreamChip } from "@/components/listings/stream-chip";
import { Button } from "@/components/ui/button";
import { LISTING_STATUS_STYLES } from "@/lib/design/status";
import type { ListingOfferType, ListingStatus, QuantityUnit, WasteType } from "@/lib/domain";
import { listingPhotoUrl } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type Params = { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadListing(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  // get_listing_detail() returns the exact address only to the owner, an
  // accepted taker or an admin (SRS §4.4); everyone else gets NULL.
  const { data } = await supabase.rpc("get_listing_detail", { p_listing_id: id });
  return data?.[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  return { title: listing?.title ?? undefined };
}

export default async function ListingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await loadListing(id);
  if (!listing || !listing.id) notFound();

  const supabase = await createClient();
  const [t, tStatus, format, photos, provider] = await Promise.all([
    getTranslations("listing"),
    getTranslations("listingStatus"),
    getFormatter(),
    supabase.from("listing_photos").select("storage_path").eq("listing_id", listing.id).order("sort_order"),
    supabase
      .from("profiles_public")
      .select("display_name, org_name, general_location, rating_avg, rating_count, is_verified")
      .eq("id", listing.provider_id ?? "")
      .maybeSingle(),
  ]);

  // Viewing a public listing counts a view (owner views are ignored by the function).
  // Supabase builders are lazy, so this must be awaited; a failure is ignored (§4.3).
  if (listing.viewer_relation === "public") await supabase.rpc("increment_listing_view", { p_listing_id: listing.id });

  const type = listing.waste_type as WasteType;
  const status = listing.status as ListingStatus;
  const cover = await listingPhotoUrl(photos.data?.[0]?.storage_path ?? null);
  const providerName = listing.provider_org_name ?? listing.provider_display_name ?? "";
  const canSeeExact = listing.viewer_relation !== "public" && listing.pickup_address_exact;
  const from = listing.available_from ? new Date(listing.available_from) : null;
  const until = listing.available_until ? new Date(listing.available_until) : null;

  return (
    <article className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-8 md:py-8">
      <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-2 text-sm text-wl-ink-soft hover:text-wl-ink">
        <ArrowLeft aria-hidden className="size-4" />
        {t("back")}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <ListingImage type={type} photoUrl={cover} alt={listing.title ?? ""} className="aspect-[16/10] rounded-2xl" sizes="(min-width: 1024px) 60vw, 100vw" />

          <div className="flex flex-wrap items-center gap-2">
            <StreamChip type={type} />
            <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-sm", LISTING_STATUS_STYLES[status])}>
              {tStatus(status)}
            </span>
          </div>

          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{listing.title}</h1>
          {listing.description ? <p className="leading-relaxed whitespace-pre-line text-wl-ink-soft">{listing.description}</p> : null}

          {type === "edible_food" ? (
            <p role="note" className="flex gap-3 rounded-2xl border border-wl-pending/30 bg-wl-pending-tint p-4 text-sm text-wl-pending-text">
              <ShieldAlert aria-hidden className="size-5 shrink-0" />
              {t("foodSafety")}
            </p>
          ) : null}
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-wl-border bg-wl-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-medium">
                <Quantity value={Number(listing.quantity_value)} unit={listing.quantity_unit as QuantityUnit} />
              </span>
              <OfferBadge
                offer={listing.offer_type as ListingOfferType}
                price={listing.price_amount === null ? null : Number(listing.price_amount)}
                currency={listing.currency ?? "BDT"}
                className="text-base"
              />
            </div>

            {from && until ? (
              <p className="flex gap-2 text-sm">
                <CalendarClock aria-hidden className="mt-0.5 size-4 shrink-0 text-wl-ink-soft" />
                <span>
                  {t("window", {
                    from: format.dateTime(from, { dateStyle: "medium", timeStyle: "short" }),
                    until: format.dateTime(until, { dateStyle: "medium", timeStyle: "short" }),
                  })}
                </span>
              </p>
            ) : null}

            <div className="space-y-2 text-sm">
              <p className="flex gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-wl-ink-soft" />
                <span>
                  <span className="font-medium">{listing.pickup_area_label}</span>
                  <span className="block text-wl-ink-muted">{t("approximateArea")}</span>
                </span>
              </p>
              {canSeeExact ? (
                <div className="rounded-xl bg-wl-success-tint p-3 text-wl-success">
                  <p className="font-medium">{t("exactAddress")}</p>
                  <p className="text-wl-ink">{listing.pickup_address_exact}</p>
                  <p className="mt-1 text-xs">{t(`exactReason.${listing.viewer_relation as "owner" | "admin" | "accepted_taker"}`)}</p>
                </div>
              ) : (
                <p className="flex gap-2 rounded-xl bg-wl-chrome-soft p-3 text-wl-ink-soft">
                  <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t("addressHidden")}
                </p>
              )}
            </div>

            {listing.viewer_relation === "owner" ? (
              <p className="rounded-xl bg-wl-chrome-soft p-3 text-center text-sm">{t("yourListing")}</p>
            ) : (
              <div className="space-y-2">
                <Button size="lg" className="h-12 w-full rounded-full" disabled>
                  {t("request")}
                </Button>
                <p className="text-center text-xs text-wl-ink-muted">{t("requestSoon")}</p>
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-wl-border bg-wl-surface p-5">
            <p className="text-xs tracking-wide text-wl-ink-muted uppercase">{t("postedBy")}</p>
            <ProviderName name={providerName} verified={listing.provider_verified ?? false} className="text-base font-medium" />
            {provider.data?.general_location ? <p className="text-sm text-wl-ink-soft">{provider.data.general_location}</p> : null}
            {provider.data?.rating_count ? (
              <p className="flex items-center gap-1 text-sm">
                <Star aria-hidden className="size-4 fill-current text-wl-pending" />
                {t("rating", {
                  avg: format.number(Number(provider.data.rating_avg), { maximumFractionDigits: 1 }),
                  count: provider.data.rating_count,
                })}
              </p>
            ) : (
              <p className="text-sm text-wl-ink-muted">{t("noRatings")}</p>
            )}
          </div>
        </aside>
      </div>
    </article>
  );
}
