import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  // Exclude supabase/functions from webpack compilation (Deno runtime files)
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/supabase/functions/**'],
    };
    return config;
  },
  // Exclude supabase directory from TypeScript compilation
  typescript: {
    ignoreBuildErrors: false,
  },
  experimental: {
    // Turbopack configuration to exclude supabase functions
    turbo: {
      resolveAlias: {
        // Prevent resolution of Deno-specific imports
      },
    },
  },
};

export default withNextIntl(nextConfig);
