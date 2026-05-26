'use client'

import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'
import { Loader2, Radar } from 'lucide-react'
import { useState, useTransition } from 'react'

import { updateAdemeSettingsAction } from './actions'

interface AdemeFormProps {
  initialCertificatRge: string | null
  initialMonitoringEnabled: boolean
  /** Date ISO du dernier sync ADEME effectué côté worker. */
  lastSyncAt: string | null
}

/**
 * Formulaire paramètres ADEME du diagnostiqueur.
 *
 * Stocke le `certificat_rge` dans `profiles.linguistic_profile.certificat_rge`
 * (convention V1 documentée dans `ademe-daily-sync/index.ts`). Toggle séparé
 * pour activer/désactiver le monitoring rétroactif quotidien.
 *
 * Le bouton "Sync manuelle" est désactivé en V1 (sync-now actuel est admin-only).
 * Une route utilisateur dédiée pourra être ajoutée V1.5 si demandé.
 */
export function AdemeForm({
  initialCertificatRge,
  initialMonitoringEnabled,
  lastSyncAt,
}: AdemeFormProps) {
  const [certificat, setCertificat] = useState(initialCertificatRge ?? '')
  const [monitoringEnabled, setMonitoringEnabled] = useState(initialMonitoringEnabled)
  const [pending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateAdemeSettingsAction({
        certificat_rge: certificat.trim() || null,
        monitoring_enabled: monitoringEnabled,
      })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Paramètres ADEME mis à jour')
      }
    })
  }

  const formattedLastSync = lastSyncAt
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(lastSyncAt))
    : null

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <p className="text-xs text-[#0F1419]/72 leading-relaxed">
        Renseigne ton numéro de certificat <GlossaryTerm term="rge">RGE</GlossaryTerm> pour activer
        le monitoring rétroactif de tes <GlossaryTerm term="dpe">DPE</GlossaryTerm> publiés sur
        l&apos;API <GlossaryTerm term="ademe">ADEME</GlossaryTerm>. Détection automatique des
        dépassements de seuils, distances suspectes et incohérences avant que l&apos;ADEME ne te
        contacte.
      </p>

      {/* Certificat RGE */}
      <div className="space-y-1.5">
        <Label htmlFor="certificat_rge" className="text-xs font-semibold uppercase tracking-wider">
          Certificat RGE
        </Label>
        <Input
          id="certificat_rge"
          name="certificat_rge"
          type="text"
          placeholder="ex : 1234ABCD5678"
          value={certificat}
          onChange={(e) => setCertificat(e.target.value)}
          maxLength={40}
          className="font-mono"
        />
        <p className="text-[11px] text-[#0F1419]/72">
          Visible sur ta certification de diagnostiqueur. Format libre, généralement alphanumérique
          8-20 caractères.
        </p>
      </div>

      {/* Toggle monitoring */}
      <div className="flex items-start justify-between gap-3 rounded-md border border-[#0F1419]/[0.08] p-3 bg-paper">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0F1419]">Monitoring rétroactif ADEME</p>
          <p className="text-xs text-[#0F1419]/72 leading-snug">
            Sync quotidien des DPE que tu as publiés. Génère alertes et KPIs dans le Cockpit ADEME.
            Requiert un certificat RGE renseigné.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={monitoringEnabled}
          onClick={() => setMonitoringEnabled((v) => !v)}
          disabled={!certificat.trim()}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
            monitoringEnabled ? 'bg-[#0F1419]' : 'bg-[#0F1419]/20'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-150 ${
              monitoringEnabled ? 'translate-x-5' : 'translate-x-0.5'
            } translate-y-0.5`}
          />
        </button>
      </div>

      {/* Dernier sync */}
      {formattedLastSync && (
        <div className="flex items-center gap-2 text-xs text-[#0F1419]/72">
          <Radar className="size-3.5" />
          <span>Dernier sync : {formattedLastSync}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  )
}
