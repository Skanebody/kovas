'use client'

/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * `<ResultCard>` — affiche l'estimation calculée après les 8 questions.
 *
 * UI :
 *  - Hero classe estimée en Instrument Serif italic 80-120px, couleur sémantique
 *    DPE (A-C green / D-E orange / F-G red).
 *  - Mention obligatoire non-opposable.
 *  - Liste des 3 facteurs positifs + 3 négatifs.
 *  - 2 CTA :
 *      1. Primary chartreuse → `/trouver-un-diagnostiqueur/{dept}/{ville-slug}` (geoloc)
 *      2. Outline → `onRequestLeadForm()` (ouvre LeadForm pour estimation+devis)
 */

import { ArrowLeft, CheckCircle2, MapPin, ShieldAlert, XCircle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { DPE_CLASS_STYLES, classToColor } from '@/lib/dpe-calculator/energy-class-mapper'
import type { EstimationResult } from '@/lib/dpe-calculator/estimation-engine'
import type { CalculatorAnswers } from '@/lib/dpe-calculator/question-tree'
import { cn } from '@/lib/utils'

interface ResultCardProps {
  estimation: EstimationResult
  answers: CalculatorAnswers
  detectedCity: string | null
  detectedDepartment: string | null
  onRequestLeadForm: () => void
  onBack: () => void
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // strip combining marks (accents)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function ResultCard({
  estimation,
  answers,
  detectedCity,
  detectedDepartment,
  onRequestLeadForm,
  onBack,
}: ResultCardProps) {
  const colorKey = classToColor(estimation.estimatedClass)
  const styles = DPE_CLASS_STYLES[colorKey]

  // CTA "Trouver un diagnostiqueur" → /trouver-un-diagnostiqueur/{dept}/{ville-slug}
  // Si geoloc pas dispo, on tombe sur la liste générale.
  const findUrl =
    detectedDepartment && detectedCity
      ? `/trouver-un-diagnostiqueur/${detectedDepartment}/${slugify(detectedCity)}`
      : '/trouver-un-diagnostiqueur'

  // Suppress unused warning — answers peut être utilisé en V1.5 pour
  // personnaliser davantage les recommandations (ex. mention chauffage).
  void answers

  return (
    <div className="space-y-7">
      {/* Hero estimation */}
      <div className="text-center">
        <p className="text-[11px] font-mono uppercase tracking-wide text-ink-mute">
          Votre estimation
        </p>
        <div className="mt-3 flex items-end justify-center gap-3">
          <span
            className={cn(
              'font-serif italic leading-none',
              styles.text,
              'text-[112px] sm:text-[148px]',
            )}
            aria-label={`Classe énergétique probable : ${estimation.estimatedClass}`}
          >
            {estimation.estimatedClass}
          </span>
          <span className="pb-3 font-display text-[16px] font-medium text-ink-mute">probable</span>
        </div>
        <p className="mt-3 text-[14px] text-ink-mute">
          Confiance d'estimation :{' '}
          <strong className="font-semibold text-ink">{estimation.confidence}%</strong> · Score
          énergétique {estimation.score} / 100
        </p>
      </div>

      {/* Mention obligatoire non-opposable */}
      <div
        className={cn('flex items-start gap-3 rounded-lg border p-4', styles.border, styles.bgSoft)}
      >
        <ShieldAlert className={cn('size-5 shrink-0', styles.text)} aria-hidden />
        <p className="text-[13px] leading-relaxed text-ink">
          <strong>Cette estimation est indicative et non opposable.</strong> Seul un{' '}
          <GlossaryTerm term="DPE" /> officiel établi par un diagnostiqueur certifié a une valeur
          réglementaire pour une vente, une location ou une déclaration d&apos;
          <GlossaryTerm term="audit-energetique">audit énergétique</GlossaryTerm>.
        </p>
      </div>

      {/* Facteurs */}
      {estimation.positive.length > 0 || estimation.negative.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {estimation.positive.length > 0 ? (
            <FactorsList
              kind="positive"
              title="Facteurs favorables"
              items={estimation.positive.map((f) => f.label)}
            />
          ) : null}
          {estimation.negative.length > 0 ? (
            <FactorsList
              kind="negative"
              title="Facteurs limitants"
              items={estimation.negative.map((f) => f.label)}
            />
          ) : null}
        </div>
      ) : null}

      {/* CTA */}
      <div className="space-y-3 border-t border-border pt-6">
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href={findUrl}>
            <MapPin className="size-4" />
            {detectedCity
              ? `Trouver un diagnostiqueur certifié à ${detectedCity}`
              : 'Trouver un diagnostiqueur certifié près de chez toi'}
          </Link>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={onRequestLeadForm}
        >
          Recevoir mon estimation détaillée par email
        </Button>
      </div>

      {/* Bouton retour discret */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-mute hover:text-ink focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="size-3.5" />
          Modifier mes réponses
        </button>
      </div>
    </div>
  )
}

function FactorsList({
  kind,
  title,
  items,
}: {
  kind: 'positive' | 'negative'
  title: string
  items: string[]
}) {
  const Icon = kind === 'positive' ? CheckCircle2 : XCircle
  return (
    <section className="rounded-lg border border-border bg-paper p-4">
      <h3 className="mb-3 text-[11px] font-mono uppercase tracking-wide text-ink-mute">{title}</h3>
      <ul className="space-y-2">
        {items.map((label) => (
          <li key={label} className="flex items-start gap-2">
            <Icon
              className={cn(
                'size-4 shrink-0 mt-0.5',
                kind === 'positive' ? 'text-accent-green' : 'text-accent-red',
              )}
              aria-hidden
            />
            <span className="text-[13px] leading-relaxed text-ink">{label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export type { ResultCardProps }
