import type { DevisRow, FactureRow, TarifRow } from './types'

/**
 * Filtrage texte simple (numéro, client, montant en €) pour devis.
 */
export function filterDevis(
  rows: readonly DevisRow[],
  query: string | undefined,
  status: string | undefined,
): DevisRow[] {
  const q = (query ?? '').trim().toLowerCase()
  return rows.filter((r) => {
    if (status && r.status !== status) return false
    if (!q) return true
    return (
      r.reference.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      String(r.amountCents / 100).includes(q)
    )
  })
}

export function filterFactures(
  rows: readonly FactureRow[],
  query: string | undefined,
  status: string | undefined,
): FactureRow[] {
  const q = (query ?? '').trim().toLowerCase()
  return rows.filter((r) => {
    if (status && r.status !== status) return false
    if (!q) return true
    return (
      r.reference.toLowerCase().includes(q) ||
      r.clientName.toLowerCase().includes(q) ||
      String(r.amountCents / 100).includes(q)
    )
  })
}

export function filterTarifs(rows: readonly TarifRow[], query: string | undefined): TarifRow[] {
  const q = (query ?? '').trim().toLowerCase()
  if (!q) return rows.filter((r) => !r.archived)
  return rows.filter((r) => {
    if (r.archived) return false
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      String(r.priceCents / 100).includes(q)
    )
  })
}
