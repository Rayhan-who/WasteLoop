"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FormErrorCode } from "@/lib/actions/result";
import { cn } from "@/lib/utils";

/** Form-level error, announced to screen readers. Renders nothing without an error. */
export function FormError({ code, className }: { code?: FormErrorCode | null; className?: string }) {
  const t = useTranslations("formErrors");
  return (
    <div aria-live="assertive" className={className}>
      {code ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-wl-danger bg-wl-surface p-3 text-sm text-wl-danger">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t(code)}
        </p>
      ) : null}
    </div>
  );
}

/** Neutral or success notice at the top of a page or form. */
export function Notice({
  children,
  tone = "info",
  className,
}: {
  children: React.ReactNode;
  tone?: "info" | "success";
  className?: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "success" ? "border-transparent bg-wl-primary-tint text-wl-primary" : "border-wl-border bg-wl-surface text-wl-ink",
        className,
      )}
    >
      <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
