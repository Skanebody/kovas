import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Fonctionnalités',
  description:
    'Plus de 60 fonctionnalités KOVAS regroupées en 8 catégories : capture terrain, validation IA, exports, annuaire, facturation, comptabilité, conformité, mobile.',
}

type Status = 'Inclus' | 'V1.5' | 'V2'

interface Feature {
  title: string
  description: string
  status: Status
}

interface CategoryGroup {
  name: string
  intro: string
  features: Feature[]
}

const CATEGORIES: CategoryGroup[] = [
  {
    name: 'Capture terrain',
    intro:
      'Tout ce qui se passe avant de revenir au bureau. Mains libres, données structurées, zéro re-saisie.',
    features: [
      {
        title: 'Saisie vocale terrain FR',
        description:
          "Transcription française + structuration métier hybride. Décris l'état d'une pièce, KOVAS organise les champs automatiquement.",
        status: 'Inclus',
      },
      {
        title: 'Templates pièces pré-remplis',
        description:
          'T2, T3, T4, T5, maison, appartement. Les pièces standards sont déjà créées, vous validez ou modifiez.',
        status: 'Inclus',
      },
      {
        title: 'Photos géolocalisées',
        description:
          'Web Camera API + Geolocation. Coordonnées GPS EXIF embarquées dans le fichier, compression WebP 250 ko.',
        status: 'Inclus',
      },
      {
        title: 'Annotations basiques sur photos',
        description: 'Flèches, encadrés, texte. Pour signaler un défaut ou une mesure spécifique.',
        status: 'Inclus',
      },
      {
        title: 'Check-lists par type de diagnostic',
        description: "« Tu n'as pas saisi la VMC, c'est volontaire ? » Avant export, pas après.",
        status: 'Inclus',
      },
      {
        title: 'Auto-complétion adresse + cadastre',
        description: 'API BAN + IGN + Géorisques ERP. Adresse exacte, parcelle, risques connus.',
        status: 'Inclus',
      },
      {
        title: 'Upload documents propriétaire',
        description:
          'Lien public sécurisé. Le client uploade ses factures énergie, plans, anciens DPE avant la visite.',
        status: 'Inclus',
      },
      {
        title: 'Croquis 2D Apple Pencil',
        description:
          'Konva.js + PointerEvents. Croquis vectoriel avec pression du stylet, utile pour amiante avancé.',
        status: 'V2',
      },
    ],
  },
  {
    name: 'Validation IA',
    intro:
      "8 analyseurs métier vérifient vos données avant l'export. Les erreurs sortent du flux avant l'ADEME.",
    features: [
      {
        title: 'Pré-vérification ADEME intelligente',
        description:
          'Surface, chauffage, isolation, dimensionnement, typologie. 95 % des erreurs courantes filtrées.',
        status: 'Inclus',
      },
      {
        title: 'Validation cohérence basique',
        description:
          '« Surface 100m² + chaudière 5kW = à vérifier ». Règles métier intégrées, sans appel IA externe.',
        status: 'Inclus',
      },
      {
        title: 'Détection de fraude DPE 4 patterns',
        description:
          'Étiquettes suspectes, sauts de classe, incohérences typologiques, données aberrantes. Conformité Décret 2023-417.',
        status: 'Inclus',
      },
      {
        title: 'Coach IA personnel',
        description:
          'Assistant conversationnel contextualisé métier. Tes questions réglementaires trouvent réponse en 3 secondes.',
        status: 'Inclus',
      },
      {
        title: 'Vision IA reconnaissance équipement',
        description:
          'Détection automatique des chaudières, étiquettes énergétiques, types de fenêtres sur photos.',
        status: 'V2',
      },
      {
        title: 'Génération recommandations post-DPE F/G',
        description:
          'Liste personnalisée des travaux et aides MaPrimeRénov à partir des données saisies.',
        status: 'V2',
      },
    ],
  },
  {
    name: 'Exports',
    intro:
      'Vos données vous appartiennent. Compatibles avec les quatre éditeurs majeurs du marché — Liciel, OBBC, AnalysImmo, ORIS — plus formats universels portables.',
    features: [
      {
        title: 'Export PDF',
        description:
          'Rapport complet, prêt à transmettre au client. Branding cabinet personnalisable.',
        status: 'Inclus',
      },
      {
        title: 'Export Word (.docx)',
        description: 'Modifiable pour les ajustements manuels post-export.',
        status: 'Inclus',
      },
      {
        title: 'Export CSV',
        description: 'Format universel pour vos tableurs et outils statistiques.',
        status: 'Inclus',
      },
      {
        title: 'Export JSON',
        description: 'Format machine pour intégrations avancées.',
        status: 'Inclus',
      },
      {
        title: 'Export ZIP Liciel',
        description: 'Format ZIP générique compatible « Importer format ZIP » de Liciel.',
        status: 'Inclus',
      },
      {
        title: 'Imports spécifiques XML Liciel / OBBC',
        description:
          'Passerelles publiques Liciel et OBBC (Imports spécifiques XML + Excel). Voie d’import la plus solide (priorité 1).',
        status: 'Inclus',
      },
      {
        title: 'Export XML CII AnalysImmo',
        description:
          'Format AnalysImmo standard, ZIP générique en complément. Bouton « Partager » reconnaît automatiquement le format cible.',
        status: 'Inclus',
      },
      {
        title: 'Export ZIP + JSON ORIS',
        description:
          'Format ORIS via ZIP générique + JSON structuré. Import direct dans votre passerelle ADEME ORIS.',
        status: 'Inclus',
      },
      {
        title: 'Bouton « Partager » 3 modes',
        description:
          'Email vers vous-même, sync Google Drive automatique, téléchargement direct. 30 secondes vs 1h30 quel que soit votre éditeur (Liciel, OBBC, AnalysImmo, ORIS).',
        status: 'Inclus',
      },
    ],
  },
  {
    name: 'Annuaire & Leads',
    intro:
      'Votre présence publique sur kovas.fr. Les particuliers vous trouvent, vous recevez des demandes qualifiées.',
    features: [
      {
        title: 'Fiche publique professionnelle',
        description: 'URL kovas.fr/diag/votre-nom. Référencement Google natif, optimisé SEO local.',
        status: 'Inclus',
      },
      {
        title: 'Leads calculateur DPE gratuit',
        description:
          'Outil grand public propulsé par KOVAS. Chaque demande qualifiée est routée au diagnostiqueur le plus proche.',
        status: 'Inclus',
      },
      {
        title: 'Page mes-demandes',
        description:
          'Tableau de bord des leads reçus, statuts (à contacter, contacté, converti, refusé), historique.',
        status: 'Inclus',
      },
      {
        title: 'Réponse en un clic',
        description: 'Devis automatique pré-rempli à partir des informations du lead.',
        status: 'V1.5',
      },
    ],
  },
  {
    name: 'Facturation',
    intro: "Devis, factures, relances. Conforme à la séquentialité légale et à l'attestation LAFT.",
    features: [
      {
        title: 'Génération de devis',
        description: 'Création en 30 secondes depuis une mission. Modèle personnalisable.',
        status: 'Inclus',
      },
      {
        title: 'Factures séquentielles',
        description: "Numérotation continue conforme à l'article 289 du CGI.",
        status: 'Inclus',
      },
      {
        title: 'Relances automatiques',
        description:
          'J+15, J+30, J+45 paramétrables. Ton personnalisable, signature humaine optionnelle.',
        status: 'Inclus',
      },
      {
        title: 'Attestation LAFT',
        description:
          'Attestation de conformité à la loi anti-fraude TVA générée automatiquement chaque exercice.',
        status: 'Inclus',
      },
      {
        title: 'Avoirs et factures rectificatives',
        description: "Avec lien direct vers la facture d'origine, traçabilité complète.",
        status: 'Inclus',
      },
    ],
  },
  {
    name: 'Comptabilité',
    intro:
      'Connecteurs PDP avec les comptables et banques pros. Vos exports comptables en un clic.',
    features: [
      {
        title: 'Connecteur Qonto',
        description: 'Synchronisation des paiements reçus avec les factures émises.',
        status: 'Inclus',
      },
      {
        title: 'Connecteur Pennylane',
        description: 'Export automatique des factures vers votre cabinet comptable.',
        status: 'Inclus',
      },
      {
        title: 'Connecteur Indy',
        description: 'Synchronisation TVA + IS pour micro-entreprises et BNC simplifié.',
        status: 'V1.5',
      },
      {
        title: 'Connecteur Tiime',
        description: 'Export comptable certifié, modèle dédié diagnostiqueurs immobiliers.',
        status: 'V1.5',
      },
    ],
  },
  {
    name: 'Conformité',
    intro: 'RGPD, Décret 2023-417, eIDAS. KOVAS prend en charge la conformité réglementaire.',
    features: [
      {
        title: 'Conformité RGPD',
        description:
          "Hébergement Paris (eu-west-3), chiffrement bout-en-bout, consentements, droit à l'oubli, export 1 clic.",
        status: 'Inclus',
      },
      {
        title: 'Décret 2023-417',
        description:
          'Traçabilité, anti-fraude DPE, journalisation horodatée des saisies et exports.',
        status: 'Inclus',
      },
      {
        title: 'Signature eIDAS Yousign',
        description:
          'Option ponctuelle 2€ / signature pour les documents nécessitant valeur probante.',
        status: 'Inclus',
      },
      {
        title: 'Attestation LAFT facturation',
        description: "Générée automatiquement chaque exercice, opposable à l'administration.",
        status: 'Inclus',
      },
    ],
  },
  {
    name: 'Mobile',
    intro:
      'PWA Next.js installable comme une app native. Offline complet, sync différée, dark mode.',
    features: [
      {
        title: 'PWA installable iOS / Android',
        description:
          "Ajoutez à l'écran d'accueil, KOVAS se lance comme une app native. Aucun App Store nécessaire.",
        status: 'Inclus',
      },
      {
        title: 'Mode offline complet',
        description:
          'Service Worker + IndexedDB Dexie. Travaillez sans réseau, sync différée automatique au retour en ligne.',
        status: 'Inclus',
      },
      {
        title: 'Sync mobile / web temps réel',
        description: 'Démarrez sur iPad terrain, finissez sur le Mac au bureau. Realtime Supabase.',
        status: 'Inclus',
      },
      {
        title: 'Dark mode auto',
        description: 'Suit la préférence système, override manuel possible dans le profil.',
        status: 'Inclus',
      },
    ],
  },
]

function StatusBadge({ status }: { status: Status }) {
  if (status === 'Inclus') {
    return <Badge variant="green">Inclus</Badge>
  }
  if (status === 'V1.5') {
    return <Badge variant="blue">V1.5</Badge>
  }
  return <Badge variant="muted">V2</Badge>
}

export default function FonctionnalitesPage() {
  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-16">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Catalogue complet</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            Toutes les{' '}
            <span className="text-display-serif text-chartreuse-deep">fonctionnalités</span> KOVAS
          </h1>
          <p className="text-ink-mute">
            Plus de 60 fonctionnalités regroupées en 8 catégories métier. Toutes incluses dans tous
            les tiers, surplus à l&apos;usage.
          </p>
        </div>

        <div className="space-y-16">
          {CATEGORIES.map((category) => (
            <section key={category.name} className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h2>
                <p className="max-w-3xl text-ink-mute">{category.intro}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {category.features.map((feature) => (
                  <Card
                    key={feature.title}
                    variant="opaque"
                    padding="sm"
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-tight">{feature.title}</h3>
                      <StatusBadge status={feature.status} />
                    </div>
                    <p className="text-sm text-ink-mute">{feature.description}</p>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex justify-center pt-6">
          <Button size="lg" variant="accent" asChild>
            <Link href="/signup">
              Démarrer mon essai gratuit <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
