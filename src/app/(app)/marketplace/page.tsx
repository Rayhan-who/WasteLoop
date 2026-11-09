import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageBanner } from "@/components/app-shell/page-banner";
import { CategoryTabs, OfferFilter, marketplaceHref } from "@/components/listings/category-tabs";
import { ListingCard } from "@/components/listings/listing-card";
import { Button } from "@/components/ui/button";
import {
  PAGE_SIZE,
  getCategoryCounts,
  getMarketplacePage,
  listingPhotoUrl,
  parseMarketplaceFilters,
} from "@/lib/listings/queries";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("market"))("title") };
}

/**
 * Marketplace (FR-4.1): listings grouped by waste stream, filterable by offer
 * type, 20 per page. Everything is filtered and paginated in SQL against
 * listings_public. Distance sorting and the map arrive in milestone 5.
 */
export default async function MarketplacePage({ searchParams }: PageProps<"/marketplace">) {
  const filters = parseMarketplaceFilters(await searchParams);
  const [t, format, page, counts] = await Promise.all([
    getTranslations("market"),
    getFormatter(),
    getMarketplacePage(filters),
    getCategoryCounts(filters.offer),
  ]);
  const photos = await Promise.all(page.listings.map((l) => listingPhotoUrl(l.cover_photo_path)));
  const pages = Math.max(1, Math.ceil(page.total / PAGE_SIZE));
  const now = new Date();

  return (
    <>
      <PageBanner eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 md:px-8">
        <CategoryTabs active={filters.type} offer={filters.offer} counts={counts} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <OfferFilter type={filters.type} active={filters.offer} />
          <p className="text-sm text-wl-ink-soft" aria-live="polite">
            {t("resultCount", { count: page.total, formatted: format.number(page.total) })}
          </p>
        </div>

        {page.listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-wl-grey-200 bg-wl-surface px-6 py-16 text-center">
            <PackageSearch aria-hidden className="size-10 text-wl-ink-muted" />
            <h2 className="text-lg font-medium">{t("emptyTitle")}</h2>
            <p className="max-w-sm text-wl-ink-soft">{t("emptyBody")}</p>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/marketplace">{t("showAll")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {page.listings.map((listing, i) => (
              <li key={listing.id}>
                <ListingCard listing={listing} photoUrl={photos[i]} now={now} />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 ? (
          <nav aria-label={t("pagination")} className="flex items-center justify-center gap-3 pt-2">
            {filters.page > 1 ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={marketplaceHref(filters.type, filters.offer, filters.page - 1)} rel="prev">
                  <ChevronLeft aria-hidden className="size-4" />
                  {t("previous")}
                </Link>
              </Button>
            ) : null}
            <span className="text-sm text-wl-ink-soft">
              {t("pageOf", { page: format.number(filters.page), pages: format.number(pages) })}
            </span>
            {filters.page < pages ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link href={marketplaceHref(filters.type, filters.offer, filters.page + 1)} rel="next">
                  {t("next")}
                  <ChevronRight aria-hidden className="size-4" />
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null}
      </div>
    </>
  );
}
