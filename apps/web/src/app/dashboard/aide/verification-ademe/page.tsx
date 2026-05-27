/**
 * KOVAS — Tutoriel "Vérifie ton DPE avant l'envoi ADEME" (Lot B96).
 *
 * Détaille le workflow PrevalidationPanel + 13 algorithmes.
 * Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §3 + ADEME cockpit + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, Info } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: "Vérifie ton DPE avant l'envoi ADEME — Aide",
  description:
    'Les 13 algorithmes de pré-validation KOVAS, le workflow PrevalidationPanel et la lecture des verdicts vert / orange / rouge.',
  path: '/dashboard/aide/verification-ademe',
})

export default function AideVerificationAdemePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href="/dashboard/aide"
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute hover:text-ink"
      >
        <ChevronLeft className="size-3" aria-hidden />
        Centre d&apos;aide
      </Link>

      <AppPageHeader
        eyebrow="Tutoriel · 7 min"
        title="Vérifie ton DPE"
        accent="avant ADEME"
        description="Les 13 algorithmes de pré-validation qui te protègent des signalements et sanctions."
      />

      {/* Pourquoi vérifier */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Le contexte
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Pourquoi vérifier avant l&apos;envoi
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Depuis 2021, l&apos;
          <GlossaryTerm term="ademe" /> intensifie les contrôles aléatoires sur les{' '}
          <GlossaryTerm term="dpe">DPE</GlossaryTerm> transmis. Un DPE incohérent (étiquette A pour
          une maison de 1850, surface 100 m² avec chaudière 5 kW) déclenche un signalement officiel
          et peut conduire à une suspension de ta certification <GlossaryTerm term="cofrac" />.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          KOVAS lance automatiquement 13 contrôles avant chaque export, appliqués sur la méthode{' '}
          <GlossaryTerm term="3cl-2021" /> en vigueur. Le but n&apos;est pas de te ralentir, mais de
          t&apos;éviter une sanction.
        </p>
      </section>

      {/* Les 13 algorithmes */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Sous le capot
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Comment KOVAS aide</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Les 13 algorithmes couvrent les anomalies les plus signalées par l&apos;ADEME :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>Cohérence surface habitable vs surface chauffée.</li>
          <li>Cohérence puissance chaudière vs surface (kW / m²).</li>
          <li>Cohérence année de construction vs étiquette énergétique attendue.</li>
          <li>
            Détection des{' '}
            <GlossaryTerm term="passoire-thermique">passoires thermiques</GlossaryTerm> mal classées
            (F ou G).
          </li>
          <li>Présence ventilation déclarée vs équipements saisis.</li>
          <li>Cohérence isolation murs / toiture / plancher selon époque.</li>
          <li>Vérification des consommations vs étiquette finale.</li>
          <li>
            Croisement <GlossaryTerm term="ges">GES</GlossaryTerm> vs énergie principale.
          </li>
          <li>Détection des saisies manquantes (VMC, eau chaude, refroidissement).</li>
          <li>Cohérence orientation vs masques solaires.</li>
          <li>Vérification du nombre de pièces vs surface.</li>
          <li>Détection des doublons de saisie entre pièces.</li>
          <li>Contrôle des photos géolocalisées (présence et cohérence GPS).</li>
        </ul>
      </section>

      {/* Le workflow */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Le workflow
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Le panneau de pré-validation
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Une fois ta mission terrain terminée, ouvre la fiche du dossier. Le panneau{' '}
          <strong>Pré-validation ADEME</strong> s&apos;affiche en haut, avec un verdict global et la
          liste des contrôles. Tu peux relancer la vérification après chaque correction en un clic.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Chaque contrôle est cliquable : il t&apos;emmène directement à l&apos;endroit du dossier
          où corriger la donnée. Pas besoin de chercher.
        </p>
      </section>

      {/* Les verdicts */}
      <section className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Lecture des verdicts
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Que faire selon la couleur
        </h2>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-5 space-y-2">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-ink">Verdict vert — Tout est cohérent</p>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                Les 13 contrôles sont passés. Tu peux exporter ton ZIP Liciel sans inquiétude.
                Aucune action requise.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-5 space-y-2">
          <div className="flex items-start gap-3">
            <Info className="size-5 text-info shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-ink">
                Verdict orange — Points d&apos;attention
              </p>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                1 à 3 contrôles signalent une incohérence non-bloquante (par exemple : année de
                construction inhabituelle pour cette étiquette). Vérifie manuellement, puis tu peux
                exporter en confirmant que tu as contrôlé. Le ZIP est marqué « vérifié manuellement
                » dans tes archives.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-5 space-y-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 text-danger shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-ink">
                Verdict rouge — Corriger avant export
              </p>
              <p className="text-[13px] text-ink-soft leading-relaxed">
                Au moins un contrôle critique a échoué (par exemple : surface 0 m², énergie
                principale manquante, GES incohérent). L&apos;export ZIP Liciel est bloqué tant que
                tu n&apos;as pas corrigé. KOVAS t&apos;évite un signalement quasi-certain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">Ouvre le cockpit ADEME</p>
        <p className="text-[13px] text-ink-soft">
          Vue globale de tes dossiers en attente de transmission, avec verdicts et actions
          correctives en lot.
        </p>
        <div className="flex justify-center pt-1">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/cockpit-ademe">
              Ouvrir le cockpit ADEME
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
