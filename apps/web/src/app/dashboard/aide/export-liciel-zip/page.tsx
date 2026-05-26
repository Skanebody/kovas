/**
 * KOVAS — Tutoriel "Exporte ton dossier vers Liciel en 1 clic" (Lot B96).
 *
 * Détaille les 3 modes d'export + fallback PDF/Word/CSV/JSON.
 * Tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §3 features 8-9 + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import { ArrowRight, ChevronLeft, Cloud, Download, Mail } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: 'Exporte ton dossier vers Liciel en 1 clic — Aide',
  description:
    "Les 3 modes d'export ZIP V4 vers Liciel (Email, Google Drive auto-sync, téléchargement direct) et le fallback PDF + Word + CSV + JSON.",
  path: '/dashboard/aide/export-liciel-zip',
})

export default function AideExportLicielZipPage() {
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
        title="Exporte ton dossier"
        accent="vers Liciel"
        description="Trois modes d'export en un clic, plus un filet de sécurité universel PDF + Word + CSV + JSON."
      />

      {/* Le constat */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Le constat
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">
          Pourquoi 3 modes d&apos;export
        </h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Selon ton mode de travail, l&apos;import dans <GlossaryTerm term="liciel" /> n&apos;est
          pas toujours le même. Tu peux être au bureau juste après une tournée terrain, ou bien en
          mobilité chez un confrère cabinet, ou encore devoir transmettre à un commanditaire
          externe. KOVAS s&apos;adapte aux trois cas.
        </p>
      </section>

      {/* Mode 1 — Email */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-sage-alt/60 text-ink shrink-0"
            aria-hidden
          >
            <Mail className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Mode 1
            </p>
            <h2 className="text-[20px] font-semibold text-ink leading-tight">Envoi par email</h2>
          </div>
        </div>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Renseigne l&apos;adresse de destination (ta propre adresse, celle du cabinet, ou celle du
          commanditaire). KOVAS envoie le ZIP V4 en pièce jointe, avec en bonus un PDF et un Word
          lisibles côté propriétaire ou agence. Idéal pour transmettre à un client ou un notaire qui
          n&apos;a pas Liciel.
        </p>
      </section>

      {/* Mode 2 — GDrive/Dropbox */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-sage-alt/60 text-ink shrink-0"
            aria-hidden
          >
            <Cloud className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Mode 2
            </p>
            <h2 className="text-[20px] font-semibold text-ink leading-tight">
              Google Drive ou Dropbox (auto-sync)
            </h2>
          </div>
        </div>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Connecte ton compte Google Drive ou Dropbox une seule fois depuis{' '}
          <Link href="/dashboard/account" className="underline underline-offset-4 hover:text-ink">
            Compte / Intégrations
          </Link>
          . Ensuite chaque export ZIP est automatiquement déposé dans le dossier de ton choix (par
          exemple <code className="font-mono text-[12px]">KOVAS / Dossiers transmis</code>). Tu
          retrouves le fichier sur ton ordinateur de bureau pour import dans Liciel en quelques
          secondes.
        </p>
      </section>

      {/* Mode 3 — Download */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <div className="flex items-start gap-3">
          <span
            className="flex size-9 items-center justify-center rounded-full bg-sage-alt/60 text-ink shrink-0"
            aria-hidden
          >
            <Download className="size-4" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              Mode 3
            </p>
            <h2 className="text-[20px] font-semibold text-ink leading-tight">
              Téléchargement direct
            </h2>
          </div>
        </div>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Le mode le plus simple. Clique sur <strong>Télécharger le ZIP</strong> depuis la fiche du
          dossier. Le fichier descend dans ton dossier{' '}
          <code className="font-mono text-[12px]">Téléchargements</code> habituel. Tu ouvres ensuite
          Liciel, tu utilises <em>Imports spécifiques → ZIP générique V4</em>, et le dossier est
          créé en moins de 30 secondes côté Liciel.
        </p>
      </section>

      {/* Le ZIP V4 */}
      <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Format technique
        </p>
        <h2 className="text-[20px] font-semibold text-ink leading-tight">Format ZIP V4 garanti</h2>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          KOVAS génère un ZIP V4 conforme au format{' '}
          <GlossaryTerm term="liciel">Liciel</GlossaryTerm> en vigueur (MDB Access + photos +
          métadonnées). Le format est testé sur 25+ cas réels avant chaque release. Si une version
          Liciel sort, KOVAS la prend en charge sous 14 jours sans action de ta part.
        </p>
      </section>

      {/* Fallback */}
      <Card variant="warm" padding="default" className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Filet de sécurité
        </p>
        <p className="text-[14px] font-semibold text-ink">Si Liciel rejette — fallback universel</p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Tu disposes en parallèle de 4 exports universels indépendants de Liciel :
        </p>
        <ul className="space-y-1 text-[13px] text-ink-soft leading-relaxed list-disc list-inside">
          <li>
            <strong>PDF</strong> — rapport complet imprimable, prêt à transmettre.
          </li>
          <li>
            <strong>Word</strong> — modifiable côté propriétaire ou agence.
          </li>
          <li>
            <strong>CSV</strong> — pour réinjection dans un tableur ou un autre logiciel.
          </li>
          <li>
            <strong>JSON</strong> — structuré, pour intégration via API tierce ou workflow
            personnalisé.
          </li>
        </ul>
        <p className="text-[13px] text-ink-soft leading-relaxed pt-1">
          Tu n&apos;es jamais bloqué. Même si Liciel a un incident ou une version incompatible, ton
          dossier reste exploitable.
        </p>
      </Card>

      {/* CTA */}
      <Card variant="opaque" padding="default" className="space-y-3 text-center">
        <p className="text-[14px] font-semibold text-ink">
          Voir tes dossiers en attente d&apos;export
        </p>
        <p className="text-[13px] text-ink-soft">
          La liste des dossiers prêts pour transmission, filtrables par type de diagnostic et statut
          de pré-validation.
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
