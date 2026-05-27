'use client'

/**
 * KOVAS — <AutoQuoteReview>
 *
 * Validation manuelle d'un devis pré-rempli par IA à partir d'un email entrant
 * de prescripteur (notaire / agent immobilier).
 *
 * 1. Affiche l'extraction IA (adresse, types de diag, surface, client)
 * 2. Aperçu du devis pré-rempli (lignes + HT + TTC)
 * 3. Éditeur inline : prix unitaires, ajout/suppression lignes
 * 4. 3 actions : Envoyer (POST .../send) · Modifier davantage · Rejeter
 *
 * Authority : CLAUDE.md §3 + §16 support IA.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

export interface QuoteLine {
  id: string
  label: string
  quantity: number
  unitPriceCents: number
}

export interface AutoQuoteExtraction {
  address: string
  diagnosticTypes: string[]
  surface: number | null
  clientName: string | null
  clientEmail: string | null
  rawEmailExcerpt: string
}

export interface AutoQuoteData {
  id: string
  status: 'pending_review' | 'sent' | 'rejected'
  extraction: AutoQuoteExtraction
  lines: QuoteLine[]
  vatRate: number // 0.20
  notes: string
}

export interface AutoQuoteReviewProps {
  autoQuoteId: string
  initialData?: AutoQuoteData | null
  /** Notifie le parent après envoi/rejet (refresh listing). */
  onUpdated?: (data: AutoQuoteData) => void
  className?: string
}

type ViewState =
  | { status: 'loading' }
  | { status: 'ready'; data: AutoQuoteData }
  | { status: 'error'; message: string }

function cents(eur: string): number {
  const n = Number.parseFloat(eur.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

function fromCents(c: number): string {
  return (c / 100).toFixed(2)
}

function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export function AutoQuoteReview({
  autoQuoteId,
  initialData,
  onUpdated,
  className,
}: AutoQuoteReviewProps) {
  const [view, setView] = useState<ViewState>(
    initialData ? { status: 'ready', data: initialData } : { status: 'loading' },
  )
  const [pending, setPending] = useState<'save' | 'send' | 'reject' | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const idPrefix = useId()

  useEffect(() => {
    if (initialData) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/auto-quotes/${autoQuoteId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as AutoQuoteData
        if (!cancelled) setView({ status: 'ready', data })
      } catch (err) {
        if (!cancelled)
          setView({
            status: 'error',
            message: err instanceof Error ? err.message : 'erreur inconnue',
          })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [autoQuoteId, initialData])

  if (view.status === 'loading') {
    return (
      <Card variant="opaque" padding="default" className={className}>
        <Skeleton className="h-5 w-1/3 mb-4" />
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-2/3" />
      </Card>
    )
  }

  if (view.status === 'error') {
    return (
      <Card variant="opaque" padding="sm" className={className}>
        <p className="text-[13px] text-accent-red">Devis : {view.message}</p>
      </Card>
    )
  }

  const { data } = view

  const updateLine = (lineId: string, patch: Partial<QuoteLine>) => {
    setView({
      status: 'ready',
      data: {
        ...data,
        lines: data.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
      },
    })
  }

  const removeLine = (lineId: string) => {
    setView({
      status: 'ready',
      data: { ...data, lines: data.lines.filter((l) => l.id !== lineId) },
    })
  }

  const addLine = () => {
    const newLine: QuoteLine = {
      id: `tmp-${Date.now()}`,
      label: 'Nouvelle prestation',
      quantity: 1,
      unitPriceCents: 0,
    }
    setView({
      status: 'ready',
      data: { ...data, lines: [...data.lines, newLine] },
    })
  }

  const persist = async (
    payload: Partial<Pick<AutoQuoteData, 'lines' | 'notes' | 'status'>>,
    op: 'save' | 'send' | 'reject',
  ): Promise<AutoQuoteData | null> => {
    setPending(op)
    try {
      const url =
        op === 'send' ? `/api/auto-quotes/${autoQuoteId}/send` : `/api/auto-quotes/${autoQuoteId}`
      const res = await fetch(url, {
        method: op === 'send' ? 'POST' : 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const next = (await res.json()) as AutoQuoteData
      setView({ status: 'ready', data: next })
      onUpdated?.(next)
      return next
    } catch (err) {
      setView({
        status: 'error',
        message: err instanceof Error ? err.message : 'erreur inconnue',
      })
      return null
    } finally {
      setPending(null)
    }
  }

  const totalHt = data.lines.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0)
  const totalTva = Math.round(totalHt * data.vatRate)
  const totalTtc = totalHt + totalTva

  const locked = data.status !== 'pending_review' || pending !== null

  return (
    <Card variant="opaque" padding="default" className={className}>
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2 font-serif italic font-normal text-[20px]">
            <Sparkles className="size-4 text-ink-mute" />
            Devis auto-généré
          </CardTitle>
          {data.status === 'sent' ? (
            <Badge variant="green">Envoyé</Badge>
          ) : data.status === 'rejected' ? (
            <Badge variant="red">Rejeté</Badge>
          ) : (
            <Badge variant="amber">À valider</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 space-y-5">
        {/* Extraction IA */}
        <section>
          <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute mb-2">
            Extraction depuis l&apos;email
          </p>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Field label="Adresse" value={data.extraction.address} />
            <Field
              label="Surface"
              value={data.extraction.surface ? `${data.extraction.surface} m²` : '—'}
            />
            <Field label="Client" value={data.extraction.clientName ?? '—'} />
            <Field label="Email" value={data.extraction.clientEmail ?? '—'} />
          </dl>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.extraction.diagnosticTypes.map((d) => (
              <Badge key={d} variant="outline">
                {d}
              </Badge>
            ))}
          </div>
          {data.extraction.rawEmailExcerpt ? (
            <details className="mt-2 text-[12px]">
              <summary className="cursor-pointer text-ink-mute">Voir extrait email</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-md border border-rule/60 bg-paper p-2 font-mono text-[11px] text-ink-soft">
                {data.extraction.rawEmailExcerpt}
              </pre>
            </details>
          ) : null}
        </section>

        {/* Lignes éditables */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute">
              Lignes du devis
            </p>
            <Button variant="ghost" size="sm" onClick={addLine} disabled={locked}>
              <Plus className="size-3.5" />
              Ajouter
            </Button>
          </div>
          <ul className="space-y-2">
            {data.lines.map((line, i) => {
              const labelId = `${idPrefix}-l-${i}`
              return (
                <li
                  key={line.id}
                  className="grid grid-cols-[1fr_80px_120px_auto] items-center gap-2 rounded-md border border-rule/60 bg-paper p-2"
                >
                  <Input
                    aria-label={`Désignation ligne ${i + 1}`}
                    id={labelId}
                    value={line.label}
                    onChange={(e) => updateLine(line.id, { label: e.target.value })}
                    disabled={locked}
                  />
                  <Input
                    aria-label="Quantité"
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.id, { quantity: Math.max(1, Number(e.target.value)) })
                    }
                    disabled={locked}
                  />
                  <Input
                    aria-label="Prix unitaire HT"
                    type="text"
                    inputMode="decimal"
                    value={fromCents(line.unitPriceCents)}
                    onChange={(e) => updateLine(line.id, { unitPriceCents: cents(e.target.value) })}
                    disabled={locked}
                  />
                  <button
                    type="button"
                    aria-label="Supprimer la ligne"
                    onClick={() => removeLine(line.id)}
                    disabled={locked}
                    className="flex size-8 items-center justify-center rounded-full text-ink-mute hover:text-accent-red hover:bg-ink/5 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
            <dt className="text-ink-mute text-right">Total HT</dt>
            <dd className="font-mono font-medium text-ink">{formatCurrency(totalHt)}</dd>
            <dt className="text-ink-mute text-right">TVA ({Math.round(data.vatRate * 100)}%)</dt>
            <dd className="font-mono text-ink-soft">{formatCurrency(totalTva)}</dd>
            <dt className="text-ink text-right font-semibold">Total TTC</dt>
            <dd className="font-mono font-bold text-ink text-[15px]">{formatCurrency(totalTtc)}</dd>
          </dl>
        </section>

        <section>
          <p className="text-[11px] uppercase tracking-wider font-mono text-ink-mute mb-1.5">
            Notes
          </p>
          <Textarea
            value={data.notes}
            onChange={(e) => setView({ status: 'ready', data: { ...data, notes: e.target.value } })}
            disabled={locked}
            rows={3}
            placeholder="Conditions, délais, mentions complémentaires…"
          />
        </section>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button
            variant="accent"
            size="sm"
            disabled={locked || data.lines.length === 0}
            onClick={() =>
              void persist({ lines: data.lines, notes: data.notes, status: 'sent' }, 'send')
            }
          >
            {pending === 'send' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Envoyer le devis
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={locked}
            onClick={() => void persist({ lines: data.lines, notes: data.notes }, 'save')}
          >
            {pending === 'save' ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Modifier davantage
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={locked}
            onClick={() => setShowRejectModal(true)}
          >
            <X className="size-3.5" />
            Rejeter
          </Button>
        </div>
      </CardContent>

      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter ce devis ?</DialogTitle>
            <DialogDescription>
              Le devis ne sera pas envoyé. La raison sert à entraîner le modèle d&apos;extraction.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Raison du rejet (optionnel mais utile)"
            rows={3}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={pending === 'reject'}
              onClick={async () => {
                const next = await persist(
                  {
                    status: 'rejected',
                    notes: rejectReason ? `[Rejet] ${rejectReason}\n${data.notes}` : data.notes,
                  },
                  'reject',
                )
                if (next) {
                  setShowRejectModal(false)
                  setRejectReason('')
                }
              }}
            >
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-ink-mute">{label}</dt>
      <dd className="font-medium text-ink truncate">{value}</dd>
    </>
  )
}
