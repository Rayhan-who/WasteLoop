import "server-only";
import { requiredEnv } from "./env";

/** Server-only secrets. Importing this from a client component fails the build. */
export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return requiredEnv("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get cronSecret(): string {
    return requiredEnv("CRON_SECRET", process.env.CRON_SECRET);
  },
  get paymentProvider(): string {
    return process.env.PAYMENT_PROVIDER ?? "mock";
  },
  get notificationDispatcher(): string {
    return process.env.NOTIFICATION_DISPATCHER ?? "console";
  },
  get nominatimUserAgent(): string {
    return process.env.NOMINATIM_USER_AGENT ?? "WasteLoop/0.1";
  },
};
