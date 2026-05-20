'use client'

/**
 * Manager des templates email :
 * - Liste avec preview HTML
 * - Editer (subject, body_html, body_text)
 * - Dupliquer (génère une key avec suffix `-copy`)
 * - Tester (envoie à l'admin courant)
 * - Soft-delete (toggle active=false)
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { EmailTemplateRow } from '@/lib/admin/broadcasts-types'
import { Copy, Pencil, Send, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface EmailTemplatesManagerProps {
  templates: EmailTemplateRow[]
}

interface ApiError {
  error?: string
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  method = 'POST',
): Promise<{ ok: true } | { ok: false; status: number; error: ApiError }> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as ApiError
    return { ok: false, status: res.status, error: err }
  }
  return { ok: true }
}

export function EmailTemplatesManager({ templates }: EmailTemplatesManagerProps) {
  const router = useRouter()
  const [editing, setEditing] = useState<EmailTemplateRow | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleEditSave = () => {
    if (!editing) return
    setError(null)
    startTransition(async () => {
      const res = await postJson(
        `/api/admin/email-templates/${editing.id}`,
        {
          name: editing.name,
          subject: editing.subject,
          body_html: editing.body_html,
          body_text: editing.body_text,
          variables: editing.variables,
          active: editing.active,
        },
        'PATCH',
      )
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setEditing(null)
      setFeedback('Template mis à jour')
      router.refresh()
    })
  }

  const handleDuplicate = (t: EmailTemplateRow) => {
    setError(null)
    startTransition(async () => {
      const res = await postJson('/api/admin/email-templates', {
        key: `${t.key}-copy-${Date.now()}`,
        name: `${t.name} (copie)`,
        subject: t.subject,
        body_html: t.body_html,
        body_text: t.body_text,
        variables: t.variables,
        active: true,
      })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback('Template dupliqué')
      router.refresh()
    })
  }

  const handleTest = (t: EmailTemplateRow) => {
    setError(null)
    startTransition(async () => {
      const vars: Record<string, string> = {}
      for (const v of t.variables) vars[v] = `[${v}]`
      const res = await postJson(`/api/admin/email-templates/${t.id}/test`, { vars })
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback(`Test envoyé pour « ${t.name} »`)
    })
  }

  const handleDelete = (t: EmailTemplateRow) => {
    if (!window.confirm(`Désactiver le template « ${t.name} » ?`)) return
    setError(null)
    startTransition(async () => {
      const res = await postJson(`/api/admin/email-templates/${t.id}`, {}, 'DELETE')
      if (!res.ok) {
        setError(res.error.error ?? `HTTP ${res.status}`)
        return
      }
      setFeedback('Template désactivé')
      router.refresh()
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📑 Templates · Réutilisables
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Templates email
        </h2>
      </header>

      {error ? (
        <p className="text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? <output className="block text-[12px] text-emerald-700">{feedback}</output> : null}

      <ul className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-[13px] text-ink-mute italic">Aucun template configuré.</p>
        ) : (
          templates.map((t) => (
            <li key={t.id} className="rounded-lg border border-rule bg-paper-soft p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-display font-semibold text-[13px] text-ink truncate">
                      {t.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                      {t.key}
                    </span>
                    {!t.active ? (
                      <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-pill bg-ink/10 text-ink-mute">
                        inactif
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] text-ink-mute truncate">
                    <span className="font-mono">Sujet :</span> {t.subject}
                  </p>
                  {t.variables.length > 0 ? (
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      Variables : {t.variables.map((v) => `{{${v}}}`).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(t)}
                    aria-label="Modifier"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicate(t)}
                    aria-label="Dupliquer"
                    disabled={isPending}
                  >
                    <Copy className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(t)}
                    aria-label="Tester"
                    disabled={isPending}
                  >
                    <Send className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(t)}
                    aria-label="Désactiver"
                    disabled={isPending || !t.active}
                  >
                    <Trash2 className="size-3.5 text-danger" aria-hidden />
                  </Button>
                </div>
              </div>
              <details className="mt-2">
                <summary className="text-[11px] font-mono uppercase tracking-wider text-ink-mute cursor-pointer">
                  Aperçu HTML
                </summary>
                <div
                  className="mt-2 rounded-md border border-rule bg-paper p-2 prose prose-sm max-w-none text-ink"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: preview admin scope
                  dangerouslySetInnerHTML={{ __html: t.body_html }}
                />
              </details>
            </li>
          ))
        )}
      </ul>

      <Dialog open={editing !== null} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifier le template</DialogTitle>
            <DialogDescription>Mise à jour propagée immédiatement.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <Input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nom du template"
              />
              <Input
                value={editing.subject}
                onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                placeholder="Sujet"
              />
              <Textarea
                value={editing.body_html}
                onChange={(e) => setEditing({ ...editing, body_html: e.target.value })}
                rows={8}
                className="font-mono text-[12px]"
                placeholder="Corps HTML"
              />
              <Textarea
                value={editing.body_text ?? ''}
                onChange={(e) => setEditing({ ...editing, body_text: e.target.value })}
                rows={3}
                className="font-mono text-[12px]"
                placeholder="Version texte (optionnel)"
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleEditSave}
              disabled={isPending || !editing}
            >
              {isPending ? 'Sauvegarde…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
