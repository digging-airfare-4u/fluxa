import type { NextConfig } from "next";
import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const supabaseHostFromEnv = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cos.ap-tokyo.myqcloud.com',
      },
      {
        protocol: 'https',
        hostname: 'fluxa-1390058464.cos.ap-tokyo.myqcloud.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      ...(supabaseHostFromEnv
        ? [
            {
              protocol: 'https' as const,
              hostname: supabaseHostFromEnv,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
    ],
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@/lib/inspiration/remix': path.resolve(__dirname, './src/lib/discover/remix.ts'),
    };

    return config;
  },
};

export default withNextIntl(nextConfig);
