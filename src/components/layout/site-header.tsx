import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/profile";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileNav, type NavItem } from "./mobile-nav";
import { UserMenu } from "./user-menu";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm text-wl-on-chrome-dim transition-colors hover:text-wl-on-chrome";

/** Site header: navy chrome (§7.5). Server Component; auth state is read per request. */
export async function SiteHeader() {
  const [t, tCommon, tUser, profile] = await Promise.all([
    getTranslations("nav"),
    getTranslations("common"),
    getTranslations("userMenu"),
    getCurrentProfile(),
  ]);

  const primaryNav: NavItem[] = [
    { href: "/marketplace", label: t("marketplace") },
    { href: "/#how-heading", label: t("howItWorks") },
  ];

  const mobileAccountNav: NavItem[] = profile
    ? [
        { href: "/dashboard", label: tUser("dashboard") },
        { href: "/settings", label: tUser("settings") },
        ...(profile.isAdmin ? [{ href: "/admin", label: tUser("admin") }] : []),
      ]
    : [
        { href: "/login", label: t("signIn") },
        { href: "/register", label: t("register") },
      ];

  return (
    <header className="sticky top-0 z-40 border-b border-wl-border bg-wl-chrome text-wl-on-chrome">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-wl-surface focus:px-4 focus:py-2 focus:text-wl-ink"
      >
        {tCommon("skipToContent")}
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />

        <nav aria-label={tCommon("mainNavigation")} className="hidden items-center gap-1 md:flex">
          {primaryNav.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-1 md:flex">
          <LanguageSwitcher />
          {profile ? (
            <UserMenu name={profile.org_name ?? profile.display_name} isAdmin={profile.isAdmin} />
          ) : (
            <>
              <Link href="/login" className={linkClass}>
                {t("signIn")}
              </Link>
              <Link
                href="/register"
                className="ml-1 inline-flex min-h-11 items-center rounded-full bg-wl-primary px-5 text-sm text-wl-on-primary transition-colors hover:bg-wl-primary-dark"
              >
                {t("register")}
              </Link>
            </>
          )}
        </div>

        <MobileNav
          items={[...primaryNav, ...mobileAccountNav]}
          signedIn={profile !== null}
          openLabel={tCommon("openMenu")}
          closeLabel={tCommon("closeMenu")}
          title={tCommon("mainNavigation")}
          signOutLabel={tUser("signOut")}
        />
      </div>
    </header>
  );
}
