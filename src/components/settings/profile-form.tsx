"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/lib/actions/account";
import type { FormErrorCode } from "@/lib/actions/result";
import { profileSchema, type ProfileInput } from "@/lib/validation/profile";

export function ProfileForm({ email, defaults }: { email: string | null; defaults: ProfileInput }) {
  const t = useTranslations("settings.profile");
  const tc = useTranslations("common");
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ProfileInput>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await updateProfileAction(values);
      if (!result.ok) {
        setFormError(result.error);
        applyServerErrors(form, result);
        return;
      }
      form.reset(values);
      toast.success(t("saved"));
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError code={formError} />
      <div className="space-y-1.5">
        <Label htmlFor="settings-email" className="text-sm font-medium">
          {t("email")}
        </Label>
        <p id="settings-email" className="text-base text-wl-ink">
          {email}
        </p>
        <p className="text-sm text-wl-ink-soft">{t("emailHint")}</p>
      </div>
      <TextField label={t("displayName")} autoComplete="name" error={errors.displayName?.message} {...form.register("displayName")} />
      <TextField label={t("orgName")} optional autoComplete="organization" error={errors.orgName?.message} {...form.register("orgName")} />
      <TextField
        label={t("phone")}
        optional
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...form.register("phone")}
      />
      <TextField
        label={t("generalLocation")}
        hint={t("generalLocationHint")}
        optional
        error={errors.generalLocation?.message}
        {...form.register("generalLocation")}
      />
      <TextField label={t("bio")} hint={t("bioHint")} optional multiline error={errors.bio?.message} {...form.register("bio")} />
      <Button type="submit" disabled={pending}>
        {pending ? tc("saving") : t("save")}
      </Button>
    </form>
  );
}
