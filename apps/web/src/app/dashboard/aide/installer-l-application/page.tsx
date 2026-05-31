/**
 * KOVAS — Tutoriel "Installer l'application sur ton téléphone".
 *
 * Guide PWA "n'importe qui le fait" : iOS (Safari), Android (vrai bouton natif),
 * desktop (QR code). Montré aussi à l'onboarding.
 *
 * KOVAS est une PWA : pas de store, installation directe depuis le navigateur.
 * Le QR code est généré côté serveur (SVG, pas de module natif `canvas`).
 *
 * Authority : CLAUDE.md §8 (PWA-only Phase 1) + Lot B96 centre d'aide.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { PwaInstallGuide } from '@/components/pwa/PwaInstallGuide'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

/** URL canonique de l'app installée (matche `start_url` du manifest). */
const APP_URL = 'https://kovas.fr/dashboard/dashboard' as const

export const metadata: Metadata = buildNoindexMetadata({
  title: "Installer l'application sur ton téléphone — Aide",
  description:
    "Ajoute KOVAS à ton écran d'accueil en 15 secondes : iPhone (Safari), Android (1 toucher) ou via QR code depuis ton ordinateur. Pas besoin du store, fonctionne hors-ligne.",
  path: '/dashboard/aide/installer-l-application',
})

export default async function AideInstallerApplicationPage() {
  // QR code généré côté serveur en SVG (toString) — contrairement à toDataURL
  // (PNG), le SVG ne dépend PAS du module natif `canvas`, indisponible sur le
  // runtime serverless Vercel. Génération NON bloquante : si elle échoue, la
  // page s'affiche quand même (l'URL en clair reste affichée en secours).
  let qrSvg: string | null = null
  try {
    const QRCode = await import('qrcode')
    qrSvg = await QRCode.toString(APP_URL, {
      type: 'svg',
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrSvg = null
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/aide"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute hover:text-ink"
      >
        <ChevronLeft className="size-3" aria-hidden />
        Centre d&apos;aide
      </Link>

      <AppPageHeader
        eyebrow="Tutoriel · 15 secondes"
        title="Installer l'app"
        accent="sur ton téléphone"
        description="KOVAS s'installe directement depuis ton navigateur, sans passer par un store. Suis le guide adapté à ton appareil."
      />

      <PwaInstallGuide appUrl={APP_URL} qrSvg={qrSvg} />
    </div>
  )
}
