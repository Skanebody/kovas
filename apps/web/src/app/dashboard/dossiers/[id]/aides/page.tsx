import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { KpiHero } from '@/components/ui/kpi-hero'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { AideResult } from '@/lib/data-gouv/mes-aides-reno'
import { ArrowLeft, Download, Mail } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Aides à la rénovation — KOVAS' }

interface AnnexePayload {
  mission_id?: string
  mission_reference?: string
  dpe_actuel?: string
  dpe_projete?: string
  aides?: AideResult[]
  generated_at?: string
}

interface AnnexeRow {
  id: string
  storage_path: string
  payload: AnnexePayload
  generated_at: string
}

export default async function DossierAidesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  // Vérifie que le dossier existe + appartient à l'org.
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, reference, properties(address, postal_code, city), clients(display_name, email)')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (!dossier) notFound()

  // La table dossier_export_annexes n'est pas (encore) dans les types
  // générés ; on caste localement pour rester strict côté lecture.
  const { data: rawAnnexes } = await supabase
    .from('dossier_export_annexes' as never)
    .select('id, storage_path, payload, generated_at')
    .eq('dossier_id', id)
    .eq('annexe_type', 'aides_renovation')
    .order('generated_at', { ascending: false })
    .limit(1)

  const annexes = (rawAnnexes ?? []) as unknown as AnnexeRow[]
  const latest = annexes[0]

  const property = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients

  const aides = latest?.payload.aides ?? []
  const total = aides.reduce((acc, a) => acc + a.montant_eur, 0)
  const totalRounded = Math.round(total / 100) * 100

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/app/dossiers/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-mute hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Retour au dossier
        </Link>
      </div>

      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-wider text-ink-mute">
          Annexe — Dossier {dossier.reference}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Aides à la rénovation <span className="text-display-serif">énergétique</span>
        </h1>
        {property?.address ? (
          <p className="mt-2 text-sm text-ink-mute">
            {property.address}
            {property.postal_code || property.city ? (
              <>
                {' · '}
                {[property.postal_code, property.city].filter(Boolean).join(' ')}
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      {!latest ? (
        <Card variant="flat" className="text-center">
          <h2 className="text-lg font-semibold text-ink">Aucune annexe générée pour ce dossier</h2>
          <p className="mt-2 text-sm text-ink-mute">
            L'annexe Aides Rénovation est générée automatiquement lors de l'export d'une mission DPE
            de classe F ou G. Exportez le rapport DPE pour la créer.
          </p>
          <div className="mt-5">
            <Link href={`/app/dossiers/${id}`}>
              <Button variant="outline">Retour au dossier</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* KPI hero — total estimé */}
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            <KpiHero
              featured
              value={`${formatEur(totalRounded)}`}
              label="d'aides estimées pour ce bien"
              hint={
                latest.payload.dpe_actuel
                  ? `Passage de la classe ${latest.payload.dpe_actuel} à la classe ${latest.payload.dpe_projete ?? 'C'}`
                  : undefined
              }
              trend={null}
            />
            <div className="grid gap-3">
              <Card variant="flat" padding="sm">
                <p className="font-mono text-xs uppercase tracking-wider text-ink-mute">Document</p>
                <p className="mt-2 text-sm text-ink">
                  Annexe officielle à joindre au DPE remis au propriétaire.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/api/dossiers/${id}/annexes/aides/download`} prefetch={false}>
                    <Button>
                      <Download className="size-4" />
                      Télécharger le PDF
                    </Button>
                  </Link>
                  <SendByEmailButton
                    disabled={!client?.email}
                    clientEmail={client?.email ?? null}
                  />
                </div>
              </Card>
              <Card variant="flat" padding="sm">
                <p className="font-mono text-xs uppercase tracking-wider text-ink-mute">
                  Généré le
                </p>
                <p className="mt-2 text-sm text-ink">{formatDateTime(latest.generated_at)}</p>
              </Card>
            </div>
          </div>

          {/* Liste détaillée */}
          <section>
            <h2 className="text-xl font-bold text-ink">Détail des aides éligibles</h2>
            <p className="mt-1 text-sm text-ink-mute">
              Cliquez sur chaque aide pour ouvrir la page officielle France Rénov'.
            </p>

            <ul className="mt-5 space-y-4">
              {aides.map((aide) => (
                <li key={aide.code}>
                  <Card variant="flat">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-ink">{aide.label}</h3>
                      <p className="font-serif italic text-2xl text-ink">
                        {formatEur(aide.montant_eur)}
                      </p>
                    </div>
                    {aide.conditions.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
                        {aide.conditions.map((c) => (
                          <li key={c} className="flex gap-2">
                            <span aria-hidden className="text-ink-mute">
                              →
                            </span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="mt-4 text-xs text-ink-mute">
                      <a
                        href={aide.source_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline-offset-2 hover:underline"
                      >
                        {aide.source_url.replace(/^https?:\/\//, '')}
                      </a>
                    </p>
                  </Card>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-ink-mute italic">
              Sous réserve d'éligibilité et de validation par France Rénov'. KOVAS ne traite pas les
              dossiers d'aide ; orientez votre client vers un conseiller France Rénov' au 0 808 800
              700 pour la constitution du dossier officiel.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function SendByEmailButton({
  disabled,
  clientEmail,
}: {
  disabled: boolean
  clientEmail: string | null
}) {
  // V1 : composant stub. Le câblage email Resend arrive en Phase 2.
  // On garde un bouton désactivé visuellement explicite, plus utile qu'un
  // bouton qui plante silencieusement.
  return (
    <Button
      variant="outline"
      disabled={disabled}
      title={clientEmail ?? 'Aucun email client renseigné'}
    >
      <Mail className="size-4" />
      Envoyer au client par email
    </Button>
  )
}

function formatEur(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} €`
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
