"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction } from "@/lib/actions/auth";
import type { FormErrorCode } from "@/lib/actions/result";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const tc = useTranslations("common");
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (!result.ok) {
        setFormError(result.error);
        applyServerErrors(form, result);
        return;
      }
      setSentTo(values.email);
    });
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 text-center">
        <MailCheck aria-hidden className="mx-auto size-10 text-wl-ink" />
        <h3 className="text-xl font-medium">{t("sentTitle")}</h3>
        <p className="text-wl-ink-soft">{t("sentBody", { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <p className="text-center text-sm text-wl-ink-soft">{t("subtitle")}</p>
      <FormError code={formError} />
      <TextField
        appearance="pill"
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <div className="flex justify-center pt-1">
        <Button type="submit" size="lg" className="h-12 min-w-48 rounded-full text-base tracking-[0.1em] uppercase" disabled={pending}>
          {pending ? tc("loading") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
