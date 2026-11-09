/**
 * Public (browser-safe) environment. Server-only secrets live in
 * src/lib/env.server.ts so they can never be bundled into client code.
 *
 * Values are read lazily so `next build` succeeds without a .env.local; a
 * missing value fails loudly at the first request that needs it instead.
 */
export function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local (or set it in Vercel) and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  // NEXT_PUBLIC_* must be referenced literally so Next can inline them into the browser bundle.
  get supabaseUrl(): string {
    return requiredEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey(): string {
    return requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get siteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  },
};
