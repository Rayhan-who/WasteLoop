"use client";

import { useSyncExternalStore, useTransition, type ReactNode } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { setLocale } from "@/app/actions/locale";
import { LOCALES } from "@/i18n/config";
import { cn } from "@/lib/utils";

type Option = { value: string; label: ReactNode; lang?: string };

/** Accessible segmented control built from native radio buttons. */
function Segmented({
  legend,
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  legend: string;
  name: string;
  value: string | undefined;
  options: Option[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            lang={o.lang}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm transition-colors",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wl-primary",
              value === o.value
                ? "border-wl-primary bg-wl-primary-tint text-wl-primary"
                : "border-wl-grey-200 bg-wl-surface text-wl-grey-700 hover:bg-wl-paper",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Language (saved to profiles.locale) and theme (light, dark, or follow the device; stored per browser). */
export function PreferencesForm() {
  const t = useTranslations("settings.preferences");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  // The theme is only known in the browser: render it unselected on the server to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div className="space-y-6">
      <Segmented
        legend={t("language")}
        name="locale"
        value={locale}
        disabled={pending}
        onChange={(v) => startTransition(() => setLocale(v))}
        options={LOCALES.map((l) => ({ value: l, label: tCommon(`languageNames.${l}`), lang: l }))}
      />
      <Segmented
        legend={t("theme")}
        name="theme"
        value={mounted ? theme : undefined}
        onChange={setTheme}
        options={[
          { value: "light", label: <><Sun aria-hidden className="size-4" />{t("themeLight")}</> },
          { value: "dark", label: <><Moon aria-hidden className="size-4" />{t("themeDark")}</> },
          { value: "system", label: <><Monitor aria-hidden className="size-4" />{t("themeSystem")}</> },
        ]}
      />
    </div>
  );
}
