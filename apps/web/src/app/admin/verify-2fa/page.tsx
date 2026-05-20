import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { VerifyTwoFaForm } from './verify-2fa-form'

export const metadata: Metadata = {
  title: 'Vérification 2FA — Admin',
  robots: { index: false, follow: false },
}

export default async function VerifyTwoFaPage() {
  const access = await verifyAdminAccess()

  // Pas admin → home publique (on n'expose pas qu'/admin existe).
  if (!access.isAdmin) {
    redirect('/')
  }
  // Pas de secret configuré → page de setup.
  if (access.hasNoSecret) {
    redirect('/admin/setup-2fa')
  }
  // Déjà 2FA validé → /admin direct.
  if (!access.needs2FA) {
    redirect('/admin')
  }

  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-navy shadow-accent" aria-hidden />
          <span className="font-display text-base font-semibold tracking-tight text-ink">
            KOVAS Admin
          </span>
        </div>
        <span className="rounded-pill bg-danger/15 text-danger px-3 py-1 text-[11px] font-mono uppercase tracking-wider">
          Accès restreint
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm glass-opaque rounded-xl p-8 border border-rule/80 shadow-glass-sm space-y-7">
          <div className="space-y-3 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              🔒 Admin · KOVAS
            </p>
            <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
              Vérification 2FA.
            </h1>
            <p className="text-sm text-ink-mute">
              Saisissez le code à 6 chiffres de votre application authenticator.
            </p>
          </div>

          <VerifyTwoFaForm />

          <div className="rounded-md bg-ink/5 px-4 py-3 text-[12px] text-ink-mute leading-relaxed">
            3 tentatives ratées en 15 min entraînent un blocage de 1 h sur votre compte. Toute
            tentative est journalisée.
          </div>

          <p className="text-center text-[11px] text-ink-faint pt-2 border-t border-rule/40">
            Première connexion ? Le setup 2FA se fait via le script CLI (cf.
            <code className="font-mono"> scripts/admin-setup-2fa.mjs</code>).
          </p>
        </div>
      </main>

      <footer className="px-6 py-4 text-[11px] text-ink-faint text-center">
        © 2026 SASU Nexus 1993 · Espace admin réservé
      </footer>
    </div>
  )
}
