'use client'

/**
 * Tableau des utilisateurs à risque de churn, triés par MRR risqué desc.
 * Actions inline : envoyer email check-in + tagger "à appeler".
 */

import { Card } from '@/components/ui/card'
import type { ChurnRiskUser } from '@/lib/admin/observability'
import { Mail, PhoneCall } from 'lucide-react'
import { useState } from 'react'

interface Props {
  users: ChurnRiskUser[]
}

const RISK_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  high: { label: 'Élevé', bg: 'bg-danger/10', text: 'text-danger' },
  moderate: { label: 'Modéré', bg: 'bg-amber/15', text: 'text-amber' },
  low: { label: 'Faible', bg: 'bg-ink-mute/10', text: 'text-ink-mute' },
}

const PLAN_LABEL: Record<string, string> = {
  decouverte: 'Découverte',
  standard: 'Standard',
  standard_founder: 'Standard Founder',
  volume: 'Volume',
  standard_complet: 'Standard Complet',
  volume_complet: 'Volume Complet',
  cabinet: 'Cabinet',
  cabinet_founder: 'Cabinet Founder',
}

function formatEur(n: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function CheckInEmailDialog({
  user,
  onClose,
}: {
  user: ChurnRiskUser
  onClose: () => void
}) {
  const firstName = user.fullName?.split(' ')[0] ?? 'Bonjour'
  const defaultSubject = `Tout va bien, ${firstName} ?`
  const defaultBody = `Bonjour ${firstName},

Je viens vers vous personnellement parce que je n'ai pas vu de nouvelle mission KOVAS de votre côté depuis ${user.lastMissionDays ?? '???'} jours.

Tout va bien ? Est-ce qu'il y a quelque chose qui vous bloque, un point sur lequel je peux vous aider, ou simplement une période plus calme ?

Si vous avez 5 minutes, je serais content d'avoir un retour direct — répondez à ce mail ou écrivez-moi sur WhatsApp.

Bien cordialement,
Benjamin
Fondateur KOVAS`

  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${user.userId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'churn_checkin', subject, body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi échoué')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl bg-paper rounded-xl border border-rule/60 shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <h3 className="text-[16px] font-semibold text-ink mb-1">Email check-in personnalisé</h3>
        <p className="text-[12px] text-ink-mute mb-4">
          À : <span className="font-mono">{user.email}</span>
        </p>

        <label className="block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-mute mb-1.5">
          Objet
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full rounded-md border border-rule/60 px-3 py-2 text-[13px] mb-3 bg-paper text-ink focus:outline-none focus:ring-2 focus:ring-chartreuse/50"
        />

        <label className="block text-[11px] font-mono uppercase tracking-[0.14em] text-ink-mute mb-1.5">
          Message
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          className="w-full rounded-md border border-rule/60 px-3 py-2 text-[13px] mb-3 bg-paper text-ink font-mono focus:outline-none focus:ring-2 focus:ring-chartreuse/50"
        />

        {error ? <p className="text-danger text-[12px] mb-3">{error}</p> : null}

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-2 text-[12px] text-ink-mute hover:bg-rule/20 transition-colors"
            disabled={sending}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="rounded-md bg-ink text-paper px-4 py-2 text-[12px] font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {sending ? 'Envoi…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TagButton({ user }: { user: ChurnRiskUser }) {
  const [tagged, setTagged] = useState(user.adminTags.includes('a_appeler'))
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${user.userId}/tag`, {
        method: tagged ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: 'a_appeler' }),
      })
      if (res.ok) {
        setTagged(!tagged)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={
        tagged
          ? 'inline-flex items-center gap-1.5 rounded-md bg-amber/15 text-amber px-2.5 py-1 text-[11px] font-medium border border-amber/30 hover:bg-amber/20 transition-colors disabled:opacity-50'
          : 'inline-flex items-center gap-1.5 rounded-md bg-paper text-ink-mute px-2.5 py-1 text-[11px] font-medium border border-rule/60 hover:bg-rule/10 transition-colors disabled:opacity-50'
      }
      title={tagged ? 'Retirer le tag « à appeler »' : 'Marquer comme à appeler'}
    >
      <PhoneCall className="size-3" aria-hidden />
      {tagged ? 'À appeler ✓' : 'À appeler'}
    </button>
  )
}

export function ChurnRiskTable({ users }: Props) {
  const [emailUser, setEmailUser] = useState<ChurnRiskUser | null>(null)

  return (
    <>
      <Card variant="opaque" padding="default">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Utilisateurs à risque — triés par MRR
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            {users.length} flagués
          </span>
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-ink-mute py-8 text-center">
            Aucun utilisateur à risque détecté. 🎯
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] tabular-nums">
              <thead>
                <tr className="border-b border-rule/60 text-left text-ink-mute font-mono uppercase tracking-[0.14em] text-[10px]">
                  <th className="py-2 pr-3">Risque</th>
                  <th className="py-2 pr-3">Utilisateur</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3 text-right">MRR</th>
                  <th className="py-2 pr-3">Dernière mission</th>
                  <th className="py-2 pr-3">Signal</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const risk = RISK_LABEL[u.riskLevel] ?? RISK_LABEL.low
                  return (
                    <tr key={u.userId} className="border-b border-rule/30 last:border-0">
                      <td className="py-2 pr-3">
                        <span
                          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${risk?.bg} ${risk?.text}`}
                        >
                          {risk?.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-col">
                          <span className="text-ink font-medium">{u.fullName ?? '—'}</span>
                          <span className="font-mono text-[10px] text-ink-mute truncate max-w-[220px]">
                            {u.email}
                          </span>
                          {u.organizationName ? (
                            <span className="text-[10px] text-ink-faint">{u.organizationName}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-ink-mute">
                        {PLAN_LABEL[u.plan ?? ''] ?? u.plan ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-right text-ink font-medium">
                        {formatEur(u.mrrEur)}
                      </td>
                      <td className="py-2 pr-3 text-ink-mute">
                        {u.lastMissionDays === null ? (
                          <span className="text-danger">Aucune</span>
                        ) : (
                          <span>
                            il y a {u.lastMissionDays} j
                            {u.lastDossierRef ? (
                              <span className="block font-mono text-[10px] text-ink-faint">
                                {u.lastDossierRef}
                              </span>
                            ) : null}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-[11px] text-ink-mute max-w-[180px]">
                        {u.triggerSignal ?? <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setEmailUser(u)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-paper text-ink-mute px-2.5 py-1 text-[11px] font-medium border border-rule/60 hover:bg-rule/10 transition-colors"
                            title="Envoyer un email check-in"
                          >
                            <Mail className="size-3" aria-hidden />
                            Email
                          </button>
                          <TagButton user={u} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {emailUser ? (
        <CheckInEmailDialog user={emailUser} onClose={() => setEmailUser(null)} />
      ) : null}
    </>
  )
}
