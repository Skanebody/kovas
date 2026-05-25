/**
 * KOVAS — GlossaryTerm (Lot B67).
 *
 * Helper Server Component qui résout un terme depuis le glossaire centralisé
 * `@/lib/glossary/diagnostic-terms` et instancie `<InfoTooltip>` avec les
 * données pré-remplies.
 *
 * Usage minimal :
 *   <GlossaryTerm term="DPE" />
 *
 * Surcharge possible du label affiché (ex. minuscules dans une phrase) :
 *   <GlossaryTerm term="passoire-thermique">passoire thermique</GlossaryTerm>
 *
 * Si le terme est absent du glossaire, le composant rend simplement le texte
 * brut (sans tooltip) pour ne JAMAIS casser le rendu de la page. Une console
 * `warn` côté server signale l'oubli au développement.
 */

import { InfoTooltip } from '@/components/ui/info-tooltip'
import { getGlossaryEntry } from '@/lib/glossary/diagnostic-terms'
import type { ReactNode } from 'react'

export interface GlossaryTermProps {
  /** Clé du glossaire (insensible casse/accents). */
  readonly term: string
  /** Texte personnalisé à afficher (sinon : `term`). */
  readonly children?: ReactNode
  /** Classes additionnelles propagées au wrapper du tooltip. */
  readonly className?: string
}

export function GlossaryTerm({ term, children, className }: GlossaryTermProps) {
  const entry = getGlossaryEntry(term)

  if (!entry) {
    // Fallback gracieux : on rend le texte brut sans tooltip.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        `[GlossaryTerm] Terme inconnu : "${term}". Ajoutez l'entrée dans apps/web/src/lib/glossary/diagnostic-terms.ts.`,
      )
    }
    return <>{children ?? term}</>
  }

  return (
    <InfoTooltip
      term={term}
      title={entry.title}
      definition={entry.definition}
      source={entry.source}
      className={className}
    >
      {children ?? term}
    </InfoTooltip>
  )
}
