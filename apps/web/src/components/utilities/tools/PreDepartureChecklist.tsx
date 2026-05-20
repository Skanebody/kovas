'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { DIAGNOSTIC_TYPES, type DiagnosticType } from '@/lib/mission/types'
import {
  type ChecklistCategory,
  countCriticalUnchecked,
  generateChecklist,
} from '@/lib/utilities/pre-departure-checklist'
import { AlertTriangle, Camera, FileText, Info, Ruler } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

const CATEGORY_ICON: Record<ChecklistCategory, typeof Camera> = {
  photo: Camera,
  measurement: Ruler,
  info: Info,
  document: FileText,
}

const CATEGORY_LABEL: Record<ChecklistCategory, string> = {
  photo: 'Photos',
  measurement: 'Mesures',
  info: 'Infos',
  document: 'Documents',
}

const DIAG_LABEL: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez/Boutin',
  ERP: 'ERP',
}

interface Props {
  /** Diagnostics actifs sur le dossier (si fourni). Si vide, l'utilisateur les choisit lui-même. */
  activeDiagnostics?: readonly DiagnosticType[]
  filledFieldPaths?: readonly string[]
  photoSubjects?: readonly string[]
  /** Si fourni, affiche la modal full-screen et appelle onClose. */
  open?: boolean
  onClose?: () => void
  onComplete?: () => void
  /** Optionnel : id dossier — utile pour le tracking serveur. */
  dossierId?: string
}

/**
 * Checklist "Avant de partir" — utilisable :
 * - en page standalone (pas de prop `open`)
 * - en modal full-screen (props `open` + `onClose`)
 */
export function PreDepartureChecklist({
  activeDiagnostics,
  filledFieldPaths,
  photoSubjects,
  open,
  onClose,
  onComplete,
  dossierId,
}: Props) {
  const [manualDiags, setManualDiags] = useState<DiagnosticType[]>(
    activeDiagnostics ? Array.from(activeDiagnostics) : ['DPE'],
  )
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const effectiveDiags: readonly DiagnosticType[] = useMemo(
    () => activeDiagnostics ?? manualDiags,
    [activeDiagnostics, manualDiags],
  )

  const items = useMemo(
    () =>
      generateChecklist({
        activeDiagnostics: effectiveDiags,
        filledFieldPaths: filledFieldPaths ?? [],
        photoSubjects: photoSubjects ?? [],
      }),
    [effectiveDiags, filledFieldPaths, photoSubjects],
  )

  // Track usage à chaque ouverture / changement majeur (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      void fetch('/api/utilities/checklist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          activeDiagnostics: effectiveDiags,
          filledFieldPaths: filledFieldPaths ?? [],
          photoSubjects: photoSubjects ?? [],
          dossierId,
        }),
      }).catch(() => undefined)
    }, 400)
    return () => clearTimeout(handle)
  }, [effectiveDiags, filledFieldPaths, photoSubjects, dossierId])

  const criticalPending = countCriticalUnchecked(items, checked)

  const toggle = (id: string) => {
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const complete = () => {
    if (criticalPending > 0) {
      toast.warning('Action critique en attente', {
        description: `Il reste ${criticalPending} item${criticalPending > 1 ? 's' : ''} critique${criticalPending > 1 ? 's' : ''} non vérifié.`,
      })
      return
    }
    toast.success('Mission validée', { description: 'Vous pouvez quitter le site.' })
    onComplete?.()
    onClose?.()
  }

  const body = (
    <div className="space-y-5">
      {activeDiagnostics === undefined ? (
        <Card variant="opaque" padding="default">
          <CardTitle className="text-[15px]">Diagnostics actifs</CardTitle>
          <CardDescription className="mt-1 mb-3">
            Choisissez les diagnostics du dossier pour générer la checklist correspondante.
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            {DIAGNOSTIC_TYPES.map((d) => {
              const active = manualDiags.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setManualDiags((arr) =>
                      arr.includes(d) ? arr.filter((x) => x !== d) : [...arr, d],
                    )
                  }
                  className={`px-3 py-1.5 rounded-pill text-[12px] font-medium transition-colors ${
                    active
                      ? 'bg-navy text-paper'
                      : 'bg-paper/60 text-ink border border-rule hover:bg-paper'
                  }`}
                >
                  {DIAG_LABEL[d]}
                </button>
              )
            })}
          </div>
        </Card>
      ) : null}

      {criticalPending > 0 ? (
        <Card variant="warm" padding="default">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 mt-0.5" />
            <div>
              <CardTitle className="text-[14px]">
                {criticalPending} item{criticalPending > 1 ? 's' : ''} critique
                {criticalPending > 1 ? 's' : ''} restant
                {criticalPending > 1 ? 's' : ''}
              </CardTitle>
              <CardDescription className="mt-1">
                Cochez chaque item critique avant de partir, ou revenez plus tard.
              </CardDescription>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        {items.length === 0 ? (
          <Card variant="opaque" padding="default">
            <CardDescription>
              Aucun item — sélectionnez au moins un diagnostic actif.
            </CardDescription>
          </Card>
        ) : (
          items.map((item) => {
            const Icon = CATEGORY_ICON[item.category]
            const isChecked = item.prefilled || checked.has(item.id)
            const importance = item.importance
            const tone =
              importance === 'critical'
                ? 'border-danger/30'
                : importance === 'important'
                  ? 'border-amber/30'
                  : 'border-rule/60'
            const badgeTone =
              importance === 'critical'
                ? 'bg-danger/10 text-danger'
                : importance === 'important'
                  ? 'bg-amber/10 text-amber'
                  : 'bg-paper text-ink-mute border border-rule'
            return (
              <div
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border ${tone} bg-paper p-3.5`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(item.id)}
                  disabled={item.prefilled}
                  className="size-5 rounded border-rule accent-navy mt-0.5"
                  aria-label={item.label}
                />
                <Icon className="size-4 mt-1 text-ink-mute shrink-0" />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] font-medium ${
                      isChecked && !item.prefilled ? 'line-through text-ink-mute' : 'text-ink'
                    }`}
                  >
                    {item.label}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {DIAG_LABEL[item.diagnosticType]} · {CATEGORY_LABEL[item.category]}
                    </span>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-medium ${badgeTone}`}
                    >
                      {importance === 'critical'
                        ? 'Critique'
                        : importance === 'important'
                          ? 'Important'
                          : 'Conseillé'}
                    </span>
                    {item.prefilled ? (
                      <span className="rounded-pill bg-success/10 text-success px-2 py-0.5 text-[10px] font-medium">
                        Déjà rempli
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        <Button type="button" variant="accent" disabled={criticalPending > 0} onClick={complete}>
          Terminer la mission
        </Button>
        {onClose ? (
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        ) : null}
      </div>
    </div>
  )

  if (open === undefined) {
    return body
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose?.() : null)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Avant de partir</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Wrapper convivial pour intégration dans le flow "quit dossier" — affiche
 * la checklist comme modal au click sur une icône.
 */
export function ChecklistBeforeLeaving({
  dossierId,
  activeDiagnostics,
  filledFieldPaths,
  photoSubjects,
  onClose,
  onComplete,
}: {
  dossierId?: string
  activeDiagnostics?: readonly DiagnosticType[]
  filledFieldPaths?: readonly string[]
  photoSubjects?: readonly string[]
  onClose: () => void
  onComplete?: () => void
}) {
  return (
    <PreDepartureChecklist
      open
      onClose={onClose}
      onComplete={onComplete}
      dossierId={dossierId}
      activeDiagnostics={activeDiagnostics}
      filledFieldPaths={filledFieldPaths}
      photoSubjects={photoSubjects}
    />
  )
}
