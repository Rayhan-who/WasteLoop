import Link from "next/link";
import { Handshake, Info, MapPinned, PackagePlus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StreamChip } from "@/components/listings/stream-chip";
import { Button } from "@/components/ui/button";
import { WASTE_TYPES } from "@/lib/domain";

/**
 * Landing page: what WasteLoop does, the four waste streams, and the
 * connection-platform-only notice. Live counters of waste diverted and
 * active listings are added once impact data exists (milestone 10).
 */
export default async function LandingPage() {
  const t = await getTranslations("landing");

  const steps = [
    { icon: PackagePlus, title: t("how.step1Title"), body: t("how.step1Body") },
    { icon: MapPinned, title: t("how.step2Title"), body: t("how.step2Body") },
    { icon: Handshake, title: t("how.step3Title"), body: t("how.step3Body") },
  ];

  return (
    <>
      <section className="border-b border-wl-border">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-sm font-medium tracking-wide text-wl-primary uppercase">{t("hero.eyebrow")}</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-tight font-medium md:text-5xl">{t("hero.title")}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-wl-ink-soft">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/browse">{t("hero.ctaBrowse")}</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/listings/new">{t("hero.ctaPost")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section aria-labelledby="streams-heading" className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 id="streams-heading" className="text-2xl font-medium md:text-3xl">
          {t("streams.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-wl-ink-soft">{t("streams.subtitle")}</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WASTE_TYPES.map((type) => (
            <li key={type} className="flex flex-col gap-3 rounded-xl border border-wl-border bg-wl-surface p-5">
              <StreamChip type={type} className="self-start" />
              <p className="leading-relaxed">{t(`streams.${type}.body`)}</p>
              <p className="mt-auto text-sm text-wl-ink-soft">{t(`streams.${type}.takers`)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading" className="border-y border-wl-border bg-wl-surface">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="how-heading" className="text-2xl font-medium md:text-3xl">
            {t("how.title")}
          </h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wl-primary-tint text-wl-primary"
                >
                  <step.icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-medium">
                    <span className="text-wl-ink-muted">{i + 1}. </span>
                    {step.title}
                  </h3>
                  <p className="mt-1 leading-relaxed text-wl-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="notice-heading" className="mx-auto w-full max-w-6xl px-4 py-12">
        <div className="flex gap-4 rounded-xl border border-wl-border bg-wl-surface p-6">
          <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-wl-info" />
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
