import { useTranslations } from "next-intl";
import { WASTE_STREAM_STYLES } from "@/lib/design/streams";
import type { WasteType } from "@/lib/domain";
import { cn } from "@/lib/utils";

/**
 * Waste-stream chip. Tint background + family text colour + icon + label:
 * never colour alone, never a fill (§7.5 rules 1–3, 5).
 */
export function StreamChip({ type, className }: { type: WasteType; className?: string }) {
  const t = useTranslations("streams");
  const style = WASTE_STREAM_STYLES[type];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium",
        style.tint,
        style.text,
        className,
      )}
    >
      <Icon aria-hidden className={cn("size-4 shrink-0", style.iconColor)} />
      {t(style.label)}
    </span>
  );
}
