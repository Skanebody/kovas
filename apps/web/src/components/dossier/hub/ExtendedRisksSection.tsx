import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ArgilesRisk, Cavite, PPRIResult, RadonRisk } from '@/lib/opendata/georisques'
import { AlertTriangle, Droplets, ExternalLink, Layers, Radio } from 'lucide-react'
import Link from 'next/link'

/**
 * Section dossier — Risques étendus (Géorisques étendu : Radon / PPRI /
 * Argiles / Cavités).
 *
 * Affichage sobre, sans IA, mentionnant la source officielle État.
 * Si toutes les sources sont vides, retourne null (pas de pollution visuelle).
 *
 * Authority : docs/data-gouv-opportunities.md §3 Top #3.
 */

interface ExtendedRisksSectionProps {
  radon: RadonRisk | null
  ppri: ReadonlyArray<PPRIResult>
  argiles: ArgilesRisk | null
  cavites: ReadonlyArray<Cavite>
  /** URL "Voir le détail risques" (page dédiée fiche dossier). */
  dossierRisquesHref?: string | null
}

function radonBadgeVariant(classe: 1 | 2 | 3): 'green' | 'yellow' | 'red' {
  if (classe === 3) return 'red'
  if (classe === 2) return 'yellow'
  return 'green'
}

function argilesBadgeVariant(alea: 'faible' | 'moyen' | 'fort'): 'green' | 'yellow' | 'red' {
  if (alea === 'fort') return 'red'
  if (alea === 'moyen') return 'yellow'
  return 'green'
}

export function ExtendedRisksSection({
  radon,
  ppri,
  argiles,
  cavites,
  dossierRisquesHref,
}: ExtendedRisksSectionProps) {
  const hasAnyContent = radon !== null || ppri.length > 0 || argiles !== null || cavites.length > 0
  if (!hasAnyContent) return null

  return (
    <Card variant="flat" padding="default" id="extended-risks" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0F1419]">Risques étendus</h2>
          <p className="text-[12px] text-[#0F1419]/72 mt-0.5">
            Informations complémentaires à l&apos;ERP réglementaire.
          </p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Géorisques
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {/* ── Radon ────────────────────────────────────────────────── */}
        {radon ? (
          <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Radio className="size-4 text-[#0F1419]/72 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-[#0F1419]">Radon</p>
                  <Badge variant={radonBadgeVariant(radon.classe)}>Classe {radon.classe}</Badge>
                </div>
                <p className="mt-1 text-[12px] text-[#0F1419]/82">
                  {radon.classe === 3
                    ? 'Information acquéreur/locataire obligatoire.'
                    : radon.classe === 2
                      ? 'Potentiel modéré, vigilance recommandée.'
                      : 'Potentiel faible.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── PPRI ─────────────────────────────────────────────────── */}
        {ppri.length > 0 ? (
          <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Droplets className="size-4 text-[#0F1419]/72 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-[#0F1419]">PPRI</p>
                  <Badge variant="yellow">
                    {ppri.length} plan{ppri.length > 1 ? 's' : ''} applicable
                    {ppri.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <ul className="mt-1.5 space-y-1">
                  {ppri.slice(0, 3).map((p) => (
                    <li key={p.id} className="text-[12px] text-[#0F1419]/82 leading-snug">
                      <span>{p.libelle}</span>
                      {p.etat !== 'inconnu' ? (
                        <span className="text-[#0F1419]/55"> · {p.etat}</span>
                      ) : null}
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 inline-flex items-center text-[#0F1419]/55 hover:text-[#0F1419] underline"
                          aria-label={`Voir la fiche officielle ${p.libelle}`}
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Argiles ──────────────────────────────────────────────── */}
        {argiles ? (
          <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Layers className="size-4 text-[#0F1419]/72 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-[#0F1419]">
                    Retrait-gonflement argiles
                  </p>
                  <Badge variant={argilesBadgeVariant(argiles.alea)}>Aléa {argiles.alea}</Badge>
                </div>
                <p className="mt-1 text-[12px] text-[#0F1419]/82">
                  {argiles.obligationIAL
                    ? 'Information acquéreur/locataire obligatoire (loi ELAN).'
                    : 'Pas d’obligation IAL.'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Cavités ──────────────────────────────────────────────── */}
        {cavites.length > 0 ? (
          <div className="rounded-md border border-[#0F1419]/[0.08] bg-paper px-3 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-[#0F1419]/72 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[13px] font-semibold text-[#0F1419]">Cavités souterraines</p>
                  <Badge variant="yellow">
                    {cavites.length} connue{cavites.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <p className="mt-1 text-[12px] text-[#0F1419]/82">
                  Dans un rayon proche de l&apos;adresse.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-[#0F1419]/55">
          Données officielles Géorisques.gouv.fr — État.
        </p>
        {dossierRisquesHref ? (
          <Link
            href={dossierRisquesHref}
            className="text-[12px] text-[#0F1419] underline-offset-2 hover:underline"
          >
            Voir le détail
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
