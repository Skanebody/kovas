/**
 * KOVAS — Pré-export · `PreExportPanel`
 *
 * Panneau plein écran (fixed inset-0) qui présente le résultat de la
 * pré-vérification avant export :
 *   - Sticky header (titre + format cible + bouton fermer)
 *   - Hero score 0-100 + interprétation + compteurs
 *   - Filtres par catégorie
 *   - Liste verticale des findings (FindingCard)
 *   - Sticky bottom : "Tout corriger" (outline) + "Exporter quand même" (chartreuse)
 *
 * Tokens V5 stricts (sage / navy-deep / chartreuse / warning / danger / info).
 * Pas d'emoji marketing. Ton sobre.
 */

'use client'

import { Button } from '@/components/ui/button'
import type {
  Finding,
  FindingCategory,
  PreExportAnalysisResult,
  TargetExportFormat,
} from '@/lib/pre-export/types'
import { TARGET_FORMAT_LABEL } from '@/lib/pre-export/types'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AnalysisSection } from './AnalysisSection'
import { ExportActions } from './ExportActions'
import { ScoreHero } from './ScoreHero'

type FilterKey = 'all' | FindingCategory

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'conformity', label: 'Conformité' },
  { key: 'coherence', label: 'Cohérence' },
  { key: 'statistical', label: 'Statistique' },
  { key: 'opportunity', label: 'Opportunités' },
  { key: 'quality', label: 'Qualité' },
  { key: 'historical', label: 'Historique' },
]

const SECTION_TITLE: Record<FindingCategory, { title: string; description: string }> = {
  conformity: {
    title: 'Conformité ADEME 3CL',
    description: "Champs obligatoires DPE 3CL-2021 (méthode actuelle de l'observatoire).",
  },
  coherence: {
    title: 'Cohérence interne',
    description: 'Vérifications entre les données saisies (surfaces, équipements, année bâti).',
  },
  statistical: {
    title: 'Cohérence statistique',
    description: 'Comparaison à la distribution nationale / régionale / typologie ADEME.',
  },
  quality: {
    title: 'Qualité photos et observations',
    description: 'Couverture photo, voice-notes, preuves EEAT en cas de contrôle.',
  },
  opportunity: {
    title: 'Opportunités commerciales',
    description: 'Diagnostics ou prestations complémentaires à proposer au propriétaire.',
  },
  historical: {
    title: 'Comparaison historique',
    description: "Présence éventuelle d'un DPE antérieur à la même adresse.",
  },
}

interface PreExportPanelProps {
  result: PreExportAnalysisResult
  targetFormat: TargetExportFormat
  missionReference: string
  onClose: () => void
  onExport: () => void
  onFindingAction?: (finding: Finding) => void
  isExporting?: boolean
}

export function PreExportPanel({
  result,
  targetFormat,
  missionReference,
  onClose,
  onExport,
  onFindingAction,
  isExporting,
}: PreExportPanelProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

  // Groupement findings par catégorie pour les sections
  const findingsByCategory = useMemo(() => {
    const map = new Map<FindingCategory, Finding[]>()
    for (const f of result.findings) {
      const list = map.get(f.category) ?? []
      list.push(f)
      map.set(f.category, list)
    }
    return map
  }, [result.findings])

  const visibleCategories: FindingCategory[] =
    activeFilter === 'all'
      ? (
          [
            'conformity',
            'coherence',
            'statistical',
            'quality',
            'opportunity',
            'historical',
          ] as const
        ).filter((c) => findingsByCategory.has(c))
      : [activeFilter as FindingCategory].filter((c) => findingsByCategory.has(c))

  const hasCritical = result.counters.critical > 0

  // Sous-scores affichés en pill à côté du titre de section
  const sectionScoreLabel: Partial<Record<FindingCategory, string>> = {
    conformity: `${result.conformity_score} / 40`,
    coherence: `${result.coherence_score} / 20`,
    statistical: `${result.statistical_score} / 20`,
    quality: `${result.quality_score} / 10`,
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-sage overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Pré-vérification avant export"
    >
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-sage/95 backdrop-blur-md border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="label-mono text-ink-mute">PRÉ-VÉRIFICATION AVANT EXPORT</p>
            <p className="text-[13px] text-ink-soft mt-1">
              Mission <span className="font-mono">{missionReference}</span> · Export vers{' '}
              {TARGET_FORMAT_LABEL[targetFormat]}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fermer">
            <X className="size-5" aria-hidden />
          </Button>
        </div>
      </header>

      {/* Contenu */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-8 space-y-8 pb-32">
        <ScoreHero
          score={result.global_score}
          interpretation={result.interpretation}
          counters={result.counters}
        />

        {/* Filtres */}
        <nav className="flex flex-wrap gap-2" aria-label="Filtres de catégorie">
          {FILTERS.map((f) => {
            const count =
              f.key === 'all'
                ? result.findings.length
                : (findingsByCategory.get(f.key as FindingCategory)?.length ?? 0)
            const isActive = activeFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-pill text-[12px] font-medium',
                  'border transition-all duration-fast',
                  isActive
                    ? 'bg-navy text-paper border-navy'
                    : 'bg-paper text-ink-soft border-rule hover:border-navy/40',
                )}
              >
                {f.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'inline-flex items-center justify-center min-w-[20px] px-1.5 rounded-pill text-[10px]',
                      isActive ? 'bg-paper/20 text-paper' : 'bg-ink/5 text-ink-mute',
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Sections findings */}
        <div className="space-y-10">
          {visibleCategories.length === 0 ? (
            <div className="rounded-xl bg-paper border border-rule p-10 text-center">
              <p className="text-display-serif text-xl text-ink mb-2">Aucun point d'attention</p>
              <p className="text-[13px] text-ink-mute">
                Le dossier ne présente aucun finding sur les analyseurs sélectionnés.
              </p>
            </div>
          ) : (
            visibleCategories.map((cat) => (
              <AnalysisSection
                key={cat}
                category={cat}
                title={SECTION_TITLE[cat].title}
                description={SECTION_TITLE[cat].description}
                scoreLabel={sectionScoreLabel[cat]}
                findings={findingsByCategory.get(cat) ?? []}
                onFindingAction={onFindingAction}
              />
            ))
          )}
        </div>
      </div>

      {/* Sticky bottom : export actions */}
      <ExportActions
        targetFormat={targetFormat}
        hasCritical={hasCritical}
        onFixFirst={() => setActiveFilter('conformity')}
        onExport={onExport}
        isExporting={isExporting}
      />
    </div>
  )
}
