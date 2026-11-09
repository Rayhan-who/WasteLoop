import { AppShell } from "@/components/app-shell/app-shell";
import { SiteShell } from "@/components/layout/site-shell";
import { getCurrentProfile } from "@/lib/profile";

/**
 * (market): the marketplace and listing pages, readable without signing in.
 * Signed-in users see them inside the app shell; visitors get the public
 * header and footer.
 */
export default async function MarketLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  return profile ? <AppShell profile={profile}>{children}</AppShell> : <SiteShell>{children}</SiteShell>;
}
