'use client'

/**
 * OKREditor — formulaire create/edit OKR avec gestion key_results dynamiques.
 *
 * Submit POST /api/admin/okrs (create) ou PATCH /api/admin/okrs/[id] (edit).
 * Router refresh après succès.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { KeyResult, OkrRow, OkrStatus } from '@/lib/admin/milestones-types'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState, useTransition } from 'react'

type EditorMode = 'create' | 'edit'

export interface OKREditorProps {
  mode: EditorMode
  /** En create : quarter pré-rempli (nextQuarter). */
  initialQuarter?: string
  /** En edit : OKR existant. */
  okr?: OkrRow
  onClose: () => void
}

interface KeyResultDraft extends KeyResult {
  /** UID local stable pour `key` React (jamais persisté). */
  _uid: string
}

interface FormState {
  quarter: string
  objective: string
  status: OkrStatus
  keyResults: KeyResultDraft[]
}

let krCounter = 0
function newUid(): string {
  krCounter += 1
  return `kr-${Date.now()}-${krCounter}`
}

function emptyKR(): KeyResultDraft {
  return { _uid: newUid(), name: '', target: 0, current: 0, unit: '' }
}

export function OKREditor({ mode, initialQuarter, okr, onClose }: OKREditorProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const fieldId = useId()

  const initial = useMemo<FormState>(
    () => ({
      quarter: okr?.quarter ?? initialQuarter ?? '',
      objective: okr?.objective ?? '',
      status: okr?.status ?? 'draft',
      keyResults: okr?.key_results.length
        ? okr.key_results.map((kr) => ({ ...kr, _uid: newUid() }))
        : [emptyKR()],
    }),
    [okr, initialQuarter],
  )

  const [form, setForm] = useState<FormState>(initial)

  const updateKR = (uid: string, patch: Partial<KeyResult>) => {
    setForm((prev) => ({
      ...prev,
      keyResults: prev.keyResults.map((kr) => (kr._uid === uid ? { ...kr, ...patch } : kr)),
    }))
  }

  const addKR = () => {
    setForm((prev) => ({ ...prev, keyResults: [...prev.keyResults, emptyKR()] }))
  }

  const removeKR = (uid: string) => {
    setForm((prev) => ({
      ...prev,
      keyResults: prev.keyResults.filter((kr) => kr._uid !== uid),
    }))
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation minimale
    if (!form.quarter.trim() || !form.objective.trim()) {
      setError('Trimestre et objectif requis.')
      return
    }
    const cleanedKRs = form.keyResults
      .map((kr) => ({
        name: kr.name.trim(),
        target: Number(kr.target) || 0,
        current: Number(kr.current) || 0,
        unit: kr.unit?.trim() || null,
      }))
      .filter((kr) => kr.name.length > 0)

    startTransition(async () => {
      try {
        const url = mode === 'create' ? '/api/admin/okrs' : `/api/admin/okrs/${okr?.id}`
        const method = mode === 'create' ? 'POST' : 'PATCH'
        const body = {
          quarter: form.quarter.trim(),
          objective: form.objective.trim(),
          status: form.status,
          key_results: cleanedKRs,
        }
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        router.refresh()
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-navy/20 bg-paper p-5 space-y-4"
      aria-label={mode === 'create' ? 'Créer un OKR' : 'Modifier OKR'}
    >
      <header className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-ink">
          {mode === 'create' ? 'Nouvel OKR' : 'Modifier OKR'}
        </h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Annuler
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor={`${fieldId}-quarter`}
            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
          >
            Trimestre
          </label>
          <Input
            id={`${fieldId}-quarter`}
            value={form.quarter}
            onChange={(e) => setForm((p) => ({ ...p, quarter: e.target.value }))}
            placeholder="2026-Q4"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label
            htmlFor={`${fieldId}-status`}
            className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
          >
            Statut
          </label>
          <Select
            id={`${fieldId}-status`}
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as OkrStatus }))}
          >
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
            <option value="cancelled">Annulé</option>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`${fieldId}-objective`}
          className="block font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
        >
          Objectif
        </label>
        <Input
          id={`${fieldId}-objective`}
          value={form.objective}
          onChange={(e) => setForm((p) => ({ ...p, objective: e.target.value }))}
          placeholder="Atteindre 100 utilisateurs payants"
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            Key results · {form.keyResults.length}
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={addKR}>
            + Ajouter KR
          </Button>
        </div>
        <ul className="space-y-2">
          {form.keyResults.map((kr) => (
            <li
              key={kr._uid}
              className="rounded-md border border-rule/60 bg-cream-deep/30 p-3 space-y-2"
            >
              <Input
                value={kr.name}
                onChange={(e) => updateKR(kr._uid, { name: e.target.value })}
                placeholder="Nom du KR"
                aria-label="Nom du key result"
              />
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label
                    htmlFor={`${fieldId}-${kr._uid}-target`}
                    className="block font-mono text-[9px] uppercase tracking-wider text-ink-faint"
                  >
                    Cible
                  </label>
                  <Input
                    id={`${fieldId}-${kr._uid}-target`}
                    type="number"
                    value={kr.target}
                    onChange={(e) =>
                      updateKR(kr._uid, { target: Number.parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${fieldId}-${kr._uid}-current`}
                    className="block font-mono text-[9px] uppercase tracking-wider text-ink-faint"
                  >
                    Actuel
                  </label>
                  <Input
                    id={`${fieldId}-${kr._uid}-current`}
                    type="number"
                    value={kr.current}
                    onChange={(e) =>
                      updateKR(kr._uid, { current: Number.parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor={`${fieldId}-${kr._uid}-unit`}
                    className="block font-mono text-[9px] uppercase tracking-wider text-ink-faint"
                  >
                    Unité
                  </label>
                  <Input
                    id={`${fieldId}-${kr._uid}-unit`}
                    value={kr.unit ?? ''}
                    onChange={(e) => updateKR(kr._uid, { unit: e.target.value })}
                    placeholder="€, users, %"
                  />
                </div>
              </div>
              {form.keyResults.length > 1 ? (
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeKR(kr._uid)}>
                    Supprimer
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" variant="accent" size="sm" disabled={isPending}>
          {isPending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
