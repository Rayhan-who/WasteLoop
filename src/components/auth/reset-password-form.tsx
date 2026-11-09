"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "@/lib/actions/auth";
import type { FormErrorCode } from "@/lib/actions/result";
import { AFTER_LOGIN_PATH } from "@/lib/routes";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";

export function ResetPasswordForm() {
  const t = useTranslations("auth.reset");
  const tc = useTranslations("common");
  const router = useRouter();
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await resetPasswordAction(values);
      if (!result.ok) {
        setFormError(result.error);
        applyServerErrors(form, result);
        return;
      }
      toast.success(t("success"));
      router.push(AFTER_LOGIN_PATH);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormError code={formError} />
      <TextField
        label={t("password")}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...form.register("password")}
      />
      <TextField
        label={t("confirmPassword")}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? tc("saving") : t("submit")}
      </Button>
    </form>
  );
}
