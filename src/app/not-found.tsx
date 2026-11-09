import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteShell } from "@/components/layout/site-shell";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <SiteShell>
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-20 text-center">
        <p className="text-5xl font-medium text-wl-ink-muted" aria-hidden>
          404
        </p>
        <h1 className="text-2xl font-medium">{t("errors.notFoundTitle")}</h1>
        <p className="text-wl-ink-soft">{t("errors.notFoundBody")}</p>
        <Button asChild>
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </div>
    </SiteShell>
  );
}
