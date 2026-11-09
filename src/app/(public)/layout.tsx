import { SiteShell } from "@/components/layout/site-shell";

/** (public): readable without signing in — landing, browse, listing detail, auth pages. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <SiteShell>{children}</SiteShell>;
}
