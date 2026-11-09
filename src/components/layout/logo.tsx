import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * The WasteLoop mark: a ring split into a green half and a burgundy half that
 * pinch together at the top and bottom (the "loop"). Drawn as two
 * semicircles so it stays crisp at any size. Same shape as src/app/icon.svg.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={cn("size-8 shrink-0", className)}>
      <path d="M22.5 9 A15 15 0 0 0 22.5 39" fill="none" stroke="var(--wl-brand-green)" strokeWidth="7" strokeLinecap="round" />
      <path d="M25.5 9 A15 15 0 0 1 25.5 39" fill="none" stroke="var(--wl-brand-burgundy)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + wordmark, linking home. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  const t = useTranslations("common");
  return (
    <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2 rounded-md text-lg font-medium text-wl-ink", className)}>
      <LogoMark className="size-7" />
      <span lang="en" className="tracking-tight">
        {t("appName")}
      </span>
    </Link>
  );
}
