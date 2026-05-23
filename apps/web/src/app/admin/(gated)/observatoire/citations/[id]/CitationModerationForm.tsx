'use client'

/**
 * Formulaire client de modération d'une citation presse.
 *
 * 3 boutons d'action :
 *   - Valider (status = verified)
 *   - Rejeter (status = rejected + raison saisie)
 *   - Sauvegarder uniquement les corrections de champs (sans changer le statut)
 *
 * Toutes les actions passent par les Server Actions de `./actions.ts` qui
 * ré-vérifient l'accès admin côté serveur.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { PressCitation } from '@/lib/observatoire/press-citations'
import { CheckCircle2, Loader2, Save, XCircle } from 'lucide-react'
import { useState, useTransition } from 'react'
import { updatePressCitation } from './actions'

interface Props {
  readonly citation: PressCitation
  readonly mediaName: string
}

type ResultState = { kind: 'idle' } | { kind: 'success' | 'error'; message: string }

export function CitationModerationForm({ citation, mediaName }: Props) {
  const [articleTitle, setArticleTitle] = useState(citation.articleTitle)
  const [articleUrl, setArticleUrl] = useState(citation.articleUrl)
  const [quoteExcerpt, setQuoteExcerpt] = useState(citation.quoteExcerpt)
  const [author, setAuthor] = useState(citation.author ?? '')
  const [publishedAt, setPublishedAt] = useState(citation.publishedAt)
  const [displayOrder, setDisplayOrder] = useState(String(citation.displayOrder))
  const [rejectionReason, setRejectionReason] = useState(citation.rejectionReason ?? '')
  const [result, setResult] = useState<ResultState>({ kind: 'idle' })
  const [pending, startTransition] = useTransition()

  function submit(status: 'verified' | 'rejected' | 'pending_review') {
    setResult({ kind: 'idle' })
    startTransition(async () => {
      try {
        const res = await updatePressCitation({
          id: citation.id,
          status,
          articleTitle,
          articleUrl,
          quoteExcerpt,
          author: author.trim() === '' ? null : author.trim(),
          publishedAt,
          displayOrder: Number.parseInt(displayOrder, 10) || 100,
          rejectionReason: status === 'rejected' ? rejectionReason : null,
        })
        if (res.ok) {
          setResult({
            kind: 'success',
            message:
              status === 'verified'
                ? 'Citation validée et publiée sur /observatoire.'
                : status === 'rejected'
                  ? 'Citation rejetée.'
                  : 'Modifications enregistrées (statut inchangé).',
          })
        } else {
          setResult({
            kind: 'error',
            message: res.error ?? 'Erreur lors de la sauvegarde.',
          })
        }
      } catch (err) {
        setResult({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Erreur inconnue.',
        })
      }
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <header className="space-y-1">
        <h2 className="text-base font-semibold text-ink">Vérifier la source — {mediaName}</h2>
        <p className="text-xs text-ink-mute">
          Toute modification corrige l&apos;entrée stockée en base. La validation estampille votre
          identité et publie immédiatement sur /observatoire.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="article-url">URL de l&apos;article source</Label>
          <Input
            id="article-url"
            type="url"
            required
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="published-at">Date de publication</Label>
          <Input
            id="published-at"
            type="date"
            required
            value={publishedAt.slice(0, 10)}
            onChange={(e) => setPublishedAt(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="article-title">Titre de l&apos;article</Label>
        <Input
          id="article-title"
          required
          value={articleTitle}
          onChange={(e) => setArticleTitle(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quote-excerpt">Extrait cité</Label>
        <Textarea
          id="quote-excerpt"
          required
          rows={5}
          value={quoteExcerpt}
          onChange={(e) => setQuoteExcerpt(e.target.value)}
          placeholder="Citation littérale issue de l'article original"
        />
        <p className="text-[11px] text-ink-mute">
          Citer mot-à-mot. Pas de paraphrase. {quoteExcerpt.length} caractères.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="author">Auteur (optionnel)</Label>
          <Input
            id="author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="ex : Rédaction Les Échos"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="display-order">Ordre d&apos;affichage</Label>
          <Input
            id="display-order"
            type="number"
            min={1}
            max={9999}
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rejection-reason">
          Raison du rejet (requise uniquement si vous rejetez)
        </Label>
        <Textarea
          id="rejection-reason"
          rows={2}
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="ex : Lien article cassé / extrait paraphrasé / source secondaire"
        />
      </div>

      {result.kind !== 'idle' ? (
        <div
          className={`text-sm rounded-md border px-3 py-2 ${
            result.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {result.message}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rule/40">
        <Button
          type="button"
          onClick={() => submit('verified')}
          disabled={pending}
          variant="default"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Valider et publier
        </Button>
        <Button
          type="button"
          onClick={() => submit('rejected')}
          disabled={pending || rejectionReason.trim().length < 3}
          variant="outline"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
          Rejeter
        </Button>
        <Button
          type="button"
          onClick={() => submit('pending_review')}
          disabled={pending}
          variant="ghost"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer sans changer le statut
        </Button>
      </div>
    </Card>
  )
}
