/**
 * Guide long — État relatif à la présence de termites.
 *
 * Sources : articles L133-5 à L133-6 du Code de la construction et de
 * l'habitation, décret 2006-1653, norme NF P 03-201, articles L271-4 à
 * L271-6 du CCH, arrêtés préfectoraux de zonage termites.
 */

import type { Guide } from '../types'

export const TERMITES_GUIDE: Guide = {
  type: 'termites',
  slug: 'termites',
  shortTitle: 'Termites',
  title: 'Diagnostic termites : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout savoir sur le diagnostic termites : zones contaminées par arrêté préfectoral, validité 6 mois, repérage NF P 03-201 et obligations vendeur.',
  metaDescription:
    'Diagnostic termites 2026 : zones contaminées, validité 6 mois, prix, obligations propriétaire vente. Norme NF P 03-201. Guide complet KOVAS.',
  teaser:
    'Zones contaminées par arrêté préfectoral, validité 6 mois, repérage NF P 03-201 et obligations vendeur.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 25,
  wordCount: 5050,
  relatedTypes: ['amiante', 'erp', 'carrez', 'plomb'],
  sections: [
    {
      id: 'qu-est-ce-que-le-diagnostic-termites',
      title: 'Qu’est-ce que le diagnostic termites',
      level: 2,
      paragraphs: [
        'Le diagnostic termites, plus précisément désigné par la réglementation comme « état relatif à la présence de termites dans le bâtiment », est un diagnostic obligatoire visant à informer l’acquéreur d’un bien immobilier sur la présence ou l’absence de termites et autres insectes xylophages dans la construction. Il est encadré par les articles L133-5 et L133-6 du Code de la construction et de l’habitation, par le décret 2006-1653 du 21 décembre 2006 et par l’arrêté du 7 mars 2012 qui définit les modalités de réalisation. La référence normative est la norme NF P 03-201 qui détaille le protocole d’inspection.',
        'Les termites sont des insectes xylophages sociaux qui vivent en colonies souterraines et se nourrissent de cellulose, principalement présente dans le bois de construction, les boiseries intérieures, les meubles, les papiers peints et les revêtements en cellulose des matériaux modernes. Une colonie mature peut compter plusieurs centaines de milliers d’individus et causer des dégâts considérables avant que l’infestation ne soit visible : poutres affaiblies, planchers effondrés, charpentes ruinées, voire effondrement complet de bâtiments dans les cas extrêmes. En France, l’espèce dominante est le Reticulitermes flavipes (anciennement R. santonensis), termite souterrain qui peut creuser des galeries jusqu’à plusieurs dizaines de mètres sous le sol pour atteindre une source de nourriture.',
        'L’infestation termite est particulièrement insidieuse car ces insectes craignent la lumière et l’air sec : ils creusent leurs galeries à l’intérieur du bois en laissant une fine couche extérieure intacte. Une poutre infestée peut paraître saine en surface alors qu’elle est entièrement vidée à l’intérieur. La présence de termites se révèle souvent par des indices indirects : cordonnets de terre sur les murs (galeries-tunnels en mortier de terre que les termites construisent pour circuler à l’abri), apparition d’insectes ailés (essaimage de jeunes reproducteurs au printemps), traces de friabilité ou de tassement du bois, traces d’humidité localisées.',
        'Le diagnostic termites permet de protéger l’acquéreur d’un bien et de prévenir la propagation de l’infestation. La détection précoce d’une infestation permet d’engager rapidement des traitements curatifs et limite les dégâts structurels et financiers. Contrairement à d’autres diagnostics, le diagnostic termites n’est pas universel : il n’est obligatoire que dans les zones géographiques où la présence de termites est avérée et déclarée par arrêté préfectoral.',
      ],
    },
    {
      id: 'quand-le-diagnostic-est-il-obligatoire',
      title: 'Quand le diagnostic termites est-il obligatoire',
      level: 2,
      paragraphs: [
        'L’obligation de réaliser un diagnostic termites est conditionnée par la situation géographique du bien. Seuls les biens situés dans une zone déclarée contaminée par arrêté préfectoral sont concernés. Chaque préfet de département a compétence pour délimiter, sur la base d’études entomologiques et de signalements, les communes ou parties de communes où la présence de termites est avérée. En 2026, environ 60 départements français sont concernés par un arrêté de zonage, principalement dans l’Ouest, le Sud-Ouest, le Sud-Est et le pourtour méditerranéen.',
        'Les zones d’infestation typiques incluent l’Aquitaine (Gironde, Landes, Pyrénées-Atlantiques, Dordogne), la Charente, le Poitou (Charente-Maritime, Deux-Sèvres, Vienne), la région Pays de la Loire (Loire-Atlantique, Maine-et-Loire, Vendée), la côte atlantique de Bretagne, la vallée du Rhône, la Provence (Bouches-du-Rhône, Var, Vaucluse), la Corse, et certains départements ultramarins. Paris et la petite couronne (Hauts-de-Seine, Seine-Saint-Denis, Val-de-Marne) sont également concernés par un arrêté de zonage depuis 2019 en raison de foyers identifiés dans certaines communes.',
        'Pour vérifier si votre bien est concerné, vous pouvez consulter le site Géorisques (georisques.gouv.fr) qui recense l’ensemble des arrêtés préfectoraux de zonage termites en vigueur, ou contacter la mairie de la commune. Le notaire et le diagnostiqueur disposent également de cette information et la vérifieront systématiquement avant toute mission. Si le bien est situé dans une commune ou une partie de commune classée, le diagnostic est obligatoire pour toute vente.',
        'L’obligation s’applique exclusivement à la vente. Contrairement à d’autres diagnostics, le diagnostic termites n’est pas obligatoire pour les locations. Toutefois, certains bailleurs choisissent de le réaliser à titre informatif pour informer leurs locataires et pour pouvoir agir rapidement en cas d’infestation détectée. Pour les ventes en l’état futur d’achèvement (VEFA) ou de logements neufs, le diagnostic n’est pas obligatoire car la construction récente exclut en principe la présence de termites au moment de la livraison.',
      ],
      callout: {
        type: 'info',
        text: 'La validité d’un diagnostic termites est limitée à six mois en raison de la mobilité des colonies de termites. Un diagnostic réalisé en janvier 2026 ne sera plus valide à partir de juillet 2026, même si aucune infestation n’a été détectée. Cette durée courte impose souvent de réaliser le diagnostic en fin de processus de vente.',
      },
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        'Le cadre réglementaire 2026 du diagnostic termites reste structuré autour du décret 2006-1653 et de l’arrêté du 7 mars 2012. Une révision de la norme NF P 03-201 est intervenue en 2022 pour préciser les modalités d’inspection des bâtiments contemporains, intégrer les nouveaux matériaux composites bois et formaliser l’usage des outils d’aide à la détection (caméras endoscopiques, détecteurs acoustiques). Cette révision améliore la fiabilité des diagnostics dans les bâtiments où l’accès visuel aux structures est limité.',
        'L’obligation pour les propriétaires d’informer leur mairie en cas de constat de termites a été renforcée. Depuis 2023, tout propriétaire qui découvre la présence de termites dans son bien (que ce soit dans le cadre d’un diagnostic ou par observation directe) doit en informer la mairie de sa commune dans le mois suivant la constatation, en application de l’article L133-4 du Code de la construction et de l’habitation. Cette obligation vise à permettre aux pouvoirs publics de cartographier les foyers et de prendre des mesures coordonnées (zonage, traitements collectifs).',
        'Les sanctions en cas de manquement à l’obligation d’information ont été clarifiées. Un propriétaire qui ne déclare pas la présence de termites est passible d’une amende de quatrième classe pouvant atteindre 750 euros. En cas de vente d’un bien dont l’infestation termite était connue mais non mentionnée dans le diagnostic, le vendeur engage sa responsabilité civile au titre de la garantie des vices cachés et peut être condamné à la prise en charge des travaux de traitement et à la réparation des dégâts.',
        'Une évolution notable de 2025 concerne les obligations des copropriétés. Dans les copropriétés situées en zone à risque, le syndic doit désormais inscrire à l’ordre du jour de chaque assemblée générale annuelle un point sur la prévention et la surveillance des termites dans les parties communes. Un suivi régulier (au minimum tous les trois ans) est recommandé pour détecter précocement toute infestation et engager les traitements collectifs avant que l’infestation ne s’étende aux parties privatives.',
        'Pour les bâtiments anciens et historiques, des protocoles spécifiques de traitement ont été développés par le Centre technique du bois et de l’ameublement (FCBA) en collaboration avec les architectes des bâtiments de France. Ces protocoles permettent de traiter efficacement les infestations tout en préservant la valeur patrimoniale des éléments en bois (boiseries, parquets anciens, charpentes traditionnelles). Le coût de ces traitements adaptés peut représenter un surcoût important par rapport aux traitements standards.',
      ],
      bullets: [
        'Diagnostic obligatoire uniquement en zone d’arrêté préfectoral',
        'Validité courte : 6 mois à compter de la réalisation',
        'Obligation déclaration à la mairie en cas de découverte',
        'Sanctions : amende 4ᵉ classe (750 €) pour défaut de déclaration',
        'Norme NF P 03-201 révisée en 2022',
        'Surveillance triennale recommandée en copropriété zone à risque',
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic termites',
      level: 2,
      paragraphs: [
        'Un diagnostic termites dure typiquement entre 30 minutes et deux heures selon la taille du bien et son accessibilité. Le diagnostiqueur commence par une phase administrative au cours de laquelle il vérifie le périmètre exact du bien à inspecter (parties privatives, dépendances, jardin), recueille les informations sur l’historique des traitements éventuels et identifie les zones potentiellement à risque (caves, vides sanitaires, charpente, terrasses extérieures, abords du bâtiment).',
        'L’inspection visuelle constitue le cœur de la prestation. Le diagnostiqueur examine systématiquement toutes les structures en bois accessibles : poutres apparentes, parquets, plinthes, escaliers en bois, encadrements de portes et fenêtres, charpentes apparentes. Il recherche les indices caractéristiques de la présence de termites : cordonnets de terre, traces d’essaimage (ailes au sol), trous de sortie des insectes, friabilité du bois, sons creux à la frappe légère. L’examen porte aussi sur les supports cellulosiques non boiseries : papiers peints, cartons, livres en pile, isolants en fibre de bois ou cellulose.',
        'Pour les structures inaccessibles à l’examen visuel direct (intérieur des cloisons, vides de plancher, plafonds suspendus), le diagnostiqueur utilise des outils complémentaires. Un poinçon ou une vrille permet de sonder la résistance du bois et de révéler les galeries internes. Un détecteur acoustique amplifie les bruits émis par les colonies actives. Une caméra endoscopique peut explorer les cavités à travers un petit perçage. Ces outils sont particulièrement utiles dans les bâtiments anciens ou complexes.',
        'L’examen porte également sur les abords immédiats du bâtiment dans la mesure où ils sont accessibles : terrasses, abris de jardin, souches d’arbres, tas de bois, anciennes installations enterrées. Les termites souterrains peuvent en effet remonter du sol vers les structures à travers les fondations, et la présence d’une source de nourriture (souche de bois en décomposition) à proximité immédiate du bâtiment constitue un facteur de risque majeur qui doit être consigné dans le rapport.',
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Étude documentaire et identification du bien',
          text: 'Le diagnostiqueur vérifie le périmètre à inspecter, recueille l’historique des traitements éventuels et identifie les zones à risque.',
        },
        {
          position: 2,
          name: 'Inspection visuelle des structures en bois',
          text: 'Examen systématique des poutres, parquets, plinthes, escaliers, encadrements et charpentes accessibles. Recherche des indices : cordonnets, essaimage, trous, friabilité.',
        },
        {
          position: 3,
          name: 'Sondage à la vrille et à l’outil',
          text: 'Pour les bois suspects, le diagnostiqueur sonde la résistance par poinçon ou vrille et recherche des galeries internes. Frappe légère pour détecter les sons creux.',
        },
        {
          position: 4,
          name: 'Outils complémentaires',
          text: 'Caméra endoscopique pour les cavités fermées, détecteur acoustique pour les colonies actives, mesure d’humidité pour les zones humides favorables aux termites.',
        },
        {
          position: 5,
          name: 'Inspection des abords du bâtiment',
          text: 'Examen des terrasses, jardins, abris, souches d’arbres et installations enterrées qui peuvent constituer des foyers ou des voies de pénétration des termites.',
        },
        {
          position: 6,
          name: 'Rapport et préconisations',
          text: 'Le rapport indique la présence ou non de termites, les zones inspectées et non inspectées, les indices observés et les recommandations (traitement curatif, surveillance, mesures préventives).',
        },
      ],
    },
    {
      id: 'prix-d-un-diagnostic-termites',
      title: 'Combien coûte un diagnostic termites',
      level: 2,
      paragraphs: [
        'Le prix d’un diagnostic termites se situe en moyenne entre 90 et 180 euros toutes taxes comprises pour un appartement, et entre 130 et 250 euros pour une maison individuelle. Pour les biens avec des éléments complexes (charpente ancienne, sous-sol non accessible, dépendances multiples), le tarif peut atteindre 300 à 400 euros. Comme pour les autres diagnostics, les tarifs sont en moyenne 15 à 20 % supérieurs en zone urbaine dense par rapport à la moyenne nationale.',
        'Le diagnostic termites est généralement inclus dans un pack de diagnostics obligatoires à la vente lorsque le bien est situé en zone classée. Dans ce cadre, le coût marginal du diagnostic se situe entre 80 et 120 euros, ce qui constitue une économie significative par rapport à la commande individuelle. Pour les biens situés dans des zones où le diagnostic n’est pas obligatoire, il peut être commandé à titre volontaire pour rassurer l’acquéreur, en particulier dans les zones limitrophes de zones classées.',
        'Lorsqu’un traitement curatif est nécessaire suite à la détection de termites, le coût peut être considérable. Pour un appartement avec infestation localisée, comptez entre 1 500 et 5 000 euros pour un traitement complet. Pour une maison individuelle avec infestation étendue (charpente et planchers), le traitement peut atteindre 10 000 à 30 000 euros, voire davantage si des éléments structurels doivent être remplacés. Ces traitements sont à la charge du propriétaire et nécessitent l’intervention d’une entreprise spécialisée certifiée.',
      ],
      bullets: [
        'Diagnostic termites appartement : 90 à 180 € TTC',
        'Diagnostic termites maison : 130 à 250 € TTC',
        'Pack vente complet (avec termites) : 350 à 600 € TTC',
        'Traitement curatif appartement : 1 500 à 5 000 €',
        'Traitement curatif maison étendu : 10 000 à 30 000 €',
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        'Le rapport d’un diagnostic termites suit une structure standardisée définie par l’arrêté du 7 mars 2012. Il comprend l’identification du bien (adresse, parcelle cadastrale, type de construction, année de construction), du propriétaire, du diagnostiqueur (nom, certification, organisme certificateur, assurance) et de la mission. Le rapport mentionne également l’arrêté préfectoral en application duquel le diagnostic est réalisé et précise sa date d’expiration éventuelle.',
        'Le corps du rapport présente le résultat de l’inspection. En cas d’absence d’indices de termites, le rapport conclut à l’absence de présence détectée à la date de la visite, avec mention des zones effectivement inspectées et des zones non inspectées (avec leur motif). Cette précision est importante car le diagnostiqueur ne peut conclure que sur les parties qu’il a effectivement examinées. Les parties inaccessibles (cloisons fermées, faux plafonds non démontables, vides sanitaires non accessibles) sont systématiquement listées dans le rapport.',
        'En cas de présence détectée, le rapport décrit avec précision les zones infestées, les indices observés (cordonnets, galeries, essaimage, dégâts), l’importance estimée de l’infestation et les éléments en bois concernés. Des photographies sont annexées pour documenter chaque indice. Le rapport indique également les recommandations à prendre : traitement curatif, fréquence de surveillance future, mesures préventives à mettre en œuvre. Le propriétaire est invité à déclarer l’infestation à la mairie dans le mois qui suit.',
        'Le rapport inclut systématiquement une notice d’information sur la biologie des termites, les indices à surveiller et les bonnes pratiques de prévention. Cette notice est précieuse pour le futur acquéreur ou occupant qui pourra ainsi être attentif à toute évolution. La protection des fondations contre les remontées de termites, le traitement préventif des bois exposés et le maintien d’une bonne aération des locaux humides sont les mesures préventives les plus importantes.',
      ],
    },
    {
      id: 'traitement-en-cas-de-presence',
      title: 'Quels traitements en cas de présence',
      level: 2,
      paragraphs: [
        'Lorsque le diagnostic révèle la présence de termites, plusieurs techniques de traitement existent, à mettre en œuvre par une entreprise spécialisée certifiée selon la norme CTBA+ ou équivalent. La technique la plus courante est le traitement chimique par injection. Des produits insecticides à action longue durée (généralement à base de bifenthrine, perméthrine ou imidaclopride) sont injectés sous pression dans les bois et dans les fondations à travers des forages. Cette technique est efficace mais nécessite un suivi à 12 mois et à 24 mois pour vérifier l’éradication complète.',
        'Le traitement par appâts est une alternative écologique et de plus en plus utilisée. Des stations d’appâts contenant un retardateur de croissance des insectes (hexaflumuron, noviflumuron) sont disposées autour du bâtiment et le long des cheminements connus des termites. Les ouvriers, attirés par la cellulose des appâts, transportent l’insecticide dans la colonie qu’ils contaminent progressivement. La technique est très efficace mais nécessite plusieurs mois pour produire ses effets et une surveillance continue.',
        'Pour les structures massivement infestées, le remplacement des éléments en bois peut être nécessaire. Les poutres, parquets ou éléments de charpente trop endommagés sont déposés et remplacés par des éléments neufs traités préventivement. Cette opération s’accompagne systématiquement d’un traitement chimique des éléments conservés et des structures adjacentes pour éviter toute recontamination. Le coût peut être élevé, particulièrement pour les charpentes traditionnelles.',
        'Pour les biens neufs ou en rénovation lourde, un traitement préventif est obligatoire en zone classée. Ce traitement consiste à appliquer un dispositif de barrière chimique ou physique entre le sol et la construction pour empêcher les termites souterrains de pénétrer dans le bâtiment. Plusieurs techniques sont disponibles : films barrières, mortiers répulsifs, dispositifs métalliques anti-termites. Ce traitement préventif est attesté par un certificat délivré par l’entreprise et conservé par le propriétaire.',
        'Le suivi post-traitement est essentiel pour confirmer l’efficacité de l’intervention. Une inspection est recommandée à 6 mois, à 12 mois et à 24 mois après le traitement. Si aucune nouvelle activité n’est détectée à 24 mois, l’éradication peut être considérée comme acquise, sous réserve de la mise en place de mesures préventives durables (maintenance des barrières, surveillance régulière des indices). En cas de réinfestation, un traitement complémentaire est nécessaire et peut faire jouer une éventuelle garantie de l’entreprise initiale.',
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières pour le traitement',
      level: 2,
      paragraphs: [
        'Les traitements termites ne bénéficient pas d’aides publiques spécifiques au niveau national, car ils ne génèrent pas d’économies d’énergie ou d’amélioration de la performance environnementale. Cependant, certaines collectivités locales (régions, départements, communes) peuvent proposer des subventions partielles dans le cadre de programmes de préservation du patrimoine bâti, particulièrement dans les zones fortement touchées comme l’Aquitaine ou les Pays de la Loire. Renseignez-vous auprès de votre ADIL ou de votre mairie pour identifier les dispositifs locaux mobilisables.',
        'Pour les copropriétés engagées dans une rénovation patrimoniale, certaines aides de l’Anah peuvent inclure les traitements termites dans le cadre d’une opération plus large de rénovation. Le programme « Habiter Sain » couvre la lutte contre l’habitat insalubre, dont les infestations parasitaires lourdes. Le taux d’aide peut atteindre 50 % du coût des travaux pour les propriétaires modestes, plafonné selon les ressources.',
        'Sur le plan fiscal, les traitements termites bénéficient de la TVA réduite à 10 % lorsqu’ils sont réalisés par un professionnel dans un logement de plus de deux ans. Cette TVA réduite, qui couvre matériaux et main-d’œuvre, représente une économie substantielle souvent oubliée. Pour les bailleurs, les frais de traitement peuvent être déduits des revenus fonciers comme charges de maintenance et de conservation du bien.',
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur termites',
      level: 2,
      paragraphs: [
        'Le diagnostic termites doit être réalisé par un diagnostiqueur certifié COFRAC selon la norme NF EN ISO/IEC 17024 avec une compétence spécifique en termites et autres insectes xylophages. Cette certification est distincte de celles requises pour le DPE, le gaz ou l’électricité. Vérifiez sur l’annuaire officiel des diagnostiqueurs publié par le ministère du Logement que la certification termites est bien active et que le professionnel dispose d’une assurance responsabilité civile adaptée.',
        'Au-delà de la certification, l’expérience pratique du diagnostiqueur en zone fortement infestée est un critère majeur. Un professionnel exerçant régulièrement dans des départements à forte pression termites (Gironde, Charente-Maritime, Bouches-du-Rhône) aura une meilleure capacité à détecter les indices précoces que un diagnostiqueur opérant principalement dans des zones moins touchées. Vérifiez également que le diagnostiqueur dispose d’outils complémentaires (caméra endoscopique, détecteur acoustique, hygromètre) qui améliorent significativement la fiabilité du diagnostic.',
        'La capacité du diagnostiqueur à interpréter les indices indirects est également un critère de qualité. Une infestation termite ancienne et traitée peut laisser des traces (galeries vides, perforations dans le bois, anciens cordonnets) qui doivent être distinguées d’une infestation active. Un diagnostiqueur expérimenté sait identifier les signes vivants (humidité associée, bois friable récent, présence d’ouvriers ou d’ailes d’essaimage) qui révèlent une activité en cours, et les signes anciens qui correspondent à une situation maîtrisée. Cette discrimination est cruciale pour le vendeur car elle conditionne les recommandations de traitement.',
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        'Plusieurs configurations particulières demandent une expertise renforcée. Les bâtiments anciens à charpente traditionnelle (poutres en chêne ou sapin massif, planchers à solives apparentes) sont les plus vulnérables aux termites en raison de la masse de bois disponible et de l’accessibilité de matériaux secs à l’intérieur des cloisons et des plafonds. Le diagnostic d’une longère bordelaise, d’une maison de bourg charentaise ou d’une bastide provençale doit être particulièrement minutieux et inclure systématiquement la charpente, les boiseries intérieures et les abords du bâtiment.',
        'Les immeubles collectifs avec parties communes en bois (escaliers en bois massif, paliers boisés, plafonds à la française) cumulent les risques. Les termites peuvent se propager d’un appartement à l’autre par les galeries souterraines et les conduits techniques, ce qui rend le traitement collectif souvent obligatoire. Le syndic doit organiser des visites de prévention régulières dans les parties communes et les caves, et programmer un diagnostic termites tous les trois ans dans les zones à forte pression. Une infestation détectée tardivement peut nécessiter le traitement de plusieurs centaines de mètres carrés et engendrer des coûts importants pour le syndicat des copropriétaires.',
        'Les biens avec sous-sol non accessible posent une difficulté particulière car les termites souterrains pénètrent prioritairement par le sol. Si le sous-sol n’est pas visitable au moment du diagnostic, le diagnostiqueur doit l’indiquer explicitement dans le rapport avec mention des conséquences sur la fiabilité du résultat. Pour un bien situé en zone à forte pression, un sous-sol non visité doit faire l’objet d’une inspection complémentaire, par exemple via une trappe d’accès ou un examen endoscopique des fondations.',
        'Les annexes et dépendances en bois (abris de jardin, hangars, terrasses bois, pergolas) sont des sources d’infestation potentielles pour le bâtiment principal. Un diagnostic complet doit inclure ces éléments même s’ils sont éloignés du logement. Une souche d’arbre proche, un tas de bois de chauffage stocké contre un mur, une ancienne palette laissée au sol peuvent constituer des foyers initiaux qui contamineront le bâtiment principal en quelques années. Le diagnostiqueur doit signaler ces points de vigilance même s’ils ne sont pas directement infestés.',
        'Les biens situés en zone limitrophe d’une zone classée (commune voisine d’une commune en arrêté préfectoral) peuvent ne pas être soumis à l’obligation de diagnostic mais présenter néanmoins un risque réel. Les colonies de termites peuvent migrer sur plusieurs kilomètres et coloniser progressivement de nouveaux territoires. Pour ces biens, un diagnostic volontaire à titre préventif est recommandé, particulièrement si le bâtiment est ancien ou présente des structures bois importantes. Le coût modeste du diagnostic (90 à 180 euros) est largement compensé par la sécurité qu’il apporte.',
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        'Une première erreur fréquente consiste à minimiser la portée géographique du risque. Beaucoup de propriétaires en zone classée pensent que leur bien est épargné parce que les voisins immédiats n’ont pas signalé d’infestation. Les termites se développent en silence pendant plusieurs années avant de devenir visibles, et l’absence de signes apparents chez les voisins ne garantit pas l’absence d’infestation chez vous. Le diagnostic systématique tous les trois à six ans en zone classée est la seule façon de détecter précocement les infestations et de limiter les dégâts.',
        'Une deuxième erreur consiste à entreprendre des traitements soi-même avec des produits du commerce. Les insecticides grand public vendus en jardinerie ne sont généralement pas suffisamment puissants ni rémanents pour éradiquer une colonie de termites. Pire, ils peuvent simplement disperser la colonie qui se reconstituera ailleurs dans le bâtiment, rendant le traitement professionnel ultérieur plus complexe. Le traitement termites est une opération technique qui nécessite des produits homologués, des techniques d’injection spécifiques et un suivi post-traitement à 12 et 24 mois.',
        'Une troisième erreur consiste à ne pas déclarer la présence de termites à la mairie. Cette obligation, prévue par l’article L133-4 du Code de la construction et de l’habitation, est trop souvent ignorée. Or, elle est essentielle pour permettre aux pouvoirs publics de cartographier les foyers et de coordonner les actions préventives à l’échelle du quartier ou de la commune. Le défaut de déclaration est sanctionné par une amende de quatrième classe (jusqu’à 750 euros) et peut engager la responsabilité civile du propriétaire en cas de propagation aux propriétés voisines.',
        'Une quatrième erreur consiste à confier les travaux à une entreprise non certifiée. Le traitement termites est strictement réglementé et nécessite des entreprises certifiées CTBA+ ou équivalent, avec des opérateurs formés à la manipulation des produits insecticides, des protocoles de chantier rigoureux et une garantie sur l’efficacité du traitement (généralement 10 ans). Une entreprise non certifiée peut appliquer des produits sans efficacité réelle, exposer les occupants à des contaminations chimiques, et ne fournira pas de garantie en cas de réinfestation.',
        'Une cinquième erreur consiste à négliger les mesures préventives après un traitement. Le traitement curatif éradique la colonie présente, mais ne protège pas contre une réinfestation future depuis l’extérieur. Les mesures préventives durables (élimination des sources de bois en décomposition à proximité, maintien d’une bonne ventilation, traitement préventif des bois neufs, installation de barrières physiques au sol pour les constructions neuves) sont indispensables pour pérenniser le traitement. Une inspection régulière tous les trois ans après un traitement permet de détecter précocement toute nouvelle activité.',
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        'Le diagnostic termites est un outil essentiel de protection du patrimoine bâti contre l’infestation par les insectes xylophages. Contrairement à d’autres diagnostics universels, le diagnostic termites n’est obligatoire que dans les zones géographiques classées par arrêté préfectoral, soit environ 60 départements en France. Cette obligation circonscrite à la fois aux zones de risque avéré et aux ventes (pas aux locations) traduit le caractère localisé du risque et la nécessité d’adapter le dispositif à la réalité épidémiologique de l’infestation.',
        'Le critère d’obligation est purement géographique : un bien situé dans une commune ou partie de commune classée par arrêté préfectoral est concerné pour toute vente. Les zones d’infestation typiques incluent l’Aquitaine, la Charente, le Poitou, les Pays de la Loire, la côte atlantique de Bretagne, la vallée du Rhône, la Provence, la Corse et certains départements ultramarins. Paris et la petite couronne sont également concernés depuis 2019 en raison de foyers identifiés dans certaines communes. La vérification du classement de la commune se fait via le site Géorisques.',
        'La validité courte du diagnostic (6 mois) reflète la mobilité des colonies de termites et la rapidité de leur progression. Un diagnostic réalisé en début d’année 2026 ne sera plus valide à partir du milieu d’année, même si aucune infestation n’a été détectée. Cette durée impose souvent de réaliser le diagnostic en fin de processus de vente, juste avant la signature de l’acte authentique. Pour les transactions longues (plus de 6 mois entre compromis et signature notariée), un renouvellement du diagnostic est nécessaire.',
        'Le coût du diagnostic varie de 90 à 250 euros, et le coût d’un traitement curatif peut atteindre plusieurs dizaines de milliers d’euros pour une infestation étendue. Les techniques de traitement (injection chimique, appâts insecticides, remplacement d’éléments structurels) doivent être mises en œuvre par une entreprise certifiée CTBA+ qui fournit une garantie de 10 ans sur l’efficacité du traitement. Les aides publiques pour les traitements termites sont limitées (pas de MaPrimeRénov’) mais la TVA réduite à 10 % s’applique automatiquement aux travaux réalisés par un professionnel.',
        'L’obligation de déclaration à la mairie en cas de découverte de termites est essentielle mais souvent ignorée. Cette déclaration permet aux pouvoirs publics de cartographier les foyers et de coordonner les actions préventives à l’échelle du quartier ou de la commune. Le défaut de déclaration est sanctionné par une amende de quatrième classe (jusqu’à 750 euros) et peut engager la responsabilité civile du propriétaire en cas de propagation aux propriétés voisines. La déclaration doit être faite dans le mois suivant la constatation.',
        'Le choix du diagnostiqueur doit privilégier la certification COFRAC spécifique termites, l’expérience en zone à forte pression (Gironde, Charente-Maritime, Bouches-du-Rhône), et la disposition d’outils complémentaires (caméra endoscopique, détecteur acoustique, hygromètre). La capacité à distinguer une infestation active d’une infestation ancienne traitée est un indicateur de qualité. Pour les biens à risque particulier (charpente traditionnelle, sous-sol non accessible, abords boisés), un investissement supplémentaire dans la qualité du diagnostic et dans des inspections complémentaires est largement justifié.',
        'Le changement climatique influence progressivement la répartition géographique des termites en France. Le réchauffement et l’allongement des saisons chaudes favorisent la progression des colonies vers le nord et l’est du territoire. Des communes auparavant épargnées commencent à signaler des infestations, et les arrêtés préfectoraux de zonage évoluent en conséquence. Pour les propriétaires, cela signifie que même en zone non classée actuellement, une vigilance préventive devient pertinente, particulièrement pour les biens anciens à structure bois importante. Une inspection volontaire tous les cinq à dix ans est une mesure de précaution raisonnable.',
      ],
    },
  ],
  faq: [
    {
      question: 'Le diagnostic termites est-il obligatoire partout en France ?',
      answer:
        'Non, le diagnostic termites n’est obligatoire que dans les zones classées par arrêté préfectoral. Environ 60 départements sont concernés, principalement dans l’Ouest, le Sud-Ouest, le Sud-Est et le pourtour méditerranéen.',
    },
    {
      question: 'Quelle est la durée de validité d’un diagnostic termites ?',
      answer:
        'La validité est de 6 mois à compter de la réalisation du diagnostic. Cette durée courte tient compte de la mobilité des colonies de termites.',
    },
    {
      question: 'Le diagnostic termites est-il obligatoire pour une location ?',
      answer:
        'Non, l’obligation ne concerne que les ventes. Pour une location, le diagnostic n’est pas exigé même en zone classée.',
    },
    {
      question: 'Combien coûte un diagnostic termites ?',
      answer:
        'Entre 90 et 180 € TTC pour un appartement et 130 à 250 € pour une maison. Le diagnostic est généralement inclus dans un pack de diagnostics obligatoires à la vente.',
    },
    {
      question: 'Comment savoir si mon bien est en zone classée ?',
      answer:
        'Consultez le site Géorisques (georisques.gouv.fr) qui recense l’ensemble des arrêtés préfectoraux de zonage termites en vigueur. Vous pouvez également contacter la mairie de la commune.',
    },
    {
      question: 'Que faire si des termites sont détectés ?',
      answer:
        'Faites intervenir une entreprise spécialisée certifiée pour un traitement curatif (injection chimique, appâts, remplacement d’éléments). Déclarez également l’infestation à la mairie dans le mois qui suit la constatation.',
    },
    {
      question: 'Quels sont les indices de présence de termites ?',
      answer:
        'Cordonnets de terre sur les murs, présence d’insectes ailés (essaimage de printemps), trous de sortie, friabilité du bois, sons creux à la frappe légère, traces d’humidité localisées.',
    },
    {
      question: 'Combien coûte un traitement termites ?',
      answer:
        'Entre 1 500 et 5 000 € pour une infestation localisée en appartement, et de 10 000 à 30 000 € pour une infestation étendue dans une maison nécessitant le traitement de la charpente et des planchers.',
    },
    {
      question: 'Le diagnostic termites couvre-t-il les autres insectes xylophages ?',
      answer:
        'Le diagnostic obligatoire ne porte que sur les termites. Toutefois, beaucoup de diagnostiqueurs signalent à titre d’information la présence éventuelle d’autres insectes xylophages (capricornes, vrillettes, lyctus).',
    },
    {
      question: 'Que se passe-t-il en cas d’absence de diagnostic à la vente ?',
      answer:
        'Le vendeur reste tenu de la garantie des vices cachés sans pouvoir invoquer son ignorance. En cas de découverte d’une infestation par l’acquéreur, le vendeur peut être condamné à la prise en charge des travaux et à des dommages-intérêts.',
    },
    {
      question: 'Le diagnostic termites est-il obligatoire pour un terrain non bâti ?',
      answer:
        'Non, le diagnostic ne s’applique qu’aux bâtiments. Toutefois, en zone classée, des précautions sont recommandées avant toute construction nouvelle (traitement préventif des fondations).',
    },
    {
      question: 'Combien de temps dure un diagnostic termites ?',
      answer:
        'Entre 30 minutes et 2 heures selon la taille et la complexité du bien. Le rapport est généralement remis sous 24 à 48 heures.',
    },
    {
      question: 'Faut-il refaire un diagnostic après un traitement ?',
      answer:
        'Oui, un nouveau diagnostic est recommandé à 12 et 24 mois après le traitement pour confirmer l’éradication. En cas de vente ultérieure, un diagnostic récent (< 6 mois) sera nécessaire.',
    },
    {
      question: 'Comment prévenir l’apparition de termites ?',
      answer:
        'Éliminer les sources de bois en décomposition à proximité du bâtiment, maintenir une bonne ventilation des locaux, éviter l’humidité stagnante au contact des structures, surveiller régulièrement les bois en contact avec le sol.',
    },
    {
      question: 'Le syndic doit-il faire un diagnostic dans les parties communes ?',
      answer:
        'En zone classée, une surveillance régulière des parties communes est fortement recommandée. Depuis 2025, le syndic doit inscrire ce point à l’ordre du jour de chaque assemblée générale annuelle.',
    },
  ],
}
