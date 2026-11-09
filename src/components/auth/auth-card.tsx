import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The auth card from the design: a solid black header band with a rounded
 * lower edge and an uppercase title, a white body, and links underneath.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  below,
  wide,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered under the card, e.g. "Forgot password?" / "Not a member?". */
  below?: ReactNode;
  /** Register needs more room for the role cards. */
  wide?: boolean;
}) {
  return (
    <div className={cn("w-full", wide ? "max-w-lg" : "max-w-sm")}>
      <div className="overflow-hidden rounded-[2rem] border border-wl-border bg-wl-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)]">
        <div className="rounded-b-[2rem] bg-wl-inverse px-6 pt-9 pb-8 text-center text-wl-on-inverse">
          <h2 className="text-xl font-medium tracking-[0.12em] uppercase">{title}</h2>
          {subtitle ? <p className="mt-2 text-sm text-wl-on-inverse-dim">{subtitle}</p> : null}
        </div>
        <div className="px-6 pt-7 pb-8 sm:px-8">{children}</div>
      </div>
      {below ? <div className="mt-6 space-y-3 text-center text-sm text-wl-ink-soft">{below}</div> : null}
    </div>
  );
}
