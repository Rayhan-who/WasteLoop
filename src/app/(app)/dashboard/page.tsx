import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Leaf, PackageOpen, Send } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Notice } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { TAKER_ROLES } from "@/lib/domain";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("userMenu"))("dashboard") };
}

/** Role-aware home. Counts are single filtered SQL counts under RLS, never full-table scans in JS (§4.1). */
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(LOGIN_PATH);

  const [t, format, params, supabase] = await Promise.all([
    getTranslations("dashboard"),
    getFormatter(),
    searchParams,
    createClient(),
  ]);

  const isProvider = profile.roles.includes("provider");
  const isTaker = profile.roles.some((r) => (TAKER_ROLES as readonly string[]).includes(r));

  const [activeListings, pendingIncoming, activeRequests, impact] = await Promise.all([
    isProvider
      ? supabase
          .from("listings")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", profile.id)
          .in("status", ["available", "reserved"])
      : null,
    isProvider
      ? supabase
          .from("requests")
          .select("id, listings!inner(provider_id)", { count: "exact", head: true })
          .eq("listings.provider_id", profile.id)
          .eq("status", "pending")
      : null,
    isTaker
      ? supabase
          .from("requests")
          .select("id", { count: "exact", head: true })
          .eq("taker_id", profile.id)
          .in("status", ["pending", "accepted"])
      : null,
    supabase.from("impact_records").select("quantity_kg").eq("user_id", profile.id),
  ]);

  const kg = (impact.data ?? []).reduce((sum, r) => sum + Number(r.quantity_kg), 0);
  const name = profile.org_name ?? profile.display_name;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:py-12">
      <header className="space-y-1">
        <h1 className="text-3xl font-medium">{t("title", { name })}</h1>
        <p className="text-wl-ink-soft">{t("subtitle")}</p>
      </header>

      <div className="space-y-3">
        {params.reactivated === "1" ? <Notice tone="success">{t("reactivated")}</Notice> : null}
        {profile.roles.length === 0 ? (
          <Notice>
            {t("noRoles")}{" "}
            <Link href="/settings" className="text-wl-primary underline underline-offset-4">
              {t("goToSettings")}
            </Link>
          </Notice>
        ) : !profile.general_location ? (
          <Notice>
            {t("completeProfile")}{" "}
            <Link href="/settings" className="text-wl-primary underline underline-offset-4">
              {t("goToSettings")}
            </Link>
          </Notice>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isProvider ? (
          <section aria-labelledby="dash-provider" className="flex flex-col gap-4 rounded-xl border border-wl-border bg-wl-surface p-5">
            <h2 id="dash-provider" className="flex items-center gap-2 text-lg font-medium">
              <PackageOpen aria-hidden className="size-5 text-wl-ink-soft" />
              {t("provider.title")}
            </h2>
            <ul className="space-y-1">
              <li>{t("provider.activeListings", { count: activeListings?.count ?? 0 })}</li>
              <li className={(pendingIncoming?.count ?? 0) > 0 ? "text-wl-pending-text" : undefined}>
                {t("provider.pendingIncoming", { count: pendingIncoming?.count ?? 0 })}
              </li>
            </ul>
            {(activeListings?.count ?? 0) === 0 ? <p className="text-sm text-wl-ink-soft">{t("provider.emptyHint")}</p> : null}
            <div className="mt-auto flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/listings/new">{t("provider.postListing")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/my-listings">{t("provider.myListings")}</Link>
              </Button>
            </div>
          </section>
        ) : null}

        {isTaker ? (
          <section aria-labelledby="dash-taker" className="flex flex-col gap-4 rounded-xl border border-wl-border bg-wl-surface p-5">
            <h2 id="dash-taker" className="flex items-center gap-2 text-lg font-medium">
              <Send aria-hidden className="size-5 text-wl-ink-soft" />
              {t("taker.title")}
            </h2>
            <p>{t("taker.activeRequests", { count: activeRequests?.count ?? 0 })}</p>
            {(activeRequests?.count ?? 0) === 0 ? <p className="text-sm text-wl-ink-soft">{t("taker.emptyHint")}</p> : null}
            <div className="mt-auto flex flex-wrap gap-2">
              {/* One primary action per view: providers' primary is "Post surplus". */}
              <Button asChild variant={isProvider ? "outline" : "default"}>
                <Link href="/browse">{t("taker.browse")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/requests">{t("taker.myRequests")}</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <section aria-labelledby="dash-impact" className="flex flex-col gap-3 rounded-xl border border-wl-border bg-wl-surface p-5 md:col-span-2">
          <h2 id="dash-impact" className="flex items-center gap-2 text-lg font-medium">
            <Leaf aria-hidden className="size-5 text-wl-primary" />
            {t("impact.title")}
          </h2>
          {kg > 0 ? (
            <p className="text-2xl font-medium text-wl-primary">
              {t("impact.kgDiverted", { kg: format.number(kg, { maximumFractionDigits: 1 }) })}
            </p>
          ) : (
            <p className="text-wl-ink-soft">{t("impact.none")}</p>
          )}
          <div>
            <Button asChild variant="outline">
              <Link href="/impact">{t("impact.view")}</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
