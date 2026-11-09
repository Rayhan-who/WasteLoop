import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Inbox, Leaf, PackageOpen, Send, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import truck from "@/assets/illustrations/garbage-truck.jpg";
import { PageBanner } from "@/components/app-shell/page-banner";
import { EcoQuiz } from "@/components/dashboard/eco-quiz";
import { Notice } from "@/components/forms/form-alert";
import { ListingCard } from "@/components/listings/listing-card";
import { Button } from "@/components/ui/button";
import { TAKER_ROLES } from "@/lib/domain";
import { getLatestListings, listingPhotoUrl } from "@/lib/listings/queries";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("home") };
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: "attention" | "impact" }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-wl-border bg-wl-surface p-4">
      <span
        aria-hidden
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          tone === "impact" ? "bg-wl-success-tint text-wl-success" : tone === "attention" ? "bg-wl-pending-tint text-wl-pending-text" : "bg-wl-chrome-soft text-wl-ink",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div>
        <p className={cn("text-2xl font-medium", tone === "impact" && "text-wl-success")}>{value}</p>
        <p className="text-sm text-wl-ink-soft">{label}</p>
      </div>
    </div>
  );
}

/** Role-aware home. Counts are single filtered SQL counts under RLS (§4.1). */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(LOGIN_PATH);

  const [t, format, params, supabase] = await Promise.all([getTranslations("dashboard"), getFormatter(), searchParams, createClient()]);
  const isProvider = profile.roles.includes("provider");
  const isTaker = profile.roles.some((r) => (TAKER_ROLES as readonly string[]).includes(r));

  const [activeListings, pendingIncoming, activeRequests, impact, latest, community] = await Promise.all([
    isProvider
      ? supabase.from("listings").select("id", { count: "exact", head: true }).eq("provider_id", profile.id).in("status", ["available", "reserved"])
      : null,
    isProvider
      ? supabase
          .from("requests")
          .select("id, listings!inner(provider_id)", { count: "exact", head: true })
          .eq("listings.provider_id", profile.id)
          .eq("status", "pending")
      : null,
    isTaker
      ? supabase.from("requests").select("id", { count: "exact", head: true }).eq("taker_id", profile.id).in("status", ["pending", "accepted"])
      : null,
    supabase.from("impact_records").select("quantity_kg").eq("user_id", profile.id),
    getLatestListings(3),
    // Community counters (formerly on the public landing page). Optional: omitted on failure (§4.3).
    supabase.rpc("public_impact_stats").then((r) => r.data?.[0] ?? null),
  ]);
  const photos = await Promise.all(latest.map((l) => listingPhotoUrl(l.cover_photo_path)));
  const kg = (impact.data ?? []).reduce((sum, r) => sum + Number(r.quantity_kg), 0);
  const name = profile.org_name ?? profile.display_name;
  const now = new Date();
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const pending = pendingIncoming?.count ?? 0;

  return (
    <>
      <PageBanner eyebrow={t("hello")} title={name} subtitle={profile.general_location ?? undefined}>
        <Button asChild size="lg" className="h-12 rounded-full bg-wl-on-inverse px-6 text-wl-inverse hover:bg-wl-on-inverse/90">
          <Link href="/marketplace">
            {t("openMarketplace")}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
      </PageBanner>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        <div className="space-y-3 empty:hidden">
          {params.reactivated === "1" ? <Notice tone="success">{t("reactivated")}</Notice> : null}
          {profile.roles.length === 0 ? (
            <Notice>
              {t("noRoles")}{" "}
              <Link href="/settings" className="underline underline-offset-4">
                {t("goToSettings")}
              </Link>
            </Notice>
          ) : !profile.general_location ? (
            <Notice>
              {t("completeProfile")}{" "}
              <Link href="/settings" className="underline underline-offset-4">
                {t("goToSettings")}
              </Link>
            </Notice>
          ) : null}
        </div>

        <section aria-label={t("statsLabel")} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {isProvider ? (
            <>
              <StatCard icon={PackageOpen} label={t("stats.liveListings")} value={format.number(activeListings?.count ?? 0)} />
              <StatCard icon={Inbox} label={t("stats.waiting")} value={format.number(pending)} tone={pending > 0 ? "attention" : undefined} />
            </>
          ) : null}
          {isTaker ? <StatCard icon={Send} label={t("stats.openRequests")} value={format.number(activeRequests?.count ?? 0)} /> : null}
          <StatCard
            icon={Leaf}
            label={t("stats.kgDiverted")}
            value={t("stats.kg", { kg: format.number(kg, { maximumFractionDigits: 1 }) })}
            tone="impact"
          />
        </section>

        {community ? (
          <section aria-labelledby="dash-community" className="rounded-2xl border border-wl-border bg-wl-surface p-5">
            <h2 id="dash-community" className="text-xs tracking-wide text-wl-ink-muted uppercase">
              {t("community.title")}
            </h2>
            <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <dd className="text-2xl font-medium text-wl-success">
                  {format.number(Number(community.kg_diverted ?? 0), { maximumFractionDigits: 0 })}
                </dd>
                <dt className="text-sm text-wl-ink-soft">{t("community.kg")}</dt>
              </div>
              <div>
                <dd className="text-2xl font-medium">{format.number(Number(community.active_listings ?? 0))}</dd>
                <dt className="text-sm text-wl-ink-soft">{t("community.active")}</dt>
              </div>
              <div>
                <dd className="text-2xl font-medium">{format.number(Number(community.completed_exchanges ?? 0))}</dd>
                <dt className="text-sm text-wl-ink-soft">{t("community.completed")}</dt>
              </div>
            </dl>
          </section>
        ) : null}

        <section aria-labelledby="dash-new" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 id="dash-new" className="text-xl font-medium">
              {t("newInMarketplace")}
            </h2>
            <Link href="/marketplace" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">
              {t("viewAll")}
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </div>
          {latest.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((listing, i) => (
                <li key={listing.id}>
                  <ListingCard listing={listing} photoUrl={photos[i]} now={now} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-wl-grey-200 bg-wl-surface p-6 text-center text-wl-ink-soft">{t("nothingNew")}</p>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <EcoQuiz dayIndex={dayIndex} />
          <section aria-labelledby="dash-reminders" className="flex flex-col overflow-hidden rounded-2xl border border-wl-border bg-wl-surface">
            <div className="p-5 md:p-6">
              <h2 id="dash-reminders" className="text-lg font-medium">
                {t("reminders.title")}
              </h2>
              <p className="mt-1 text-wl-ink-soft">{t("reminders.body")}</p>
            </div>
            <Image src={truck} alt={t("reminders.alt")} sizes="(min-width: 1024px) 40vw, 90vw" className="mt-auto h-auto w-full max-w-md self-center" />
          </section>
        </div>
      </div>
    </>
  );
}
