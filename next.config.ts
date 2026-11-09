import path from "node:path";
import type { NextConfig } from "next";

/**
 * next-intl request config location.
 *
 * Decision (README → Decisions): we set the `next-intl/config` alias directly
 * instead of wrapping with `createNextIntlPlugin`. For the features we use
 * (no message extraction, no precompiled catalogues) the plugin does exactly
 * this and nothing else, but importing it eagerly loads the native `@swc/core`
 * binary, which Windows Application Control blocks on some machines.
 */
const I18N_REQUEST_CONFIG = "./src/i18n/request.ts";

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : undefined;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Decision (README → Decisions): Cache Components is off. Nearly every
  // route depends on the Supabase session cookie and the locale cookie, so
  // request-time rendering is the simpler model for this app.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
    resolveAlias: {
      "next-intl/config": I18N_REQUEST_CONFIG,
    },
  },
  webpack(config: { context: string; resolve: { alias: Record<string, string> } }) {
    config.resolve.alias["next-intl/config"] = path.resolve(config.context, I18N_REQUEST_CONFIG);
    return config;
  },
  images: {
    // Listing photos are served from Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: supabaseHost ?? "*.supabase.co", pathname: "/storage/v1/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/**" },
    ],
  },
};

export default nextConfig;
