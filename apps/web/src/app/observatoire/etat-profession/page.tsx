/**
 * /observatoire/etat-profession — État de la profession diagnostic FR.
 *
 * Page publique (Game Changer 4 acqui-target, REFONTE-ACQUI-TARGET-V2 §6.4)
 * qui consolide les données du référentiel diagnostiqueurs KOVAS et expose
 * en transparence la santé de la profession :
 *   - Total DHUP officiel
 *   - Cross-validation SIRENE (% siret actif)
 *   - Activity score (% diagnostiqueurs actifs vs dormants)
 *   - Distribution validation_status (vérifié vs ghost vs suspendu)
 *   - Top 10 départements par densité
 *
 * Toutes les valeurs viennent de vues SQL agrégées (`v_etat_profession_*`),
 * aucune PII exposée.
 *
 * Cache : revalidate 1h (donnée DHUP changeant peu).
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import {
  computeRatios,
  getEtatProfessionSummary,
  getEtatProfessionTopDepts,
} from '@/lib/observatoire/etat-profession'
import { buildMetadata } from '@/lib/seo/metadata'

export const revalidate = 3600

export const metadata = buildMetadata({
  title: 'État de la profession du diagnostic immobilier',
  description:
    "Statistiques publiques sur les diagnostiqueurs immobiliers certifiés en France : DHUP officiel, cross-validation SIRENE, taux d'activité, distribution départementale.",
  path: '/observatoire/etat-profession',
})

function formatDateFr(iso: string | null): string {
  if (!iso) return 'jamais'
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatPct(value: number): string {
  return `${value}%`
}

const DEPT_LABELS: Record<string, string> = {
  '75': 'Paris',
  '13': 'Bouches-du-Rhône',
  '69': 'Rhône',
  '33': 'Gironde',
  '31': 'Haute-Garonne',
  '59': 'Nord',
  '67': 'Bas-Rhin',
  '44': 'Loire-Atlantique',
  '76': 'Seine-Maritime',
  '34': 'Hérault',
  '38': 'Isère',
  '35': 'Ille-et-Vilaine',
  '06': 'Alpes-Maritimes',
  '92': 'Hauts-de-Seine',
  '93': 'Seine-Saint-Denis',
  '94': 'Val-de-Marne',
  '78': 'Yvelines',
  '95': "Val-d'Oise",
  '91': 'Essonne',
  '77': 'Seine-et-Marne',
}

export default async function EtatProfessionPage() {
  const [summary, topDepts] = await Promise.all([
    getEtatProfessionSummary(),
    getEtatProfessionTopDepts(10),
  ])
  const ratios = computeRatios(summary)
  const hasData = summary.total > 0

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <PublicHeader />

      <main className="flex-1">
        {/* HERO */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Observatoire KOVAS
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05] max-w-3xl"
              style={{ fontSize: 'clamp(40px, 6vw, 88px)' }}
            >
              <span className="font-serif italic font-normal">État</span> de la profession.
            </h1>
            <p className="mt-8 max-w-2xl text-base sm:text-lg text-[#0F1419]/72 leading-relaxed">
              Le diagnostic immobilier français en chiffres. Données issues du référentiel DHUP
              officiel, recoupées avec SIRENE et le scoring d&apos;activité interne KOVAS. Mise à
              jour quotidienne via cron.
            </p>
            {summary.lastDhupSyncAt ? (
              <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
                Dernière synchronisation DHUP — {formatDateFr(summary.lastDhupSyncAt)}
              </p>
            ) : null}
          </div>
        </section>

        {/* KPI HERO — 3 chiffres signature */}
        {hasData ? (
          <section className="px-5 sm:px-12 py-12 sm:py-16 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
            <div className="max-w-[1240px] mx-auto grid sm:grid-cols-3 gap-10">
              <div className="space-y-2">
                <p
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(56px, 6vw, 100px)' }}
                >
                  {summary.total.toLocaleString('fr-FR')}
                </p>
                <p className="text-sm font-medium text-[#0F1419]/80 leading-snug">
                  Diagnostiqueurs certifiés référencés
                </p>
                <p className="text-[11px] text-[#0F1419]/55 italic">
                  Source : Direction de l&apos;Habitat, de l&apos;Urbanisme et des Paysages (DHUP).
                </p>
              </div>
              <div className="space-y-2">
                <p
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(56px, 6vw, 100px)' }}
                >
                  {formatPct(ratios.sireneActivePct)}
                </p>
                <p className="text-sm font-medium text-[#0F1419]/80 leading-snug">
                  Avec SIRET en activité confirmée
                </p>
                <p className="text-[11px] text-[#0F1419]/55 italic">
                  Cross-validation INSEE Sirene mise à jour mensuellement.
                </p>
              </div>
              <div className="space-y-2">
                <p
                  className="font-serif italic font-normal text-[#0F1419] leading-none"
                  style={{ fontSize: 'clamp(56px, 6vw, 100px)' }}
                >
                  {formatPct(ratios.veryActivePct)}
                </p>
                <p className="text-sm font-medium text-[#0F1419]/80 leading-snug">
                  Activité élevée mesurée (score ≥ 0,60)
                </p>
                <p className="text-[11px] text-[#0F1419]/55 italic">
                  Indicateur composite : avis Google, mises à jour fiche, leads traités.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        {/* DISTRIBUTION VÉRIFICATION */}
        {hasData ? (
          <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08]">
            <div className="max-w-[1240px] mx-auto space-y-10">
              <div className="space-y-3 max-w-2xl">
                <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                  Distribution
                </p>
                <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                  Quatre catégories pour comprendre la profession.
                </h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <DistributionCard
                  label="Vérifiés"
                  value={summary.verified}
                  total={summary.total}
                  description="Pipeline COFRAC + SIRENE + RC Pro validés sur les 12 derniers mois."
                />
                <DistributionCard
                  label="Non vérifiés"
                  value={summary.unverified}
                  total={summary.total}
                  description="Présents au DHUP mais non encore croisés avec sources externes."
                />
                <DistributionCard
                  label="Suspendus"
                  value={summary.suspended}
                  total={summary.total}
                  description="Anomalies détectées (rapports frauduleux, identité douteuse) — exclusion temporaire."
                />
                <DistributionCard
                  label="Cessations"
                  value={summary.ceased}
                  total={summary.total}
                  description="Activité SIRENE clôturée détectée. Fiche conservée à des fins d&apos;historique."
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* TOP DÉPARTEMENTS */}
        {topDepts.length > 0 ? (
          <section className="px-5 sm:px-12 py-16 sm:py-20 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]">
            <div className="max-w-[1240px] mx-auto space-y-10">
              <div className="space-y-3 max-w-2xl">
                <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                  Géographie
                </p>
                <h2 className="font-sans font-medium tracking-tight text-3xl sm:text-4xl text-[#0F1419] leading-tight">
                  Les dix départements à plus forte densité.
                </h2>
                <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
                  Recensement DHUP par département, avec part des cabinets revendiqués et taux
                  d&apos;activité moyen.
                </p>
              </div>
              <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F8F5EE] border-b border-[#0F1419]/[0.08]">
                    <tr>
                      <th className="text-left px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Département
                      </th>
                      <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Total
                      </th>
                      <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Vérifiés
                      </th>
                      <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Revendiqués
                      </th>
                      <th className="text-right px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                        Activité moy.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDepts.map((d) => (
                      <tr
                        key={d.departmentCode}
                        className="border-b border-[#0F1419]/[0.06] last:border-b-0"
                      >
                        <td className="px-4 py-3 text-[#0F1419]">
                          <span className="font-mono text-[11px] text-[#0F1419]/55 mr-2">
                            {d.departmentCode}
                          </span>
                          {DEPT_LABELS[d.departmentCode] ?? ''}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#0F1419]">
                          {d.totalCount.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#0F1419]/72">
                          {d.verifiedCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#0F1419]/72">
                          {d.claimedCount}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[#0F1419]/72">
                          {d.avgActivityScore != null ? d.avgActivityScore.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}

        {/* MÉTHODOLOGIE */}
        <section className="px-5 sm:px-12 py-16 sm:py-24 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[280px_1fr] gap-10 lg:gap-16">
            <div>
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Méthodologie
              </p>
            </div>
            <div className="space-y-4 max-w-3xl text-[14px] text-[#0F1419]/80 leading-relaxed">
              <p>
                <strong>Source principale.</strong> Annuaire officiel DHUP des diagnostiqueurs
                certifiés (mise à jour quotidienne via cron KOVAS).
              </p>
              <p>
                <strong>Cross-validation SIRENE.</strong> Chaque fiche est croisée avec la base
                INSEE Sirene pour vérifier l&apos;état d&apos;activité du SIRET déclaré. Statuts
                possibles : <em>actif, cessé, NULL</em> (non renseigné).
              </p>
              <p>
                <strong>Score d&apos;activité.</strong> Indicateur composite [0–1] calculé sur :
                avis Google sur les douze derniers mois, mise à jour de fiche, claim et leads
                traités. Seuil « activité élevée » fixé à 0,60.
              </p>
              <p>
                <strong>Validation status.</strong> Pipeline interne KOVAS : croisement automatisé
                COFRAC + SIRENE + RC Pro pour confirmer la certification active. Les statuts
                <em> suspended</em> et <em>ceased</em> sont des décisions de modération basées sur
                des signaux factuels (anomalies, cessation d&apos;activité confirmée).
              </p>
              <p>
                <strong>Anonymisation.</strong> Toutes les valeurs présentées sur cette page sont
                agrégées. Aucune information personnelle de diagnostiqueur n&apos;est exposée. Pour
                la transparence individuelle, consultez l&apos;annuaire public.
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function DistributionCard({
  label,
  value,
  total,
  description,
}: {
  label: string
  value: number
  total: number
  description: string
}): React.ReactElement {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-5 space-y-3">
      <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">{label}</p>
      <div className="flex items-baseline gap-2">
        <p
          className="font-serif italic font-normal text-[#0F1419] leading-none"
          style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
        >
          {value.toLocaleString('fr-FR')}
        </p>
        <p className="text-[12px] font-mono text-[#0F1419]/55">{pct}%</p>
      </div>
      <p className="text-[12px] text-[#0F1419]/72 leading-relaxed">{description}</p>
    </div>
  )
}
