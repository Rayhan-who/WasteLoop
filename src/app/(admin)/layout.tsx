import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { requireAdmin } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/profile";

/**
 * (admin): administrators only. The proxy redirects anonymous visitors; this
 * layout checks the role with is_admin() before anything renders. Admin
 * navigation is added with the admin pages in milestone 11.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();
  const profile = await getCurrentProfile();
  if (!profile) notFound();
  return <AppShell profile={profile}>{children}</AppShell>;
}
