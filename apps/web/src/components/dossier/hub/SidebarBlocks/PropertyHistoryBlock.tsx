import { Card } from '@/components/ui/card'
import { History } from 'lucide-react'

export interface PropertyHistoryItem {
  id: string
  source: 'ademe' | 'kovas' | 'cadastre'
  label: string
  date: string | null
  detail: string | null
}

interface PropertyHistoryBlockProps {
  items: ReadonlyArray<PropertyHistoryItem>
}

const SOURCE_LABEL: Record<PropertyHistoryItem['source'], string> = {
  ademe: 'ADEME',
  kovas: 'KOVAS',
  cadastre: 'Cadastre',
}

/**
 * Bloc sidebar — Historique du bien.
 * Combine ADEME open data, autres missions KOVAS, cadastre.
 */
export function PropertyHistoryBlock({ items }: PropertyHistoryBlockProps) {
  return (
    <Card variant="flat" padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="size-3.5 text-[#0F1419]/72" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
          Historique du bien
        </p>
      </div>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.slice(0, 4).map((it) => (
            <li key={it.id} className="text-[12px] text-[#0F1419]/82">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase text-[#0F1419]/55">
                  {SOURCE_LABEL[it.source]}
                </span>
                {it.date ? (
                  <span className="font-mono text-[10px] text-[#0F1419]/55">
                    {new Date(it.date).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                  </span>
                ) : null}
              </div>
              <p className="text-[#0F1419] leading-tight">{it.label}</p>
              {it.detail ? <p className="text-[#0F1419]/55 text-[11px]">{it.detail}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[#0F1419]/55">
          Aucun antécédent. L&apos;intégration ADEME open data sera disponible prochainement.
        </p>
      )}
    </Card>
  )
}
