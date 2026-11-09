/** IDs from supabase/seed.sql, named for readability in tests. */
export const U = {
  admin: "00000000-0000-4000-a000-000000000001",
  shapla: "00000000-0000-4000-a000-000000000101", // provider
  nirob: "00000000-0000-4000-a000-000000000102", // provider
  utsob: "00000000-0000-4000-a000-000000000103", // provider
  sobuj: "00000000-0000-4000-a000-000000000201", // farmer
  biopower: "00000000-0000-4000-a000-000000000202", // energy plant
  purnota: "00000000-0000-4000-a000-000000000203", // recycler
  annadan: "00000000-0000-4000-a000-000000000204", // charity + provider
} as const;

export const L = {
  /** Shapla · free edible food · available · Annadan has a PENDING request. */
  lunchBuffet: "10000000-0000-4000-a000-000000000001",
  /** Shapla · for_sale PET · reserved · Purnota's request ACCEPTED, pickup tomorrow. */
  petBottles: "10000000-0000-4000-a000-000000000005",
  /** Shapla · free · collected (completed exchange with Annadan). */
  iftarSurplus: "10000000-0000-4000-a000-000000000006",
  /** Nirob · draft. */
  dairyDraft: "10000000-0000-4000-a000-000000000011",
  /** Nirob · for_sale · collected and paid. */
  hdpeSold: "10000000-0000-4000-a000-000000000012",
} as const;

export const R = {
  /** Annadan → lunchBuffet, pending. */
  lunchPending: "20000000-0000-4000-a000-000000000001",
  /** Purnota → petBottles, accepted, with messages. */
  petAccepted: "20000000-0000-4000-a000-000000000005",
  /** Annadan → iftarSurplus, accepted, pickup completed. */
  iftarDone: "20000000-0000-4000-a000-000000000006",
} as const;
