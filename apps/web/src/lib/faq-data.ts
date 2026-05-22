/**
 * Contenu FAQ KOVAS — corrigé pour refléter l'état réel V1.
 *
 * Sources de vérité :
 * - CLAUDE.md §3 (10 features V1)
 * - CLAUDE.md §4 (tarifs : Découverte 29€/20 missions, Standard 59€/60 missions,
 *   Volume 99€/150 missions)
 * - CLAUDE.md §8 (hébergement Supabase eu-west-3 Paris)
 * - CLAUDE.md §15 (Hiscox Phase 1 : 500k€/sinistre, 1M€/an)
 *
 * Claims retirés de la spec originale (factuellement faux V1) :
 *  - Passkeys biométriques (non implémenté)
 *  - Génération automatique 7 rapports (rejeté V1, cf. docs/report-templates.md)
 *  - Envoi 1 clic avec tracking ouverture/clic (non implémenté)
 *  - Compteur DPE 1000/an avec alertes (V1.5)
 *  - Hébergement Frankfurt (faux, c'est Paris)
 *  - Hiscox 2M€ (Phase 2)
 *  - Tests pénétration semestriels (non planifié)
 *
 * Format des réponses : markdown light supporté par le renderer :
 *  - \n\n = nouveau paragraphe
 *  - "- " en début de ligne = bullet list
 *  - "1. " "2. " en début de ligne = numbered list
 *  - **texte** = bold inline
 */

export interface FaqQuestion {
  /** Slug d'ancre, ex: 'demarrer-mission' */
  id: string
  question: string
  /** Réponse en markdown light (paragraphes, bullets, bold) */
  answer: string
}

export interface FaqCategory {
  id: string
  title: string
  description: string
  questions: FaqQuestion[]
}

/**
 * 5 questions stratégiques pour la section FAQ landing.
 */
export const FAQ_LANDING: FaqQuestion[] = [
  {
    id: 'quest-ce-que-kovas',
    question: "Qu'est-ce que KOVAS ?",
    answer:
      "KOVAS est l'application française dédiée aux diagnostiqueurs immobiliers qui automatise la saisie terrain grâce à l'intelligence artificielle. Saisie vocale structurée par pièce (Whisper + IA hybride), photos géolocalisées et nommées automatiquement, templates de pièces pré-remplis (T2/T3/T4/T5), check-lists par type de diagnostic, upload de documents par les propriétaires via lien sécurisé, validation de cohérence basique, et exports universels (PDF, Word, CSV, JSON, ZIP Liciel).\n\nKOVAS fonctionne sur smartphone, tablette et ordinateur, en ligne comme hors connexion (PWA installable), et s'intègre nativement avec Liciel et les principaux logiciels métier du secteur.",
  },
  {
    id: 'combien-coute-kovas',
    question: 'Combien coûte KOVAS ?',
    answer:
      'KOVAS propose 3 formules HT par mois sans engagement de durée :\n\n- **Découverte 29€** : 20 missions incluses, surplus 2€/mission, 1 utilisateur, 20 Go de stockage\n- **Standard 59€** (recommandé) : 60 missions incluses, surplus 1,50€/mission, 1 utilisateur, 50 Go\n- **Volume 99€** : 150 missions incluses, surplus 1€/mission, 1 utilisateur, 100 Go\n\nToutes les fonctionnalités sont incluses dans chaque formule. Le paiement annuel offre 2 mois offerts (10 mois payés sur 12).',
  },
  {
    id: 'essai-gratuit',
    question: 'Y a-t-il un essai gratuit pour tester KOVAS ?',
    answer:
      "Oui, KOVAS offre **30 jours d'essai gratuit complet**, sans restriction de missions ni de fonctionnalités : saisie vocale, photos terrain, exports vers Liciel, partage des dossiers, lien d'upload pour les documents propriétaire.\n\nUne carte bancaire est demandée à l'inscription pour valider votre identité professionnelle (Setup Intent Stripe — aucun débit pendant l'essai). À J+30, votre abonnement est automatiquement activé au tarif du forfait choisi. Vous pouvez résilier à tout moment en 2 clics depuis votre espace, sans frais ni justification. Si vous résiliez pendant l'essai, vos données restent accessibles 30 jours supplémentaires en lecture seule avant suppression définitive.",
  },
  {
    id: 'compatible-liciel',
    question: 'KOVAS est-il compatible avec Liciel ?',
    answer:
      "Oui, KOVAS est conçu pour compléter Liciel sans le remplacer. Le diagnostiqueur saisit les données terrain dans KOVAS (saisie vocale, photos, mesures), puis exporte le dossier en un clic au format ZIP Liciel officiel (base Access MDB, fichiers XML, photos organisées par pièce, documents propriétaire). Liciel calcule le DPE et le transmet à l'ADEME.\n\nCe workflow hybride économise environ 1h30 par mission DPE typique par rapport à une saisie complète dans Liciel uniquement. KOVAS est également compatible avec OBBC, AnalysImmo et la plupart des logiciels métier via export universel (PDF, Word, CSV, JSON).",
  },
  {
    id: 'donnees-securisees',
    question: 'Mes données sont-elles sécurisées avec KOVAS ?',
    answer:
      "Oui. Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256 via Supabase), stockées exclusivement en Europe (Supabase **eu-west-3, Paris**). KOVAS est conforme RGPD avec garantie de tous vos droits (accès, rectification, effacement, portabilité). Vos données ne sont jamais utilisées pour entraîner des modèles d'intelligence artificielle ni partagées avec des tiers à des fins commerciales.\n\nL'authentification se fait par email + mot de passe sécurisé, avec authentification à deux facteurs (2FA) disponible. KOVAS souscrit une assurance Hiscox RC Pro avec couverture cyber et défense juridique.",
  },
]

/**
 * 48 questions réparties en 8 catégories pour la FAQ dédiée /faq.
 */
export const FAQ_CATEGORIES: FaqCategory[] = [
  // ============================================
  // Cat 1 — Mode d'emploi KOVAS
  // ============================================
  {
    id: 'mode-emploi',
    title: "Mode d'emploi KOVAS",
    description: 'Premiers pas, saisie terrain, exports, partage des dossiers.',
    questions: [
      {
        id: 'demarrer-premiere-mission',
        question: 'Comment démarrer ma première mission dans KOVAS ?',
        answer:
          "Pour démarrer votre première mission :\n\n1. Créez un nouveau dossier depuis le bouton \"+ Nouveau dossier\" du tableau de bord\n2. Renseignez l'identité du bien (adresse via l'API BAN qui pré-remplit automatiquement, année de construction, surface)\n3. Ajoutez les diagnostics souhaités (DPE, amiante, plomb, gaz, électricité, termites, Carrez, ERP)\n4. Envoyez le lien d'upload public à votre client par email ou SMS pour qu'il vous transmette ses documents (factures EDF, anciens DPE, plans)\n5. Le jour du rendez-vous, ouvrez le dossier et utilisez le mode mission pour la saisie vocale et les photos terrain",
      },
      {
        id: 'saisie-vocale',
        question: 'Comment fonctionne la saisie vocale dans KOVAS ?',
        answer:
          "La saisie vocale transcrit et structure automatiquement vos observations terrain. Appuyez sur le bouton micro depuis n'importe quelle pièce du dossier et décrivez à voix haute, par exemple : « Salon de 25 mètres carrés, plancher chauffant gaz, double vitrage récent, radiateurs en fonte ».\n\nL'intelligence artificielle utilise **Whisper d'OpenAI** pour la transcription et un parser custom + **Claude Haiku** pour l'extraction d'entités (type de pièce, surface, type de chauffage, équipements). Vous validez ou corrigez les informations en un clic. La saisie vocale fonctionne en français.",
      },
      {
        id: 'photos-organisation',
        question: 'Comment prendre et organiser les photos dans KOVAS ?',
        answer:
          "Les photos sont optimisées automatiquement : compression WebP qualité 0.75, redimensionnement maximal 1920×1080, géolocalisation EXIF si autorisée, nommage du fichier automatique au format `date_pièce_index_typeVue_référence.webp`.\n\nPour prendre une photo, sélectionnez d'abord la pièce concernée, puis le type de vue (vue générale, radiateur, chaudière, plaque signalétique, étiquette énergétique, etc.). Cliquez sur « Prendre photo(s) » — vous pouvez en prendre plusieurs successivement avec la caméra de votre smartphone ou tablette. Les photos sont automatiquement liées au dossier et à la pièce sélectionnée.",
      },
      {
        id: 'export-liciel',
        question: 'Comment exporter un dossier KOVAS vers Liciel ?',
        answer:
          "Ouvrez le dossier concerné, vérifiez que les missions sont marquées comme « Terminées sur le terrain », puis cliquez sur « Partager vers Liciel ». KOVAS génère automatiquement un fichier ZIP au format Liciel officiel contenant la base Access MDB, les fichiers XML structurés par diagnostic, les photos organisées par pièce, et les documents propriétaire.\n\n3 modes de partage disponibles : email à vous-même, synchronisation automatique Google Drive ou Dropbox, ou téléchargement direct. Vous importez ensuite le ZIP dans Liciel via son interface d'import standard. L'opération complète prend généralement 30 secondes à 1 minute, contre 1h30 à 2h pour une re-saisie complète manuelle.",
      },
      {
        id: 'transmettre-rapport-client',
        question: 'Comment KOVAS facilite-t-il la transmission du rapport au client ?',
        answer:
          "KOVAS centralise tous les rapports et documents dans le dossier client pour faciliter la transmission. Une fois votre rapport finalisé (PDF Liciel certifié pour le DPE, rapport généré par votre logiciel actuel pour les autres diagnostics), vous le téléchargez depuis le dossier et l'envoyez via votre messagerie habituelle ou plateforme client.\n\nLe rapport est archivé dans KOVAS avec ses métadonnées (date, photos preuves, notes vocales liées) pour la durée légale applicable : **10 ans** pour la plupart des diagnostics, **50 ans** pour l'amiante. Cette traçabilité protège votre certification en cas de contrôle DGCCRF ou organisme certificateur.",
      },
      {
        id: 'lien-upload-client',
        question: "Comment fonctionne le lien d'upload pour les documents client ?",
        answer:
          "Pour chaque dossier, KOVAS génère un lien d'upload public sécurisé que vous pouvez envoyer à votre client par email ou SMS avant le rendez-vous. Le client ouvre le lien depuis n'importe quel navigateur, **sans création de compte**, et uploade directement ses documents : factures d'énergie (12 derniers mois pour le DPE), anciens DPE éventuels, plans du bien, documents cadastraux.\n\nLe lien est valable **30 jours**, renouvelable et révocable à tout moment depuis votre interface. Vous voyez la liste des documents reçus directement dans le dossier. Les documents sont chiffrés en transit et stockés en Europe.",
      },
    ],
  },

  // ============================================
  // Cat 2 — Diagnostiqueur immobilier (grand public)
  // ============================================
  {
    id: 'diagnostiqueur-immobilier-guide',
    title: 'Diagnostiqueur immobilier — Guide grand public',
    description:
      'Pour les propriétaires, vendeurs et locataires : comment trouver, choisir et travailler avec un diagnostiqueur.',
    questions: [
      {
        id: 'definition-diagnostiqueur',
        question: "Qu'est-ce qu'un diagnostiqueur immobilier et à quoi sert-il ?",
        answer:
          "Un diagnostiqueur immobilier est un professionnel certifié chargé d'établir les diagnostics techniques obligatoires lors de la vente ou de la location d'un bien immobilier en France. Son rôle est de constater l'état du bien selon des normes précises (présence d'amiante, de plomb, performance énergétique, sécurité gaz et électricité, etc.) et de remettre des rapports officiels qui informent l'acquéreur ou le locataire avant la signature du contrat.\n\nCes diagnostics protègent juridiquement le vendeur ou bailleur en cas de litige ultérieur, et permettent à l'acquéreur de prendre une décision éclairée. Le diagnostiqueur doit être certifié par un organisme accrédité COFRAC pour chaque domaine d'intervention et disposer d'une assurance Responsabilité Civile Professionnelle.",
      },
      {
        id: 'choisir-diagnostiqueur',
        question: 'Comment bien choisir son diagnostiqueur immobilier en France ?',
        answer:
          "Vérifiez ces 5 critères essentiels :\n\n1. **La certification COFRAC** : exigez les attestations à jour pour chaque diagnostic concerné. Vous pouvez vérifier gratuitement sur l'annuaire officiel du Ministère du Logement (annuaire-diagnostiqueurs.gouv.fr)\n2. **L'indépendance** : le diagnostiqueur ne doit avoir aucun lien commercial avec l'agence immobilière qui vend votre bien (interdiction légale)\n3. **L'assurance Responsabilité Civile Professionnelle** : demandez l'attestation. C'est elle qui vous couvrira en cas de défaut de diagnostic découvert plus tard\n4. **Les délais et tarifs transparents** : un bon diagnostiqueur affiche ses tarifs et propose une intervention sous 7 jours en zone urbaine\n5. **Les avis clients** : consultez Google Maps et les avis vérifiés pour évaluer la qualité de service\n\nÉvitez les diagnostiqueurs qui proposent des prix anormalement bas (en dessous de 80€ pour un DPE seul est suspect en 2026) car ils signalent souvent un travail bâclé.",
      },
      {
        id: 'diagnostiqueur-obligatoire',
        question: 'Le diagnostiqueur immobilier est-il obligatoire pour vendre ou louer ?',
        answer:
          "Oui, faire appel à un diagnostiqueur immobilier certifié est obligatoire en France pour toute vente ou location de bien à usage d'habitation. Les diagnostics doivent être annexés au compromis de vente puis à l'acte authentique notarié (vente) ou au bail (location).\n\nEn l'absence de diagnostics obligatoires, le vendeur ou bailleur engage sa responsabilité juridique : l'acquéreur ou le locataire peut demander la résolution du contrat, une réduction du prix de vente, ou des dommages et intérêts. Pour certains diagnostics comme l'amiante, la responsabilité pénale du vendeur peut être engagée. Les notaires refusent généralement de signer une vente sans dossier de diagnostic technique complet.",
      },
      {
        id: 'cout-dossier-complet',
        question: 'Combien coûte un dossier de diagnostic complet en 2026 ?',
        answer:
          "Le coût total d'un dossier de diagnostic technique (DDT) pour la vente varie entre **300€ et 800€ TTC** selon plusieurs facteurs : surface du bien, année de construction (qui détermine les diagnostics obligatoires), zone géographique et nombre de diagnostics nécessaires.\n\nPour un appartement standard de 60 m² construit après 1949 et après 1997, comptez environ 300€ à 450€ (DPE + ERP + gaz + électricité + Carrez). Pour une maison ancienne de 120 m² construite avant 1949, le pack complet peut atteindre 600€ à 800€ (DPE + amiante + plomb + gaz + électricité + termites + ERP + Carrez). Les diagnostiqueurs proposent généralement des tarifs dégressifs sur les packs groupés, économisant 30 à 40% par rapport aux diagnostics séparés.",
      },
      {
        id: 'diagnostics-obligatoires-vente',
        question: 'Quels sont tous les diagnostics obligatoires pour vendre une maison en France ?',
        answer:
          "Les diagnostics obligatoires pour la vente dépendent des caractéristiques du bien :\n\n- **DPE** : obligatoire pour toutes les ventes, validité 10 ans\n- **ERP (État des Risques et Pollutions)** : obligatoire pour tous les biens, validité 6 mois\n- **Amiante** : obligatoire si permis de construire antérieur au 1er juillet 1997, validité illimitée si absence\n- **Plomb CREP** : obligatoire pour les biens construits avant le 1er janvier 1949, validité 1 an si présence\n- **Gaz** : obligatoire pour les installations de plus de 15 ans, validité 3 ans\n- **Électricité** : obligatoire pour les installations de plus de 15 ans, validité 3 ans\n- **Termites** : obligatoire dans les zones définies par arrêté préfectoral, validité 6 mois\n- **Assainissement non collectif** : obligatoire pour les biens non raccordés au tout-à-l'égout, validité 3 ans\n- **Audit énergétique** : obligatoire depuis 2023 pour les classes F/G, étendu aux classes E depuis le 1er janvier 2025\n\nLe mesurage Carrez est par ailleurs obligatoire pour les lots de copropriété (appartements, locaux commerciaux).",
      },
      {
        id: 'difference-vente-location',
        question: 'Quelle est la différence entre les diagnostics pour vente et pour location ?',
        answer:
          'Les diagnostics obligatoires pour la vente sont plus nombreux et plus stricts que pour la location.\n\nPour la **vente** : DPE, ERP, amiante (avant 1997), plomb (avant 1949), gaz (>15 ans), électricité (>15 ans), termites (zones à risque), Carrez (copropriété), assainissement non collectif, audit énergétique (classes E/F/G).\n\nPour la **location**, les diagnostics sont plus limités : DPE, ERP, plomb CREP, gaz, électricité, mesurage Boutin (au lieu de Carrez), et constat des nuisances sonores aériennes dans certaines zones.\n\nLes durées de validité diffèrent : par exemple, le diagnostic gaz est valable 3 ans pour la vente mais 6 ans pour la location.',
      },
      {
        id: 'quand-faire-diagnostics',
        question: 'Combien de temps avant la vente faire les diagnostics immobiliers ?',
        answer:
          "Il est recommandé de faire réaliser les diagnostics immobiliers **2 à 4 semaines avant la mise en vente**. Cette anticipation permet de :\n\n- Disposer du DPE pour les annonces (la classe énergétique est obligatoire dans toute annonce depuis 2011, et le détail des consommations depuis 2022)\n- Prendre connaissance des résultats et prévoir d'éventuels travaux d'amélioration énergétique (notamment pour les classes F/G qui nécessitent un audit énergétique)\n- Comparer plusieurs devis de diagnostiqueurs\n- Organiser le rendez-vous selon votre disponibilité\n\nAttention : l'ERP doit être daté de moins de 6 mois au jour de la signature du compromis, donc inutile de le faire trop tôt si la vente prend du temps.",
      },
      {
        id: 'erreur-rapport-diagnostiqueur',
        question: 'Que faire si le diagnostiqueur a fait une erreur dans son rapport ?',
        answer:
          "Plusieurs recours sont possibles selon la nature de l'erreur :\n\n1. **Contactez le diagnostiqueur directement** pour signaler l'erreur. Il peut corriger gratuitement un rapport ou refaire une visite si l'erreur est manifeste et récente\n2. **Saisissez l'organisme certificateur COFRAC** (Bureau Veritas Certification, AFNOR Certification, etc.) qui a délivré la certification. Une plainte peut entraîner une suspension ou un retrait de certification\n3. **Activez l'assurance Responsabilité Civile Professionnelle** du diagnostiqueur en cas de préjudice financier (couverture obligatoire jusqu'à 300 000€ minimum)\n4. **Saisissez la DGCCRF** pour les fraudes manifestes\n5. **En dernier recours, engagez une action judiciaire** devant le tribunal judiciaire dans un délai de 5 ans à compter de la découverte de l'erreur\n\nConservez tous les éléments de preuve : rapports originaux, photos, factures, devis de travaux supplémentaires liés à l'erreur.",
      },
    ],
  },

  // ============================================
  // Cat 3 — DPE et réglementation 2026
  // ============================================
  {
    id: 'dpe-2026',
    title: 'DPE et réglementation 2026',
    description:
      'Tout savoir sur le Diagnostic de Performance Énergétique en 2026 : prix, validité, audit énergétique, QR code ADEME.',
    questions: [
      {
        id: 'definition-dpe',
        question: "Qu'est-ce qu'un DPE et à quoi ça sert ?",
        answer:
          "Le Diagnostic de Performance Énergétique (DPE) est un document obligatoire en France qui évalue la performance énergétique et l'impact climatique d'un logement. Il attribue deux étiquettes :\n\n- Une **étiquette énergie** (de A pour très économe à G pour très énergivore) basée sur la consommation annuelle estimée en kWh/m²\n- Une **étiquette climat** basée sur les émissions de gaz à effet de serre en kg de CO2/m²\n\nLe DPE informe l'acquéreur ou le locataire sur les coûts énergétiques prévisionnels, l'impact environnemental du logement, et formule des recommandations de travaux. Il a aussi des conséquences légales : interdiction progressive de louer les logements classés F (depuis 2025) et G (depuis 2023), avec extension prévue aux classes E en 2034 et D en 2040.",
      },
      {
        id: 'prix-dpe',
        question: 'Combien coûte un DPE en France en 2026 ?',
        answer:
          "Le prix d'un DPE varie entre **100€ et 250€ TTC** selon plusieurs facteurs : surface du bien, zone géographique (Paris et grandes métropoles 20-30% plus chères que la province), complexité du bien, diagnostiqueur choisi.\n\nLe tarif moyen national est d'environ **150€** pour un appartement standard et **200€** pour une maison individuelle. Les prix anormalement bas (en dessous de 80€) sont à éviter car ils signalent souvent un travail bâclé. Faire réaliser plusieurs diagnostics groupés chez le même diagnostiqueur permet d'économiser 30 à 40% par rapport à des prestations séparées.",
      },
      {
        id: 'validite-dpe',
        question: 'Combien de temps est valable un DPE ?',
        answer:
          "La validité d'un DPE est de **10 ans** en France pour les diagnostics réalisés depuis le 1er juillet 2021 avec la méthode 3CL-2021. Des règles transitoires s'appliquent aux DPE plus anciens :\n\n- DPE établis entre le 1er janvier 2013 et le 30 juin 2021 : valables jusqu'au 31 décembre 2024\n- DPE établis entre le 1er janvier 2018 et le 30 juin 2021 : valables jusqu'au 31 décembre 2034\n\nUn nouveau DPE doit être réalisé en cas de travaux importants modifiant la performance énergétique (isolation, changement de chauffage, remplacement de fenêtres) pour refléter la nouvelle réalité du logement.",
      },
      {
        id: 'methode-3cl-2021',
        question: "Qu'est-ce que la méthode 3CL-2021 du DPE ?",
        answer:
          "La méthode 3CL-2021 (Calcul Conventionnel des Consommations des Logements) est la méthode officielle obligatoire pour le calcul du DPE depuis le 1er juillet 2021. Elle remplace l'ancienne méthode « sur factures » qui dépendait du comportement des occupants.\n\nLa nouvelle méthode calcule la performance énergétique uniquement sur les caractéristiques techniques du logement : isolation des murs, toiture, planchers et menuiseries, performance des systèmes de chauffage et d'eau chaude sanitaire, type de ventilation, orientation et zone climatique. Cela rend les DPE comparables entre logements et indépendants de l'occupation réelle.\n\nDepuis le 1er janvier 2026, le facteur de conversion énergie finale en énergie primaire pour l'électricité passe de 2,3 à 1,9, ce qui améliore mécaniquement l'étiquette des logements chauffés à l'électricité.",
      },
      {
        id: 'qr-code-ademe',
        question: "Qu'est-ce que le QR code ADEME sur un DPE ?",
        answer:
          "Le QR code ADEME est un code-barres deux dimensions obligatoirement présent sur la première page de tous les DPE émis en France depuis le **1er septembre 2025**. Il permet à toute personne (acquéreur, locataire, notaire, banquier) de vérifier l'authenticité du DPE en scannant le code avec un smartphone.\n\nLe QR renvoie vers la fiche officielle du DPE dans l'**Observatoire DPE-Audit de l'ADEME**, où sont accessibles publiquement le numéro à 13 chiffres du DPE, les caractéristiques du bien, la classe énergétique et climatique, la date de réalisation et l'identité du diagnostiqueur.\n\nCette mesure anti-fraude lutte contre les faux DPE qui représentaient plusieurs dizaines de millions d'euros de fraudes détectées par Tracfin en 2025. Un DPE sans QR code ADEME n'est plus valide depuis octobre 2025.",
      },
      {
        id: 'audit-energetique',
        question: "Qu'est-ce qu'un audit énergétique et est-il obligatoire ?",
        answer:
          "L'audit énergétique réglementaire est un document technique obligatoire pour la vente des biens classés F ou G au DPE depuis le 1er avril 2023, étendu aux biens classés E depuis le 1er janvier 2025, et qui le sera aux biens classés D au 1er janvier 2034.\n\nIl complète le DPE en proposant 2 à 3 scénarios chiffrés de travaux d'amélioration énergétique permettant d'atteindre au minimum la classe B (ou C selon les cas). Chaque scénario détaille :\n\n- La liste des travaux recommandés\n- Le coût estimatif détaillé par poste\n- Les économies d'énergie attendues\n- Les aides financières mobilisables (MaPrimeRénov', CEE, éco-PTZ)\n- Le gain de classe DPE attendu\n\nL'audit énergétique coûte entre **400€ et 1 500€ HT** selon la complexité du bien et est valable 5 ans. Il ne peut être réalisé que par un diagnostiqueur certifié « DPE avec mention », un bureau d'études thermiques ou un architecte RGE.",
      },
      {
        id: 'passoire-thermique',
        question: 'Que signifie un logement classé F ou G au DPE ?',
        answer:
          "Un logement classé F ou G au DPE est qualifié de **« passoire thermique »**. Concrètement :\n\n- Classe F : consommation énergétique entre 331 et 450 kWh/m²/an\n- Classe G : plus de 450 kWh/m²/an\n\nCes logements représentent environ 5,2 millions de biens en France, soit 14% du parc immobilier total. Conséquences concrètes :\n\n- **Interdiction progressive de location** : depuis 2023 pour les G, depuis 2025 pour les F, à venir en 2034 pour les E\n- **Audit énergétique obligatoire** lors de la vente\n- **Décote du prix de vente** estimée entre 5% et 15%\n- **Travaux de rénovation nécessaires** pour continuer à louer ou mieux vendre\n\nLes propriétaires peuvent mobiliser plusieurs aides : MaPrimeRénov' (jusqu'à 90% pour les ménages très modestes), Certificats d'Économie d'Énergie (CEE), éco-prêt à taux zéro, TVA réduite à 5,5%.",
      },
      {
        id: 'limite-1000-dpe',
        question: 'Combien de DPE peut faire un diagnostiqueur par an ?',
        answer:
          "Un diagnostiqueur immobilier est légalement limité à **1 000 DPE par an et par personne certifiée** depuis 2024. Cette limite a été instaurée pour lutter contre les « diagnostics à la chaîne » et garantir un travail de qualité.\n\nLe dépassement de ce plafond peut entraîner un retrait de certification et l'impossibilité d'exercer le métier. L'ADEME a renforcé les contrôles depuis 2025 : sur les 800 000 DPE réalisés entre janvier et mai 2025, environ 12% étaient suspectés d'anomalies. Cette limite, combinée au QR code ADEME et à la transmission obligatoire à l'Observatoire DPE-Audit, vise à diviser par deux le nombre de fraudes d'ici fin 2026.",
      },
    ],
  },

  // ============================================
  // Cat 4 — Diagnostics spécifiques
  // ============================================
  {
    id: 'diagnostics-immobiliers',
    title: 'Diagnostics spécifiques',
    description:
      'Amiante, plomb CREP, gaz, électricité, termites, Carrez/Boutin, ERP : prix, validité, méthodologie.',
    questions: [
      {
        id: 'prix-amiante',
        question: 'Combien coûte un diagnostic amiante en France ?',
        answer:
          "Un diagnostic amiante avant vente coûte en moyenne entre **80€ et 250€ TTC** en France, selon la surface du bien et la nécessité éventuelle de prélèvements en laboratoire. Pour un appartement standard de 60 m², comptez 80€ à 150€. Pour une maison individuelle de 120 m², le tarif moyen est de 150€ à 250€.\n\nLes prélèvements complémentaires en laboratoire COFRAC ajoutent 50€ à 80€ par échantillon. Le diagnostic amiante est obligatoire pour tous les biens dont le permis de construire est antérieur au 1er juillet 1997, sans exception. Sa validité est **illimitée** en cas d'absence d'amiante détectée, ou **3 ans** en cas de présence avec suivi périodique.",
      },
      {
        id: 'definition-plomb-crep',
        question: "Qu'est-ce que le diagnostic plomb (CREP) ?",
        answer:
          "Le Constat de Risque d'Exposition au Plomb (CREP) est un diagnostic obligatoire pour la vente et la location de tous les biens à usage d'habitation construits avant le **1er janvier 1949**. Il consiste à mesurer la concentration en plomb des revêtements (peintures murales notamment) à l'aide d'un appareil à fluorescence X (XRF), selon la norme NF X46-030.\n\nChaque mesure est classifiée en 4 niveaux : classe 0 (pas de plomb détecté), classe 1 (présence sans dégradation), classe 2 (présence avec dégradations légères), classe 3 (présence avec dégradations majeures). La validité varie selon le résultat : **illimitée** si absence de plomb, **1 an** pour la vente en cas de présence, **6 ans** pour la location. Son coût varie entre 100€ et 250€ TTC.",
      },
      {
        id: 'diagnostic-gaz',
        question: 'Le diagnostic gaz est-il obligatoire et combien coûte-t-il ?',
        answer:
          "Oui, le diagnostic de l'état de l'installation intérieure de gaz est **obligatoire** pour la vente et la location de tout bien équipé d'une installation gaz de plus de 15 ans. Il est régi par la norme NF P 45-500 et identifie les anomalies classées en trois catégories :\n\n- **DGI** (Danger Grave et Immédiat) : coupure obligatoire de l'installation\n- **A1** : anomalies à corriger sous 1 mois\n- **A2** : anomalies à corriger sans urgence particulière\n\nLe diagnostic gaz coûte entre **100€ et 150€ TTC** selon la complexité de l'installation. Sa validité est de **3 ans** pour une vente et de **6 ans** pour une location. En cas de découverte d'un DGI, le diagnostiqueur doit alerter immédiatement le distributeur de gaz qui procède à la coupure.",
      },
      {
        id: 'diagnostic-electricite',
        question: "Qu'est-ce que le diagnostic électricité et est-il obligatoire ?",
        answer:
          "Le diagnostic de l'état de l'installation intérieure d'électricité est **obligatoire** pour la vente et la location de tout bien équipé d'une installation électrique de plus de 15 ans. Il est régi par la norme XP C 16-600 et examine 11 domaines de sécurité (B1 à B11) :\n\n- Présence d'un appareil général de commande\n- Protection différentielle 30 mA\n- Liaison équipotentielle dans les locaux humides\n- Protection contre les surcharges\n- Sécurité dans les salles d'eau\n- État des conducteurs\n- Mise à la terre\n\nLe diagnostic coûte entre **100€ et 150€ TTC** et sa validité est de **3 ans** pour une vente et **6 ans** pour une location. Souvent réalisé conjointement avec le diagnostic gaz pour un coût groupé optimisé.",
      },
      {
        id: 'diagnostic-termites',
        question: "Qu'est-ce que le diagnostic termites et où est-il obligatoire ?",
        answer:
          "Le diagnostic termites (ou état parasitaire) est obligatoire pour la vente d'un bien situé dans une zone définie par arrêté préfectoral comme contaminée ou susceptible de l'être. Environ 55 départements français sont concernés, principalement dans le Sud-Ouest, le Sud-Est, le Centre et l'Ouest.\n\nLe diagnostic consiste en une inspection visuelle approfondie des éléments en bois du bâtiment (charpente, plinthes, parquet, escaliers, planchers) à la recherche d'indices d'infestation (galeries, déjections, dommages structurels) et de sondages manuels.\n\nLe coût varie entre **80€ et 200€ TTC** selon la surface du bien. Sa validité est de **6 mois**, ce qui en fait l'un des diagnostics les plus courts. En cas de détection de termites, des traitements professionnels obligatoires doivent être réalisés avant la vente.",
      },
      {
        id: 'mesurage-carrez-boutin',
        question: "Qu'est-ce que le mesurage Carrez et le mesurage Boutin ?",
        answer:
          "Deux méthodes officielles de calcul de la surface privative d'un bien immobilier :\n\n- **Loi Carrez** : s'applique aux ventes de lots de copropriété (appartements, locaux commerciaux, parkings, caves de plus de 8 m²). La surface Carrez exclut les murs, cloisons, marches, gaines, embrasures de portes/fenêtres, ainsi que les surfaces dont la hauteur sous plafond est inférieure à 1,80 m. Une erreur de plus de 5% peut entraîner une réduction du prix de vente proportionnelle\n- **Loi Boutin** : s'applique aux locations vides à usage de résidence principale. Légèrement différente de la Carrez : exclut en plus les caves, garages, balcons, terrasses\n\nLe mesurage Carrez ou Boutin coûte entre **80€ et 150€ TTC**. Sa validité est **illimitée** tant qu'aucune modification structurelle n'est apportée au bien.",
      },
      {
        id: 'definition-erp',
        question: "Qu'est-ce que l'ERP (État des Risques et Pollutions) ?",
        answer:
          "L'État des Risques et Pollutions (ERP), anciennement appelé ERNMT, est un document **obligatoire** pour toute transaction immobilière (vente ou location) depuis 2018. Il informe l'acquéreur ou le locataire des risques affectant le bien :\n\n- **Risques naturels** : inondation, séisme, mouvement de terrain, retrait-gonflement des argiles, avalanche, feu de forêt\n- **Risques miniers** : effondrement, affaissement, pollution\n- **Risques technologiques** : industrie classée Seveso, nucléaire, transport de matières dangereuses\n- **Pollution des sols** : sites BASIAS et BASOL référencés\n\nLes données proviennent du site officiel **Géorisques.gouv.fr**. Sa **validité est de 6 mois**, le plus court de tous les diagnostics. Son coût est généralement intégré au pack de diagnostics ou facturé entre **20€ et 50€ TTC** seul.",
      },
      {
        id: 'assainissement-non-collectif',
        question: "Qu'est-ce que le diagnostic assainissement non collectif ?",
        answer:
          "Le diagnostic assainissement non collectif (ANC) est obligatoire pour la vente d'un bien non raccordé au réseau public de tout-à-l'égout. Il évalue la conformité et le fonctionnement de l'installation individuelle (fosse septique, fosse toutes eaux, micro-station, filtre à sable, etc.).\n\nIl est réalisé par le **SPANC** (Service Public d'Assainissement Non Collectif) de la commune ou par un diagnostiqueur certifié si le SPANC le délègue. Le rapport identifie les non-conformités éventuelles et impose un délai de mise en conformité variable selon la gravité (1 à 4 ans après la vente).\n\nLe coût varie entre **100€ et 250€ TTC** selon la commune. Sa **validité est de 3 ans** au moment de la vente.",
      },
    ],
  },

  // ============================================
  // Cat 5 — KOVAS produit
  // ============================================
  {
    id: 'kovas-app',
    title: 'KOVAS produit',
    description: 'Différenciation, fonctionnement, intégrations, conformité réglementaire.',
    questions: [
      {
        id: 'kovas-distinction',
        question: "Qu'est-ce qui distingue KOVAS des autres logiciels de diagnostic ?",
        answer:
          "KOVAS se distingue par sa **conception mobile-first avec intelligence artificielle native intégrée**, contrairement aux logiciels traditionnels conçus pour desktop dans les années 2000-2010. Trois différences majeures :\n\n1. **Saisie vocale intelligente** : KOVAS transcrit et structure automatiquement vos observations terrain via Whisper + IA hybride (parser custom + Claude Haiku)\n2. **Photos terrain optimisées** : compression WebP, géolocalisation EXIF automatique, nommage de fichier auto-généré, organisation par pièce et type de vue\n3. **Workflow hybride compagnon Liciel** : export ZIP en 1 clic vers Liciel pour le DPE, exports universels (PDF, Word, CSV, JSON) pour les autres logiciels\n\nKOVAS est conçu pour fonctionner hors-ligne (mode terrain PWA), avec synchronisation automatique, et s'intègre nativement aux logiciels existants comme Liciel sans imposer de migration. Sa promesse mesurable : 1h30 économisée par mission DPE typique.",
      },
      {
        id: 'kovas-offline',
        question: 'KOVAS fonctionne-t-il sans connexion internet sur le terrain ?',
        answer:
          "Oui, KOVAS fonctionne hors connexion pour les fonctionnalités terrain principales. Le diagnostiqueur peut :\n\n- Consulter les dossiers déjà chargés\n- Prendre des photos géolocalisées\n- Enregistrer des notes vocales (transcrites automatiquement après reconnexion)\n- Compléter les check-lists de diagnostic\n\nUn indicateur permanent en haut de l'application affiche l'état de synchronisation : vert (synchronisé), jaune (synchronisation en cours), orange (modifications en attente).\n\nToutes les données sont automatiquement synchronisées dès que la connexion est rétablie. L'export vers Liciel et la consultation initiale des dossiers nécessitent en revanche une connexion active. Cette architecture offline-first protège contre les pertes de données dans les caves ou zones blanches.",
      },
      {
        id: 'appareils-compatibles',
        question: 'Sur quels appareils KOVAS fonctionne-t-il ?',
        answer:
          "KOVAS fonctionne sur tous les appareils modernes via navigateur web :\n\n- **Smartphone** : iOS 14+ ou Android 10+\n- **Tablette** : iPad ou tablette Android\n- **Ordinateur** : Windows, Mac, Linux avec Chrome, Safari, Firefox, Edge récents\n\nAucune installation requise pour démarrer, mais vous pouvez « installer » KOVAS comme une application native (Progressive Web App) :\n\n- **Sur iPhone/iPad** : ouvrez Safari → bouton Partager → « Sur l'écran d'accueil »\n- **Sur Android** : ouvrez Chrome → menu (3 points) → « Installer l'application »\n\nL'installation PWA permet l'accès hors-ligne complet et une icône sur votre écran d'accueil. Vos données sont automatiquement synchronisées entre tous vos appareils : vous pouvez démarrer une mission sur tablette sur le terrain et la finaliser sur ordinateur au bureau, sans perte d'information.",
      },
      {
        id: 'workflow-dpe-liciel',
        question: "Comment KOVAS s'articule-t-il avec Liciel pour le DPE ?",
        answer:
          'Pour le DPE, KOVAS et Liciel se complètent dans un workflow hybride optimisé :\n\n1. **Saisie terrain dans KOVAS** : adresse via API BAN, année de construction, surface, équipements via saisie vocale + photos géolocalisées\n2. **Templates pièces** : T2/T3/T4/T5 pré-remplis pour accélérer la saisie\n3. **Check-lists** : validation que tous les éléments requis pour le DPE sont collectés\n4. **Export ZIP vers Liciel** : 1 clic pour générer un fichier ZIP officiel (base Access MDB, XML, photos)\n5. **Calcul DPE certifié dans Liciel** : 3CL-2021 + transmission Observatoire DPE-Audit ADEME\n6. **PDF certifié archivé dans KOVAS** : import du PDF Liciel pour traçabilité 10 ans\n\nCe workflow économise environ 1h30 par mission DPE typique par rapport à une saisie complète dans Liciel uniquement.',
      },
      {
        id: 'kovas-cadre-reglementaire',
        question: "Comment KOVAS s'inscrit dans le cadre réglementaire diagnostic ?",
        answer:
          "KOVAS organise vos données de mission selon les exigences réglementaires de chaque type de diagnostic :\n\n- **Check-lists par type** : items obligatoires marqués clairement, validation de complétude avant export\n- **Validation de cohérence basique** : détecte les incohérences évidentes (« Surface 100 m² + chaudière 5 kW = à vérifier », « Maison 1850 + étiquette A = à vérifier »)\n- **Photos preuves structurées** : nommage standardisé, géolocalisation EXIF, organisation par pièce et type de vue\n- **Archivage légal** : conservation pour la durée légale applicable (10 ans pour la plupart des diagnostics, 50 ans pour l'amiante)\n- **Audit logs** : toutes les actions sont journalisées et horodatées pour la traçabilité en cas de contrôle DGCCRF\n\nLes rapports officiels eux-mêmes sont générés par votre logiciel principal certifié (Liciel pour le DPE) — KOVAS facilite leur production en optimisant la collecte de données amont.",
      },
      {
        id: 'integration-logiciels-tiers',
        question: "KOVAS s'intègre-t-il avec d'autres logiciels que Liciel ?",
        answer:
          "Oui, KOVAS propose des exports universels qui permettent l'intégration avec la plupart des logiciels métier :\n\n- **PDF** : rapports lisibles pour archivage ou envoi client\n- **Word** : exports modifiables pour personnalisation\n- **CSV** : tableurs structurés pour reporting ou import dans CRM\n- **JSON** : format technique pour intégrations sur mesure\n- **ZIP Liciel** : format officiel Liciel (base MDB + XML + photos)\n\nKOVAS est testé pour fonctionner avec Liciel (priorité), AnalysImmo, OBBC, et ORIS. Pour d'autres logiciels, les exports universels suffisent généralement. Si vous avez un besoin d'intégration spécifique, contactez-nous : nous étudions les demandes au cas par cas.",
      },
    ],
  },

  // ============================================
  // Cat 6 — Tarifs et abonnement
  // ============================================
  {
    id: 'tarifs-kovas',
    title: 'Tarifs et abonnement',
    description: '3 formules, ROI, engagement, dépassement de quota, résiliation.',
    questions: [
      {
        id: 'prix-kovas-diagnostiqueur',
        question: 'Combien coûte KOVAS pour un diagnostiqueur immobilier ?',
        answer:
          "KOVAS propose 3 formules HT/mois sans engagement de durée :\n\n- **Découverte 29€/mois** : 20 missions incluses, surplus 2€/mission, 1 utilisateur, 20 Go de stockage\n- **Standard 59€/mois** (recommandé) : 60 missions incluses, surplus 1,50€/mission, 1 utilisateur, 50 Go\n- **Volume 99€/mois** : 150 missions incluses, surplus 1€/mission, 1 utilisateur, 100 Go\n\nToutes les fonctionnalités sont incluses dans chaque formule : saisie vocale, photos terrain, exports vers Liciel et logiciels tiers, lien d'upload public pour les documents propriétaire, dashboard, archivage légal.\n\nLe paiement annuel offre **2 mois offerts** (10 mois payés sur 12), soit une réduction de ~17%.",
      },
      {
        id: 'engagement-frais-caches',
        question: 'Y a-t-il un engagement ou des frais cachés avec KOVAS ?',
        answer:
          "Non, KOVAS ne pratique **aucun engagement ni frais caché**. Le prix affiché est le prix payé, et la résiliation se fait en 1 clic depuis votre espace abonnement.\n\nTout est inclus dans l'abonnement mensuel :\n\n- Toutes les fonctionnalités d'intelligence artificielle (transcription vocale, structuration)\n- Stockage selon la formule (20/50/100 Go)\n- Synchronisation multi-appareils\n- Sauvegardes automatiques journalières\n- Support utilisateur par email\n- Mises à jour produit automatiques\n\nLes seuls éléments non inclus sont les outils tiers que vous payez déjà séparément : votre abonnement Liciel (pour le calcul DPE), votre éventuel abonnement Yousign pour la signature électronique. Une facture conforme est générée chaque mois et téléchargeable depuis votre espace.",
      },
      {
        id: 'roi-reel-kovas',
        question: 'Quel est le retour sur investissement estimé de KOVAS ?',
        answer:
          "La promesse mesurable KOVAS est de **1h30 économisée par mission DPE typique** (terrain + retour bureau).\n\nPour un diagnostiqueur réalisant 60 missions par mois avec un mix de diagnostics, les gains estimés sur les fonctionnalités principales :\n\n- Saisie vocale terrain vs saisie clavier\n- Photos auto-nommées et géolocalisées vs renommage manuel\n- Exports ZIP Liciel 1 clic vs re-saisie\n- Lien d'upload propriétaire vs allers-retours email\n- Templates pièces vs saisie répétitive\n\nÀ 100€/h de productivité, le ROI estimé est de plusieurs fois le coût de l'abonnement Standard (59€/mois). La validation chiffrée précise sera affinée par les retours des bêta-testeurs M6-M9 puis communiquée publiquement.",
      },
      {
        id: 'changer-resilier',
        question: 'Comment puis-je changer de formule ou résilier KOVAS ?',
        answer:
          "Changement et résiliation s'effectuent en **1 clic depuis votre espace abonnement** dans les paramètres du compte.\n\n- **Passer à une formule supérieure** : changement immédiat avec ajustement prorata sur la facture du mois en cours\n- **Passer à une formule inférieure ou résilier** : prend effet à la fin du mois en cours pour éviter toute perte de service\n\nAprès résiliation :\n\n- Vos données restent accessibles **30 jours en lecture seule**\n- Vous pouvez exporter tous vos dossiers (PDF, JSON, ZIP Liciel) pour archivage personnel\n- Au-delà de 30 jours, vos données sont définitivement supprimées conformément au RGPD\n- Vous pouvez réactiver votre compte dans les 30 jours sans perte de données\n\nAucune justification ni lettre recommandée n'est nécessaire.",
      },
      {
        id: 'depassement-quota',
        question: 'Que se passe-t-il si je dépasse le nombre de missions de ma formule ?',
        answer:
          'Si vous dépassez votre quota mensuel, KOVAS facture les missions supplémentaires à un tarif unitaire dégressif selon votre formule :\n\n- **Découverte** : 2€/mission au-delà de 20\n- **Standard** : 1,50€/mission au-delà de 60\n- **Volume** : 1€/mission au-delà de 150\n\nVous restez fonctionnel sans interruption. Si vous dépassez régulièrement votre quota 3 mois consécutifs, KOVAS vous suggère automatiquement la formule supérieure (potentiellement plus économique).\n\nUn plafond mensuel auto-protecteur est également activable : au-delà du plafond que vous définissez, les missions restent fonctionnelles mais le branding KOVAS revient sur les PDF — vous évitez ainsi tout dépassement budgétaire surprise.',
      },
    ],
  },

  // ============================================
  // Cat 7 — Sécurité et conformité RGPD
  // ============================================
  {
    id: 'securite-rgpd',
    title: 'Sécurité et conformité RGPD',
    description: 'Chiffrement, hébergement Europe, droits RGPD, IA et données.',
    questions: [
      {
        id: 'protection-donnees',
        question:
          'Comment KOVAS protège-t-il les données des diagnostiqueurs et de leurs clients ?',
        answer:
          "KOVAS applique des standards de sécurité SaaS éprouvés :\n\n- **Chiffrement en transit** : TLS 1.3 pour toutes les communications\n- **Chiffrement au repos** : AES-256 via l'infrastructure Supabase\n- **Hébergement européen exclusif** : Supabase **eu-west-3, Paris**. Aucune donnée transférée hors Union Européenne\n- **Isolation des données** : chaque organisation dispose d'un espace strictement isolé via Row Level Security PostgreSQL\n- **Sauvegardes automatiques** : journalières, conservées 30 jours\n- **Audit logs** : toutes les actions sensibles (création/modification/suppression) sont journalisées et horodatées\n- **Aucune information bancaire stockée** : les paiements transitent par Stripe (certifié PCI-DSS niveau 1)\n- **Assurance Hiscox RC Pro** avec couverture cyber et défense juridique\n\nL'authentification se fait par email + mot de passe, avec authentification à deux facteurs (2FA) disponible. En cas d'incident de sécurité, KOVAS s'engage à notifier les utilisateurs sous 72h conformément aux obligations RGPD.",
      },
      {
        id: 'conformite-rgpd',
        question: 'KOVAS est-il conforme au RGPD européen ?',
        answer:
          "Oui, KOVAS est conforme au Règlement Général sur la Protection des Données (RGPD) européen depuis sa conception. Tous les droits RGPD sont garantis et exerçables à tout moment :\n\n- **Droit d'accès** : consultation de toutes vos données depuis votre espace en 1 clic\n- **Droit de rectification** : modification de vos informations personnelles à tout moment\n- **Droit à l'effacement** : suppression définitive de votre compte et de toutes vos données sous 30 jours\n- **Droit à la portabilité** : export complet en formats universels (JSON, CSV, PDF, ZIP)\n- **Droit d'opposition** : opposition à certains traitements (marketing, analytics)\n- **Droit à la limitation** : limitation du traitement dans des cas spécifiques\n\nPour exercer ces droits, une simple demande à contact@kovas.fr déclenche une réponse sous 30 jours maximum. KOVAS ne pratique aucun profilage commercial, ne revend jamais vos données à des tiers, et ne les utilise pas pour de la publicité ciblée.",
      },
      {
        id: 'donnees-entrainement-ia',
        question:
          "Les données KOVAS sont-elles utilisées pour entraîner des modèles d'intelligence artificielle ?",
        answer:
          "Non, KOVAS s'engage formellement à **ne jamais utiliser les données utilisateurs pour entraîner des modèles d'intelligence artificielle**.\n\nPour les fonctionnalités IA (transcription vocale, extraction d'entités, génération de texte), KOVAS utilise des services tiers (OpenAI Whisper, Claude d'Anthropic) avec l'option opt-out d'entraînement explicitement activée dans tous les contrats. Concrètement :\n\n- Les enregistrements vocaux sont supprimés après transcription chez OpenAI (politique de rétention zéro)\n- Aucune donnée personnelle identifiable n'est partagée avec ces fournisseurs (anonymisation systématique)\n- Les conversations avec Claude ne sont pas utilisées pour l'entraînement (politique Anthropic par défaut pour les entreprises)\n\nVos données restent votre propriété exclusive. KOVAS s'engage à diversifier progressivement ses prestataires vers des modèles auto-hébergés sur ses serveurs européens pour renforcer encore cette indépendance.",
      },
      {
        id: 'duree-conservation-rapports',
        question: 'Combien de temps faut-il conserver les rapports de diagnostic immobilier ?',
        answer:
          "Les durées légales de conservation des rapports en France :\n\n- **DPE** : 10 ans (article R.126-15 du Code de la construction et de l'habitation)\n- **Rapports amiante** : **50 ans** (article R.1334-29-9 du Code de la santé publique, durée la plus longue)\n- **Plomb CREP** : 10 ans\n- **Gaz et électricité** : 10 ans\n- **Termites** : 10 ans\n- **Carrez/Boutin** : 10 ans\n- **ERP** : 10 ans\n\nLe diagnostiqueur doit pouvoir présenter ces rapports en cas de contrôle par la DGCCRF, l'organisme certificateur ou l'ADEME. KOVAS conserve automatiquement tous les rapports et leurs données associées (photos, notes vocales, métadonnées, audit logs) pour la durée légale applicable, avec export possible à tout moment vers vos archives personnelles.",
      },
    ],
  },

  // ============================================
  // Cat 8 — SEO local Normandie
  // ============================================
  {
    id: 'diagnostic-immobilier-normandie',
    title: 'Diagnostic immobilier en Normandie',
    description: 'Trouver un diagnostiqueur, délais, coûts en Seine-Maritime et alentours.',
    questions: [
      {
        id: 'trouver-diagnostiqueur-normandie',
        question:
          'Comment trouver un diagnostiqueur immobilier certifié à Dieppe ou en Normandie ?',
        answer:
          "Pour trouver un diagnostiqueur immobilier certifié en Seine-Maritime, plusieurs sources officielles fiables et gratuites :\n\n1. **Annuaire officiel du Ministère du Logement** (annuaire-diagnostiqueurs.gouv.fr) : liste tous les diagnostiqueurs certifiés COFRAC en France avec leurs spécialités\n2. **Site officiel de l'ADEME** : vérification spécifique des certifications DPE et accès à l'Observatoire DPE-Audit\n3. **Google Maps** : avis clients et localisation précise des cabinets locaux\n4. **Pages Jaunes** : annuaire généraliste avec coordonnées\n\nSur la zone de Dieppe et environs (rayon 30 km), plusieurs cabinets actifs offrent des services complets. Vérifiez systématiquement la certification COFRAC à jour pour chaque diagnostic demandé et demandez l'attestation d'assurance RC Pro.",
      },
      {
        id: 'delai-diagnostic-normandie',
        question: 'Quel est le délai pour obtenir un diagnostic immobilier en Normandie ?',
        answer:
          "Le délai standard pour obtenir un diagnostic immobilier en Normandie varie entre **5 et 15 jours** selon la disponibilité des diagnostiqueurs et la complexité du bien :\n\n- **Zone urbaine** (Rouen, Le Havre, Dieppe, Caen) : généralement 7 à 10 jours\n- **Zone rurale** (Pays de Bray, Pays de Caux, Bocage normand, Cotentin) : jusqu'à 15 jours en période chargée\n- **Période chargée** (rentrée immobilière de septembre, printemps) : peut allonger les délais\n\nPour une mission urgente (signature de compromis sous délai contraint), certains cabinets proposent une intervention sous **48 heures** avec un supplément tarifaire de 30 à 50%. Pour éviter les retards, anticipez la commande des diagnostics 2 à 4 semaines avant la mise en vente effective du bien.",
      },
      {
        id: 'cout-dossier-normandie',
        question: 'Combien coûte un dossier de diagnostic immobilier complet en Normandie ?',
        answer:
          "Le prix d'un dossier de diagnostic technique complet pour la vente en Normandie varie entre **300€ et 800€ TTC** selon le profil du bien :\n\n- **Appartement standard de 50-80 m² après 1997** (DPE + ERP + gaz + électricité + Carrez) : 300€ à 450€ TTC\n- **Maison récente de 100-150 m² après 1997** (DPE + ERP + gaz + électricité + termites éventuel) : 400€ à 550€ TTC\n- **Maison ancienne de 100-200 m² avant 1949** (DPE + amiante + plomb + gaz + électricité + termites + ERP + Carrez) : 600€ à 800€ TTC\n\nLes tarifs en Normandie sont en moyenne 10 à 15% inférieurs à ceux pratiqués en Île-de-France. Demandez systématiquement 3 devis comparatifs. La plupart des cabinets proposent des tarifs dégressifs sur les packs groupés (économie de 30 à 40%). Pour la location, le pack diagnostic est plus simple et coûte généralement entre **150€ et 300€ TTC**.",
      },
    ],
  },
]
