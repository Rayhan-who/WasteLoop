import { Bell, House, LayoutGrid, Leaf, PackagePlus, Send, Settings, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/domain";

/**
 * Signed-in navigation: the desktop sidebar and the mobile bottom tab bar.
 *
 * `ready` hides an entry until its page exists, so navigation never leads to
 * "page not found". Each later milestone flips its entry on:
 *   new listing → milestone 4, requests → 6, impact → 10.
 */
export type AppNavItem = {
  href: string;
  /** Key under the `nav` message namespace. */
  label: "home" | "marketplace" | "postListing" | "requests" | "impact" | "notifications" | "settings";
  icon: LucideIcon;
  ready: boolean;
  /** Show only to users holding one of these roles. */
  roles?: readonly UserRole[];
  /** Include in the mobile bottom tab bar (max 5). */
  tab: boolean;
  /** Which paths mark this item as current. */
  match: RegExp;
};

export const APP_NAV: readonly AppNavItem[] = [
  { href: "/dashboard", label: "home", icon: House, ready: true, tab: true, match: /^\/dashboard/ },
  { href: "/marketplace", label: "marketplace", icon: LayoutGrid, ready: true, tab: true, match: /^\/(marketplace|browse|listings\/(?!new))/ },
  { href: "/listings/new", label: "postListing", icon: PackagePlus, ready: false, roles: ["provider"], tab: true, match: /^\/listings\/new/ },
  { href: "/requests", label: "requests", icon: Send, ready: false, tab: true, match: /^\/requests/ },
  { href: "/impact", label: "impact", icon: Leaf, ready: false, tab: false, match: /^\/impact/ },
  { href: "/notifications", label: "notifications", icon: Bell, ready: true, tab: true, match: /^\/notifications/ },
  { href: "/settings", label: "settings", icon: Settings, ready: true, tab: true, match: /^\/settings/ },
];

/** Entries visible to a user with these roles. */
export function navFor(roles: readonly UserRole[]): AppNavItem[] {
  return APP_NAV.filter((i) => i.ready && (!i.roles || i.roles.some((r) => roles.includes(r))));
}

/** False for links into a section whose page is not built yet (so we never link to a 404). */
export function isLinkReady(path: string): boolean {
  const item = APP_NAV.find((i) => i.match.test(path));
  return item ? item.ready : true;
}
