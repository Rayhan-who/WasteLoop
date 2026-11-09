"use client";

import { forwardRef, useId, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { ValidationCode } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

type BaseProps = {
  label: ReactNode;
  hint?: ReactNode;
  /** Validation code; rendered as `validation.<code>` in the active locale. */
  error?: ValidationCode | string;
  optional?: boolean;
  multiline?: boolean;
  className?: string;
};

type TextFieldProps = BaseProps & Omit<ComponentProps<"input">, "className"> & Omit<ComponentProps<"textarea">, "className">;

/**
 * Labelled input with hint and error. Accessibility (§7): the label is tied
 * to the control, the hint and error are linked by aria-describedby, the
 * error is announced via aria-live, and aria-invalid marks the field.
 */
export const TextField = forwardRef<HTMLInputElement & HTMLTextAreaElement, TextFieldProps>(function TextField(
  { label, hint, error, optional, multiline, className, id, ...props },
  ref,
) {
  const t = useTranslations();
  const autoId = useId();
  const fieldId = id ?? autoId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const errorKey = `validation.${error}` as "validation.invalid";
  const errorText = error ? (t.has(errorKey) ? t(errorKey) : t("validation.invalid")) : null;

  const shared = {
    id: fieldId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    ...props,
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fieldId} className="text-sm font-medium text-wl-ink">
        {label}
        {optional ? <span className="font-normal text-wl-ink-muted"> ({t("common.optional")})</span> : null}
      </Label>
      {multiline ? (
        <Textarea ref={ref} rows={3} className="bg-wl-surface text-base" {...shared} />
      ) : (
        <Input ref={ref} className="bg-wl-surface text-base" {...shared} />
      )}
      {hint ? (
        <p id={hintId} className="text-sm text-wl-ink-soft">
          {hint}
        </p>
      ) : null}
      <p id={errorId} aria-live="polite" className="min-h-0 text-sm text-wl-danger">
        {errorText}
      </p>
    </div>
  );
});
