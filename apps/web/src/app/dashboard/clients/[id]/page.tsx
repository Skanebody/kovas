import {
  ArrowLeft,
  Building2,
  FileText,
  FolderOpen,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Receipt,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClientDocumentsTab } from './_tabs/documents-tab'
import { ClientDossiersTab } from './_tabs/dossiers-tab'
import { ClientFacturesTab } from './_tabs/factures-tab'
import { ClientDevisTab } from './_tabs/devis-tab'
import { ClientStatsCard } from './_tabs/stats-card'
import { DangerZone } from '@/components/danger-zone'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageTabs } from '@/components/ui/page-tabs'
import { getCurrentUser } from '@/lib/auth/current-user'
import { formatFullAddress } from '@/lib/format-address'
import { isBusinessClientType } from '@/lib/validation/client'
import { deleteClientAction } from '../actions'

export const metadata: Metadata = { title: 'Détail client' }

const TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  agence: 'Agence',
  notaire: 'Notaire',
  syndic: 'Syndic',
  entreprise: 'Entreprise',
  collectivite: 'Collectivité',
}

type TabKey = 'devis' | 'factures' | 'dossiers' | 'documents'
const VALID_TABS: readonly TabKey[] = ['devis', 'factures', 'dossiers', 'documents']

function isValidTab(value: string | undefined): value is TabKey {
  return typeof value === 'string' && (VALID_TABS as readonly string[]).includes(value)
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab: rawTab } = await searchParams
  const { supabase, orgId } = await getCurrentUser()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  // ============================================
  // Comptages par section (parallèles, head:true)
  // ============================================
  const [
    { count: dossiersCount },
    { count: devisCount },
    { count: facturesCount },
    { data: lastDevis },
    { data: lastFacture },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('client_id', id)
      .is('deleted_at', null),
    supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('client_id', id),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('client_id', id),
    supabase
      .from('quotes')
      .select('created_at')
      .eq('organization_id', orgId)
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('invoices')
      .select('created_at')
      .eq('organization_id', orgId)
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const dossierTotal = dossiersCount ?? 0
  const devisTotal = devisCount ?? 0
  const facturesTotal = facturesCount ?? 0

  // ============================================
  // Onglet par défaut intelligent
  // ============================================
  function resolveDefaultTab(): TabKey {
    if (devisTotal === 0 && facturesTotal === 0) return 'dossiers'
    const devisAt = lastDevis?.created_at ? new Date(lastDevis.created_at).getTime() : 0
    const facAt = lastFacture?.created_at ? new Date(lastFacture.created_at).getTime() : 0
    if (devisAt > facAt) return 'devis'
    if (facAt > 0) return 'factures'
    return 'dossiers'
  }

  const activeTab: TabKey = isValidTab(rawTab) ? rawTab : resolveDefaultTab()

  const addressLines = formatFullAddress(client)
  const personName = [client.first_name, client.last_name].filter(Boolean).join(' ')
  const business = isBusinessClientType(client.type)
  const typeLabel = TYPE_LABELS[client.type] ?? client.type
  const cityLine = [client.postal_code, client.city].filter(Boolean).join(' ')

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/clients">
          <ArrowLeft className="size-4" /> Retour aux clients
        </Link>
      </Button>

      {/* ============================================
          Header fiche client — Qonto pattern
          ============================================ */}
      <section className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="flex flex-col gap-5">
          {/* Ligne identité */}
          <div className="flex items-start gap-4">
            <Avatar
              name={client.display_name}
              size="lg"
              className="size-16 text-lg bg-navy text-chartreuse font-semibold"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink truncate">
                  {client.display_name}
                </h1>
                <Badge variant="muted" className="uppercase tracking-wider">
                  {typeLabel}
                </Badge>
                {dossierTotal >= 5 && (
                  <Badge variant="amber" className="uppercase tracking-wider">
                    Fidèle
                  </Badge>
                )}
              </div>
              {personName && client.company_name ? (
                <p className="text-sm text-ink-mute">
                  Contact : <span className="text-ink">{personName}</span>
                </p>
              ) : null}
            </div>
            <Button variant="glass" size="sm" asChild className="shrink-0">
              <Link href={`/dashboard/clients/${client.id}/edit`}>
                <Pencil className="size-4" /> Modifier
              </Link>
            </Button>
          </div>

          {/* Grille coordonnées 4 colonnes desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-3 border-t border-rule/40 pt-4">
            <CoordCell
              icon={Phone}
              label="Téléphone"
              value={client.phone}
              href={client.phone ? `tel:${client.phone}` : undefined}
            />
            <CoordCell
              icon={Mail}
              label="Email"
              value={client.email}
              href={client.email ? `mailto:${client.email}` : undefined}
            />
            <CoordCell
              icon={MapPin}
              label="Adresse"
              value={addressLines[0] ?? null}
              secondary={cityLine || null}
            />
            <CoordCell
              icon={Building2}
              label="SIRET"
              value={business && client.siret ? client.siret : null}
              mono
            />
          </div>

          {/* Row actions Qonto-like */}
          <div className="flex flex-wrap items-center gap-2 border-t border-rule/40 pt-4">
            {client.phone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${client.phone}`}>
                  <Phone className="size-4" />
                  Appeler
                </a>
              </Button>
            ) : null}
            {client.phone ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`sms:${client.phone}`}>
                  <MessageSquare className="size-4" />
                  SMS
                </a>
              </Button>
            ) : null}
            {client.email ? (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${client.email}`}>
                  <Mail className="size-4" />
                  Email
                </a>
              </Button>
            ) : null}
            <Button variant="default" size="sm" asChild>
              <Link href={`/dashboard/devis/new?client_id=${client.id}`}>
                <FileText className="size-4" />
                Devis
              </Link>
            </Button>
            <Button variant="accent" size="sm" asChild>
              <Link href={`/dashboard/factures/new?client_id=${client.id}`}>
                <Receipt className="size-4" />
                Facture
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================
          Statistiques client (4 KPI)
          ============================================ */}
      <ClientStatsCard
        clientId={client.id}
        orgId={orgId}
        dossierTotal={dossierTotal}
      />

      {/* ============================================
          Tabs navigation
          ============================================ */}
      <PageTabs
        basePath={`/dashboard/clients/${client.id}`}
        active={activeTab}
        tabs={[
          { key: 'devis', label: 'Devis', icon: FileText, count: devisTotal },
          { key: 'factures', label: 'Factures', icon: Receipt, count: facturesTotal },
          { key: 'dossiers', label: 'Dossiers', icon: FolderOpen, count: dossierTotal },
          { key: 'documents', label: 'Documents', icon: FileText },
        ]}
      />

      {/* ============================================
          Contenu actif (serveur)
          ============================================ */}
      <div className="space-y-6">
        {activeTab === 'devis' && (
          <ClientDevisTab clientId={client.id} orgId={orgId} />
        )}
        {activeTab === 'factures' && (
          <ClientFacturesTab clientId={client.id} orgId={orgId} />
        )}
        {activeTab === 'dossiers' && (
          <ClientDossiersTab clientId={client.id} orgId={orgId} />
        )}
        {activeTab === 'documents' && (
          <ClientDocumentsTab clientId={client.id} orgId={orgId} />
        )}
      </div>

      {/* Notes internes — affichage compact si présent */}
      {client.notes ? (
        <div className="rounded-xl border border-rule/60 bg-paper/85 p-5 shadow-glass-sm">
          <div className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute mb-2">
            Notes internes
          </div>
          <p className="text-sm whitespace-pre-wrap text-ink-soft">{client.notes}</p>
        </div>
      ) : null}

      <DangerZone
        entityLabel="client"
        onDelete={deleteClientAction.bind(null, client.id)}
      />
    </div>
  )
}

// ============================================
// Cellule coordonnées — pattern Qonto
// ============================================
type CoordCellProps = {
  icon: typeof Phone
  label: string
  value?: string | null
  secondary?: string | null
  href?: string
  mono?: boolean
}

function CoordCell({ icon: Icon, label, value, secondary, href, mono }: CoordCellProps) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <div className="shrink-0 size-9 rounded-pill bg-cream-deep flex items-center justify-center">
        <Icon className="size-4 text-ink-mute" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          {label}
        </div>
        {value ? (
          href ? (
            <a
              href={href}
              className={
                'block truncate text-sm text-ink hover:underline ' +
                (mono ? 'font-mono tracking-tight' : '')
              }
            >
              {value}
            </a>
          ) : (
            <div
              className={
                'block truncate text-sm text-ink ' + (mono ? 'font-mono tracking-tight' : '')
              }
            >
              {value}
            </div>
          )
        ) : (
          <div className="text-sm text-ink-ghost italic">Non renseigné</div>
        )}
        {secondary ? <div className="truncate text-xs text-ink-mute">{secondary}</div> : null}
      </div>
    </div>
  )
}
