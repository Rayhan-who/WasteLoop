import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Eye, Inbox, PackagePlus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageBanner } from "@/components/app-shell/page-banner";
import { OfferBadge, Quantity } from "@/components/listings/listing-bits";
import { ListingImage } from "@/components/listings/listing-card";
import { MyListingActions } from "@/components/listings/my-listing-actions";
import { Button } from "@/components/ui/button";
import { LISTING_STATUS_STYLES } from "@/lib/design/status";
import type { ListingOfferType, ListingStatus, QuantityUnit, WasteType } from "@/lib/domain";
import { listingPhotoUrl } from "@/lib/listings/queries";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("myListings") };
}

const TABS = {
  active: ["available", "reserved"],
  drafts: ["draft"],
  paused: ["paused"],
  ended: ["expired", "collected", "removed"],
} as const satisfies Record<string, readonly ListingStatus[]>;
type Tab = keyof typeof TABS;

/** FR-3.3 the provider's own listings, by status, with lifecycle actions. */
export default async function MyListingsPage({ searchParams }: PageProps<"/my-listings">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(LOGIN_PATH);
  const params = await searchParams;
  const tab: Tab = typeof params.tab === "string" && params.tab in TABS ? (params.tab as Tab) : "active";

  const [t, tStatus, format, supabase] = await Promise.all([
    getTranslations("myListings"),
    getTranslations("listingStatus"),
    getFormatter(),
    createClient(),
  ]);

  const [{ data: rows }, counts] = await Promise.all([
    supabase
      .from("listings")
      .select(
        "id, title, waste_type, quantity_value, quantity_unit, offer_type, price_amount, currency, status, available_until, view_count, pickup_area_label, listing_photos(storage_path, sort_order), requests(count)",
      )
      .eq("provider_id", profile.id)
      .in("status", [...TABS[tab]])
      .order("created_at", { ascending: false })
      .limit(100),
    Promise.all(
      (Object.keys(TABS) as Tab[]).map(async (k) => {
        const { count } = await supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", profile.id)
          .in("status", [...TABS[k]]);
        return [k, count ?? 0] as const;
      }),
    ).then((entries) => Object.fromEntries(entries) as Record<Tab, number>),
  ]);

  const listings = rows ?? [];
  const covers = await Promise.all(
    listings.map((l) => {
      const first = [...(l.listing_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return listingPhotoUrl(first?.storage_path ?? null);
    }),
  );
  const now = new Date();
  const isProvider = profile.roles.includes("provider");

  return (
    <>
      <PageBanner title={t("title")} subtitle={t("subtitle")}>
        {isProvider ? (
          <Button asChild size="lg" className="h-12 rounded-full bg-wl-on-inverse px-6 text-wl-inverse hover:bg-wl-on-inverse/90">
            <Link href="/listings/new">
              <PackagePlus aria-hidden className="size-4" />
              {t("post")}
            </Link>
          </Button>
        ) : null}
      </PageBanner>

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-8">
        <nav aria-label={t("tabsLabel")} className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {(Object.keys(TABS) as Tab[]).map((k) => (
              <li key={k}>
                <Link
                  href={k === "active" ? "/my-listings" : `/my-listings?tab=${k}`}
                  aria-current={tab === k ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap",
                    tab === k ? "border-wl-inverse bg-wl-inverse text-wl-on-inverse" : "border-wl-border bg-wl-surface hover:border-wl-grey-300",
                  )}
                >
                  {t(`tabs.${k}`)}
                  <span className="opacity-60">{format.number(counts[k])}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-wl-grey-200 bg-wl-surface px-6 py-14 text-center">
            <PackagePlus aria-hidden className="size-10 text-wl-ink-muted" />
            <h2 className="text-lg font-medium">{t(`empty.${tab}`)}</h2>
            {isProvider && tab === "active" ? (
              <>
                <p className="max-w-sm text-wl-ink-soft">{t("emptyHint")}</p>
                <Button asChild size="lg" className="h-12 rounded-full px-6">
                  <Link href="/listings/new">{t("post")}</Link>
                </Button>
              </>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-3">
            {listings.map((l, i) => {
              const status = l.status as ListingStatus;
              const requestCount = l.requests?.[0]?.count ?? 0;
              return (
                <li key={l.id} className="flex flex-col gap-4 rounded-2xl border border-wl-border bg-wl-surface p-4 sm:flex-row">
                  <Link href={`/listings/${l.id}`} className="shrink-0">
                    <ListingImage
                      type={l.waste_type as WasteType}
                      photoUrl={covers[i]}
                      alt={l.title}
                      sizes="160px"
                      className="aspect-[4/3] w-full rounded-xl sm:w-40"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs", LISTING_STATUS_STYLES[status])}>
                        {tStatus(status)}
                      </span>
                      <OfferBadge
                        offer={l.offer_type as ListingOfferType}
                        price={l.price_amount === null ? null : Number(l.price_amount)}
                        currency={l.currency}
                        className="py-0.5 text-xs"
                      />
                    </div>
                    <Link href={`/listings/${l.id}`} className="font-medium hover:underline">
                      {l.title}
                    </Link>
                    <p className="text-sm text-wl-ink-soft">
                      <Quantity value={Number(l.quantity_value)} unit={l.quantity_unit as QuantityUnit} /> · {l.pickup_area_label}
                    </p>
                    <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-wl-ink-soft">
                      <span className="inline-flex items-center gap-1">
                        <Eye aria-hidden className="size-4" />
                        {t("views", { count: l.view_count })}
                      </span>
                      <span className={cn("inline-flex items-center gap-1", requestCount > 0 && "text-wl-pending-text")}>
                        <Inbox aria-hidden className="size-4" />
                        {t("requests", { count: requestCount })}
                      </span>
                      {status === "available" ? <span>{t("endsIn", { time: format.relativeTime(new Date(l.available_until), now) })}</span> : null}
                    </p>
                    <div className="mt-auto pt-1">
                      <MyListingActions id={l.id} status={status} title={l.title} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
