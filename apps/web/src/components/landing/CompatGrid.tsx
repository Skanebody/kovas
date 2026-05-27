import type { ReactNode } from 'react'
import {
  AnalysImmoLogo,
  ArgosLogo,
  DpeWinLogo,
  GestionDiagLogo,
  ImDiagLogo,
  LicielLogo,
  OrisLogo,
  WinDiagnosticsLogo,
} from './CompatLogos'

interface CompatLogo {
  name: string
  /** Composant logo rendu dans la card. */
  Logo: (props: { className?: string }) => ReactNode
  meta: string
}

const COMPAT_LOGOS: CompatLogo[] = [
  { name: 'Liciel', Logo: LicielLogo, meta: 'Leader marché · 50%' },
  { name: 'AnalysImmo', Logo: AnalysImmoLogo, meta: 'Atlibitum' },
  { name: 'WinDiagnostics', Logo: WinDiagnosticsLogo, meta: 'Top 3' },
  { name: 'GestionDiag', Logo: GestionDiagLogo, meta: 'CRM & diag' },
  { name: "Im'Diag", Logo: ImDiagLogo, meta: 'Multi-modules' },
  { name: 'ORIS', Logo: OrisLogo, meta: 'Diagnostic immo' },
  { name: 'Argos', Logo: ArgosLogo, meta: 'Ithaque · Audit' },
  { name: 'DPEWin', Logo: DpeWinLogo, meta: 'Perrenoud' },
]

/**
 * Section "Compagnon de votre logiciel actuel" — grid 4×2 (2×4 mobile) avec 8
 * logos vectoriels des éditeurs métier français du diagnostic.
 *
 * Stratégie logos détaillée dans `apps/web/public/logos/compat/MANIFEST.md` :
 *   - Liciel : SVG officiel récupéré sur liciel.fr (logo figuratif rouge)
 *   - 7 autres : wordmarks SVG inline en typo KOVAS (Urbanist 600)
 *
 * Note juridique : usage informatif de marques tierces pour signaler une
 * compatibilité réelle (art. L.713-3 CPI). Disclaimer en pied de section.
 */
export function CompatGrid() {
  return (
    <section className="px-5 sm:px-12 py-16 sm:py-24 max-w-[1240px] mx-auto text-center">
      <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-4">
        Écosystème
      </p>
      <p className="text-[20px] sm:text-[26px] text-[#0F1419]/72 mb-12 font-normal max-w-[640px] mx-auto leading-snug">
        <strong className="text-[#0F1419] font-semibold">Compagnon de ton logiciel actuel.</strong>{' '}
        Compatible avec les 8 logiciels métier majeurs du marché français.
      </p>

      <ul className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[1000px] mx-auto">
        {COMPAT_LOGOS.map(({ name, Logo, meta }) => (
          <li
            key={name}
            className="bg-white border border-[#0F1419]/[0.08] rounded-[24px] p-7 px-5 flex flex-col items-center justify-center gap-3 hover:border-[#0F1419]/35 hover:-translate-y-0.5 transition-all duration-200 min-h-[120px] text-[#0F1419]"
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

      {/* Disclaimer juridique — citation factuelle de marques tierces */}
      <p className="mt-8 max-w-[640px] mx-auto font-mono text-[11px] text-[#0F1419]/35 leading-relaxed">
        Les marques citées appartiennent à leurs propriétaires respectifs. KOVAS n'est ni affilié à,
        ni endossé par ces éditeurs ; la mention de compatibilité signale une interopérabilité
        technique.
      </p>
    </section>
  )
}
