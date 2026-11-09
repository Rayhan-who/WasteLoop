import { Flame, Recycle, Sprout, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { WasteType } from "@/lib/domain";

/**
 * The ONE place stream colours are defined (Build Prompt §7.5, rule 5).
 * The stream chip, map pin and filter control all read from this record;
 * no stream colour may be written inline anywhere else.
 *
 * Rules encoded here:
 *  - Stream colours are chips, never fills: a pale `tint` background with the
 *    family's `text` colour, plus a small icon in the saturated `iconColor`.
 *  - Never colour alone: every stream has an icon, a text label, and a map-pin
 *    letter, so the four streams stay distinguishable under colour blindness.
 *
 * Class strings are complete literals so Tailwind can detect them.
 */
export type WasteStreamStyle = {
  /** Chip background (pale tint). */
  tint: string;
  /** Text colour for anything sitting on the tint. */
  text: string;
  /** Saturated hue, for the 14–16px icon only. */
  iconColor: string;
  /** CSS variable of the saturated hue, for Leaflet pins drawn outside Tailwind. */
  hueVar: string;
  /** CSS variable of the tint, for Leaflet pins. */
  tintVar: string;
  icon: LucideIcon;
  /** Letter drawn inside the map pin. Same letter in both languages so the legend is stable. */
  pinLetter: string;
  /** next-intl key under the `streams` namespace. */
  label: WasteType;
};

export const WASTE_STREAM_STYLES: Record<WasteType, WasteStreamStyle> = {
  edible_food: {
    tint: "bg-wl-food-tint",
    text: "text-wl-food-text",
    iconColor: "text-wl-food",
    hueVar: "var(--wl-food)",
    tintVar: "var(--wl-food-tint)",
    icon: UtensilsCrossed,
    pinLetter: "F",
    label: "edible_food",
  },
  organic_compostable: {
    tint: "bg-wl-compost-tint",
    text: "text-wl-compost-text",
    iconColor: "text-wl-compost",
    hueVar: "var(--wl-compost)",
    tintVar: "var(--wl-compost-tint)",
    icon: Sprout,
    pinLetter: "C",
    label: "organic_compostable",
  },
  plastic_recyclable: {
    tint: "bg-wl-recycle-tint",
    text: "text-wl-recycle-text",
    iconColor: "text-wl-recycle",
    hueVar: "var(--wl-recycle)",
    tintVar: "var(--wl-recycle-tint)",
    icon: Recycle,
    pinLetter: "R",
    label: "plastic_recyclable",
  },
  energy_feedstock: {
    tint: "bg-wl-energy-tint",
    text: "text-wl-energy-text",
    iconColor: "text-wl-energy",
    hueVar: "var(--wl-energy)",
    tintVar: "var(--wl-energy-tint)",
    icon: Flame,
    pinLetter: "E",
    label: "energy_feedstock",
  },
};
