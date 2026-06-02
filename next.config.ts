import type { NextConfig } from "next";
import path from 'path';
import createNextIntlPlugin from 'next-intl/plugin';

const projectRoot = process.cwd();

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
  // Pin the workspace root to this project. Without this, Next.js can infer the
  // wrong root when other lockfiles exist higher up the tree (e.g.
  // ~/package-lock.json), which breaks Turbopack's module resolution for
  // CSS imports like `@import "tailwindcss"`.
  turbopack: {
    root: process.cwd(),
  },
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
      '@/lib/inspiration/remix': path.resolve(projectRoot, './src/lib/discover/remix.ts'),
    };

    return config;
  },
};

export default withNextIntl(nextConfig);
