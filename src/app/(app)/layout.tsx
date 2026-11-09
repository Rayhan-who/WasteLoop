import { redirect } from "next/navigation";
import { SiteShell } from "@/components/layout/site-shell";
import { LOGIN_PATH } from "@/lib/routes";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * (app): signed-in users only. The proxy already redirects anonymous
 * visitors; this server-side check is the second line of defence, since a
 * proxy must never be the only authorisation layer.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);

  return <SiteShell>{children}</SiteShell>;
}
