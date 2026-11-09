import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

/** Standalone 404: works for any page, signed in or not. */
export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh flex-col bg-wl-surface">
      <header className="px-4 py-3 sm:px-8">
        <Logo />
      </header>
      <main id="main" className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-16 text-center">
        <p className="text-6xl font-medium text-wl-ink-muted" aria-hidden>
          404
        </p>
        <h1 className="text-2xl font-medium">{t("errors.notFoundTitle")}</h1>
        <p className="max-w-md text-wl-ink-soft">{t("errors.notFoundBody")}</p>
        <Button asChild size="lg" className="h-12 rounded-full px-6">
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </main>
    </div>
  );
}
