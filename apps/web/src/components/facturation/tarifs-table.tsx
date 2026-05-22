'use client'

import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'
import { MoreHorizontal } from 'lucide-react'
import { formatEur } from './format'
import { TARIF_CATEGORY_LABELS, type TarifRow } from './types'

interface TarifsTableProps {
  rows: readonly TarifRow[]
}

/**
 * Tableau desktop catalogue produits/services.
 * Au clic ligne → modal édition (placeholder V1.5 : toast info).
 */
export function TarifsTable({ rows }: TarifsTableProps) {
  return (
    <AppListTable>
      <AppListTableHead>
        <tr>
          <th className="text-left font-medium px-4 py-3">Nom</th>
          <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Description</th>
          <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Catégorie</th>
          <th className="text-right font-medium px-4 py-3">Prix HT</th>
          <th className="text-right font-medium px-4 py-3 hidden md:table-cell">Utilisations</th>
          <th className="text-right font-medium px-4 py-3 w-12" aria-label="Actions" />
        </tr>
      </AppListTableHead>
      <tbody>
        {rows.map((t) => (
          <AppListTableRow key={t.id} className="cursor-pointer">
            <AppListTableCell>
              <button
                type="button"
                onClick={() =>
                  toast.info('Édition produit', {
                    description: `Modal d'édition pour "${t.name}" — disponible avec la V1.5.`,
                  })
                }
                className="font-semibold text-ink hover:underline text-left"
              >
                {t.name}
              </button>
            </AppListTableCell>
            <AppListTableCell className="hidden md:table-cell text-ink-mute text-[12px]">
              {t.description ?? '—'}
            </AppListTableCell>
            <AppListTableCell className="hidden sm:table-cell">
              <Badge variant="muted">{TARIF_CATEGORY_LABELS[t.category]}</Badge>
            </AppListTableCell>
            <AppListTableCell className="text-right font-mono tabular-nums">
              {formatEur(t.priceCents)}
            </AppListTableCell>
            <AppListTableCell className="hidden md:table-cell text-right text-ink-mute font-mono tabular-nums text-[12px]">
              {t.usageCount}
            </AppListTableCell>
            <AppListTableCell className="text-right">
              <button
                type="button"
                aria-label={`Actions sur ${t.name}`}
                className="inline-flex size-8 items-center justify-center rounded-md text-ink-mute hover:bg-ink/5 hover:text-ink transition-colors"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </AppListTableCell>
          </AppListTableRow>
        ))}
      </tbody>
    </AppListTable>
  )
}
