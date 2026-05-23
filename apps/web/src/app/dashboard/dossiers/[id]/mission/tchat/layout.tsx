/**
 * KOVAS — Layout du mode mission tchat IA (FIX-JJ).
 *
 * Layout segmental qui rend la mission en mode "full screen mission mode" :
 *
 *   - Pas de sidebar dashboard (cachée via .mission-fullscreen body class côté client)
 *   - Pas de footer global
 *   - Background sage clair pour conserver la cohérence visuelle (mode jour)
 *     ou navy profond optionnel (mode soir terrain)
 *   - Header minimal rendu par l'interface elle-même (logo + client + actions)
 *
 * Note Next.js : ce layout est nested DANS le `dashboard/layout.tsx` parent qui
 * rend la sidebar. On utilise un wrapper `data-mission-fullscreen="true"` qui
 * applique en CSS un `:has` selector au niveau body pour masquer la sidebar
 * + ajuster le main full-bleed. C'est un compromis pragmatique évitant un
 * route group `(mission)` à la racine app (qui aurait cassé l'auth garde du
 * dashboard layout).
 *
 * Authority : CLAUDE.md §10 (mode offline complet) + spec FIX-JJ.
 */

import type { ReactNode } from 'react'

export default function MissionTchatLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-mission-fullscreen="true"
      className="fixed inset-0 z-[60] flex flex-col bg-sage overflow-hidden"
    >
      {children}
    </div>
  )
}
