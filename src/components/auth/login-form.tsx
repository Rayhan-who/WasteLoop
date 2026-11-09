"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { loginAction } from "@/lib/actions/auth";
import type { FormErrorCode } from "@/lib/actions/result";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth.login");
  const tc = useTranslations("common");
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: true, next },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await loginAction(values);
      // On success the action redirects, so only failures return here.
      if (result && !result.ok) {
        setFormError(result.error);
        applyServerErrors(form, result);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError code={formError} />
      <TextField
        appearance="pill"
        label={t("email")}
        type="email"
        autoComplete="email"
        inputMode="email"
        error={errors.email?.message}
        {...form.register("email")}
      />
      <TextField
        appearance="pill"
        label={t("password")}
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...form.register("password")}
      />
      <div className="flex justify-center pt-1">
        <Button type="submit" size="lg" className="h-12 w-48 rounded-full text-base tracking-[0.15em] uppercase" disabled={pending}>
          {pending ? tc("loading") : t("submit")}
        </Button>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 text-sm text-wl-ink-soft">
        <input type="checkbox" className="size-4 accent-wl-ink" {...form.register("remember")} />
        {t("remember")}
      </label>
    </form>
  );
}
