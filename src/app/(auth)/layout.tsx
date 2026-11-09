import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Logo } from "@/components/layout/logo";
import truck from "@/assets/illustrations/garbage-truck.jpg";

/**
 * (auth): login, register, forgot and reset password. A full-page layout of
 * its own — no site header or footer. Desktop: illustration panel on the
 * left, card on the right. Mobile: compact illustration above the card.
 */
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const [t, tFooter] = await Promise.all([getTranslations("auth.panel"), getTranslations("footer")]);
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-wl-surface">
      <header className="flex items-center justify-between px-4 py-3 sm:px-8">
        <Logo />
        <LanguageSwitcher />
      </header>

      <main id="main" className="flex flex-1 items-center">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 pb-10 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <section aria-labelledby="auth-panel-title" className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <Image
              src={truck}
              alt={t("illustrationAlt")}
              priority
              sizes="(min-width: 1024px) 560px, 80vw"
              className="h-auto w-full max-w-xs rounded-3xl sm:max-w-sm lg:max-w-lg"
            />
            <h1 id="auth-panel-title" className="mt-4 max-w-md text-2xl font-medium tracking-tight text-wl-ink sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 hidden max-w-md text-wl-ink-soft sm:block">{t("body")}</p>
            <p className="mt-4 hidden text-xs text-wl-ink-muted lg:block">
              {t.rich("credit", {
                link: (chunks) => (
                  <a href="https://storyset.com/transport" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </section>

          <div className="flex w-full justify-center lg:justify-end">{children}</div>
        </div>
      </main>

      {/* The "connection platform only" notice (Build Prompt §0) and copyright. */}
      <footer className="border-t border-wl-border px-4 py-5 text-center text-xs leading-relaxed text-wl-ink-muted sm:px-8">
        <p className="mx-auto max-w-3xl">{tFooter("platformNotice")}</p>
        <p className="mt-1">{tFooter("copyright", { year })}</p>
      </footer>
    </div>
  );
}
