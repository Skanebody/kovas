import { AddToHomeScreen } from '@/components/add-to-home-screen'
import { QueryProvider } from '@/components/query-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import type { Metadata, Viewport } from 'next'
import { instrumentSerif, jetbrainsMono, urbanist } from './fonts'
import './globals.css'

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
    { media: '(prefers-color-scheme: light)', color: '#F8F6F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1D2E' },
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
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${urbanist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-display antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
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
