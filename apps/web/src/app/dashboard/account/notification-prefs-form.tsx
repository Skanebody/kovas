'use client'

import { toast } from '@/components/ui/toaster'
import { useState, useTransition } from 'react'
import { updateMonthlyReportPreferenceAction } from './actions'
import { SettingsSwitch } from './settings-switch'

interface NotificationPrefsFormProps {
  initialMonthlyReportEnabled: boolean
}

/**
 * Préférences de notifications email (CLAUDE.md §21bis).
 * V1 : uniquement opt-out du rapport mensuel d'activité.
 *
 * Style iOS Settings : switch inline + texte d'aide sous la ligne.
 */
export function NotificationPrefsForm({ initialMonthlyReportEnabled }: NotificationPrefsFormProps) {
  const [enabled, setEnabled] = useState(initialMonthlyReportEnabled)
  const [pending, startTransition] = useTransition()

  const handleToggle = (next: boolean) => {
    const previous = enabled
    setEnabled(next) // optimistic
    startTransition(async () => {
      const result = await updateMonthlyReportPreferenceAction(next)
      if (result?.error) {
        setEnabled(previous)
        toast.error(result.error)
      } else {
        toast.success(
          next ? 'Tu recevras le rapport mensuel d’activité.' : 'Rapport mensuel désactivé.',
        )
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-white border border-[#0F1419]/[0.08] px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-[15px] font-normal text-[#0F1419]">Rapport mensuel d’activité</p>
        <SettingsSwitch
          checked={enabled}
          onChange={handleToggle}
          disabled={pending}
          label="Activer le rapport mensuel d’activité par email"
        />
      </div>
      <p className="text-[12px] text-[#0F1419]/72 px-4 leading-relaxed">
        Envoyé chaque 1er du mois — récapitulatif des missions réalisées, temps économisé et valeur
        générée. Pas de notification commerciale.
      </p>
    </div>
  )
}
