'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2, Search } from 'lucide-react'
import { useActionState, useState } from 'react'
import { submitStep6Sirene } from '../actions'

interface SireneData {
  company_name?: string
  legal_form?: string
  ape_code?: string
  director_name?: string
}

export function Step6SireneForm() {
  const [state, formAction, pending] = useActionState(submitStep6Sirene, undefined)
  const [siret, setSiret] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [sirene, setSirene] = useState<SireneData | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  async function lookup() {
    const cleaned = siret.replace(/\s/g, '')
    if (cleaned.length !== 14) {
      setLookupError('Le SIRET doit comporter 14 chiffres.')
      return
    }
    setLookingUp(true)
    setLookupError(null)
    setSirene(null)
    try {
      const res = await fetch(`/api/sirene/lookup?siret=${cleaned}`)
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(txt || 'Échec de la recherche INSEE')
      }
      const data: SireneData = await res.json()
      setSirene(data)
    } catch (err) {
      setLookupError(
        err instanceof Error ? err.message : 'Impossible de récupérer les données SIRENE.',
      )
    } finally {
      setLookingUp(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 6 sur 7 — Entreprise SIRENE
        </p>
        <h1 className="font-serif italic text-3xl text-[#0F1419] leading-tight">
          Vérification de ton entreprise.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          Nous croisons ton SIRET avec l&apos;API INSEE pour récupérer automatiquement raison
          sociale, code APE et dirigeant.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <FormField
          label="Numéro SIRET (14 chiffres)"
          htmlFor="siret"
          required
          hint="Ne pas confondre avec le SIREN (9 chiffres). Disponible sur tout document officiel."
        >
          <div className="flex gap-2">
            <Input
              id="siret"
              name="siret"
              type="text"
              inputMode="numeric"
              required
              maxLength={17}
              value={siret}
              onChange={(e) => setSiret(e.target.value)}
              placeholder="123 456 789 00012"
            />
            <Button
              type="button"
              variant="outline"
              onClick={lookup}
              disabled={lookingUp || siret.replace(/\s/g, '').length !== 14}
            >
              {lookingUp ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Search className="size-4" />
              )}
              Rechercher
            </Button>
          </div>
        </FormField>

        {lookupError && (
          <p className="text-[13px] text-red-600 bg-red-50 rounded-md p-3" role="alert">
            {lookupError}
          </p>
        )}

        {sirene && (
          <div className="rounded-2xl bg-[#F5F7F4] p-5 border border-[#0F1419]/[0.08] space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/55 font-semibold">
              Données récupérées via INSEE Sirene
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
              <div>
                <dt className="text-[#0F1419]/55">Raison sociale</dt>
                <dd className="text-[#0F1419] font-semibold">{sirene.company_name ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[#0F1419]/55">Forme juridique</dt>
                <dd className="text-[#0F1419] font-semibold">{sirene.legal_form ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[#0F1419]/55">Code APE</dt>
                <dd className="text-[#0F1419] font-semibold">{sirene.ape_code ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-[#0F1419]/55">Dirigeant déclaré</dt>
                <dd className="text-[#0F1419] font-semibold">{sirene.director_name ?? '—'}</dd>
              </div>
            </dl>

            <input type="hidden" name="company_name" value={sirene.company_name ?? ''} />
            <input type="hidden" name="legal_form" value={sirene.legal_form ?? ''} />
            <input type="hidden" name="ape_code" value={sirene.ape_code ?? ''} />
            <input type="hidden" name="director_name" value={sirene.director_name ?? ''} />

            <label className="flex gap-3 items-start cursor-pointer pt-2 border-t border-[#0F1419]/[0.06]">
              <input
                type="checkbox"
                name="confirm"
                required
                className="mt-1 size-4 rounded border-[#0F1419]/20"
              />
              <span className="text-[13px] text-[#0F1419]/75">
                Je confirme que ces informations sont exactes. Si le dirigeant déclaré ne correspond
                pas à mon identité vérifiée à l&apos;étape 3, un document de délégation pourra être
                demandé.
              </span>
            </label>
          </div>
        )}

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending || !sirene}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Continuer
        </Button>
      </form>
    </div>
  )
}
