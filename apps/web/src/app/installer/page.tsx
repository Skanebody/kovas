/**
 * KOVAS — Page publique d'installation de l'application (PWA).
 *
 * Route top-level PUBLIQUE (aucune auth : l'auth n'est imposée que sous
 * `/dashboard` et `/admin` via leurs layouts). C'est la cible du QR code
 * d'installation affiché dans l'onboarding et le centre d'aide.
 *
 * Parcours cible :
 *   - sur ORDINATEUR, le guide affiche un QR vers cette même page `/installer` ;
 *   - le diagnostiqueur scanne ce QR avec son téléphone → ouvre `/installer`
 *     sur le téléphone (où il n'est PAS connecté) → voit DIRECTEMENT les étapes
 *     pour ajouter KOVAS à son écran d'accueil, sans tomber sur l'écran de login.
 *
 * Le QR est généré côté serveur en SVG (toString) — contrairement à toDataURL
 * (PNG), le SVG ne dépend PAS du module natif `canvas`, indisponible sur le
 * runtime serverless Vercel. Génération NON bloquante : si elle échoue, l'URL
 * en clair reste affichée en secours par le composant guide.
 *
 * Design system v5 : sage `#F5F7F4`, navy `#0F1419`, accent chartreuse `#D4F542`.
 * Mobile-first strict — cette page est lue majoritairement sur téléphone.
 */

import { PwaInstallGuide } from '@/components/pwa/PwaInstallGuide'
import { buildMetadata } from '@/lib/seo/metadata'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

/**
 * URL publique de cette même page. Le QR pointe vers elle (auto-référence) :
 * un desktop affiche un QR vers `/installer`, un téléphone qui le scanne ouvre
 * `/installer` et voit les étapes d'installation.
 */
const INSTALL_URL = 'https://kovas.fr/installer' as const

export const metadata = buildMetadata({
  title: "Installer l'application KOVAS",
  description:
    "Ajoute KOVAS à ton écran d'accueil en 15 secondes : iPhone (Safari), Android (1 toucher) ou via QR code depuis ton ordinateur. Pas besoin du store, fonctionne hors-ligne.",
  path: '/installer',
})

export default async function InstallerPage() {
  let qrSvg: string | null = null
  try {
    const QRCode = await import('qrcode')
    qrSvg = await QRCode.toString(INSTALL_URL, {
      type: 'svg',
      margin: 1,
      width: 200,
      errorCorrectionLevel: 'M',
    })
  } catch {
    qrSvg = null
  }

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-ink font-sans">
      {/* Header minimal : logo / nom KOVAS (cohérent PublicHeader). */}
      <header className="border-b border-rule/60">
        <div className="mx-auto max-w-2xl w-full px-5 sm:px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <span className="size-8 rounded-md bg-ink" aria-hidden />
            <span className="text-base font-bold tracking-tight text-ink">KOVAS</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-5 sm:px-6 py-10 sm:py-14 animate-fade-in motion-reduce:animate-none">
        <div className="mx-auto max-w-2xl w-full space-y-7">
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Application terrain · 15 secondes
            </p>
            <h1 className="text-[26px] sm:text-[32px] font-semibold tracking-tight text-ink leading-tight">
              Installer KOVAS sur ton téléphone
            </h1>
            <p className="text-[14px] sm:text-[15px] text-ink-soft leading-relaxed">
              KOVAS s&apos;installe directement depuis ton navigateur, sans passer par un store.
              Suis le guide ci-dessous, il s&apos;adapte automatiquement à ton appareil.
            </p>
          </div>

          <PwaInstallGuide appUrl={INSTALL_URL} qrSvg={qrSvg} />

          <p className="text-center text-[13px] text-ink-mute pt-2 border-t border-rule/40">
            Déjà installé ?{' '}
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-ink font-semibold underline-offset-4 hover:underline"
            >
              Se connecter
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
