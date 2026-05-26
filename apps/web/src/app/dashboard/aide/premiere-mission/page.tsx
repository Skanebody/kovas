/**
 * KOVAS — Tutoriel "Ta première mission KOVAS en 10 minutes" (Lot B96).
 *
 * Parcours complet bout-en-bout : création dossier → mission terrain → export Liciel.
 * Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §3 features 1-10 + Lot B96.
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
  title: 'Ta première mission KOVAS en 10 minutes — Aide',
  description:
    'Parcours complet de bout en bout : création du dossier, ajout client + bien, mission terrain, pré-validation ADEME et export ZIP Liciel.',
  path: '/dashboard/aide/premiere-mission',
})

export default function AidePremiereMissionPage() {
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
        eyebrow="Tutoriel · 10 min"
        title="Ta première"
        accent="mission KOVAS"
        description="Le parcours complet en 6 étapes, du dossier vierge à l'export ZIP Liciel prêt à transmettre."
      />

      {/* Pré-requis */}
      <Card variant="warm" padding="default" className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Avant de commencer
        </p>
        <p className="text-[14px] font-semibold text-ink">Pré-requis</p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>Compte créé et email professionnel validé.</li>
          <li>
            Carte bancaire enregistrée (essai 30 jours, débit automatique à J+30 si tu ne résilies
            pas).
          </li>
          <li>
            Optionnel : tablette ou téléphone avec navigateur récent (Chrome, Safari, Firefox) pour
            la captation terrain.
          </li>
        </ul>
      </Card>

      {/* Étape 1 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 1</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Crée un dossier</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Depuis le tableau de bord, clique sur <strong>Nouveau dossier</strong> en haut à droite,
          ou utilise le bouton <strong className="font-mono text-[12px]">+</strong> central de la
          barre mobile. Le wizard te demande trois informations minimum : le type de diagnostic (
          <GlossaryTerm term="DPE" />, amiante, <GlossaryTerm term="crep">plomb CREP</GlossaryTerm>,
          gaz, électricité, termites, <GlossaryTerm term="carrez">Carrez</GlossaryTerm> ou{' '}
          <GlossaryTerm term="erp">ERP</GlossaryTerm>), une référence interne libre, et
          l&apos;adresse du bien.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          L&apos;adresse est auto-complétée via l&apos;API{' '}
          <GlossaryTerm term="ban">BAN</GlossaryTerm> (Base Adresse Nationale). Si l&apos;adresse
          n&apos;est pas reconnue, tu peux la saisir manuellement et géocoder via le cadastre{' '}
          <GlossaryTerm term="ign">IGN</GlossaryTerm>.
        </p>
      </section>

      {/* Étape 2 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 2</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Ajoute un client et un bien
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Le wizard te propose ensuite de rattacher un client (propriétaire, mandataire, agence) et
          un bien immobilier. Si le client existe déjà dans ta base, sélectionne-le. Sinon, crée-le
          en 3 champs : civilité, nom, email ou téléphone.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Pour le bien, indique la surface, le type (maison ou appartement), l&apos;année de
          construction et le nombre de pièces. Les templates pré-remplis T2 / T3 / T4 / T5 maison /
          appartement accélèrent la saisie sur le terrain.
        </p>
      </section>

      {/* Étape 3 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 3</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Démarre la mission terrain
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Une fois le dossier créé, clique sur <strong>Démarrer la mission</strong> depuis la fiche
          du dossier, ou utilise le raccourci{' '}
          <strong className="font-mono text-[12px]">Cmd+M</strong>. Tu passes en mode tchat IA,
          optimisé tablette et téléphone, avec une seule colonne de questions guidées.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Le mode mission fonctionne sans internet. Tes saisies sont stockées en local (IndexedDB)
          et synchronisées dès que le réseau revient.
        </p>
      </section>

      {/* Étape 4 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 4</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Saisie vocale et photos géolocalisées
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Appuie sur le micro pour dicter pièce par pièce. La transcription Whisper FR structure
          automatiquement le texte (« cuisine, surface 12 m², chaudière gaz de 2018 »). Une icône
          appareil photo te permet d&apos;ajouter des photos compressées en WebP et géotaguées
          (latitude / longitude / horodatage).
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Les check-lists par type de diagnostic préviennent les oublis : « Tu n&apos;as pas saisi
          la VMC, c&apos;est volontaire ? »
        </p>
      </section>

      {/* Étape 5 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 5</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Pré-validation ADEME</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Avant l&apos;export, KOVAS lance automatiquement 13 algorithmes propriétaires de cohérence
          : surface vs chaudière, année construction vs étiquette, présence VMC vs ventilation
          déclarée. Le panneau <GlossaryTerm term="ademe" /> de pré-validation t&apos;affiche un
          verdict vert / orange / rouge avec les points à corriger avant transmission.
        </p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Verdict rouge ? Tu peux corriger en 1 clic depuis le panneau. Verdict orange ? Tu peux
          exporter mais avec un avertissement. Verdict vert ? Tu es prêt.
        </p>
      </section>

      {/* Étape 6 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">Étape 6</p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Export ZIP Liciel</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Depuis la fiche du dossier, clique sur <strong>Partager vers Liciel</strong>. Trois modes
          te sont proposés :
        </p>
        <ul className="space-y-1.5 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>Email</strong> — envoi direct du ZIP V4 à l&apos;adresse de ton choix.
          </li>
          <li>
            <strong>Google Drive ou Dropbox</strong> — synchronisation automatique vers ton cloud
            personnel.
          </li>
          <li>
            <strong>Téléchargement direct</strong> — récupération du ZIP en local pour import manuel
            dans <GlossaryTerm term="liciel" />.
          </li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Tu disposes aussi d&apos;exports universels PDF, Word, CSV et JSON pour les cas où{' '}
          <GlossaryTerm term="liciel">Liciel</GlossaryTerm> n&apos;est pas utilisé.
        </p>
      </section>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">Prêt à enchaîner ta première mission ?</p>
        <p className="text-[13px] text-ink-soft">
          Compte 10 à 15 minutes pour la prise en main, puis 30 à 45 minutes par mission une fois
          rodé.
        </p>
        <div className="flex justify-center pt-1">
          <Button asChild variant="accent" size="lg">
            <Link href="/dashboard/dossiers/new">
              Commencer ma première mission
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
