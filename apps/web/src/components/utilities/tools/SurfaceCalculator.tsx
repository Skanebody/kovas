'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import {
  PIECE_FORM_FIELDS,
  PIECE_FORM_LABEL,
  type PieceEntry,
  type PieceFormType,
  calculateSurface,
  calculateTotal,
  emptyPieceEntry,
  exportPiecesAsText,
} from '@/lib/utilities/surface-calculator'
import { Copy, FileText, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

export function SurfaceCalculator() {
  const [pieces, setPieces] = useState<PieceEntry[]>([emptyPieceEntry('rectangle', 'Pièce 1')])

  const total = useMemo(() => calculateTotal(pieces), [pieces])

  const updatePiece = (id: string, patch: Partial<PieceEntry>) => {
    setPieces((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p
        const next: PieceEntry = { ...p, ...patch }
        next.surface = calculateSurface(next.dimensions)
        return next
      }),
    )
  }

  const changeFormType = (id: string, formType: PieceFormType) => {
    setPieces((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p
        const values = new Array<number>(PIECE_FORM_FIELDS[formType].length).fill(0)
        const dimensions = { formType, values }
        return { ...p, formType, dimensions, surface: calculateSurface(dimensions) }
      }),
    )
  }

  const updateValue = (id: string, index: number, value: number) => {
    setPieces((ps) =>
      ps.map((p) => {
        if (p.id !== id) return p
        const values = [...p.dimensions.values]
        values[index] = value
        const dimensions = { formType: p.formType, values }
        return { ...p, dimensions, surface: calculateSurface(dimensions) }
      }),
    )
  }

  const addPiece = () => {
    setPieces((ps) => [...ps, emptyPieceEntry('rectangle', `Pièce ${ps.length + 1}`)])
  }

  const removePiece = (id: string) => {
    setPieces((ps) => ps.filter((p) => p.id !== id))
  }

  const trackUsage = () => {
    void fetch('/api/utilities/calculate-surface', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pieces: pieces.map((p) => ({
          id: p.id,
          name: p.name,
          formType: p.formType,
          values: p.dimensions.values,
          notes: p.notes,
        })),
      }),
    }).catch(() => undefined)
  }

  const copyText = () => {
    const text = exportPiecesAsText(pieces)
    void navigator.clipboard.writeText(text)
    toast.success('Copié', { description: 'Le détail des surfaces est dans le presse-papier.' })
    trackUsage()
  }

  return (
    <div className="space-y-5">
      <Card variant="opaque" padding="default">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Total</CardTitle>
            <CardDescription className="mt-1">
              Somme des surfaces saisies (mise à jour en direct).
            </CardDescription>
          </div>
          <p
            className="font-serif italic text-ink"
            style={{ fontSize: 'clamp(48px, 8vw, 96px)', lineHeight: 1 }}
          >
            {total} m²
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        {pieces.map((p, i) => (
          <Card key={p.id} variant="opaque" padding="default">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor={`name-${p.id}`} className="mb-1.5">
                  Nom de la pièce
                </Label>
                <Input
                  id={`name-${p.id}`}
                  value={p.name}
                  onChange={(e) => updatePiece(p.id, { name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`form-${p.id}`} className="mb-1.5">
                  Forme
                </Label>
                <Select
                  id={`form-${p.id}`}
                  value={p.formType}
                  onChange={(e) => changeFormType(p.id, e.target.value as PieceFormType)}
                >
                  {(Object.keys(PIECE_FORM_LABEL) as PieceFormType[]).map((f) => (
                    <option key={f} value={f}>
                      {PIECE_FORM_LABEL[f]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col">
                <Label className="mb-1.5">Surface</Label>
                <div className="font-mono text-[22px] font-semibold text-ink leading-none pt-2">
                  {p.surface} m²
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {PIECE_FORM_FIELDS[p.formType].map((field, idx) => (
                <div key={field.key}>
                  <Label htmlFor={`${p.id}-${field.key}`} className="mb-1.5">
                    {field.label}
                  </Label>
                  <Input
                    id={`${p.id}-${field.key}`}
                    type="number"
                    step="0.01"
                    min={0}
                    value={p.dimensions.values[idx] ?? 0}
                    onChange={(e) => updateValue(p.id, idx, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-between items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-faint">
                Pièce {i + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removePiece(p.id)}
                disabled={pieces.length === 1}
              >
                <Trash2 className="size-4" />
                Supprimer
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={addPiece}>
          <Plus className="size-4" />
          Ajouter une pièce
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.info('Copier vers Carrez', {
              description: 'Branchement automatique sur un dossier en cours — V2.',
            })
          }
        >
          Copier vers Carrez
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            toast.info('Copier vers Boutin', {
              description: 'Branchement automatique sur un dossier en cours — V2.',
            })
          }
        >
          Copier vers Boutin
        </Button>
        <Button type="button" variant="outline" onClick={copyText}>
          <Copy className="size-4" />
          Copier le détail
        </Button>
        <Button
          type="button"
          variant="accent"
          onClick={() => {
            const blob = new Blob([exportPiecesAsText(pieces)], { type: 'text/plain' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'surfaces-kovas.txt'
            a.click()
            URL.revokeObjectURL(url)
            trackUsage()
          }}
        >
          <FileText className="size-4" />
          Export texte
        </Button>
      </div>
    </div>
  )
}
