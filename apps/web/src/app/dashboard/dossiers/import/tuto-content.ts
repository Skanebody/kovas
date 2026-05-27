/**
 * Contenu des tutoriels d'export par logiciel diag (étape 2 du wizard).
 *
 * ⚠️ TODO terrain — les libellés ci-dessous (sauf 'autre' qui est volontairement
 * générique) sont des placeholders. Benjamin doit valider les vrais menus de
 * chaque logiciel et mettre à jour ce fichier :
 *
 *   1. Capture d'écran du menu d'export (chemin exact)
 *   2. Libellés exacts des cases à cocher (clients, biens, copros, etc.)
 *   3. Liste des formats proposés (CSV / Excel / XML / autre)
 *   4. Nom exact du bouton "Exporter" / "Télécharger"
 *
 * Stocké en TypeScript (pas MDX) pour rester simple + typé. Si besoin
 * de rich text plus tard, migrer vers content/tutos/*.mdx.
 *
 * V1 : Liciel a 6 steps détaillés, AnalysImmo / OBBC / ORIS ont des
 * placeholders structurés, Autre a un tuto générique court.
 */

import type { SourceLogiciel } from '@/lib/import/types'

export interface TutoStepContent {
  /** Numéro affiché à gauche de chaque étape ("1.", "2.", …) */
  num: number
  /** Titre court de l'étape (1 ligne) */
  title: string
  /** Description longue. Peut contenir des espaces réservés [VÉRIFIER]. */
  body: string
  /** Slug d'illustration / capture d'écran à afficher à côté (optionnel). */
  screenshot?: string
  /** Texte affiché en footer de l'étape (warning, hint, etc.) */
  hint?: string
}

const LICIEL_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvre Liciel et connecte-toi à ton compte',
    body: "Lance ton logiciel Liciel Diagnostics habituel sur ton poste de travail. Connecte-toi avec tes identifiants. Si tu utilises la version réseau ou multi-postes, assure-toi d'être connecté avec un compte administrateur (l'export n'est généralement accessible qu'aux comptes admin).",
    screenshot: 'liciel-step-1-login',
    hint: "Si tu n'as pas Liciel installé sur ce poste, fais l'export depuis l'ordinateur où tu l'utilises habituellement, puis transfère le fichier ici.",
  },
  {
    num: 2,
    title: "Ouvre le menu d'administration",
    body: "Dans la barre de menu principale, clique sur **« [VÉRIFIER LICIEL : nom exact du menu — probablement « Administration », « Outils » ou « Données » ]»**. Selon ta version de Liciel, ce menu peut s'appeler différemment.",
    screenshot: 'liciel-step-2-menu',
  },
  {
    num: 3,
    title: 'Sélectionne « Exporter mes données »',
    body: "Clique sur **« [VÉRIFIER LICIEL : libellé exact, ex. « Exporter mes données », « Sauvegarde », « Export base » ]»**. Liciel ouvre une nouvelle fenêtre d'options d'export.",
    screenshot: 'liciel-step-3-export-menu',
  },
  {
    num: 4,
    title: 'Coche les éléments à exporter',
    body: 'Sélectionne :\n\n- ☑ **Clients** (recommandé — tes coordonnées clients)\n- ☑ **Biens / Logements** (recommandé — adresses + caractéristiques)\n- ☑ **Copropriétés** (recommandé si tu en gères)\n- ☑ **Historique des diagnostics** (recommandé — évite de re-saisir un bien déjà visité)\n- ☐ **Rapports PDF complets** (optionnel — gros volume, peut être ignoré pour gagner du temps)',
    screenshot: 'liciel-step-4-checkboxes',
    hint: "Les rapports PDF restent dans Liciel — tu dois les y conserver selon la réglementation (10 ans pour la plupart, 50 ans pour l'amiante). KOVAS ne les remplace pas.",
  },
  {
    num: 5,
    title: "Choisis le format d'export",
    body: "Sélectionne l'un des formats disponibles : **CSV**, **Excel (.xlsx)**, **XML**, ou **ZIP**. KOVAS accepte tous les formats Liciel courants — peu importe lequel tu choisis, l'analyse automatique détectera la structure.",
    screenshot: 'liciel-step-5-format',
    hint: 'Si tu as le choix : CSV est le plus rapide à analyser, XML le plus complet.',
  },
  {
    num: 6,
    title: 'Clique sur Exporter, télécharge le fichier',
    body: "Clique sur **« [VÉRIFIER LICIEL : libellé bouton, ex. « Exporter », « Lancer l'export », « Télécharger » ]»**. Liciel prépare le fichier (peut prendre 30 secondes à 2 minutes selon le volume) et te propose de le sauvegarder sur ton ordinateur. Note bien l'emplacement de sauvegarde — tu en auras besoin à l'étape suivante.",
    screenshot: 'liciel-step-6-download',
    hint: 'Le fichier exporté est en clair (non chiffré). Conserve-le dans un dossier sécurisé et supprime-le après import dans KOVAS.',
  },
]

const ANALYSIMMO_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvre AnalysImmo et connecte-toi',
    body: "Lance AnalysImmo sur ton poste habituel. Connecte-toi avec un compte ayant les droits d'export (généralement administrateur).",
    hint: 'TODO ANALYSIMMO : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Ouvre le menu d'export",
    body: "Clique sur **« [TODO ANALYSIMMO : nom exact du menu — probablement « Fichier », « Données » ou « Administration » ]»** puis sélectionne l'entrée d'export.",
  },
  {
    num: 3,
    title: 'Sélectionne les données à exporter',
    body: 'Coche :\n\n- ☑ **Clients**\n- ☑ **Biens**\n- ☑ **Copropriétés** (si applicable)\n- ☑ **Historique diagnostics**',
    hint: 'TODO ANALYSIMMO : noms exacts des cases à cocher à vérifier.',
  },
  {
    num: 4,
    title: 'Choisis le format CSV ou Excel',
    body: "Privilégie **CSV** si disponible — c'est le format le mieux supporté par KOVAS. Sinon, Excel (.xlsx) fonctionnera aussi.",
  },
  {
    num: 5,
    title: 'Télécharge le fichier',
    body: "Clique sur **« [TODO ANALYSIMMO : libellé bouton ]»** et sauvegarde le fichier sur ton ordinateur. Tu en auras besoin à l'étape suivante.",
    hint: 'Conserve le fichier dans un dossier sécurisé — il contient des données personnelles.',
  },
]

const OBBC_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvre OBBC et connecte-toi',
    body: "Lance OBBC sur ton poste habituel avec un compte ayant les droits d'export.",
    hint: 'TODO OBBC : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Accède à l'export de la base",
    body: "Clique sur **« [TODO OBBC : chemin du menu d'export ]»**.",
  },
  {
    num: 3,
    title: 'Sélectionne les éléments',
    body: 'Coche **Clients**, **Biens**, **Copropriétés** et **Historique des diagnostics**.',
    hint: 'TODO OBBC : libellés exacts à vérifier.',
  },
  {
    num: 4,
    title: 'Format CSV ou Excel',
    body: 'Choisis CSV (recommandé) ou Excel (.xlsx).',
  },
  {
    num: 5,
    title: 'Télécharge le fichier',
    body: "Sauvegarde le fichier sur ton ordinateur. Tu l'enverras à KOVAS à l'étape suivante.",
  },
]

const ORIS_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvre ORIS et connecte-toi',
    body: "Lance ORIS sur ton poste habituel avec un compte ayant les droits d'export.",
    hint: 'TODO ORIS : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Accédez à l'export de la base",
    body: "Clique sur **« [TODO ORIS : chemin du menu d'export ]»**.",
  },
  {
    num: 3,
    title: 'Sélectionne les éléments',
    body: 'Coche **Clients**, **Biens**, **Copropriétés** et **Historique des diagnostics**.',
    hint: 'TODO ORIS : libellés exacts à vérifier.',
  },
  {
    num: 4,
    title: 'Format CSV ou Excel',
    body: 'Choisis CSV (recommandé) ou Excel (.xlsx).',
  },
  {
    num: 5,
    title: 'Télécharge le fichier',
    body: "Sauvegarde le fichier sur ton ordinateur. Tu l'enverras à KOVAS à l'étape suivante.",
  },
]

const AUTRE_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: "Trouve la fonction d'export dans ton logiciel",
    body: "L'export est souvent dans le menu **Outils**, **Administration**, **Données** ou **Fichier**. Certains logiciels appellent ça « Sauvegarde » ou « Export base ».",
    hint: 'Si tu ne trouves pas, regarde dans les paramètres du logiciel ou consulte sa documentation.',
  },
  {
    num: 2,
    title: 'Coche les éléments à exporter',
    body: "Sélectionne au minimum :\n\n- ☑ **Clients**\n- ☑ **Biens / Logements**\n- ☑ **Copropriétés** (si applicable)\n\nL'historique des diagnostics est utile mais facultatif.",
  },
  {
    num: 3,
    title: 'Exporte en CSV ou Excel',
    body: "Privilégie **CSV** si proposé — c'est le format le mieux supporté. Sinon, **Excel (.xlsx)** fonctionne aussi.",
    hint: 'Les formats XML et ZIP (de PDFs) ne sont pas encore supportés en V1.',
  },
  {
    num: 4,
    title: 'Télécharge le fichier',
    body: 'Sauvegarde le fichier exporté sur ton ordinateur, dans un dossier sécurisé.',
  },
  {
    num: 5,
    title: 'Importe dans KOVAS',
    body: "KOVAS détectera automatiquement la structure de ton fichier via IA, même si le format est inhabituel. Tu valideras les correspondances à l'étape suivante.",
    hint: 'En cas de doute sur la structure, contacte le support KOVAS — on regardera ensemble.',
  },
]

/**
 * Tutoriels d'export par logiciel source. V1 : Liciel détaillé, les autres
 * sont des squelettes (à compléter sur fixtures terrain) + 'autre' générique.
 */
export const EXPORT_TUTORIALS: Record<SourceLogiciel, TutoStepContent[]> = {
  liciel: LICIEL_EXPORT_STEPS,
  analysimmo: ANALYSIMMO_EXPORT_STEPS,
  obbc: OBBC_EXPORT_STEPS,
  oris: ORIS_EXPORT_STEPS,
  autre: AUTRE_EXPORT_STEPS,
}

/**
 * Liens d'aide affichés en bas de l'étape 2.
 */
export const TUTO_HELP_LINKS = [
  {
    label: 'Tutoriel vidéo (2 min)',
    href: '#tuto-video', // TODO : URL Vimeo / YouTube quand vidéo prête
    icon: 'PlayCircle' as const,
  },
  {
    label: 'Contacter le support KOVAS',
    href: 'mailto:contact@kovas.fr?subject=Aide%20import%20base',
    icon: 'LifeBuoy' as const,
  },
] as const
