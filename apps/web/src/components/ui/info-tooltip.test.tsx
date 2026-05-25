/**
 * Vitest — InfoTooltip (Lot B67).
 *
 * Couvre :
 *   - rendu du terme avec underline pointillé
 *   - bouton info accessible avec aria-label dynamique
 *   - focus déclenche l'ouverture (clavier)
 *   - clic toggle l'ouverture (compat mobile/tap)
 *   - source rendue en `target="_blank" rel="noopener"`
 *   - ESC ferme le tooltip
 *   - rendu sans source (link absent)
 */

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { InfoTooltip } from './info-tooltip'

describe('InfoTooltip', () => {
  it('rend le terme avec underline pointillé', () => {
    render(
      <InfoTooltip
        term="DPE"
        definition="Diagnostic de Performance Énergétique obligatoire en France."
      />,
    )
    const termSpan = screen.getByText('DPE')
    expect(termSpan).toBeInTheDocument()
    // Tailwind applique `decoration-dotted` via une classe utilitaire.
    expect(termSpan.className).toMatch(/decoration-dotted/)
  })

  it('expose un bouton accessible avec aria-label dynamique', () => {
    render(<InfoTooltip term="COFRAC" definition="Comité français d’accréditation." />)
    const button = screen.getByRole('button', {
      name: 'En savoir plus sur COFRAC',
    })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('ouvre le tooltip au clic et expose role="tooltip"', () => {
    render(<InfoTooltip term="ERP" definition="État des Risques et Pollutions joint à la vente." />)
    const button = screen.getByRole('button', { name: /ERP/i })
    fireEvent.click(button)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toBeInTheDocument()
    expect(tooltip).toHaveTextContent('État des Risques et Pollutions')
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('rend la source en lien externe sécurisé', () => {
    render(
      <InfoTooltip
        term="DPE"
        definition="Document obligatoire."
        source={{
          label: 'Légifrance · L126-26',
          url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043811449',
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /DPE/i }))
    const link = screen.getByRole('link', { name: /Légifrance/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel') ?? '').toContain('noopener')
    expect(link).toHaveAttribute(
      'href',
      'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043811449',
    )
  })

  it('ferme le tooltip avec la touche Escape', () => {
    render(
      <InfoTooltip
        term="RGE"
        definition="Reconnu Garant de l’Environnement, qualification artisans."
      />,
    )
    const button = screen.getByRole('button', { name: /RGE/i })
    fireEvent.click(button)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('s’ouvre au focus clavier du bouton (accessibilité)', () => {
    render(<InfoTooltip term="CREP" definition="Constat de Risque d’Exposition au Plomb." />)
    const button = screen.getByRole('button', { name: /CREP/i })
    act(() => {
      button.focus()
    })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })

  it('n’affiche pas de lien source quand source est absent', () => {
    render(<InfoTooltip term="GES" definition="Émissions de gaz à effet de serre." />)
    fireEvent.click(screen.getByRole('button', { name: /GES/i }))
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
