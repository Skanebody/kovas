import { Card } from '@/components/ui/card'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { CheckCircle2, FileX, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { UploadForm } from './upload-form'

export const metadata: Metadata = {
  title: 'Envoi de documents — KOVAS',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PublicUploadPage({ params }: PageProps) {
  const { token } = await params

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: dossier } = await admin
    .from('dossiers')
    .select(
      'id, reference, organization_id, client_upload_expires_at, properties(address, city, postal_code)',
    )
    .eq('client_upload_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossier) {
    return <InvalidTokenPage />
  }

  if (dossier.client_upload_expires_at && new Date(dossier.client_upload_expires_at) < new Date()) {
    return <ExpiredTokenPage />
  }

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties

  const { data: existing } = await admin
    .from('owner_documents')
    .select('id, original_name, doc_kind, uploaded_at')
    .eq('dossier_id', dossier.id)
    .order('uploaded_at', { ascending: false })

  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-4 border-b border-rule/80 glass-header">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-navy shadow-accent" aria-hidden />
            <span className="font-display font-semibold tracking-tight text-ink">KOVAS</span>
          </div>
          <span className="text-[11px] text-ink-mute font-mono uppercase tracking-wider">
            Sécurisé · RGPD
          </span>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-2">
            <h1 className="font-sans font-light text-display-s tracking-tight text-ink leading-[1.1]">
              Documents pour ton <span className="font-serif italic font-normal">diagnostic</span>.
            </h1>
            <p className="text-[14px] text-ink-mute">
              Ton diagnostiqueur a besoin de quelques documents avant son intervention.
              Télécharge-les ici — c&apos;est sécurisé et privé.
            </p>
            {prop && (
              <p className="text-[12px] text-ink-faint font-mono">
                Dossier {dossier.reference} · {prop.address}, {prop.postal_code} {prop.city}
              </p>
            )}
          </div>

          <Card variant="opaque" padding="default">
            <UploadForm token={token} />
          </Card>

          {existing && existing.length > 0 && (
            <Card variant="opaque" padding="default" className="space-y-2">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <CheckCircle2 className="size-4 text-success" />
                {existing.length} document{existing.length > 1 ? 's' : ''} déjà envoyé
                {existing.length > 1 ? 's' : ''}
              </div>
              <ul className="text-[13px] text-ink-mute space-y-1">
                {existing.map((d) => (
                  <li key={d.id}>· {d.original_name ?? 'Document sans nom'}</li>
                ))}
              </ul>
            </Card>
          )}

          <p className="text-[11px] text-ink-faint flex items-start gap-1">
            <Lock className="size-3 mt-0.5 shrink-0" />
            Hébergement EU (Paris), conformité RGPD. Tes documents ne sont visibles que par ton
            diagnostiqueur.
          </p>
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-rule/80">
        <p className="text-[11px] text-ink-faint text-center">
          © 2026 SASU {COMPANY_IDENTITY.legalName} · SIREN {COMPANY_IDENTITY.sirenFormatted}
        </p>
      </footer>
    </div>
  )
}

function InvalidTokenPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-fluid-light">
      <Card variant="opaque" padding="lg" className="max-w-md text-center space-y-4">
        <FileX className="size-10 mx-auto text-ink-mute" />
        <h1 className="font-display text-xl font-semibold text-ink">Lien invalide ou révoqué</h1>
        <p className="text-[13px] text-ink-mute">
          Ce lien d&apos;envoi de documents n&apos;est plus actif. Contacte ton diagnostiqueur pour
          en obtenir un nouveau.
        </p>
      </Card>
    </div>
  )
}

function ExpiredTokenPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-fluid-light">
      <Card variant="opaque" padding="lg" className="max-w-md text-center space-y-4">
        <FileX className="size-10 mx-auto text-ink-mute" />
        <h1 className="font-display text-xl font-semibold text-ink">Lien expiré</h1>
        <p className="text-[13px] text-ink-mute">
          Ce lien a expiré (validité : 30 jours). Contacte ton diagnostiqueur pour un nouveau lien.
        </p>
      </Card>
    </div>
  )
}
