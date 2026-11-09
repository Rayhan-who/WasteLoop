import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/lib/auth";

/**
 * (admin): administrators only. The proxy redirects anonymous visitors; this
 * layout checks the role with is_admin() before anything renders. The admin
 * navigation shell is built with the admin pages in milestone 11.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  await requireAdmin();
  return <SiteShell>{children}</SiteShell>;
}
