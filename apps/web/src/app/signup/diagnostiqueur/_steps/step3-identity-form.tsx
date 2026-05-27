'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useActionState, useState } from 'react'
import { LivenessCapture } from '../_components/liveness-capture'
import { submitStep3Identity } from '../actions'

type IdentityMethod = 'france_connect' | 'kyc_scan_cni' | 'yousign_qualified'

export function Step3IdentityForm() {
  const [state, formAction, pending] = useActionState(submitStep3Identity, undefined)
  const [method, setMethod] = useState<IdentityMethod>('france_connect')

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 3 sur 7 — Identité civile
        </p>
        <h1 className="font-serif italic text-3xl text-[#0F1419] leading-tight">
          Vérifie ton identité.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          Choisis la méthode qui te convient. La vérification est instantanée avec FranceConnect, ou
          validée sous 24 h pour les autres méthodes.
        </p>
      </div>

      <form action={formAction} className="space-y-5" encType="multipart/form-data">
        <fieldset className="space-y-3">
          <legend className="sr-only">Méthode de vérification d&apos;identité</legend>

          {/* OPTION A — FranceConnect */}
          <MethodCard
            value="france_connect"
            checked={method === 'france_connect'}
            onSelect={() => setMethod('france_connect')}
            badge="Recommandé · Instantané"
            title="FranceConnect"
            description="Connecte-toi avec Impôts, Ameli, La Poste ou Identité Numérique. Vérification immédiate par l'État français."
          />

          {/* OPTION B — KYC scan CNI + liveness */}
          <MethodCard
            value="kyc_scan_cni"
            checked={method === 'kyc_scan_cni'}
            onSelect={() => setMethod('kyc_scan_cni')}
            badge="Validation sous 24 h"
            title="Scan CNI + vérification du visage"
            description="Photo CNI recto et verso (PDF/JPEG, 10 Mo max) + vérification du visage en direct."
          />

          {/* OPTION C — Yousign qualifié */}
          <MethodCard
            value="yousign_qualified"
            checked={method === 'yousign_qualified'}
            onSelect={() => setMethod('yousign_qualified')}
            badge="Signature qualifiée eIDAS"
            title="Signature Yousign qualifiée"
            description="Signe un document de référence avec ta signature électronique qualifiée. Niveau de preuve maximal."
          />
        </fieldset>

        {/* Sous-formulaires conditionnels */}
        {method === 'kyc_scan_cni' && (
          <div className="space-y-4 rounded-2xl bg-[#F5F7F4] p-5 border border-[#0F1419]/[0.06]">
            <UploadField
              name="cni_recto"
              label="CNI recto (PDF ou JPEG, 10 Mo max)"
              accept="application/pdf,image/jpeg,image/png"
            />
            <UploadField
              name="cni_verso"
              label="CNI verso (PDF ou JPEG, 10 Mo max)"
              accept="application/pdf,image/jpeg,image/png"
            />
            <div>
              <p className="text-[11px] font-semibold text-[#0F1419] mb-2">
                Vérification du visage en direct (anti-fraude)
              </p>
              <LivenessCapture />
            </div>
          </div>
        )}

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <input type="hidden" name="method" value={method} />

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {method === 'france_connect' && 'Se connecter avec FranceConnect'}
          {method === 'kyc_scan_cni' && 'Envoyer mes documents'}
          {method === 'yousign_qualified' && 'Démarrer la signature Yousign'}
        </Button>
      </form>
    </div>
  )
}

function MethodCard({
  value,
  checked,
  onSelect,
  title,
  description,
  badge,
}: {
  value: string
  checked: boolean
  onSelect: () => void
  title: string
  description: string
  badge: string
}) {
  return (
    <label
      className={cn(
        'block rounded-2xl border-2 p-4 cursor-pointer transition-all',
        checked
          ? 'border-[#0F1419] bg-[#F5F7F4]'
          : 'border-[#0F1419]/[0.08] bg-white hover:border-[#0F1419]/30',
      )}
    >
      <input
        type="radio"
        name="method_pick"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/55 font-semibold">
            {badge}
          </p>
          <h3 className="font-semibold text-[15px] text-[#0F1419]">{title}</h3>
          <p className="text-[13px] text-[#0F1419]/70 leading-snug">{description}</p>
        </div>
        <span
          className={cn(
            'mt-1 size-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
            checked ? 'border-[#0F1419] bg-[#0F1419]' : 'border-[#0F1419]/30',
          )}
        >
          {checked && <span className="size-2 bg-white rounded-full" />}
        </span>
      </div>
    </label>
  )
}

function UploadField({
  name,
  label,
  accept,
}: {
  name: string
  label: string
  accept: string
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-[11px] font-semibold text-[#0F1419]">
        {label}
      </label>
      <input
        type="file"
        id={name}
        name={name}
        accept={accept}
        className="block w-full text-[13px] text-[#0F1419]/75 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-[#0F1419] file:text-white file:font-medium file:cursor-pointer hover:file:bg-[#0F1419]/85"
      />
    </div>
  )
}
