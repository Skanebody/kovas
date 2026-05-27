'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useCallback } from 'react'
import type { FacturationTab } from './types'

interface NewDocumentButtonProps {
  current: FacturationTab
}

const LABEL: Record<FacturationTab, string> = {
  devis: 'Nouveau devis',
  factures: 'Nouvelle facture',
  tarifs: 'Nouveau produit',
}

const HREF: Record<FacturationTab, string | null> = {
  // Réutilise les routes CRUD historiques (conservées après fusion).
  devis: '/dashboard/devis/nouveau',
  factures: '/dashboard/factures/nouveau',
  // Tarifs ouvre une modal d'édition (placeholder pour V1.5).
  tarifs: null,
}

/**
 * CTA contextuel selon l'onglet actif :
 * - Devis / Factures → lien vers page de création
 * - Tarifs → toast placeholder (modal à implémenter V1.5)
 *
 * Variant `accent` chartreuse — CTA fort unique de la page.
 */
export function NewDocumentButton({ current }: NewDocumentButtonProps) {
  const href = HREF[current]
  const label = LABEL[current]

  const onTarifClick = useCallback(() => {
    toast.info('Création de produit', {
      description: 'La modal de catalogue arrive avec la V1.5 — tu seras notifié.',
    })
  }, [])

  if (href) {
    return (
      <Button asChild variant="accent">
        <Link href={href}>
          <Plus className="size-4" />
          {label}
        </Link>
      </Button>
    )
  }

  return (
    <Button variant="accent" onClick={onTarifClick}>
      <Plus className="size-4" />
      {label}
    </Button>
  )
}
