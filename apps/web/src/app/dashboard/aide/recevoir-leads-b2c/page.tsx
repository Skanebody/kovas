/**
 * KOVAS — Tutoriel "Reçois tes premiers leads B2C qualifiés" (Lot B96).
 *
 * Détaille l'activation Annuaire + scoring intent + Thompson sampling + réclamation.
 * Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §4 Annuaire 19/39/79€ + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Reçois tes premiers leads B2C qualifiés — Aide',
  description:
    "Activation de l'annuaire (Présence 19€ / Boost 39€ / Premium 79€), lead scoring intent, routing Thompson sampling et réclamation de fiche.",
  path: '/dashboard/aide/recevoir-leads-b2c',
})

export default function AideRecevoirLeadsB2cPage() {
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
        eyebrow="Tutoriel · 8 min"
        title="Reçois tes premiers"
        accent="leads B2C"
        description="Activation de l'annuaire, lead scoring intent et routing intelligent pour capter des particuliers prêts à commander."
      />

      {/* Étape 1 — Activer l'annuaire */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 1</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Activer ta présence dans l&apos;annuaire
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          L&apos;annuaire KOVAS est un modèle Doctolib appliqué au diagnostic immobilier. Trois
          niveaux d&apos;abonnement te donnent une visibilité progressive :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Présence — 19 €/mois</strong> · visibilité au niveau du département. Tu apparais
            dans les recherches géographiques avec ta fiche standard et tes coordonnées.
          </li>
          <li>
            <strong>Boost — 39 €/mois (recommandé)</strong> · Top 5 du département + badge Vérifié.
            Tu passes devant la concurrence locale et tu rassures les particuliers.
          </li>
          <li>
            <strong>Premium — 79 €/mois</strong> · Top 3 régional + badge doré + 3 communes mises en
            avant. Captation maximale, idéal pour les territoires denses.
          </li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Active ton tier depuis <em>Compte / Annuaire</em>. La fiche est en ligne sous 24 heures,
          après vérification de ta certification <strong>COFRAC</strong>.
        </p>
      </section>

      {/* Étape 2 — Lead scoring */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 2</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Le lead scoring intent</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Tous les leads ne se valent pas. KOVAS attribue à chaque demande entrante un score
          d&apos;intent de 0 à 100, basé sur 7 signaux :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>Précision de l&apos;adresse saisie (validée BAN ou non).</li>
          <li>Délai souhaité (sous 7 jours = intent fort).</li>
          <li>Type de diagnostic demandé (DPE seul vs pack complet).</li>
          <li>Profil du demandeur (propriétaire vs curieux).</li>
          <li>Temps passé sur le formulaire et complétude.</li>
          <li>Provenance du trafic (Google search direct vs sites tiers).</li>
          <li>Historique éventuel sur la plateforme.</li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Les leads les mieux scorés (intent ≥ 70) sont marqués <strong>Chaud</strong> dans ton
          inbox. Tu réponds en priorité.
        </p>
      </section>

      {/* Étape 3 — Routing */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 3</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Routing Thompson sampling
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Pour ne pas inonder le même diagnostiqueur et garantir l&apos;équité du marketplace, KOVAS
          utilise un algorithme de Thompson sampling. Chaque lead est attribué selon trois critères
          pondérés :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Proximité géographique</strong> du bien (rayon optimal selon densité).
          </li>
          <li>
            <strong>Tier d&apos;abonnement</strong> (Premium &gt; Boost &gt; Présence).
          </li>
          <li>
            <strong>Taux de réponse</strong> historique (les diagnostiqueurs qui répondent vite
            remontent dans la file).
          </li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Concrètement : si tu réponds aux leads en moins de 2 heures pendant 30 jours, tu reçois
          progressivement plus de leads. Tu peux suivre ton taux de réponse depuis{' '}
          <em>Performance / Annuaire</em>.
        </p>
      </section>

      {/* Étape 4 — Réclamer */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 4</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Réclamer ta fiche</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Si tu es déjà présent dans la base publique des diagnostiqueurs certifiés (issue de
          l&apos;annuaire COFRAC), une fiche pré-remplie existe peut-être déjà à ton nom. Pour la
          réclamer :
        </p>
        <ol className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-decimal list-inside">
          <li>
            Ouvre <em>Compte / Annuaire / Réclamer ma fiche</em>.
          </li>
          <li>
            Renseigne ton numéro de certification COFRAC et ton{' '}
            <strong className="font-mono text-[12px]">SIREN</strong>.
          </li>
          <li>
            KOVAS croise les données auprès du COFRAC sous 48 heures ouvrées et te transfère la
            propriété de la fiche.
          </li>
          <li>Tu peux ensuite enrichir la fiche (photos, spécialités, zones desservies).</li>
        </ol>
      </section>

      {/* Inbox */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Au quotidien
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Ton inbox de leads entrants
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Chaque lead entrant arrive dans ton inbox{' '}
          <code className="font-mono text-[12px]">/dashboard/leads/incoming</code> avec un compte à
          rebours de 2 heures. Au-delà, le lead est ré-attribué. L&apos;email + push notification
          t&apos;alerte en temps réel.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Tu peux accepter, refuser (motif requis pour préserver ton taux de réponse) ou demander un
          report. Une fois accepté, le lead devient un dossier KOVAS automatiquement, avec le client
          et le bien pré-remplis.
        </p>
      </section>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">Active ton tier annuaire</p>
        <p className="text-[13px] text-ink-soft">
          La majorité des nouveaux diagnostiqueurs commencent avec Boost (39 €/mois) pour passer
          rapidement devant la concurrence locale.
        </p>
        <div className="flex justify-center pt-1">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/leads/incoming">
              Voir mes leads entrants
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
