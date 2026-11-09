"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Shared body for every route group's error.tsx (§4.3 reliability): a failure
 * in one segment degrades to this panel instead of taking down the app.
 */
export function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : undefined;

  return (
    <div role="alert" className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
      <TriangleAlert aria-hidden className="size-10 text-wl-danger" />
      <h1 className="text-2xl font-medium">{t("errors.genericTitle")}</h1>
      <p className="text-wl-ink-soft">{t("errors.genericBody")}</p>
      {digest ? <p className="text-xs text-wl-ink-muted">{t("errors.reference", { digest })}</p> : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>{t("common.retry")}</Button>
        <Button variant="outline" asChild>
          <Link href="/">{t("common.backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
