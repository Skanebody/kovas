'use client'

/**
 * <CaseResponses> — fil de discussion + formulaire de réponse.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { type CommunityCaseResponseRow, authorPseudonym } from '@/lib/community/types'
import { type FormEvent, useState } from 'react'

interface Props {
  caseId: string
  initialResponses: CommunityCaseResponseRow[]
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ApiResponse {
  ok?: true
  response?: CommunityCaseResponseRow
  error?: string
}

export function CaseResponses({ caseId, initialResponses }: Props) {
  const [list, setList] = useState<CommunityCaseResponseRow[]>(initialResponses)
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (body.trim().length < 10) {
      setError('Réponse trop courte (10 caractères minimum)')
      return
    }
    setPending(true)
    try {
      const res = await fetch(`/api/community/cases/${caseId}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      const json = (await res.json().catch(() => ({}))) as ApiResponse
      if (!res.ok || !json.response) {
        setError(json.error ?? 'Erreur inattendue')
        return
      }
      setList((prev) => [...prev, json.response as CommunityCaseResponseRow])
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="space-y-5">
      <h2 className="font-sans font-semibold text-[17px] text-ink">
        Réponses <span className="font-mono text-ink-mute">({list.length})</span>
      </h2>

      <ul className="space-y-3">
        {list.length === 0 ? (
          <li className="text-sm text-ink-mute italic">Aucune réponse pour le moment.</li>
        ) : null}
        {list.map((r) => (
          <li key={r.id}>
            <Card variant="flat" padding="sm">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <p className="text-[11px] font-mono text-ink-faint">
                  {authorPseudonym(r.author_user_id)}
                </p>
                <p className="text-[11px] font-mono text-ink-faint">
                  {formatRelativeDate(r.created_at)}
                </p>
              </div>
              <p className="text-[13px] text-ink leading-relaxed whitespace-pre-wrap">{r.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      <form onSubmit={onSubmit} className="space-y-3">
        <Textarea
          rows={4}
          placeholder="Partagez votre expérience, votre interprétation, vos références…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red"
          >
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="default" disabled={pending}>
          {pending ? 'Envoi…' : 'Publier la réponse'}
        </Button>
      </form>
    </section>
  )
}
