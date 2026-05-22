/**
 * Guide long — Diagnostic Amiante (DAPP, DAAT, DTA).
 *
 * Sources : articles R1334-15 à R1334-29-9 du Code de la santé publique,
 * décret 96-97 modifié, arrêté du 12 décembre 2012, décret 2011-629,
 * Plan d'actions interministériel amiante (PAIA), INRS, ANSES.
 */

import type { Guide } from '../types'

export const AMIANTE_GUIDE: Guide = {
  type: 'amiante',
  slug: 'amiante',
  shortTitle: 'Amiante',
  title: 'Diagnostic amiante : guide complet 2026 (DAPP, DAAT, DTA)',
  category: 'vente',
  tagline:
    'Tout savoir sur le diagnostic amiante : avant-vente, avant-travaux, dossier technique amiante, repérage, validité illimitée et obligations du propriétaire.',
  metaDescription:
    'Diagnostic amiante 2026 : DAPP, DAAT, DTA, repérage avant 1997, validité, prix, obligations propriétaire vente et copropriété. Guide complet KOVAS.',
  teaser:
    'Permis de construire avant 1997, DAPP / DAAT / DTA, prix, validité et obligations propriétaire.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 26,
  wordCount: 5250,
  relatedTypes: ['plomb', 'dpe', 'electricite', 'termites'],
  sections: [
    {
      id: 'qu-est-ce-que-l-amiante',
      title: 'Qu’est-ce que l’amiante et pourquoi est-il dangereux',
      level: 2,
      paragraphs: [
        "L’amiante désigne une famille de fibres minérales naturelles à structure cristalline, utilisées massivement dans le bâtiment français entre les années 1950 et 1990 pour leurs propriétés exceptionnelles de résistance au feu, à la chaleur, à l’abrasion et aux agents chimiques. Six variétés ont été commercialisées en France, dont les plus répandues sont le chrysotile (amiante blanc), l’amosite (amiante brun) et la crocidolite (amiante bleu). On en retrouve dans plus de 3 000 produits différents, des plaques de toiture en fibrociment aux dalles vinyl-amiante des sols, en passant par les calorifuges de tuyauterie, les flocages, les enduits, les colles de carrelage et les joints de chaudière.",
        "Les fibres d’amiante, lorsqu’elles sont inhalées, se déposent dans les alvéoles pulmonaires où elles déclenchent une réaction inflammatoire chronique. Cette exposition est responsable de plusieurs pathologies graves dont la latence peut atteindre 30 à 40 ans entre l’exposition initiale et l’apparition des symptômes. Les trois pathologies principales sont l’asbestose (fibrose pulmonaire), le mésothéliome (cancer de la plèvre quasi-spécifique de l’amiante) et le cancer broncho-pulmonaire. L’Institut national de veille sanitaire estime que l’amiante est responsable de 2 200 à 5 400 décès par an en France, et les projections pour les prochaines décennies sont préoccupantes en raison du parc immobilier ancien encore exposé.",
        "L’usage de l’amiante est totalement interdit en France depuis le 1ᵉʳ janvier 1997 par le décret 96-1133 du 24 décembre 1996. Cette interdiction couvre la fabrication, l’importation, la mise sur le marché et l’utilisation de toutes fibres d’amiante et de tous produits en contenant. Toutefois, le stock existant dans le parc bâti antérieur à 1997 demeure : selon l’ANSES, environ 20 millions de logements en France sont concernés par la présence possible d’amiante dans leurs matériaux, ce qui justifie le dispositif réglementaire de repérage obligatoire toujours en vigueur trente ans après l’interdiction.",
      ],
    },
    {
      id: 'quand-le-diagnostic-amiante-est-il-obligatoire',
      title: 'Quand le diagnostic amiante est-il obligatoire',
      level: 2,
      paragraphs: [
        "Le critère central qui détermine l’obligation de réaliser un diagnostic amiante est la date du permis de construire du bâtiment. Tous les immeubles dont le permis de construire a été délivré avant le 1ᵉʳ juillet 1997 sont concernés par le dispositif réglementaire de repérage amiante. Cette date correspond à l’entrée en vigueur effective de l’interdiction de mise sur le marché et de la mise en œuvre des matériaux amiantés. Les bâtiments construits après cette date sont en principe exempts, sauf exception très marginale pour des produits dont les stocks ont été écoulés tardivement.",
        "Plusieurs diagnostics amiante distincts cohabitent dans la réglementation française et il est essentiel de bien les distinguer. Le DAPP, Diagnostic Amiante des Parties Privatives, est obligatoire à la vente de tout logement dont le permis de construire est antérieur au 1ᵉʳ juillet 1997. Il porte sur les matériaux de la liste A (flocages, calorifugeages, faux plafonds) et de la liste B (parois verticales intérieures, planchers, plafonds, conduits, canalisations) accessibles sans démolition. Le DAPP doit être annexé au compromis de vente et figurer dans le dossier de diagnostic technique remis chez le notaire.",
        "Le DAAT, Diagnostic Amiante Avant Travaux, est obligatoire avant toute opération de rénovation, de réhabilitation, de démolition ou de maintenance susceptible de libérer des fibres dans l’air. Il est imposé par l’article R4412-97 du Code du travail au maître d’ouvrage, qu’il soit propriétaire occupant, bailleur, syndicat de copropriétaires ou maître d’ouvrage public. Le DAAT est plus exhaustif que le DAPP : il identifie l’ensemble des matériaux susceptibles d’être impactés par les travaux, y compris ceux nécessitant des sondages destructifs.",
        "Le DTA, Dossier Technique Amiante, concerne quant à lui les parties communes des immeubles collectifs d’habitation et l’ensemble des immeubles autres que d’habitation (commerces, bureaux, équipements publics). Établi initialement avant le 31 décembre 2005, il doit être mis à jour à chaque évolution du bâtiment et tenu à la disposition des occupants, des entreprises intervenantes et des autorités administratives. Le DTA constitue la mémoire de la présence d’amiante dans l’immeuble.",
        "Enfin, le DAAD, Diagnostic Amiante Avant Démolition, s’applique aux opérations de démolition totale d’un ouvrage. Plus exhaustif encore que le DAAT, il prévoit des sondages destructifs systématiques pour repérer tout matériau amianté avant la démolition, afin d’organiser la séparation des déchets dangereux et la sécurité des opérateurs.",
      ],
      callout: {
        type: 'warning',
        text: "L’absence ou l’insuffisance d’un diagnostic amiante avant travaux engage la responsabilité pénale du maître d’ouvrage. Les sanctions prévues à l’article R4741-1-1 du Code du travail peuvent atteindre 9 000 euros d’amende par infraction constatée et un an d’emprisonnement, en plus des sanctions civiles liées aux préjudices subis par les travailleurs exposés.",
      },
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        "Le cadre réglementaire 2026 est issu de plusieurs textes structurants. Le décret 2011-629 du 3 juin 2011 a renforcé les obligations des propriétaires en introduisant le DAPP pour les ventes. L’arrêté du 12 décembre 2012 a précisé la liste exhaustive des matériaux à rechercher selon les listes A et B. Le décret 2017-899 a aligné les obligations entre logements et locaux non résidentiels, et la circulaire du 22 novembre 2018 a clarifié l’articulation entre DAPP, DTA et DAAT.",
        "Depuis le 1ᵉʳ janvier 2020, les diagnostiqueurs doivent être certifiés selon la norme NF EN ISO/IEC 17024 avec une compétence reconnue pour la mention « avec mention » lorsqu’ils interviennent sur des bâtiments complexes (immeubles de grande hauteur, établissements recevant du public de plus de 5 000 m²). Cette obligation de mention vise à garantir un niveau de compétence supérieur sur les bâtiments présentant des risques accrus.",
        "Pour les ventes immobilières en 2026, la jurisprudence récente de la Cour de cassation a précisé les conséquences d’un DAPP défaillant. Si la présence d’amiante non détectée engendre des travaux de désamiantage importants, l’acquéreur peut désormais agir en garantie des vices cachés contre le vendeur. Le DAPP n’exonère le vendeur que si le diagnostic a été réalisé conformément aux règles de l’art et si le diagnostiqueur a respecté la totalité des protocoles de repérage. À défaut, le vendeur reste solidairement responsable.",
        "L’évolution la plus marquante de 2025-2026 concerne les diagnostics avant travaux. Depuis le 1ᵉʳ octobre 2024, l’INRS et le ministère du Travail ont publié de nouvelles recommandations qui imposent au diagnostiqueur de produire des plans détaillés des zones contaminées, accompagnés de fiches d’identification permettant aux entreprises de désamiantage d’établir leur plan de retrait. Ces obligations s’imposent désormais à tout DAAT, sous peine de nullité du document pour usage en travaux.",
        "Pour les copropriétés, l’obligation de tenue à jour du DTA est désormais contrôlée systématiquement lors des assemblées générales annuelles. Le syndic doit présenter un point d’étape sur le suivi des matériaux amiantés identifiés et sur les actions correctives engagées. Une absence de DTA ou un DTA non mis à jour expose le syndicat des copropriétaires à des sanctions, mais surtout à des recours en responsabilité de la part des occupants ou des entreprises intervenantes.",
        "La transposition en droit français de la directive européenne 2023/2668 sur la protection des travailleurs exposés à l’amiante est en cours et entrera en vigueur progressivement entre 2025 et 2029. Elle abaisse la valeur limite d’exposition professionnelle à 0,002 fibre par centimètre cube sur huit heures, soit cinq fois moins que la limite actuelle de 0,01 f/cm³. Cette évolution renforce indirectement l’importance des diagnostics amiante préalables, qui conditionnent la qualité du plan de prévention des entreprises intervenantes.",
      ],
      bullets: [
        "Permis de construire avant le 1ᵉʳ juillet 1997 = diagnostic amiante obligatoire",
        "DAPP obligatoire pour toute vente d’un logement antérieur à 1997",
        "DAAT obligatoire avant tout travaux pouvant libérer des fibres",
        "DTA obligatoire dans les parties communes et bâtiments non résidentiels",
        "Mention obligatoire du diagnostiqueur pour immeubles de grande hauteur",
        "VLEP abaissée à 0,002 f/cm³ d’ici 2029 (directive UE 2023/2668)",
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic amiante',
      level: 2,
      paragraphs: [
        "Un diagnostic amiante combine une phase documentaire et une inspection visuelle systématique du bâtiment. Le diagnostiqueur commence par consulter tous les documents techniques disponibles : permis de construire, plans, factures de travaux, anciens diagnostics, attestation d’absence d’amiante éventuelle. Cette phase préliminaire permet d’identifier les zones et matériaux suspects, et de préparer la visite avec la documentation adaptée. Pour un DAAT, le diagnostiqueur étudie également le projet de travaux pour cibler précisément les matériaux concernés.",
        "Sur place, l’inspection se fait pièce par pièce avec un protocole standardisé. Le diagnostiqueur identifie les revêtements de sol, de mur et de plafond, examine les conduits de fluides, les éléments de toiture, les calorifuges, les joints, les colles et tous les matériaux susceptibles de contenir de l’amiante. Pour chaque matériau suspect, il évalue l’état de conservation selon trois grades : N (non dégradé), I (intermédiaire) et D (dégradé). Cet état conditionne les mesures à prendre par le propriétaire.",
        "Lorsqu’un doute subsiste sur la nature du matériau, le diagnostiqueur réalise un prélèvement avec les équipements de protection individuelle adaptés et envoie l’échantillon à un laboratoire accrédité COFRAC pour analyse par microscopie électronique à transmission (META). Le résultat parvient sous quelques jours à une semaine et permet de conclure définitivement à la présence ou à l’absence d’amiante. Pour le DAPP, les prélèvements sont à la charge du propriétaire vendeur ; pour le DAAT, ils sont à la charge du maître d’ouvrage.",
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Étude documentaire préalable',
          text: "Le diagnostiqueur examine le permis de construire, les plans, les anciens diagnostics et le projet de travaux le cas échéant pour cibler les zones et matériaux à inspecter.",
        },
        {
          position: 2,
          name: 'Inspection visuelle pièce par pièce',
          text: "Le professionnel passe en revue chaque local et identifie les matériaux des listes A (flocages, calorifugeages, faux plafonds) et B (revêtements, conduits, joints, colles, toitures).",
        },
        {
          position: 3,
          name: 'Évaluation de l’état de conservation',
          text: "Chaque matériau identifié est classé selon trois grades : N (bon état), I (intermédiaire) ou D (dégradé). Cet état conditionne les obligations du propriétaire.",
        },
        {
          position: 4,
          name: 'Prélèvements pour analyse en laboratoire',
          text: "En cas de doute, le diagnostiqueur prélève un échantillon avec EPI et l’envoie à un laboratoire accrédité COFRAC pour analyse par microscopie électronique à transmission.",
        },
        {
          position: 5,
          name: 'Rédaction du rapport et plan',
          text: "Le rapport identifie les matériaux contenant de l’amiante, leur état, les recommandations d’action (surveillance, encapsulage, retrait) et inclut des plans de localisation.",
        },
      ],
    },
    {
      id: 'prix-d-un-diagnostic-amiante',
      title: 'Combien coûte un diagnostic amiante',
      level: 2,
      paragraphs: [
        "Le tarif d’un diagnostic amiante varie selon le type de prestation et la complexité du bâtiment. Pour un DAPP réalisé dans le cadre d’une vente, le prix moyen constaté en 2026 oscille entre 90 et 180 euros toutes taxes comprises pour un appartement, et entre 130 et 250 euros pour une maison individuelle. Ce coût n’inclut pas les éventuels prélèvements en laboratoire facturés en supplément entre 40 et 80 euros par échantillon.",
        "Le DAAT est plus onéreux car il nécessite un repérage plus exhaustif, parfois avec sondages destructifs. Selon la surface concernée par les travaux et le nombre de matériaux à investiguer, son prix se situe généralement entre 300 et 1 500 euros pour un logement, et peut atteindre plusieurs milliers d’euros pour un immeuble entier ou un local tertiaire. Le DAAD, encore plus complet, est facturé entre 800 et 3 000 euros pour un bâtiment résidentiel courant.",
        "Pour le DTA d’une copropriété, le coût initial dépend du nombre de bâtiments et du linéaire de parties communes. Comptez généralement entre 800 et 2 500 euros pour un immeuble de 20 à 50 lots. La mise à jour annuelle est facturée séparément, entre 200 et 500 euros si elle ne nécessite pas de nouvelle visite, davantage en cas de travaux ou de modifications structurelles. Ces coûts sont supportés par le syndicat des copropriétaires et inscrits au budget prévisionnel du syndic.",
      ],
      bullets: [
        "DAPP appartement : 90 à 180 € TTC",
        "DAPP maison : 130 à 250 € TTC",
        "DAAT logement : 300 à 1 500 € TTC selon ampleur travaux",
        "DAAD bâtiment résidentiel : 800 à 3 000 € TTC",
        "DTA copropriété 20-50 lots : 800 à 2 500 € TTC initial",
        "Prélèvement laboratoire COFRAC : 40 à 80 € par échantillon",
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        "Le rapport d’un diagnostic amiante suit une trame réglementaire fixée par l’arrêté du 12 décembre 2012. Il comprend en première partie l’identification du bien : adresse complète, références cadastrales, propriétaire, date du permis de construire et nature de la mission (DAPP, DAAT, DTA). Cette section identifie également le diagnostiqueur (nom, numéro de certification, organisme certificateur, attestation d’assurance) et sert de page de garde du document.",
        "Le corps du rapport présente le tableau récapitulatif des matériaux et produits contenant de l’amiante (MPCA) identifiés. Pour chaque MPCA, le rapport indique sa localisation précise, la liste à laquelle il appartient (A ou B), son état de conservation (N, I ou D), la conclusion sur la présence ou non d’amiante, et la mesure préconisée. Les mesures vont de la simple évaluation périodique de l’état (tous les trois ans) à la mesure d’empoussièrement de l’air, à l’action corrective comme l’encapsulage ou le retrait.",
        "Les plans annexés sont essentiels et constituent la partie la plus opérationnelle du rapport. Ils localisent chaque MPCA dans le bâtiment, ce qui permet aux occupants de connaître précisément les zones à risque et aux entreprises de travaux de planifier leurs interventions. Pour le DTA d’une copropriété, ces plans doivent être affichés ou tenus à la disposition de tous les occupants à la demande, et remis aux entreprises intervenantes avant tout travaux.",
        "Une fiche récapitulative en fin de rapport synthétise les obligations du propriétaire : conservation du DAPP pendant la durée de détention du bien, transmission obligatoire à l’acquéreur, mise à jour du DTA, programmation des actions correctives. Ces obligations sont opposables et leur méconnaissance peut engager la responsabilité civile et pénale du propriétaire en cas d’exposition de tiers.",
      ],
    },
    {
      id: 'travaux-de-desamiantage',
      title: 'Quels travaux en cas de présence d’amiante',
      level: 2,
      paragraphs: [
        "Lorsque le rapport identifie la présence d’amiante, trois grandes options s’offrent au propriétaire selon l’état de conservation du matériau. La première option, applicable aux matériaux en bon état (grade N), consiste en une surveillance périodique tous les trois ans accompagnée d’une consigne d’entretien adaptée. Cette option n’engendre pas de travaux mais impose la mise à jour régulière du DTA et une vigilance lors de toute intervention sur les surfaces concernées.",
        "La deuxième option, réservée aux matériaux à l’état intermédiaire (grade I), consiste à mesurer l’empoussièrement de l’air par prélèvement et analyse en laboratoire accrédité. Si le résultat dépasse cinq fibres par litre, des travaux correctifs s’imposent dans des délais courts. En dessous de ce seuil, une nouvelle évaluation est programmée à trois ans maximum, avec une attention particulière aux dégradations susceptibles d’augmenter l’empoussièrement.",
        "La troisième option, applicable aux matériaux dégradés (grade D), impose la mise en œuvre d’actions correctives sans délai. Trois techniques principales sont utilisées : l’encapsulage, qui consiste à recouvrir le matériau d’un revêtement étanche pour empêcher la libération de fibres, le confinement avec démontage ultérieur, et le retrait pur et simple. Le choix de la technique dépend de la nature du matériau, de son accessibilité, de la durée de présence prévue et du budget disponible.",
        "Les travaux de désamiantage sont strictement réglementés par les articles R4412-94 à R4412-148 du Code du travail. Seules les entreprises certifiées par un organisme de certification reconnu (AFNOR Certification, Global Certification, Qualibat 1552) sont habilitées à intervenir. Ces entreprises doivent disposer de personnels formés et qualifiés, d’équipements de protection collective et individuelle adaptés, et d’un plan de retrait validé par le diagnostiqueur, l’inspection du travail et la CARSAT.",
        "Le coût des travaux de désamiantage varie considérablement selon la technique retenue, la surface concernée et la difficulté d’accès. À titre indicatif, le retrait de plaques de toiture en fibrociment se situe entre 30 et 70 euros par mètre carré, celui d’une dalle vinyl-amiante entre 50 et 120 euros par mètre carré, et le retrait d’un flocage entre 70 et 180 euros par mètre carré. Les calorifuges et les enduits projetés peuvent atteindre 200 à 400 euros par mètre carré en raison de leur friabilité et de la difficulté de confinement.",
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières pour les travaux de désamiantage',
      level: 2,
      paragraphs: [
        "Les travaux de désamiantage peuvent bénéficier de plusieurs dispositifs financiers, en particulier lorsqu’ils s’inscrivent dans une opération globale de rénovation. MaPrimeRénov’ couvre une partie des frais de désamiantage dès lors qu’ils sont liés à des travaux d’amélioration énergétique éligibles, par exemple le retrait d’un flocage avant l’installation d’une isolation par l’extérieur. Le forfait varie selon les revenus du foyer et peut atteindre 50 % du coût des travaux pour les ménages très modestes.",
        "L’Anah finance par ailleurs les opérations de traitement de l’habitat indigne ou très dégradé via le programme « Habiter Sain » et « Habiter Serein ». Lorsque la présence d’amiante est associée à d’autres pathologies du bâti (plomb, humidité, structure défaillante), ces dispositifs peuvent prendre en charge jusqu’à 50 % du coût total des travaux, plafonné à 25 000 euros pour les propriétaires modestes.",
        "Les copropriétés peuvent également mobiliser le dispositif MaPrimeRénov’ Copropriétés pour les travaux de désamiantage des parties communes lorsqu’ils s’inscrivent dans une rénovation globale. Le taux d’aide collectif est de 30 % du coût des travaux, plafonné à 25 000 euros par lot d’habitation. Ce dispositif est cumulable avec les aides individuelles des copropriétaires modestes et avec les CEE.",
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur amiante',
      level: 2,
      paragraphs: [
        "Le choix du diagnostiqueur amiante doit faire l’objet d’une attention particulière en raison des enjeux sanitaires et juridiques. Le professionnel doit être certifié par un organisme accrédité COFRAC selon la norme NF EN ISO/IEC 17024, et sa certification doit être visible sur l’annuaire des diagnostiqueurs publié par le ministère du Logement. Pour les bâtiments complexes (immeubles de grande hauteur, établissements recevant du public, immeubles tertiaires), exiger la mention « avec mention » est obligatoire et témoigne d’un niveau de compétence supérieur.",
        "Outre la certification, vérifier l’expérience du diagnostiqueur dans des bâtiments similaires au vôtre est essentiel. Un professionnel habitué aux immeubles haussmanniens ne sera pas nécessairement compétent sur un bâtiment industriel des années 1970 et inversement. Demander des références récentes, consulter les avis clients sur les plateformes spécialisées et privilégier les structures établies depuis plusieurs années sont des bonnes pratiques. Enfin, l’indépendance du diagnostiqueur vis-à-vis des entreprises de désamiantage et de travaux est une exigence légale absolue qu’il convient de faire confirmer par écrit.",
        "Vérifiez également que le diagnostiqueur dispose d’un laboratoire partenaire accrédité COFRAC pour les analyses META (microscopie électronique à transmission). Le délai de réception des résultats et le coût unitaire des analyses sont des éléments importants à comparer entre prestataires. Certains diagnostiqueurs travaillent avec des laboratoires intégrés qui permettent de recevoir les résultats sous 48 heures, ce qui est précieux lorsque les délais de vente sont serrés. La traçabilité des prélèvements est également un critère de qualité : numérotation, photographies, fiches d’identification, plans de localisation doivent être systématiques.",
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        "Plusieurs situations particulières nécessitent une expertise renforcée du diagnostiqueur amiante. Les bâtiments industriels reconvertis en logements (lofts d’usines anciennes, anciens entrepôts) cumulent souvent les sources de risque : flocages, calorifuges, dalles vinyl-amiante, plaques de toiture en fibrociment. Le DAPP doit alors être particulièrement exhaustif et le diagnostiqueur doit prendre le temps de remonter l’historique d’usage du bâtiment pour cibler les zones à risque, notamment les locaux techniques anciens (chaufferies, salles de ventilation, ascenseurs).",
        "Les immeubles haussmanniens parisiens présentent une signature particulière : enduits de finition au plâtre, planchers en plâtre sur lambourdes, conduits de cheminée en briques jointoyées au mortier de chaux. La présence d’amiante y est moins fréquente que dans les bâtiments des Trente Glorieuses (1950-1980) qui concentrent l’essentiel des matériaux amiantés. Le diagnostic d’un immeuble haussmannien est généralement plus rapide et moins coûteux, sauf si des travaux de rénovation des années 1960-1990 ont introduit des produits amiantés (faux plafonds, isolation, revêtements de sol).",
        "Les pavillons individuels des années 1960-1980 sont les plus représentatifs des risques amiante en zones pavillonnaires. La toiture en plaques de fibrociment ondulées est très fréquente et constitue le point de vigilance principal. La présence éventuelle de calorifugeage des tuyaux de chauffage central, de joints d’étanchéité dans les chaudières fioul, et de dalles vinyl-amiante au sous-sol complète le tableau. Pour ces biens, un DAPP complet avec quelques prélèvements ciblés permet généralement de lever les doutes.",
        "Les immeubles de grande hauteur (IGH) construits entre 1965 et 1985 cumulent les sources de risque : flocages dans les locaux techniques, calorifuges des installations CVC, faux plafonds résistants au feu contenant de l’amiante, joints d’étanchéité des portes coupe-feu. Le diagnostic d’un IGH nécessite obligatoirement un diagnostiqueur avec mention et un protocole renforcé qui peut s’étaler sur plusieurs jours. Le DTA d’un IGH est un document volumineux (souvent plus de 100 pages) qui doit être tenu à jour rigoureusement par le syndic.",
        "Les bâtiments des années 1990 sont moins concernés mais ne sont pas exempts. L’interdiction de l’amiante n’est entrée en vigueur qu’au 1ᵉʳ janvier 1997, ce qui signifie que des stocks de produits amiantés peuvent avoir été utilisés dans des constructions jusqu’à cette date. La vigilance reste de mise pour les bâtiments dont le permis a été délivré entre 1990 et juillet 1997, particulièrement pour les revêtements de sol, les colles de carrelage et certains enduits.",
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        "La première erreur fréquente en matière de diagnostic amiante est de confondre DAPP et DAAT. Le DAPP, réalisé pour une vente, est limité aux matériaux des listes A et B accessibles sans démolition. Il ne couvre PAS l’ensemble des matériaux susceptibles d’être impactés par des travaux ultérieurs. Lorsqu’un acquéreur envisage des travaux après acquisition, il doit faire réaliser un DAAT distinct qui sera plus exhaustif. Confondre les deux peut mener à des sinistres lors des chantiers par exposition de travailleurs à des matériaux non identifiés.",
        "Une deuxième erreur consiste à ne pas prendre au sérieux les recommandations d’action du rapport. Lorsque le DAPP identifie un matériau dégradé en classe D, l’obligation de mise en sécurité est immédiate et opposable. Le propriétaire qui ignore cette recommandation s’expose à une mise en demeure par l’Agence régionale de santé, à des sanctions pénales en cas d’exposition d’occupants, et à une responsabilité civile importante en cas de pathologie déclarée chez un occupant ou un visiteur. La règle « surveiller, mesurer, agir » n’est pas optionnelle.",
        "Une troisième erreur, courante dans les copropriétés, consiste à ne pas tenir le DTA à jour. La présence d’amiante n’est pas statique : les matériaux vieillissent, peuvent se dégrader sous l’effet de l’humidité ou de chocs, et toute intervention sur le bâtiment (rénovation, maintenance, sinistre) peut modifier les zones à risque. Le syndic doit programmer une mise à jour systématique tous les trois ans pour les MPCA en classe N, et plus fréquemment pour les classes I et D. À défaut, la responsabilité du syndicat des copropriétaires est engagée en cas d’exposition.",
        "Une quatrième erreur, particulièrement grave, consiste à entreprendre des travaux d’amélioration énergétique (isolation, rénovation) sans avoir préalablement réalisé un DAAT. Le percement d’une cloison, la dépose d’un faux plafond, le perçage d’une toiture pour installer un velux sont autant d’interventions qui peuvent libérer massivement des fibres d’amiante si le matériau impacté en contient. Le DAAT préalable est obligatoire et son coût (300 à 1 500 euros) est dérisoire comparé au risque sanitaire et aux pénalités encourues. La règle est simple : aucuns travaux sans DAAT préalable dans un bâtiment antérieur à 1997.",
        "Une cinquième erreur consiste à confier les travaux de désamiantage à une entreprise non certifiée. Le désamiantage est strictement réglementé et seules les entreprises certifiées AFNOR ou Global Certification sont habilitées. Les opérateurs doivent disposer d’EPI adaptés (combinaisons étanches, masques à adduction d’air), le chantier doit être confiné, et un plan de retrait validé par la CARSAT est obligatoire. Faire intervenir une entreprise « tout venant » expose le donneur d’ordre à des sanctions pénales lourdes et à une responsabilité civile illimitée en cas d’exposition des travailleurs ou des occupants voisins.",
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        "Le diagnostic amiante est l’un des diagnostics les plus structurants pour la gestion d’un bien ancien en France. Sa réalisation conditionne à la fois la légalité de la vente ou de la location, la sécurité des occupants et l’engagement de la responsabilité civile et pénale du propriétaire. Les enjeux sanitaires associés à l’amiante restent considérables trente ans après son interdiction, et le dispositif réglementaire de repérage continue d’évoluer pour mieux protéger les occupants et les travailleurs intervenant dans les bâtiments anciens.",
        "Le critère unique qui détermine l’obligation est la date du permis de construire avant le 1ᵉʳ juillet 1997. Tous les bâtiments antérieurs à cette date sont concernés, sans exception. Cette règle s’applique à tous les types de bâtiments (habitation individuelle, collective, locaux commerciaux, équipements publics) et à tous les usages (résidentiel principal, secondaire, professionnel). La date du permis prévaut sur la date de construction effective, particulièrement pour les bâtiments dont les travaux se sont étalés sur plusieurs années.",
        "Trois diagnostics distincts cohabitent et doivent être bien distingués : le DAPP pour la vente, le DAAT avant tous travaux, et le DTA pour les parties communes et bâtiments non résidentiels. Chacun a son périmètre, sa méthodologie et son régime de responsabilité propre. Confondre ces diagnostics ou ne réaliser qu’une partie peut générer des manquements graves aux obligations légales et exposer le propriétaire ou maître d’ouvrage à des sanctions civiles et pénales importantes.",
        "La validité du DAPP est illimitée si aucun matériau amianté n’est détecté, ce qui en fait l’un des rares diagnostics sans renouvellement automatique. En revanche, si de l’amiante a été identifié, le rapport doit être mis à jour selon l’état de conservation des matériaux et les actions menées. La surveillance triennale des matériaux en bon état (classe N), la mesure d’empoussièrement pour les matériaux à l’état intermédiaire (classe I) et l’action corrective immédiate pour les matériaux dégradés (classe D) sont les trois piliers du suivi.",
        "Le coût d’un diagnostic amiante varie de 90 à 250 euros pour un logement courant, mais peut atteindre plusieurs milliers d’euros pour un DAAT exhaustif sur un bâtiment tertiaire complexe. Le coût des travaux de désamiantage est nettement supérieur (30 à 400 euros par mètre carré selon la technique) et peut représenter plusieurs dizaines de milliers d’euros pour une opération de retrait complet. Les aides publiques (MaPrimeRénov’, Anah) peuvent couvrir une partie de ces coûts lorsqu’ils s’inscrivent dans une opération globale de rénovation.",
        "Le choix du diagnostiqueur et de l’entreprise de désamiantage est crucial. La certification COFRAC (pour le diagnostic) et CTBA+ ou équivalent (pour les travaux) sont des prérequis non négociables. L’expérience pratique dans des bâtiments similaires, l’indépendance vis-à-vis des entreprises de travaux et la qualité de la traçabilité (numérotation, photographies, plans) sont des indicateurs supplémentaires de sérieux. Un investissement de quelques centaines d’euros dans la qualité du diagnostic protège contre des risques juridiques pouvant atteindre plusieurs centaines de milliers d’euros.",
        "Enfin, l’évolution réglementaire à venir (transposition de la directive UE 2023/2668 entre 2025 et 2029, abaissement de la valeur limite d’exposition à 0,002 f/cm³, renforcement des contrôles en copropriété) confirme la place centrale du diagnostic amiante dans la gestion patrimoniale des bâtiments anciens en France. Les propriétaires et syndics qui anticipent ces évolutions et engagent dès maintenant les démarches de mise en conformité bénéficient d’un avantage compétitif clair : leurs biens sont plus attractifs pour les acquéreurs et locataires, leur responsabilité civile est mieux sécurisée, et les coûts de mise en conformité sont étalés sur plusieurs années plutôt que concentrés sur une seule opération coûteuse.",
      ],
    },
  ],
  faq: [
    {
      question: 'Quels logements sont concernés par le diagnostic amiante ?',
      answer:
        "Tous les bâtiments dont le permis de construire a été délivré avant le 1ᵉʳ juillet 1997, date d’interdiction de mise en œuvre des matériaux contenant de l’amiante en France.",
    },
    {
      question: 'Quelle est la durée de validité d’un diagnostic amiante ?',
      answer:
        "Le DAPP a une durée de validité illimitée si aucun matériau contenant de l’amiante n’a été identifié. Si de l’amiante a été détecté, le rapport doit être mis à jour selon l’état de conservation et les actions menées.",
    },
    {
      question: 'Quelle différence entre DAPP, DAAT et DTA ?',
      answer:
        "Le DAPP concerne les parties privatives lors d’une vente. Le DAAT est obligatoire avant tous travaux. Le DTA est le dossier technique des parties communes d’un immeuble collectif ou d’un bâtiment non résidentiel.",
    },
    {
      question: 'Quel est le prix moyen d’un diagnostic amiante en 2026 ?',
      answer:
        "Entre 90 et 180 euros TTC pour un appartement et entre 130 et 250 euros pour une maison individuelle. Le DAAT, plus complet, varie de 300 à 1 500 euros selon l’ampleur des travaux.",
    },
    {
      question: 'Que faire si le diagnostic révèle la présence d’amiante ?',
      answer:
        "Trois options selon l’état du matériau : surveillance triennale, mesure d’empoussièrement avec ou sans travaux, ou actions correctives immédiates (encapsulage, confinement, retrait) par une entreprise certifiée.",
    },
    {
      question: 'Le diagnostic amiante est-il obligatoire pour une location ?',
      answer:
        "Non, le DAPP n’est pas requis à la location. En revanche, pour les locaux non résidentiels et les parties communes, le DTA reste obligatoire et tenu à disposition des occupants à leur demande.",
    },
    {
      question: 'Qui paie le diagnostic amiante avant travaux ?',
      answer:
        "Le DAAT est à la charge du maître d’ouvrage, c’est-à-dire de la personne qui commande les travaux. Pour des travaux en copropriété, le syndicat des copropriétaires est responsable s’il s’agit de parties communes.",
    },
    {
      question: 'Peut-on faire des travaux soi-même sans DAAT ?',
      answer:
        "Non, le DAAT est obligatoire pour tous travaux susceptibles de libérer des fibres, même pour les particuliers réalisant des travaux dans leur propre logement. Son absence engage la responsabilité pénale du donneur d’ordre.",
    },
    {
      question: 'Combien de temps faut-il pour réaliser un diagnostic amiante ?',
      answer:
        "Entre 1h30 et 4h pour un logement courant, et plusieurs jours pour un bâtiment tertiaire ou un immeuble entier. Les éventuels prélèvements en laboratoire ajoutent 5 à 10 jours supplémentaires.",
    },
    {
      question: 'Que devient le rapport amiante en cas de vente du bien ?',
      answer:
        "Le DAPP doit être annexé au compromis de vente puis à l’acte authentique chez le notaire. L’acquéreur en devient propriétaire et doit le conserver tout au long de sa détention du bien.",
    },
    {
      question: 'Le DTA d’une copropriété est-il obligatoire ?',
      answer:
        "Oui, le DTA est obligatoire pour les parties communes de tout immeuble collectif d’habitation dont le permis de construire est antérieur au 1ᵉʳ juillet 1997. Le syndic est responsable de sa tenue à jour.",
    },
    {
      question: 'Qu’est-ce qu’une fibre d’amiante peut provoquer comme maladies ?',
      answer:
        "L’inhalation de fibres d’amiante peut provoquer une asbestose (fibrose pulmonaire), un mésothéliome (cancer de la plèvre) ou un cancer broncho-pulmonaire, avec une latence de 30 à 40 ans entre l’exposition et l’apparition.",
    },
    {
      question: 'Peut-on encapsuler de l’amiante au lieu de le retirer ?',
      answer:
        "Oui, l’encapsulage est une option valide pour les matériaux à l’état intermédiaire ou dégradé peu accessibles. Il consiste à recouvrir le matériau d’un revêtement étanche pour empêcher la libération de fibres.",
    },
    {
      question: 'Quel diplôme doit avoir un diagnostiqueur amiante ?',
      answer:
        "Le diagnostiqueur doit être certifié par un organisme accrédité COFRAC selon la norme ISO/IEC 17024. La mention « avec mention » est obligatoire pour les immeubles de grande hauteur et certains établissements recevant du public.",
    },
    {
      question: 'Quelle est la valeur limite d’exposition à l’amiante ?',
      answer:
        "La valeur limite d’exposition professionnelle actuelle est de 0,01 fibre par centimètre cube sur 8 heures. Elle sera abaissée à 0,002 f/cm³ entre 2025 et 2029 en application de la directive UE 2023/2668.",
    },
  ],
}
