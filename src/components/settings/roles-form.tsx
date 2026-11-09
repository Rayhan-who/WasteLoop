"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { RolePicker } from "@/components/account/role-picker";
import { FormError } from "@/components/forms/form-alert";
import { Button } from "@/components/ui/button";
import { updateRolesAction } from "@/lib/actions/account";
import type { FormErrorCode } from "@/lib/actions/result";
import type { SelfServiceRole } from "@/lib/design/roles";
import { rolesSchema } from "@/lib/validation/profile";
import type { ValidationCode } from "@/lib/validation/common";

/** FR-1.2: change roles. Secondary action (outline) — the profile form owns the page's primary action. */
export function RolesForm({ initial }: { initial: SelfServiceRole[] }) {
  const t = useTranslations("settings.roles");
  const tr = useTranslations("auth.register");
  const tc = useTranslations("common");
  const [roles, setRoles] = useState<SelfServiceRole[]>(initial);
  const [saved, setSaved] = useState<SelfServiceRole[]>(initial);
  const [fieldError, setFieldError] = useState<ValidationCode | undefined>();
  const [formError, setFormError] = useState<FormErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = roles.join() !== saved.join();

  const save = () => {
    setFormError(null);
    const parsed = rolesSchema.safeParse({ roles });
    if (!parsed.success) {
      setFieldError("rolesRequired");
      return;
    }
    setFieldError(undefined);
    startTransition(async () => {
      const result = await updateRolesAction({ roles });
      if (!result.ok) {
        setFormError(result.error);
        setFieldError(result.fieldErrors?.roles);
        return;
      }
      setSaved(roles);
      toast.success(t("saved"));
    });
  };

  return (
    <div className="space-y-4">
      <FormError code={formError} />
      <RolePicker legend={tr("rolesLabel")} value={roles} onChange={setRoles} error={fieldError} disabled={pending} />
      <Button type="button" variant="outline" onClick={save} disabled={pending || !dirty}>
        {pending ? tc("saving") : t("save")}
      </Button>
    </div>
  );
}
