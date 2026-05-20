'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { DIAGNOSTIC_TYPES, type DiagnosticType } from '@/lib/mission/types'
import {
  type DiagnosticResult,
  type TransactionContext,
  type ValidityResult,
  checkValidity,
} from '@/lib/utilities/validity-checker'
import {
  CheckCircle2,
  Infinity as InfinityIcon,
  Plus,
  Trash2,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

interface DiagnosticEntry {
  id: string
  diagnosticType: DiagnosticType
  performedAt: string
  result: DiagnosticResult
  transaction: TransactionContext
}

const DIAG_LABELS: Record<DiagnosticType, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb (CREP)',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez / Boutin',
  ERP: 'ERP',
}

function emptyEntry(): DiagnosticEntry {
  return {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    diagnosticType: 'DPE',
    performedAt: new Date().toISOString().slice(0, 10),
    result: 'unknown',
    transaction: 'sale',
  }
}

export function ValidityChecker() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([emptyEntry()])

  const updateEntry = (id: string, patch: Partial<DiagnosticEntry>) => {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)))
    // Fire-and-forget tracking côté serveur lors du compute final
    // (déclenché par computeResult ci-dessous)
  }

  const removeEntry = (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id))
  }

  const computeResult = (e: DiagnosticEntry): ValidityResult => {
    const result = checkValidity({
      diagnosticType: e.diagnosticType,
      performedAt: e.performedAt,
      result: e.result,
      transaction: e.transaction,
    })
    // Track côté serveur (silencieux)
    void fetch('/api/utilities/check-validity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        diagnosticType: e.diagnosticType,
        performedAt: e.performedAt,
        result: e.result,
        transaction: e.transaction,
      }),
    }).catch(() => undefined)
    return result
  }

  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default">
        <CardTitle>Diagnostics à vérifier</CardTitle>
        <CardDescription className="mt-1">
          Ajoutez chaque diag existant. La validité est recalculée en direct selon les règles
          réglementaires à jour (mai 2026).
        </CardDescription>
      </Card>

      <div className="space-y-4">
        {entries.map((e) => {
          const result = computeResult(e)
          const showResultField = e.diagnosticType === 'AMIANTE' || e.diagnosticType === 'PLOMB'
          const showTransaction =
            e.diagnosticType === 'PLOMB' ||
            e.diagnosticType === 'GAZ' ||
            e.diagnosticType === 'ELEC'
          return (
            <Card key={e.id} variant="opaque" padding="default">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`dt-${e.id}`} className="mb-1.5">
                    Type
                  </Label>
                  <Select
                    id={`dt-${e.id}`}
                    value={e.diagnosticType}
                    onChange={(ev) =>
                      updateEntry(e.id, { diagnosticType: ev.target.value as DiagnosticType })
                    }
                  >
                    {DIAGNOSTIC_TYPES.map((d) => (
                      <option key={d} value={d}>
                        {DIAG_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`pa-${e.id}`} className="mb-1.5">
                    Date de réalisation
                  </Label>
                  <Input
                    id={`pa-${e.id}`}
                    type="date"
                    value={e.performedAt}
                    onChange={(ev) => updateEntry(e.id, { performedAt: ev.target.value })}
                  />
                </div>
                {showResultField ? (
                  <div>
                    <Label htmlFor={`r-${e.id}`} className="mb-1.5">
                      Résultat
                    </Label>
                    <Select
                      id={`r-${e.id}`}
                      value={e.result}
                      onChange={(ev) =>
                        updateEntry(e.id, { result: ev.target.value as DiagnosticResult })
                      }
                    >
                      <option value="negative">Négatif</option>
                      <option value="positive">Positif</option>
                      <option value="unknown">Inconnu</option>
                    </Select>
                  </div>
                ) : null}
                {showTransaction ? (
                  <div>
                    <Label htmlFor={`tx-${e.id}`} className="mb-1.5">
                      Contexte
                    </Label>
                    <Select
                      id={`tx-${e.id}`}
                      value={e.transaction}
                      onChange={(ev) =>
                        updateEntry(e.id, { transaction: ev.target.value as TransactionContext })
                      }
                    >
                      <option value="sale">Vente</option>
                      <option value="rental">Location</option>
                      <option value="unknown">Indéterminé</option>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="mt-4">
                <ValidityResultDisplay result={result} />
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEntry(e.id)}
                  disabled={entries.length === 1}
                >
                  <Trash2 className="size-4" />
                  Supprimer
                </Button>
              </div>
            </Card>
          )
        })}

        <Button
          type="button"
          variant="outline"
          onClick={() => setEntries((es) => [...es, emptyEntry()])}
        >
          <Plus className="size-4" />
          Ajouter un diagnostic
        </Button>
      </div>
    </div>
  )
}

function ValidityResultDisplay({ result }: { result: ValidityResult }) {
  const map = {
    valid: {
      Icon: CheckCircle2,
      iconClass: 'text-success',
      bg: 'bg-success/8',
      border: 'border-success/30',
    },
    expiring_soon: {
      Icon: TriangleAlert,
      iconClass: 'text-amber',
      bg: 'bg-amber/8',
      border: 'border-amber/30',
    },
    expired: {
      Icon: XCircle,
      iconClass: 'text-danger',
      bg: 'bg-danger/8',
      border: 'border-danger/30',
    },
    unlimited: {
      Icon: InfinityIcon,
      iconClass: 'text-navy',
      bg: 'bg-navy/5',
      border: 'border-navy/20',
    },
  } as const
  const v = map[result.status]
  const { Icon } = v
  return (
    <div className={`rounded-md border ${v.border} ${v.bg} p-3.5`}>
      <div className="flex items-start gap-3">
        <Icon className={`size-5 shrink-0 mt-0.5 ${v.iconClass}`} />
        <div className="space-y-1">
          <p className="text-[13px] font-semibold text-ink">{result.message}</p>
          <p className="text-[12px] text-ink-mute">{result.recommendation}</p>
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint mt-1.5">
            {result.referenceRule}
          </p>
        </div>
      </div>
    </div>
  )
}
