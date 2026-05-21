'use client'

/**
 * Éditeur des toggles d'affichage + champs custom de la carte de visite.
 *
 * Persistance via `upsertBusinessCardAction` (server action) — déclenché en
 * autosave debounced 600 ms après le dernier changement.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { SettingsSwitch } from '@/app/dashboard/account/settings-switch'
import { upsertBusinessCardAction } from './actions'

interface VCardFieldsEditorProps {
  initial: {
    show_phone_mobile: boolean
    show_phone_fixed: boolean
    show_email: boolean
    show_address: boolean
    show_website: boolean
    show_certification: boolean
    show_siret: boolean
    show_logo: boolean
    custom_title: string | null
    custom_website: string | null
    custom_phone_fixed: string | null
  }
  /** Disponibilité des données source (grise les toggles si l'info n'existe pas). */
  availability: {
    phoneMobile: boolean
    email: boolean
    address: boolean
    certification: boolean
    siret: boolean
    logo: boolean
  }
}

type State = VCardFieldsEditorProps['initial']

const TOGGLES: Array<{
  key: keyof State
  label: string
  description: string
  availabilityKey?: keyof VCardFieldsEditorProps['availability']
}> = [
  {
    key: 'show_phone_mobile',
    label: 'Téléphone mobile',
    description: 'Votre numéro de mobile (issu de votre profil).',
    availabilityKey: 'phoneMobile',
  },
  {
    key: 'show_phone_fixed',
    label: 'Ligne fixe',
    description: 'Numéro fixe additionnel (champ ci-dessous).',
  },
  {
    key: 'show_email',
    label: 'Email professionnel',
    description: 'Votre email de compte.',
    availabilityKey: 'email',
  },
  {
    key: 'show_address',
    label: 'Adresse du cabinet',
    description: 'Adresse postale enregistrée pour votre cabinet.',
    availabilityKey: 'address',
  },
  {
    key: 'show_website',
    label: 'Site web',
    description: 'URL personnalisée (champ ci-dessous).',
  },
  {
    key: 'show_certification',
    label: 'Certification RGE',
    description: 'Numéro de certification COFRAC.',
    availabilityKey: 'certification',
  },
  {
    key: 'show_siret',
    label: 'SIRET',
    description: 'Identifiant SIRET de votre organisation.',
    availabilityKey: 'siret',
  },
  {
    key: 'show_logo',
    label: 'Logo cabinet',
    description: 'Apparaît dans la photo de contact iOS / Android.',
    availabilityKey: 'logo',
  },
]

export function VCardFieldsEditor({ initial, availability }: VCardFieldsEditorProps) {
  const [state, setState] = useState<State>(initial)
  const [, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(false)

  // Autosave debounced. On skip le tout premier render pour ne pas écrire
  // immédiatement après le mount.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await upsertBusinessCardAction(state)
        if (res?.error) {
          toast.error(res.error)
        }
        // Succès : pas de toast — autosave silencieux.
      })
    }, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state])

  const set = <K extends keyof State>(key: K, value: State[K]) => {
    setState((s) => ({ ...s, [key]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Toggles */}
      <ul className="space-y-1">
        {TOGGLES.map((t) => {
          const value = state[t.key] as boolean
          const isAvailable =
            !t.availabilityKey || availability[t.availabilityKey]
          return (
            <li
              key={t.key}
              className="flex items-center gap-4 py-3 border-b border-[#0F1419]/[0.06] last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#0F1419]">{t.label}</p>
                <p className="text-[12px] text-[#0F1419]/60">
                  {isAvailable
                    ? t.description
                    : `${t.description} — donnée manquante, complétez votre profil.`}
                </p>
              </div>
              <SettingsSwitch
                checked={value && isAvailable}
                onChange={(next) => set(t.key, next as State[typeof t.key])}
                disabled={!isAvailable}
                label={t.label}
              />
            </li>
          )
        })}
      </ul>

      {/* Champs custom */}
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <label
            htmlFor="custom_title"
            className="text-[12px] font-medium text-[#0F1419]"
          >
            Titre professionnel
          </label>
          <input
            id="custom_title"
            type="text"
            maxLength={80}
            placeholder="Diagnostiqueur immobilier certifié"
            value={state.custom_title ?? ''}
            onChange={(e) => set('custom_title', e.target.value || null)}
            className="w-full rounded-md border border-[#0F1419]/10 bg-white px-3 py-2 text-[13px] text-[#0F1419] focus:outline-none focus:ring-2 focus:ring-[#0F1419]/15"
          />
          <p className="text-[11px] text-[#0F1419]/50">
            Défaut : Diagnostiqueur immobilier certifié.
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="custom_website"
            className="text-[12px] font-medium text-[#0F1419]"
          >
            Site web
          </label>
          <input
            id="custom_website"
            type="url"
            maxLength={200}
            placeholder="https://votre-cabinet.fr"
            value={state.custom_website ?? ''}
            onChange={(e) => set('custom_website', e.target.value || null)}
            className="w-full rounded-md border border-[#0F1419]/10 bg-white px-3 py-2 text-[13px] text-[#0F1419] focus:outline-none focus:ring-2 focus:ring-[#0F1419]/15"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="custom_phone_fixed"
            className="text-[12px] font-medium text-[#0F1419]"
          >
            Ligne fixe (E.164)
          </label>
          <input
            id="custom_phone_fixed"
            type="tel"
            maxLength={20}
            placeholder="+33235123456"
            value={state.custom_phone_fixed ?? ''}
            onChange={(e) => set('custom_phone_fixed', e.target.value || null)}
            className="w-full rounded-md border border-[#0F1419]/10 bg-white px-3 py-2 text-[13px] font-mono text-[#0F1419] focus:outline-none focus:ring-2 focus:ring-[#0F1419]/15"
          />
        </div>
      </div>
    </div>
  )
}
