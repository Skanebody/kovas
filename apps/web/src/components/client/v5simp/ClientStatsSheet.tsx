'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { formatPriceEUR } from '@kovas/shared'
import { BarChart3 } from 'lucide-react'
import { useState } from 'react'

export interface ClientStats {
  /** Chiffre d'affaires total en centimes (intégère devis + factures) */
  caTotalCents: number
  /** Nombre de dossiers liés (hors soft-deleted) */
  dossiersCount: number
  /** Score fidélité simple — nombre de dossiers réalisés (≥5 = fidèle) */
  fideliteScore: number
  /** Date ISO du dernier contact (créa dossier / lead — V1 : created_at du dernier dossier) */
  lastContactIso: string | null
  /** Date ISO du premier dossier (= "client depuis") */
  firstContactIso: string | null
  /** Nombre de biens rattachés */
  biensCount: number
}

interface Props {
  stats: ClientStats
}

const dateFr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })

function formatIsoDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFr.format(d)
}

/**
 * BottomSheet listant les indicateurs business du client.
 * Ouvert via le bouton "Statistiques" du context bar (page client SIMP-2).
 * Format sobre mono — vouvoiement, aucune emoji, ton professionnel.
 */
export function ClientStatsSheet({ stats }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Voir les statistiques client"
      >
        <BarChart3 className="size-4" strokeWidth={1.5} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1.5">
          Statistiques
        </span>
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Statistiques client"
        description="Indicateurs synthétiques d'activité"
      >
        <ul className="divide-y divide-rule/40 px-2 pb-2">
          <StatRow label="Chiffre d'affaires cumulé" value={formatPriceEUR(stats.caTotalCents)} />
          <StatRow label="Dossiers" value={`${stats.dossiersCount}`} />
          <StatRow label="Biens rattachés" value={`${stats.biensCount}`} />
          <StatRow
            label="Score fidélité"
            value={
              stats.fideliteScore >= 5
                ? `${stats.fideliteScore} (fidèle)`
                : `${stats.fideliteScore}`
            }
          />
          <StatRow label="Client depuis" value={formatIsoDate(stats.firstContactIso)} />
          <StatRow label="Dernier contact" value={formatIsoDate(stats.lastContactIso)} />
        </ul>
      </BottomSheet>
    </>
  )
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between py-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
        {label}
      </span>
      <span className="font-mono text-[14px] font-medium text-ink">{value}</span>
    </li>
  )
}
