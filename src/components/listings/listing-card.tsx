import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { WASTE_STREAM_STYLES } from "@/lib/design/streams";
import type { ListingOfferType, QuantityUnit, WasteType } from "@/lib/domain";
import type { ListingCardData } from "@/lib/listings/queries";
import { cn } from "@/lib/utils";
import { OfferBadge, ProviderName, Quantity } from "./listing-bits";
import { StreamChip } from "./stream-chip";

/** Photo, or a neutral placeholder showing the stream icon when there is none. */
export function ListingImage({
  type,
  photoUrl,
  alt,
  className,
  sizes,
}: {
  type: WasteType;
  photoUrl: string | null;
  alt: string;
  className?: string;
  sizes: string;
}) {
  const style = WASTE_STREAM_STYLES[type];
  const Icon = style.icon;
  return (
    <div className={cn("relative overflow-hidden bg-wl-chrome-soft", className)}>
      {photoUrl ? (
        <Image src={photoUrl} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon aria-hidden strokeWidth={1.25} className={cn("size-16 opacity-80", style.iconColor)} />
        </div>
      )}
    </div>
  );
}

/** Marketplace card. The whole card is one link; status reserved is flagged. */
export function ListingCard({ listing, photoUrl, now }: { listing: ListingCardData; photoUrl: string | null; now: Date }) {
  const t = useTranslations("listing");
  const tStatus = useTranslations("listingStatus");
  const format = useFormatter();
  const type = listing.waste_type as WasteType;
  const until = listing.available_until ? new Date(listing.available_until) : null;
  const name = listing.provider_org_name ?? listing.provider_display_name ?? "";

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-wl-border bg-wl-surface transition-shadow hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)]"
    >
      <div className="relative">
        <ListingImage type={type} photoUrl={photoUrl} alt={listing.title ?? ""} className="aspect-[4/3]" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" />
        <StreamChip type={type} className="absolute top-3 left-3 shadow-sm" />
        {listing.status === "reserved" ? (
          <span className="absolute top-3 right-3 rounded-full bg-wl-pending-tint px-2.5 py-1 text-xs font-medium text-wl-pending-text">
            {tStatus("reserved")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 font-medium text-wl-ink group-hover:underline group-hover:underline-offset-4">{listing.title}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-wl-ink-soft">
            <Quantity value={Number(listing.quantity_value)} unit={listing.quantity_unit as QuantityUnit} />
          </span>
          <OfferBadge
            offer={listing.offer_type as ListingOfferType}
            price={listing.price_amount === null ? null : Number(listing.price_amount)}
            currency={listing.currency ?? "BDT"}
          />
        </div>
        <div className="mt-auto space-y-1 pt-2 text-sm text-wl-ink-soft">
          <p className="flex items-center gap-1.5">
            <MapPin aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{listing.pickup_area_label}</span>
          </p>
          {until ? (
            <p className="flex items-center gap-1.5">
              <Clock aria-hidden className="size-4 shrink-0" />
              {t("endsIn", { time: format.relativeTime(until, now) })}
            </p>
          ) : null}
          <ProviderName name={name} verified={listing.provider_verified ?? false} className="text-wl-ink" />
        </div>
      </div>
    </Link>
  );
}
