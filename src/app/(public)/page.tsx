import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Handshake, Info, MapPinned, PackagePlus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import truck from "@/assets/illustrations/garbage-truck.jpg";
import { Notice } from "@/components/forms/form-alert";
import { ListingCard } from "@/components/listings/listing-card";
import { StreamChip } from "@/components/listings/stream-chip";
import { Button } from "@/components/ui/button";
import { WASTE_TYPES } from "@/lib/domain";
import { getLatestListings, listingPhotoUrl } from "@/lib/listings/queries";
import { createClient } from "@/lib/supabase/server";

/** Live landing counters. Optional: on failure the section is simply omitted (§4.3). */
async function getStats() {
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc("public_impact_stats");
    return data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Landing page: what WasteLoop does, live counters, fresh listings, the four
 * waste streams, how it works, and the connection-platform-only notice.
 */
export default async function LandingPage({ searchParams }: PageProps<"/">) {
  const [t, format, params, stats, latest] = await Promise.all([
    getTranslations("landing"),
    getFormatter(),
    searchParams,
    getStats(),
    getLatestListings(4).catch(() => []),
  ]);
  const photos = await Promise.all(latest.map((l) => listingPhotoUrl(l.cover_photo_path)));
  const now = new Date();

  const steps = [
    { icon: PackagePlus, title: t("how.step1Title"), body: t("how.step1Body") },
    { icon: MapPinned, title: t("how.step2Title"), body: t("how.step2Body") },
    { icon: Handshake, title: t("how.step3Title"), body: t("how.step3Body") },
  ];

  return (
    <>
      {params.deactivated === "1" ? (
        <div className="mx-auto w-full max-w-6xl px-4 pt-6">
          <Notice>{t("deactivatedNotice")}</Notice>
        </div>
      ) : null}

      <section className="bg-wl-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm tracking-[0.15em] text-wl-ink-soft uppercase">{t("hero.eyebrow")}</p>
            <h1 className="mt-3 text-4xl leading-[1.1] font-medium tracking-tight md:text-5xl">{t("hero.title")}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-wl-ink-soft">{t("hero.subtitle")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="h-12 rounded-full px-6">
                <Link href="/marketplace">
                  {t("hero.ctaBrowse")}
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full px-6">
                <Link href="/register">{t("hero.ctaJoin")}</Link>
              </Button>
            </div>
          </div>
          <Image src={truck} alt={t("hero.illustrationAlt")} priority sizes="(min-width: 768px) 50vw, 100vw" className="h-auto w-full" />
        </div>
      </section>

      {stats ? (
        <section aria-label={t("stats.label")} className="border-y border-wl-border bg-wl-paper">
          <dl className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 text-center sm:grid-cols-3">
            <div>
              <dt className="text-sm text-wl-ink-soft">{t("stats.kg")}</dt>
              <dd className="text-3xl font-medium text-wl-success">{format.number(Number(stats.kg_diverted ?? 0), { maximumFractionDigits: 0 })}</dd>
            </div>
            <div>
              <dt className="text-sm text-wl-ink-soft">{t("stats.active")}</dt>
              <dd className="text-3xl font-medium">{format.number(Number(stats.active_listings ?? 0))}</dd>
            </div>
            <div>
              <dt className="text-sm text-wl-ink-soft">{t("stats.completed")}</dt>
              <dd className="text-3xl font-medium">{format.number(Number(stats.completed_exchanges ?? 0))}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {latest.length > 0 ? (
        <section aria-labelledby="fresh-heading" className="mx-auto w-full max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 id="fresh-heading" className="text-2xl font-medium md:text-3xl">
              {t("fresh.title")}
            </h2>
            <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              {t("fresh.viewAll")}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {latest.map((listing, i) => (
              <li key={listing.id}>
                <ListingCard listing={listing} photoUrl={photos[i]} now={now} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="streams-heading" className="bg-wl-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-14">
          <h2 id="streams-heading" className="text-2xl font-medium md:text-3xl">
            {t("streams.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-wl-ink-soft">{t("streams.subtitle")}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WASTE_TYPES.map((type) => (
              <li key={type}>
                <Link
                  href={`/marketplace?type=${type}`}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-wl-border bg-wl-surface p-5 transition-colors hover:border-wl-ink"
                >
                  <StreamChip type={type} className="self-start" />
                  <p className="leading-relaxed">{t(`streams.${type}.body`)}</p>
                  <p className="mt-auto text-sm text-wl-ink-soft">{t(`streams.${type}.takers`)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 id="how-heading" className="scroll-mt-20 text-2xl font-medium md:text-3xl">
          {t("how.title")}
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-wl-border bg-wl-surface p-5">
              <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-wl-inverse text-wl-on-inverse">
                <step.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-medium">
                <span className="text-wl-ink-muted">{i + 1}. </span>
                {step.title}
              </h3>
              <p className="mt-1 leading-relaxed text-wl-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="notice-heading" className="mx-auto w-full max-w-6xl px-4 pb-14">
        <div className="flex gap-4 rounded-2xl border border-wl-border bg-wl-surface p-6">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-wl-ink-soft" />
          <div>
            <h2 id="notice-heading" className="font-medium">
              {t("notice.title")}
            </h2>
            <p className="mt-1 leading-relaxed text-wl-ink-soft">{t("notice.body")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
