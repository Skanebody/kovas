'use client'

/**
 * Flux d'activité récente — dashboard admin.
 *
 * Stratégie V1 : polling 10s sur /api/admin/audit-log/recent.
 *
 * Pourquoi PAS postgres_changes Realtime côté client :
 *   - admin_audit_log RLS exige is_admin(auth.uid()). Le client browser utilise
 *     l'anon key + cookie auth — il PEUT subscribe mais ne reçoit que les rows
 *     que sa policy SELECT autorise. En théorie ça marche, mais :
 *   - Le Realtime Postgres CDC nécessite la publication supabase_realtime activée
 *     sur la table (non confirmé dans la migration 20260521120000).
 *   - Polling 10s est largement suffisant pour un feed admin V1 (< 1 req/s
 *     même avec plusieurs onglets ouverts, et seul Benjamin pour l'instant).
 *
 * V2 TODO : activer publication Realtime sur admin_audit_log (alter publication
 * supabase_realtime add table admin_audit_log) + subscribe postgres_changes.
 */

import { Card } from '@/components/ui/card'
import { Activity, Bot, Globe, Send, Terminal, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface AuditLogItem {
  id: string
  admin_user_id: string
  action_type: string
  action_source: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  succeeded: boolean
  error_message: string | null
  created_at: string
}

interface RecentResponse {
  items?: AuditLogItem[]
  error?: string
}

// ============================================
// Mappings d'affichage
// ============================================

const SOURCE_ICONS: Record<string, LucideIcon> = {
  dashboard_web: Globe,
  telegram_bot_command: Send,
  telegram_bot_button: Send,
  telegram_bot_nlp: Send,
  system_automated: Bot,
  cli: Terminal,
}

const SOURCE_LABELS: Record<string, string> = {
  dashboard_web: 'Dashboard',
  telegram_bot_command: 'Telegram',
  telegram_bot_button: 'Telegram',
  telegram_bot_nlp: 'Telegram',
  system_automated: 'Système',
  cli: 'CLI',
}

const ACTION_LABELS: Record<string, string> = {
  '2fa_enabled': 'Activation 2FA',
  '2fa_verified': 'Connexion 2FA validée',
  '2fa_verify_failed': 'Échec validation 2FA',
  '2fa_setup_failed': 'Échec setup 2FA',
  admin_logout: 'Déconnexion admin',
  user_suspended: 'Utilisateur suspendu',
  user_reactivated: 'Utilisateur réactivé',
  org_suspended: 'Organisation suspendue',
}

function humanAction(actionType: string): string {
  return ACTION_LABELS[actionType] ?? actionType.replace(/_/g, ' ')
}

function relativeTime(iso: string): string {
  const now = Date.now()
  const ts = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000))
  if (diffSec < 60) return 'à l’instant'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `il y a ${diffD} j`
  // Au-delà : date courte FR
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ============================================
// Composant
// ============================================

const POLL_INTERVAL_MS = 10_000

export function RecentActivityFeed() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audit-log/recent', { cache: 'no-store' })
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
        return
      }
      const data = (await res.json()) as RecentResponse
      if (data.items) {
        setItems(data.items)
        setError(null)
      } else if (data.error) {
        setError(data.error)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchItems()
    const id = setInterval(fetchItems, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchItems])

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Activité récente</h2>
        <span
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint"
          title="Polling 10s sur admin_audit_log"
        >
          <Activity className="size-3" aria-hidden />
          live · 10s
        </span>
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder, ordre stable.
            <div key={i} className="h-9 rounded-md bg-ink/5" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune activité récente.</p>
      ) : (
        <ul
          className="space-y-2 max-h-[420px] overflow-y-auto pr-1"
          aria-label="Entrées d'audit récentes"
        >
          {items.map((item) => {
            const Icon = SOURCE_ICONS[item.action_source] ?? Activity
            const sourceLabel = SOURCE_LABELS[item.action_source] ?? item.action_source
            return (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-md px-2.5 py-2 hover:bg-ink/[0.03] transition-colors"
              >
                <div className="mt-0.5 size-7 rounded-md bg-ink/5 flex items-center justify-center shrink-0">
                  {item.succeeded ? (
                    <Icon className="size-3.5 text-ink-mute" aria-hidden />
                  ) : (
                    <XCircle className="size-3.5 text-accent-red" aria-hidden />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-ink leading-tight truncate">
                    {humanAction(item.action_type)}
                    {item.target_label ? (
                      <span className="text-ink-mute"> · {item.target_label}</span>
                    ) : null}
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint mt-0.5">
                    {sourceLabel} · {relativeTime(item.created_at)}
                    {item.error_message && !item.succeeded ? ` · ${item.error_message}` : ''}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {error && items.length === 0 ? (
        <p className="text-[12px] text-accent-red mt-3" role="alert">
          Erreur de chargement : {error}
        </p>
      ) : null}
    </Card>
  )
}
