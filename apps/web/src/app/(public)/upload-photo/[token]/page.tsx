import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { UploadPhotoForm } from './upload-photo-form'

/**
 * Page publique `/upload-photo/[token]` — utilisée par le client final
 * pour uploader une photo demandée par son diagnostiqueur.
 *
 * Ton SOBRE PROFESSIONNEL — vouvoiement, pas d'emoji marketing, palette
 * V5 sage/navy-deep avec accent chartreuse sur le CTA principal.
 *
 * Sécurité :
 *   - vérification token côté server component (avant render)
 *   - si invalide / expiré / déjà utilisé → page 404
 *   - upload effectif via Edge Function `upload-client-photo`
 *     (validation re-faite côté serveur, RLS contournée par service role)
 */

interface PageProps {
  params: Promise<{ token: string }>
}

interface PhotoRequestPublic {
  id: string
  photoDescription: string
  expiresAt: string
  organizationName: string | null
  diagnosticianName: string | null
}

async function loadPhotoRequest(token: string): Promise<PhotoRequestPublic | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return null
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase
    .from('client_photo_requests')
    .select('id, photo_description, expires_at, status, organization_id, requested_by')
    .eq('token', token)
    .single()
  if (error || !data) return null
  if (data.status !== 'pending') return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  // Récupération séparée du nom orga et diagnostiqueur (évite le typing
  // ambigu du select imbriqué Supabase)
  const [{ data: org }, { data: prof }] = await Promise.all([
    supabase.from('organizations').select('name').eq('id', data.organization_id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', data.requested_by).maybeSingle(),
  ])

  return {
    id: data.id as string,
    photoDescription: data.photo_description as string,
    expiresAt: data.expires_at as string,
    organizationName: (org?.name as string | null | undefined) ?? null,
    diagnosticianName: (prof?.full_name as string | null | undefined) ?? null,
  }
}

export default async function UploadPhotoPage({ params }: PageProps) {
  const { token } = await params
  const request = await loadPhotoRequest(token)
  if (!request) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-sage flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <header className="mb-6 text-center">
          <p className="label-mono text-ink-mute mb-1">KOVAS · upload sécurisé</p>
          <h1 className="text-[24px] font-semibold text-ink leading-tight">
            Envoi d&apos;une photo
          </h1>
          {request.diagnosticianName && (
            <p className="text-[14px] text-ink-soft mt-2">
              Demandée par {request.diagnosticianName}
              {request.organizationName ? ` (${request.organizationName})` : ''}
            </p>
          )}
        </header>
        <UploadPhotoForm
          token={token}
          photoDescription={request.photoDescription}
          expiresAt={request.expiresAt}
        />
        <footer className="text-center text-[11px] text-ink-mute mt-8 leading-relaxed">
          Lien sécurisé valable 48 heures. La photo est transmise uniquement à ton diagnostiqueur.
          <br />
          KOVAS — édité par NEXUS 1993 (SASU au capital de 500 €).
        </footer>
      </div>
    </main>
  )
}
