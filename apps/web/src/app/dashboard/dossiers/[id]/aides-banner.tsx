import { ArrowRight, FileText } from 'lucide-react'
import Link from 'next/link'

interface AidesBannerProps {
  dossierId: string
  /** Référence de la mission DPE F/G qui déclenche la bannière. */
  missionReference: string
  /** Classe DPE constatée (F ou G). */
  dpeClass: 'F' | 'G'
  /** Total des aides estimées (€), ou null si annexe pas encore générée. */
  estimatedTotalEur: number | null
}

/**
 * Bannière affichée sur la page de validation/détail d'un dossier dès qu'une
 * mission DPE de classe F ou G y est rattachée. Indique au diagnostiqueur que
 * l'annexe "Aides Rénovation" est (ou sera) générée à l'export et lui propose
 * de la consulter.
 *
 * Ton : sobre, professionnel, vouvoiement. Pas d'emoji ni d'IA mentionnée.
 */
export function AidesBanner({
  dossierId,
  missionReference,
  dpeClass,
  estimatedTotalEur,
}: AidesBannerProps) {
  const totalText =
    estimatedTotalEur !== null
      ? `~${formatEur(roundHundred(estimatedTotalEur))} estimés`
      : "Annexe générée à l'export"

  return (
    <aside
      className="rounded-2xl border border-amber/30 bg-amber/[0.07] p-5 flex flex-wrap items-center gap-4"
      aria-label="Information aides rénovation"
    >
      <div className="size-10 rounded-full bg-amber/15 flex items-center justify-center shrink-0">
        <FileText className="size-5 text-amber" aria-hidden />
      </div>
      <div className="flex-1 min-w-[240px]">
        <p className="font-semibold text-ink">
          DPE {dpeClass} détecté sur {missionReference}
        </p>
        <p className="mt-0.5 text-sm text-ink-soft">
          L'annexe Aides Rénovation France Rénov' a été préparée pour ce dossier — {totalText}.
        </p>
      </div>
      <Link
        href={`/app/dossiers/${dossierId}/aides`}
        className="inline-flex items-center gap-1.5 rounded-pill border border-rule bg-paper px-4 py-2 text-sm font-semibold text-ink transition-all hover:-translate-y-px"
      >
        Consulter l'annexe <ArrowRight className="size-4" />
      </Link>
    </aside>
  )
}

function formatEur(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(amount))} €`
}

function roundHundred(n: number): number {
  return Math.round(n / 100) * 100
}
