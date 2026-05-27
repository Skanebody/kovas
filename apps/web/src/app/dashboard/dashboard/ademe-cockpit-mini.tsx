import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { getCurrentUser } from '@/lib/auth/current-user'
import { planAtLeast } from '@/lib/billing/feature-gates'
import { cn } from '@/lib/utils'
import { ArrowRight, Radar, Settings2 } from 'lucide-react'
import Link from 'next/link'

import { UpsellCard } from './upsell-card'

interface KpiSnapshot {
  risk_score_0_100: number
  risk_level: 'safe' | 'watch' | 'alert' | 'critical'
  dpe_count_12m: number
  avg_distance_between_dpe_km: number | null
  ratio_f_g_30d: number | null
  inconsistency_flags_30d: number
  suspect_distance_count_30d: number
  created_at: string
}

interface ProfileRow {
  linguistic_profile: { certificat_rge?: string; ademe_monitoring_enabled?: boolean } | null
}

const LEVEL_LABEL: Record<KpiSnapshot['risk_level'], string> = {
  safe: 'risque faible',
  watch: 'vigilance',
  alert: 'alerte',
  critical: 'critique',
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  return `${d} j`
}

/**
 * Section 03 — Cockpit ADEME (panel navy plein, flagship widget).
 *
 * 3 états :
 *   1. Plan < Découverte → UpsellCard "Cockpit ADEME · Pack Découverte ou +"
 *   2. Plan OK mais cert RGE manquant → Card config prompt sobre
 *   3. Plan OK + cert OK + monitoring ON + snapshot existant → panel navy plein
 *      avec status pulse + 3 métriques + CTA "Voir le cockpit complet"
 *
 * Le panel navy est dark `#0F1419` avec bordures internes white/8-10. Status
 * bar avec dot animé pulse 2s. 3 métriques (volume / distance / ratio F/G)
 * chacune avec label mono uppercase + valeur mono medium + barre proportionnelle.
 */
export async function AdemeCockpitMini() {
  const { supabase, orgId, user } = await getCurrentUser()

  // 1. Lit subscription pour gating plan
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_code')
    .eq('organization_id', orgId)
    .maybeSingle()

  const subTyped = sub as { plan_code?: string } | null

  // État 1 : Plan < Découverte → UpsellCard
  if (!planAtLeast(subTyped?.plan_code, 'decouverte')) {
    return (
      <UpsellCard
        sectionNumber="03"
        sectionTitle="Cockpit ADEME"
        moduleName="Cockpit ADEME · monitoring rétroactif"
        description="Surveillance automatique des DPE publiés sur l'API ADEME. Détection des dépassements de seuils (volume 1000/an), distances suspectes, ratios F/G hors norme. Alertes avant que l'ADEME ne te contacte."
        requiredPlanOrAddon="Pack Découverte ou +"
        priceLabel="à partir de 19 € HT/mois"
        activateHref="/pricing"
        ctaLabel="Découvrir"
        minH="420px"
      />
    )
  }

  // 2. Lit profile pour cert RGE + monitoring activé
  const { data: profile } = (await supabase
    .from('profiles')
    .select('linguistic_profile')
    .eq('id', user.id)
    .maybeSingle()) as { data: ProfileRow | null }

  const linguistic = profile?.linguistic_profile ?? {}

  // État 2 : Plan OK mais cert RGE manquant → prompt config
  if (!linguistic.certificat_rge || linguistic.ademe_monitoring_enabled !== true) {
    return (
      <Card variant="opaque" padding="none" className="flex flex-col" style={{ minHeight: 420 }}>
        <header className="flex items-center justify-between gap-3 border-b border-rule/60 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
            <span className="text-ink-mute">03 ·</span> Cockpit ADEME
          </p>
          <span className="font-mono text-[10px] text-ink-mute tracking-[0.08em] uppercase inline-flex items-center gap-1">
            <Settings2 className="size-3" aria-hidden /> À configurer
          </span>
        </header>
        <div className="flex-1 flex flex-col justify-between p-5 gap-5">
          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="size-9 rounded-md bg-sage flex items-center justify-center shrink-0"
              >
                <Radar className="size-4 text-ink" />
              </span>
              <div className="space-y-1">
                <p className="font-serif italic text-xl text-ink leading-tight">
                  Active le monitoring rétroactif
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
                  Inclus dans ton forfait
                </p>
              </div>
            </div>
            <p className="text-[13px] text-ink-mute leading-relaxed">
              Renseigne ton numéro de certificat <GlossaryTerm term="rge">RGE</GlossaryTerm> pour
              démarrer la surveillance quotidienne de tes{' '}
              <GlossaryTerm term="dpe">DPE</GlossaryTerm> publiés sur l&apos;API{' '}
              <GlossaryTerm term="ademe">ADEME</GlossaryTerm>. Configuration en 30 secondes.
            </p>
          </div>
          <Button asChild variant="default" size="sm" className="w-full sm:w-auto self-start">
            <Link href="/dashboard/account">
              Configurer <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </Card>
    )
  }

  // 3. Lit dernier snapshot
  const snapshotRes = (await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => {
              limit: (n: number) => { maybeSingle: () => Promise<{ data: KpiSnapshot | null }> }
            }
          }
        }
      }
    }
  )
    .from('ademe_kpi_snapshots')
    .select(
      'risk_score_0_100, risk_level, dpe_count_12m, avg_distance_between_dpe_km, ratio_f_g_30d, inconsistency_flags_30d, suspect_distance_count_30d, created_at',
    )
    .eq('organization_id', orgId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: KpiSnapshot | null }

  const snapshot = snapshotRes.data

  // Pas de snapshot : afficher état "première sync en cours"
  if (!snapshot) {
    return (
      <Card
        variant="opaque"
        padding="none"
        className="bg-[#0F1419] text-white border-[#0F1419] flex flex-col"
        style={{ minHeight: 420 }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-white">
            <span className="text-white/60">03 ·</span> Cockpit ADEME
          </p>
          <span className="font-mono text-[10px] text-white/60 tracking-[0.08em] uppercase">
            Sync en cours
          </span>
        </header>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="space-y-2">
            <Radar className="size-6 text-chartreuse mx-auto animate-pulse" aria-hidden />
            <p className="text-sm text-white/90">Première synchronisation en cours</p>
            <p className="font-mono text-[11px] text-white/60 max-w-[280px]">
              La sync ADEME quotidienne tournera cette nuit à 02:00 UTC.
            </p>
          </div>
        </div>
      </Card>
    )
  }

  // État 3 : panel navy plein avec métriques
  const dpeRatio = Math.min(snapshot.dpe_count_12m / 1000, 1)
  const distance = snapshot.avg_distance_between_dpe_km ?? 0
  const distanceRatio = Math.min(distance / 40, 1) // 40km = seuil ADEME
  const ratioFg = (snapshot.ratio_f_g_30d ?? 0) * 100
  const ratioFgRatio = Math.min(ratioFg / 50, 1) // 50% est extrême

  return (
    <Card
      variant="opaque"
      padding="none"
      className="bg-[#0F1419] text-white border-[#0F1419] flex flex-col"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-white">
          <span className="text-white/60">03 ·</span> Cockpit ADEME
        </p>
        <span className="font-mono text-[11px] text-white/50 tracking-[0.05em]">
          MAJ il y a {timeAgoShort(snapshot.created_at)}
        </span>
      </header>

      {/* Status bar avec pulse */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full animate-pulse',
            snapshot.risk_level === 'critical' || snapshot.risk_level === 'alert'
              ? 'bg-accent-red'
              : snapshot.risk_level === 'watch'
                ? 'bg-chartreuse'
                : 'bg-white',
          )}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] font-medium text-white">
          Surveillance active · {LEVEL_LABEL[snapshot.risk_level]}
        </span>
      </div>

      {/* 3 métriques */}
      <Metric
        label="Volume 12 mois glissants"
        value={`${snapshot.dpe_count_12m.toLocaleString('fr-FR')} / 1 000`}
        barPct={dpeRatio * 100}
        barColor={dpeRatio >= 0.95 ? 'red' : dpeRatio >= 0.8 ? 'amber' : 'white'}
        sub={
          dpeRatio < 0.8
            ? 'Marge confortable · seuil ADEME : 1 000'
            : dpeRatio < 0.95
              ? 'Vigilance · seuil ADEME approche'
              : 'Suspension automatique imminente'
        }
      />
      <Metric
        label="Distance moy. entre DPE"
        value={`${distance.toFixed(1)} km`}
        barPct={distanceRatio * 100}
        barColor={distance >= 40 ? 'red' : distance >= 25 ? 'amber' : 'white'}
        sub={
          distance < 25
            ? 'Sous seuil 40 km · OK'
            : distance < 40
              ? 'Distance importante · rester vigilant'
              : 'Distance suspecte au-delà du seuil ADEME'
        }
      />
      <Metric
        label="Taux F/G (30 j)"
        value={`${ratioFg.toFixed(1)} %`}
        barPct={ratioFgRatio * 100}
        barColor={ratioFg > 35 ? 'amber' : 'white'}
        sub="Moyenne nationale : 22,1 %"
        last
      />

      <footer className="border-t border-white/10 p-4">
        <Button
          asChild
          variant="outline"
          size="default"
          className="w-full bg-white text-[#0F1419] hover:bg-white/90 border-white"
        >
          <Link href="/dashboard/cockpit-ademe">
            Voir le cockpit complet <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </footer>
    </Card>
  )
}

function Metric({
  label,
  value,
  barPct,
  barColor,
  sub,
  last = false,
}: {
  label: string
  value: string
  barPct: number
  barColor: 'white' | 'amber' | 'red'
  sub: string
  last?: boolean
}) {
  return (
    <div className={cn('px-5 py-4', !last && 'border-b border-white/[0.08]')}>
      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/50 mb-1.5">
        {label}
      </p>
      <p className="font-mono text-[18px] font-medium text-white tabular-nums">{value}</p>
      <div className="mt-2 h-[2px] bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            barColor === 'white' && 'bg-white',
            barColor === 'amber' && 'bg-accent-warm',
            barColor === 'red' && 'bg-accent-red',
          )}
          style={{ width: `${barPct}%` }}
        />
      </div>
      <p className="font-mono text-[10px] text-white/50 mt-1.5">{sub}</p>
    </div>
  )
}
