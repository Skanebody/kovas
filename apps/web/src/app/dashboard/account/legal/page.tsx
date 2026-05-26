import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { ArrowLeft, Download, FileCheck2, FileText, ShieldCheck } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Attestations légales' }

/**
 * Page Mon compte → Attestations légales.
 * Centralise les documents juridiques que KOVAS doit fournir au diagnostiqueur :
 *   - Attestation LAFT individuelle (art. 286 I 3° bis CGI)
 *   - Lien CGV module Factures
 *   - Rappel obligations de conservation 10 ans (L123-22 Code commerce)
 */
export default async function AccountLegalPage() {
  const { supabase, orgId } = await getCurrentUser()
  const { data: org } = await supabase
    .from('organizations')
    .select('name, siret')
    .eq('id', orgId)
    .maybeSingle()

  const orgReady = Boolean(org?.name && org.name.trim().length > 0)
  const attestationHref = `/api/legal/laft-attestation/${orgId}`
  const editor = COMPANY_IDENTITY

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Attestations"
        accent="légales"
        description="Documents officiels remis par KOVAS pour ta conformité fiscale et comptable."
      />

      {/* ATTESTATION LAFT */}
      <Card variant="flat" padding="default" className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[#0F1419]/[0.06] p-2.5">
              <ShieldCheck className="size-5 text-[#0F1419]" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#0F1419]">Attestation LAFT</h2>
              <p className="text-xs text-[#0F1419]/72">
                Loi anti-fraude TVA — art. 286 I 3° bis CGI
              </p>
            </div>
          </div>
          <Badge variant="green">Émise par {editor.legalName}</Badge>
        </div>

        <p className="text-sm text-[#0F1419]/82 leading-relaxed">
          KOVAS atteste, en tant qu’éditeur du logiciel, que le module Devis &amp; Factures
          satisfait les quatre conditions cumulatives prévues par la loi anti-fraude TVA :
          inaltérabilité, sécurisation, conservation 10 ans, archivage périodique. Conserve ce
          document avec ta comptabilité — il te sera demandé en cas de contrôle DGFiP.
        </p>

        <ul className="space-y-1.5 text-xs text-[#0F1419]/72">
          <li>
            <span className="font-semibold text-[#0F1419]/82">Inaltérabilité</span> — factures
            émises figées en base, corrections via avoir uniquement.
          </li>
          <li>
            <span className="font-semibold text-[#0F1419]/82">Sécurisation</span> — numérotation
            séquentielle continue garantie par verrou applicatif, journal d’événements append-only.
          </li>
          <li>
            <span className="font-semibold text-[#0F1419]/82">Conservation</span> — 10 ans (Code
            commerce L123-22), suppression définitive bloquée pendant la durée légale.
          </li>
          <li>
            <span className="font-semibold text-[#0F1419]/82">Archivage</span> — export ZIP horodaté
            mensuel (PDF + JSON + Factur-X), manifeste SHA-256.
          </li>
        </ul>

        {orgReady ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={attestationHref} download>
                <Download className="size-4" /> Télécharger l’attestation LAFT (PDF)
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`${attestationHref}?format=html`} target="_blank" rel="noopener noreferrer">
                <FileText className="size-4" /> Aperçu HTML
              </a>
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-[#FF9500]/30 bg-[#FF9500]/5 p-3 text-sm">
            <p className="font-medium text-[#FF9500]">Renseigne d’abord ton entreprise.</p>
            <p className="text-xs text-[#0F1419]/72 mt-1">
              Mon compte → Mon entreprise : raison sociale, SIRET et adresse sont nécessaires pour
              personnaliser ton attestation LAFT nominative.
            </p>
            <div className="mt-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/account">Compléter mes informations</Link>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* CGV MODULE FACTURES */}
      <Card variant="flat" padding="default" className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-[#0F1419]/[0.06] p-2.5">
            <FileCheck2 className="size-5 text-[#0F1419]" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#0F1419]">
              CGV — Module Factures
            </h2>
            <p className="text-xs text-[#0F1419]/72">
              Engagements KOVAS et responsabilités diagnostiqueur
            </p>
          </div>
        </div>
        <p className="text-sm text-[#0F1419]/82 leading-relaxed">
          Les Conditions Générales de Vente du module Factures précisent tes responsabilités
          (véracité des mentions facturées, déclarations fiscales) et les engagements de KOVAS
          (conformité LAFT, mentions L441-9, séquentialité, conservation 10 ans, roadmap Factur-X /
          PDP 2027).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/cgv/module-factures">
              <FileText className="size-4" /> Lire les CGV module Factures
            </Link>
          </Button>
        </div>
      </Card>

      {/* RAPPEL CONSERVATION */}
      <Card variant="flat" padding="default" className="space-y-3">
        <h3 className="text-base font-bold tracking-tight text-[#0F1419]">
          Rappel — Conservation des factures
        </h3>
        <ul className="space-y-1.5 text-xs text-[#0F1419]/72">
          <li>
            <span className="font-semibold text-[#0F1419]/82">Code de commerce L123-22</span> — 10
            ans à compter de la clôture de l’exercice.
          </li>
          <li>
            <span className="font-semibold text-[#0F1419]/82">Code général des impôts L102 B</span>{' '}
            — 6 ans à compter de la date de la dernière opération.
          </li>
          <li>
            <span className="font-semibold text-[#0F1419]/82">RGPD art. 5-1-e</span> — limitation à
            la durée nécessaire ; les factures bénéficient d’une obligation légale qui prime.
          </li>
        </ul>
        <p className="text-xs text-[#0F1419]/72">
          KOVAS conserve tes factures durant 10 ans même après résiliation, en lecture seule
          accessible via ton compte (clause 8 CGV module Factures).
        </p>
      </Card>

      {/* IDENTITÉ ÉDITEUR (référence) */}
      <Card variant="flat" padding="default" className="space-y-2">
        <h3 className="text-base font-bold tracking-tight text-[#0F1419]">Éditeur du logiciel</h3>
        <div className="text-xs text-[#0F1419]/72 space-y-0.5">
          <p>
            <span className="font-semibold text-[#0F1419]/82">
              {editor.legalForm} {editor.legalName}
            </span>{' '}
            — Capital {editor.capitalLabel}
          </p>
          <p>
            {editor.address.line1}, {editor.address.postalCode} {editor.address.city},{' '}
            {editor.address.country}
          </p>
          <p>
            {editor.rcs.number} — SIREN {editor.siren} — SIRET {editor.siret}
          </p>
          <p>
            TVA {editor.vatIntracom} — APE {editor.apeCode}
          </p>
          <p>Représentant légal : {editor.legalRepresentative.fullName}, Président</p>
        </div>
      </Card>
    </div>
  )
}
