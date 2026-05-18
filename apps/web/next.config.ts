import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['lucide-react'],
  },
  transpilePackages: ['@kovas/shared', '@kovas/database', '@kovas/ai', '@kovas/liciel-bridge'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  poweredByHeader: false,
}

export default withSerwist(nextConfig)
