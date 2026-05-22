'use client'

import { cn } from '@/lib/utils'
import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

/**
 * Search bar style iOS Settings — input "Rechercher dans les réglages",
 * filtre client-side les sections.
 *
 * Implementation : input + script qui parcourt `[data-search-key]` éléments
 * et toggle `hidden` selon match dans le texte interne. Pas de state global,
 * pas de React tree manipulation : on mute DOM directement (cohérent pour
 * un filtre purement visuel, sans impact serveur).
 */
export function SettingsSearch() {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const sections = document.querySelectorAll<HTMLElement>('[data-search-key]')

    sections.forEach((section) => {
      if (!normalizedQuery) {
        section.style.display = ''
        return
      }
      const text = (section.textContent ?? '').toLowerCase()
      const key = (section.dataset.searchKey ?? '').toLowerCase()
      const match = text.includes(normalizedQuery) || key.includes(normalizedQuery)
      section.style.display = match ? '' : 'none'
    })
  }, [query])

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#0F1419]/40 pointer-events-none"
        aria-hidden
      />
      <input
        ref={inputRef}
        type="search"
        placeholder="Rechercher dans les réglages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Rechercher dans les réglages"
        className={cn(
          'w-full h-12 md:h-10 rounded-xl pl-9 pr-9 text-[14px]',
          'bg-[#0F1419]/[0.05] border-0 outline-none',
          'placeholder:text-[#0F1419]/40 text-[#0F1419]',
          'focus:bg-[#0F1419]/[0.07] transition-colors',
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-6 rounded-full bg-[#0F1419]/15 hover:bg-[#0F1419]/25 flex items-center justify-center transition-colors"
          aria-label="Effacer la recherche"
        >
          <X className="size-3 text-white" strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
