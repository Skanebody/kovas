/**
 * Vitest — SeoScoreWidget (Lot B90).
 *
 * Couvre :
 *   - empty state quand pas de fiche annuaire réclamée
 *   - rendu du score 0-100 + bucket pour fiche complète
 *   - recommandation "photo" générée si photo_url absente
 *   - recommandation "bio" générée si bio courte
 *   - lien "Voir ma fiche publique" construit avec slug/dept/city
 *
 * Stratégie : mock de `getCurrentUser` qui fournit un Supabase stub renvoyant
 * la fiche `diagnosticians` souhaitée. Le widget est async server component
 * → on await son rendu JSX avant render().
 */

import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SeoScoreWidget } from './SeoScoreWidget'

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth/current-user'

interface FicheInput {
  id?: string
  slug?: string | null
  city_slug?: string | null
  dept_code?: string | null
  city?: string | null
  photo_url?: string | null
  bio?: string | null
  gmb_rating?: number | null
  gmb_review_count?: number | null
  certif_valid_count?: number | null
  updated_at?: string | null
}

function buildSupabaseStub(fiche: FicheInput | null) {
  return {
    from: (table: string) => {
      if (table === 'diagnosticians') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: fiche ?? null, error: null }),
            }),
          }),
        }
      }
      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

function mockUserWithFiche(fiche: FicheInput | null) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    user: { id: 'u1' } as never,
    profile: { id: 'u1', default_org_id: 'org1' } as never,
    orgId: 'org1',
    supabase: buildSupabaseStub(fiche) as never,
  })
}

describe('SeoScoreWidget', () => {
  afterEach(() => {
    vi.mocked(getCurrentUser).mockReset()
  })

  it('affiche l’empty state quand le user n’a pas de fiche annuaire', async () => {
    mockUserWithFiche(null)
    const ui = await SeoScoreWidget()
    render(ui)
    expect(
      screen.getByText(/Réclame ta fiche annuaire pour activer le score SEO/),
    ).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Trouver ma fiche/ })
    expect(link).toHaveAttribute('href', '/trouver-un-diagnostiqueur')
  })

  it('affiche le score numérique + un bucket pour une fiche complète', async () => {
    mockUserWithFiche({
      id: 'd1',
      slug: 'jean-dupont',
      dept_code: '75',
      city_slug: 'paris',
      city: 'Paris',
      photo_url: 'https://example.com/photo.jpg',
      bio: 'Diagnostiqueur certifié à Paris depuis 12 ans, spécialisé en DPE et amiante. Expertise sur tous les types de biens résidentiels et tertiaires.',
      gmb_rating: 4.7,
      gmb_review_count: 25,
      certif_valid_count: 6,
      updated_at: new Date().toISOString(),
    })
    const ui = await SeoScoreWidget()
    render(ui)

    // Le score est rendu dans un <span> + "/ 100 · Bucket" — la valeur exacte
    // dépend de la pondération de l'algo (bounce_rate/time null → fallback
    // neutre). On vérifie simplement qu'un bucket est rendu.
    expect(screen.getByText(/\/ 100 · /)).toBeInTheDocument()
  })

  it('génère une recommandation "photo" si photo_url manque', async () => {
    mockUserWithFiche({
      id: 'd1',
      slug: 'jean-dupont',
      dept_code: '75',
      city_slug: 'paris',
      photo_url: null, // ← manque
      bio: 'Bio courte mais OK pour le test.',
      gmb_review_count: 10,
      certif_valid_count: 5,
      updated_at: new Date().toISOString(),
    })
    const ui = await SeoScoreWidget()
    render(ui)
    expect(screen.getByText('Ajoute une photo professionnelle')).toBeInTheDocument()
  })

  it('génère une recommandation "bio" si bio trop courte', async () => {
    mockUserWithFiche({
      id: 'd1',
      slug: 'jean-dupont',
      dept_code: '75',
      city_slug: 'paris',
      photo_url: 'https://example.com/photo.jpg',
      bio: 'Trop court.', // ← <150 char
      gmb_review_count: 10,
      certif_valid_count: 5,
      updated_at: new Date().toISOString(),
    })
    const ui = await SeoScoreWidget()
    render(ui)
    expect(screen.getByText('Enrichis ta bio')).toBeInTheDocument()
  })

  it('expose le lien "Voir ma fiche publique" avec slug/dept/city', async () => {
    mockUserWithFiche({
      id: 'd1',
      slug: 'jean-dupont',
      dept_code: '75',
      city_slug: 'paris',
      photo_url: 'https://example.com/photo.jpg',
      bio: 'Bio assez longue pour passer le seuil de 50 caractères et donc OK pour le widget.',
      gmb_review_count: 10,
      certif_valid_count: 5,
      updated_at: new Date().toISOString(),
    })
    const ui = await SeoScoreWidget()
    render(ui)
    const link = screen.getByRole('link', { name: /Voir ma fiche publique/ })
    expect(link).toHaveAttribute('href', '/trouver-un-diagnostiqueur/75/paris/jean-dupont')
  })
})
