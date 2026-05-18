import { CheckCircle2, FileX, Lock } from 'lucide-react'
import type { Metadata } from 'next'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { Database } from '@kovas/database/types'
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

  const { data: mission } = await admin
    .from('missions')
    .select(
      'id, reference, organization_id, client_upload_expires_at, properties(address, city, postal_code)',
    )
    .eq('client_upload_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  // Token inconnu → 404 stylé
  if (!mission) {
    return <InvalidTokenPage />
  }

  // Token expiré
  if (
    mission.client_upload_expires_at &&
    new Date(mission.client_upload_expires_at) < new Date()
  ) {
    return <ExpiredTokenPage />
  }

  const prop = Array.isArray(mission.properties) ? mission.properties[0] : mission.properties

  // Liste des documents déjà uploadés (visible côté client pour feedback)
  const { data: existing } = await admin
    .from('owner_documents')
    .select('id, original_name, doc_kind, uploaded_at')
    .eq('mission_id', mission.id)
    .order('uploaded_at', { ascending: false })

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="px-6 py-4 border-b border-border">
        <div className="mx-auto max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-cta" aria-hidden />
            <span className="font-semibold tracking-tight">KOVAS</span>
          </div>
          <span className="text-xs text-muted-foreground">Sécurisé · RGPD</span>
        </div>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-2xl space-y-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Documents pour votre diagnostic
            </h1>
            <p className="text-muted-foreground">
              Votre diagnostiqueur a besoin de quelques documents avant son intervention.
              Téléchargez-les ici — c'est sécurisé et privé.
            </p>
            {prop && (
              <p className="text-sm text-subtle-foreground">
                Mission {mission.reference} · {prop.address}, {prop.postal_code} {prop.city}
              </p>
            )}
          </div>

          <UploadForm token={token} missionId={mission.id} orgId={mission.organization_id} />

          {existing && existing.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-accent-green" />
                {existing.length} document{existing.length > 1 ? 's' : ''} déjà envoyé
                {existing.length > 1 ? 's' : ''}
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                {existing.map((d) => (
                  <li key={d.id}>· {d.original_name ?? 'Document sans nom'}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-subtle-foreground space-y-1">
            <p className="flex items-start gap-1">
              <Lock className="size-3 mt-0.5 shrink-0" /> Hébergement EU (Paris), conformité RGPD. Vos
              documents ne sont visibles que par votre diagnostiqueur.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-6 py-6 border-t border-border">
        <p className="text-xs text-subtle-foreground text-center">
          © 2026 SASU Nexus 1993 · SIREN 982 786 154
        </p>
      </footer>
    </div>
  )
}

function InvalidTokenPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <FileX className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Lien invalide ou révoqué</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien d'envoi de documents n'est plus actif. Contactez votre diagnostiqueur pour en
          obtenir un nouveau.
        </p>
      </div>
    </div>
  )
}

function ExpiredTokenPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <FileX className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Lien expiré</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien a expiré (validité : 30 jours). Contactez votre diagnostiqueur pour un nouveau lien.
        </p>
      </div>
    </div>
  )
}
