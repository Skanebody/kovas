import { AddToHomeScreen } from '@/components/add-to-home-screen'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'KOVAS — Diagnostic immobilier IA',
    template: '%s | KOVAS',
  },
  description: "L'app iPad qui transforme 3h de DPE en 30 minutes. Compagnon Liciel IA-first.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KOVAS',
    startupImage: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false, email: false, address: false },
  applicationName: 'KOVAS',
  authors: [{ name: 'Benjamin Bel', url: 'https://kovas.fr' }],
  generator: 'Next.js',
  keywords: ['diagnostic immobilier', 'DPE', 'iPad', 'Liciel', 'amiante', 'plomb'],
  metadataBase: new URL('https://kovas.fr'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://kovas.fr',
    siteName: 'KOVAS',
    title: 'KOVAS — Diagnostic immobilier IA',
    description: "L'app iPad qui transforme 3h de DPE en 30 minutes",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning className={manrope.variable}>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
            <AddToHomeScreen />
            <Toaster />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
