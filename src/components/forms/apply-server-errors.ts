import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { ActionFailure } from "@/lib/actions/result";

/**
 * Copy field errors returned by a Server Action onto a react-hook-form form,
 * so server-side validation (the authority) shows next to the right field,
 * and focus the first one.
 */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, result: ActionFailure): void {
  const entries = Object.entries(result.fieldErrors ?? {});
  entries.forEach(([field, code], i) => {
    if (!code || field === "_form") return;
    form.setError(field as Path<T>, { type: "server", message: code }, { shouldFocus: i === 0 });
  });
}
