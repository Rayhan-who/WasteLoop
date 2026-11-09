"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
        <MailCheck aria-hidden className="mx-auto size-10 text-wl-primary" />
        <h2 className="text-xl font-medium">{t("sentTitle")}</h2>
        <p className="text-wl-ink-soft">{t("sentBody", { email: sentTo })}</p>
        <Link href="/login" className="inline-flex min-h-11 items-center text-wl-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError code={formError} />
      <TextField
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? tc("loading") : t("submit")}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="inline-flex min-h-11 items-center text-wl-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
