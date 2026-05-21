import { ClientBiensSection } from '@/components/client/v5simp/ClientBiensSection'
import type { ClientBien } from '@/components/client/v5simp/ClientBiensSection'
import { ClientDossiersSection } from '@/components/client/v5simp/ClientDossiersSection'
import type { ClientDossier } from '@/components/client/v5simp/ClientDossiersSection'
import { ClientFab } from '@/components/client/v5simp/ClientFab'
import { ClientHistoriqueSection } from '@/components/client/v5simp/ClientHistoriqueSection'
import type { ClientHistoryEvent } from '@/components/client/v5simp/ClientHistoriqueSection'
import { ClientIdentitySection } from '@/components/client/v5simp/ClientIdentitySection'
import { type ClientStats, ClientStatsSheet } from '@/components/client/v5simp/ClientStatsSheet'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Détail client' }

const HISTORY_MAX = 10

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  // 1. Client de base
  const { data: client } = await supabase
    .from('clients')
    .select('id, display_name, type, city, email, phone')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  // 2. Biens rattachés (client_id direct sur properties)
  const { data: propertiesRows } = await supabase
    .from('properties')
    .select('id, address, city, postal_code, property_type, surface_total')
    .eq('organization_id', orgId)
    .eq('client_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const propertyIds = (propertiesRows ?? []).map((p) => p.id)

  // 3. Dossiers liés au client (via client_id OU via property_id du client)
  const { data: dossierRows } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, created_at, client_id, property_id, properties(address, city), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .or(
      propertyIds.length > 0
        ? `client_id.eq.${id},property_id.in.(${propertyIds.join(',')})`
        : `client_id.eq.${id}`,
    )
    .order('created_at', { ascending: false })
    .limit(200)

  const dossiers = dossierRows ?? []
  const dossiersCount = dossiers.length

  // 4. Compte dossiers par bien (pour cards Biens)
  const dossiersByProperty = new Map<string, number>()
  for (const d of dossiers) {
    if (!d.property_id) continue
    dossiersByProperty.set(d.property_id, (dossiersByProperty.get(d.property_id) ?? 0) + 1)
  }

  const biens: ClientBien[] = (propertiesRows ?? []).map((p) => ({
    id: p.id,
    address: p.address,
    city: p.city,
    postal_code: p.postal_code,
    property_type: p.property_type,
    surface_total: p.surface_total,
    dossiers_count: dossiersByProperty.get(p.id) ?? 0,
  }))

  // 5. Factures client (somme amount_ttc → centimes) pour le BottomSheet stats
  const { data: invoiceRows } = await supabase
    .from('invoices')
    .select('amount_ttc')
    .eq('organization_id', orgId)
    .eq('client_id', id)

  const caTotalCents = Math.round(
    (invoiceRows ?? []).reduce((sum, r) => sum + Number(r.amount_ttc ?? 0), 0) * 100,
  )

  // 6. Dossiers list (côté section dossiers) — enrichi avec type principal + montant
  const dossierItems: ClientDossier[] = dossiers.map((d) => {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    const missions = (d.missions ?? []) as { type: string }[]
    return {
      id: d.id,
      reference: d.reference,
      scheduled_at: d.scheduled_at,
      created_at: d.created_at,
      status: d.status,
      property_address: prop?.address ?? null,
      property_city: prop?.city ?? null,
      total_cents: null,
      primary_mission_type: missions[0]?.type ?? null,
    }
  })

  // 7. Historique : dossiers créés + (V1) on n'a pas encore d'events table dédiée → on
  //    dérive les N derniers événements depuis les dossiers + factures.
  const historyEvents: ClientHistoryEvent[] = []
  for (const d of dossiers) {
    historyEvents.push({
      id: `dossier:${d.id}:created`,
      dateIso: d.created_at,
      kind: 'dossier_created',
      summary: `Dossier ${d.reference} créé`,
      href: `/dashboard/dossiers/${d.id}`,
    })
  }
  // V1 : factures non listées dans l'historique (champs requis non sélectionnés).
  // À enrichir lorsqu'une table d'events dédiée existera.
  historyEvents.sort((a, b) => b.dateIso.localeCompare(a.dateIso))
  const historyLimited = historyEvents.slice(0, HISTORY_MAX)

  const firstDossierIso = dossiers.length > 0 ? dossiers[dossiers.length - 1].created_at : null
  const lastDossierIso = dossiers.length > 0 ? dossiers[0].created_at : null

  const stats: ClientStats = {
    caTotalCents,
    dossiersCount,
    fideliteScore: dossiersCount,
    lastContactIso: lastDossierIso,
    firstContactIso: firstDossierIso,
    biensCount: biens.length,
  }

  const fidele = dossiersCount >= 5

  return (
    <>
      {/* Context bar sticky 56px */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-6 flex h-14 items-center justify-between gap-3 border-b border-rule/40 bg-sage/85 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/clients" aria-label="Retour aux clients">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-sans text-[14px] font-medium text-ink truncate">
            {client.display_name}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ClientStatsSheet stats={stats} />
          <Button variant="ghost" size="sm" asChild aria-label="Modifier le client">
            <Link href={`/dashboard/clients/${client.id}/edit`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-10 animate-fade-in pb-24">
        <ClientIdentitySection
          client={{
            id: client.id,
            display_name: client.display_name,
            type: client.type,
            city: client.city,
            email: client.email,
            phone: client.phone,
          }}
          fidele={fidele}
        />

        <ClientBiensSection clientId={client.id} biens={biens} />

        <ClientDossiersSection dossiers={dossierItems} />

        <ClientHistoriqueSection events={historyLimited} />
      </div>

      <ClientFab clientId={client.id} />
    </>
  )
}
