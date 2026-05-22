import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Check, Minus, X } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Comparatif vs Liciel, OBBC, AnalysImmo, ORIS',
  description:
    'Comparatif factuel et neutre de KOVAS face aux principaux logiciels du marché français. Données validées au 22/05/2026.',
}

type Status = 'absent' | 'present' | 'better' | 'equivalent'

interface Row {
  feature: string
  detail?: string
  kovas: Status
  liciel: Status
  obbc: Status
  analysImmo: Status
  oris: Status
}

interface Category {
  name: string
  intro: string
  rows: Row[]
}

const CATEGORIES: Category[] = [
  {
    name: 'Capture terrain',
    intro: 'Tout ce qui se passe avant le retour au bureau.',
    rows: [
      {
        feature: 'Saisie vocale terrain',
        detail: 'Whisper + parser hybride FR',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Photos géolocalisées',
        kovas: 'present',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'present',
        oris: 'absent',
      },
      {
        feature: 'Templates pièces pré-remplis',
        kovas: 'present',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'present',
        oris: 'absent',
      },
      {
        feature: 'Mode offline complet',
        detail: 'Service Worker + IndexedDB',
        kovas: 'better',
        liciel: 'equivalent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
  {
    name: 'Validation IA',
    intro: 'Vérification métier avant transmission ADEME.',
    rows: [
      {
        feature: 'Pré-vérification ADEME intelligente',
        detail: '8 analyseurs métier',
        kovas: 'better',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Détection de fraude DPE',
        detail: '4 patterns Décret 2023-417',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Coach IA personnel',
        detail: 'Claude Haiku contextualisé métier',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Validation cohérence basique',
        kovas: 'present',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'equivalent',
        oris: 'equivalent',
      },
    ],
  },
  {
    name: 'Exports',
    intro: 'Indépendance et interopérabilité.',
    rows: [
      {
        feature: 'Export PDF',
        kovas: 'present',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'present',
        oris: 'present',
      },
      {
        feature: 'Export Word (.docx)',
        kovas: 'present',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Export CSV / JSON',
        detail: 'Données machine',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Bouton « Partager » 3 modes',
        detail: 'Email + GDrive + DL direct',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Compatibilité ZIP Liciel',
        kovas: 'present',
        liciel: 'better',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
  {
    name: 'Annuaire & Leads',
    intro: 'Acquisition de clients via présence publique.',
    rows: [
      {
        feature: 'Fiche publique référencée Google',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Calculateur DPE gratuit générateur de leads',
        kovas: 'better',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Avis clients vérifiés',
        kovas: 'present',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
  {
    name: 'Conformité',
    intro: 'RGPD, Décret 2023-417, eIDAS.',
    rows: [
      {
        feature: 'Hébergement EU (Paris)',
        kovas: 'better',
        liciel: 'equivalent',
        obbc: 'equivalent',
        analysImmo: 'equivalent',
        oris: 'equivalent',
      },
      {
        feature: 'Conformité RGPD complète',
        detail: 'Export 1 clic, droit oubli, consentements',
        kovas: 'better',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'present',
        oris: 'present',
      },
      {
        feature: 'Décret 2023-417 traçabilité',
        kovas: 'present',
        liciel: 'present',
        obbc: 'present',
        analysImmo: 'present',
        oris: 'present',
      },
      {
        feature: 'Signature eIDAS Yousign',
        detail: 'Option ponctuelle',
        kovas: 'present',
        liciel: 'present',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Attestation LAFT facturation auto',
        kovas: 'present',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
  {
    name: 'Mobile',
    intro: 'Usage iPad / iPhone terrain.',
    rows: [
      {
        feature: 'App native iOS / Android',
        detail: 'KOVAS : PWA installable',
        kovas: 'equivalent',
        liciel: 'present',
        obbc: 'absent',
        analysImmo: 'present',
        oris: 'absent',
      },
      {
        feature: 'Sync mobile / web temps réel',
        detail: 'Supabase Realtime',
        kovas: 'better',
        liciel: 'equivalent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Dark mode auto',
        kovas: 'present',
        liciel: 'absent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
  {
    name: "Prix d'entrée",
    intro: 'Le tier le moins cher, HT par mois, pour 1 utilisateur.',
    rows: [
      {
        feature: 'Tier le moins cher',
        detail: 'Solo Light KOVAS · 29€ — vs Liciel 79€, OBBC 89€, AnalysImmo 69€, ORIS 99€',
        kovas: 'better',
        liciel: 'equivalent',
        obbc: 'equivalent',
        analysImmo: 'equivalent',
        oris: 'equivalent',
      },
      {
        feature: 'Essai gratuit',
        detail: 'KOVAS 30j · Liciel 14j · autres : démo seule',
        kovas: 'better',
        liciel: 'equivalent',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
      {
        feature: 'Sans engagement',
        kovas: 'present',
        liciel: 'present',
        obbc: 'absent',
        analysImmo: 'absent',
        oris: 'absent',
      },
    ],
  },
]

function CellIcon({ status }: { status: Status }) {
  if (status === 'better') {
    return (
      <span className="inline-flex items-center gap-1 text-chartreuse-deep">
        <Check className="size-4" />
        <span className="font-mono text-[10px] uppercase">Mieux</span>
      </span>
    )
  }
  if (status === 'present') {
    return (
      <span className="inline-flex items-center text-ink-soft">
        <Check className="size-4" aria-label="Présent" />
      </span>
    )
  }
  if (status === 'equivalent') {
    return (
      <span className="inline-flex items-center gap-1 text-ink-mute">
        <Minus className="size-4" />
        <span className="font-mono text-[10px] uppercase">Équiv.</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-ink-faint">
      <X className="size-4" aria-label="Absent" />
    </span>
  )
}

export default function ComparatifPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Comparatif</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            KOVAS face aux{' '}
            <span className="text-display-serif text-chartreuse-deep">logiciels du marché</span>
          </h1>
          <p className="text-ink-mute">
            Comparatif factuel et neutre vs Liciel, OBBC, AnalysImmo et ORIS. Aucun bashing, des
            faits.
          </p>
          <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
            Données concurrents validées au 2026-05-22, susceptibles d&apos;évoluer.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-ink-mute">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4 text-chartreuse-deep" /> Mieux
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-4" /> Présent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Minus className="size-4" /> Équivalent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <X className="size-4" /> Absent
          </span>
        </div>

        <div className="space-y-12">
          {CATEGORIES.map((category) => (
            <section key={category.name} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">{category.name}</h2>
                <p className="text-sm text-ink-mute">{category.intro}</p>
              </div>
              <Card variant="opaque" padding="none" className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-rule/60 bg-cream-deep/30">
                        <th
                          scope="col"
                          className="sticky left-0 z-10 bg-cream-deep/80 px-4 py-3 text-left font-semibold"
                        >
                          Fonctionnalité
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center font-semibold text-chartreuse-deep"
                        >
                          KOVAS
                        </th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold">
                          Liciel
                        </th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold">
                          OBBC
                        </th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold">
                          AnalysImmo
                        </th>
                        <th scope="col" className="px-4 py-3 text-center font-semibold">
                          ORIS
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {category.rows.map((row, index) => (
                        <tr
                          key={row.feature}
                          className={
                            index < category.rows.length - 1 ? 'border-b border-rule/40' : ''
                          }
                        >
                          <th
                            scope="row"
                            className="sticky left-0 z-10 bg-paper/95 px-4 py-3 text-left font-medium"
                          >
                            <div>{row.feature}</div>
                            {row.detail && (
                              <div className="text-xs font-normal text-ink-mute">{row.detail}</div>
                            )}
                          </th>
                          <td className="px-4 py-3 text-center">
                            <CellIcon status={row.kovas} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <CellIcon status={row.liciel} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <CellIcon status={row.obbc} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <CellIcon status={row.analysImmo} />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <CellIcon status={row.oris} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ))}
        </div>

        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Vérifiez par vous-même</h2>
          <p className="text-ink-mute">
            30 jours d&apos;essai complet. Si KOVAS ne tient pas ses promesses dans votre quotidien,
            résiliez en deux clics.
          </p>
          <Button size="lg" variant="accent" asChild>
            <Link href="/signup">
              Démarrer mon essai 30 jours <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
