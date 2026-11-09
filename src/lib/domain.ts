import type { Enums } from "@/lib/supabase/database.types";

/**
 * Domain enums, mirrored 1:1 from the Postgres enums in supabase/migrations.
 * Keep these in the same order as the SQL definitions.
 */

export const USER_ROLES = ["provider", "farmer", "energy_plant", "recycler", "charity", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles a user may pick for themselves at registration (FR-1.2). Admin is granted, never chosen. */
export const SELF_SERVICE_ROLES = ["provider", "farmer", "energy_plant", "recycler", "charity"] as const;
export const TAKER_ROLES = ["farmer", "energy_plant", "recycler", "charity"] as const;

export const WASTE_TYPES = ["edible_food", "organic_compostable", "plastic_recyclable", "energy_feedstock"] as const;
export type WasteType = (typeof WASTE_TYPES)[number];

export const LISTING_OFFER_TYPES = ["free", "donation", "for_sale"] as const;
export type ListingOfferType = (typeof LISTING_OFFER_TYPES)[number];

export const LISTING_STATUSES = ["draft", "available", "reserved", "collected", "expired", "paused", "removed"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled", "withdrawn"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const PICKUP_STATUSES = ["proposed", "confirmed", "rescheduled", "completed", "cancelled"] as const;
export type PickupStatus = (typeof PICKUP_STATUSES)[number];

export const VERIFICATION_STATUSES = ["unsubmitted", "pending", "approved", "rejected", "more_info"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "email", "sms"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const QUANTITY_UNITS = ["kg", "litre", "item", "bag"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

// ---------------------------------------------------------------------------
// Compile-time guard: these unions must match the Postgres enums exactly.
// If a migration changes an enum, `npm run db:types` regenerates the types
// and `tsc` fails here until this file is updated too.
// ---------------------------------------------------------------------------
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumsMatchDatabase = [
  Assert<Equal<UserRole, Enums<"user_role">>>,
  Assert<Equal<WasteType, Enums<"waste_type">>>,
  Assert<Equal<ListingOfferType, Enums<"listing_offer_type">>>,
  Assert<Equal<ListingStatus, Enums<"listing_status">>>,
  Assert<Equal<RequestStatus, Enums<"request_status">>>,
  Assert<Equal<PickupStatus, Enums<"pickup_status">>>,
  Assert<Equal<VerificationStatus, Enums<"verification_status">>>,
  Assert<Equal<PaymentStatus, Enums<"payment_status">>>,
  Assert<Equal<NotificationChannel, Enums<"notification_channel">>>,
  Assert<Equal<QuantityUnit, Enums<"quantity_unit">>>,
];
