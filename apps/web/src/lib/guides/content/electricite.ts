/**
 * Guide long — Diagnostic Électricité.
 *
 * Sources : décret 2008-384, arrêté du 28 septembre 2017, norme NF C 16-600,
 * articles L134-7 du Code de la construction et de l'habitation, NF C 15-100
 * (référentiel de conception), Consuel, ENEDIS.
 */

import type { Guide } from '../types'

export const ELECTRICITE_GUIDE: Guide = {
  type: 'electricite',
  slug: 'electricite',
  shortTitle: 'Électricité',
  title: 'Diagnostic électricité : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout savoir sur le diagnostic électrique : installations de plus de 15 ans, norme NF C 16-600, points de contrôle et obligations propriétaire.',
  metaDescription:
    'Diagnostic électricité 2026 : installation > 15 ans, norme NF C 16-600, anomalies, validité 3 ans (vente) ou 6 ans (location). Guide KOVAS.',
  teaser:
    'Installations électriques > 15 ans, norme NF C 16-600, anomalies B1/B2 et 87 points de contrôle.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 26,
  wordCount: 5200,
  relatedTypes: ['gaz', 'dpe', 'amiante', 'audit-energetique'],
  sections: [
    {
      id: 'qu-est-ce-que-le-diagnostic-electricite',
      title: 'Qu’est-ce que le diagnostic électricité',
      level: 2,
      paragraphs: [
        "Le diagnostic électricité, ou « état de l’installation intérieure d’électricité », est un diagnostic réglementaire obligatoire qui évalue la sécurité de l’installation électrique d’un logement. Il est encadré par l’article L134-7 du Code de la construction et de l’habitation, par le décret 2008-384 du 22 avril 2008 et par l’arrêté du 28 septembre 2017 qui définit le protocole technique de réalisation. La référence normative principale est la norme NF C 16-600 qui détaille les 87 points de contrôle obligatoires et les critères de classement des anomalies.",
        "L’objectif premier du diagnostic est la protection des occupants contre les risques d’électrocution, d’électrisation et d’incendie d’origine électrique. Selon l’Observatoire national de la sécurité électrique (ONSE), les installations électriques anciennes ou défectueuses sont à l’origine d’environ 50 000 incendies et 200 décès par an en France. Une majorité de ces sinistres surviennent dans des logements dont l’installation électrique a plus de quarante ans et n’a pas fait l’objet d’une mise à niveau aux standards de sécurité modernes.",
        "Le diagnostic électricité porte sur l’ensemble de l’installation depuis le compteur électrique et le disjoncteur de branchement jusqu’aux bornes d’alimentation des appareils utilisateurs. Il couvre le tableau électrique avec ses dispositifs de protection (disjoncteurs divisionnaires, interrupteurs différentiels), les circuits de prises et d’éclairage, la liaison équipotentielle de la salle de bains, la prise de terre et son organe de coupure, ainsi que tous les éléments de protection contre les contacts directs et indirects.",
        "Le diagnostic électricité est différent du Consuel, qui est l’attestation de conformité délivrée par l’organisme du même nom pour les installations neuves ou rénovées avant la mise en service par le distributeur. Le Consuel valide la conformité de l’installation à la norme NF C 15-100 (norme de conception), tandis que le diagnostic électricité, basé sur la NF C 16-600, vérifie la sécurité d’une installation existante. Ces deux référentiels sont complémentaires et n’ont pas la même finalité.",
      ],
    },
    {
      id: 'quand-le-diagnostic-est-il-obligatoire',
      title: 'Quand le diagnostic électricité est-il obligatoire',
      level: 2,
      paragraphs: [
        "Le diagnostic électricité est obligatoire pour toute installation intérieure d’électricité dont la mise en service initiale ou la dernière modification importante remonte à plus de quinze ans. Le critère retenu est l’âge de l’installation et non celui du bâtiment : une installation refaite entièrement il y a moins de 15 ans dans un immeuble ancien n’est pas concernée, alors qu’une installation d’origine dans un logement des années 2005 le sera. La date de référence peut être attestée par le Consuel délivré lors de la mise en service ou par des factures détaillées de travaux significatifs.",
        "L’obligation se manifeste dans deux cas. Lors d’une vente, le diagnostic doit être annexé au compromis de vente et figurer dans le dossier de diagnostic technique remis au notaire. Sa validité est alors de trois ans à compter de sa réalisation. Lors d’une mise en location, le diagnostic doit être annexé au bail et sa validité est portée à six ans, qu’il s’agisse d’une location vide ou meublée, d’une résidence principale ou secondaire.",
        "L’obligation s’applique à tous les logements raccordés au réseau électrique public, y compris les logements alimentés en triphasé ou par une production photovoltaïque autoconsommée. Les locaux annexes au logement et alimentés par une installation distincte ne sont pas inclus, sauf s’ils sont fonctionnellement intégrés au logement (garage attenant, sous-sol aménagé, dépendances communiquant directement).",
        "Sont exemptés de l’obligation les logements qui ne sont pas raccordés à l’électricité, les biens raccordés depuis moins de quinze ans sans modification ultérieure, et les logements destinés à être démolis dans le cadre d’une opération urbaine attestée par un arrêté municipal ou préfectoral. Dans ce dernier cas, la mention de l’opération de démolition figure dans l’acte de vente et dispense du diagnostic.",
      ],
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        "Le cadre réglementaire 2026 du diagnostic électricité reste fondé sur le décret 2008-384 et l’arrêté du 28 septembre 2017. Une révision de la norme NF C 16-600 est intervenue en avril 2024 pour intégrer plusieurs évolutions techniques majeures, dont la prise en compte des bornes de recharge pour véhicules électriques (IRVE) installées dans les logements et de l’autoconsommation photovoltaïque. Ces nouvelles installations doivent désormais faire l’objet de contrôles spécifiques lorsqu’elles sont présentes dans le logement diagnostiqué.",
        "Les anomalies sont classées selon deux niveaux principaux. Le niveau B1 correspond à une anomalie nécessitant une correction sans urgence immédiate, par exemple l’absence d’une protection différentielle 30 mA sur un circuit non critique. Le niveau B2 correspond à une anomalie présentant un risque de sécurité immédiat et nécessitant une intervention rapide, comme l’absence d’interrupteur différentiel principal ou l’absence de prise de terre. Contrairement au diagnostic gaz, il n’existe pas de catégorie « DGI » dans le diagnostic électricité, mais le rapport peut comporter une mention de « risque grave » pour les anomalies les plus critiques.",
        "Les six points fondamentaux contrôlés sont : la présence d’un dispositif de coupure générale, la présence d’au moins une protection différentielle 30 mA, la présence d’une prise de terre et de sa liaison équipotentielle, la protection contre les surintensités de chaque circuit, l’adaptation de l’installation aux contraintes de la salle de bains, et l’absence de matériaux conducteurs accessibles. Une installation qui ne satisfait pas à ces six points fondamentaux est jugée non conforme à un niveau de sécurité acceptable.",
        "Une évolution importante de 2025 concerne les installations photovoltaïques autoconsommées. Le diagnostiqueur doit désormais vérifier la présence et le bon fonctionnement du dispositif de découplage automatique, la conformité du raccordement au tableau général, la protection foudre éventuelle, et l’absence de modifications non déclarées des protections. Ces contrôles s’ajoutent aux 87 points classiques de la norme NF C 16-600. Les diagnostiqueurs doivent suivre une formation spécifique pour réaliser ces contrôles complémentaires.",
        "Pour les bornes de recharge des véhicules électriques (Wallbox), le diagnostic vérifie la conformité du circuit dédié, la présence d’une protection différentielle de type B ou A renforcée, la section adaptée des conducteurs et la mise à la terre. Les installations IRVE non conformes sont systématiquement classées en anomalie B2 en raison du risque incendie potentiel. La généralisation des Wallbox depuis 2022 rend cette vérification particulièrement importante en 2026.",
      ],
      bullets: [
        "Installation électrique > 15 ans = diagnostic obligatoire",
        "Validité 3 ans pour une vente, 6 ans pour une location",
        "87 points de contrôle obligatoires selon NF C 16-600",
        "2 niveaux d’anomalies : B1 (sans urgence), B2 (intervention rapide)",
        "6 points fondamentaux : coupure, différentiel, terre, surintensité, salle de bain, matériaux",
        "Norme NF C 16-600 révisée en avril 2024 (IRVE, photovoltaïque)",
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic électricité',
      level: 2,
      paragraphs: [
        "Un diagnostic électricité dure typiquement entre une heure et deux heures selon la complexité de l’installation et la taille du logement. Le diagnostiqueur commence par recueillir les informations administratives : date de mise en service de l’installation, attestation Consuel éventuelle, factures de travaux significatifs, présence d’équipements particuliers (bornes IRVE, panneaux photovoltaïques, chauffage au sol électrique). Il identifie ensuite le type d’alimentation (monophasé, triphasé), la puissance souscrite et la nature du tableau électrique.",
        "L’examen visuel constitue le cœur de la prestation. Le diagnostiqueur ouvre le tableau électrique principal et inventorie systématiquement chaque organe de protection : disjoncteur de branchement, interrupteur différentiel principal, interrupteurs différentiels 30 mA, disjoncteurs divisionnaires de chaque circuit. Il vérifie le calibrage, l’étiquetage, la sensibilité et le bon état général de chaque dispositif. Toute anomalie est consignée avec sa localisation précise et son classement (B1 ou B2).",
        "Le diagnostiqueur teste ensuite le bon fonctionnement des dispositifs différentiels par le bouton « test » présent sur chaque appareil. Cette vérification est rapide mais essentielle car un différentiel défaillant ne protégera pas les occupants en cas de défaut d’isolement. Il mesure également la résistance de la prise de terre à l’aide d’un appareil de mesure spécifique (telluromètre). Une terre dont la résistance est trop élevée est ineffective et constitue une anomalie B2 majeure.",
        "Le contrôle inclut un examen pièce par pièce des circuits, des prises et des points d’éclairage. Le diagnostiqueur vérifie l’absence de matériaux conducteurs apparents, l’état des conducteurs souples, la conformité des prises à la norme actuelle (présence de la broche de terre, absence de fissures), et l’adaptation des protections de la salle de bains aux volumes définis par la NF C 15-100 (volumes 0, 1, 2 et 3 avec contraintes spécifiques d’IPX et de protection différentielle).",
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Étude documentaire et identification',
          text: "Le diagnostiqueur recueille la date de mise en service, le Consuel éventuel, les factures de travaux et identifie les équipements particuliers (IRVE, photovoltaïque).",
        },
        {
          position: 2,
          name: 'Examen du tableau électrique',
          text: "Inventaire systématique des dispositifs de protection : disjoncteur de branchement, différentiels, disjoncteurs divisionnaires. Vérification du calibrage et de l’étiquetage.",
        },
        {
          position: 3,
          name: 'Test des dispositifs différentiels',
          text: "Vérification du bon fonctionnement de chaque interrupteur différentiel par le bouton test et mesure de la sensibilité réelle.",
        },
        {
          position: 4,
          name: 'Mesure de la résistance de la prise de terre',
          text: "Mesure au telluromètre de la résistance de la prise de terre. Une résistance > 100 Ω en présence d’un différentiel 30 mA est une anomalie majeure.",
        },
        {
          position: 5,
          name: 'Contrôle pièce par pièce',
          text: "Examen des circuits, prises, points d’éclairage et installations spéciales (salle de bains, cuisine). Vérification de la conformité aux 87 points de la NF C 16-600.",
        },
        {
          position: 6,
          name: 'Rapport et préconisations',
          text: "Le rapport classe chaque anomalie B1 ou B2 et indique les préconisations de mise en sécurité. Un examen des six points fondamentaux est synthétisé en page de garde.",
        },
      ],
    },
    {
      id: 'prix-d-un-diagnostic-electricite',
      title: 'Combien coûte un diagnostic électricité',
      level: 2,
      paragraphs: [
        "Le prix d’un diagnostic électricité se situe en moyenne entre 100 et 180 euros toutes taxes comprises pour un appartement, et entre 130 et 250 euros pour une maison individuelle. Les écarts s’expliquent par la surface, le nombre de circuits et la complexité de l’installation. Une maison récente avec tableau modulaire moderne se contrôle plus rapidement qu’un appartement haussmannien avec installation d’origine et plusieurs ajouts successifs.",
        "Le diagnostic électricité est généralement intégré dans un pack de diagnostics obligatoires à la vente avec DPE, gaz, amiante, plomb et ERP. Le coût marginal du diagnostic dans un pack se situe entre 80 et 120 euros, ce qui constitue une économie sensible par rapport à la commande individuelle. Pour les biens loués, un pack location est également proposé par la plupart des sociétés de diagnostic.",
        "Comme pour les autres diagnostics, le critère prix ne doit pas être le seul à guider votre choix. Un diagnostic électricité réalisé en moins d’une demi-heure sans test sérieux des dispositifs différentiels et sans mesure de la prise de terre a une valeur juridique très limitée. En cas de sinistre électrique ultérieur, un rapport bâclé peut être facilement contesté par l’assurance ou par l’acquéreur, avec des conséquences financières importantes pour le vendeur.",
      ],
      bullets: [
        "Diagnostic électricité appartement : 100 à 180 € TTC",
        "Diagnostic électricité maison individuelle : 130 à 250 € TTC",
        "Pack vente complet (avec électricité) : 350 à 600 € TTC",
        "Coût d’une mise en conformité légère (tableau) : 200 à 1 500 €",
        "Mise en conformité complète installation ancienne : 3 000 à 8 000 €",
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        "Le rapport d’un diagnostic électricité suit une structure standardisée. Il comprend l’identification du bien, du propriétaire, du diagnostiqueur (nom, certification, organisme certificateur, attestation d’assurance) et de la mission (vente, location, partie commune). La date de mise en service de l’installation et la puissance souscrite figurent également dans l’en-tête. Le diagnostiqueur précise les éventuelles parties non visitées (locaux fermés, accès refusé) et leur incidence sur le résultat.",
        "La page de garde présente une synthèse en six items correspondant aux six points fondamentaux de sécurité : présence d’un appareil général de coupure, présence d’une protection différentielle 30 mA, présence d’une prise de terre, protection contre les surintensités, sécurité de la salle de bains, absence de matériaux conducteurs accessibles. Pour chaque point, le rapport indique si l’installation est conforme ou non, ce qui permet de juger rapidement de l’état global.",
        "Le corps du rapport présente le tableau exhaustif des 87 points de contrôle avec, pour chacun, le résultat (conforme, B1, B2 ou sans objet) et une description précise de l’anomalie le cas échéant. Les anomalies sont localisées avec précision (par exemple « tableau électrique principal, circuit prises chambre 2, absence de différentiel 30 mA »). Pour les bâtiments complexes ou avec plusieurs niveaux, les anomalies peuvent être présentées par zone ou par pièce.",
        "Le rapport inclut systématiquement un schéma synoptique du tableau électrique principal et, le cas échéant, des tableaux divisionnaires, avec mention des protections présentes et de leurs caractéristiques. Cette représentation graphique facilite la lecture par un installateur qui sera amené à réaliser les travaux de mise en conformité. Une notice d’information sur la sécurité électrique et les bonnes pratiques d’usage complète le document.",
      ],
    },
    {
      id: 'travaux-de-mise-en-conformite',
      title: 'Quels travaux en cas d’anomalies',
      level: 2,
      paragraphs: [
        "Les travaux de mise en conformité dépendent étroitement de la nature et du nombre d’anomalies. Pour des anomalies B1 isolées, des interventions ponctuelles suffisent généralement. L’ajout d’un interrupteur différentiel 30 mA sur un circuit dépourvu de protection, le remplacement d’une prise détériorée ou la pose d’une plaque de fond sur un tableau apparent coûtent entre 100 et 500 euros par intervention. Ces opérations sont à la charge du propriétaire et doivent être réalisées par un électricien qualifié.",
        "Pour les anomalies B2, les interventions sont plus substantielles. Le remplacement d’un tableau électrique vétuste par un tableau modulaire moderne coûte généralement entre 800 et 2 000 euros selon le nombre de modules nécessaires. La création d’une prise de terre ou l’amélioration d’une terre défaillante (piquets enfoncés, ceinturage) coûte entre 300 et 1 200 euros. La mise aux normes de la salle de bains avec les protections différentielles adaptées et la liaison équipotentielle se chiffre entre 400 et 1 000 euros.",
        "Pour les installations très anciennes (avant 1970) ou pour les logements avec de nombreuses anomalies B2 cumulées, une rénovation complète de l’installation peut s’avérer plus économique. Cette opération comprend le remplacement intégral du tableau et des organes de protection, la rénovation des circuits avec remplacement des conducteurs, la création des circuits manquants (cuisine, salle de bains, électroménager), la pose d’une nouvelle prise de terre et le passage au compteur Linky communicant. Le coût d’une rénovation complète varie entre 4 000 et 12 000 euros pour un appartement de taille moyenne, davantage pour une maison individuelle.",
        "Les chantiers de rénovation électrique sont rarement urgents au point d’imposer une coupure immédiate, contrairement au diagnostic gaz avec ses DGI. Toutefois, certaines anomalies B2 majeures (terre absente, différentiel principal manquant, court-circuit potentiel) doivent être traitées dans les semaines suivant la constatation. Les autres anomalies peuvent être planifiées dans un délai compatible avec les contraintes du propriétaire, en particulier lors d’une vente où l’acquéreur peut prendre en charge les travaux après acquisition à un prix renégocié.",
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières pour la rénovation électrique',
      level: 2,
      paragraphs: [
        "Contrairement aux travaux de rénovation énergétique, les travaux de mise en conformité électrique ne bénéficient pas de MaPrimeRénov’ ou des CEE en tant que tels, car ils ne génèrent pas d’économies d’énergie directes. Cependant, lorsque les travaux électriques s’inscrivent dans une opération plus globale de rénovation (changement de chauffage, isolation, ventilation), ils peuvent être inclus dans le plan de financement subventionné.",
        "L’éco-prêt à taux zéro permet de financer jusqu’à 50 000 euros de travaux de rénovation, dont la mise aux normes électrique réalisée dans le cadre d’une rénovation globale. La TVA réduite à 10 % s’applique automatiquement aux travaux de rénovation électrique réalisés par un professionnel dans un logement de plus de deux ans, ce qui constitue une économie substantielle.",
        "Pour les ménages en situation de précarité, l’Anah propose des aides via le programme « Habiter Sain » pour le traitement de l’habitat indigne incluant les installations électriques dangereuses. Le taux d’aide peut atteindre 50 à 70 % du coût des travaux pour les propriétaires modestes, plafonné à 25 000 euros. Renseignez-vous auprès de l’ADIL ou des opérateurs OPAH de votre commune.",
        "Enfin, certaines collectivités locales (régions, départements, communes) proposent des aides complémentaires pour la rénovation électrique, en particulier dans le cadre de la lutte contre l’habitat dégradé. Ces aides varient selon les territoires et peuvent atteindre quelques milliers d’euros. Une recherche sur le site de votre collectivité ou sur France Rénov’ permet d’identifier les dispositifs locaux mobilisables.",
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur électricité',
      level: 2,
      paragraphs: [
        "Le diagnostic électricité doit être réalisé par un diagnostiqueur certifié COFRAC selon la norme NF EN ISO/IEC 17024 avec une compétence spécifique en électricité. Cette certification est distincte de celles requises pour le DPE, le gaz ou l’amiante. Vérifiez sur l’annuaire officiel des diagnostiqueurs que la certification électricité est bien active et que le professionnel dispose d’une assurance responsabilité civile adaptée avec une couverture d’au moins 300 000 euros par sinistre.",
        "Au-delà de la certification, l’équipement du diagnostiqueur est un critère important. Un telluromètre récent et calibré, un multimètre de classe professionnelle et des outils de test différentiel adaptés sont indispensables pour réaliser des mesures fiables. Demandez au diagnostiqueur s’il dispose de ces équipements et s’ils ont fait l’objet d’un étalonnage récent. L’expérience du diagnostiqueur dans des installations similaires à la vôtre (immeuble ancien, maison récente, installations spéciales) est également déterminante.",
        "La méthode de travail et la rigueur de la documentation sont également des indicateurs clés. Un diagnostiqueur sérieux ouvre systématiquement le tableau électrique principal (et les tableaux divisionnaires éventuels), photographie l’ensemble des dispositifs, vérifie pièce par pièce les prises et points d’éclairage, et utilise un logiciel professionnel qui structure le rapport selon la norme NF C 16-600. Une visite expédiée en moins de 45 minutes pour un appartement standard ou en moins d’1h30 pour une maison doit éveiller votre vigilance sur la qualité du diagnostic.",
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        "Plusieurs configurations particulières demandent une expertise renforcée. Les installations en triphasé (380V au lieu de 230V monophasé) sont fréquentes dans les maisons individuelles équipées de pompes à chaleur, chauffe-eau de grande capacité ou bornes de recharge IRVE puissantes. Le diagnostic triphasé impose des protections différentielles spécifiques (type B obligatoire dans certains cas), une équilibration des phases, et une vérification de la cohérence de la puissance souscrite avec la nature des équipements. Le diagnostiqueur doit maîtriser ces spécificités pour réaliser un contrôle pertinent.",
        "Les installations photovoltaïques en autoconsommation introduisent une complexité supplémentaire. Le dispositif de découplage automatique doit fonctionner correctement pour isoler l’installation du réseau public en cas de coupure ENEDIS (sécurité des intervenants en cas d’incident). Le raccordement au tableau général doit comporter une protection adaptée, et les onduleurs doivent être positionnés dans des locaux ventilés et accessibles. Depuis 2024, ces vérifications font partie intégrante du diagnostic électricité, ce qui n’était pas le cas auparavant.",
        "Les chaudières électriques et les chauffe-eau de grande capacité (300 litres et plus) imposent des circuits dédiés avec des protections adaptées et une section de conducteur calculée précisément. Le diagnostiqueur doit vérifier que ces équipements sont sur leur propre circuit, avec une protection différentielle 30 mA dédiée, et un calibrage du disjoncteur cohérent avec la puissance de l’appareil. Une chaudière électrique branchée sur un circuit prises classiques constitue une anomalie B2 majeure avec risque d’incendie.",
        "Les installations dans les caves, garages et locaux humides obéissent à des règles spécifiques de protection contre l’humidité (indice IP) et contre les chocs mécaniques (indice IK). Les prises électriques en sous-sol doivent généralement être de type IP44 ou IP55, et les luminaires doivent supporter des conditions humides. Le diagnostiqueur doit vérifier l’adaptation de chaque dispositif à son environnement, particulièrement pour les locaux où des dégâts des eaux sont survenus.",
        "Les biens avec installation électrique en mauvais état apparent (conducteurs vétustes, tableaux à fusibles porcelaine, absence totale de différentiel, mise à la terre absente) ne doivent pas être loués ou vendus sans une rénovation préalable. Bien que le diagnostic se limite à constater les anomalies, le bailleur ou vendeur engage sa responsabilité civile en cas d’incendie ou d’électrocution résultant d’un défaut signalé dans le rapport. Une rénovation complète préalable est généralement plus protectrice juridiquement et plus rentable que la décote du prix de vente.",
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        "Une première erreur courante consiste à entreprendre des travaux électriques soi-même sans qualification ni autorisation. Ajouter une prise, remplacer un interrupteur ou modifier un circuit nécessite des compétences techniques précises et le respect de la norme NF C 15-100. Une intervention non professionnelle peut créer des défauts dangereux (court-circuit, défaut d’isolement, surchauffe) qui ne se manifesteront que des mois ou années plus tard. En cas d’incendie d’origine électrique, l’assurance habitation peut refuser sa garantie si l’installation a été modifiée sans qualification.",
        "Une deuxième erreur consiste à ignorer les tests bouton des dispositifs différentiels. Ce test, à effectuer tous les six mois selon les recommandations des fabricants, vérifie que le différentiel se déclenche bien en cas de défaut. Un différentiel qui ne se déclenche pas au test n’apporte aucune protection en cas d’incident réel. La vérification est triviale (un simple bouton à presser) mais elle est négligée par la grande majorité des occupants. Le diagnostic électricité teste systématiquement ces dispositifs au moment de la visite, mais l’occupant doit poursuivre cette vigilance.",
        "Une troisième erreur consiste à surcharger les multiprises et les rallonges. Chaque prise et chaque circuit électrique a une capacité limitée (généralement 16 A pour les prises classiques, soit environ 3 500 W). Brancher plusieurs appareils gros consommateurs sur la même prise via une multiprise dépasse rapidement cette limite et provoque un échauffement des conducteurs, voire un départ de feu. Les multiprises avec parafoudre et coupure thermique offrent une protection partielle mais ne remplacent pas une bonne répartition des charges sur plusieurs circuits.",
        "Une quatrième erreur consiste à ne pas tenir compte des anomalies B1 sous prétexte qu’elles « ne sont pas urgentes ». Une anomalie B1 reflète un écart à la norme actuelle qui peut évoluer en danger réel avec le temps. Par exemple, l’absence de protection différentielle 30 mA sur un circuit prises est classée B1 mais expose les occupants à un risque d’électrocution si un appareil défaillant est branché. La logique préventive du diagnostic impose de traiter les B1 dans un délai raisonnable, pas de les ignorer indéfiniment.",
        "Une cinquième erreur, particulièrement coûteuse, consiste à minorer l’ampleur d’une rénovation électrique lors d’une vente. Un bien classé avec de nombreuses anomalies B2 nécessite généralement 4 000 à 12 000 euros de travaux pour atteindre une conformité acceptable. Présenter ces travaux comme « légers » à l’acquéreur expose le vendeur à des recours en garantie des vices cachés. Au contraire, fournir des devis détaillés de plusieurs électriciens RGE et négocier le prix de vente en conséquence est plus protecteur juridiquement et plus efficace commercialement.",
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        "Le diagnostic électricité est un diagnostic de sécurité fondamental dont l’objectif est de protéger les occupants contre les risques d’électrocution, d’électrisation et d’incendie d’origine électrique. Avec environ 50 000 incendies et 200 décès par an en France imputables à des installations électriques défectueuses, le dispositif réglementaire joue un rôle essentiel de prévention. Sa portée s’est encore élargie en 2024 avec la prise en compte des bornes de recharge IRVE et des installations photovoltaïques.",
        "Le critère d’obligation est l’âge de l’installation : toute installation intérieure d’électricité dont la mise en service ou la dernière modification importante remonte à plus de quinze ans est concernée. Ce critère s’applique à tous les logements raccordés au réseau public, y compris les logements en triphasé et les biens équipés de production photovoltaïque en autoconsommation. La date de référence peut être attestée par le Consuel délivré lors de la mise en service ou par des factures détaillées de travaux significatifs.",
        "La validité du diagnostic est de 3 ans pour une vente et 6 ans pour une location, à compter de la date de réalisation. Comme pour le diagnostic gaz, cette différence reflète les contraintes propres aux transactions immobilières. La norme NF C 16-600 définit les 87 points de contrôle obligatoires et le classement des anomalies en deux niveaux (B1 sans urgence immédiate, B2 nécessitant une intervention rapide). Six points fondamentaux sont contrôlés en priorité : coupure générale, différentiel 30 mA, prise de terre, surintensités, salle de bain, matériaux conducteurs.",
        "Le coût du diagnostic varie de 100 à 250 euros, et le coût des travaux de mise en conformité peut atteindre 4 000 à 12 000 euros pour une installation très ancienne nécessitant une rénovation complète. Contrairement à d’autres diagnostics (DPE, audit énergétique), les travaux électriques ne bénéficient pas directement de MaPrimeRénov’ ou des CEE car ils ne génèrent pas d’économies d’énergie. Toutefois, lorsqu’ils s’inscrivent dans une rénovation globale, l’éco-PTZ et la TVA réduite à 10 % apportent un soutien substantiel.",
        "Le choix du diagnostiqueur doit privilégier la certification COFRAC spécifique électricité (distincte de DPE/gaz/amiante), l’équipement professionnel (telluromètre étalonné, multimètre, outils de test différentiel) et l’expérience pratique. La méthode de travail est un autre indicateur clé : ouverture systématique du tableau, photographies, vérification pièce par pièce, durée minimale sur place de 45 minutes pour un appartement standard ou 1h30 pour une maison. Une visite expédiée doit éveiller la vigilance sur la qualité du diagnostic.",
        "Pour les configurations particulières (triphasé, photovoltaïque, bornes IRVE, locaux humides), une expertise renforcée est nécessaire. Ces installations imposent des protections spécifiques (différentiel type B pour le photovoltaïque, circuit dédié pour les Wallbox, indices IP44 ou IP55 pour les locaux humides) et leur contrôle requiert une formation spécifique du diagnostiqueur. La sécurité des occupants justifie un investissement supplémentaire dans la qualité du diagnostic et la mise en œuvre rigoureuse des recommandations.",
        "L’évolution du parc d’équipements vers la mobilité électrique et l’autoconsommation photovoltaïque transforme rapidement les enjeux du diagnostic électricité. La généralisation des bornes de recharge IRVE depuis 2022, l’explosion des installations solaires depuis 2020 et l’arrivée prochaine de la mobilité hydrogène et des systèmes V2G (Vehicle-to-Grid) imposent une montée en compétence continue des diagnostiqueurs. Les propriétaires qui investissent dans ces nouveaux équipements doivent veiller à les déclarer correctement et à confier leur installation à des entreprises qualifiées IRVE ou QualiPV pour garantir la conformité durable de l’installation.",
        "La sensibilisation des occupants aux bonnes pratiques de sécurité électrique est complémentaire au diagnostic et essentielle pour la prévention des sinistres. Les principales consignes (ne pas surcharger les multiprises, vérifier régulièrement le fonctionnement des dispositifs différentiels par le bouton test, ne pas intervenir sur l’installation sans qualification, faire vérifier l’installation tous les 10-15 ans), sont trop souvent ignorées. Un détecteur de fumée fonctionnel dans chaque pièce de nuit est obligatoire depuis 2015 et constitue une protection essentielle contre les incendies d’origine électrique. L’extincteur à poudre type ABC ou CO₂ pour les feux électriques est également recommandé dans les locaux à risque (cuisine, garage, atelier). Le coût modeste de ces équipements de sécurité (50 à 150 euros pour l’ensemble) est largement compensé par la protection apportée et par les éventuelles réductions de prime d’assurance habitation accordées par certains assureurs.",
        "La cohabitation entre le diagnostic électricité et les autres diagnostics du dossier de diagnostic technique mérite enfin d’être soulignée. Une installation électrique vétuste peut interagir avec la performance énergétique (consommation parasitaire des équipements anciens pénalisant le DPE), avec l’audit énergétique (préconisation de remplacement du chauffage électrique par une pompe à chaleur dans les scénarios), avec le diagnostic amiante (joints amiantés autour des câbles dans les bâtiments anciens) ou avec le diagnostic gaz (mise à la terre des canalisations métalliques). Une rénovation coordonnée de l’ensemble des installations techniques permet d’optimiser les coûts et de garantir une mise en conformité globale du logement, particulièrement utile lors des mutations immobilières où plusieurs diagnostics doivent être réalisés simultanément. Cette approche globale est encouragée par les artisans RGE qui maîtrisent ces interactions techniques.",
      ],
    },
  ],
  faq: [
    {
      question: 'À partir de quand un diagnostic électricité est-il obligatoire ?',
      answer:
        "Le diagnostic électricité est obligatoire pour toute installation intérieure d’électricité dont la mise en service ou la dernière modification importante remonte à plus de 15 ans.",
    },
    {
      question: 'Quelle est la durée de validité d’un diagnostic électricité ?',
      answer:
        "La validité est de 3 ans pour une vente et de 6 ans pour une location, à compter de la date de réalisation du diagnostic.",
    },
    {
      question: 'Quelle norme régit le diagnostic électricité ?',
      answer:
        "La norme NF C 16-600 définit les 87 points de contrôle obligatoires et les critères de classement des anomalies (B1, B2). Elle a été révisée en avril 2024.",
    },
    {
      question: 'Quels sont les niveaux d’anomalie ?',
      answer:
        "Deux niveaux : B1 (anomalie sans urgence immédiate, à corriger dans un délai raisonnable) et B2 (anomalie présentant un risque de sécurité immédiat, à corriger rapidement).",
    },
    {
      question: 'Le Consuel remplace-t-il le diagnostic électricité ?',
      answer:
        "Non, le Consuel est une attestation de conformité pour les installations neuves ou rénovées avant mise en service. Le diagnostic électricité est obligatoire pour les installations existantes de plus de 15 ans à l’occasion d’une vente ou location.",
    },
    {
      question: 'Combien coûte un diagnostic électricité ?',
      answer:
        "Entre 100 et 180 € TTC pour un appartement et 130 à 250 € pour une maison. Le coût marginal dans un pack vente complet est généralement inférieur à 120 €.",
    },
    {
      question: 'Quels sont les six points fondamentaux contrôlés ?',
      answer:
        "Coupure générale, protection différentielle 30 mA, prise de terre, protection contre surintensités, sécurité salle de bain, absence de matériaux conducteurs accessibles.",
    },
    {
      question: 'Combien de temps dure un diagnostic électricité ?',
      answer:
        "Entre 1h et 2h sur place selon la complexité de l’installation et la taille du logement. Le rapport est remis sous 24 à 72 heures.",
    },
    {
      question: 'Faut-il refaire le diagnostic après des travaux ?',
      answer:
        "Oui, si les travaux ont modifié significativement l’installation. La modification importante remet à zéro le décompte des 15 ans et un nouveau diagnostic n’est plus exigible avant ce délai (sauf en cas de nouvelle vente avant 15 ans).",
    },
    {
      question: 'Le diagnostic électricité inclut-il une borne de recharge IRVE ?',
      answer:
        "Oui, depuis la révision NF C 16-600 d’avril 2024, le diagnostic vérifie la conformité du circuit dédié, la protection différentielle et la section des conducteurs des Wallbox.",
    },
    {
      question: 'Que se passe-t-il si je ne fais pas de diagnostic électricité à la vente ?',
      answer:
        "L’absence de diagnostic expose le vendeur à la garantie des vices cachés. La clause exonératoire ne s’applique pas, et l’acquéreur peut demander la révision du prix de vente ou l’annulation en cas de défaut majeur.",
    },
    {
      question: 'Le diagnostic électricité est-il obligatoire pour une location meublée ?',
      answer:
        "Oui, le diagnostic est obligatoire pour toute location, vide ou meublée, dès lors que l’installation a plus de 15 ans. La validité est alors de 6 ans.",
    },
    {
      question: 'Peut-on contester un diagnostic électricité ?',
      answer:
        "Oui, en cas de désaccord sur les conclusions, un contre-diagnostic réalisé par un autre professionnel certifié peut être commandé. En cas de litige persistant, le tribunal peut être saisi.",
    },
    {
      question: 'Une installation sans prise de terre peut-elle être conforme ?',
      answer:
        "Non, l’absence de prise de terre constitue une anomalie B2 majeure. Pour les installations anciennes sans terre, une mise en conformité par création d’une prise de terre et liaisons équipotentielles est obligatoire.",
    },
    {
      question: 'Quels conseils en cas d’anomalie B2 ?',
      answer:
        "Faites intervenir un électricien qualifié RGE dans les semaines suivant le diagnostic. En attendant, évitez d’utiliser les circuits ou appareils concernés par l’anomalie et coupez le disjoncteur dédié si possible.",
    },
  ],
}
