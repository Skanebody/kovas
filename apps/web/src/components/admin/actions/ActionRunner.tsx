'use client'

/**
 * Helper réutilisable : bouton qui POST sur /api/admin/tools/[tool] ou
 * /api/admin/tests/[test] et affiche durée + résultat OK/KO.
 */

import { Button } from '@/components/ui/button'
import { useState, useTransition } from 'react'

interface ActionRunnerProps {
  /** Label affiché sur le bouton. */
  label: string
  /** Endpoint complet (ex : `/api/admin/tools/cache-purge`). */
  endpoint: string
  /** Description courte affichée sous le bouton. */
  description?: string
  /** Si true, demande confirmation window.confirm() avant exécution. */
  confirm?: boolean
  /** Champ texte additionnel envoyé dans le body sous la clé `body_key`. */
  inputField?: {
    key: string
    label: string
    placeholder?: string
    defaultValue?: string
  }
  /** Variant du bouton */
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
}

interface ApiResponse {
  ok?: boolean
  message?: string
  detail?: string
  duration_ms?: number
  error?: string
}

export function ActionRunner({
  label,
  endpoint,
  description,
  confirm,
  inputField,
  variant = 'outline',
}: ActionRunnerProps) {
  const [inputValue, setInputValue] = useState(inputField?.defaultValue ?? '')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    ok: boolean
    detail: string
    duration_ms: number
  } | null>(null)

  const run = () => {
    if (confirm && !window.confirm(`Confirmer : ${label} ?`)) return
    setResult(null)
    const body: Record<string, unknown> = {}
    if (inputField) body[inputField.key] = inputValue
    startTransition(async () => {
      const start = Date.now()
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json().catch(() => ({}))) as ApiResponse
      const duration = json.duration_ms ?? Date.now() - start
      const detail =
        json.detail ?? json.message ?? json.error ?? (res.ok ? 'ok' : `HTTP ${res.status}`)
      setResult({ ok: res.ok && json.ok !== false, detail, duration_ms: duration })
    })
  }

  return (
    <div className="rounded-lg border border-rule bg-paper-soft p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-[13px] font-semibold text-ink">{label}</p>
          {description ? <p className="text-[11px] text-ink-mute mt-0.5">{description}</p> : null}
        </div>
      </div>
      {inputField ? (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={inputField.placeholder}
          aria-label={inputField.label}
          className="w-full rounded-md border border-rule bg-paper px-2 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/20"
        />
      ) : null}
      <div className="flex items-center gap-2">
        <Button variant={variant} size="sm" onClick={run} disabled={isPending}>
          {isPending ? 'Exécution…' : 'Exécuter'}
        </Button>
        {result ? (
          <span
            className={`text-[11px] font-mono ${result.ok ? 'text-emerald-700' : 'text-danger'}`}
          >
            {result.ok ? '✓ OK' : '✗ KO'} · {result.duration_ms}ms · {result.detail}
          </span>
        ) : null}
      </div>
    </div>
  )
}
