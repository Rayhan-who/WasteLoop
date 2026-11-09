import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { WASTE_STREAM_STYLES } from "@/lib/design/streams";
import { LISTING_OFFER_TYPES, WASTE_TYPES, type ListingOfferType, type WasteType } from "@/lib/domain";
import { cn } from "@/lib/utils";

function href(type?: WasteType, offer?: ListingOfferType) {
  const p = new URLSearchParams();
  if (type) p.set("type", type);
  if (offer) p.set("offer", offer);
  const q = p.toString();
  return q ? `/marketplace?${q}` : "/marketplace";
}

/**
 * Waste-stream category tabs with counts. Stream colour appears only on the
 * small icon (never a fill); the active tab is solid black.
 */
export function CategoryTabs({
  active,
  offer,
  counts,
}: {
  active?: WasteType;
  offer?: ListingOfferType;
  counts: Record<WasteType | "all", number>;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const tab = (isActive: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
      isActive ? "border-wl-inverse bg-wl-inverse text-wl-on-inverse" : "border-wl-border bg-wl-surface text-wl-ink hover:border-wl-grey-300",
    );

  return (
    <nav aria-label={t("market.categories")} className="-mx-4 overflow-x-auto px-4 pb-1">
      <ul className="flex gap-2">
        <li>
          <Link href={href(undefined, offer)} aria-current={!active ? "page" : undefined} className={tab(!active)}>
            <LayoutGrid aria-hidden className="size-4" />
            {t("market.all")}
            <span className="opacity-60">{format.number(counts.all)}</span>
          </Link>
        </li>
        {WASTE_TYPES.map((type) => {
          const style = WASTE_STREAM_STYLES[type];
          const Icon = style.icon;
          const isActive = active === type;
          return (
            <li key={type}>
              <Link href={href(type, offer)} aria-current={isActive ? "page" : undefined} className={tab(isActive)}>
                <Icon aria-hidden className={cn("size-4", !isActive && style.iconColor)} />
                {t(`streams.${type}`)}
                <span className="opacity-60">{format.number(counts[type])}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Offer-type filter: All / Free / Donation / For sale. */
export function OfferFilter({ type, active }: { type?: WasteType; active?: ListingOfferType }) {
  const t = useTranslations();
  const item = (isActive: boolean) =>
    cn(
      "inline-flex min-h-10 items-center rounded-full px-3 text-sm transition-colors",
      isActive ? "bg-wl-chrome-soft font-medium text-wl-ink" : "text-wl-ink-soft hover:text-wl-ink",
    );
  return (
    <nav aria-label={t("market.offerFilter")} className="flex flex-wrap gap-1">
      <Link href={href(type)} aria-current={!active ? "page" : undefined} className={item(!active)}>
        {t("market.anyOffer")}
      </Link>
      {LISTING_OFFER_TYPES.map((o) => (
        <Link key={o} href={href(type, o)} aria-current={active === o ? "page" : undefined} className={item(active === o)}>
          {t(`offerTypes.${o}`)}
        </Link>
      ))}
    </nav>
  );
}

export function marketplaceHref(type?: WasteType, offer?: ListingOfferType, page?: number) {
  const base = href(type, offer);
  if (!page || page <= 1) return base;
  return `${base}${base.includes("?") ? "&" : "?"}page=${page}`;
}
