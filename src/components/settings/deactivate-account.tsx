"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { FormError } from "@/components/forms/form-alert";
import { TextField } from "@/components/forms/text-field";
import { applyServerErrors } from "@/components/forms/apply-server-errors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deactivateAccountAction } from "@/lib/actions/account";
import type { FormErrorCode } from "@/lib/actions/result";
import { DEACTIVATE_CONFIRM_WORDS, deactivateSchema, type DeactivateInput } from "@/lib/validation/profile";

/** Deactivate account, optionally requesting data removal. Destructive, so it sits behind a typed confirmation. */
export function DeactivateAccount() {
  const t = useTranslations("settings.account");
  const tc = useTranslations("common");
  const locale = useLocale();
  const word = locale === "bn" ? DEACTIVATE_CONFIRM_WORDS[1] : DEACTIVATE_CONFIRM_WORDS[0];
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm<DeactivateInput>({
    resolver: zodResolver(deactivateSchema),
    defaultValues: { confirmation: "", requestDataRemoval: false, reason: "" },
  });
  const { errors } = form.formState;
  const requestRemoval = useWatch({ control: form.control, name: "requestDataRemoval" });

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await deactivateAccountAction(values);
      // Success signs out and redirects.
      if (result && !result.ok) {
        setFormError(result.fieldErrors?.confirmation ? null : result.error);
        applyServerErrors(form, result);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">{t("deactivate")}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc("close")} className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogBody")}</DialogDescription>
          </DialogHeader>
          <FormError code={formError} />
          <TextField
            label={t("confirmLabel", { word })}
            autoComplete="off"
            error={errors.confirmation?.message}
            {...form.register("confirmation")}
          />
          <label className="flex min-h-11 cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-1 size-5 accent-wl-danger" {...form.register("requestDataRemoval")} />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t("requestRemoval")}</span>
              <span className="block text-sm text-wl-ink-soft">{t("requestRemovalHint")}</span>
            </span>
          </label>
          {requestRemoval ? (
            <TextField label={t("reason")} multiline error={errors.reason?.message} {...form.register("reason")} />
          ) : null}
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={pending}
              className="bg-wl-danger text-wl-on-chrome hover:bg-wl-danger/90"
            >
              {pending ? tc("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
