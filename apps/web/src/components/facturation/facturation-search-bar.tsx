'use client'

import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { FacturationTab } from './types'

interface FacturationSearchBarProps {
  current: FacturationTab
}

const PLACEHOLDER: Record<FacturationTab, string> = {
  devis: 'Rechercher un devis (numéro, client, montant)',
  factures: 'Rechercher une facture (numéro, client, montant)',
  tarifs: 'Rechercher un produit ou service',
}

/**
 * Barre de recherche globale Facturation. Filtre l'onglet courant via
 * le query param `q`. Debouncée (250ms). Préserve le tab et les autres
 * paramètres.
 *
 * On utilise un ref pour la fonction de commit afin d'éviter qu'elle
 * réinscrive la dépendance dans le useEffect debounce (qui se déclencherait
 * en boucle à chaque tap).
 */
export function FacturationSearchBar({ current }: FacturationSearchBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initial = searchParams?.get('q') ?? ''
  const [value, setValue] = useState(initial)

  // Sync depuis URL quand on change d'onglet (reset externe).
  useEffect(() => {
    setValue(searchParams?.get('q') ?? '')
  }, [searchParams])

  // Ref toujours fraîche pour la dernière closure de commit.
  const commitRef = useRef<(next: string) => void>(() => {})
  useEffect(() => {
    commitRef.current = (next: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      if (next.trim()) {
        params.set('q', next.trim())
      } else {
        params.delete('q')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }
  }, [pathname, router, searchParams])

  // Debounce 250ms : ne déclenche que sur `value`. La closure reste fraîche
  // via commitRef.current.
  useEffect(() => {
    const t = setTimeout(() => commitRef.current(value), 250)
    return () => clearTimeout(t)
  }, [value])

  return (
    <div className="relative w-full sm:max-w-md">
      <Search
        aria-hidden
        className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-ink-faint"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={PLACEHOLDER[current]}
        className="pl-10"
        aria-label={PLACEHOLDER[current]}
      />
    </div>
  )
}
