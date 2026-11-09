"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { ROLE_ICONS, type SelfServiceRole } from "@/lib/design/roles";
import { SELF_SERVICE_ROLES } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Multi-select of self-service roles (FR-1.2) as large checkbox cards.
 * Native checkboxes inside a fieldset keep it keyboard- and screen-reader-friendly.
 */
export function RolePicker({
  value,
  onChange,
  legend,
  hint,
  error,
  disabled,
}: {
  value: readonly SelfServiceRole[];
  onChange: (next: SelfServiceRole[]) => void;
  legend: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const toggle = (role: SelfServiceRole, checked: boolean) => {
    const next = checked ? [...new Set([...value, role])] : value.filter((r) => r !== role);
    // Keep the canonical order so diffs and display are stable.
    onChange(SELF_SERVICE_ROLES.filter((r) => next.includes(r)));
  };

  return (
    <fieldset
      aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
      disabled={disabled}
      className="space-y-2"
    >
      <legend className="text-sm font-medium text-wl-ink">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-sm text-wl-ink-soft">
          {hint}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {SELF_SERVICE_ROLES.map((role) => {
          const Icon = ROLE_ICONS[role];
          const checked = value.includes(role);
          return (
            <label
              key={role}
              className={cn(
                "flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border bg-wl-surface p-3 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-wl-primary",
                checked ? "border-wl-primary bg-wl-primary-tint" : "border-wl-border hover:border-wl-grey-300",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={checked}
                onChange={(e) => toggle(role, e.target.checked)}
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
                  checked ? "border-wl-primary bg-wl-primary text-wl-on-primary" : "border-wl-grey-300 bg-wl-surface",
                )}
              >
                {checked ? <Check className="size-3.5" /> : null}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1.5 font-medium text-wl-ink">
                  <Icon aria-hidden className="size-4 text-wl-ink-soft" />
                  {t(`roles.${role}`)}
                </span>
                <span className="text-sm text-wl-ink-soft">{t(`roleDescriptions.${role}`)}</span>
              </span>
            </label>
          );
        })}
      </div>
      <p id={errorId} aria-live="polite" className="text-sm text-wl-danger">
        {error ? t(`validation.${error}` as "validation.rolesRequired") : null}
      </p>
    </fieldset>
  );
}
