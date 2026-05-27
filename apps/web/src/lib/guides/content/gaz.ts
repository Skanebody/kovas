/**
 * Guide long — Diagnostic Gaz.
 *
 * Sources : décret 2007-1267, arrêté du 18 novembre 2013, norme NF P 45-500,
 * articles L134-6 à L134-9 du Code de la construction et de l'habitation,
 * INRS, ATEE, GRDF Cerbère pour le suivi statistique.
 */

import type { Guide } from '../types'

export const GAZ_GUIDE: Guide = {
  type: 'gaz',
  slug: 'gaz',
  shortTitle: 'Gaz',
  title: 'Diagnostic gaz : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout savoir sur le diagnostic gaz : installations de plus de 15 ans, 18 points de contrôle, validité 3 ans (vente) ou 6 ans (location).',
  metaDescription:
    'Diagnostic gaz 2026 : installation > 15 ans, 18 points contrôle, anomalies DGI et A1/A2, validité, prix, obligations propriétaire. Guide KOVAS.',
  teaser:
    'Installations gaz > 15 ans, norme NF P 45-500, 18 points contrôle et danger grave immédiat.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 25,
  wordCount: 5100,
  relatedTypes: ['electricite', 'dpe', 'audit-energetique', 'erp'],
  sections: [
    {
      id: 'qu-est-ce-que-le-diagnostic-gaz',
      title: 'Qu’est-ce que le diagnostic gaz',
      level: 2,
      paragraphs: [
        'Le diagnostic gaz, aussi désigné « état de l’installation intérieure de gaz », est un diagnostic réglementaire obligatoire visant à évaluer la sécurité et la conformité des installations de gaz combustible d’un logement. Il est encadré par les articles L134-6 à L134-9 du Code de la construction et de l’habitation, par le décret 2007-1267 du 23 août 2007 et par l’arrêté du 18 novembre 2013 qui définit le protocole technique de réalisation. La référence normative principale est la norme NF P 45-500 qui détaille les 18 points de contrôle obligatoires et les critères de classement des anomalies.',
        'L’objectif premier du diagnostic gaz est la protection des occupants contre les risques d’intoxication au monoxyde de carbone, d’explosion et d’incendie. Selon l’Institut national de veille sanitaire, près de 4 000 personnes sont victimes chaque année en France d’intoxications au monoxyde de carbone d’origine domestique, dont environ une centaine de décès. Le gaz naturel et le butane-propane, lorsqu’ils sont mal installés ou mal entretenus, constituent un risque immédiat tant pour les occupants que pour le voisinage en cas d’explosion ou d’incendie.',
        'Le diagnostic gaz porte sur l’ensemble de l’installation intérieure du logement, du compteur ou de la bouteille d’alimentation jusqu’aux appareils utilisateurs. Il couvre la tuyauterie fixe, les raccordements souples, les robinets d’arrêt, les organes de coupure, les appareils consommateurs (chaudière, chauffe-eau, plaque de cuisson, four, sèche-linge) et la ventilation des pièces où se trouvent ces appareils. La sécurité des conduits d’évacuation des produits de combustion est également vérifiée pour les appareils non étanches.',
        'Le diagnostic gaz n’est pas une opération d’entretien et ne remplace pas l’entretien annuel obligatoire de la chaudière à gaz. Il constitue une photographie de la conformité de l’installation à un instant donné. Un diagnostic gaz positif ne dispense pas le propriétaire ou l’occupant de faire entretenir régulièrement ses équipements et ses conduits d’évacuation par un professionnel qualifié, et ne garantit pas l’absence de défaillance future.',
      ],
    },
    {
      id: 'quand-le-diagnostic-gaz-est-il-obligatoire',
      title: 'Quand le diagnostic gaz est-il obligatoire',
      level: 2,
      paragraphs: [
        'Le diagnostic gaz est obligatoire pour toute installation intérieure de gaz combustible dont la mise en service initiale ou la dernière modification importante remonte à plus de quinze ans. Le critère est l’âge de l’installation et non l’âge du bâtiment : une installation neuve dans un logement ancien n’est pas concernée, et une installation ancienne dans un bâtiment récent l’est. La date de référence est généralement portée par le titre d’habitation, par le certificat de conformité Qualigaz délivré par le distributeur ou par les factures de travaux significatifs.',
        'Deux cas de figure principaux déclenchent l’obligation. Lors d’une vente, le diagnostic gaz doit être annexé au compromis de vente et figurer dans le dossier de diagnostic technique remis au notaire. La validité du diagnostic est alors de trois ans à compter de sa réalisation : un diagnostic réalisé en mai 2023 sera valide jusqu’en mai 2026. Lors d’une mise en location, le diagnostic doit être annexé au bail et sa validité est portée à six ans, qu’il s’agisse d’une location vide ou meublée, principale ou secondaire.',
        'L’obligation s’applique à tous les types de gaz combustible présents en France : gaz naturel distribué par réseau, propane en citerne ou en bouteille, butane en bouteille. Elle s’applique également aux logements alimentés par un gaz de pétrole liquéfié (GPL) via une citerne enterrée ou aérienne, ou par une nourrice de bouteilles. Le critère retenu est la présence d’un appareil consommateur de gaz dans le logement : une simple plaque de cuisson alimentée par une bouteille de butane déclenche l’obligation si l’installation a plus de quinze ans.',
        'Sont exemptés de l’obligation les logements qui ne sont pas équipés d’installations de gaz, ainsi que les installations qui ne sont plus alimentées (compteur déposé, robinet de barrage scellé, certificat de désaffectation délivré par le distributeur). Pour ces situations, une attestation d’absence d’installation gaz peut être demandée au diagnostiqueur. Les bouteilles isolées non raccordées à une installation fixe ne déclenchent pas non plus l’obligation, mais leur usage doit respecter les règles de sécurité applicables.',
      ],
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        'Le cadre réglementaire 2026 du diagnostic gaz reste structuré autour du décret 2007-1267 et de l’arrêté du 18 novembre 2013. Une révision de la norme NF P 45-500 est intervenue en juillet 2023 pour intégrer plusieurs évolutions techniques, notamment la prise en compte des nouveaux types de raccordements flexibles ROAI (raccord à obturation automatique d’extrémité intégrée) qui remplacent progressivement les anciens raccords souples. La norme actualisée précise également les modalités d’inspection des conduits d’évacuation pour les chaudières à condensation, dont la diffusion s’est largement accélérée depuis 2020.',
        'Une modification importante concerne le périmètre du contrôle. Depuis 2024, le diagnostic intègre une vérification renforcée des ventilations hautes et basses des pièces équipées d’appareils non étanches (chaudière classique, chauffe-eau instantané). L’obstruction même partielle d’une grille de ventilation est désormais classée comme anomalie de niveau A1 nécessitant une réparation, alors qu’elle était auparavant considérée comme une simple observation. Cette évolution répond à la forte mortalité liée aux intoxications au monoxyde de carbone constatée chaque hiver.',
        'Les anomalies sont classées selon trois niveaux de gravité. Le niveau A1 correspond à une anomalie à risque non immédiat mais qui doit être corrigée dans des délais raisonnables. Le niveau A2 correspond à une anomalie nécessitant une réparation rapide pour rétablir la sécurité. Le niveau DGI (Danger Grave et Immédiat) impose la coupure immédiate de l’alimentation gaz : le diagnostiqueur procède sur place à la mise en sécurité et signale l’anomalie au distributeur de gaz, qui interrompt physiquement l’alimentation jusqu’à la mise en conformité.',
        'Les obligations du propriétaire en cas de DGI sont strictes. La coupure de l’alimentation gaz est immédiate et le distributeur n’interviendra pour la remettre qu’après attestation de mise en conformité signée par un installateur qualifié et inspection complémentaire. Le coût de cette remise en service est à la charge du propriétaire. Pour une vente ou une location, la présence d’un DGI dans le rapport rend le bien inhabitable tant que la mise en conformité n’est pas réalisée.',
        'La transition énergétique impacte également le diagnostic gaz. Depuis le 1ᵉʳ janvier 2022, l’installation de chaudières fioul est interdite dans les logements neufs ou en remplacement, ce qui pousse à un développement des chaudières gaz à condensation, des pompes à chaleur et des systèmes hybrides. Les diagnostiqueurs doivent désormais maîtriser les particularités techniques de ces systèmes hybrides, dont les conduits d’évacuation et les régulations sont plus complexes que les chaudières classiques.',
      ],
      bullets: [
        'Installation gaz > 15 ans = diagnostic obligatoire',
        'Validité 3 ans pour une vente, 6 ans pour une location',
        '18 points de contrôle obligatoires selon NF P 45-500',
        '3 niveaux d’anomalies : A1, A2, DGI',
        'DGI = coupure immédiate de l’alimentation par le distributeur',
        'Norme NF P 45-500 révisée en juillet 2023',
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic gaz',
      level: 2,
      paragraphs: [
        'Un diagnostic gaz dure typiquement entre 30 minutes et une heure et demie selon la complexité de l’installation. Le diagnostiqueur commence par recueillir les informations sur l’installation : date de mise en service, certificats de conformité Qualigaz éventuels, factures d’entretien chaudière, marques et modèles des appareils. Il identifie également le type de gaz (naturel, propane, butane) et le mode d’alimentation (réseau distributeur, citerne, bouteilles).',
        'Sur place, le diagnostiqueur réalise les 18 points de contrôle prévus par la norme NF P 45-500. Il vérifie l’étanchéité de la tuyauterie fixe par épreuve à l’azote ou détection au spray détecteur de fuite, contrôle l’aération et la ventilation des pièces, examine les organes de coupure, les robinets d’arrêt et les raccordements souples. Pour chaque appareil consommateur, il vérifie la conformité du raccordement, la présence des sécurités, le tirage de la cheminée et l’état des conduits d’évacuation.',
        'L’épreuve d’étanchéité de la tuyauterie est la phase la plus technique. Le diagnostiqueur ferme tous les robinets d’arrêt en aval, applique une pression d’épreuve réglementaire et observe le maintien de la pression sur plusieurs minutes. Toute chute de pression révèle une fuite qui doit être localisée et caractérisée. Les fuites importantes sont classées DGI et imposent une coupure immédiate ; les fuites mineures sont classées A2.',
        'À l’issue de la visite, le diagnostiqueur établit un compte rendu sur place avec les éventuelles anomalies relevées et les classes attribuées. En cas de DGI, il informe immédiatement l’occupant et le propriétaire des consignes de sécurité, ferme physiquement le robinet d’arrêt général ou la bouteille concernée, et signale le DGI au distributeur de gaz par voie électronique sécurisée dans la journée.',
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Identification de l’installation',
          text: 'Le diagnostiqueur recueille la date de mise en service, le type de gaz et les caractéristiques des appareils. Il identifie tous les éléments à contrôler.',
        },
        {
          position: 2,
          name: 'Contrôle de l’aération et de la ventilation',
          text: 'Vérification systématique des grilles d’aération haute et basse des pièces équipées d’appareils non étanches. Toute obstruction est classée comme anomalie.',
        },
        {
          position: 3,
          name: 'Épreuve d’étanchéité de la tuyauterie',
          text: 'Mise sous pression de la tuyauterie fixe et vérification de l’étanchéité sur plusieurs minutes. Localisation et caractérisation des fuites éventuelles.',
        },
        {
          position: 4,
          name: 'Contrôle des appareils et raccordements',
          text: 'Vérification des organes de coupure, des raccordements souples, des sécurités et du bon fonctionnement de chaque appareil consommateur.',
        },
        {
          position: 5,
          name: 'Inspection des conduits d’évacuation',
          text: 'Examen des conduits de fumée des chaudières et chauffe-eau non étanches : tirage, ramonage, état général, raccordement à la souche.',
        },
        {
          position: 6,
          name: 'Classement des anomalies et rapport',
          text: 'Chaque anomalie est classée A1, A2 ou DGI. En cas de DGI, le diagnostiqueur coupe l’alimentation et signale au distributeur dans la journée.',
        },
      ],
    },
    {
      id: 'prix-d-un-diagnostic-gaz',
      title: 'Combien coûte un diagnostic gaz',
      level: 2,
      paragraphs: [
        'Le prix d’un diagnostic gaz se situe en moyenne entre 90 et 160 euros toutes taxes comprises pour un appartement, et entre 110 et 200 euros pour une maison individuelle. Les écarts s’expliquent par le nombre d’appareils à contrôler, la complexité du circuit de tuyauterie et la zone géographique. En Île-de-France et dans les grandes métropoles, les tarifs sont en moyenne 15 à 20 pour cent supérieurs à ceux constatés en zone rurale.',
        'Le diagnostic gaz est rarement souscrit isolément : il est généralement intégré dans un pack de diagnostics obligatoires à la vente qui comprend également DPE, électricité, amiante, plomb et ERP. L’économie réalisée par un pack se situe entre 20 et 35 pour cent par rapport à la commande individuelle de chaque diagnostic. Pour un appartement courant, un pack vente complet coûte entre 350 et 600 euros, ce qui rend le coût marginal du gaz inférieur à 100 euros dans ce cadre.',
        'Comme pour les autres diagnostics, il est préférable d’éviter les offres anormalement basses qui correspondent souvent à des prestations expédiées en moins de quinze minutes. Un diagnostic gaz sérieux nécessite une épreuve d’étanchéité réelle et un examen systématique de chaque appareil, ce qui requiert au moins 45 minutes sur place. Un diagnostic bâclé qui passe à côté d’une fuite ou d’un DGI engage la responsabilité du diagnostiqueur mais aussi celle du propriétaire en cas d’accident sur les occupants.',
      ],
      bullets: [
        'Diagnostic gaz appartement : 90 à 160 € TTC',
        'Diagnostic gaz maison individuelle : 110 à 200 € TTC',
        'Pack vente complet (avec gaz) : 350 à 600 € TTC',
        'Surcoût remise en service après DGI : 150 à 400 €',
        'Coût d’une mise en conformité légère : 100 à 800 €',
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        'Le rapport d’un diagnostic gaz suit une structure standardisée définie par l’arrêté du 18 novembre 2013. Il commence par l’identification du bien (adresse, parcelle cadastrale), du propriétaire et du diagnostiqueur (nom, certification, organisme certificateur, assurance), ainsi que de la mission (vente, location, partie commune, mise en service). Il indique également le type de gaz, la date de mise en service de l’installation et la nature de l’alimentation.',
        'Le corps du rapport présente le tableau des 18 points de contrôle avec, pour chacun, le résultat (conforme, anomalie A1, anomalie A2, DGI ou sans objet) et une description précise de l’anomalie le cas échéant. Les principaux points contrôlés concernent l’étanchéité de la tuyauterie fixe, la ventilation des pièces, les organes de coupure, le raccordement des appareils, les conduits d’évacuation des produits de combustion, et la mise à la terre des canalisations métalliques.',
        'En cas de DGI, le rapport inclut une mention spéciale en page de garde et un encadré rappelant les obligations immédiates : coupure de l’alimentation, signalement au distributeur, interdiction d’utiliser les appareils concernés. Cette mention est particulièrement importante pour la vente : un acquéreur qui découvre un DGI dans le rapport peut légitimement exiger la mise en conformité avant la signature de l’acte authentique, voire renégocier le prix de vente à hauteur du coût des travaux.',
        'Le rapport inclut également une notice d’information à destination du propriétaire et de l’occupant sur les bonnes pratiques de sécurité, les consignes en cas d’odeur de gaz, et les numéros d’urgence (GRDF Sécurité Dépannage Gaz 0 800 47 33 33, accessible 24h/24). Cette notice est obligatoire et constitue une pièce importante du dispositif de prévention.',
      ],
    },
    {
      id: 'travaux-de-mise-en-conformite',
      title: 'Quels travaux en cas d’anomalies',
      level: 2,
      paragraphs: [
        'Les travaux de mise en conformité dépendent étroitement du type et du nombre d’anomalies relevées. Pour une anomalie A1, qui correspond à un risque non immédiat, la correction peut être planifiée dans un délai de quelques semaines à quelques mois. Il peut s’agir, par exemple, du remplacement d’une grille d’aération obstruée, du dégagement d’une fenêtre devant une grille basse, ou de la pose d’une plaque d’étanchéité sur un raccordement non utilisé. Le coût de ces interventions reste généralement modéré, entre 100 et 400 euros pour une intervention courte.',
        'Pour une anomalie A2, qui nécessite une réparation rapide, l’intervention doit être planifiée dans des délais courts (généralement quelques jours à quelques semaines) car le risque est plus élevé. Les anomalies A2 fréquentes concernent le remplacement d’un raccordement souple périmé (durée de vie 5 à 10 ans selon le type), la réfection d’une étanchéité défaillante, le changement d’un robinet d’arrêt grippé, ou la remise en état d’un conduit d’évacuation partiellement obstrué. Les coûts varient entre 200 et 1 000 euros selon la complexité.',
        'Pour un DGI, l’intervention est immédiate et impose la coupure de l’alimentation par le distributeur jusqu’à la mise en conformité. Les DGI typiques incluent une fuite de gaz importante sur la tuyauterie, un défaut majeur d’évacuation des fumées avec risque d’intoxication au monoxyde de carbone, ou un appareil utilisateur dont la sécurité est défaillante. La remise en conformité nécessite l’intervention d’un installateur qualifié, une nouvelle inspection et la délivrance d’un certificat de conformité Qualigaz avant remise du gaz par le distributeur.',
        'Pour les installations particulièrement anciennes ou vétustes, le diagnostiqueur peut recommander une rénovation complète. Le remplacement d’une chaudière classique par une chaudière à condensation, le passage à un chauffe-eau thermodynamique ou à une pompe à chaleur, et la modernisation de la tuyauterie peuvent être effectués à l’occasion d’une vente pour valoriser le bien. Ces travaux bénéficient des aides à la rénovation énergétique (MaPrimeRénov’, CEE, éco-PTZ) lorsqu’ils s’inscrivent dans une démarche de performance globale.',
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières pour la mise en conformité',
      level: 2,
      paragraphs: [
        'Les travaux de mise en conformité simple (remplacement de raccords, étanchéité) ne bénéficient pas d’aides spécifiques car ils relèvent de la maintenance courante. En revanche, lorsque la mise en conformité est l’occasion d’une rénovation plus large incluant le remplacement de la chaudière par un équipement performant, plusieurs dispositifs sont mobilisables.',
        'MaPrimeRénov’ finance le remplacement d’une chaudière classique par une chaudière à condensation très haute performance, par une pompe à chaleur ou par une chaudière biomasse. Les montants varient selon les revenus du foyer et peuvent atteindre 5 000 euros pour les ménages très modestes. Les certificats d’économies d’énergie (CEE) constituent un complément substantiel via le « coup de pouce chauffage » pour les remplacements de chaudières fioul ou gaz très anciennes.',
        'L’éco-prêt à taux zéro permet de financer jusqu’à 50 000 euros de travaux de rénovation énergétique, dont la mise à niveau d’une installation gaz à l’occasion d’un changement d’équipement. La TVA réduite à 5,5 % s’applique automatiquement aux travaux d’amélioration de la performance énergétique réalisés par un professionnel dans un logement de plus de deux ans.',
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur gaz',
      level: 2,
      paragraphs: [
        'Le diagnostic gaz doit être réalisé par un diagnostiqueur certifié COFRAC selon la norme NF EN ISO/IEC 17024 avec une compétence spécifique pour le gaz. Cette certification est différente de celle requise pour le DPE ou pour l’électricité et doit être à jour. Vérifiez sur l’annuaire des diagnostiqueurs publié par le ministère du Logement que la certification gaz est bien active et que le diagnostiqueur dispose d’une assurance responsabilité civile professionnelle adaptée.',
        'Au-delà de la certification, l’expérience pratique du diagnostiqueur est un critère important. Une installation au butane en bouteille, une citerne propane enterrée ou une chaudière à condensation récente ne se contrôlent pas avec la même expertise. Demander au diagnostiqueur s’il dispose d’un équipement de détection de fuite récent et certifié, et s’il a réalisé des contrôles similaires récemment, vous donnera une bonne indication de son professionnalisme.',
        'Vérifiez également la rigueur du diagnostiqueur sur la phase de pression d’épreuve. Cette étape technique nécessite l’utilisation d’un manomètre certifié, la fermeture de tous les robinets en aval, et un temps de stabilisation suffisant (généralement 10 à 15 minutes). Un diagnostiqueur qui expédie cette phase en quelques minutes ne détectera pas les micro-fuites qui peuvent évoluer en danger grave et immédiat dans les mois suivants. La qualité de l’épreuve d’étanchéité est le point critique du diagnostic gaz.',
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        'Plusieurs situations particulières nécessitent une expertise renforcée du diagnostiqueur gaz. Les installations alimentées en citerne propane enterrée présentent des spécificités importantes : étanchéité de la cuve (à vérifier tous les cinq ans par un professionnel), vannes de coupure spécifiques, régulateur de pression différent du gaz naturel, et règles d’implantation strictes (distance par rapport aux ouvertures du bâtiment, aux limites de propriété, aux sources de chaleur). Le diagnostic d’une installation propane est plus complexe et plus coûteux que celui d’une installation au gaz naturel de ville.',
        'Les installations mixtes combinant plusieurs sources d’alimentation (gaz naturel principal + appoint propane en bouteille, par exemple) nécessitent une attention particulière. Chaque circuit doit être contrôlé indépendamment, et les éventuelles interconnexions doivent être vérifiées pour s’assurer qu’elles respectent les règles de sécurité (clapets anti-retour, vannes de séparation, etc.). Ces installations sont fréquentes dans les zones rurales non desservies par le réseau gaz et dans les bâtiments à usage saisonnier.',
        'Les chaudières à condensation récentes posent des défis spécifiques pour le diagnostic gaz. Leurs conduits d’évacuation sont en matière synthétique (généralement PPS résistant aux condensats acides), leur fonctionnement à basse température produit des fumées humides qui peuvent saturer les conduits anciens non adaptés, et leur électronique de régulation complexe nécessite une compréhension technique poussée. Le diagnostiqueur doit vérifier la compatibilité du conduit d’évacuation avec le type de chaudière installée et l’absence de défauts d’étanchéité sur le parcours.',
        'Les installations avec chauffage au sol gaz sont rares mais existent encore dans certains logements anciens des années 1960-1970. Le contrôle de l’étanchéité de la tuyauterie noyée dans la dalle est particulièrement difficile et nécessite des techniques de détection spécifiques (gaz traceur sous pression, caméra thermique). Les fuites sur ces installations peuvent rester invisibles pendant des années et déclencher un DGI lors d’un contrôle approfondi. Pour ces installations, un contrôle préventif tous les cinq ans est recommandé, même en dehors d’une vente ou location.',
        'Les locaux à risque accru (caves voûtées, sous-sols enterrés, locaux semi-enterrés avec mauvaise ventilation) imposent une vigilance maximale. Le gaz, plus lourd que l’air pour le propane et plus léger pour le gaz naturel, peut s’accumuler dans certaines zones et créer des risques d’explosion à long terme. Le diagnostiqueur doit prêter une attention particulière à la ventilation de ces locaux et au cheminement des fuites potentielles. Toute installation gaz dans un local à risque accru fait l’objet d’une attention renforcée et d’éventuelles recommandations de mise en conformité plus strictes que la norme.',
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        'Une première erreur fréquente consiste à négliger l’entretien annuel de la chaudière alors que le diagnostic gaz est positif. Le diagnostic et l’entretien sont deux opérations distinctes : le diagnostic photographie la conformité à un instant donné, mais une chaudière mal entretenue peut développer des défauts entre deux diagnostics. L’entretien annuel obligatoire (article 31-7 du décret 87-712) vérifie l’état de la chaudière, nettoie le brûleur, contrôle les électrovannes, mesure les rejets et le rendement. Sans cet entretien, la chaudière peut devenir dangereuse même si l’installation gaz est conforme.',
        'Une deuxième erreur consiste à effectuer soi-même des modifications sur l’installation gaz. Le déplacement d’une plaque de cuisson, l’ajout d’un appareil consommateur, la modification du raccordement sont des opérations strictement réservées à un professionnel qualifié Qualigaz. Toute intervention non professionnelle invalide les garanties d’assurance et engage la responsabilité civile et pénale de la personne en cas d’incident. Les modifications doivent obligatoirement être suivies d’une nouvelle attestation de conformité Qualigaz délivrée par l’installateur.',
        'Une troisième erreur consiste à ignorer les odeurs de gaz légères en pensant qu’elles sont normales. Le gaz naturel et le propane sont odorisés (ajout de mercaptan) précisément pour permettre la détection des fuites. Toute odeur de gaz, même légère, doit être prise au sérieux : coupure immédiate de l’alimentation au compteur ou à la bouteille, ouverture des fenêtres, absence d’activation d’interrupteurs électriques (étincelles), sortie du logement, appel au numéro d’urgence GRDF Sécurité Dépannage Gaz 0 800 47 33 33. La rapidité de réaction est cruciale en cas de fuite.',
        'Une quatrième erreur consiste à utiliser des appareils de chauffage d’appoint au butane en bouteille dans des locaux non ventilés. Ces appareils émettent du monoxyde de carbone et du dioxyde de carbone, et leur usage dans un local non ventilé peut rapidement créer un risque d’intoxication grave, voire mortel. Chaque hiver, plusieurs dizaines de décès en France sont imputables à ce type d’usage. Les radiateurs au butane ne doivent être utilisés que dans des locaux bien aérés, jamais pendant le sommeil, et de préférence avec un détecteur de monoxyde de carbone.',
        'Une cinquième erreur consiste à différer indéfiniment les travaux de mise en conformité après un diagnostic positif. Une anomalie A1 doit être corrigée dans un délai raisonnable (quelques semaines à mois), pas reportée à plusieurs années. Une anomalie A2 doit être traitée dans les jours ou semaines qui suivent. La logique du diagnostic est préventive : intervenir avant qu’une anomalie A1 ne devienne A2 puis DGI, ce qui peut se produire en quelques années par accumulation des défauts.',
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        'Le diagnostic gaz est l’un des diagnostics les plus importants en matière de sécurité des occupants. Les risques d’intoxication au monoxyde de carbone, d’explosion et d’incendie liés au gaz combustible justifient un dispositif réglementaire rigoureux qui s’applique à toutes les installations intérieures de plus de quinze ans. La protection des occupants est l’enjeu principal, et la responsabilité du propriétaire bailleur ou vendeur peut être engagée gravement en cas d’incident lié à un défaut connu et non traité.',
        'Le critère d’obligation est l’âge de l’installation gaz, pas l’âge du bâtiment. Une installation neuve dans un bâtiment ancien n’est pas concernée par le diagnostic obligatoire, tandis qu’une installation d’origine dans un bâtiment récent l’est dès que l’installation dépasse quinze ans. Cette règle s’applique à tous les types de gaz combustible (naturel, propane, butane) et à toutes les configurations d’alimentation (réseau, citerne enterrée ou aérienne, nourrice de bouteilles).',
        'La validité du diagnostic est de 3 ans pour une vente et 6 ans pour une location. Cette différence reflète la dynamique des transactions immobilières : un bien en vente peut rester sur le marché pendant plusieurs mois et le diagnostic doit rester pertinent jusqu’à la signature de l’acte authentique. Pour les locations, la stabilité du contrat permet une validité plus longue. Dans tous les cas, un nouveau diagnostic doit être réalisé en cas de modification importante de l’installation (changement de chaudière, ajout d’un appareil, déplacement d’une tuyauterie).',
        'Les 18 points de contrôle de la norme NF P 45-500 couvrent l’ensemble des composants de l’installation : étanchéité de la tuyauterie fixe, ventilation des pièces, organes de coupure, raccordements souples, sécurités des appareils, conduits d’évacuation des produits de combustion, mise à la terre des canalisations métalliques. Les anomalies sont classées en trois niveaux (A1, A2, DGI) selon leur gravité. Le DGI impose une coupure immédiate de l’alimentation par le distributeur et conditionne l’habitabilité du logement.',
        'Le coût du diagnostic gaz est généralement compris entre 90 et 200 euros, mais le coût des travaux de mise en conformité peut varier de quelques centaines d’euros (remplacement d’un raccord souple) à plusieurs milliers d’euros (rénovation complète de la tuyauterie). Pour les remplacements d’équipements (chaudière par exemple), les aides MaPrimeRénov’, CEE et éco-PTZ peuvent couvrir une part importante du coût lorsque la nouvelle chaudière est performante (condensation très haute performance, pompe à chaleur).',
        'Le choix du diagnostiqueur doit privilégier la certification COFRAC spécifique au gaz, l’équipement à jour (manomètre certifié, détecteur de fuite récent), et l’expérience pratique dans des installations similaires. La rigueur sur la phase de pression d’épreuve est le point critique : un diagnostiqueur qui expédie cette étape ne détecte pas les micro-fuites qui peuvent évoluer en DGI dans les mois suivants. L’entretien annuel obligatoire des chaudières (à la charge de l’occupant) complète le dispositif de prévention et ne doit pas être négligé.',
        'L’évolution du parc d’équipements vers les pompes à chaleur, les chaudières à condensation et les systèmes hybrides modifie progressivement la nature des contrôles à effectuer. Les diagnostiqueurs doivent se former en continu pour maîtriser les particularités techniques de ces nouveaux équipements, notamment les conduits d’évacuation des chaudières à condensation (matériaux synthétiques résistant aux condensats acides) et les régulations électroniques complexes des systèmes hybrides. La transition énergétique impacte donc directement la pratique du diagnostic gaz, et le choix d’un professionnel à jour de ces évolutions est un gage de qualité supplémentaire.',
        'La sensibilisation des occupants aux bonnes pratiques de sécurité gaz reste un volet essentiel souvent négligé. Les principales consignes (ne pas obstruer les grilles d’aération, ne pas utiliser d’appareils nomades au butane dans des locaux non ventilés, faire entretenir annuellement la chaudière, réagir immédiatement à toute odeur de gaz) doivent être rappelées au locataire à la remise des clés et affichées dans les copropriétés. Le numéro d’urgence GRDF Sécurité Dépannage Gaz (0 800 47 33 33), accessible 24h/24, doit être connu de tous les occupants. Cette information préventive sauve des vies chaque hiver, particulièrement lors des pics d’intoxication au monoxyde de carbone qui touchent jusqu’à 4 000 personnes par an en France. L’installation d’un détecteur de monoxyde de carbone certifié dans chaque pièce équipée d’un appareil non étanche (chaudière classique, chauffe-eau instantané, poêle) est une protection complémentaire indispensable, dont le coût modeste (30 à 80 euros par détecteur) est largement compensé par la sécurité apportée.',
        'La cohabitation entre le diagnostic gaz et les autres diagnostics du dossier de diagnostic technique mérite enfin d’être soulignée. Une installation gaz peut interagir avec l’installation électrique (raccordement au compteur, mise à la terre des canalisations métalliques), avec la performance énergétique (chaudière vétuste pénalisant le DPE), avec l’audit énergétique (préconisation de remplacement de chaudière dans les scénarios de travaux) ou avec le diagnostic amiante (joints d’étanchéité amiantés sur les anciennes chaudières fioul converties). Une analyse coordonnée de l’ensemble des diagnostics permet d’identifier les synergies entre travaux et d’optimiser les opérations de rénovation, particulièrement lors des mutations immobilières où le bouquet de diagnostics doit être réalisé simultanément. Cette approche globale réduit les délais et le coût total des prestations.',
      ],
    },
  ],
  faq: [
    {
      question: 'À partir de quand un diagnostic gaz est-il obligatoire ?',
      answer:
        'Le diagnostic gaz est obligatoire pour toute installation intérieure de gaz dont la mise en service ou la dernière modification importante remonte à plus de 15 ans.',
    },
    {
      question: 'Quelle est la durée de validité d’un diagnostic gaz ?',
      answer:
        'La validité est de 3 ans pour une vente et de 6 ans pour une location, à compter de la date de réalisation du diagnostic.',
    },
    {
      question: 'Que signifie un DGI dans un diagnostic gaz ?',
      answer:
        'DGI signifie « Danger Grave et Immédiat ». Le diagnostiqueur procède à la coupure immédiate de l’alimentation et signale l’anomalie au distributeur de gaz, qui n’interviendra pour la remise en service qu’après mise en conformité.',
    },
    {
      question: 'Combien coûte un diagnostic gaz ?',
      answer:
        'Entre 90 et 160 € TTC pour un appartement et 110 à 200 € pour une maison. Le coût marginal dans un pack vente complet est généralement inférieur à 100 €.',
    },
    {
      question: 'Quelle norme régit le diagnostic gaz ?',
      answer:
        'La norme NF P 45-500 définit les 18 points de contrôle obligatoires et les critères de classement des anomalies (A1, A2, DGI). Elle a été révisée en juillet 2023.',
    },
    {
      question: 'Le diagnostic gaz est-il obligatoire pour une bouteille de butane ?',
      answer:
        'Oui, dès lors qu’une bouteille est raccordée à une installation fixe (plaque de cuisson par exemple) dont la mise en service remonte à plus de 15 ans, le diagnostic est obligatoire.',
    },
    {
      question: 'Que faire si le diagnostic révèle une anomalie A1 ?',
      answer:
        'Une anomalie A1 correspond à un risque non immédiat mais doit être corrigée dans un délai raisonnable (quelques semaines à mois). Un installateur qualifié peut intervenir pour la mise en conformité.',
    },
    {
      question: 'Le diagnostic gaz remplace-t-il l’entretien annuel de la chaudière ?',
      answer:
        'Non, ce sont deux opérations distinctes. L’entretien annuel reste obligatoire pour toute chaudière à gaz et est à la charge de l’occupant (article 31-7 du décret 87-712).',
    },
    {
      question: 'Qui paie le diagnostic gaz en cas de vente ?',
      answer:
        'C’est le vendeur qui prend en charge le coût du diagnostic gaz, intégré généralement dans le pack de diagnostics obligatoires à la vente.',
    },
    {
      question: 'Le diagnostic gaz est-il obligatoire pour une location vide ?',
      answer:
        'Oui, le diagnostic est obligatoire pour toute location, vide ou meublée, dès lors que l’installation a plus de 15 ans. La validité est alors de 6 ans.',
    },
    {
      question: 'Combien de temps dure un diagnostic gaz ?',
      answer:
        'Entre 30 minutes et 1h30 sur place selon la complexité de l’installation et le nombre d’appareils à contrôler. Le rapport est généralement remis sous 24 à 48 heures.',
    },
    {
      question: 'Peut-on faire un diagnostic gaz soi-même ?',
      answer:
        'Non, seul un diagnostiqueur certifié COFRAC pour le gaz peut réaliser ce diagnostic. Les autodiagnostics ou les contrôles par un installateur n’ont pas valeur de diagnostic réglementaire.',
    },
    {
      question: 'Que se passe-t-il en cas d’absence de diagnostic gaz à la vente ?',
      answer:
        'L’absence de diagnostic expose le vendeur à des recours en garantie des vices cachés et peut engager sa responsabilité en cas d’accident. La clause exonératoire de garantie des vices cachés ne s’applique pas.',
    },
    {
      question: 'Le diagnostic gaz couvre-t-il les appareils mobiles ?',
      answer:
        'Le diagnostic couvre les appareils raccordés en permanence à l’installation fixe. Les barbecues à gaz extérieurs ou les appareils nomades isolés ne sont pas inclus.',
    },
    {
      question: 'Quels conseils en cas d’odeur de gaz ?',
      answer:
        'Coupez immédiatement l’alimentation au compteur ou à la bouteille, ouvrez les fenêtres, n’actionnez aucun interrupteur électrique, sortez du logement et appelez GRDF Sécurité Dépannage Gaz au 0 800 47 33 33.',
    },
  ],
}
