/**
 * /admin/sante-tech — Section AI Economics (Lot B57).
 *
 * Surface les 4 leviers d'économie IA livrés en B47-B50 sous forme de
 * projections statiques (hypothèses moyennes en steady-state). Vise deux
 * publics :
 *   1. Benjamin (pilotage interne) : voir le ROI concret des optimisations
 *      Anthropic / Vision empilées sur la stack.
 *   2. Pitch acqui-target Liciel/Enersweet : prouver que la marge brute 80%
 *      n'est pas un slide mais le résultat de techniques mesurables.
 *
 * Les 4 leviers couverts :
 *   - B47 — Cascading Haiku → Sonnet dynamique (escalation confidence)
 *   - B48 — Equipment cache progressif app-level (Vision IA)
 *   - B49 — Recompute incrémental (édition mission)
 *   - B50 — Tools filtering par MissionType (tokens inputs)
 *
 * Lots futurs : cron monthly + lecture analytics.ai_cost_metrics pour
 * remplacer les inputs par défaut par des données temps réel.
 *
 * Authority : CLAUDE.md §7bis (autonomy strategy) + docs/refonte-2026-05/AI_ECONOMICS.md
 */

import { Card } from '@/components/ui/card'
import { estimateCascadingSavings } from '@/lib/ai/cascading'
import { estimateRecomputeSavings } from '@/lib/ai/incremental-recompute'
import { estimateToolFilteringSavings } from '@/lib/ai/tools-filter'
import { estimateEquipmentCacheSavings } from '@/lib/cache/equipment-models'
import { Boxes, Database, Layers, Wrench } from 'lucide-react'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Santé tech — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─────────────────────────────────────────────────────────────────────────
// Helpers de formatage (sobre, vouvoiement implicite via labels neutres)
// ─────────────────────────────────────────────────────────────────────────

function formatEur(amount: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatPct(p: number, fractionDigits = 1): string {
  return `${p.toFixed(fractionDigits)} %`
}

// ─────────────────────────────────────────────────────────────────────────
// Hypothèses par défaut — calibrées sur steady-state ~2000 users payants
// (cf. AI_ECONOMICS.md § Hypothèses de projection)
// ─────────────────────────────────────────────────────────────────────────

const DEFAULTS = {
  cascading: { totalAnalyses: 5000, escalationRate: 0.3 },
  equipment: { totalAnalyses: 1500, cacheHitRate: 0.9 },
  recompute: { totalEdits: 2000, changedFieldsPerEdit: 2 },
  tools: { totalCalls: 5000 },
} as const

export default function AdminSanteTechPage() {
  // Tous les helpers sont pure-fn synchrones — pas d'IO Supabase pour ce lot.
  const cascading = estimateCascadingSavings(DEFAULTS.cascading)
  const equipment = estimateEquipmentCacheSavings(DEFAULTS.equipment)
  const recompute = estimateRecomputeSavings(DEFAULTS.recompute)
  const tools = estimateToolFilteringSavings(DEFAULTS.tools)

  const totalSaved =
    cascading.saved_eur + equipment.saved_eur + recompute.saved_eur + tools.saved_eur
  const totalBaseline =
    cascading.baseline_cost_eur +
    equipment.baseline_cost_eur +
    recompute.baseline_cost_eur +
    tools.baseline_cost_eur

  return (
    <div className="space-y-8 animate-fade-in motion-reduce:animate-none">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Santé tech · AI Economics
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          Économies IA <span className="font-serif italic font-normal">projetées</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute max-w-2xl">
          Projection mensuelle agrégée des 4 leviers d&apos;optimisation IA livrés en B47-B50.
          Hypothèses de steady-state, pas de mesure temps réel (cron monthly à venir).
        </p>
      </header>

      {/* TOTAL AGRÉGÉ ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Total projeté · mois courant
        </h2>
        <Card variant="accent" padding="lg" className="space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60">
              Économies cumulées 4 leviers
            </p>
            <p className="font-serif italic font-normal text-paper leading-none text-6xl md:text-7xl">
              {formatEur(totalSaved)}
            </p>
            <p className="text-sm text-paper/70">par mois projeté · steady-state</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <SubMetric
              label="Baseline (sans optim)"
              value={formatEur(totalBaseline)}
              hint="Coût mensuel projeté si aucune optimisation IA appliquée"
            />
            <SubMetric
              label="Coût optimisé"
              value={formatEur(totalBaseline - totalSaved)}
              hint="Coût mensuel projeté avec les 4 leviers actifs"
            />
            <SubMetric
              label="Réduction globale"
              value={totalBaseline > 0 ? formatPct((totalSaved / totalBaseline) * 100) : '—'}
              hint="Pondérée par le poids relatif des 4 leviers"
            />
          </div>
        </Card>
      </section>

      {/* 4 LEVIERS DÉTAILLÉS ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-sm font-mono uppercase tracking-[0.06em] text-ink-mute">
          Détail par levier
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* B47 — Cascading Haiku → Sonnet */}
          <LeverCard
            icon={<Layers className="size-4" />}
            lotRef="B47"
            title="Cascading Haiku → Sonnet"
            subtitle="Escalation dynamique selon confidence Haiku"
            savedEur={cascading.saved_eur}
            savedPct={cascading.saved_pct}
            inputs={[
              { label: 'Analyses / mois', value: formatInt(DEFAULTS.cascading.totalAnalyses) },
              {
                label: "Taux d'escalation",
                value: formatPct(DEFAULTS.cascading.escalationRate * 100, 0),
              },
            ]}
            outputs={[
              {
                label: 'Coût baseline (100 % Sonnet)',
                value: formatEur(cascading.baseline_cost_eur),
              },
              { label: 'Coût cascading', value: formatEur(cascading.cascading_cost_eur) },
            ]}
            note="70 % des analyses résolues par Haiku ($1/$5 Mtoken). Les 30 % restants escaladés vers Sonnet ($3/$15) si confidence < 0,85."
          />

          {/* B48 — Equipment cache */}
          <LeverCard
            icon={<Database className="size-4" />}
            lotRef="B48"
            title="Equipment cache progressif"
            subtitle="App-level cache des couples (brand, model) Vision"
            savedEur={equipment.saved_eur}
            savedPct={equipment.saved_pct}
            inputs={[
              {
                label: 'Analyses Vision / mois',
                value: formatInt(DEFAULTS.equipment.totalAnalyses),
              },
              {
                label: 'Cache hit rate',
                value: formatPct(DEFAULTS.equipment.cacheHitRate * 100, 0),
              },
            ]}
            outputs={[
              {
                label: 'Coût baseline (100 % Vision)',
                value: formatEur(equipment.baseline_cost_eur),
              },
              { label: 'Coût avec cache', value: formatEur(equipment.cache_cost_eur) },
            ]}
            note="Steady-state visé après 6 mois : top 100 modèles couvrent ~90 % du marché FR. Cache miss → fallback Vision Sonnet (~0,015 €/appel)."
          />

          {/* B49 — Recompute incrémental */}
          <LeverCard
            icon={<Wrench className="size-4" />}
            lotRef="B49"
            title="Recompute incrémental"
            subtitle="Recalcule uniquement les analyses dépendantes"
            savedEur={recompute.saved_eur}
            savedPct={recompute.saved_pct}
            inputs={[
              { label: 'Éditions mission / mois', value: formatInt(DEFAULTS.recompute.totalEdits) },
              {
                label: 'Champs modifiés / édition',
                value: String(DEFAULTS.recompute.changedFieldsPerEdit),
              },
            ]}
            outputs={[
              {
                label: 'Coût baseline (recompute complet)',
                value: formatEur(recompute.baseline_cost_eur),
              },
              { label: 'Coût incrémental', value: formatEur(recompute.incremental_cost_eur) },
            ]}
            note="Édition utilisateur ne relance que les analyses dont au moins un champ source a changé (FIELD_DEPENDENCIES). Vs recompute complet à chaque save."
          />

          {/* B50 — Tools filtering */}
          <LeverCard
            icon={<Boxes className="size-4" />}
            lotRef="B50"
            title="Tools filtering par MissionType"
            subtitle="Réduit les tools exposés selon le type de mission"
            savedEur={tools.saved_eur}
            savedPct={tools.saved_pct}
            inputs={[
              { label: 'Appels Sonnet / mois', value: formatInt(DEFAULTS.tools.totalCalls) },
              { label: 'Tokens économisés', value: formatInt(tools.saved_tokens) },
            ]}
            outputs={[
              {
                label: 'Coût baseline (full pool tools)',
                value: formatEur(tools.baseline_cost_eur),
              },
              { label: 'Coût avec filtrage', value: formatEur(tools.filtered_cost_eur) },
            ]}
            note="Au lieu d'exposer les 17 tools (~2550 tokens), on filtre à ~5 tools (~750 tokens) selon MissionType. Économie linéaire sur tokens inputs Sonnet."
          />
        </div>
      </section>

      {/* MÉTHODOLOGIE ─────────────────────────────────────────────────── */}
      <Card variant="opaque" padding="default" className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
          Méthodologie
        </p>
        <div className="space-y-2 text-sm text-ink-mute leading-relaxed">
          <p>
            Les chiffres affichés sont des projections statiques calculées via les helpers{' '}
            <code className="font-mono text-[12px]">estimate*Savings()</code> des 4 modules pure-fn
            livrés en B47-B50. Aucune lecture temps réel{' '}
            <code className="font-mono text-[12px]">analytics.ai_cost_metrics</code> pour ce premier
            lot.
          </p>
          <p>
            Hypothèses moyennes (steady-state ~2 000 users payants) :{' '}
            {formatInt(DEFAULTS.cascading.totalAnalyses)} analyses cascading /{' '}
            {formatInt(DEFAULTS.equipment.totalAnalyses)} appels Vision /{' '}
            {formatInt(DEFAULTS.recompute.totalEdits)} éditions mission /{' '}
            {formatInt(DEFAULTS.tools.totalCalls)} appels Sonnet — par mois.
          </p>
          <p>
            Le taux de change USD→EUR est fixé à 0,92 (helper{' '}
            <code className="font-mono text-[12px]">usdToEur()</code>). Les prix Anthropic sont ceux
            du barème <code className="font-mono text-[12px]">PRICING_USD_PER_MTOK</code>.
          </p>
          <p className="pt-2 border-t border-rule/40">
            Spec détaillée :{' '}
            <code className="font-mono text-[11px]">docs/refonte-2026-05/AI_ECONOMICS.md</code>.
            Évolution prévue : cron mensuel{' '}
            <code className="font-mono text-[11px]">recompute-ai-savings</code> qui agrège les
            vraies métriques observées et remplace les hypothèses par les taux d&apos;escalation,
            cache hit rate et nb champs modifiés mesurés.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Composants internes
// ─────────────────────────────────────────────────────────────────────────

function SubMetric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-paper/50">{label}</p>
      <p className="font-mono text-lg font-semibold text-paper">{value}</p>
      {hint ? <p className="text-[11px] text-paper/50 leading-snug">{hint}</p> : null}
    </div>
  )
}

interface LeverInputOutput {
  label: string
  value: string
}

function LeverCard({
  icon,
  lotRef,
  title,
  subtitle,
  savedEur,
  savedPct,
  inputs,
  outputs,
  note,
}: {
  icon: ReactNode
  lotRef: string
  title: string
  subtitle: string
  savedEur: number
  savedPct: number
  inputs: LeverInputOutput[]
  outputs: LeverInputOutput[]
  note: string
}) {
  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-ink-mute">
          {icon}
          <p className="font-mono text-[10px] uppercase tracking-[0.06em]">Lot {lotRef}</p>
        </div>
        <h3 className="text-base font-semibold text-ink leading-tight">{title}</h3>
        <p className="text-[12px] text-ink-mute leading-relaxed">{subtitle}</p>
      </div>

      {/* KPI hero — gros chiffre serif italic */}
      <div className="space-y-1 pt-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
          Économisé / mois
        </p>
        <p className="font-serif italic font-normal text-ink leading-none text-4xl md:text-5xl">
          {formatEur(savedEur)}
        </p>
        <p className="font-mono text-[12px] text-ink-mute">{formatPct(savedPct)} vs baseline</p>
      </div>

      {/* Inputs + outputs sur 2 colonnes */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-rule/40">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Hypothèses
          </p>
          {inputs.map((i) => (
            <div key={i.label} className="space-y-0.5">
              <p className="text-[11px] text-ink-mute leading-tight">{i.label}</p>
              <p className="font-mono text-[13px] text-ink font-medium">{i.value}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">Coûts</p>
          {outputs.map((o) => (
            <div key={o.label} className="space-y-0.5">
              <p className="text-[11px] text-ink-mute leading-tight">{o.label}</p>
              <p className="font-mono text-[13px] text-ink font-medium">{o.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Note explicative */}
      <p className="text-[11px] text-ink-mute leading-relaxed pt-2 border-t border-rule/40">
        {note}
      </p>
    </Card>
  )
}
