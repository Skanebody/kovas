import type { ListingLevel } from '@/lib/diagnosticians/listing-level'
import { BadgeCheck, Sparkles } from 'lucide-react'

interface Props {
  level: ListingLevel
  size?: 'sm' | 'md'
}

/**
 * Badge visuel niveau de fiche annuaire.
 * - basic : pillule gris discret "Non-réclamée par le pro"
 * - verified : pillule bleue "✓ Vérifié KOVAS"
 * - premium : pillule chartreuse "★ Recommandé KOVAS"
 */
export function ListingBadge({ level, size = 'md' }: Props) {
  const sizes = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'

  if (level === 'premium') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium bg-[#D4F542]/15 text-[#0B1D33] border border-[#D4F542]/40 ${sizes}`}
      >
        <Sparkles className="size-3" aria-hidden />
        Recommandé KOVAS
      </span>
    )
  }

  if (level === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200 ${sizes}`}
      >
        <BadgeCheck className="size-3" aria-hidden />
        Vérifié KOVAS
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium bg-neutral-100 text-neutral-600 border border-neutral-200 ${sizes}`}
    >
      Non-réclamée par le pro
    </span>
  )
}
