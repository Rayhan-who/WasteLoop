import type { ReactNode } from "react";
import Link from "next/link";
import { Bell, Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import { UserMenu } from "@/components/layout/user-menu";
import { navFor } from "@/lib/nav";
import type { CurrentProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs, SidebarNav } from "./app-nav";

/**
 * Signed-in layout, modelled on the mobile-app design: a white top bar with
 * the logo, notifications bell and settings; a sidebar on desktop; a bottom
 * tab bar on phones.
 */
export async function AppShell({ profile, children }: { profile: CurrentProfile; children: ReactNode }) {
  const [t, tCommon, supabase] = await Promise.all([getTranslations("nav"), getTranslations("common"), createClient()]);

  // Unread badge. Degrades to 0 if the query fails (§4.3: optional parts never crash the page).
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("read_at", null);
  const unread = count ?? 0;

  const items = navFor(profile.roles).map((i) => i.label);
  const iconLink =
    "relative inline-flex size-11 items-center justify-center rounded-full text-wl-ink transition-colors hover:bg-wl-chrome-soft";

  return (
    <div className="flex min-h-dvh flex-col bg-wl-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-wl-surface focus:px-4 focus:py-2"
      >
        {tCommon("skipToContent")}
      </a>
      <header className="sticky top-0 z-40 h-16 border-b border-wl-border bg-wl-chrome">
        <div className="flex h-full items-center justify-between gap-3 px-4 md:px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-1">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            <Link href="/notifications" className={iconLink} aria-label={t("notificationsCount", { count: unread })}>
              <Bell aria-hidden className="size-6" />
              {unread > 0 ? (
                <span aria-hidden className="absolute top-2 right-2 size-2.5 rounded-full bg-wl-danger ring-2 ring-wl-chrome" />
              ) : null}
            </Link>
            <Link href="/settings" className={iconLink} aria-label={t("settings")}>
              <Settings aria-hidden className="size-6" />
            </Link>
            <div className="ml-1 hidden md:block">
              <UserMenu name={profile.org_name ?? profile.display_name} isAdmin={profile.isAdmin} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <SidebarNav items={items} unread={unread} />
        {/* Bottom padding keeps content clear of the mobile tab bar. */}
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-24 focus:outline-none md:pb-10">
          {children}
        </main>
      </div>

      <BottomTabs items={items} unread={unread} />
    </div>
  );
}
