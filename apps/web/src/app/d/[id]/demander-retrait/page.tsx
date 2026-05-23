import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CheckCircle2, MailX } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { WithdrawalForm } from './withdrawal-form'

export const metadata: Metadata = {
  title: 'Demander le retrait de ma fiche — KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WithdrawalPage({ params }: PageProps) {
  const { id } = await params

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return <ErrorView message="Configuration serveur indisponible." />
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: diag, error } = await admin
    .from('diagnosticians')
    .select('id, first_name, last_name, city, withdrawal_requested, withdrawal_requested_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !diag) {
    return <NotFoundView />
  }

  if (diag.withdrawal_requested) {
    return <AlreadyView />
  }

  return (
    <PageShell title="Demander le retrait de ma fiche">
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Vous demandez le retrait de la fiche professionnelle au nom de
        {' '}<strong className="text-ink">{diag.first_name} {diag.last_name}</strong>
        {diag.city ? <> à <strong className="text-ink">{diag.city}</strong></> : null}.
      </p>
      <p className="text-[13px] text-ink-mute leading-relaxed">
        Une fois votre demande confirmée, votre fiche sera dépubliée sous 72&nbsp;heures et vos
        données seront supprimées définitivement de nos systèmes (article 17 du RGPD — droit à
        l&apos;effacement). Vous ne recevrez plus aucune communication.
      </p>
      <WithdrawalForm diagId={id} />
    </PageShell>
  )
}

function AlreadyView() {
  return (
    <PageShell title="Retrait déjà demandé">
      <CheckCircle2 className="size-10 mx-auto text-success" />
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Votre demande de retrait a déjà été enregistrée. Elle sera traitée sous 72&nbsp;heures.
      </p>
    </PageShell>
  )
}

function NotFoundView() {
  return (
    <PageShell title="Lien invalide">
      <MailX className="size-10 mx-auto text-ink-mute" />
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Ce lien ne correspond à aucune fiche connue.
        Contactez-nous à <a href="mailto:contact@kovas.fr" className="underline text-ink">contact@kovas.fr</a>.
      </p>
    </PageShell>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <PageShell title="Erreur">
      <p className="text-[14px] text-ink-mute leading-relaxed">{message}</p>
    </PageShell>
  )
}

function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-4 border-b border-rule/80 glass-header">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-navy shadow-accent" aria-hidden />
            <span className="font-display font-semibold tracking-tight text-ink">KOVAS</span>
          </div>
          <span className="text-[11px] text-ink-mute font-mono uppercase tracking-wider">
            Retrait de fiche · RGPD art. 17
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-xl space-y-6">
          <h1 className="font-display text-display-s tracking-tight text-ink font-light">{title}</h1>
          <Card variant="opaque" padding="default" className="space-y-4">
            {children}
          </Card>
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-rule/80">
        <p className="text-[11px] text-ink-faint text-center">
          © 2026 SASU {COMPANY_IDENTITY.legalName} · SIRET {COMPANY_IDENTITY.siretFormatted} ·{' '}
          {COMPANY_IDENTITY.address.line1}, {COMPANY_IDENTITY.address.postalCode}{' '}
          {COMPANY_IDENTITY.address.city}
        </p>
      </footer>
    </div>
  )
}
