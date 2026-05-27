'use client'

import {
  type AnnuaireProfileFormState,
  updateAnnuaireProfile,
} from '@/app/dashboard/annuaire/actions'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'de', label: 'Allemand' },
] as const

type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code']

const YEARS_OPTIONS = [
  { value: '', label: 'Non précisé' },
  { value: '0', label: 'Moins d’1 an' },
  { value: '1', label: '1 an' },
  { value: '2', label: '2 ans' },
  { value: '3', label: '3 ans' },
  { value: '5', label: '5 ans' },
  { value: '7', label: '7 ans' },
  { value: '10', label: '10 ans' },
  { value: '15', label: '15 ans' },
  { value: '20', label: '20 ans et plus' },
] as const

const BIO_MAX = 500
const SLOGAN_MAX = 80

export interface ProfileSectionInitialValues {
  displayName: string
  title: string
  slogan: string
  bio: string
  languages: LanguageCode[]
  yearsExperience: number | null
}

export interface ProfileSectionProps {
  initial: ProfileSectionInitialValues
  /** True si l'utilisateur n'a pas (encore) revendiqué de fiche → form en read-only avec message. */
  isClaimed: boolean
}

export function ProfileSection({ initial, isClaimed }: ProfileSectionProps) {
  const [state, formAction, pending] = useActionState<AnnuaireProfileFormState, FormData>(
    updateAnnuaireProfile,
    undefined,
  )

  const [slogan, setSlogan] = useState(initial.slogan)
  const [bio, setBio] = useState(initial.bio)
  const [languages, setLanguages] = useState<LanguageCode[]>(initial.languages)

  // Toast confirmation (success / error) lorsque l'action retourne.
  useEffect(() => {
    if (!state) return
    if (state.ok) {
      toast.success('Profil annuaire enregistré.')
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  const toggleLanguage = (code: LanguageCode) => {
    setLanguages((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]))
  }

  return (
    <Card variant="flat" padding="lg" className="space-y-8">
      <div className="space-y-1">
        <CardTitle>Profil public</CardTitle>
        <CardDescription>
          Informations affichées en haut de ta fiche publique sur kovas.fr.
        </CardDescription>
      </div>

      {!isClaimed ? (
        <div className="rounded-md border border-rule bg-cream-deep/40 px-4 py-3 text-[12px] text-ink-mute">
          Réclame ta fiche annuaire pour éditer ces informations. Tes modifications seront publiées
          immédiatement après activation.
        </div>
      ) : null}

      <form action={formAction} className="space-y-6">
        {/* Nom affiché public */}
        <Field
          name="displayName"
          label="Nom affiché"
          hint="Tel qu'affiché en haut de ta fiche publique."
          error={state?.fieldErrors?.displayName}
        >
          <Input
            id="displayName"
            name="displayName"
            type="text"
            defaultValue={initial.displayName}
            placeholder="Ex. Benjamin Bel"
            required
            maxLength={80}
            disabled={!isClaimed || pending}
          />
        </Field>

        {/* Titre / fonction */}
        <Field
          name="title"
          label="Titre professionnel"
          hint="Ex. Diagnostiqueur immobilier certifié — Seine-Maritime."
          optional
          error={state?.fieldErrors?.title}
        >
          <Input
            id="title"
            name="title"
            type="text"
            defaultValue={initial.title}
            placeholder="Ex. Diagnostiqueur immobilier certifié"
            maxLength={120}
            disabled={!isClaimed || pending}
          />
        </Field>

        {/* Slogan */}
        <Field
          name="slogan"
          label="Slogan court"
          hint="Une phrase d'accroche affichée sous ton nom."
          optional
          error={state?.fieldErrors?.slogan}
          counter={`${slogan.length} / ${SLOGAN_MAX}`}
        >
          <Input
            id="slogan"
            name="slogan"
            type="text"
            value={slogan}
            onChange={(e) => setSlogan(e.target.value.slice(0, SLOGAN_MAX))}
            placeholder="Ex. Tes diagnostics en 48h, partout en Normandie."
            maxLength={SLOGAN_MAX}
            disabled={!isClaimed || pending}
          />
        </Field>

        {/* Bio */}
        <Field
          name="bio"
          label="Présentation"
          hint="Décris ton cabinet, ton approche, tes certifications principales."
          optional
          error={state?.fieldErrors?.bio}
          counter={`${bio.length} / ${BIO_MAX}`}
        >
          <Textarea
            id="bio"
            name="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder="Diagnostiqueur indépendant depuis 12 ans, je couvre toute la Seine-Maritime…"
            maxLength={BIO_MAX}
            rows={5}
            disabled={!isClaimed || pending}
          />
        </Field>

        {/* Langues parlées */}
        <fieldset className="space-y-3">
          <legend className="text-xs font-medium text-ink leading-none">Langues parlées</legend>
          <p className="text-[11px] text-ink-mute leading-relaxed">
            Sélectionne les langues dans lesquelles tu peux accompagner un client.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((opt) => {
              const active = languages.includes(opt.code)
              return (
                <label
                  key={opt.code}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12px] cursor-pointer transition-colors',
                    active
                      ? 'border-navy bg-navy text-paper'
                      : 'border-rule bg-paper text-ink-mute hover:text-ink',
                    (!isClaimed || pending) && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <input
                    type="checkbox"
                    name="languages"
                    value={opt.code}
                    checked={active}
                    onChange={() => toggleLanguage(opt.code)}
                    disabled={!isClaimed || pending}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* Années d'expérience */}
        <Field
          name="yearsExperience"
          label="Années d'expérience"
          hint="Aide les particuliers à évaluer ton ancienneté."
          optional
          error={state?.fieldErrors?.yearsExperience}
        >
          <select
            id="yearsExperience"
            name="yearsExperience"
            defaultValue={initial.yearsExperience === null ? '' : String(initial.yearsExperience)}
            disabled={!isClaimed || pending}
            className={cn(
              'flex w-full min-h-[44px] rounded-md border border-rule bg-paper px-4 py-3',
              'text-[13px] text-ink transition-all duration-fast ease-spring',
              'focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:ring-[5px] focus-visible:ring-navy/10',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {YEARS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        {state?.error ? (
          <div
            role="alert"
            className="rounded-md border border-coral-mist bg-coral-mist/30 px-4 py-3 text-[12px] text-[#8B1414]"
          >
            {state.error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-rule/60 pt-5">
          <Button type="submit" disabled={!isClaimed || pending} variant="default">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              'Enregistrer'
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}

function Field({
  name,
  label,
  hint,
  optional,
  error,
  counter,
  children,
}: {
  name: string
  label: string
  hint?: string
  optional?: boolean
  error?: string
  counter?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={name}>
          {label}
          {optional ? (
            <span className="ml-1.5 text-[10px] font-mono uppercase tracking-[0.08em] text-ink-faint">
              Optionnel
            </span>
          ) : null}
        </Label>
        {counter ? (
          <span className="font-mono text-[10px] text-ink-faint tabular-nums">{counter}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p className="text-[11px] text-[#8B1414]">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-ink-mute leading-relaxed">{hint}</p>
      ) : null}
    </div>
  )
}
