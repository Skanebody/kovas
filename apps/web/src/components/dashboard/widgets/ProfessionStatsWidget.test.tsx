/**
 * Vitest — ProfessionStatsWidget (Lot B98, bonus tests B82).
 *
 * Couvre :
 *   - Rendu nominal avec 3 KPIs synthétiques (diagnostiqueurs actifs, total, sync DHUP)
 *   - Null returned si summary vide ou total === 0 (évite UI vide)
 *   - Null returned si l'appel Supabase throw (try/catch interne)
 *   - Link vers /observatoire présent
 *   - Formatage FR des nombres (séparateur d'espaces)
 *
 * Stratégie : mock du module `@/lib/observatoire/etat-profession` pour piloter
 * `getEtatProfessionSummary`. Le widget est un async server component → on
 * await son rendu JSX avant render().
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfessionStatsWidget } from './ProfessionStatsWidget'

vi.mock('@/lib/observatoire/etat-profession', async () => {
  const actual = await vi.importActual<typeof import('@/lib/observatoire/etat-profession')>(
    '@/lib/observatoire/etat-profession',
  )
  return {
    ...actual,
    getEtatProfessionSummary: vi.fn(),
  }
})

import { getEtatProfessionSummary } from '@/lib/observatoire/etat-profession'

function fullSummary(): Parameters<
  typeof vi.mocked<typeof getEtatProfessionSummary>
>[0] extends never
  ? never
  : Awaited<ReturnType<typeof getEtatProfessionSummary>> {
  return {
    total: 12000,
    verified: 8400,
    unverified: 3600,
    pending: 0,
    suspended: 0,
    ceased: 0,
    withSirene: 9500,
    sireneActive: 8800,
    sireneClosed: 700,
    veryActive: 4200,
    moderatelyActive: 5300,
    lowActivity: 2500,
    claimed: 1800,
    unclaimed: 10200,
    withFraudFlags: 12,
    lastDhupSyncAt: '2026-05-25T10:00:00Z',
    dhupSyncedLast7d: 247,
  }
}

describe('ProfessionStatsWidget', () => {
  afterEach(() => {
    vi.mocked(getEtatProfessionSummary).mockReset()
  })

  it('rend les 3 KPIs synthétiques avec format FR', async () => {
    vi.mocked(getEtatProfessionSummary).mockResolvedValue(fullSummary())
    const ui = await ProfessionStatsWidget()
    render(ui)
    // Heading
    expect(screen.getByRole('heading', { name: /Profession sur 7 jours/ })).toBeInTheDocument()
    // 3 KPIs : labels
    expect(screen.getByText(/Diagnostiqueurs actifs/)).toBeInTheDocument()
    expect(screen.getByText(/Profession FR totale/)).toBeInTheDocument()
    expect(screen.getByText(/Sync DHUP 7j/)).toBeInTheDocument()
    // Format FR : 12000 → "12 000" (espace insécable Intl)
    // veryActive + moderatelyActive = 4200 + 5300 = 9500
    expect(screen.getByText(/9\s*500/)).toBeInTheDocument()
    expect(screen.getByText(/12\s*000/)).toBeInTheDocument()
    expect(screen.getByText('247')).toBeInTheDocument()
  })

  it('retourne null (pas de rendu) si summary.total === 0', async () => {
    vi.mocked(getEtatProfessionSummary).mockResolvedValue({
      ...fullSummary(),
      total: 0,
    })
    const ui = await ProfessionStatsWidget()
    expect(ui).toBeNull()
  })

  it('retourne null si getEtatProfessionSummary throw', async () => {
    vi.mocked(getEtatProfessionSummary).mockRejectedValue(new Error('supabase down'))
    const ui = await ProfessionStatsWidget()
    expect(ui).toBeNull()
  })

  it('expose le lien "Voir l\'observatoire complet" vers /observatoire', async () => {
    vi.mocked(getEtatProfessionSummary).mockResolvedValue(fullSummary())
    const ui = await ProfessionStatsWidget()
    render(ui)
    const link = screen.getByRole('link', { name: /Voir l['’]observatoire complet/ })
    expect(link).toHaveAttribute('href', '/observatoire')
  })

  it('affiche les hints de ratio (% très actifs, % vérifiés)', async () => {
    vi.mocked(getEtatProfessionSummary).mockResolvedValue(fullSummary())
    const ui = await ProfessionStatsWidget()
    render(ui)
    // verifiedPct = 8400 / 12000 = 70%
    // veryActivePct = 4200 / 12000 = 35%
    expect(screen.getByText(/70 % vérifiés/)).toBeInTheDocument()
    expect(screen.getByText(/35 % très actifs/)).toBeInTheDocument()
  })
})
