'use client'

/**
 * RoadmapEditor — liste roadmap groupée par target_version, avec :
 *   - filter status
 *   - création inline rapide d'un nouvel item
 *   - bouton de transition status (planned → in_progress → shipped)
 *
 * V2 : drag-drop priority.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { RoadmapCategory, RoadmapItemRow, RoadmapStatus } from '@/lib/admin/milestones-types'
import { ROADMAP_CATEGORY_LABEL, ROADMAP_STATUS_LABEL } from '@/lib/admin/milestones-types'
import { useRouter } from 'next/navigation'
import { useId, useMemo, useState, useTransition } from 'react'

export interface RoadmapEditorProps {
  itemsByVersion: Array<{ version: string; items: RoadmapItemRow[] }>
}

const STATUS_BG: Record<RoadmapStatus, string> = {
  planned: 'bg-cream-deep text-ink-mute',
  in_progress: 'bg-orange-mist text-[#7C3F0A]',
  completed: 'bg-blue-mist text-[#1E3A8A]',
  shipped: 'bg-lime-mist text-[#2D4015]',
  cancelled: 'bg-coral-mist text-[#8B1414]',
}

const NEXT_STATUS: Partial<Record<RoadmapStatus, RoadmapStatus>> = {
  planned: 'in_progress',
  in_progress: 'shipped',
  completed: 'shipped',
}

interface NewItemDraft {
  title: string
  category: RoadmapCategory
  target_version: string
  estimated_days: string
}

const EMPTY_DRAFT: NewItemDraft = {
  title: '',
  category: 'feature',
  target_version: 'V2',
  estimated_days: '',
}

export function RoadmapEditor({ itemsByVersion }: RoadmapEditorProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<'all' | RoadmapStatus>('all')
  const [draft, setDraft] = useState<NewItemDraft>(EMPTY_DRAFT)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const statusFilterId = useId()

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return itemsByVersion
    return itemsByVersion
      .map((g) => ({ ...g, items: g.items.filter((i) => i.status === statusFilter) }))
      .filter((g) => g.items.length > 0)
  }, [itemsByVersion, statusFilter])

  const createItem = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!draft.title.trim()) {
      setError('Titre requis.')
      return
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/roadmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: draft.title.trim(),
            category: draft.category,
            target_version: draft.target_version.trim() || null,
            estimated_days: draft.estimated_days ? Number.parseInt(draft.estimated_days, 10) : null,
            status: 'planned',
          }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        setDraft(EMPTY_DRAFT)
        setShowForm(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      }
    })
  }

  const advanceStatus = (item: RoadmapItemRow) => {
    const next = NEXT_STATUS[item.status]
    if (!next) return
    setError(null)
    setPendingId(item.id)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/roadmap/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            🗺️ Roadmap · {itemsByVersion.reduce((a, g) => a + g.items.length, 0)} items
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Roadmap produit.</h2>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={statusFilterId}
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute"
          >
            Statut
          </label>
          <Select
            id={statusFilterId}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="!h-9 !min-h-[36px] !py-1 !text-[12px] w-[140px]"
          >
            <option value="all">Tous</option>
            <option value="planned">Planifié</option>
            <option value="in_progress">En cours</option>
            <option value="completed">Terminé</option>
            <option value="shipped">Livré</option>
            <option value="cancelled">Annulé</option>
          </Select>
          <Button type="button" variant="accent" size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Fermer' : '+ Nouvel item'}
          </Button>
        </div>
      </header>

      {showForm ? (
        <form
          onSubmit={createItem}
          className="mb-5 rounded-lg border border-navy/20 bg-paper p-4 space-y-3"
          aria-label="Créer un item roadmap"
        >
          <Input
            value={draft.title}
            onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
            placeholder="Titre (ex: Vision IA reconnaissance équipement)"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select
              value={draft.category}
              onChange={(e) =>
                setDraft((p) => ({ ...p, category: e.target.value as RoadmapCategory }))
              }
            >
              {(['feature', 'bug', 'tech_debt', 'ux', 'business'] as RoadmapCategory[]).map((c) => (
                <option key={c} value={c}>
                  {ROADMAP_CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
            <Input
              value={draft.target_version}
              onChange={(e) => setDraft((p) => ({ ...p, target_version: e.target.value }))}
              placeholder="V2, Phase 2…"
            />
            <Input
              type="number"
              value={draft.estimated_days}
              onChange={(e) => setDraft((p) => ({ ...p, estimated_days: e.target.value }))}
              placeholder="Jours estimés"
              min={0}
            />
          </div>
          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="accent" size="sm" disabled={isPending}>
              {isPending ? 'Création…' : 'Créer'}
            </Button>
          </div>
        </form>
      ) : null}

      {error && !showForm ? (
        <p className="mb-3 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucun item.</p>
      ) : (
        <div className="space-y-5">
          {filtered.map((group) => (
            <section key={group.version} aria-label={`Version ${group.version}`}>
              <h3 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute mb-2">
                {group.version} · {group.items.length}
              </h3>
              <ul className="space-y-2">
                {group.items.map((item) => {
                  const nextStatus = NEXT_STATUS[item.status]
                  return (
                    <li
                      key={item.id}
                      className="rounded-md border border-rule/60 bg-cream-deep/30 p-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span
                            className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${STATUS_BG[item.status]}`}
                          >
                            {ROADMAP_STATUS_LABEL[item.status]}
                          </span>
                          {item.category ? (
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                              {ROADMAP_CATEGORY_LABEL[item.category]}
                            </span>
                          ) : null}
                          {item.estimated_days ? (
                            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                              ~{item.estimated_days}j
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[13px] text-ink font-medium truncate">{item.title}</p>
                        {item.description ? (
                          <p className="text-[12px] text-ink-mute mt-0.5">{item.description}</p>
                        ) : null}
                      </div>
                      {nextStatus ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending && pendingId === item.id}
                          onClick={() => advanceStatus(item)}
                        >
                          {isPending && pendingId === item.id
                            ? '…'
                            : `→ ${ROADMAP_STATUS_LABEL[nextStatus]}`}
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  )
}
