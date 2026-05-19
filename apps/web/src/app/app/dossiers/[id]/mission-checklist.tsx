'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ChecklistRunItem } from '@/lib/checklists'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { useOptimistic, useTransition } from 'react'
import { toggleChecklistItemAction } from './actions'

const CATEGORY_LABELS: Record<string, string> = {
  pieces: 'Pièces & relevés',
  equipements: 'Équipements',
  documents: 'Documents & mesures',
  observations: 'Observations',
}

interface MissionChecklistProps {
  missionId: string
  items: ChecklistRunItem[]
  completion: number
  requiredOk: boolean
}

export function MissionChecklist({
  missionId,
  items,
  completion: _completion,
  requiredOk: _requiredOk,
}: MissionChecklistProps) {
  const [, startTransition] = useTransition()

  // Optimistic state : toggles instantanément manualChecked, le serveur
  // revalide via revalidatePath et écrase si différent.
  const [optimisticItems, applyOptimistic] = useOptimistic(
    items,
    (state: ChecklistRunItem[], patch: { id: string; checked: boolean }): ChecklistRunItem[] =>
      state.map((it) => (it.id === patch.id ? { ...it, manualChecked: patch.checked } : it)),
  )

  function handleToggle(itemId: string, currentChecked: boolean) {
    const newChecked = !currentChecked
    startTransition(async () => {
      applyOptimistic({ id: itemId, checked: newChecked })
      await toggleChecklistItemAction(missionId, itemId, newChecked)
    })
  }

  // Re-calcule completion + requiredOk depuis l'état optimiste (cohérent avec
  // la logique server-side dans lib/checklists.ts).
  const doneCount = optimisticItems.filter(
    (it) => it.status === 'auto_ok' || it.manualChecked === true,
  ).length
  const completion = optimisticItems.length > 0 ? doneCount / optimisticItems.length : 0
  const requiredOk = optimisticItems.every(
    (it) => !it.required || it.status === 'auto_ok' || it.manualChecked === true,
  )

  // Group by category
  const grouped = optimisticItems.reduce<Record<string, ChecklistRunItem[]>>((acc, it) => {
    if (!acc[it.category]) acc[it.category] = []
    acc[it.category]!.push(it)
    return acc
  }, {})

  const percent = Math.round(completion * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="size-4" />
            Check-list ({percent}%)
          </CardTitle>
          {requiredOk ? (
            <Badge variant="green">
              <CheckCircle2 className="size-3 mr-1" /> Prête à exporter
            </Badge>
          ) : (
            <Badge variant="orange">Items obligatoires manquants</Badge>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-cta transition-all" style={{ width: `${percent}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(grouped).map(([cat, catItems]) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              {CATEGORY_LABELS[cat] ?? cat}
            </h3>
            <ul className="space-y-1">
              {catItems.map((it) => {
                const isOk =
                  it.status === 'auto_ok' || (it.status === 'manual' && it.manualChecked === true)
                const isManual = it.status === 'manual'
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => isManual && handleToggle(it.id, it.manualChecked ?? false)}
                      disabled={!isManual}
                      className={cn(
                        'w-full flex items-start gap-3 text-left text-sm rounded-md px-2 py-1.5 transition-colors',
                        isManual ? 'hover:bg-muted cursor-pointer' : 'cursor-default',
                      )}
                    >
                      {isOk ? (
                        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-accent-green" />
                      ) : (
                        <Circle className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={cn(
                          'flex-1',
                          isOk ? 'text-muted-foreground line-through' : '',
                          it.required && !isOk ? 'font-medium' : '',
                        )}
                      >
                        {it.label}
                        {it.required && !isOk && <span className="text-accent-red ml-1">*</span>}
                      </span>
                      {it.status === 'auto_ok' && (
                        <Badge variant="muted" className="text-[10px]">
                          auto
                        </Badge>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
