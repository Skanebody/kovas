'use client'

/**
 * KOVAS — Récap visuel mode mission (lot MISSION-C).
 *
 * Sheet bottom (slide-up sur mobile, modal centered sur desktop) déclenché par
 * un FAB chartreuse en bas à droite du chat. Permet au diagnostiqueur de :
 *
 *   1. Voir la progression globale (jauge + compteur X/Y champs)
 *   2. Visualiser la grille pièces × catégories (vert/ambre/coral)
 *   3. Voir les champs globaux manquants
 *   4. Voir les contradictions détectées (warning ambre / error coral)
 *   5. Voir les champs "à risque" (required + pitfall non renseigné)
 *   6. Cliquer "Aller corriger" pour zapper sur la pièce/champ concerné
 *   7. Cliquer "Terminer la mission" (chartreuse) si completion ≥ 90% + zéro error
 *
 * Pattern signature V5 :
 *   - Background sage pâle
 *   - Cards solides Card flat (pas de glass)
 *   - Accent chartreuse parcimonieux (CTA terminer, jauge progression)
 *   - Coral pour errors, ambre pour warnings
 *
 * Authority : CLAUDE.md §9 v5 (sobre productivité B2B) + spec MISSION-C.
 */

import {
  BottomSheet,
  BottomSheetActions,
  BottomSheetBody,
  BottomSheetTitle,
} from '@/components/ui/bottom-sheet'
import {
  CHECK_CATEGORY_LABEL,
  CHECK_CATEGORY_SHORT_LABEL,
  type CheckCategory,
} from '@/lib/3cl/checklist'
import type { Contradiction } from '@/lib/3cl/contradictions-detector'
import { countErrors, groupBySeverity } from '@/lib/3cl/contradictions-detector'
import type { MissionRiskFlagsResult } from '@/lib/3cl/use-mission-risk-flags'
import { cn } from '@/lib/utils'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Flag,
  LayoutGrid,
  ShieldAlert,
} from 'lucide-react'
import { useMemo, useState } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Statut d'une cellule (pièce × catégorie). */
export type RecapCellStatus = 'complete' | 'partial' | 'empty'

/** Snapshot d'une pièce pour la grille récap. */
export interface RecapRoom {
  id: string
  name: string
  type: string
  /** Statut par catégorie. */
  statusByCategory: Partial<Record<CheckCategory, RecapCellStatus>>
  /** Total champs requis pour cette pièce. */
  requiredFieldsCount: number
  /** Champs renseignés pour cette pièce. */
  filledFieldsCount: number
}

/** Snapshot global. */
export interface RecapGlobalField {
  key: string
  label: string
  filled: boolean
  isRequired: boolean
}

export interface MissionRecapSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Progression globale 0-100. */
  completionPct: number
  /** Compteur total : "146/200 champs". */
  fieldsFilled: number
  fieldsTotal: number
  /** Pièces avec statut par catégorie. */
  rooms: readonly RecapRoom[]
  /** Champs globaux (s'applique à tout le bien). */
  globalFields: readonly RecapGlobalField[]
  /** Contradictions détectées. */
  contradictions: readonly Contradiction[]
  /** Risk flags (champs required avec pitfall non rempli). */
  riskFlags: MissionRiskFlagsResult
  /**
   * Callback "Aller corriger" — l'interface filtre le chat sur le champ.
   * Reçoit la clef technique (ex: 'chauffage.type_generateur_principal').
   */
  onGoToField?: (fieldKey: string, roomId?: string) => void
  /** Callback "Terminer la mission" (visible si ≥ 90% + 0 errors). */
  onFinish?: () => void
}

// -----------------------------------------------------------------------------
// Catégories affichées dans la grille (ordre logique)
// -----------------------------------------------------------------------------

const GRID_CATEGORIES: readonly CheckCategory[] = [
  'pieces',
  'parois_vitrees',
  'chauffage',
  'ecs',
  'ventilation',
  'eclairage',
]

// -----------------------------------------------------------------------------
// Sous-composants
// -----------------------------------------------------------------------------

function StatusCell({ status }: { status?: RecapCellStatus }): React.ReactElement {
  if (status === 'complete') {
    return (
      <div
        className="flex h-6 w-6 items-center justify-center rounded-md bg-status-green/15"
        aria-label="Complète"
      >
        <CheckCircle2 className="size-3.5 text-status-green" aria-hidden />
      </div>
    )
  }
  if (status === 'partial') {
    return (
      <div
        className="flex h-6 w-6 items-center justify-center rounded-md bg-status-amber/15"
        aria-label="Partielle"
      >
        <div className="h-3 w-3 rounded-full bg-status-amber" aria-hidden />
      </div>
    )
  }
  return (
    <div
      className="flex h-6 w-6 items-center justify-center rounded-md bg-status-coral/10"
      aria-label="Manquante"
    >
      <Circle className="size-3.5 text-status-coral" aria-hidden />
    </div>
  )
}

function ContradictionsList({
  contradictions,
  onGoToField,
}: {
  contradictions: readonly Contradiction[]
  onGoToField?: (key: string, roomId?: string) => void
}): React.ReactElement {
  if (contradictions.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-status-green/20 bg-status-green/5 px-3 py-2 text-[13px] text-status-green">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Aucune contradiction détectée.
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {contradictions.map((c) => (
        <li
          key={c.id}
          className={cn(
            'rounded-md border px-3 py-2.5',
            c.severity === 'error'
              ? 'border-status-coral/40 bg-status-coral/5'
              : 'border-status-amber/40 bg-status-amber/5',
          )}
        >
          <div className="flex items-start gap-2">
            {c.severity === 'error' ? (
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-status-coral" aria-hidden />
            ) : (
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-status-amber" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed text-[#0F1419]">{c.message}</p>
              {c.suggestedAction ? (
                <p className="mt-1 text-[11px] text-[#0F1419]/72">
                  <span className="font-mono uppercase tracking-wide">Action :</span>{' '}
                  {c.suggestedAction}
                </p>
              ) : null}
              {onGoToField && c.affectedKeys.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onGoToField(c.affectedKeys[0])}
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-1 rounded-pill',
                    'border border-[#0F1419]/[0.08] bg-paper px-2 py-0.5',
                    'text-[11px] font-medium text-[#0F1419]/82',
                    'hover:bg-sage-alt hover:text-[#0F1419] transition-colors',
                  )}
                >
                  Aller corriger
                  <ArrowRight className="size-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function RiskFlagsList({
  flags,
  onGoToField,
}: {
  flags: MissionRiskFlagsResult
  onGoToField?: (key: string, roomId?: string) => void
}): React.ReactElement {
  if (flags.total === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-status-green/20 bg-status-green/5 px-3 py-2 text-[13px] text-status-green">
        <ShieldAlert className="size-4 shrink-0" aria-hidden />
        Aucun champ critique laissé à une valeur par défaut piégée.
      </div>
    )
  }

  // Affiche les 8 premiers — les autres dans un "+N"
  const TOP_N = 8
  const visible = flags.flags.slice(0, TOP_N)
  const more = Math.max(0, flags.total - TOP_N)

  return (
    <ul className="space-y-2">
      {visible.map((flag) => (
        <li
          key={flag.key}
          className="rounded-md border border-status-amber/30 bg-status-amber/5 px-3 py-2.5"
        >
          <div className="flex items-start gap-2">
            <Flag className="size-4 shrink-0 mt-0.5 text-status-amber" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[#0F1419]">{flag.label}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#0F1419]/72">{flag.pitfall}</p>
              {onGoToField ? (
                <button
                  type="button"
                  onClick={() => onGoToField(flag.key)}
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-1 rounded-pill',
                    'border border-[#0F1419]/[0.08] bg-paper px-2 py-0.5',
                    'text-[11px] font-medium text-[#0F1419]/82',
                    'hover:bg-sage-alt hover:text-[#0F1419] transition-colors',
                  )}
                >
                  Renseigner maintenant
                  <ArrowRight className="size-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
      {more > 0 ? (
        <li className="text-center text-[11px] font-mono uppercase tracking-wide text-[#0F1419]/72">
          + {more} autre{more > 1 ? 's' : ''} champ{more > 1 ? 's' : ''} à risque
        </li>
      ) : null}
    </ul>
  )
}

// -----------------------------------------------------------------------------
// Composant principal — MissionRecapSheet
// -----------------------------------------------------------------------------

export function MissionRecapSheet({
  open,
  onOpenChange,
  completionPct,
  fieldsFilled,
  fieldsTotal,
  rooms,
  globalFields,
  contradictions,
  riskFlags,
  onGoToField,
  onFinish,
}: MissionRecapSheetProps): React.ReactElement {
  const errorCount = countErrors(contradictions)
  const { warning, error } = groupBySeverity(contradictions)

  // Tri pièces : incomplètes en premier
  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      const aPct = a.requiredFieldsCount > 0 ? a.filledFieldsCount / a.requiredFieldsCount : 0
      const bPct = b.requiredFieldsCount > 0 ? b.filledFieldsCount / b.requiredFieldsCount : 0
      return aPct - bPct
    })
  }, [rooms])

  const missingGlobalRequired = globalFields.filter((f) => f.isRequired && !f.filled)

  // canFinish doit inclure missingGlobalRequired (cf. audit P1-8 mode mission).
  // Avant : on pouvait "Terminer la mission" avec 90% de complétude pièces mais
  // un champ global obligatoire manquant → DPE incomplet à l'export.
  const canFinish = completionPct >= 90 && errorCount === 0 && missingGlobalRequired.length === 0

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} maxHeight="92vh">
      <BottomSheetTitle>Récapitulatif de la mission</BottomSheetTitle>

      <BottomSheetBody>
        {/* SECTION 1 — Jauge progression globale */}
        <section aria-labelledby="recap-progress" className="mb-4">
          <div className="flex items-end justify-between gap-3 mb-2">
            <div>
              <h3
                id="recap-progress"
                className="text-[12px] font-mono uppercase tracking-wide text-[#0F1419]/72"
              >
                Progression
              </h3>
              <p className="mt-0.5 font-serif italic text-[28px] leading-none text-[#0F1419]">
                {completionPct}%
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-[#0F1419]/72">
                <span className="font-semibold text-[#0F1419] tabular-nums">{fieldsFilled}</span>
                <span> / </span>
                <span className="tabular-nums">{fieldsTotal}</span> champs renseignés
              </p>
              <p className="mt-0.5 text-[11px] font-mono text-[#0F1419]/72">
                {rooms.length} pièce{rooms.length > 1 ? 's' : ''} · {contradictions.length} alerte
                {contradictions.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div
            role="progressbar"
            tabIndex={-1}
            aria-valuenow={completionPct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-pill bg-sage-alt"
          >
            <div
              className="h-full rounded-pill bg-chartreuse-deep transition-all duration-300"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </section>

        {/* SECTION 2 — Grille pièces × catégories */}
        <section aria-labelledby="recap-grid" className="mb-5">
          <h3
            id="recap-grid"
            className="mb-2 text-[12px] font-mono uppercase tracking-wide text-[#0F1419]/72"
          >
            Grille pièces × catégories
          </h3>
          {sortedRooms.length === 0 ? (
            <p className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-3 text-[13px] text-[#0F1419]/72">
              Aucune pièce saisie pour l'instant. Démarrez en dictant la première au tchat.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[#0F1419]/[0.08] bg-paper">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#0F1419]/[0.06] bg-sage-alt/40">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-sage-alt/40 px-2 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-wide text-[#0F1419]/72"
                    >
                      Pièce
                    </th>
                    {GRID_CATEGORIES.map((cat) => (
                      <th
                        scope="col"
                        key={cat}
                        className="px-2 py-2 text-center font-mono text-[10px] font-medium uppercase tracking-wide text-[#0F1419]/72"
                        title={CHECK_CATEGORY_LABEL[cat]}
                      >
                        {CHECK_CATEGORY_SHORT_LABEL[cat]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRooms.map((room) => (
                    <tr key={room.id} className="border-b border-[#0F1419]/[0.06] last:border-b-0">
                      <td className="sticky left-0 z-10 bg-paper px-2 py-2 text-left">
                        <button
                          type="button"
                          onClick={() => onGoToField?.('piece.surface', room.id)}
                          className="text-left font-medium text-[#0F1419] hover:underline"
                        >
                          {room.name}
                        </button>
                        <p className="text-[10px] font-mono text-[#0F1419]/72 tabular-nums">
                          {room.filledFieldsCount}/{room.requiredFieldsCount}
                        </p>
                      </td>
                      {GRID_CATEGORIES.map((cat) => (
                        <td key={cat} className="px-2 py-2 text-center">
                          <div className="flex justify-center">
                            <StatusCell status={room.statusByCategory[cat]} />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* SECTION 3 — Champs globaux */}
        <section aria-labelledby="recap-global" className="mb-5">
          <h3
            id="recap-global"
            className="mb-2 text-[12px] font-mono uppercase tracking-wide text-[#0F1419]/72"
          >
            Champs globaux
          </h3>
          {globalFields.length === 0 ? (
            <p className="text-[12px] text-[#0F1419]/72">Aucun champ global à renseigner.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {globalFields.map((field) => (
                <div
                  key={field.key}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1.5',
                    field.filled
                      ? 'border-status-green/20 bg-status-green/5'
                      : field.isRequired
                        ? 'border-status-coral/30 bg-status-coral/5'
                        : 'border-[#0F1419]/[0.06] bg-paper',
                  )}
                >
                  {field.filled ? (
                    <CheckCircle2 className="size-3 shrink-0 text-status-green" aria-hidden />
                  ) : (
                    <Circle
                      className={cn(
                        'size-3 shrink-0',
                        field.isRequired ? 'text-status-coral' : 'text-[#0F1419]/40',
                      )}
                      aria-hidden
                    />
                  )}
                  <span className="text-[11px] text-[#0F1419]/82 truncate">{field.label}</span>
                </div>
              ))}
            </div>
          )}
          {missingGlobalRequired.length > 0 ? (
            <p className="mt-2 text-[11px] font-mono uppercase tracking-wide text-status-coral">
              {missingGlobalRequired.length} champ{missingGlobalRequired.length > 1 ? 's' : ''}{' '}
              global{missingGlobalRequired.length > 1 ? 'aux' : ''} obligatoire
              {missingGlobalRequired.length > 1 ? 's' : ''} manquant
              {missingGlobalRequired.length > 1 ? 's' : ''}
            </p>
          ) : null}
        </section>

        {/* SECTION 4 — Contradictions détectées */}
        <section aria-labelledby="recap-contradictions" className="mb-5">
          <h3
            id="recap-contradictions"
            className="mb-2 text-[12px] font-mono uppercase tracking-wide text-[#0F1419]/72"
          >
            Contradictions détectées
            {contradictions.length > 0 ? (
              <span className="ml-2 tabular-nums text-[#0F1419]">
                ({error.length} erreur{error.length > 1 ? 's' : ''} · {warning.length} alerte
                {warning.length > 1 ? 's' : ''})
              </span>
            ) : null}
          </h3>
          <ContradictionsList contradictions={contradictions} onGoToField={onGoToField} />
        </section>

        {/* SECTION 5 — Champs à risque (valeur par défaut piège) */}
        <section aria-labelledby="recap-risks" className="mb-3">
          <h3
            id="recap-risks"
            className="mb-2 text-[12px] font-mono uppercase tracking-wide text-[#0F1419]/72"
          >
            Champs à risque ({riskFlags.total})
          </h3>
          <p className="mb-2 text-[11px] text-[#0F1419]/72">
            Ces champs obligatoires ne sont pas remplis. Sans saisie, la méthode 3CL applique une
            valeur par défaut souvent pénalisante.
          </p>
          <RiskFlagsList flags={riskFlags} onGoToField={onGoToField} />
        </section>
      </BottomSheetBody>

      {/* FOOTER — boutons */}
      <BottomSheetActions
        primary={canFinish ? 'Terminer la mission' : 'Fermer'}
        onPrimary={canFinish && onFinish ? onFinish : () => onOpenChange(false)}
        secondary={canFinish ? 'Continuer la mission' : undefined}
        onSecondary={() => onOpenChange(false)}
      />
    </BottomSheet>
  )
}

// -----------------------------------------------------------------------------
// MissionRecapButton — FAB flottant chartreuse en bas à droite
// -----------------------------------------------------------------------------

interface MissionRecapButtonProps {
  fieldsFilled: number
  fieldsTotal: number
  contradictionsCount: number
  onClick: () => void
}

export function MissionRecapButton({
  fieldsFilled,
  fieldsTotal,
  contradictionsCount,
  onClick,
}: MissionRecapButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Voir le récapitulatif (${fieldsFilled} sur ${fieldsTotal} champs renseignés)`}
      className={cn(
        'fixed bottom-24 right-4 z-40',
        'inline-flex items-center gap-2',
        'rounded-pill bg-chartreuse px-4 py-2.5',
        'border border-chartreuse-deep/40',
        '',
        'text-[13px] font-semibold text-[#0F1419]',
        'transition-all hover:-translate-y-px active:translate-y-0',
        'lg:bottom-28 lg:right-8',
      )}
    >
      <LayoutGrid className="size-4" aria-hidden />
      <span className="tabular-nums">
        {fieldsFilled}/{fieldsTotal}
      </span>
      {contradictionsCount > 0 ? (
        <span
          aria-label={`${contradictionsCount} alerte${contradictionsCount > 1 ? 's' : ''}`}
          className="inline-flex items-center justify-center rounded-full bg-status-coral px-1.5 py-0 text-[10px] font-bold text-white tabular-nums min-w-[18px] h-[18px]"
        >
          {contradictionsCount}
        </span>
      ) : null}
    </button>
  )
}

// -----------------------------------------------------------------------------
// Hook utilitaire — gérer le state open
// -----------------------------------------------------------------------------

export function useMissionRecap() {
  const [open, setOpen] = useState(false)
  return {
    open,
    setOpen,
    toggle: () => setOpen((o) => !o),
    close: () => setOpen(false),
  }
}
