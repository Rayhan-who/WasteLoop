"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/locale";
import { LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Header language switcher (SRS §4.7). Shows the *other* language, written
 * in that language, so a reader of either script can find it.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale();
  const target: Locale = LOCALES.find((l) => l !== current) ?? "en";
  const [isPending, startTransition] = useTransition();
  const targetName = t(`languageNames.${target}`);

  return (
    <button
      type="button"
      onClick={() => startTransition(() => setLocale(target))}
      disabled={isPending}
      aria-label={t("switchLanguage", { language: targetName })}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-wl-on-chrome-dim transition-colors hover:text-wl-on-chrome disabled:opacity-60",
        className,
      )}
    >
      <Languages aria-hidden className="size-4" />
      <span lang={target}>{targetName}</span>
    </button>
  );
}
