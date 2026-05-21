import type { ReactNode } from 'react'

/**
 * Layout commun aux 9 routes publiques du pack juridique KOVAS.
 *
 * Volontairement minimal : il ne gère que le fond de page (sage `#F5F7F4`) et
 * impose la pile typographique. Le header sticky, le titre, le bandeau version
 * et le TOC sont pris en charge par le composant `<LegalRouteShell>` rendu par
 * chaque page (pour disposer du contexte document : titre, version, TOC).
 *
 * On s'abstient ici d'imposer une bordure ou une largeur fixe — chaque shell
 * gère son propre conteneur 3 colonnes (TOC sticky desktop + corps + spacer).
 */
export default function LegalLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#F5F7F4] text-[#0F1419] font-sans antialiased">{children}</div>
  )
}
