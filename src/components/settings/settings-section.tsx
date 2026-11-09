import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsSection({
  id,
  title,
  description,
  children,
  tone = "default",
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn(
        "grid gap-6 rounded-xl border bg-wl-surface p-5 md:grid-cols-[1fr_2fr] md:p-6",
        tone === "danger" ? "border-wl-danger/40" : "border-wl-border",
      )}
    >
      <div className="space-y-1">
        <h2 id={id} className={cn("text-lg font-medium", tone === "danger" && "text-wl-danger")}>
          {title}
        </h2>
        {description ? <p className="text-sm text-wl-ink-soft">{description}</p> : null}
      </div>
      <div>{children}</div>
    </section>
  );
}
