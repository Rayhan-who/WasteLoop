import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentProfile } from "@/lib/profile";
import { LOGIN_PATH } from "@/lib/routes";

/**
 * (app): signed-in users only. The proxy already redirects anonymous
 * visitors; this server-side check is the second line of defence, since a
 * proxy must never be the only authorisation layer.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect(LOGIN_PATH);
  return <AppShell profile={profile}>{children}</AppShell>;
}
