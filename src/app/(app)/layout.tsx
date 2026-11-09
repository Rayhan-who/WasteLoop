import { SiteShell } from "@/components/layout/site-shell";
import { requireUser } from "@/lib/auth";

/**
 * (app): signed-in users only. The proxy already redirects anonymous
 * visitors; this server-side check is the second line of defence, since a
 * proxy must never be the only authorisation layer.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUser();
  return <SiteShell>{children}</SiteShell>;
}
