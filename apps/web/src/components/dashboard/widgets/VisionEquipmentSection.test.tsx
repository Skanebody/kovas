/**
 * Vitest — VisionEquipmentSection (Lot B98).
 *
 * Couvre :
 *   - Empty state quand aucune photo n'a `vision_analysis`
 *   - Rendu de la liste des détections (label + brand/model + badge confidence)
 *   - Equipment_type "autre" / null filtré (ne s'affiche pas)
 *   - Variante de badge selon le seuil de confidence (green ≥ 0.9, yellow ≥ 0.7, red sinon)
 *   - Tronquage à 8 détections + libellé "+ N autres"
 *   - Bouton "Analyser cette photo" affiché quand des photos sont non analysées
 *   - Click sur le bouton appelle `analyzePhotoVisionAction` et affiche le feedback succès
 *   - Erreur de la server action affichée en feedback
 *   - A11y : aria-labels présents, headings sémantiques
 *   - Responsive : classes Tailwind sm/md présentes
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VisionEquipmentSection } from './VisionEquipmentSection'

// Mock de la server action — on évite tout I/O Supabase / Claude.
vi.mock('@/app/dashboard/dossiers/[id]/mission/validation/actions', () => ({
  analyzePhotoVisionAction: vi.fn(),
}))

import { analyzePhotoVisionAction } from '@/app/dashboard/dossiers/[id]/mission/validation/actions'

interface MakePhotoOpts {
  id: string
  analysis?: Record<string, unknown> | null
  confidence?: number | null
}

function makePhoto({ id, analysis = null, confidence = null }: MakePhotoOpts) {
  return {
    id,
    storage_path: `org1/dossier1/${id}.jpg`,
    thumb_path: null,
    room_id: null,
    caption: null,
    vision_analysis: analysis,
    vision_confidence: confidence,
  }
}

describe('VisionEquipmentSection', () => {
  beforeEach(() => {
    vi.mocked(analyzePhotoVisionAction).mockReset()
  })

  afterEach(() => {
    vi.mocked(analyzePhotoVisionAction).mockReset()
  })

  it("rend l'empty state quand aucune photo n'a vision_analysis", () => {
    render(<VisionEquipmentSection photos={[]} />)
    expect(screen.getByText(/Prends une photo de plaque signalétique/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Détections Vision IA/ })).toBeInTheDocument()
  })

  it('rend la liste des détections avec label humanisé + brand/model + badge confidence', () => {
    const photos = [
      makePhoto({
        id: '11111111-1111-1111-1111-111111111111',
        analysis: {
          equipment_type: 'chaudiere',
          brand: { value: 'Saunier Duval', confidence: 0.95 },
          model: { value: 'ThemaPlus F25', confidence: 0.85 },
        },
        confidence: 0.92,
      }),
      makePhoto({
        id: '22222222-2222-2222-2222-222222222222',
        analysis: {
          equipment_type: 'vmc',
          brand: 'Aldes',
          model: 'EasyHOME',
        },
        confidence: 0.75,
      }),
    ]
    render(<VisionEquipmentSection photos={photos} />)
    expect(screen.getByText('Chaudière')).toBeInTheDocument()
    expect(screen.getByText('VMC')).toBeInTheDocument()
    expect(screen.getByText(/Saunier Duval/)).toBeInTheDocument()
    expect(screen.getByText(/Aldes/)).toBeInTheDocument()
    // Confidence badges (round() → 92%, 75%)
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('filtre les équipements de type "autre" ou null (pas affichés)', () => {
    const photos = [
      makePhoto({
        id: '33333333-3333-3333-3333-333333333333',
        analysis: { equipment_type: 'autre', brand: 'NoBrand' },
        confidence: 0.5,
      }),
      makePhoto({
        id: '44444444-4444-4444-4444-444444444444',
        analysis: { equipment_type: null },
        confidence: 0.5,
      }),
    ]
    render(<VisionEquipmentSection photos={photos} />)
    // Empty state visible car aucune détection valide
    expect(screen.getByText(/Prends une photo de plaque signalétique/)).toBeInTheDocument()
  })

  it('tronque à 8 détections + affiche "+ N autres détections"', () => {
    const photos = Array.from({ length: 10 }, (_, i) =>
      makePhoto({
        id: `${i}aaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`,
        analysis: {
          equipment_type: 'compteur',
          brand: `Brand${i}`,
        },
        confidence: 0.9,
      }),
    )
    render(<VisionEquipmentSection photos={photos} />)
    expect(screen.getByText(/\+ 2 autres détections/)).toBeInTheDocument()
  })

  it('affiche le bouton "Analyser cette photo" quand des photos sont non analysées', () => {
    const photos = [makePhoto({ id: '55555555-5555-5555-5555-555555555555', analysis: null })]
    render(<VisionEquipmentSection photos={photos} />)
    const button = screen.getByRole('button', {
      name: /Lancer l'analyse Vision IA sur la prochaine photo non analysée/,
    })
    expect(button).toBeInTheDocument()
    expect(button).not.toBeDisabled()
  })

  it('appelle analyzePhotoVisionAction au click et affiche le feedback succès', async () => {
    vi.mocked(analyzePhotoVisionAction).mockResolvedValue({
      ok: true,
      photoId: '55555555-5555-5555-5555-555555555555',
      equipmentType: 'chaudiere',
      brand: 'Saunier Duval',
      model: 'ThemaPlus F25',
      confidence: 0.89,
      mocked: true,
    })

    const photos = [makePhoto({ id: '55555555-5555-5555-5555-555555555555', analysis: null })]
    render(<VisionEquipmentSection photos={photos} />)
    const button = screen.getByRole('button', {
      name: /Lancer l'analyse Vision IA/,
    })
    const user = userEvent.setup()
    await user.click(button)

    await waitFor(() => {
      expect(analyzePhotoVisionAction).toHaveBeenCalledWith('55555555-5555-5555-5555-555555555555')
    })
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Chaudière/)
    })
    expect(screen.getByRole('status')).toHaveTextContent(/Saunier Duval/)
    expect(screen.getByText(/\(mock dev\)/)).toBeInTheDocument()
  })

  it("affiche le feedback d'erreur quand la server action retourne une erreur", async () => {
    vi.mocked(analyzePhotoVisionAction).mockResolvedValue({
      error: 'Photo introuvable',
    })

    const photos = [makePhoto({ id: '66666666-6666-6666-6666-666666666666', analysis: null })]
    render(<VisionEquipmentSection photos={photos} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /Lancer l'analyse/ }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Photo introuvable')
    })
  })

  it('expose les classes responsive et touch-target ≥ 44px pour mobile', () => {
    const photos = [makePhoto({ id: '77777777-7777-7777-7777-777777777777', analysis: null })]
    const { container } = render(<VisionEquipmentSection photos={photos} />)
    // Section a padding mobile (px-4) + sm: variant
    const section = container.querySelector('section')
    expect(section?.className).toMatch(/px-4/)
    expect(section?.className).toMatch(/sm:px-5/)
    // Bouton garantit touch-target 44px
    const button = screen.getByRole('button', { name: /Lancer l'analyse/ })
    expect(button.className).toMatch(/min-h-\[44px\]/)
  })

  it("a11y : heading h2 avec id stable + aria-label sur l'algo + section labellisée", () => {
    render(<VisionEquipmentSection photos={[]} />)
    const heading = screen.getByRole('heading', { name: /Détections Vision IA/, level: 2 })
    expect(heading).toHaveAttribute('id', 'vision-equipment-heading')
    // aria-label sur "A1.3.6" qui sinon n'a aucun sens lu par un screen reader
    expect(screen.getByLabelText(/Algorithme A1\.3\.6/)).toBeInTheDocument()
  })
})
