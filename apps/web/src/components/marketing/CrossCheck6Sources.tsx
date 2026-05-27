'use client'

/**
 * KOVAS — CrossCheck6Sources
 *
 * Visualisation du "mécanisme unique" propriétaire KOVAS (Tugan Bara) :
 * AVANT chaque envoi ADEME, KOVAS vérifie la mission contre 6 sources
 * publiques croisées (Cadastre · DVF · ADEME historique · BAN · IGN ·
 * Géorisques). Aucun autre logiciel certifié ne combine ces 6 sources
 * simultanément.
 *
 * 4 modes d'usage :
 *   - "static"    : grille 2×3 / 3×2 (server-friendly, pas d'animation)
 *   - "animated"  : ticks chartreuse en cascade (delay 150ms) au mount
 *                   + respect `prefers-reduced-motion`
 *   - "compact"   : version horizontale scrollable (6 pills)
 *   - "result"    : verdict par source (ok / warning / mismatch) + tooltip
 *
 * Brand strict V5 — sage `#F5F7F4` · navy `#0F1419` · chartreuse `#D4F542`
 * UNIQUEMENT pour les ticks validés (animation, célébration). Pas d'autre
 * couleur que les sémantiques amber/red pour le mode `result`.
 *
 * Accessibilité :
 *   - liste sémantique <ul> + aria-label explicite
 *   - hauteur prévisible (pas de layout shift)
 *   - tick = aria-hidden, texte = lisible screen-reader via sr-only
 *
 * Authority : prompt orchestration refonte (mécanisme unique Tugan).
 */

import {
  Check,
  CircleAlert,
  Coins,
  Compass,
  History,
  Map as MapIcon,
  MapPin,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

/* ────────────────────────────────────────────────────────────────────────── */
/* Modèle de données des 6 sources                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type CrossCheckSourceKey = 'cadastre' | 'dvf' | 'ademe' | 'ban' | 'ign' | 'georisques'

interface SourceDefinition {
  key: CrossCheckSourceKey
  label: string
  sublabel: string
  description: string
  icon: ReactElement
}

const SOURCES: ReadonlyArray<SourceDefinition> = [
  {
    key: 'cadastre',
    label: 'Cadastre',
    sublabel: 'cadastre.data.gouv.fr',
    description: 'Parcelle, surfaces, bâtiments officiels',
    icon: <MapIcon className="size-5" aria-hidden />,
  },
  {
    key: 'dvf',
    label: 'DVF',
    sublabel: 'app.dvf.etalab.gouv.fr',
    description: 'Transactions Valeurs Foncières',
    icon: <Coins className="size-5" aria-hidden />,
  },
  {
    key: 'ademe',
    label: 'ADEME historique',
    sublabel: 'observatoire-dpe.ademe.fr',
    description: 'DPE existants sur le même bien',
    icon: <History className="size-5" aria-hidden />,
  },
  {
    key: 'ban',
    label: 'BAN',
    sublabel: 'adresse.data.gouv.fr',
    description: 'Adresse normalisée nationale',
    icon: <MapPin className="size-5" aria-hidden />,
  },
  {
    key: 'ign',
    label: 'IGN',
    sublabel: 'geoservices.ign.fr',
    description: 'Géolocalisation + cadastre photo',
    icon: <Compass className="size-5" aria-hidden />,
  },
  {
    key: 'georisques',
    label: 'Géorisques',
    sublabel: 'georisques.gouv.fr',
    description: 'Radon · PPRI · argiles · cavités · sismique',
    icon: <ShieldAlert className="size-5" aria-hidden />,
  },
] as const

/* ────────────────────────────────────────────────────────────────────────── */
/* Props publiques du composant                                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type CrossCheckVerdict = 'ok' | 'warning' | 'mismatch'

export interface CrossCheckFinding {
  source: CrossCheckSourceKey
  verdict: CrossCheckVerdict
  note?: string
}

interface BaseProps {
  /** Optionnel : titre interne accessible. Défaut "Cross-Check 6 sources data.gouv". */
  ariaLabel?: string
  /** Classe additionnelle conteneur. */
  className?: string
  /**
   * Layout dense pour placement en colonne étroite (≤ ~500px) — typiquement
   * `lg:col-span-2` sur la homepage. Quand `true` :
   * - Grille `grid-cols-1 sm:grid-cols-2` (jamais 3 cols)
   * - SourceCard sans description ni sublabel URL (seul label + tick visibles)
   * Sinon (default) : grille `sm:grid-cols-2 xl:grid-cols-3` + cards complètes.
   */
  compact?: boolean
}

interface StaticProps extends BaseProps {
  mode: 'static'
}

interface AnimatedProps extends BaseProps {
  mode: 'animated'
  /** Delai entre chaque tick (ms). Défaut 150. */
  stepDelayMs?: number
}

interface CompactProps extends BaseProps {
  mode: 'compact'
}

interface ResultProps extends BaseProps {
  mode: 'result'
  /** Score global 0-100 (% cohérence cross-check). */
  score: number
  /** Verdicts détaillés par source (les sources absentes restent neutres). */
  findings: ReadonlyArray<CrossCheckFinding>
}

export type CrossCheck6SourcesProps = StaticProps | AnimatedProps | CompactProps | ResultProps

/* ────────────────────────────────────────────────────────────────────────── */
/* Composant principal                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

const DEFAULT_ARIA_LABEL = 'Cross-Check 6 sources data.gouv'

export function CrossCheck6Sources(props: CrossCheck6SourcesProps): ReactElement {
  const ariaLabel = props.ariaLabel ?? DEFAULT_ARIA_LABEL

  switch (props.mode) {
    case 'static':
      return (
        <StaticGrid
          ariaLabel={ariaLabel}
          className={props.className}
          compact={props.compact ?? false}
        />
      )
    case 'animated':
      return (
        <AnimatedGrid
          ariaLabel={ariaLabel}
          className={props.className}
          compact={props.compact ?? false}
          stepDelayMs={props.stepDelayMs ?? 150}
        />
      )
    case 'compact':
      return <CompactRow ariaLabel={ariaLabel} className={props.className} />
    case 'result':
      return (
        <ResultGrid
          ariaLabel={ariaLabel}
          className={props.className}
          score={props.score}
          findings={props.findings}
        />
      )
    default: {
      // Exhaustiveness check à la compilation TS.
      const _exhaustive: never = props
      return _exhaustive
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Helpers — détection prefers-reduced-motion (sans dépendance)                */
/* ────────────────────────────────────────────────────────────────────────── */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (): void => setReduced(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mode "static" — grille 2×3 / 3×2 server-friendly                            */
/* ────────────────────────────────────────────────────────────────────────── */

function StaticGrid({
  ariaLabel,
  className,
  compact,
}: {
  ariaLabel: string
  className?: string
  compact: boolean
}): ReactElement {
  /* Grille adaptative selon mode :
     - `compact=true` (col étroite ≤500px : homepage col-span-2) : jamais 3 cols
     - `compact=false` (pleine largeur) : 1 col mobile → 2 sm → 3 xl */
  const gridCls = compact
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4'
  return (
    <div className={className}>
      <ul aria-label={ariaLabel} className={gridCls}>
        {SOURCES.map((source) => (
          <SourceCard key={source.key} source={source} ticked compact={compact} />
        ))}
      </ul>
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55 text-center pt-4">
        6 sources publiques · data.gouv.fr · vérification automatique avant envoi ADEME
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mode "animated" — ticks chartreuse en cascade au mount                      */
/* ────────────────────────────────────────────────────────────────────────── */

function AnimatedGrid({
  ariaLabel,
  className,
  compact,
  stepDelayMs,
}: {
  ariaLabel: string
  className?: string
  compact: boolean
  stepDelayMs: number
}): ReactElement {
  const reduced = usePrefersReducedMotion()
  const [tickedCount, setTickedCount] = useState<number>(reduced ? SOURCES.length : 0)

  useEffect(() => {
    if (reduced) {
      setTickedCount(SOURCES.length)
      return
    }
    setTickedCount(0)
    const timers: Array<ReturnType<typeof setTimeout>> = []
    for (let i = 0; i < SOURCES.length; i++) {
      const t = setTimeout(
        () => {
          setTickedCount((prev) => Math.max(prev, i + 1))
        },
        300 + i * stepDelayMs,
      )
      timers.push(t)
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t)
      }
    }
  }, [reduced, stepDelayMs])

  /* Grille adaptative — voir StaticGrid pour la logique compact. */
  const gridCls = compact
    ? 'grid grid-cols-1 sm:grid-cols-2 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4'

  return (
    <div className={className}>
      <ul aria-label={ariaLabel} className={gridCls}>
        {SOURCES.map((source, idx) => (
          <SourceCard
            key={source.key}
            source={source}
            ticked={idx < tickedCount}
            animatedTick
            compact={compact}
          />
        ))}
      </ul>
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55 text-center pt-4">
        6 sources publiques croisées · vérification en 8 secondes
      </p>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mode "compact" — pills horizontales scrollables                             */
/* ────────────────────────────────────────────────────────────────────────── */

function CompactRow({
  ariaLabel,
  className,
}: {
  ariaLabel: string
  className?: string
}): ReactElement {
  return (
    <div className={className}>
      <ul
        aria-label={ariaLabel}
        className="flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:overflow-y-hidden sm:-mx-1 sm:px-1 sm:pb-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {SOURCES.map((source) => (
          <li
            key={source.key}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#0F1419]/[0.12] bg-paper px-3 py-1.5"
          >
            <span className="inline-flex size-4 items-center justify-center text-[#0F1419]/72">
              {source.icon}
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0F1419]">
              {source.label}
            </span>
            <span
              aria-hidden
              className="inline-flex size-4 items-center justify-center rounded-full bg-chartreuse text-[#0F1419]"
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Mode "result" — verdict par source + score global                           */
/* ────────────────────────────────────────────────────────────────────────── */

function ResultGrid({
  ariaLabel,
  className,
  score,
  findings,
}: {
  ariaLabel: string
  className?: string
  score: number
  findings: ReadonlyArray<CrossCheckFinding>
}): ReactElement {
  const findingsByKey = new Map<CrossCheckSourceKey, CrossCheckFinding>()
  for (const f of findings) {
    findingsByKey.set(f.source, f)
  }

  const clamped = Math.max(0, Math.min(100, score))

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper p-6 sm:p-7">
        {/* En-tête : score global */}
        <div className="flex items-baseline justify-between mb-5">
          <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
            Cross-Check 6 sources
          </p>
          <p className="font-mono text-[12px] font-semibold uppercase tracking-wider text-[#0F1419]">
            Cohérence {clamped}/100
          </p>
        </div>

        <ul aria-label={ariaLabel} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOURCES.map((source) => {
            const finding = findingsByKey.get(source.key)
            return (
              <li
                key={source.key}
                className="flex items-start gap-3 rounded-xl border border-[#0F1419]/[0.08] bg-sage/40 px-4 py-3"
                title={finding?.note}
              >
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#0F1419]/[0.08] bg-paper text-[#0F1419]/72">
                  {source.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#0F1419]">
                    {source.label}
                  </p>
                  <p className="text-[12px] text-[#0F1419]/72 leading-snug mt-0.5">
                    {finding?.note ?? source.description}
                  </p>
                </div>
                <VerdictTick verdict={finding?.verdict ?? 'ok'} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function VerdictTick({ verdict }: { verdict: CrossCheckVerdict }): ReactElement {
  if (verdict === 'ok') {
    return (
      <span
        aria-label="vérifié"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-chartreuse text-[#0F1419]"
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
      </span>
    )
  }
  if (verdict === 'warning') {
    return (
      <span
        aria-label="à vérifier"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-amber/20 text-amber"
      >
        <CircleAlert className="size-3.5" strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  return (
    <span
      aria-label="incohérence"
      className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700"
    >
      <X className="size-3.5" strokeWidth={3} aria-hidden />
    </span>
  )
}

/* ────────────────────────────────────────────────────────────────────────── */
/* SourceCard — brique réutilisée par static + animated                        */
/* ────────────────────────────────────────────────────────────────────────── */

function SourceCard({
  source,
  ticked,
  animatedTick = false,
  compact = false,
}: {
  source: SourceDefinition
  ticked: boolean
  animatedTick?: boolean
  compact?: boolean
}): ReactElement {
  /* Mode compact : carte allégée pour colonne étroite (≤500px).
     - Pas de description ni sublabel URL (sources problématiques sur card
       ~200px : `observatoire-dpe.ademe.fr` débordait avec break-all moche).
     - Layout horizontal serré : icon + label + tick.
     - min-h réduite (54px au lieu de 78px). */
  if (compact) {
    return (
      <li className="relative flex items-center gap-3 rounded-xl border border-[#0F1419]/[0.08] bg-paper px-3.5 py-3 min-h-[54px]">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#0F1419]/[0.08] bg-sage/60 text-[#0F1419]/72">
          {source.icon}
        </span>
        <p className="flex-1 min-w-0 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#0F1419] truncate pr-6">
          {source.label}
        </p>
        <span
          aria-hidden
          className={[
            'absolute top-1/2 -translate-y-1/2 right-3 inline-flex size-5 items-center justify-center rounded-full bg-chartreuse text-[#0F1419]',
            animatedTick
              ? 'transition-all duration-300 ease-out motion-reduce:transition-none'
              : '',
            ticked ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
          ].join(' ')}
        >
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
        <span className="sr-only">
          {source.description} — {ticked ? 'vérifiée' : 'en attente'}
        </span>
      </li>
    )
  }

  /* Mode comfortable (default) : carte complète avec description + sublabel. */
  return (
    <li className="relative flex items-start gap-3 rounded-xl border border-[#0F1419]/[0.08] bg-paper px-4 py-3.5 min-h-[78px]">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#0F1419]/[0.08] bg-sage/60 text-[#0F1419]/72">
        {source.icon}
      </span>
      {/* min-w-0 indispensable pour permettre au texte de se contraindre dans
          un flex item. pr-8 réserve l'espace du tick top-right (size-5 + 12px
          de marge) pour éviter tout chevauchement. break-words sur les
          sublabel longs comme "observatoire-dpe.ademe.fr". */}
      <div className="flex-1 min-w-0 pr-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#0F1419] break-words">
          {source.label}
        </p>
        <p className="text-[12px] text-[#0F1419]/72 leading-snug mt-0.5 break-words">
          {source.description}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/45 mt-1 break-all">
          {source.sublabel}
        </p>
      </div>
      <span
        aria-hidden
        className={[
          'absolute top-3 right-3 inline-flex size-5 items-center justify-center rounded-full bg-chartreuse text-[#0F1419]',
          animatedTick ? 'transition-all duration-300 ease-out motion-reduce:transition-none' : '',
          ticked ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
        ].join(' ')}
      >
        <Check className="size-3" strokeWidth={3} aria-hidden />
      </span>
      <span className="sr-only">{ticked ? 'Source vérifiée' : 'En attente'}</span>
    </li>
  )
}

export default CrossCheck6Sources
