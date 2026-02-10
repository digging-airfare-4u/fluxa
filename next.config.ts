import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

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
    ],
  },
};

export default withNextIntl(nextConfig);
