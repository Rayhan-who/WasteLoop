import { Factory, HeartHandshake, Recycle, Store, Tractor, type LucideIcon } from "lucide-react";
import type { SELF_SERVICE_ROLES } from "@/lib/domain";

export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

/** Icons for the self-service roles (registration, settings, profile chips). */
export const ROLE_ICONS: Record<SelfServiceRole, LucideIcon> = {
  provider: Store,
  farmer: Tractor,
  energy_plant: Factory,
  recycler: Recycle,
  charity: HeartHandshake,
};
