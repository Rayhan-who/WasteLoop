import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageBanner } from "@/components/app-shell/page-banner";
import { isLinkReady } from "@/lib/nav";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("nav"))("notifications") };
}

/**
 * In-app notifications inbox, newest first (FR-9.x). Milestone 9 adds live
 * updates, mark-as-read and per-channel preferences.
 */
export default async function NotificationsPage() {
  const [t, format, user, supabase] = await Promise.all([getTranslations("notifications"), getFormatter(), getCurrentUser(), createClient()]);
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link_url, read_at, created_at")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(50);
  const items = data ?? [];
  const now = new Date();

  return (
    <>
      <PageBanner title={t("title")} />
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-wl-grey-200 bg-wl-surface px-6 py-16 text-center">
            <BellOff aria-hidden className="size-10 text-wl-ink-muted" />
            <p className="text-wl-ink-soft">{t("empty")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-wl-border overflow-hidden rounded-2xl border border-wl-border bg-wl-surface">
            {items.map((n) => {
              const body = (
                <div className="flex gap-3 p-4">
                  <span
                    aria-hidden
                    className={cn("mt-2 size-2.5 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-wl-danger")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-wl-ink", !n.read_at && "font-medium")}>
                      {!n.read_at ? <span className="sr-only">{t("unread")} </span> : null}
                      {n.title}
                    </p>
                    {n.body ? <p className="text-sm text-wl-ink-soft">{n.body}</p> : null}
                    <p className="mt-1 text-xs text-wl-ink-muted">{format.relativeTime(new Date(n.created_at), now)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.link_url && isLinkReady(n.link_url) ? (
                    <Link href={n.link_url} className="block hover:bg-wl-chrome-soft">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
