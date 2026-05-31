/**
 * Page UI de setup 2FA admin (remplace le script CLI en V1+).
 *
 * Workflow :
 *   1. verifyAdminAccess() côté serveur
 *   2. Génère un secret TOTP fraîs (PAS persisté en BDD à ce stade)
 *   3. Affiche secret + lien otpauth:// pour scan via app Authenticator
 *   4. Form client POST /api/admin/2fa/setup avec { secret, token }
 *      → si TOTP valide, persiste le secret chiffré + pose cookie 2FA validé
 *
 * Sécurité : le secret est aussi loggé HTML server-side (rendu page). Le user
 * doit fermer/recharger la page après activation pour ne pas laisser traîner
 * le secret en clair dans le DOM.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { buildOtpauthUrl, generateSecret } from '@/lib/admin/totp'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SetupTwoFaForm } from './setup-form'

export const metadata: Metadata = {
  title: 'Configuration 2FA',
  robots: { index: false, follow: false },
}

// Force dynamic : on génère un nouveau secret à chaque hit.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SetupTwoFaPage() {
  const access = await verifyAdminAccess()

  // Pas admin → home publique (on n'expose pas qu'/admin existe).
  if (!access.isAdmin || !access.user) {
    redirect('/')
  }

  // Déjà configuré → /admin (le layout parent gérera 2FA cookie si besoin).
  if (!access.hasNoSecret) {
    redirect('/admin')
  }

  const secret = generateSecret()
  const otpauthUrl = buildOtpauthUrl(secret, access.user.email)

  // QR code généré côté serveur (data URL PNG) à partir du lien otpauth.
  // `qrcode` dépend de modules Node → import dynamique, server-only.
  const QRCode = await import('qrcode')
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
  })

  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-navy shadow-accent" aria-hidden />
          <span className="font-display text-base font-semibold tracking-tight text-ink">
            KOVAS Admin
          </span>
        </div>
        <span className="rounded-pill bg-warning/15 text-warning px-3 py-1 text-[11px] font-mono uppercase tracking-wider">
          Setup 2FA requis
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg glass-opaque rounded-xl p-8 border border-rule/80 shadow-glass-sm space-y-7">
          <div className="space-y-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              🔐 Première connexion admin
            </p>
            <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
              Activer la 2FA.
            </h1>
            <p className="text-sm text-ink-mute">
              Scannez le code dans Google Authenticator, Authy ou 1Password, puis entrez le code à 6
              chiffres pour activer.
            </p>
          </div>

          {/* QR code à scanner (généré depuis le lien otpauth côté serveur) */}
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl bg-white p-3 border border-rule/60 shadow-glass-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt="QR code de configuration 2FA — à scanner dans votre application d'authentification"
                width={220}
                height={220}
                className="block size-[220px]"
              />
            </div>
            <p className="text-[12px] text-ink-mute text-center max-w-xs leading-relaxed">
              Scannez ce QR dans Google Authenticator, Authy ou 1Password. Pas de caméra ? Saisissez
              le secret ci-dessous manuellement.
            </p>
          </div>

          {/* Secret affiché en clair (font-mono, copiable) — fallback si pas de scan */}
          <div className="rounded-md bg-ink/5 px-4 py-4 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Secret base32
            </p>
            <code className="block font-mono text-base text-ink break-all select-all leading-relaxed">
              {secret}
            </code>
          </div>

          {/* Lien otpauth:// — peut être collé dans un générateur QR ou 1Password */}
          <div className="rounded-md bg-ink/5 px-4 py-3 space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Lien otpauth (collable dans 1Password / QR generator)
            </p>
            <code className="block font-mono text-[11px] text-ink-mute break-all select-all leading-relaxed">
              {otpauthUrl}
            </code>
          </div>

          <SetupTwoFaForm secret={secret} />

          <div className="rounded-md bg-warning/10 px-4 py-3 text-[12px] text-ink-mute leading-relaxed">
            ⚠️ Ce secret n'est <strong>jamais persisté</strong> tant que vous n'avez pas validé un
            premier code. Si vous fermez cette page sans activer, vous devrez régénérer.
          </div>

          <p className="text-center text-[11px] text-ink-faint pt-2 border-t border-rule/40">
            Backup CLI disponible : <code className="font-mono">scripts/admin-setup-2fa.mjs</code>
          </p>
        </div>
      </main>

      <footer className="px-6 py-4 text-[11px] text-ink-faint text-center">
        © 2026 SASU {COMPANY_IDENTITY.legalName} · Espace admin réservé
      </footer>
    </div>
  )
}
