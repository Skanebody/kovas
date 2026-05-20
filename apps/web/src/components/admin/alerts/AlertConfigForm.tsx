/**
 * Affichage des rules configurées (V1 lecture seule).
 *
 * Liste les règles avec leur formule, severity, cooldown et flags de
 * notification. La modification interactive (toggle active, edit threshold)
 * arrive en V1.5 — la migration SQL inclut déjà les 6 règles seedées.
 */

import { Card } from '@/components/ui/card'
import type { AlertRule } from '@/lib/admin/alert-engine'
import { Settings2 } from 'lucide-react'

interface AlertConfigFormProps {
  rules: AlertRule[]
}

const FORMULA_LABELS: Record<string, string> = {
  daily_ia_cost: 'Coût IA quotidien',
  user_daily_ia_cap: 'Cap user quotidien',
  api_error_rate: 'Taux erreur API',
  stripe_webhook_age: 'Stripe webhook stale',
  mrr_milestone: 'MRR palier',
  signups_anomaly: 'Signups anomaly',
}

const SEVERITY_BADGE: Record<'info' | 'warning' | 'critical', string> = {
  info: 'bg-accent-blue/12 text-accent-blue ring-accent-blue/20',
  warning: 'bg-warning/12 text-warning ring-warning/20',
  critical: 'bg-accent-red/12 text-accent-red ring-accent-red/20',
}

export function AlertConfigForm({ rules }: AlertConfigFormProps) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2">
            <Settings2 className="size-4 text-ink-mute" aria-hidden />
            Règles d'alerte
          </h2>
          <p className="text-[11px] text-ink-mute mt-0.5">
            Lecture seule V1 · édition complète V1.5
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {rules.length} règle{rules.length > 1 ? 's' : ''}
        </span>
      </div>

      {rules.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune règle configurée.</p>
      ) : (
        <ul className="divide-y divide-rule/40">
          {rules.map((rule) => {
            const formulaLabel =
              FORMULA_LABELS[rule.detection_formula.type] ?? rule.detection_formula.type
            return (
              <li key={rule.id} className="py-2.5 flex items-start gap-3">
                <span
                  className={`inline-flex size-2 rounded-full shrink-0 mt-1.5 ${rule.active ? 'bg-success' : 'bg-ink-faint/40'}`}
                  title={rule.active ? 'Active' : 'Désactivée'}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-medium text-ink truncate">{rule.name}</p>
                    <span
                      className={`inline-flex rounded-pill px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ring-1 ${SEVERITY_BADGE[rule.severity]}`}
                    >
                      {rule.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-mute mt-0.5 truncate">
                    {formulaLabel}
                    {rule.threshold_value !== null ? ` · seuil ${rule.threshold_value}` : ''}
                    {rule.cooldown_minutes > 0 ? ` · cooldown ${rule.cooldown_minutes}min` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-ink-faint shrink-0">
                  {rule.notify_telegram ? (
                    <span title={`Telegram channel ${rule.notify_telegram_channel ?? ''}`}>TG</span>
                  ) : null}
                  {rule.notify_email ? <span title="Email">EM</span> : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
