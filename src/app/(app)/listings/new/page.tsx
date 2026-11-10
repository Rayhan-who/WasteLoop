import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageBanner } from "@/components/app-shell/page-banner";
import { ListingWizard } from "@/components/listings/listing-wizard";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("listingForm"))("newTitle") };
}

/** FR-3.1 post a listing. Providers only; others are told how to become one. */
export default async function NewListingPage() {
  const [t, profile] = await Promise.all([getTranslations("listingForm"), getCurrentProfile()]);
  if (!profile) redirect(LOGIN_PATH);

  return (
    <>
      <PageBanner eyebrow={t("newEyebrow")} title={t("newTitle")} subtitle={t("newSubtitle")} />
      <div className="px-4 py-6 md:px-8">
        {profile.roles.includes("provider") ? (
          <ListingWizard userId={profile.id} mode={{ kind: "create" }} />
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-3xl border border-wl-border bg-wl-surface p-8 text-center">
            <Store aria-hidden className="size-10 text-wl-ink-soft" />
            <h2 className="text-xl font-medium">{t("notProviderTitle")}</h2>
            <p className="text-wl-ink-soft">{t("notProviderBody")}</p>
            <Button asChild size="lg" className="h-12 rounded-full px-6">
              <Link href="/settings#settings-roles">{t("notProviderCta")}</Link>
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
