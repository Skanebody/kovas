import { Card } from '@/components/ui/card'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { MailX } from 'lucide-react'
import type { Metadata } from 'next'
import { CorrectionForm } from './correction-form'

export const metadata: Metadata = {
  title: 'Proposer une correction — KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CorrectionPage({ params }: PageProps) {
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
    .select(
      'id, first_name, last_name, email, city, department_name, certifications, certification_organization',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !diag) {
    return <NotFoundView />
  }

  const currentValues = {
    first_name: diag.first_name ?? '',
    last_name: diag.last_name ?? '',
    email: diag.email ?? '',
    city: diag.city ?? '',
    department_name: diag.department_name ?? '',
    certifications: Array.isArray(diag.certifications) ? diag.certifications.join(', ') : '',
    certification_organization: diag.certification_organization ?? '',
  }

  return (
    <PageShell>
      <h1 className="font-display text-display-s tracking-tight text-ink font-light">
        Proposer une correction
      </h1>
      <p className="text-[14px] text-ink-mute leading-relaxed">
        Vérifie les informations ci-dessous et indique les corrections à apporter dans le message.
        Nous traitons ta demande sous 72&nbsp;heures.
      </p>

      <Card variant="opaque" padding="default">
        <CorrectionForm diagId={id} currentValues={currentValues} />
      </Card>

      <p className="text-[12px] text-ink-faint leading-relaxed">
        Si tu préfères reprendre le contrôle complet de ta fiche (photo, présentation, tarifs, zones
        d&apos;intervention), nous recommandons plutôt la réclamation de fiche, qui prend
        2&nbsp;minutes.
      </p>
    </PageShell>
  )
}

function NotFoundView() {
  return (
    <PageShell>
      <Card variant="opaque" padding="lg" className="text-center space-y-3">
        <MailX className="size-10 mx-auto text-ink-mute" />
        <h1 className="font-display text-xl font-semibold text-ink">Lien invalide</h1>
        <p className="text-[14px] text-ink-mute">Ce lien ne correspond à aucune fiche connue.</p>
      </Card>
    </PageShell>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <PageShell>
      <Card variant="opaque" padding="lg" className="text-center space-y-3">
        <h1 className="font-display text-xl font-semibold text-ink">Erreur</h1>
        <p className="text-[14px] text-ink-mute">{message}</p>
      </Card>
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
            Correction fiche
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-6">{children}</div>
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
