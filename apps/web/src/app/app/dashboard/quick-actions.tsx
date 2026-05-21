import Link from 'next/link'
import { cn } from '@/lib/utils'

interface QuickAction {
  num: string
  title: string
  sub: string
  href: string
  /** Mettre true si la page cible n'existe pas encore — disabled visuel. */
  disabled?: boolean
}

const ACTIONS: QuickAction[] = [
  {
    num: '→ 01',
    title: 'Nouvelle mission',
    sub: 'Créer un dossier diagnostic',
    href: '/app/dossiers/new',
  },
  {
    num: '→ 02',
    title: 'Nouveau devis',
    sub: "À partir d'une adresse",
    href: '/app/devis/new',
    disabled: true, // TODO V1.5 : page /app/devis/new
  },
  {
    num: '→ 03',
    title: 'Nouvelle facture',
    sub: "Depuis une mission terminée",
    href: '/app/facturation',
  },
  {
    num: '→ 04',
    title: 'Importer depuis Liciel',
    sub: 'Synchroniser un DPE existant',
    href: '/app/dossiers/import-liciel',
  },
]

/**
 * Section 07 — Actions rapides.
 *
 * 4 boutons grid sobres, style mockup data-dense (num mono uppercase + title
 * standard + sub mute). Bordures internes 1px ink/10 entre cellules.
 */
export function QuickActions() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border border-rule/60">
      {ACTIONS.map((a, idx) => {
        const isLast = idx === ACTIONS.length - 1
        const inner = (
          <>
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-3">
              {a.num}
            </p>
            <p className="text-sm font-medium text-ink leading-tight mb-1">{a.title}</p>
            <p className="text-[11px] text-ink-mute leading-snug">{a.sub}</p>
          </>
        )
        const baseClass = cn(
          'p-5 text-left transition-colors',
          !isLast && idx % 2 === 0 && 'border-r border-rule/60',
          !isLast && idx % 2 === 1 && 'md:border-r border-rule/60',
          idx < 2 && 'border-b md:border-b-0 border-rule/60',
          a.disabled
            ? 'bg-paper/60 opacity-50 cursor-not-allowed'
            : 'bg-paper hover:bg-sage/60',
        )
        if (a.disabled) {
          return (
            <div key={a.num} className={baseClass} aria-disabled>
              {inner}
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-mute mt-2">
                Bientôt
              </p>
            </div>
          )
        }
        return (
          <Link key={a.num} href={a.href} className={baseClass}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
