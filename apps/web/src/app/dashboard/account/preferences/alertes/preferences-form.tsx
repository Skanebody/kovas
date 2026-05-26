'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { AlertPreferences } from '@/lib/alerts/types'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { saveAlertPreferencesAction } from './actions'

interface PreferencesFormProps {
  initial: AlertPreferences
}

type Patch = Partial<Omit<AlertPreferences, 'organizationId'>>

/**
 * Switch sobre vouvoiement — pas de "gamification fun".
 */
function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  disabled,
}: {
  label: string
  description?: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#0F1419]">{label}</p>
        {description ? <p className="text-xs text-[#0F1419]/72 mt-0.5">{description}</p> : null}
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F1419]/20',
          enabled ? 'bg-[#0F1419]' : 'bg-[#0F1419]/15',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-paper shadow transition-transform mt-0.5',
            enabled ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

function SelectRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (v: T) => void
  disabled?: boolean
}) {
  return (
    <div className="py-3 space-y-2">
      <div>
        <p className="text-sm font-medium text-[#0F1419]">{label}</p>
        {description ? <p className="text-xs text-[#0F1419]/72 mt-0.5">{description}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 text-xs rounded-pill border transition-colors',
              value === opt.value
                ? 'bg-[#0F1419] text-[#D4F542] border-[#0F1419]'
                : 'bg-paper text-[#0F1419] border-[#0F1419]/15 hover:bg-[#0F1419]/5',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function PreferencesForm({ initial }: PreferencesFormProps) {
  const [prefs, setPrefs] = useState<AlertPreferences>(initial)
  const [pending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const update = (patch: Patch) => {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    startTransition(async () => {
      const res = await saveAlertPreferencesAction(patch)
      if (res.ok) {
        setSavedAt(Date.now())
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Détection incohérences */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Détection d’incohérences DPE</CardTitle>
          <CardDescription>
            Repère les écarts évidents (surface, étiquette, équipement). Jamais bloquant — tu gardes
            la main.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ToggleRow
            label="Activé"
            enabled={prefs.fraudDetectionEnabled}
            onToggle={() => update({ fraudDetectionEnabled: !prefs.fraudDetectionEnabled })}
          />
          <SelectRow
            label="Sensibilité"
            description="Plus la sensibilité est basse, moins KOVAS t'interpelle."
            value={prefs.fraudSensitivity}
            options={[
              { value: 'normal', label: 'Normale' },
              { value: 'low', label: 'Basse' },
              { value: 'very_low', label: 'Très basse' },
            ]}
            onChange={(v) => update({ fraudSensitivity: v })}
            disabled={!prefs.fraudDetectionEnabled}
          />
        </CardContent>
      </Card>

      {/* Pré-vérification ADEME */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Pré-vérification avant export</CardTitle>
          <CardDescription>
            Quelques contrôles métier avant l’envoi (complétude, cohérence). Max 3 points remontés.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ToggleRow
            label="Activé"
            enabled={prefs.preExportEnabled}
            onToggle={() => update({ preExportEnabled: !prefs.preExportEnabled })}
          />
          <SelectRow
            label="Mode"
            description="Permissif : seuls les points majeurs remontent."
            value={prefs.preExportStrictness}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'permissive', label: 'Permissif' },
            ]}
            onChange={(v) => update({ preExportStrictness: v })}
            disabled={!prefs.preExportEnabled}
          />
        </CardContent>
      </Card>

      {/* Suggestions pendant la mission */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Suggestions pendant la mission</CardTitle>
          <CardDescription>
            Quand KOVAS peut te proposer une astuce. Par défaut, uniquement au check-out (en fin de
            mission).
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <SelectRow
            label="Moment"
            value={prefs.proactiveSuggestionsMode}
            options={[
              { value: 'disabled', label: 'Désactivé' },
              { value: 'checkout_only', label: 'Au check-out uniquement' },
              { value: 'in_mission', label: 'En cours de mission' },
            ]}
            onChange={(v) => update({ proactiveSuggestionsMode: v })}
          />
          <p className="text-xs text-[#0F1419]/72 mt-2">
            Quoi qu’il arrive, KOVAS ne dépasse jamais 1 suggestion proactive par jour.
          </p>
        </CardContent>
      </Card>

      {/* Coach IA hebdomadaire */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Coach IA</CardTitle>
          <CardDescription>
            Une synthèse périodique sobre — tes gains, tes écarts, tes pistes d’amélioration.
            Désactivé par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ToggleRow
            label="Activé"
            enabled={prefs.coachAiEnabled}
            onToggle={() => update({ coachAiEnabled: !prefs.coachAiEnabled })}
          />
          <SelectRow
            label="Fréquence"
            value={prefs.coachAiFrequency}
            options={[
              { value: 'weekly', label: 'Hebdomadaire' },
              { value: 'monthly', label: 'Mensuelle' },
              { value: 'quarterly', label: 'Trimestrielle' },
              { value: 'disabled', label: 'Aucune' },
            ]}
            onChange={(v) => update({ coachAiFrequency: v })}
            disabled={!prefs.coachAiEnabled}
          />
        </CardContent>
      </Card>

      {/* Notifications de leads */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Notifications de leads</CardTitle>
          <CardDescription>
            Quand un particulier te contacte. Respect strict de ta plage calme.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ToggleRow
            label="Activé"
            enabled={prefs.leadNotificationsEnabled}
            onToggle={() => update({ leadNotificationsEnabled: !prefs.leadNotificationsEnabled })}
          />
          <div className="grid grid-cols-2 gap-3 py-3">
            <div>
              <label className="text-xs text-[#0F1419]/72" htmlFor="quiet-start">
                Plage calme — début
              </label>
              <input
                id="quiet-start"
                type="time"
                value={prefs.leadQuietHoursStart}
                disabled={!prefs.leadNotificationsEnabled}
                onChange={(e) => update({ leadQuietHoursStart: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#0F1419]/[0.08] bg-paper px-2 py-1.5 text-sm text-[#0F1419] disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-xs text-[#0F1419]/72" htmlFor="quiet-end">
                Plage calme — fin
              </label>
              <input
                id="quiet-end"
                type="time"
                value={prefs.leadQuietHoursEnd}
                disabled={!prefs.leadNotificationsEnabled}
                onChange={(e) => update({ leadQuietHoursEnd: e.target.value })}
                className="mt-1 w-full rounded-md border border-[#0F1419]/[0.08] bg-paper px-2 py-1.5 text-sm text-[#0F1419] disabled:opacity-50"
              />
            </div>
          </div>
          <ToggleRow
            label="Notifier le week-end"
            description="Désactivé par défaut."
            enabled={prefs.leadWeekendNotifications}
            onToggle={() => update({ leadWeekendNotifications: !prefs.leadWeekendNotifications })}
            disabled={!prefs.leadNotificationsEnabled}
          />
        </CardContent>
      </Card>

      {/* Gamification — vocabulaire sobre */}
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Reconnaissance professionnelle</CardTitle>
          <CardDescription>
            Statuts (Confirmé, Sénior, Premium…) et points de progression — vocabulaire métier
            sobre. Tu peux tout couper.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ToggleRow
            label="Activé"
            enabled={prefs.gamificationEnabled}
            onToggle={() => update({ gamificationEnabled: !prefs.gamificationEnabled })}
          />
          <ToggleRow
            label="Notifications de changement de statut"
            description="Maximum 3 à 4 par an."
            enabled={prefs.levelNotificationsEnabled}
            onToggle={() => update({ levelNotificationsEnabled: !prefs.levelNotificationsEnabled })}
            disabled={!prefs.gamificationEnabled}
          />
        </CardContent>
      </Card>

      {/* Status save */}
      <div className="flex items-center justify-end gap-2 text-xs text-[#0F1419]/72">
        {pending ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Enregistrement…
          </span>
        ) : savedAt ? (
          <span className="inline-flex items-center gap-1 text-[#34C759]">
            <Check className="size-3" /> Enregistré
          </span>
        ) : null}
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <a href="/dashboard/account">Retour au compte</a>
        </Button>
      </div>
    </div>
  )
}
