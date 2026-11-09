import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { LanguageSwitcher } from "./language-switcher";
import { Logo } from "./logo";
import { MobileNav, type NavItem } from "./mobile-nav";

const linkClass =
  "inline-flex min-h-11 items-center rounded-md px-3 text-sm text-wl-on-chrome-dim transition-colors hover:text-wl-on-chrome";

/** Site header: navy chrome (§7.5). Server Component; auth state is read per request. */
export async function SiteHeader() {
  const [t, tCommon, user] = await Promise.all([getTranslations("nav"), getTranslations("common"), getCurrentUser()]);

  const primaryNav: NavItem[] = [
    { href: "/browse", label: t("browse") },
    { href: "/listings/new", label: t("postListing") },
  ];
  const accountNav: NavItem[] = user
    ? [{ href: "/dashboard", label: t("dashboard") }]
    : [
        { href: "/login", label: t("signIn") },
        { href: "/register", label: t("register") },
      ];

  return (
    <header className="sticky top-0 z-40 bg-wl-chrome text-wl-on-chrome">
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
          {accountNav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                i === accountNav.length - 1
                  ? "inline-flex min-h-11 items-center rounded-md border border-wl-chrome-soft px-4 text-sm text-wl-on-chrome transition-colors hover:bg-wl-chrome-soft"
                  : linkClass
              }
            >
              {item.label}
            </Link>
          ))}
        </div>

        <MobileNav
          items={[...primaryNav, ...accountNav]}
          openLabel={tCommon("openMenu")}
          closeLabel={tCommon("closeMenu")}
          title={tCommon("mainNavigation")}
        />
      </div>
    </header>
  );
}
