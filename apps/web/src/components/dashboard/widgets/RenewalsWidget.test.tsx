/**
 * Vitest — RenewalsWidget (Lot B90).
 *
 * Couvre :
 *   - UrgencyBadge : rendu variant `expired` / `critical` / `urgent` / `attention`
 *   - RenewalsWidget : empty state quand toutes les certifs sont à jour
 *   - RenewalsWidget : affiche les certifs nécessitant attention triées par urgence
 *   - RenewalsWidget : badge expiré rendu pour cert expirée
 *
 * Stratégie : `getCurrentUser` est mocké pour fournir un Supabase stub qui
 * répond avec les dates qu'on contrôle. Le widget est un async server
 * component → on await son rendu JSX avant render().
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RenewalsWidget, UrgencyBadge } from './RenewalsWidget'

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth/current-user'

interface MockedSupabaseResponse {
  vstatus?: { cofrac_valid_until: string | null; rcpro_valid_until: string | null } | null
  diag?: { id: string } | null
  org?: Record<string, unknown> | null
}

function buildSupabaseStub({ vstatus, diag, org }: MockedSupabaseResponse) {
  // Builder simple : chaque .from() crée un nouveau chain qui répond
  // selon la table demandée.
  return {
    from: (table: string) => {
      if (table === 'diagnosticians') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: diag ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'diagnostician_verification_status') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: vstatus ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: org ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

describe('UrgencyBadge', () => {
  it('rend "Expiré" pour urgency=expired avec fond destructive', () => {
    render(<UrgencyBadge urgency="expired" />)
    const badge = screen.getByText('Expiré')
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute('style')).toContain('rgb(122, 31, 31)')
  })

  it('rend "Urgent" pour urgency=critical avec fond chartreuse', () => {
    render(<UrgencyBadge urgency="critical" />)
    const badge = screen.getByText('Urgent')
    expect(badge).toBeInTheDocument()
    expect(badge.getAttribute('style')).toContain('212, 245, 66')
  })

  it('rend "Urgent" pour urgency=urgent avec fond chartreuse', () => {
    render(<UrgencyBadge urgency="urgent" />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('rend "Bientôt" pour urgency=attention en outline', () => {
    render(<UrgencyBadge urgency="attention" />)
    const badge = screen.getByText('Bientôt')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toMatch(/border/)
  })
})

describe('RenewalsWidget', () => {
  const mocked = vi.mocked(getCurrentUser)

  afterEach(() => {
    mocked.mockReset()
  })

  it('affiche l’empty state quand les 2 certifications sont safe (>60j)', async () => {
    const future = new Date()
    future.setDate(future.getDate() + 200)
    const iso = future.toISOString().slice(0, 10)

    mocked.mockResolvedValue({
      user: { id: 'u1' } as never,
      profile: { id: 'u1', default_org_id: 'org1' } as never,
      orgId: 'org1',
      supabase: buildSupabaseStub({
        diag: { id: 'd1' },
        vstatus: { cofrac_valid_until: iso, rcpro_valid_until: iso },
      }) as never,
    })

    const ui = await RenewalsWidget()
    render(ui)
    expect(screen.getByText('Tes certifications sont à jour.')).toBeInTheDocument()
  })

  it('affiche les certifs nécessitant attention triées par urgence', async () => {
    const cofracExpired = new Date()
    cofracExpired.setDate(cofracExpired.getDate() - 10) // J-10 → expired
    const rcproSoon = new Date()
    rcproSoon.setDate(rcproSoon.getDate() + 15) // J+15 → urgent (seuil 30j)

    mocked.mockResolvedValue({
      user: { id: 'u1' } as never,
      profile: { id: 'u1', default_org_id: 'org1' } as never,
      orgId: 'org1',
      supabase: buildSupabaseStub({
        diag: { id: 'd1' },
        vstatus: {
          cofrac_valid_until: cofracExpired.toISOString().slice(0, 10),
          rcpro_valid_until: rcproSoon.toISOString().slice(0, 10),
        },
      }) as never,
    })

    const ui = await RenewalsWidget()
    render(ui)

    // Tri attendu : COFRAC (expired) avant RC Pro (urgent)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(2)
    expect(items[0]?.textContent).toContain('COFRAC')
    expect(items[1]?.textContent).toContain('RC Pro')
    expect(screen.getByText('Expiré')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('retombe sur empty state si pas de fiche diagnostician ni colonnes legacy', async () => {
    mocked.mockResolvedValue({
      user: { id: 'u1' } as never,
      profile: { id: 'u1', default_org_id: 'org1' } as never,
      orgId: 'org1',
      supabase: buildSupabaseStub({
        diag: null,
        org: { id: 'org1' },
      }) as never,
    })

    const ui = await RenewalsWidget()
    render(ui)
    expect(screen.getByText('Tes certifications sont à jour.')).toBeInTheDocument()
  })

  it('expose le lien "Gérer mes certifications" vers la page verification', async () => {
    mocked.mockResolvedValue({
      user: { id: 'u1' } as never,
      profile: { id: 'u1', default_org_id: 'org1' } as never,
      orgId: 'org1',
      supabase: buildSupabaseStub({ diag: null, org: null }) as never,
    })
    const ui = await RenewalsWidget()
    render(ui)
    const link = screen.getByRole('link', { name: /Gérer mes certifications/ })
    expect(link).toHaveAttribute('href', '/dashboard/account/verification')
  })
})
