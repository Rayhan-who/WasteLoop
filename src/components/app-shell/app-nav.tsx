"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { APP_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavProps = {
  /** Labels of the items this user may see (computed on the server from roles). */
  items: (typeof APP_NAV)[number]["label"][];
  unread: number;
};

function useNav(items: NavProps["items"]) {
  const pathname = usePathname();
  return APP_NAV.filter((i) => items.includes(i.label)).map((i) => ({ ...i, active: i.match.test(pathname) }));
}

function UnreadDot({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={cn(
        "absolute flex min-w-4 items-center justify-center rounded-full bg-wl-danger px-1 text-[10px] leading-4 font-medium text-wl-on-inverse",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Desktop sidebar (md and up). */
export function SidebarNav({ items, unread }: NavProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const nav = useNav(items);

  return (
    <nav aria-label={tCommon("mainNavigation")} className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 flex-col gap-1 border-r border-wl-border bg-wl-surface p-3 md:flex">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
            item.active ? "bg-wl-inverse text-wl-on-inverse" : "text-wl-ink-soft hover:bg-wl-chrome-soft hover:text-wl-ink",
          )}
        >
          <item.icon aria-hidden className="size-5" />
          {t(item.label)}
          {item.label === "notifications" ? <UnreadDot count={unread} className="static ml-auto" /> : null}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile bottom tab bar (below md), like a native app. */
export function BottomTabs({ items, unread }: NavProps) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tabs = useNav(items)
    .filter((i) => i.tab)
    .slice(0, 5);

  return (
    <nav
      aria-label={tCommon("mainNavigation")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-wl-border bg-wl-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-xs",
                item.active ? "font-medium text-wl-ink" : "text-wl-ink-muted",
              )}
            >
              <span className="relative">
                <item.icon aria-hidden className={cn("size-6", item.active && "stroke-[2.25]")} />
                {item.label === "notifications" ? <UnreadDot count={unread} className="-top-1.5 -right-2.5" /> : null}
              </span>
              {t(item.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
