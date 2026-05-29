import type { ReactNode } from 'react'
import { AnalysImmoLogo, LicielLogo, ObbcLogo, OrisLogo } from './CompatLogos'

interface CompatLogo {
  name: string
  /** Composant logo rendu dans la card. */
  Logo: (props: { className?: string }) => ReactNode
  meta: string
}

// Les 4 logiciels du marché FR du diagnostic couverts par KOVAS (Benjamin
// 2026-05-28). Ce sont les 4 cités partout sur le site — pas d'autre éditeur.
const COMPAT_LOGOS: CompatLogo[] = [
  { name: 'Liciel', Logo: LicielLogo, meta: 'Leader marché' },
  { name: 'OBBC', Logo: ObbcLogo, meta: 'WinDiagnostics' },
  { name: 'AnalysImmo', Logo: AnalysImmoLogo, meta: 'Atlibitum' },
  { name: 'ORIS', Logo: OrisLogo, meta: 'Diagnostic immo' },
]

/**
 * Section "Compagnon de votre logiciel actuel" — grid des 4 logiciels du
 * marché FR du diagnostic couverts par KOVAS (Liciel, OBBC, AnalysImmo, ORIS).
 *
 * Stratégie logos détaillée dans `apps/web/public/logos/compat/MANIFEST.md` :
 *   - Liciel : SVG officiel récupéré sur liciel.fr (logo figuratif rouge)
 *   - 7 autres : wordmarks SVG inline en typo KOVAS (Urbanist 600)
 *
 * Note juridique : usage informatif de marques tierces pour signaler une
 * compatibilité réelle (art. L.713-3 CPI + CJUE BMW c/ Deenik C-63/97).
 * Disclaimer en pied de section.
 *
 * Layout aligné sur le pattern transversal home (border-t + sage 60% + padding
 * 20-28 vh) pour s'intégrer harmonieusement entre TrustBar et 3 promesses.
 */
export function CompatGrid() {
  return (
    <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
      <div className="max-w-[1240px] mx-auto text-center">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
          Écosystème · compatibilité native
        </p>
        <h2
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-[820px] mx-auto mb-6"
          style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
        >
          Compagnon de <span className="font-serif italic font-normal">ton logiciel actuel.</span>
        </h2>
        <p className="text-base sm:text-lg text-[#0F1419]/68 max-w-xl mx-auto leading-relaxed mb-14">
          Tes données arrivent prêtes à l&apos;import dans les 8 logiciels métier majeurs du marché
          français.
        </p>

        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[1000px] mx-auto">
          {COMPAT_LOGOS.map(({ name, Logo, meta }) => (
            <li
              key={name}
              className="bg-paper border border-[#0F1419]/[0.08] rounded-[24px] p-7 px-5 flex flex-col items-center justify-center gap-3 hover:border-[#0F1419]/35 hover:-translate-y-0.5 transition-all duration-200 min-h-[120px] text-[#0F1419]"
            >
              <div className="flex items-center justify-center h-8 max-w-full overflow-hidden">
                <Logo />
              </div>
              <span className="font-mono text-[11px] text-[#0F1419]/55 uppercase tracking-[0.1em]">
                {meta}
              </span>
            </li>
          ))}
        </ul>

        {/* Disclaimer juridique — citation factuelle de marques tierces (L.713-3 CPI) */}
        <p className="mt-10 max-w-[680px] mx-auto font-mono text-[11px] text-[#0F1419]/40 leading-relaxed">
          Les marques citées appartiennent à leurs propriétaires respectifs. KOVAS n&apos;est ni
          affilié à, ni endossé par ces éditeurs ; la mention de compatibilité signale une
          interopérabilité technique.
        </p>
      </div>
    </section>
  )
}
