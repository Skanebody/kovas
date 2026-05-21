import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: isDev,
})

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
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
  async redirects() {
    return [
      // Redirection 301 permanente : ancien préfixe authentifié /app/* → /dashboard/*
      // (rename Phase C pour clarifier que l'espace authentifié est le tableau de bord
      // dual track Annuaire + Logiciel).
      { source: '/app/:path*', destination: '/dashboard/:path*', permanent: true },
    ]
  },
}

// En dev, bypass withSerwist : il injecte une config webpack qui déclenche un
// warning sous Turbopack alors qu'il n'a rien à faire (disable: true en dev).
export default isDev ? nextConfig : withSerwist(nextConfig)
