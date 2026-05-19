'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  SOURCE_LOGICIELS,
  SOURCE_LOGICIEL_LABELS,
  type SourceLogiciel,
  WIZARD_STEPS,
  type WizardStep,
} from '@/lib/import/types'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  ExternalLink,
  FileSpreadsheet,
  LifeBuoy,
  PlayCircle,
  Shield,
  Users,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { EXPORT_TUTORIALS, TUTO_HELP_LINKS, type TutoStepContent } from './tuto-content'
import { UploadDropZone } from './upload-dropzone'

interface ImportWizardProps {
  /** Job id si on reprend un import en cours (étapes 4-5). Undefined = nouveau wizard. */
  initialJobId?: string
}

/**
 * Wizard 5 étapes pour l'import depuis un logiciel diag (multi-source).
 *
 * Étape 1 — Préparer (statique, RGPD-friendly)
 * Étape 2 — Choisir + Exporter (pillules Liciel/AnalysImmo/OBBC/ORIS/Autre + tuto)
 * Étape 3 — Téléverser (drag-drop, passe source_logiciel à l'API)
 * Étape 4 — Analyser (polling status)
 * Étape 5 — Valider (review doublons + commit)
 */
export function ImportWizard({ initialJobId }: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>(initialJobId ? 4 : 1)
  // Source logiciel sélectionnée à l'étape 2, transmise à l'upload (étape 3).
  // Défaut Liciel = case la plus fréquente (40-52 % PdM, cf. CLAUDE.md §1).
  const [sourceLogiciel, setSourceLogiciel] = useState<SourceLogiciel>('liciel')

  function goToStep(s: WizardStep) {
    setStep(s)
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <StepperHeader currentStep={step} onJump={goToStep} />

      {step === 1 && <Step1Prepare onNext={() => goToStep(2)} />}
      {step === 2 && (
        <Step2Export
          sourceLogiciel={sourceLogiciel}
          onChangeSource={setSourceLogiciel}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
        />
      )}
      {step === 3 && <Step3Upload sourceLogiciel={sourceLogiciel} onBack={() => goToStep(2)} />}
      {step === 4 && <Step4AnalyzePlaceholder jobId={initialJobId} />}
      {step === 5 && <Step5ValidatePlaceholder />}
    </div>
  )
}

// ============================================================================
// STEPPER HEADER
// ============================================================================

function StepperHeader({
  currentStep,
  onJump,
}: {
  currentStep: WizardStep
  onJump: (s: WizardStep) => void
}) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 flex-wrap" aria-label="Étapes de l'import">
      {WIZARD_STEPS.map((s, idx) => {
        const isCurrent = s.id === currentStep
        const isDone = s.id < currentStep
        const isFuture = s.id > currentStep
        const isLast = idx === WIZARD_STEPS.length - 1
        // On autorise le retour aux étapes terminées, pas le saut en avant
        const clickable = isDone
        return (
          <li key={s.id} className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => (clickable ? onJump(s.id) : undefined)}
              disabled={!clickable}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'group flex items-center gap-2 rounded-pill border px-2.5 py-1 transition-colors',
                isCurrent && 'bg-chartreuse text-ink border-chartreuse',
                isDone && 'bg-navy text-paper border-navy hover:bg-navy/90 cursor-pointer',
                isFuture && 'bg-paper text-ink-mute border-rule cursor-default',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold',
                  isCurrent && 'bg-ink text-chartreuse',
                  isDone && 'bg-paper text-navy',
                  isFuture && 'bg-cream-deep text-ink-mute',
                )}
              >
                {isDone ? <Check className="size-3" strokeWidth={3} /> : s.id}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider whitespace-nowrap hidden sm:inline">
                {s.short}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider sm:hidden">
                {s.short.slice(0, 4)}
              </span>
            </button>
            {!isLast && (
              <ChevronRight
                className={cn('size-3 shrink-0', isDone ? 'text-navy' : 'text-ink-mute')}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ============================================================================
// STEP 1 — PRÉPARER
// ============================================================================

function Step1Prepare({ onNext }: { onNext: () => void }) {
  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-2 space-y-6">
        <header className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
            <Shield className="size-3.5" /> Étape 1 / 5 — Préparer
          </p>
          <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
            Avant de commencer.
          </h2>
        </header>

        <div className="rounded-lg border border-accent-green/30 bg-accent-green/5 p-4 text-sm leading-relaxed">
          <p className="font-medium text-ink mb-1">Import légal et sécurisé.</p>
          <p className="text-ink-soft">
            C&apos;est <strong>vous</strong> qui exportez vos données depuis votre propre logiciel
            de diagnostic, dans le cadre de votre <strong>droit à la portabilité</strong> (article
            20 du RGPD). KOVAS n&apos;accède jamais directement à votre logiciel et ne stocke pas
            vos identifiants.
          </p>
        </div>

        <section className="space-y-2.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            Ce que vous allez importer
          </h3>
          <ul className="space-y-2">
            <ImportItem icon={Users} title="Clients" desc="Coordonnées, identifiants, historique" />
            <ImportItem
              icon={Building2}
              title="Biens"
              desc="Adresses, caractéristiques, étage / bâtiment / lot"
            />
            <ImportItem
              icon={Building2}
              title="Lots et copropriétés"
              desc="Structure et localisation"
            />
            <ImportItem
              icon={FileSpreadsheet}
              title="Anciens diagnostics (référence)"
              desc="Pour éviter les doublons sur les biens déjà diagnostiqués"
            />
          </ul>
        </section>

        <section className="space-y-2.5">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            Ce que vous n&apos;allez pas importer
          </h3>
          <ul className="space-y-1.5 text-sm text-ink-soft">
            <li className="flex gap-2">
              <span className="text-ink-mute">·</span>
              <span>
                <strong className="text-ink">Les rapports PDF eux-mêmes</strong> — à conserver dans
                votre logiciel d&apos;origine selon la réglementation (10 ans, 50 ans pour
                l&apos;amiante).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-mute">·</span>
              <span>
                <strong className="text-ink">Les paramètres techniques de calcul DPE</strong> —
                propres à votre logiciel d&apos;origine.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-ink-mute">·</span>
              <span>
                <strong className="text-ink">Vos certifications COFRAC</strong> — à saisir
                séparément dans <code className="font-mono text-xs">Compte → Certifications</code>.
              </span>
            </li>
          </ul>
        </section>

        <section className="space-y-1.5 text-xs text-ink-mute">
          <p>
            <strong className="text-ink-soft">Combien de temps cela prend-il ?</strong>
          </p>
          <ul className="space-y-0.5">
            <li>
              · Export depuis votre logiciel : <span className="tabular-nums">2 à 5 minutes</span>
            </li>
            <li>
              · Import et vérification : <span className="tabular-nums">5 à 15 minutes</span> selon
              le volume
            </li>
          </ul>
        </section>

        <div className="flex justify-end pt-2">
          <Button variant="accent" size="lg" onClick={onNext}>
            Commencer <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ImportItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc: string
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="inline-flex size-8 items-center justify-center rounded-lg bg-cream-deep/60 text-ink-soft shrink-0">
        <Icon className="size-4" />
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-mute">{desc}</p>
      </div>
    </li>
  )
}

// ============================================================================
// STEP 2 — EXPORTER (sélecteur logiciel + tuto correspondant)
// ============================================================================

function Step2Export({
  sourceLogiciel,
  onChangeSource,
  onBack,
  onNext,
}: {
  sourceLogiciel: SourceLogiciel
  onChangeSource: (s: SourceLogiciel) => void
  onBack: () => void
  onNext: () => void
}) {
  const tutoSteps = EXPORT_TUTORIALS[sourceLogiciel]
  const logicielLabel = SOURCE_LOGICIEL_LABELS[sourceLogiciel]
  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-2 space-y-6">
        <header className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
            <FileSpreadsheet className="size-3.5" /> Étape 2 / 5 — Exporter
          </p>
          <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
            Quel logiciel utilisez-vous actuellement ?
          </h2>
          <p className="text-sm text-ink-soft max-w-2xl">
            Sélectionnez votre logiciel de diagnostic. KOVAS adapte automatiquement le tutoriel et
            la lecture du fichier exporté.
          </p>
        </header>

        {/* Pillules de sélection logiciel source — pattern toggle group :
            <button aria-pressed> est plus simple et plus accessible que
            <button role=radio>, et passe le linter biome a11y. */}
        <fieldset className="space-y-2.5">
          <legend className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            Logiciel source
          </legend>
          <div className="flex flex-wrap gap-2" aria-label="Logiciel de diagnostic source">
            {SOURCE_LOGICIELS.map((s) => {
              const active = s === sourceLogiciel
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChangeSource(s)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-navy text-paper border-navy'
                      : 'bg-paper text-ink border-rule hover:border-navy/40 hover:bg-cream-deep/40',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block size-2 rounded-full',
                      active ? 'bg-chartreuse' : 'bg-ink-mute/40',
                    )}
                  />
                  {SOURCE_LOGICIEL_LABELS[s]}
                </button>
              )
            })}
          </div>
        </fieldset>

        <header className="space-y-1.5 pt-2 border-t border-rule/40">
          <h3 className="font-serif italic font-normal text-xl text-ink leading-tight">
            Comment exporter depuis {logicielLabel}.
          </h3>
          <p className="text-sm text-ink-soft max-w-2xl">
            Suivez ces étapes dans votre logiciel. Le tutoriel sera affiné une fois l&apos;interface
            réelle validée sur les retours bêta.
          </p>
        </header>

        {sourceLogiciel !== 'autre' && (
          <Badge variant="orange" className="text-[10px]">
            <Shield className="size-3 mr-1" />
            Tuto à finaliser après démo {logicielLabel}
          </Badge>
        )}

        <ol className="space-y-4">
          {tutoSteps.map((s) => (
            <TutoStepCard key={s.num} step={s} />
          ))}
        </ol>

        {/* Aide en bas */}
        <div className="rounded-xl border border-rule bg-paper/40 p-4 space-y-2.5">
          <p className="text-sm font-medium text-ink">
            Vous ne trouvez pas la fonction d&apos;export ?
          </p>
          <div className="flex flex-wrap gap-2">
            {TUTO_HELP_LINKS.map((link) => {
              const Icon = HELP_ICONS[link.icon]
              return (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:border-navy/40 hover:bg-cream-deep/40 transition-colors"
                >
                  <Icon className="size-3.5" /> {link.label}
                </a>
              )
            })}
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
          <Button variant="ghost" onClick={onBack}>
            ← Retour
          </Button>
          <Button variant="accent" size="lg" onClick={onNext}>
            J&apos;ai mon fichier <ArrowRight className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const HELP_ICONS = {
  PlayCircle,
  LifeBuoy,
  ExternalLink,
} as const

function TutoStepCard({ step }: { step: TutoStepContent }) {
  return (
    <li className="rounded-xl border border-rule bg-paper p-4 space-y-2">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-navy text-paper text-xs font-bold shrink-0">
          {step.num}
        </span>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h3 className="text-sm font-semibold text-ink">{step.title}</h3>
          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line">
            {renderTutoBody(step.body)}
          </p>
          {step.hint && (
            <p className="text-[11px] italic text-ink-mute pt-1 border-t border-rule/40">
              {step.hint}
            </p>
          )}
        </div>
        {step.screenshot && (
          <div className="hidden md:flex shrink-0 items-center justify-center size-24 rounded-lg border border-dashed border-rule bg-cream-deep/40 text-[10px] text-ink-mute font-mono">
            {/* TODO — capture {step.screenshot}.png à ajouter dans /public/tutos/ */}
            capture
            <br />à venir
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Rendu minimaliste : transforme **bold** et `code` en éléments HTML.
 * Pas de full markdown — on garde simple. Si besoin de plus, migrer vers MDX.
 */
function renderTutoBody(text: string): React.ReactNode {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return segments.map((seg, i) => {
    if (seg.startsWith('**') && seg.endsWith('**')) {
      // biome-ignore lint/suspicious/noArrayIndexKey: static segmentation
      return <strong key={i}>{seg.slice(2, -2)}</strong>
    }
    if (seg.startsWith('`') && seg.endsWith('`')) {
      return (
        // biome-ignore lint/suspicious/noArrayIndexKey: static segmentation
        <code key={i} className="font-mono text-xs bg-cream-deep/60 px-1 py-0.5 rounded">
          {seg.slice(1, -1)}
        </code>
      )
    }
    // biome-ignore lint/suspicious/noArrayIndexKey: static segmentation
    return <span key={i}>{seg}</span>
  })
}

// ============================================================================
// STEPS 3–5 — PLACEHOLDERS (backend à venir)
// ============================================================================

function PlaceholderStep({
  stepNum,
  stepLabel,
  title,
  description,
  onBack,
}: {
  stepNum: number
  stepLabel: string
  title: string
  description: string
  onBack?: () => void
}) {
  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-2 space-y-4 text-center py-12">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Étape {stepNum} / 5 — {stepLabel}
        </p>
        <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
          {title}
        </h2>
        <p className="text-sm text-ink-soft max-w-md mx-auto">{description}</p>
        <Badge variant="muted" className="mt-2">
          Backend en cours d&apos;implémentation
        </Badge>
        {onBack && (
          <div className="pt-4">
            <Button variant="ghost" onClick={onBack}>
              ← Retour à l&apos;étape précédente
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// STEP 3 — TÉLÉVERSER
// ============================================================================

function Step3Upload({
  sourceLogiciel,
  onBack,
}: {
  sourceLogiciel: SourceLogiciel
  onBack: () => void
}) {
  const router = useRouter()
  return (
    <Card variant="opaque" padding="default">
      <CardContent className="pt-2 space-y-6">
        <header className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
            <FileSpreadsheet className="size-3.5" /> Étape 3 / 5 — Téléverser
          </p>
          <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
            Glissez votre fichier ici.
          </h2>
          <p className="text-sm text-ink-soft max-w-2xl">
            Le fichier est chiffré en transit et stocké temporairement (7 jours max) dans un bucket
            privé en région Paris. Vous pourrez le supprimer à tout moment depuis votre journal
            d&apos;imports.
          </p>
        </header>

        <UploadDropZone
          sourceLogiciel={sourceLogiciel}
          onJobCreated={(id) => router.push(`/app/dossiers/import/${id}`)}
        />

        <div className="flex justify-between items-center pt-2 flex-wrap gap-2">
          <Button variant="ghost" onClick={onBack}>
            ← Retour
          </Button>
          <p className="text-[11px] text-ink-mute font-mono">
            Auto-passage à l&apos;étape suivante après téléversement
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function Step4AnalyzePlaceholder({ jobId }: { jobId?: string }) {
  return (
    <PlaceholderStep
      stepNum={4}
      stepLabel="Analyser"
      title="Analyse de votre fichier."
      description={
        jobId
          ? `Suivi temps réel du job ${jobId.slice(0, 8)}… — parsing + normalisation + dédoublonnage en cours.`
          : 'Polling /api/import/status/[jobId] toutes les 2s avec étapes progressives. À implémenter.'
      }
    />
  )
}

function Step5ValidatePlaceholder() {
  return (
    <PlaceholderStep
      stepNum={5}
      stepLabel="Valider"
      title="Récapitulatif de l'import."
      description="Table des doublons à fusionner / garder séparés, modal de fusion par champ, et bouton de commit transactionnel. À implémenter."
    />
  )
}
