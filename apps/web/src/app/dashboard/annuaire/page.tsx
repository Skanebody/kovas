/**
 * KOVAS — Page /dashboard/annuaire
 *
 * Édition de la fiche publique du diagnostiqueur sur l'annuaire
 * /trouver-un-diagnostiqueur.
 *
 * Layout :
 *  - Sticky header Qonto pattern
 *  - 4 KPI cards (visites mois / leads / note GMB / statut publication)
 *  - 2 colonnes : preview gauche (3/5) + formulaire droit (2/5)
 *  - Section stats (graphique + top villes + conversion leads)
 *
 * Si l'utilisateur n'a pas revendiqué de fiche : empty state pédagogique.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { BarChart3, Eye, Inbox, MapPin, ShieldCheck, Star } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AnnuaireEditForm } from './AnnuaireEditForm'
import { AnnuairePreview } from './AnnuairePreview'

export const metadata: Metadata = { title: 'Mon annuaire' }
export const dynamic = 'force-dynamic'

interface DiagnosticianRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  city: string | null
  city_slug: string | null
  department_code: string | null
  dept_code: string | null
  slug: string | null
  gmb_rating: number | null
}

interface PublicProfileRow {
  bio_short: string | null
  bio_long: string | null
  intervention_zones: unknown
  opening_hours: unknown
  specialties: unknown
}

interface VerificationRow {
  overall_status: string | null
  badge_level: string | null
}

interface AnnuaireData {
  diagnostician: DiagnosticianRow | null
  profile: PublicProfileRow | null
  verification: VerificationRow | null
  views_this_month: number
  leads_received: number
  top_cities: ReadonlyArray<{ city: string; count: number }>
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asOpeningHours(value: unknown): Record<string, { open: string; close: string }> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, { open: string; close: string }> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      v &&
      typeof v === 'object' &&
      'open' in (v as Record<string, unknown>) &&
      'close' in (v as Record<string, unknown>)
    ) {
      const open = (v as { open: unknown }).open
      const close = (v as { close: unknown }).close
      if (typeof open === 'string' && typeof close === 'string') {
        out[k] = { open, close }
      }
    }
  }
  return out
}

async function loadAnnuaireData(): Promise<AnnuaireData> {
  const { user, supabase } = await getCurrentUser()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  try {
    // biome-ignore lint/suspicious/noExplicitAny: diagnosticians table types pending regen
    const diagRes = await (supabase as any)
      .from('diagnosticians')
      .select(
        'id, full_name, first_name, last_name, city, city_slug, department_code, dept_code, slug, gmb_rating',
      )
      .eq('claimed_by_user_id', user.id)
      .maybeSingle()
    const diagnostician = (diagRes.data as DiagnosticianRow | null) ?? null
    if (!diagnostician) {
      return {
        diagnostician: null,
        profile: null,
        verification: null,
        views_this_month: 0,
        leads_received: 0,
        top_cities: [],
      }
    }

    const [profileRes, verifRes, viewsRes, topCitiesRes, leadsRes] = await Promise.all([
      // biome-ignore lint/suspicious/noExplicitAny: diagnostician_public_profile table types pending regen
      (supabase as any)
        .from('diagnostician_public_profile')
        .select('bio_short, bio_long, intervention_zones, opening_hours, specialties')
        .eq('diagnostician_id', diagnostician.id)
        .maybeSingle(),
      // biome-ignore lint/suspicious/noExplicitAny: diagnostician_verification_status table types pending regen
      (supabase as any)
        .from('diagnostician_verification_status')
        .select('overall_status, badge_level')
        .eq('diagnostician_id', diagnostician.id)
        .maybeSingle(),
      // biome-ignore lint/suspicious/noExplicitAny: diagnostician_profile_views table types pending regen
      (supabase as any)
        .from('diagnostician_profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('diagnostician_id', diagnostician.id)
        .gte('viewed_at', monthStart.toISOString()),
      // biome-ignore lint/suspicious/noExplicitAny: diagnostician_profile_views table types pending regen
      (supabase as any)
        .from('diagnostician_profile_views')
        .select('visitor_city')
        .eq('diagnostician_id', diagnostician.id)
        .not('visitor_city', 'is', null)
        .gte('viewed_at', monthStart.toISOString())
        .limit(500),
      // biome-ignore lint/suspicious/noExplicitAny: leads table types pending regen
      (supabase as any)
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_diagnostician_id', diagnostician.id)
        .gte('created_at', monthStart.toISOString()),
    ])

    // Top 5 villes — agrégation côté Node (la table est petite)
    const cityCounts = new Map<string, number>()
    const topRows = (topCitiesRes.data as Array<{ visitor_city: string | null }> | null) ?? []
    for (const row of topRows) {
      if (row.visitor_city) {
        cityCounts.set(row.visitor_city, (cityCounts.get(row.visitor_city) ?? 0) + 1)
      }
    }
    const topCities = Array.from(cityCounts.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    return {
      diagnostician,
      profile: (profileRes.data as PublicProfileRow | null) ?? null,
      verification: (verifRes.data as VerificationRow | null) ?? null,
      views_this_month: viewsRes.count ?? 0,
      leads_received: leadsRes.count ?? 0,
      top_cities: topCities,
    }
  } catch {
    return {
      diagnostician: null,
      profile: null,
      verification: null,
      views_this_month: 0,
      leads_received: 0,
      top_cities: [],
    }
  }
}

function buildPublicHref(d: DiagnosticianRow): string | null {
  const dept = d.department_code ?? d.dept_code
  const city = d.city_slug
  const slug = d.slug
  if (!dept || !city || !slug) return null
  return `/trouver-un-diagnostiqueur/${dept}/${city}/${slug}`
}

function buildFullName(d: DiagnosticianRow): string | null {
  if (d.full_name && d.full_name.trim().length > 0) return d.full_name
  const composed = [d.first_name, d.last_name].filter(Boolean).join(' ').trim()
  return composed.length > 0 ? composed : null
}

export default async function AnnuairePage() {
  const data = await loadAnnuaireData()

  // ────────────────────────────────────────────────────────
  // Empty state si pas de fiche revendiquée
  // ────────────────────────────────────────────────────────
  if (!data.diagnostician) {
    return (
      <div className="space-y-6 animate-fade-in">
        <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Annuaire
            </p>
            <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink">
              Votre <span className="font-serif italic font-normal text-ink-mute">fiche</span>{' '}
              publique
              <span className="text-ink-mute">.</span>
            </h1>
            <p className="text-sm text-ink-mute max-w-xl">
              Visible sur kovas.fr/trouver-un-diagnostiqueur.
            </p>
          </div>
        </header>

        <EmptyState
          icon={Inbox}
          title="Aucune fiche revendiquée."
          description="Pour gérer une fiche publique, vous devez d'abord revendiquer votre profil sur l'annuaire KOVAS. La vérification prend 24-48 heures (COFRAC + Sirene + RC Pro)."
          action={
            <Button asChild>
              <Link href="/trouver-un-diagnostiqueur">Trouver ma fiche</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const d = data.diagnostician
  const fullName = buildFullName(d)
  const publicHref = buildPublicHref(d)
  const interventionZones = asStringArray(data.profile?.intervention_zones)
  const specialties = asStringArray(data.profile?.specialties)
  const openingHours = asOpeningHours(data.profile?.opening_hours)
  const isVerified = data.verification?.overall_status === 'verified'

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ============================================
          Header sticky Qonto pattern
          ============================================ */}
      <header className="sticky top-0 z-20 -mx-4 sm:mx-0 rounded-none sm:rounded-xl border-b sm:border border-rule/60 bg-paper/95 backdrop-blur-xl px-4 sm:px-7 py-5 shadow-glass-sm">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">Annuaire</p>
          <h1 className="font-sans text-[28px] font-semibold leading-tight tracking-tight text-ink">
            Votre <span className="font-serif italic font-normal text-ink-mute">fiche</span>{' '}
            publique
            <span className="text-ink-mute">.</span>
          </h1>
          <p className="text-sm text-ink-mute max-w-xl">
            Visible sur kovas.fr/trouver-un-diagnostiqueur. Modifiez votre présentation, vos zones
            d'intervention et vos horaires.
          </p>
        </div>
      </header>

      {/* ============================================
          4 KPI cards
          ============================================ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCell icon={Eye} label="Visites ce mois" value={String(data.views_this_month)} />
        <KpiCell icon={Inbox} label="Leads reçus" value={String(data.leads_received)} />
        <KpiCell
          icon={Star}
          label="Note Google"
          value={d.gmb_rating !== null ? d.gmb_rating.toFixed(1) : '—'}
        />
        <KpiCell
          icon={ShieldCheck}
          label="Publication"
          value={isVerified ? 'Vérifié' : 'En attente'}
        />
      </div>

      {/* ============================================
          Preview + formulaire (2 colonnes desktop)
          ============================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 order-2 lg:order-1">
          <AnnuairePreview
            fullName={fullName}
            city={d.city}
            department={d.department_code ?? d.dept_code}
            bioShort={data.profile?.bio_short ?? null}
            bioLong={data.profile?.bio_long ?? null}
            interventionZones={interventionZones}
            specialties={specialties}
            openingHours={openingHours}
            publicHref={publicHref}
            isVerified={isVerified}
            gmbRating={d.gmb_rating}
          />
        </div>
        <div className="lg:col-span-2 order-1 lg:order-2">
          <AnnuaireEditForm
            initial={{
              bio_short: data.profile?.bio_short ?? '',
              bio_long: data.profile?.bio_long ?? '',
              intervention_zones: interventionZones,
              opening_hours: openingHours,
              specialties,
            }}
          />
        </div>
      </div>

      {/* ============================================
          Statistiques publiques
          ============================================ */}
      <Card variant="flat" padding="sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-ink-faint" />
            <h3 className="text-[13px] font-semibold text-ink">Statistiques publiques (ce mois)</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-3">
              Top 5 villes des visiteurs
            </p>
            {data.top_cities.length === 0 ? (
              <p className="text-[12.5px] text-ink-faint italic">
                Pas encore assez de visites pour calculer cette statistique.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.top_cities.map((row) => (
                  <li key={row.city} className="flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-1 text-ink">
                      <MapPin className="size-3.5 text-ink-faint" />
                      {row.city}
                    </span>
                    <span className="font-mono text-ink-mute">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-3">
              Taux de conversion visites → leads
            </p>
            <p className="font-serif italic text-3xl text-ink leading-none">
              {data.views_this_month > 0
                ? `${((data.leads_received / data.views_this_month) * 100).toFixed(1)} %`
                : '—'}
            </p>
            <p className="text-[12px] text-ink-mute mt-2 leading-relaxed">
              Moyenne marché : 3 à 8 %. Pour augmenter le taux : photo de profil soignée, bio
              détaillée, horaires complets, réponses GMB.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================================================
// Helpers
// ============================================================

function KpiCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper/85 px-4 py-3 shadow-glass-xs">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-3.5 text-ink-faint" aria-hidden />
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          {label}
        </div>
      </div>
      <div className="text-base font-semibold text-ink tabular-nums">{value}</div>
    </div>
  )
}
