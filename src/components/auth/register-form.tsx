"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { RolePicker } from "@/components/account/role-picker";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { registerAction } from "@/lib/actions/auth";
import type { FormErrorCode } from "@/lib/actions/result";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

/** FR-1.1 registration with FR-1.2 role selection. */
export function RegisterForm() {
  const t = useTranslations("auth.register");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: "",
      orgName: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      roles: [],
      locale,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await registerAction(values);
      if (!result) return; // redirected (session created immediately)
      if (!result.ok) {
        setFormError(result.error);
        applyServerErrors(form, result);
        return;
      }
      if (result.data.needsConfirmation) setSentTo(values.email);
    });
  });

  if (sentTo) {
    return (
      <div role="status" className="space-y-3 text-center">
        <MailCheck aria-hidden className="mx-auto size-10 text-wl-ink" />
        <h3 className="text-xl font-medium">{t("checkEmailTitle")}</h3>
        <p className="text-wl-ink-soft">{t("checkEmailBody", { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError code={formError} />
      <div className="grid gap-4">
        <TextField appearance="pill" label={t("displayName")} autoComplete="name" error={errors.displayName?.message} {...form.register("displayName")} />
        <TextField
          appearance="pill"
          label={t("orgNameShort")}
          autoComplete="organization"
          error={errors.orgName?.message}
          {...form.register("orgName")}
        />
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
          label={t("phoneShort")}
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          error={errors.phone?.message}
          {...form.register("phone")}
        />
        <TextField
          appearance="pill"
          label={t("password")}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...form.register("password")}
        />
        <TextField
          appearance="pill"
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...form.register("confirmPassword")}
        />
      </div>
      <Controller
        control={form.control}
        name="roles"
        render={({ field }) => (
          <RolePicker
            legend={t("rolesLabel")}
            hint={t("rolesHint")}
            value={field.value ?? []}
            onChange={field.onChange}
            error={errors.roles?.message}
          />
        )}
      />
      <div className="flex justify-center pt-1">
        <Button type="submit" size="lg" className="h-12 min-w-56 rounded-full text-base tracking-[0.15em] uppercase" disabled={pending}>
          {pending ? tc("loading") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
