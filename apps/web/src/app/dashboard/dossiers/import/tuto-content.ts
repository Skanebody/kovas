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
    title: 'Ouvrez Liciel et connectez-vous à votre compte',
    body: "Lancez votre logiciel Liciel Diagnostics habituel sur votre poste de travail. Connectez-vous avec vos identifiants. Si vous utilisez la version réseau ou multi-postes, assurez-vous d'être connecté avec un compte administrateur (l'export n'est généralement accessible qu'aux comptes admin).",
    screenshot: 'liciel-step-1-login',
    hint: "Si vous n'avez pas Liciel installé sur ce poste, faites l'export depuis l'ordinateur où vous l'utilisez habituellement, puis transférez le fichier ici.",
  },
  {
    num: 2,
    title: "Ouvrez le menu d'administration",
    body: "Dans la barre de menu principale, cliquez sur **« [VÉRIFIER LICIEL : nom exact du menu — probablement « Administration », « Outils » ou « Données » ]»**. Selon votre version de Liciel, ce menu peut s'appeler différemment.",
    screenshot: 'liciel-step-2-menu',
  },
  {
    num: 3,
    title: 'Sélectionnez « Exporter mes données »',
    body: "Cliquez sur **« [VÉRIFIER LICIEL : libellé exact, ex. « Exporter mes données », « Sauvegarde », « Export base » ]»**. Liciel ouvre une nouvelle fenêtre d'options d'export.",
    screenshot: 'liciel-step-3-export-menu',
  },
  {
    num: 4,
    title: 'Cochez les éléments à exporter',
    body: 'Sélectionnez :\n\n- ☑ **Clients** (recommandé — vos coordonnées clients)\n- ☑ **Biens / Logements** (recommandé — adresses + caractéristiques)\n- ☑ **Copropriétés** (recommandé si vous en gérez)\n- ☑ **Historique des diagnostics** (recommandé — évite de re-saisir un bien déjà visité)\n- ☐ **Rapports PDF complets** (optionnel — gros volume, peut être ignoré pour gagner du temps)',
    screenshot: 'liciel-step-4-checkboxes',
    hint: "Les rapports PDF restent dans Liciel — vous devez les y conserver selon la réglementation (10 ans pour la plupart, 50 ans pour l'amiante). KOVAS ne les remplace pas.",
  },
  {
    num: 5,
    title: "Choisissez le format d'export",
    body: "Sélectionnez l'un des formats disponibles : **CSV**, **Excel (.xlsx)**, **XML**, ou **ZIP**. KOVAS accepte tous les formats Liciel courants — peu importe lequel vous choisissez, l'analyse automatique détectera la structure.",
    screenshot: 'liciel-step-5-format',
    hint: 'Si vous avez le choix : CSV est le plus rapide à analyser, XML le plus complet.',
  },
  {
    num: 6,
    title: 'Cliquez sur Exporter, téléchargez le fichier',
    body: "Cliquez sur **« [VÉRIFIER LICIEL : libellé bouton, ex. « Exporter », « Lancer l'export », « Télécharger » ]»**. Liciel prépare le fichier (peut prendre 30 secondes à 2 minutes selon le volume) et vous propose de le sauvegarder sur votre ordinateur. Notez bien l'emplacement de sauvegarde — vous en aurez besoin à l'étape suivante.",
    screenshot: 'liciel-step-6-download',
    hint: 'Le fichier exporté est en clair (non chiffré). Conservez-le dans un dossier sécurisé et supprimez-le après import dans KOVAS.',
  },
]

const ANALYSIMMO_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvrez AnalysImmo et connectez-vous',
    body: "Lancez AnalysImmo sur votre poste habituel. Connectez-vous avec un compte ayant les droits d'export (généralement administrateur).",
    hint: 'TODO ANALYSIMMO : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Ouvrez le menu d'export",
    body: "Cliquez sur **« [TODO ANALYSIMMO : nom exact du menu — probablement « Fichier », « Données » ou « Administration » ]»** puis sélectionnez l'entrée d'export.",
  },
  {
    num: 3,
    title: 'Sélectionnez les données à exporter',
    body: 'Cochez :\n\n- ☑ **Clients**\n- ☑ **Biens**\n- ☑ **Copropriétés** (si applicable)\n- ☑ **Historique diagnostics**',
    hint: 'TODO ANALYSIMMO : noms exacts des cases à cocher à vérifier.',
  },
  {
    num: 4,
    title: 'Choisissez le format CSV ou Excel',
    body: "Privilégiez **CSV** si disponible — c'est le format le mieux supporté par KOVAS. Sinon, Excel (.xlsx) fonctionnera aussi.",
  },
  {
    num: 5,
    title: 'Téléchargez le fichier',
    body: "Cliquez sur **« [TODO ANALYSIMMO : libellé bouton ]»** et sauvegardez le fichier sur votre ordinateur. Vous en aurez besoin à l'étape suivante.",
    hint: 'Conservez le fichier dans un dossier sécurisé — il contient des données personnelles.',
  },
]

const OBBC_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvrez OBBC et connectez-vous',
    body: "Lancez OBBC sur votre poste habituel avec un compte ayant les droits d'export.",
    hint: 'TODO OBBC : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Accédez à l'export de la base",
    body: "Cliquez sur **« [TODO OBBC : chemin du menu d'export ]»**.",
  },
  {
    num: 3,
    title: 'Sélectionnez les éléments',
    body: 'Cochez **Clients**, **Biens**, **Copropriétés** et **Historique des diagnostics**.',
    hint: 'TODO OBBC : libellés exacts à vérifier.',
  },
  {
    num: 4,
    title: 'Format CSV ou Excel',
    body: 'Choisissez CSV (recommandé) ou Excel (.xlsx).',
  },
  {
    num: 5,
    title: 'Téléchargez le fichier',
    body: "Sauvegardez le fichier sur votre ordinateur. Vous l'enverrez à KOVAS à l'étape suivante.",
  },
]

const ORIS_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: 'Ouvrez ORIS et connectez-vous',
    body: "Lancez ORIS sur votre poste habituel avec un compte ayant les droits d'export.",
    hint: 'TODO ORIS : libellés exacts à vérifier sur fixture terrain (Sprint 15+).',
  },
  {
    num: 2,
    title: "Accédez à l'export de la base",
    body: "Cliquez sur **« [TODO ORIS : chemin du menu d'export ]»**.",
  },
  {
    num: 3,
    title: 'Sélectionnez les éléments',
    body: 'Cochez **Clients**, **Biens**, **Copropriétés** et **Historique des diagnostics**.',
    hint: 'TODO ORIS : libellés exacts à vérifier.',
  },
  {
    num: 4,
    title: 'Format CSV ou Excel',
    body: 'Choisissez CSV (recommandé) ou Excel (.xlsx).',
  },
  {
    num: 5,
    title: 'Téléchargez le fichier',
    body: "Sauvegardez le fichier sur votre ordinateur. Vous l'enverrez à KOVAS à l'étape suivante.",
  },
]

const AUTRE_EXPORT_STEPS: TutoStepContent[] = [
  {
    num: 1,
    title: "Trouvez la fonction d'export dans votre logiciel",
    body: "L'export est souvent dans le menu **Outils**, **Administration**, **Données** ou **Fichier**. Certains logiciels appellent ça « Sauvegarde » ou « Export base ».",
    hint: 'Si vous ne trouvez pas, regardez dans les paramètres du logiciel ou consultez sa documentation.',
  },
  {
    num: 2,
    title: 'Cochez les éléments à exporter',
    body: "Sélectionnez au minimum :\n\n- ☑ **Clients**\n- ☑ **Biens / Logements**\n- ☑ **Copropriétés** (si applicable)\n\nL'historique des diagnostics est utile mais facultatif.",
  },
  {
    num: 3,
    title: 'Exportez en CSV ou Excel',
    body: "Privilégiez **CSV** si proposé — c'est le format le mieux supporté. Sinon, **Excel (.xlsx)** fonctionne aussi.",
    hint: 'Les formats XML et ZIP (de PDFs) ne sont pas encore supportés en V1.',
  },
  {
    num: 4,
    title: 'Téléchargez le fichier',
    body: 'Sauvegardez le fichier exporté sur votre ordinateur, dans un dossier sécurisé.',
  },
  {
    num: 5,
    title: 'Importez dans KOVAS',
    body: "KOVAS détectera automatiquement la structure de votre fichier via IA, même si le format est inhabituel. Vous validerez les correspondances à l'étape suivante.",
    hint: 'En cas de doute sur la structure, contactez le support KOVAS — on regardera ensemble.',
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
