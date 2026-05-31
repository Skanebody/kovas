import { DangerZone } from '@/components/danger-zone'
import {
  PropertyCaracteristiquesSection,
  type PropertyEssentialSpecs,
  type PropertyTechnicalSpecs,
} from '@/components/property/v5simp/PropertyCaracteristiquesSection'
import {
  type PropertyContexteLocalData,
  PropertyContexteLocalSheet,
} from '@/components/property/v5simp/PropertyContexteLocalSheet'
import {
  type PropertyDossierItem,
  PropertyDossiersSection,
} from '@/components/property/v5simp/PropertyDossiersSection'
import { PropertyFab } from '@/components/property/v5simp/PropertyFab'
import {
  PropertyGallerieSection,
  type PropertyPhoto,
} from '@/components/property/v5simp/PropertyGallerieSection'
import { PropertyIdentitySection } from '@/components/property/v5simp/PropertyIdentitySection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { fetchPublicLocalStats } from '@/lib/external/public-stats'
import { formatPropertyAddress } from '@/lib/property-display'
import { parsePropertyLocation } from '@/lib/property/location'
import { ArrowLeft, Pencil } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { softDeletePropertyAction } from '../actions'
import type { PropertyRelationshipRole } from './stakeholders-actions'
import { PropertyStakeholdersSection, type StakeholderRelationship } from './stakeholders-section'

export const metadata: Metadata = { title: 'Détail bien' }

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore regénérés post-migration FIX-KK.
  const sb = supabase as any

  const { data: property } = await supabase
    .from('properties')
    .select(
      'id, address, city, postal_code, insee_code, property_type, year_built, surface_total, surface_carrez, rooms_count, floors, heating_type, apartment_detail, floor_number, building_letter, lot_number, cadastre_prefix, cadastre_section, cadastre_number, client_id, notes, location',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!property) notFound()

  // 2. Propriétaire rattaché (via client_id direct)
  let owner: {
    id: string
    display_name: string
    phone: string | null
  } | null = null
  if (property.client_id) {
    const { data: ownerRow } = await supabase
      .from('clients')
      .select('id, display_name, phone')
      .eq('id', property.client_id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle()
    if (ownerRow) {
      owner = {
        id: ownerRow.id,
        display_name: ownerRow.display_name,
        phone: ownerRow.phone,
      }
    }
  }

  // 3. Dossiers réalisés sur ce bien
  const { data: dossierRows } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, completed_at, created_at, missions(type, dpe_letter, completed_at)',
    )
    .eq('organization_id', orgId)
    .eq('property_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  const dossiers = dossierRows ?? []

  // 4. Photos (via dossier_id) — V1 : sélection des thumbs pour la galerie agrégée du bien
  const dossierIds = dossiers.map((d) => d.id)
  let photoRows: {
    id: string
    thumb_path: string | null
    storage_path: string
    caption: string | null
  }[] = []
  if (dossierIds.length > 0) {
    const { data: photos } = await supabase
      .from('photos')
      .select('id, thumb_path, storage_path, caption, created_at')
      .eq('organization_id', orgId)
      .in('dossier_id', dossierIds)
      .order('created_at', { ascending: false })
      .limit(48)
    photoRows = photos ?? []
  }

  // 4.5 Chantier C + D (FIX-KK §C, §D) — relations bien ↔ clients +
  //                                       historique ownership + clients liste
  const [stakeholdersRes, ownershipHistoryRes, allClientsRes] = await Promise.all([
    sb
      .from('property_client_relationships')
      .select(
        'id, client_id, role, is_current, started_at, ended_at, ownership_share, clients(display_name)',
      )
      .eq('property_id', id)
      .eq('organization_id', orgId)
      .order('is_current', { ascending: false })
      .order('started_at', { ascending: false }),
    sb
      .from('property_ownership_history')
      .select(
        'id, transaction_date, previous_owner_client_id, new_owner_client_id, transaction_amount_eur, prev:clients!previous_owner_client_id(display_name), next:clients!new_owner_client_id(display_name)',
      )
      .eq('property_id', id)
      .eq('organization_id', orgId)
      .order('transaction_date', { ascending: false }),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .limit(500),
  ])

  const stakeholders: StakeholderRelationship[] = (
    (stakeholdersRes.data ?? []) as Array<{
      id: string
      client_id: string
      role: PropertyRelationshipRole
      is_current: boolean
      started_at: string
      ended_at: string | null
      ownership_share: number | string | null
      clients?: { display_name?: string | null } | { display_name?: string | null }[] | null
    }>
  ).map((r) => {
    const clientRow = Array.isArray(r.clients) ? r.clients[0] : r.clients
    const share =
      r.ownership_share === null || r.ownership_share === undefined
        ? null
        : Number(r.ownership_share)
    return {
      id: r.id,
      client_id: r.client_id,
      client_name: clientRow?.display_name ?? null,
      role: r.role,
      is_current: r.is_current,
      started_at: r.started_at,
      ended_at: r.ended_at,
      ownership_share: share,
    }
  })

  const ownershipHistory = (
    (ownershipHistoryRes.data ?? []) as Array<{
      id: string
      transaction_date: string
      previous_owner_client_id: string | null
      new_owner_client_id: string | null
      transaction_amount_eur: number | string | null
      prev?: { display_name?: string | null } | { display_name?: string | null }[] | null
      next?: { display_name?: string | null } | { display_name?: string | null }[] | null
    }>
  ).map((h) => {
    const prev = Array.isArray(h.prev) ? h.prev[0] : h.prev
    const next = Array.isArray(h.next) ? h.next[0] : h.next
    const amount =
      h.transaction_amount_eur === null || h.transaction_amount_eur === undefined
        ? null
        : Number(h.transaction_amount_eur)
    return {
      id: h.id,
      transaction_date: h.transaction_date,
      previous_owner_name: prev?.display_name ?? null,
      new_owner_name: next?.display_name ?? null,
      transaction_amount_eur: amount,
    }
  })

  const allClients = (allClientsRes.data ?? []) as Array<{ id: string; display_name: string }>

  // 5. Dérive dernier DPE et dernier amiante (pour Caractéristiques)
  let lastDpeIso: string | null = null
  let lastAmianteIso: string | null = null
  for (const d of dossiers) {
    const missions = (d.missions ?? []) as {
      type: string
      dpe_letter: string | null
      completed_at: string | null
    }[]
    for (const m of missions) {
      const completed = m.completed_at ?? d.completed_at ?? null
      if (!completed) continue
      if (m.type.startsWith('dpe_') && (!lastDpeIso || completed > lastDpeIso)) {
        lastDpeIso = completed
      }
      if (m.type.startsWith('amiante_') && (!lastAmianteIso || completed > lastAmianteIso)) {
        lastAmianteIso = completed
      }
    }
  }

  // 6. Build dossier items (avec dpe_letter de la première mission DPE trouvée)
  const dossierItems: PropertyDossierItem[] = dossiers.map((d) => {
    const missions = (d.missions ?? []) as {
      type: string
      dpe_letter: string | null
    }[]
    const primaryType = missions[0]?.type ?? null
    const dpeMission = missions.find((m) => m.type.startsWith('dpe_') && m.dpe_letter)
    return {
      id: d.id,
      reference: d.reference,
      status: d.status,
      date_iso: d.scheduled_at ?? d.created_at,
      primary_mission_type: primaryType,
      dpe_letter: dpeMission?.dpe_letter ?? null,
      total_cents: null,
    }
  })

  // 7. Photos pour la galerie — le bucket `mission-photos` est PRIVÉ : on signe
  //    chaque chemin Storage (thumb prioritaire, sinon photo pleine) avant de le
  //    passer aux <img>. Même mécanisme que la galerie du dossier
  //    (createSignedUrls, TTL 1h), mais signé ici côté serveur.
  const photoPaths = photoRows.map((p) => p.thumb_path ?? p.storage_path)
  let signedPhotoUrls: (string | null)[] = []
  if (photoPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('mission-photos')
      .createSignedUrls(photoPaths, 3600)
    signedPhotoUrls = (signed ?? []).map((s) => s?.signedUrl ?? null)
  }
  const galleryPhotos: PropertyPhoto[] = photoRows.map((p, i) => ({
    id: p.id,
    thumb_url: signedPhotoUrls[i] ?? null,
    caption: p.caption,
  }))

  // 8. Specs essential + technical
  const essential: PropertyEssentialSpecs = {
    surface_total: property.surface_total,
    surface_carrez: property.surface_carrez,
    rooms_count: property.rooms_count,
    floor_number: property.floor_number,
    heating_type: property.heating_type,
    year_built: property.year_built,
    last_dpe_iso: lastDpeIso,
    last_amiante_iso: lastAmianteIso,
  }

  const technical: PropertyTechnicalSpecs = {
    cadastre_prefix: property.cadastre_prefix,
    cadastre_section: property.cadastre_section,
    cadastre_number: property.cadastre_number,
    permis_construire: null, // V1 : pas en DB
    zone_abf: null, // V1 : pas en DB
    insee_code: property.insee_code,
  }

  // 9. Contexte local — fetch parallèle DVF (Etalab) + INSEE (geo.api.gouv) + ADEME (data-fair)
  //    Toutes APIs publiques gratuites. Cache Next.js 24h. Fallback null si fetch échoue.
  const localStats = await fetchPublicLocalStats(property.insee_code)
  const contexte: PropertyContexteLocalData = {
    dvfMedianEurM2: localStats.dvfMedianEurM2,
    inseePopulation: localStats.inseePopulation,
    ademeDpeCount: localStats.ademeDpeCount,
    inseeCode: property.insee_code,
    postalCode: property.postal_code,
    city: property.city,
  }

  // 10. Coords GPS (parse PostGIS location column — EWKT ou EWKB hex)
  const propertyLocation = (property as { location?: string | null }).location ?? null
  const coords = parsePropertyLocation(propertyLocation)

  // 11. Adresse mise en forme
  const addressParts = formatPropertyAddress({
    address: property.address,
    postal_code: property.postal_code,
    city: property.city,
    apartment_detail: property.apartment_detail,
    floor_number: property.floor_number,
    building_letter: property.building_letter,
    lot_number: property.lot_number,
  })

  return (
    <>
      {/* Context bar sticky 56px */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 mb-6 flex h-14 items-center justify-between gap-3 border-b border-rule/40 bg-sage/85 px-4 sm:px-6 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/properties" aria-label="Retour aux biens">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="font-sans text-[14px] font-medium text-ink truncate">
            {property.address}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <PropertyContexteLocalSheet data={contexte} />
          <Button variant="ghost" size="sm" asChild aria-label="Modifier le bien">
            <Link href={`/dashboard/properties/${property.id}/edit`}>
              <Pencil className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Barre propriétaire (si rattaché) */}
      {owner ? (
        <Link
          href={`/dashboard/clients/${owner.id}`}
          className="mb-6 -mx-4 sm:-mx-6 flex items-center justify-between gap-3 border-b border-rule/40 bg-sage/50 px-4 sm:px-6 py-3 hover:bg-foreground/5"
          aria-label={`Voir le propriétaire ${owner.display_name}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
              Propriétaire
            </span>
            <span className="text-[13px] font-medium text-ink truncate">{owner.display_name}</span>
            {owner.phone ? (
              <span className="font-mono text-[12px] text-ink-mute hidden sm:inline">
                · {owner.phone}
              </span>
            ) : null}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink shrink-0">
            →
          </span>
        </Link>
      ) : null}

      <div className="space-y-10 animate-fade-in pb-24">
        <PropertyIdentitySection
          property={{
            id: property.id,
            address: addressParts.primary,
            city: property.city,
            postal_code: property.postal_code,
            property_type: property.property_type,
            year_built: property.year_built,
            apartmentLine: addressParts.apartmentLine,
            lat: coords?.lat ?? null,
            lng: coords?.lng ?? null,
          }}
        />

        <PropertyCaracteristiquesSection essential={essential} technical={technical} />

        <PropertyStakeholdersSection
          propertyId={property.id}
          relationships={stakeholders}
          clients={allClients}
          ownershipHistory={ownershipHistory}
        />

        <PropertyDossiersSection dossiers={dossierItems} ademeDpeCount={0} />

        <PropertyGallerieSection photos={galleryPhotos} />

        <DangerZone
          entityLabel="bien"
          onDelete={softDeletePropertyAction.bind(null, property.id)}
        />
      </div>

      <PropertyFab propertyId={property.id} />
    </>
  )
}
