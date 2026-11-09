import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

export function Logo() {
  const t = useTranslations("common");
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-md text-lg font-medium text-wl-on-chrome">
      <RefreshCcw aria-hidden className="size-5 text-wl-primary-tint" />
      <span lang="en">{t("appName")}</span>
    </Link>
  );
}
