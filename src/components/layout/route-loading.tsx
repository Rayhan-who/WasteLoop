import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

/** Shared body for every route group's loading.tsx. */
export function RouteLoading() {
  const t = useTranslations("common");
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-10" aria-busy="true">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <Skeleton className="h-8 w-1/3 bg-wl-grey-100" />
      <Skeleton className="h-4 w-2/3 bg-wl-grey-100" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 bg-wl-grey-100" />
        ))}
      </div>
    </div>
  );
}
