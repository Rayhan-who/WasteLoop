import { z } from "zod";
import { LISTING_OFFER_TYPES, QUANTITY_UNITS, WASTE_TYPES } from "@/lib/domain";
import { isInBangladesh } from "@/lib/geo/bounds";
import { msg, optionalText, requiredText } from "./common";

export const MAX_PHOTOS = 6;
export const MAX_WINDOW_DAYS = 60;

/** A timestamp string the JS Date parser understands (ISO from the server action, local from the form). */
const timestamp = z
  .string(msg("required"))
  .min(1, msg("required"))
  .refine((v) => !Number.isNaN(Date.parse(v)), msg("invalid"));

/**
 * The listing form (FR-3.1–3.4), shared by the wizard (client) and the
 * create/update Server Actions (server). The client converts the
 * datetime-local values to ISO strings with the user's offset before sending.
 */
export const listingSchema = z
  .object({
    // Step 1 — what it is
    wasteType: z.enum(WASTE_TYPES, msg("required")),
    title: requiredText(120, 3),
    description: optionalText(2000),
    quantityValue: z.number(msg("quantityInvalid")).positive(msg("quantityInvalid")).max(100_000, msg("quantityInvalid")),
    quantityUnit: z.enum(QUANTITY_UNITS, msg("required")),
    photoPaths: z.array(z.string().min(1).max(300)).max(MAX_PHOTOS, msg("tooManyPhotos")),
    // Step 2 — where and when
    pickupAreaLabel: requiredText(120, 2),
    pickupAddressExact: requiredText(500, 3),
    pickupLat: z.number(msg("locationRequired")),
    pickupLng: z.number(msg("locationRequired")),
    availableFrom: timestamp,
    availableUntil: timestamp,
    // Step 3 — how it's offered
    offerType: z.enum(LISTING_OFFER_TYPES, msg("required")),
    priceAmount: z.number(msg("priceInvalid")).positive(msg("priceInvalid")).max(10_000_000, msg("priceInvalid")).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!isInBangladesh({ lat: v.pickupLat, lng: v.pickupLng })) {
      ctx.addIssue({ code: "custom", path: ["pickupLat"], ...msg("outsideBangladesh") });
    }
    const from = Date.parse(v.availableFrom);
    const until = Date.parse(v.availableUntil);
    if (!Number.isNaN(from) && !Number.isNaN(until)) {
      if (until <= from) ctx.addIssue({ code: "custom", path: ["availableUntil"], ...msg("windowInvalid") });
      else if (until <= Date.now()) ctx.addIssue({ code: "custom", path: ["availableUntil"], ...msg("windowPast") });
      else if (until - from > MAX_WINDOW_DAYS * 86_400_000)
        ctx.addIssue({ code: "custom", path: ["availableUntil"], ...msg("windowTooLong") });
    }
    // FR-7.3: only for-sale listings carry a price (the DB enforces this too).
    if (v.offerType === "for_sale" && (v.priceAmount === null || v.priceAmount === undefined)) {
      ctx.addIssue({ code: "custom", path: ["priceAmount"], ...msg("priceRequired") });
    }
  })
  .transform((v) => ({ ...v, priceAmount: v.offerType === "for_sale" ? (v.priceAmount ?? null) : null }));

export type ListingInput = z.input<typeof listingSchema>;
export type ListingData = z.output<typeof listingSchema>;

/** Which fields each wizard step validates before moving on. */
export const LISTING_STEP_FIELDS = [
  ["wasteType", "title", "description", "quantityValue", "quantityUnit", "photoPaths"],
  ["pickupAreaLabel", "pickupAddressExact", "pickupLat", "pickupLng", "availableFrom", "availableUntil"],
  ["offerType", "priceAmount"],
] as const satisfies readonly (readonly (keyof ListingInput)[])[];
