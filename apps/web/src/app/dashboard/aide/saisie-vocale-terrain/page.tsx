/**
 * KOVAS — Tutoriel "Saisie vocale terrain" (Lot B96).
 *
 * Détaille le mode mission tchat IA hybride (Whisper + parser + Claude Haiku)
 * et l'anti-bruit 4 niveaux. Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §3 feature 1 + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Saisie vocale terrain — économise 1h30 par mission — Aide',
  description:
    "Le mode mission tchat IA hybride Whisper FR + parser custom JS + Claude Haiku, l'anti-bruit 4 niveaux et les tips terrain pour une saisie fluide.",
  path: '/dashboard/aide/saisie-vocale-terrain',
})

export default function AideSaisieVocaleTerrainPage() {
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
        title="Saisie vocale"
        accent="terrain"
        description="Le mode mission tchat IA, conçu pour gagner 1h30 par mission DPE en éliminant la re-saisie au bureau."
      />

      {/* Promesse */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          La promesse
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          1h30 économisée par mission
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          La friction principale du métier de diagnostiqueur n&apos;est pas la visite, c&apos;est le
          retour bureau pour ressaisir 30 à 45 minutes de notes manuscrites ou de mémo vocal brut.
          Le mode mission tchat IA de KOVAS structure ta voix directement pendant la visite, pièce
          par pièce, sans retraitement manuel.
        </p>
      </section>

      {/* Mode mission tchat */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Comment ça marche
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Le mode mission tchat</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          L&apos;interface est volontairement minimaliste : un tchat vertical optimisé tablette et
          téléphone, avec une seule question à la fois. Tu réponds à la voix (gros bouton micro), au
          clavier si tu préfères, ou par photo géolocalisée si la donnée est visuelle (étiquette
          chaudière par exemple).
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Pas de formulaires interminables. Pas de scroll. Pas d&apos;onglets. Une conversation qui
          se déroule au rythme de ta visite.
        </p>
      </section>

      {/* Hybride */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Sous le capot
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Approche IA hybride 0,01 €/mission
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          KOVAS combine 3 briques pour minimiser le coût IA sans sacrifier la précision :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Whisper FR (OpenAI)</strong> — transcription audio brute, haute précision sur le
            français technique métier.
          </li>
          <li>
            <strong>Parser custom JavaScript (80 % des cas)</strong> — règles métier propriétaires
            KOVAS qui structurent automatiquement la transcription (« cuisine, 12 m², chaudière gaz
            2018 ») sans appel API.
          </li>
          <li>
            <strong>Claude Haiku (20 % des cas)</strong> — appel IA uniquement quand le parser
            n&apos;est pas certain, pour confirmer ou désambigüiser.
          </li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Résultat : un coût moyen de <strong>0,01 €/mission</strong> au lieu des 0,15 €/mission
          qu&apos;aurait coûté un appel Claude pour chaque dictée. C&apos;est ce qui permet à KOVAS
          de garder une marge brute supérieure à 80 % sur les tiers Solo et Pro.
        </p>
      </section>

      {/* Anti-bruit */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Robustesse terrain
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Anti-bruit 4 niveaux</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Le terrain n&apos;est jamais silencieux : chaudière qui ronronne, rue passante, chien du
          propriétaire. KOVAS empile 4 garde-fous pour fiabiliser la transcription :
        </p>
        <ol className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-decimal list-inside">
          <li>
            <strong>Constraints audio navigateur</strong> — activation native de la suppression
            d&apos;écho et de la réduction de bruit du navigateur.
          </li>
          <li>
            <strong>VU-mètre temps réel</strong> — un indicateur visuel t&apos;avertit si le micro
            capte trop ou pas assez. Tu corriges la distance ou l&apos;orientation.
          </li>
          <li>
            <strong>Confidence Whisper</strong> — chaque transcription porte un score de confiance.
            En dessous d&apos;un seuil, KOVAS te demande de re-dicter au lieu d&apos;enregistrer une
            donnée potentiellement fausse.
          </li>
          <li>
            <strong>Cross-check Claude</strong> — pour les cas critiques (chiffres, années,
            étiquettes), Claude Haiku confirme la cohérence et signale les anomalies («
            j&apos;entends 2018, est-ce bien l&apos;année de la chaudière ? »).
          </li>
        </ol>
      </section>

      {/* Tips terrain */}
      <Card variant="warm" padding="default" className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Tips terrain
        </p>
        <p className="text-[14px] font-semibold text-ink">5 réflexes pour fiabiliser ta dictée</p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Distance micro</strong> · 15 à 20 cm de la bouche, jamais collé.
          </li>
          <li>
            <strong>Bruit ambiant</strong> · éloigne-toi de la chaudière qui démarre ou de la
            fenêtre sur rue passante. 2 mètres suffisent.
          </li>
          <li>
            <strong>Articulation</strong> · marque une légère pause entre données (« cuisine. 12
            mètres carrés. chaudière gaz 2018. »). Le parser apprécie.
          </li>
          <li>
            <strong>Chiffres</strong> · épelle les années (« deux mille dix-huit » plutôt que « 2018
            ») si tu veux maximiser la précision. Le parser sait convertir automatiquement.
          </li>
          <li>
            <strong>Photos en parallèle</strong> · si tu doutes du chiffre, prends une photo de la
            plaque signalétique. KOVAS la rattache à la pièce et tu corriges au bureau si besoin.
          </li>
        </ul>
      </Card>

      {/* Roadmap */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Évolutions à venir
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Ce qui arrive dans les prochains mois
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          KOVAS travaille sur l&apos;autonomisation IA progressive sur 36 mois pour basculer 60 à 80
          % des appels Whisper et Claude vers du compute propre (Whisper self-hosted M18,
          fine-tuning Llama 3.3 70B M24). Tu ne verras pas la différence côté usage, mais la marge
          KOVAS passera de 77 % à 85 %, ce qui finance la roadmap Phase 2 (calcul DPE certifié{' '}
          <GlossaryTerm term="ademe" />) sans hausse de prix.
        </p>
      </section>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">Tester le mode mission</p>
        <p className="text-[13px] text-ink-soft">
          La meilleure façon de découvrir, c&apos;est d&apos;essayer sur un dossier réel. 10 minutes
          suffisent pour saisir un T2 complet.
        </p>
        <div className="flex justify-center pt-1">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/aide/demarrer-mission">
              Comment démarrer une mission
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
