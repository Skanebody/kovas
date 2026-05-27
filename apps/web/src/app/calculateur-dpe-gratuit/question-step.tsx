'use client'

/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Composant `<QuestionStep>` — rend une question individuelle parmi les 8 du
 * stepper. Switch par `questionKey` sur le type de contrôle UI :
 *  - radio cards visuelles (type bien, chauffage, occupation)
 *  - slider + input numérique (surface)
 *  - select natif (année de construction)
 *  - segmented (DPE existant)
 *  - chips multi-select (contexte)
 *
 * Toujours SOBRE PROFESSIONNEL : vouvoiement, sans emoji marketing, libellés
 * métier précis.
 */

import {
  CONTEXT_LABEL,
  type CalculatorAnswers,
  type DpeClass,
  HEATING_LABEL,
  type HeatingType,
  ISOLATION_LABEL,
  type IsolationLevel,
  OCCUPATION_LABEL,
  type OccupationMode,
  type ProjectContext,
  type PropertyType,
  type QuestionKey,
  YEAR_BUCKET_LABEL,
  type YearBucket,
} from '@/lib/dpe-calculator/question-tree'
import { cn } from '@/lib/utils'
import {
  Box,
  Building2,
  Clock,
  Flame,
  Home,
  KeyRound,
  Lightbulb,
  Receipt,
  Sparkles,
  Thermometer,
  TreePine,
  Wind,
  Zap,
} from 'lucide-react'
import { useId } from 'react'

interface QuestionStepProps {
  questionKey: QuestionKey
  answers: CalculatorAnswers
  onChange: (patch: Partial<CalculatorAnswers>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants helpers : RadioCard + ChipToggle
// ─────────────────────────────────────────────────────────────────────────────

interface RadioCardProps {
  selected: boolean
  onClick: () => void
  icon?: React.ReactNode
  label: string
  hint?: string
}

function RadioCard({ selected, onClick, icon, label, hint }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg border bg-paper px-4 py-3 text-left',
        'min-h-[56px] transition-all duration-fast ease-spring',
        'hover:border-ink/40 hover:-translate-y-px',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
        selected
          ? 'border-chartreuse bg-chartreuse/10 shadow-[0_4px_14px_rgba(212,245,66,0.20)]'
          : 'border-border',
      )}
    >
      {icon ? (
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            selected ? 'bg-chartreuse text-ink' : 'bg-ink/5 text-ink-mute',
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex-1">
        <span className="block text-[14px] font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-[12px] text-ink-mute">{hint}</span> : null}
      </span>
      {selected ? <span aria-hidden className="size-2.5 rounded-full bg-chartreuse-deep" /> : null}
    </button>
  )
}

interface ChipToggleProps {
  selected: boolean
  onClick: () => void
  label: string
}

function ChipToggle({ selected, onClick, label }: ChipToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-pill border px-4 py-2 text-[13px] font-medium transition-all duration-fast',
        'min-h-[40px]',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
        selected
          ? 'border-chartreuse bg-chartreuse text-ink'
          : 'border-border bg-paper text-ink-mute hover:border-ink/40 hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps individuels
// ─────────────────────────────────────────────────────────────────────────────

const HEATING_ICON: Record<HeatingType, React.ReactNode> = {
  gaz: <Flame className="size-5" />,
  fioul: <Receipt className="size-5" />,
  electricite: <Zap className="size-5" />,
  pompe_chaleur: <Wind className="size-5" />,
  bois: <TreePine className="size-5" />,
  reseau_chaleur: <Thermometer className="size-5" />,
  autre: <Sparkles className="size-5" />,
}

const HEATING_HINT: Record<HeatingType, string> = {
  gaz: 'Chaudière gaz, ville ou propane',
  fioul: 'Cuve fioul (interdit en neuf depuis 2022)',
  electricite: 'Radiateurs ou plancher électrique',
  pompe_chaleur: 'PAC air-eau, air-air, géothermie',
  bois: 'Granulés, bûches, insert',
  reseau_chaleur: 'Chauffage urbain collectif',
  autre: 'Mixte ou solution non listée',
}

export function QuestionStep({ questionKey, answers, onChange }: QuestionStepProps) {
  switch (questionKey) {
    case 'property_type':
      return <PropertyTypeStep value={answers.property_type} onChange={onChange} />
    case 'surface_m2':
      return <SurfaceStep value={answers.surface_m2} onChange={onChange} />
    case 'year_bucket':
      return <YearStep value={answers.year_bucket} onChange={onChange} />
    case 'existing_dpe':
      return <ExistingDpeStep value={answers.existing_dpe} onChange={onChange} />
    case 'heating':
      return <HeatingStep value={answers.heating} onChange={onChange} />
    case 'isolation':
      return <IsolationStep value={answers.isolation} onChange={onChange} />
    case 'occupation':
      return <OccupationStep value={answers.occupation} onChange={onChange} />
    case 'context':
      return <ContextStep value={answers.context} onChange={onChange} />
  }
}

// ─── 1. Type de bien ─────────────────────────────────────────────────────────

function PropertyTypeStep({
  value,
  onChange,
}: {
  value: PropertyType | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  return (
    <StepContainer
      title="Quel type de bien souhaites-tu estimer ?"
      hint="Le type influence légèrement la méthode d'estimation."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <RadioCard
          selected={value === 'maison'}
          onClick={() => onChange({ property_type: 'maison' })}
          icon={<Home className="size-5" />}
          label="Maison individuelle"
          hint="Maison, pavillon, villa, longère"
        />
        <RadioCard
          selected={value === 'appartement'}
          onClick={() => onChange({ property_type: 'appartement' })}
          icon={<Building2 className="size-5" />}
          label="Appartement"
          hint="Logement en copropriété"
        />
      </div>
    </StepContainer>
  )
}

// ─── 2. Surface ──────────────────────────────────────────────────────────────

function SurfaceStep({
  value,
  onChange,
}: {
  value: number | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const id = useId()
  const current = value ?? 70
  return (
    <StepContainer
      title="Quelle est la surface habitable du bien ?"
      hint="Surface au sens loi Boutin ou Carrez si tu la connais."
    >
      <div className="space-y-5">
        <div className="flex items-center justify-center gap-4">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={8}
            max={1000}
            step={1}
            value={value ?? ''}
            placeholder="70"
            onChange={(e) => {
              const n = Number(e.target.value)
              onChange({ surface_m2: Number.isFinite(n) && n > 0 ? n : null })
            }}
            className={cn(
              'h-14 w-32 rounded-lg border border-border bg-paper px-4 text-center',
              'font-mono text-[28px] font-semibold text-ink',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
            )}
            aria-label="Surface en mètres carrés"
          />
          <span className="text-[18px] font-medium text-ink-mute">m²</span>
        </div>

        <div>
          <input
            type="range"
            min={8}
            max={400}
            step={1}
            value={current}
            onChange={(e) => onChange({ surface_m2: Number(e.target.value) })}
            className="w-full accent-chartreuse"
            aria-label="Curseur de surface"
          />
          <div className="mt-1 flex justify-between text-[11px] font-mono uppercase tracking-wide text-ink-mute">
            <span>8 m²</span>
            <span>400 m²</span>
          </div>
        </div>

        <p className="text-center text-[12px] text-ink-mute">
          Saisissez jusqu'à 1 000 m² si nécessaire.
        </p>
      </div>
    </StepContainer>
  )
}

// ─── 3. Année de construction ────────────────────────────────────────────────

function YearStep({
  value,
  onChange,
}: {
  value: YearBucket | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const buckets: YearBucket[] = [
    'before_1948',
    '1948_1974',
    '1975_1989',
    '1990_2000',
    '2001_2012',
    '2013_2020',
    'after_2020',
  ]
  return (
    <StepContainer
      title="Année de construction du bâtiment"
      hint="La période détermine la réglementation thermique appliquée à l'origine."
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {buckets.map((b) => (
          <RadioCard
            key={b}
            selected={value === b}
            onClick={() => onChange({ year_bucket: b })}
            icon={<Clock className="size-5" />}
            label={YEAR_BUCKET_LABEL[b]}
          />
        ))}
      </div>
    </StepContainer>
  )
}

// ─── 4. DPE existant ─────────────────────────────────────────────────────────

function ExistingDpeStep({
  value,
  onChange,
}: {
  value: CalculatorAnswers['existing_dpe']
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const known: 'yes' | 'no' | 'unsure' | null =
    value === null ? null : value.known === true ? 'yes' : value.known === false ? 'no' : 'unsure'

  const currentClass = value && value.known === true ? value.value : null

  return (
    <StepContainer
      title="Disposes-tu déjà d'un DPE pour ce bien ?"
      hint="Si oui, cela nous aide à calibrer plus finement l'estimation."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <RadioCard
          selected={known === 'yes'}
          onClick={() => onChange({ existing_dpe: { known: true, value: currentClass } })}
          label="Oui"
          hint="Précisez la classe ci-dessous"
        />
        <RadioCard
          selected={known === 'no'}
          onClick={() => onChange({ existing_dpe: { known: false, value: null } })}
          label="Non"
          hint="Aucun DPE valide à ce jour"
        />
        <RadioCard
          selected={known === 'unsure'}
          onClick={() => onChange({ existing_dpe: { known: 'unsure', value: null } })}
          label="Je ne sais pas"
        />
      </div>

      {known === 'yes' ? (
        <div className="mt-5">
          <p className="mb-2 text-[12px] font-mono uppercase tracking-wide text-ink-mute">
            Classe actuelle du DPE
          </p>
          <div className="flex flex-wrap gap-2">
            {(['A', 'B', 'C', 'D', 'E', 'F', 'G'] as DpeClass[]).map((cls) => {
              const isSelected = currentClass === cls
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => onChange({ existing_dpe: { known: true, value: cls } })}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex size-12 items-center justify-center rounded-lg border',
                    'font-display text-[18px] font-bold transition-all duration-fast',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
                    isSelected
                      ? 'border-chartreuse bg-chartreuse text-ink shadow-[0_4px_14px_rgba(212,245,66,0.20)]'
                      : 'border-border bg-paper text-ink-mute hover:border-ink/40 hover:text-ink',
                  )}
                >
                  {cls}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </StepContainer>
  )
}

// ─── 5. Chauffage ────────────────────────────────────────────────────────────

function HeatingStep({
  value,
  onChange,
}: {
  value: HeatingType | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const order: HeatingType[] = [
    'gaz',
    'fioul',
    'electricite',
    'pompe_chaleur',
    'bois',
    'reseau_chaleur',
    'autre',
  ]
  return (
    <StepContainer
      title="Quel est le mode de chauffage principal ?"
      hint="Pour le chauffage hybride, indiquez la source principale."
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {order.map((h) => (
          <RadioCard
            key={h}
            selected={value === h}
            onClick={() => onChange({ heating: h })}
            icon={HEATING_ICON[h]}
            label={HEATING_LABEL[h]}
            hint={HEATING_HINT[h]}
          />
        ))}
      </div>
    </StepContainer>
  )
}

// ─── 6. Isolation ────────────────────────────────────────────────────────────

function IsolationStep({
  value,
  onChange,
}: {
  value: IsolationLevel | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const levels: IsolationLevel[] = ['tres_bonne', 'bonne', 'moyenne', 'mauvaise', 'inconnue']
  const currentIndex = value ? levels.indexOf(value) : 2

  return (
    <StepContainer
      title="Comment estimes-tu l'isolation du bien ?"
      hint="Murs, combles, fenêtres : appréciation globale."
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {levels.map((l, idx) => (
            <button
              key={l}
              type="button"
              onClick={() => onChange({ isolation: l })}
              aria-pressed={value === l}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border bg-paper px-2 py-3 text-center',
                'min-h-[64px] transition-all duration-fast',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
                value === l
                  ? 'border-chartreuse bg-chartreuse/10'
                  : 'border-border hover:border-ink/40',
              )}
            >
              <span
                className={cn(
                  'mb-1 flex size-7 items-center justify-center rounded-full',
                  value === l ? 'bg-chartreuse-deep' : 'bg-ink/10',
                )}
                aria-hidden
              >
                {value === l ? (
                  <Lightbulb className="size-4 text-ink" />
                ) : (
                  <span className="block size-2 rounded-full bg-ink-mute" />
                )}
              </span>
              <span
                className={cn(
                  'text-[12px] font-semibold',
                  value === l ? 'text-ink' : 'text-ink-mute',
                )}
              >
                {ISOLATION_LABEL[l]}
              </span>
              <span className="text-[10px] font-mono uppercase text-ink-faint mt-0.5">
                {idx + 1}/5
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-mute">
        Niveau {currentIndex + 1} sur 5 — sélection actuelle :{' '}
        <strong>{value ? ISOLATION_LABEL[value] : '—'}</strong>
      </p>
    </StepContainer>
  )
}

// ─── 7. Occupation ───────────────────────────────────────────────────────────

function OccupationStep({
  value,
  onChange,
}: {
  value: OccupationMode | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const order: OccupationMode[] = [
    'residence_principale',
    'residence_secondaire',
    'locatif',
    'vacant',
  ]
  return (
    <StepContainer title="Comment ce bien est-il occupé aujourd'hui ?">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {order.map((o) => (
          <RadioCard
            key={o}
            selected={value === o}
            onClick={() => onChange({ occupation: o })}
            icon={<KeyRound className="size-5" />}
            label={OCCUPATION_LABEL[o]}
          />
        ))}
      </div>
    </StepContainer>
  )
}

// ─── 8. Contexte (multi) ─────────────────────────────────────────────────────

function ContextStep({
  value,
  onChange,
}: {
  value: ProjectContext[] | null
  onChange: (patch: Partial<CalculatorAnswers>) => void
}) {
  const order: ProjectContext[] = ['vente', 'location', 'renovation', 'curiosite']
  const current = value ?? []

  function toggle(ctx: ProjectContext) {
    const next = current.includes(ctx) ? current.filter((c) => c !== ctx) : [...current, ctx]
    onChange({ context: next.length > 0 ? next : [] })
  }

  return (
    <StepContainer
      title="Pour quel projet souhaites-tu une estimation ?"
      hint="Plusieurs choix possibles."
    >
      <div className="flex flex-wrap gap-2.5">
        {order.map((c) => (
          <ChipToggle
            key={c}
            selected={current.includes(c)}
            onClick={() => toggle(c)}
            label={CONTEXT_LABEL[c]}
          />
        ))}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-paper px-3 py-2.5">
        <Box className="size-4 mt-0.5 text-ink-mute" aria-hidden />
        <p className="text-[12px] leading-relaxed text-ink-mute">
          Tes réponses restent confidentielles et nous permettent de mettre en relation avec un
          diagnostiqueur certifié près de chez toi si tu le souhaites.
        </p>
      </div>
    </StepContainer>
  )
}

// ─── Conteneur commun ────────────────────────────────────────────────────────

function StepContainer({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <header className="space-y-1.5">
        <h2 className="font-display text-[22px] font-bold leading-tight text-ink sm:text-[26px]">
          {title}
        </h2>
        {hint ? <p className="text-[14px] text-ink-mute">{hint}</p> : null}
      </header>
      <div>{children}</div>
    </div>
  )
}
