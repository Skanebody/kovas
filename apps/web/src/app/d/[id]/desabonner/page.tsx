import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CheckCircle2, MailX } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

export const metadata: Metadata = {
  title: 'Désabonnement — KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function UnsubscribePage({ params }: PageProps) {
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return <ErrorView message="Configuration serveur indisponible. Réessayez plus tard." />
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Vérifier que le diagnostiqueur existe (sans révéler son nom/email)
  const { data: diag, error } = await admin
    .from('diagnosticians')
    .select('id, unsubscribed, unsubscribed_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !diag) {
    return <NotFoundView />
  }

  // Idempotent : si déjà unsubscribed, on confirme simplement
  if (!diag.unsubscribed) {
    const { error: updateErr } = await admin
      .from('diagnosticians')
      .update({
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (updateErr) {
      return <ErrorView message="Une erreur est survenue. Réessayez ou contactez contact@kovas.fr." />
    }
  }

  return <SuccessView />
}

function SuccessView() {
  return (
    <PageShell>
      <CheckCircle2 className="size-10 mx-auto text-success" />
      <h1 className="font-display text-xl font-semibold text-ink">Désabonnement confirmé</h1>
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Vous ne recevrez plus d&apos;emails de la part de KOVAS concernant votre fiche professionnelle.
      </p>
      <p className="text-[13px] text-ink-faint leading-relaxed">
        Si vous souhaitez également retirer votre fiche du site, utilisez la page
        &laquo;&nbsp;Demander le retrait&nbsp;&raquo; depuis l&apos;un de nos emails ou
        contactez-nous à <a href="mailto:contact@kovas.fr" className="underline text-ink">contact@kovas.fr</a>.
      </p>
    </PageShell>
  )
}

function NotFoundView() {
  return (
    <PageShell>
      <MailX className="size-10 mx-auto text-ink-mute" />
      <h1 className="font-display text-xl font-semibold text-ink">Lien invalide</h1>
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Ce lien de désabonnement ne correspond à aucune fiche connue.
        Si vous pensez que c&apos;est une erreur, contactez-nous à
        {' '}<a href="mailto:contact@kovas.fr" className="underline text-ink">contact@kovas.fr</a>.
      </p>
    </PageShell>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <PageShell>
      <MailX className="size-10 mx-auto text-ink-mute" />
      <h1 className="font-display text-xl font-semibold text-ink">Erreur</h1>
      <p className="text-[14px] text-ink-mute leading-relaxed">{message}</p>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-4 border-b border-rule/80 glass-header">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-navy shadow-accent" aria-hidden />
            <span className="font-display font-semibold tracking-tight text-ink">KOVAS</span>
          </div>
          <span className="text-[11px] text-ink-mute font-mono uppercase tracking-wider">
            Désabonnement
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <Card variant="opaque" padding="lg" className="max-w-md w-full text-center space-y-4">
          {children}
        </Card>
      </main>

      <footer className="px-6 py-6 border-t border-rule/80">
        <p className="text-[11px] text-ink-faint text-center">
          © 2026 SASU {COMPANY_IDENTITY.legalName} · SIRET {COMPANY_IDENTITY.siretFormatted}
        </p>
      </footer>
    </div>
  )
}
