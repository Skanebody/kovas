'use client'

/**
 * Composer broadcast : subject + body HTML + filtres d'audience.
 *
 * - Live preview HTML (sandboxed via dangerouslySetInnerHTML, scope admin).
 * - Compteur destinataires (calcul approximatif client basé sur stats fournies
 *   par le serveur via prop initialAudienceStats — V2 : endpoint live count).
 * - Boutons : "Envoyer test à moi-même" + "Envoyer à tous"
 * - Confirmation modal si > 50 destinataires.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  BROADCAST_CONFIRM_THRESHOLD,
  BROADCAST_MAX_RECIPIENTS,
  type BroadcastAudienceFilter,
  type BroadcastAudiencePlan,
  type BroadcastAudienceStatus,
  type BroadcastCustomSegment,
} from '@/lib/admin/broadcasts-types'
import { Send, TestTubeDiagonal, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'

const PLAN_OPTIONS: Array<{ value: BroadcastAudiencePlan; label: string }> = [
  { value: 'all', label: 'Tous plans' },
  { value: 'decouverte', label: 'Découverte' },
  { value: 'standard', label: 'Standard' },
  { value: 'volume', label: 'Volume' },
  { value: 'founder', label: 'Founder' },
  { value: 'cabinet', label: 'Cabinet' },
]

const STATUS_OPTIONS: Array<{ value: BroadcastAudienceStatus; label: string }> = [
  { value: 'all', label: 'Tous statuts' },
  { value: 'active', label: 'Actifs' },
  { value: 'trialing', label: 'En essai' },
  { value: 'cancelled', label: 'Annulés' },
]

const SEGMENT_OPTIONS: Array<{ value: BroadcastCustomSegment; label: string }> = [
  { value: 'top_ai_consumers', label: 'Top 10% IA' },
  { value: 'no_mission_30d', label: 'Inactifs 30j' },
  { value: 'past_due', label: 'Paiement en retard' },
  { value: 'recent_signup_7d', label: 'Signup récent (7j)' },
]

interface BroadcastComposerProps {
  totalUsers: number
}

interface ApiError {
  error?: string
  retry_with_confirmation?: boolean
  recipients_count?: number
}

interface BroadcastResponse {
  ok: boolean
  recipients: number
  sent: number
  errors: number
}

export function BroadcastComposer({ totalUsers }: BroadcastComposerProps) {
  const router = useRouter()
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')

  const [plans, setPlans] = useState<BroadcastAudiencePlan[]>(['all'])
  const [statuses, setStatuses] = useState<BroadcastAudienceStatus[]>(['all'])
  const [segments, setSegments] = useState<BroadcastCustomSegment[]>([])

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingRecipients, setPendingRecipients] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const togglePlan = (value: BroadcastAudiencePlan) => {
    setPlans((prev) => {
      if (value === 'all') return ['all']
      const without = prev.filter((p) => p !== 'all' && p !== value)
      return prev.includes(value) ? (without.length ? without : ['all']) : [...without, value]
    })
  }
  const toggleStatus = (value: BroadcastAudienceStatus) => {
    setStatuses((prev) => {
      if (value === 'all') return ['all']
      const without = prev.filter((s) => s !== 'all' && s !== value)
      return prev.includes(value) ? (without.length ? without : ['all']) : [...without, value]
    })
  }
  const toggleSegment = (value: BroadcastCustomSegment) => {
    setSegments((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
    )
  }

  // Estimation locale : si plans/statuses inclut 'all' et 0 segment, on retombe
  // sur totalUsers; sinon une heuristique basse (V2 : endpoint live count).
  const estimatedRecipients = useMemo(() => {
    if (segments.length > 0) return Math.min(BROADCAST_MAX_RECIPIENTS, Math.ceil(totalUsers / 10))
    if (plans.includes('all') && statuses.includes('all'))
      return Math.min(BROADCAST_MAX_RECIPIENTS, totalUsers)
    const planCount = plans.includes('all') ? 5 : plans.length
    const statusCount = statuses.includes('all') ? 4 : statuses.length
    return Math.min(
      BROADCAST_MAX_RECIPIENTS,
      Math.ceil((totalUsers * planCount * statusCount) / 20),
    )
  }, [plans, statuses, segments, totalUsers])

  const buildAudience = (): BroadcastAudienceFilter => ({
    plans,
    statuses,
    custom_segments: segments,
  })

  const sendRequest = async (params: {
    testToSelf: boolean
    confirmLarge: boolean
  }): Promise<
    { ok: true; data: BroadcastResponse } | { ok: false; status: number; error: ApiError }
  > => {
    const res = await fetch('/api/admin/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: subject.trim(),
        body_html: bodyHtml.trim(),
        body_text: bodyText.trim() || undefined,
        audience: buildAudience(),
        test_to_self: params.testToSelf,
        confirm_large: params.confirmLarge,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as ApiError
      return { ok: false, status: res.status, error: err }
    }
    const data = (await res.json()) as BroadcastResponse
    return { ok: true, data }
  }

  const handleTestSelf = () => {
    setError(null)
    setFeedback(null)
    if (!subject.trim() || !bodyHtml.trim()) {
      setError('Sujet et contenu HTML requis')
      return
    }
    startTransition(async () => {
      const res = await sendRequest({ testToSelf: true, confirmLarge: false })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback(`Test envoyé · ${res.data.sent}/${res.data.recipients}`)
      router.refresh()
    })
  }

  const handleSendAll = () => {
    setError(null)
    setFeedback(null)
    if (!subject.trim() || !bodyHtml.trim()) {
      setError('Sujet et contenu HTTP requis')
      return
    }
    if (estimatedRecipients > BROADCAST_CONFIRM_THRESHOLD) {
      setPendingRecipients(estimatedRecipients)
      setConfirmOpen(true)
      return
    }
    startTransition(async () => {
      const res = await sendRequest({ testToSelf: false, confirmLarge: false })
      if (!res.ok) {
        if (res.error.retry_with_confirmation) {
          setPendingRecipients(res.error.recipients_count ?? estimatedRecipients)
          setConfirmOpen(true)
          return
        }
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback(`Envoyé · ${res.data.sent}/${res.data.recipients} · ${res.data.errors} erreurs`)
      router.refresh()
    })
  }

  const handleConfirmedSend = () => {
    setConfirmOpen(false)
    startTransition(async () => {
      const res = await sendRequest({ testToSelf: false, confirmLarge: true })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback(`Envoyé · ${res.data.sent}/${res.data.recipients} · ${res.data.errors} erreurs`)
      router.refresh()
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          ✉️ Broadcast · Envoi de masse
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Composer un broadcast
        </h2>
      </header>

      <div className="space-y-3">
        <div>
          <label
            htmlFor="bc-subject"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Sujet
          </label>
          <Input
            id="bc-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ex : Nouvelle version KOVAS disponible"
            className="mt-1"
          />
        </div>

        <div>
          <label
            htmlFor="bc-html"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Contenu HTML
          </label>
          <Textarea
            id="bc-html"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="<p>Bonjour {{name}}, ...</p>"
            rows={8}
            className="mt-1 font-mono text-[12px]"
          />
        </div>

        <div>
          <label
            htmlFor="bc-text"
            className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
          >
            Version texte (fallback)
          </label>
          <Textarea
            id="bc-text"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Version texte brut (optionnel)"
            rows={3}
            className="mt-1 font-mono text-[12px]"
          />
        </div>

        {bodyHtml.trim() ? (
          <div className="rounded-lg border border-rule bg-paper-soft p-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-2">
              Aperçu HTML
            </p>
            <div
              className="prose prose-sm max-w-none text-ink"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: preview admin scope, contenu rédigé par admin
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-3 rounded-lg border border-rule p-4">
        <legend className="text-[11px] font-mono uppercase tracking-wider text-ink-mute px-2">
          Audience
        </legend>
        <div>
          <p className="text-[11px] text-ink-mute mb-1.5">Plans</p>
          <div className="flex flex-wrap gap-1.5">
            {PLAN_OPTIONS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePlan(p.value)}
                className={`text-[11px] px-2.5 py-1 rounded-pill border transition-colors ${
                  plans.includes(p.value)
                    ? 'bg-navy text-paper border-navy'
                    : 'bg-paper text-ink border-rule hover:border-navy/40'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-ink-mute mb-1.5">Statuts</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleStatus(s.value)}
                className={`text-[11px] px-2.5 py-1 rounded-pill border transition-colors ${
                  statuses.includes(s.value)
                    ? 'bg-navy text-paper border-navy'
                    : 'bg-paper text-ink border-rule hover:border-navy/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-ink-mute mb-1.5">Segments custom (optionnels)</p>
          <div className="flex flex-wrap gap-1.5">
            {SEGMENT_OPTIONS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSegment(s.value)}
                className={`text-[11px] px-2.5 py-1 rounded-pill border transition-colors ${
                  segments.includes(s.value)
                    ? 'bg-chartreuse text-ink border-chartreuse'
                    : 'bg-paper text-ink border-rule hover:border-navy/40'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-ink-mute">
          <Users className="size-3.5" aria-hidden />
          <span>
            <strong className="text-ink">~{estimatedRecipients}</strong> destinataires estimés
            {estimatedRecipients >= BROADCAST_MAX_RECIPIENTS ? (
              <span className="text-amber-700 font-mono ml-1">
                (cap V1 = {BROADCAST_MAX_RECIPIENTS})
              </span>
            ) : null}
          </span>
        </div>
      </fieldset>

      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? <output className="block text-[12px] text-emerald-700">{feedback}</output> : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={handleTestSelf}
          disabled={isPending}
        >
          <TestTubeDiagonal className="size-4" aria-hidden />
          {isPending ? 'Envoi…' : 'Envoyer test à moi-même'}
        </Button>
        <Button
          type="button"
          variant="default"
          size="default"
          onClick={handleSendAll}
          disabled={isPending}
        >
          <Send className="size-4" aria-hidden />
          {isPending ? 'Envoi…' : 'Envoyer à tous'}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi à {pendingRecipients} destinataires</DialogTitle>
            <DialogDescription>
              Vous allez envoyer ce broadcast à {pendingRecipients} utilisateurs (au-delà du seuil
              de confirmation de {BROADCAST_CONFIRM_THRESHOLD}). Action irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmedSend}
              disabled={isPending}
            >
              Confirmer l'envoi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
