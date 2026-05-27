'use client'

/**
 * <CommunityCaseForm> — soumission d'un cas anonymisé pour modération.
 *
 *  - Client component (state local : tags, references, validation).
 *  - POST → /api/community/cases → INSERT pending.
 *  - Confirmation "Cas en attente de modération" + redirect liste.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  COMMUNITY_BUILDING_TYPES,
  COMMUNITY_BUILDING_TYPE_LABELS,
  COMMUNITY_DIAGNOSTIC_KINDS,
  COMMUNITY_DIAGNOSTIC_LABELS,
  COMMUNITY_YEAR_RANGES,
  COMMUNITY_YEAR_RANGE_LABELS,
  type CommunityBuildingType,
  type CommunityDiagnosticKind,
  type CommunityYearRange,
} from '@/lib/community/types'
import { type FormEvent, useState } from 'react'

interface SubmitResponse {
  ok?: true
  id?: string
  error?: string
}

export function CommunityCaseForm() {
  // Communauté = feature V2 — `useRouter()` retiré jusqu'à réactivation de la page liste.
  const [title, setTitle] = useState('')
  const [buildingType, setBuildingType] = useState<CommunityBuildingType | ''>('')
  const [yearRange, setYearRange] = useState<CommunityYearRange | ''>('')
  const [diagnosticKinds, setDiagnosticKinds] = useState<CommunityDiagnosticKind[]>([])
  const [context, setContext] = useState('')
  const [question, setQuestion] = useState('')
  const [decisionMade, setDecisionMade] = useState('')
  const [justification, setJustification] = useState('')
  const [referenceInput, setReferenceInput] = useState('')
  const [references, setReferences] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const toggleDiagnostic = (k: CommunityDiagnosticKind) => {
    setDiagnosticKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  }

  const addReference = () => {
    const v = referenceInput.trim()
    if (v.length === 0 || references.includes(v) || references.length >= 6) return
    setReferences((prev) => [...prev, v])
    setReferenceInput('')
  }

  const addTag = () => {
    const v = tagInput.trim().toLowerCase()
    if (v.length === 0 || tags.includes(v) || tags.length >= 6) return
    setTags((prev) => [...prev, v])
    setTagInput('')
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch('/api/community/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          buildingType: buildingType || null,
          yearRange: yearRange || null,
          diagnosticKinds,
          context,
          question,
          decisionMade: decisionMade.trim() || null,
          justification: justification.trim() || null,
          references,
          tags,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as SubmitResponse
      if (!res.ok) {
        setError(json.error ?? 'Erreur inattendue')
        return
      }
      setSubmitted(true)
      // Communauté = feature V2 — la page /dashboard/communaute n'existe pas en V1.
      // Le redirect après modération sera réactivé quand la page liste sera live.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setPending(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-chartreuse/40 bg-chartreuse/10 p-8 text-center space-y-3">
        <h2 className="font-serif italic text-2xl text-ink">Cas en attente de modération</h2>
        <p className="text-sm text-ink-mute max-w-md mx-auto leading-relaxed">
          Merci. Votre cas sera examiné sous 24-48h. Une notification vous sera envoyée à
          l&apos;approbation. Toute information identifiante sera expurgée par l&apos;anonymisation
          automatique avant publication.
        </p>
        <p className="text-[11px] text-ink-faint font-mono">Redirection vers la communauté…</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 max-w-3xl">
      <FormField
        label="Titre du cas"
        htmlFor="title"
        required
        hint="Résumé en 1 ligne — ex. « DPE maison 1850 avec étiquette A revendiquée »"
      >
        <Input
          id="title"
          name="title"
          required
          minLength={5}
          maxLength={200}
          placeholder="DPE maison 1850 étiquette A revendiquée"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Type de bâtiment" htmlFor="buildingType">
          <Select
            id="buildingType"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value as CommunityBuildingType | '')}
          >
            <option value="">— Sélectionner —</option>
            {COMMUNITY_BUILDING_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMUNITY_BUILDING_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Époque de construction" htmlFor="yearRange">
          <Select
            id="yearRange"
            value={yearRange}
            onChange={(e) => setYearRange(e.target.value as CommunityYearRange | '')}
          >
            <option value="">— Sélectionner —</option>
            {COMMUNITY_YEAR_RANGES.map((y) => (
              <option key={y} value={y}>
                {COMMUNITY_YEAR_RANGE_LABELS[y]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField label="Diagnostics concernés" hint="Sélection multiple">
        <div className="flex flex-wrap gap-1.5">
          {COMMUNITY_DIAGNOSTIC_KINDS.map((k) => {
            const active = diagnosticKinds.includes(k)
            return (
              <button
                type="button"
                key={k}
                onClick={() => toggleDiagnostic(k)}
                className={
                  active
                    ? 'rounded-pill border border-[#0F1419] bg-[#0F1419] text-white px-3 py-1 text-[11px] font-semibold'
                    : 'rounded-pill border border-rule bg-paper text-ink-mute px-3 py-1 text-[11px] font-semibold hover:bg-sage-alt'
                }
              >
                {COMMUNITY_DIAGNOSTIC_LABELS[k]}
              </button>
            )
          })}
        </div>
      </FormField>

      <FormField
        label="Contexte"
        htmlFor="context"
        required
        hint="Décrivez la situation rencontrée (sans noms, adresses ni numéros)"
      >
        <Textarea
          id="context"
          name="context"
          required
          minLength={20}
          rows={4}
          placeholder="Maison individuelle, propriétaire âgé, chaudière fuel récente…"
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </FormField>

      <FormField
        label="Question posée à la communauté"
        htmlFor="question"
        required
        hint="Sur quoi avez-vous hésité ? Quel arbitrage cherchiez-vous ?"
      >
        <Textarea
          id="question"
          name="question"
          required
          minLength={10}
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
      </FormField>

      <FormField label="Décision prise" htmlFor="decisionMade" hint="Optionnel">
        <Textarea
          id="decisionMade"
          name="decisionMade"
          rows={3}
          value={decisionMade}
          onChange={(e) => setDecisionMade(e.target.value)}
        />
      </FormField>

      <FormField
        label="Justification"
        htmlFor="justification"
        hint="Argumentaire métier — optionnel"
      >
        <Textarea
          id="justification"
          name="justification"
          rows={3}
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
        />
      </FormField>

      <FormField label="Références réglementaires" hint="Articles, arrêtés, fiches méthodologiques">
        <div className="flex items-center gap-2">
          <Input
            placeholder="ex. Arrêté du 31 mars 2021"
            value={referenceInput}
            onChange={(e) => setReferenceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addReference()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addReference}>
            Ajouter
          </Button>
        </div>
        {references.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {references.map((r) => (
              <li key={r}>
                <button
                  type="button"
                  onClick={() => setReferences((prev) => prev.filter((x) => x !== r))}
                  className="inline-flex items-center gap-1 rounded-pill border border-rule bg-paper px-2.5 py-1 text-[11px] font-mono text-ink-mute hover:text-ink"
                  title="Retirer"
                >
                  {r}
                  <span aria-hidden>×</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </FormField>

      <FormField label="Tags" hint="Mots-clés libres (6 max)">
        <div className="flex items-center gap-2">
          <Input
            placeholder="ex. amiante, copropriété, vente"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>
            Ajouter
          </Button>
        </div>
        {tags.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setTags((prev) => prev.filter((x) => x !== t))}
                  className="inline-flex items-center gap-1"
                >
                  <Badge variant="muted">
                    #{t} <span aria-hidden>×</span>
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </FormField>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" variant="accent" disabled={pending}>
          {pending ? 'Envoi…' : 'Soumettre pour modération'}
        </Button>
        <p className="text-[11px] text-ink-faint">Anonymisation automatique avant publication.</p>
      </div>
    </form>
  )
}
