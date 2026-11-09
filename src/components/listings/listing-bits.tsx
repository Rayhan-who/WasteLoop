import { BadgeCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type { ListingOfferType, QuantityUnit } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** "15 kg", "40 items", "৬ ব্যাগ" — localised quantity with unit. */
export function Quantity({ value, unit }: { value: number; unit: QuantityUnit }) {
  const t = useTranslations("quantity");
  const format = useFormatter();
  return <>{t(unit, { count: value, value: format.number(value, { maximumFractionDigits: 2 }) })}</>;
}

/** Offer badge: Free / Donation in green-on-tint, a price in burgundy (money colour). */
export function OfferBadge({
  offer,
  price,
  currency,
  className,
}: {
  offer: ListingOfferType;
  price: number | null;
  currency: string;
  className?: string;
}) {
  const t = useTranslations("offerTypes");
  const format = useFormatter();
  if (offer === "for_sale" && price !== null) {
    return (
      <span className={cn("inline-flex items-center rounded-full bg-wl-money-tint px-2.5 py-1 text-sm font-medium text-wl-money", className)}>
        {format.number(price, { style: "currency", currency, maximumFractionDigits: 0 })}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center rounded-full bg-wl-success-tint px-2.5 py-1 text-sm font-medium text-wl-success", className)}>
      {t(offer)}
    </span>
  );
}

/** Provider name with a verified badge when their organisation is approved. */
export function ProviderName({ name, verified, className }: { name: string; verified: boolean; className?: string }) {
  const t = useTranslations("listing");
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="truncate">{name}</span>
      {verified ? (
        <BadgeCheck aria-label={t("verified")} role="img" className="size-4 shrink-0 text-wl-success" />
      ) : null}
    </span>
  );
}
