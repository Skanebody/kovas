import Link from 'next/link'

type ClaimBannerProps = {
  diagnosticianId: string
}

/**
 * Bannière "Cette fiche n'a pas encore été réclamée".
 * Affichée si claim_status = 'unclaimed'.
 * Lien vers la page de revendication /reclamer-ma-fiche/[id].
 */
export function ClaimBanner({ diagnosticianId }: ClaimBannerProps) {
  return (
    <div className="bg-[#0B1D33] text-white">
      <div className="mx-auto max-w-6xl px-6 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-1 inline-block h-2 w-2 rounded-full bg-amber-400" />
          <div>
            <p className="text-sm font-semibold">
              Cette fiche n&apos;a pas encore été réclamée par son titulaire.
            </p>
            <p className="text-xs text-white/70 mt-0.5">
              Les informations affichées proviennent de sources publiques (Annuaire ADEME, registre
              national). Vous êtes le diagnostiqueur référencé ?
            </p>
          </div>
        </div>
        <Link
          href={`/reclamer-ma-fiche/${diagnosticianId}`}
          className="inline-flex items-center justify-center rounded-full bg-white text-[#0B1D33] px-5 py-2 text-sm font-semibold hover:bg-white/90 transition-colors whitespace-nowrap"
        >
          Réclamer ma fiche
        </Link>
      </div>
    </div>
  )
}
