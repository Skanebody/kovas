/**
 * KOVAS — Tutoriel "Reprendre une mission là où tu l'as laissée" (Lot B96).
 *
 * Détaille le mission flow continu, multi-mission par dossier et realtime cabinet.
 * Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md + GC2 mission flow + Lot B92 (multi-mission picker) + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { ArrowRight, ChevronLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: "Reprendre une mission là où tu l'as laissée — Aide",
  description:
    'Mission flow continu, multi-mission par dossier (DPE + amiante + plomb), picker multi-mission et realtime cabinet collaboratif.',
  path: '/dashboard/aide/mission-flow-continu',
})

export default function AideMissionFlowContinuPage() {
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
        eyebrow="Tutoriel · 6 min"
        title="Reprends une"
        accent="mission en cours"
        description="Mission flow continu, multi-mission par dossier et collaboration cabinet en temps réel."
      />

      {/* Le concept */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Le concept
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Le mission flow continu
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Sur le terrain, tu ne saisis jamais d&apos;une traite. Tu es interrompu par le
          propriétaire, tu sors prendre un appel, tu reprends après le déjeuner. Le mission flow
          continu de KOVAS sauvegarde en permanence chaque réponse, chaque photo, chaque saisie
          vocale.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Tu peux fermer ton navigateur ou perdre le réseau : tout est conservé en local (IndexedDB)
          puis re-synchronisé automatiquement. Aucune action de reprise manuelle, aucun bouton «
          Enregistrer » à cliquer.
        </p>
      </section>

      {/* Comment reprendre */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Au quotidien
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Comment reprendre une mission
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Trois chemins simples pour reprendre exactement où tu en étais :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Card « Action du jour »</strong> du tableau de bord, en haut. S&apos;il y a une
            mission en cours, le bouton chartreuse passe automatiquement de <em>Démarrer</em> à{' '}
            <em>Reprendre</em>.
          </li>
          <li>
            <strong>Sidebar / Capture</strong> · le bouton Capture détecte la mission interrompue la
            plus récente et y retourne.
          </li>
          <li>
            <strong>Raccourci Cmd+M</strong> · depuis n&apos;importe quelle page, le mode mission le
            plus récent s&apos;ouvre.
          </li>
        </ul>
      </section>

      {/* Multi-mission par dossier */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Cas fréquent
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Multi-mission par dossier
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          La majorité des transactions immobilières demandent un pack de diagnostics (DPE + amiante
          + plomb + ERP + Carrez). KOVAS gère ces missions en parallèle dans un seul dossier, sans
          dupliquer les données propriétaire ou bien.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Le <strong>picker multi-mission</strong> en haut du mode mission tchat te laisse basculer
          d&apos;un diagnostic à l&apos;autre en un clic. Tes saisies vocales sont automatiquement
          rangées dans la bonne mission, même si tu dictes en passant d&apos;un sujet à
          l&apos;autre.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Exemple : tu es dans la cuisine. Tu dictes la surface (DPE), la présence de plomb dans les
          peintures (CREP), et la VMC (DPE). Le parser sait dispatcher chaque donnée vers la bonne
          mission, et le tchat te confirme : « Surface ajoutée au DPE, peinture plomb ajoutée au
          CREP ».
        </p>
      </section>

      {/* Realtime cabinet */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Pour les cabinets
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Realtime cabinet — collaboration multi-diagnostiqueurs
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Sur les tiers Cabinet et Cabinet+, plusieurs diagnostiqueurs peuvent travailler
          simultanément sur le même dossier. La synchronisation se fait en temps réel via Supabase
          Realtime : tu vois s&apos;afficher les saisies de ton confrère en direct, avec un avatar
          de présence dans le coin de chaque mission.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Cas typique : un diagnostiqueur s&apos;occupe du DPE pendant qu&apos;un second mène le
          CREP plomb dans une autre pièce. À la fin, le dossier est complet sans coordination
          manuelle. La résolution de conflit se fait en <em>Last Write Wins</em> avec historique
          consultable.
        </p>
      </section>

      {/* Pause sauvegarde */}
      <Card variant="warm" padding="default" className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Bonus</p>
        <p className="text-[14px] font-semibold text-ink">Le bouton Pause sauvegarde tout</p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Pendant le mode mission tchat, le bouton <strong>Pause</strong> en haut sauvegarde la
          conversation et l&apos;état des saisies, puis te ramène au tableau de bord. Tu peux
          reprendre exactement là où tu en étais depuis n&apos;importe lequel des 6 points
          d&apos;accès — y compris depuis un autre appareil (téléphone après tablette par exemple).
        </p>
      </Card>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">Lance ta prochaine mission</p>
        <p className="text-[13px] text-ink-soft">
          Le mode mission continu n&apos;a rien à activer : il est natif sur tous les tiers.
          Démarre, interromps, reprends — sans y penser.
        </p>
        <div className="flex justify-center pt-1">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/dossiers">
              Voir mes dossiers
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
