import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { MissionType } from '@kovas/shared'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type DossierListItem, DossiersListClient, type TabKey } from './dossiers-list-client'

export const metadata: Metadata = { title: 'Dossiers' }

type RawDossier = {
  id: string
  reference: string
  status: string
  scheduled_at: string | null
  created_at: string
  properties:
    | { address: string | null; city: string | null; postal_code: string | null }
    | { address: string | null; city: string | null; postal_code: string | null }[]
    | null
  clients: { display_name: string | null } | { display_name: string | null }[] | null
  missions: { type: string }[] | null
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function normalize(dossiers: RawDossier[]): DossierListItem[] {
  return dossiers.map((d) => {
    const property = pickFirst(d.properties)
    const client = pickFirst(d.clients)
    const missionTypes = (d.missions ?? [])
      .map((m) => m.type as MissionType)
      .filter((t): t is MissionType => Boolean(t))
    return {
      id: d.id,
      reference: d.reference,
      status: d.status,
      scheduledAt: d.scheduled_at,
      createdAt: d.created_at,
      property: property
        ? {
            address: property.address,
            city: property.city,
            postalCode: property.postal_code,
          }
        : null,
      client: client ? { displayName: client.display_name } : null,
      missionTypes,
    }
  })
}

function resolveInitialTab(raw: string | undefined): TabKey {
  if (raw === 'in_progress' || raw === 'todo' || raw === 'done') return raw
  return 'all'
}

/**
 * Liste des dossiers — refonte 2026-05.
 *
 * - Server component : fetch initial des dossiers (max 200)
 * - Délègue le filtrage à un client component avec 4 tabs horizontaux
 * - Pas de Kanban, pas de drag-and-drop : liste verticale unique 72px par ligne
 * - Tri : scheduled_at desc fallback created_at desc
 * - Deep link via `?status=` (search param) → mappé en URL hash côté client
 */
export default async function DossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const initialTab = resolveInitialTab(params.status)

  const { supabase, orgId } = await getCurrentUser()

  const { data } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, created_at, properties(address, city, postal_code), clients(display_name), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('scheduled_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(200)

  const dossiers = normalize((data ?? []) as RawDossier[])
  const count = dossiers.length

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="dossiers"
        description={`${count} dossier${count > 1 ? 's' : ''}`}
        action={
          <Button asChild variant="accent">
            <Link href="/dashboard/dossiers/new">
              <Plus className="size-4" />
              Nouveau dossier
            </Link>
          </Button>
        }
      />

      <DossiersListClient dossiers={dossiers} initialTab={initialTab} />
    </div>
  )
}
