/**
 * Guide long — Constat de Risque d'Exposition au Plomb (CREP).
 *
 * Sources : décret 2006-474, arrêté du 19 août 2011, articles L1334-5 à
 * L1334-12 du Code de la santé publique, ANSES, Haut Conseil de la santé
 * publique, recommandations OMS sur l'exposition au plomb dans l'habitat.
 */

import type { Guide } from '../types'

export const PLOMB_GUIDE: Guide = {
  type: 'plomb',
  slug: 'plomb',
  shortTitle: 'Plomb (CREP)',
  title: 'Constat de risque d’exposition au plomb (CREP) : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout savoir sur le diagnostic plomb : obligation pour les logements d’avant 1949, validité illimitée si négatif, mesures de protection et travaux.',
  metaDescription:
    'CREP plomb 2026 : logement avant 1949, dégradation, validité, prix, obligations propriétaire vente et location. Guide complet KOVAS.',
  teaser:
    'Bâtiments avant 1949, repérage des revêtements dégradés, validité 1 an si positif et obligations bailleur.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 26,
  wordCount: 5200,
  relatedTypes: ['amiante', 'dpe', 'erp', 'electricite'],
  sections: [
    {
      id: 'qu-est-ce-que-le-crep',
      title: 'Qu’est-ce que le CREP et pourquoi est-il important',
      level: 2,
      paragraphs: [
        "Le constat de risque d’exposition au plomb, désigné par l’acronyme CREP, est un diagnostic réglementaire obligatoire qui vise à protéger les occupants d’un logement, et particulièrement les jeunes enfants, contre les risques du saturnisme. Il est encadré par les articles L1334-5 à L1334-12 du Code de la santé publique, par le décret 2006-474 du 25 avril 2006, et par l’arrêté du 19 août 2011 qui définit le protocole de réalisation. Le CREP a succédé en 2006 à l’ancien état des risques d’accessibilité au plomb (ERAP) et a élargi son périmètre tant géographique que temporel.",
        "Le plomb a été massivement utilisé dans les peintures intérieures et extérieures jusqu’à son interdiction officielle en 1949, et certaines céruses ont continué à circuler de manière résiduelle jusqu’au milieu des années 1950. Sous forme de pigment blanc, le plomb apportait aux peintures à l’huile leur opacité, leur durabilité et leur résistance à l’humidité. Cette utilisation a laissé un héritage considérable dans le parc bâti français : selon l’ANSES, plus de cinq millions de logements peuvent encore contenir des revêtements au plomb, principalement sous forme de couches de peinture recouvertes par des peintures plus récentes.",
        "Le danger du plomb réside dans sa capacité à pénétrer dans l’organisme par ingestion d’écailles ou de poussières et par inhalation de fines particules. Une fois dans le sang, le plomb se fixe sur les os, le foie et le cerveau. Chez les jeunes enfants, dont le système nerveux est en développement, l’exposition même à des doses infimes peut provoquer des troubles cognitifs irréversibles, des retards de croissance, des troubles du comportement et, dans les formes sévères, des encéphalopathies pouvant être mortelles. Le saturnisme infantile reste une maladie à déclaration obligatoire, et la concentration plombémique de référence a été abaissée à 50 µg/L chez l’enfant en 2015.",
        "L’importance du CREP tient à la fois à sa valeur informative pour les futurs occupants et à sa fonction de déclencheur d’actions correctives. Lorsque le diagnostic identifie des revêtements contenant du plomb dans un état dégradé, le propriétaire est tenu d’engager des travaux palliatifs sans délai pour éliminer le risque d’exposition. Cette obligation est opposable et engage la responsabilité civile, voire pénale, du propriétaire en cas de défaut d’information ou d’absence d’action corrective.",
      ],
    },
    {
      id: 'quand-le-crep-est-il-obligatoire',
      title: 'Quand le CREP est-il obligatoire',
      level: 2,
      paragraphs: [
        "Le CREP est obligatoire pour tout immeuble d’habitation construit avant le 1ᵉʳ janvier 1949, date d’interdiction de l’utilisation du plomb dans les peintures intérieures. Cette ancienneté correspond à environ un tiers du parc immobilier français, principalement concentré dans les centres-villes historiques et dans les départements urbanisés au XIXᵉ siècle. La date du permis de construire est le critère unique : peu importent les rénovations ultérieures ou les changements de propriétaire, seule l’antériorité à 1949 conditionne l’obligation.",
        "Trois cas principaux déclenchent la réalisation d’un CREP. À la vente, le CREP doit être annexé au compromis et figurer dans le dossier de diagnostic technique remis chez le notaire. À la signature du bail, qu’il s’agisse d’une location vide ou meublée, d’une résidence principale ou secondaire, le bailleur doit annexer le CREP au contrat de location et le tenir à la disposition de tout locataire qui en fait la demande. Enfin, pour les parties communes des immeubles collectifs, un CREP des parties communes doit être réalisé par le syndicat des copropriétaires et tenu à jour.",
        "Pour les parties communes d’un immeuble bâti avant 1949, l’obligation a été instaurée par le décret 2006-1114 du 5 septembre 2006 et son délai de mise en conformité courait jusqu’au 12 août 2008. Aujourd’hui, en 2026, tous les immeubles concernés devraient en principe disposer d’un CREP des parties communes valide. Le syndic est tenu de le présenter aux occupants à leur demande et de le mettre à jour selon les modalités définies par la loi.",
        "Il existe une nuance importante sur la validité du CREP qui dépend du résultat du diagnostic. Si le CREP conclut à l’absence totale de plomb ou à des concentrations inférieures au seuil réglementaire de 1 mg/cm², sa validité est illimitée : aucun nouveau diagnostic ne sera jamais exigé pour le bien. À l’inverse, si le diagnostic identifie des revêtements contenant du plomb, la validité du CREP est réduite à un an pour les ventes et à six ans pour les locations. Cette différence de durée s’explique par la nécessité de réévaluer périodiquement l’état des revêtements et l’existence de dégradations susceptibles d’exposer les occupants.",
      ],
      callout: {
        type: 'warning',
        text: "Lorsqu’un CREP identifie des unités de diagnostic dégradées contenant du plomb à une concentration supérieure ou égale à 1 mg/cm², le propriétaire est tenu d’engager des travaux palliatifs sans délai et d’informer les occupants des consignes de sécurité. Le diagnostiqueur transmet également un signalement à l’Agence régionale de santé qui peut imposer des travaux d’office en cas d’inertie du propriétaire.",
      },
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        "Le cadre réglementaire du CREP n’a pas connu de bouleversements majeurs en 2025-2026, le décret de 2006 et l’arrêté de 2011 demeurant les textes de référence. Plusieurs évolutions notables sont toutefois intervenues. La première concerne la mise à jour des protocoles d’analyse : depuis 2023, les diagnostiqueurs doivent utiliser exclusivement des appareils à fluorescence X portables certifiés selon la norme NF X46-031, ce qui garantit une fiabilité de mesure améliorée et une comparabilité des résultats entre opérateurs.",
        "La seconde évolution porte sur la formation des diagnostiqueurs. Depuis le 1ᵉʳ janvier 2024, la certification CREP est délivrée pour une durée de sept ans (contre cinq précédemment) avec une surveillance annuelle renforcée, mais avec une formation continue triennale obligatoire de 14 heures minimum. Cette formation continue couvre les évolutions réglementaires, les nouvelles techniques de repérage et les actualités jurisprudentielles. Elle vise à maintenir un haut niveau de compétence dans un domaine où les enjeux sanitaires restent prégnants.",
        "Une troisième évolution structurante concerne l’articulation entre le CREP et les autres diagnostics. Depuis 2024, l’ANSES recommande systématiquement de coupler le CREP avec une analyse de l’eau du robinet pour les logements antérieurs à 1995, car les canalisations en plomb des réseaux intérieurs constituent une source d’exposition complémentaire et souvent ignorée. Cette recommandation n’est pas encore obligatoire mais nombreuses sont les agences immobilières et notaires qui l’intègrent désormais dans leurs prestations de conseil.",
        "Pour les copropriétés, l’obligation de mise à jour du CREP des parties communes est désormais inscrite à l’ordre du jour systématique des assemblées générales annuelles. Le syndic doit présenter un point d’étape sur les unités de diagnostic identifiées comme contenant du plomb, leur état de conservation, et les actions correctives engagées ou planifiées. Un syndic défaillant peut voir sa responsabilité engagée en cas d’exposition d’un occupant, particulièrement d’un enfant en bas âge.",
        "Enfin, la coordination entre le CREP et les politiques publiques de lutte contre l’habitat indigne s’est renforcée. Les Agences régionales de santé disposent désormais d’une plateforme de signalement dédiée qui centralise les CREP positifs et permet un suivi coordonné avec les services communaux d’hygiène et de santé. Cette coordination accélère les mesures de prévention dans les logements occupés par des familles avec enfants en bas âge.",
      ],
      bullets: [
        "Permis de construire avant le 1ᵉʳ janvier 1949 = CREP obligatoire",
        "CREP négatif : validité illimitée",
        "CREP positif vente : validité 1 an",
        "CREP positif location : validité 6 ans",
        "Seuil réglementaire : 1 mg/cm² de plomb",
        "Diagnostiqueur certifié pour 7 ans (depuis 2024) avec formation triennale",
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic plomb',
      level: 2,
      paragraphs: [
        "Un CREP comprend une phase administrative et une phase de mesure sur chaque unité de diagnostic. Le diagnostiqueur commence par identifier le bien, recueillir les documents disponibles (permis de construire, plans, anciens diagnostics, historique des travaux de rénovation), puis dresse la liste exhaustive des unités de diagnostic à investiguer. Une unité de diagnostic est constituée d’un revêtement et de son support : une porte avec sa peinture, un mur avec son enduit peint, une fenêtre avec son cadre. Pour un logement, on dénombre typiquement 30 à 80 unités de diagnostic selon la surface et la complexité.",
        "La mesure de la concentration en plomb s’effectue avec un appareil portable à fluorescence X (XRF), qui projette des rayons X sur le revêtement et analyse les rayonnements de fluorescence émis en retour. Cette technique non destructive permet de mesurer la concentration en plomb traverse toutes les couches de peinture jusqu’à plusieurs millimètres de profondeur, ce qui est essentiel car les peintures au plomb sont souvent recouvertes par des peintures plus récentes. La mesure prend quelques secondes par unité et le résultat est instantané, exprimé en milligrammes par centimètre carré.",
        "Lorsque la mesure XRF est supérieure ou égale au seuil réglementaire de 1 mg/cm², l’unité de diagnostic est classée comme positive. Le diagnostiqueur évalue alors l’état de conservation du revêtement selon trois grades : non dégradé, état d’usage et dégradé. Cet état conditionne directement les obligations du propriétaire : un revêtement positif en bon état nécessite simplement une surveillance, un revêtement dégradé impose des travaux palliatifs sans délai. Le diagnostiqueur photographie systématiquement les unités positives et les zones de dégradation.",
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Étude documentaire et identification du bien',
          text: "Le diagnostiqueur vérifie la date de construction, examine les documents techniques disponibles et identifie les zones de risque potentiel (anciennes peintures, boiseries, encadrements de fenêtres).",
        },
        {
          position: 2,
          name: 'Liste exhaustive des unités de diagnostic',
          text: "Chaque revêtement de chaque pièce constitue une unité de diagnostic. Un logement typique comprend 30 à 80 unités à mesurer.",
        },
        {
          position: 3,
          name: 'Mesure à la fluorescence X (XRF)',
          text: "Un appareil portable XRF mesure la concentration en plomb sur chaque unité. La mesure est non destructive et prend quelques secondes.",
        },
        {
          position: 4,
          name: 'Évaluation de l’état de conservation',
          text: "Les unités positives (≥ 1 mg/cm²) sont classées selon trois grades : non dégradé, état d’usage ou dégradé. Cet état conditionne les obligations du propriétaire.",
        },
        {
          position: 5,
          name: 'Rapport et signalement éventuel à l’ARS',
          text: "Le rapport répertorie toutes les unités, leur concentration et leur état. En cas d’unités dégradées positives, le diagnostiqueur signale l’ARS et notifie les occupants des consignes de sécurité.",
        },
      ],
    },
    {
      id: 'prix-d-un-crep',
      title: 'Combien coûte un diagnostic plomb',
      level: 2,
      paragraphs: [
        "Le prix d’un CREP varie principalement en fonction de la surface du logement et du nombre d’unités de diagnostic à investiguer. Pour un studio de 25 à 30 m², comptez en moyenne 90 à 140 euros toutes taxes comprises. Pour un T2 ou T3, le prix se situe généralement entre 130 et 200 euros. Pour une maison individuelle de quatre pièces ou plus, le tarif peut atteindre 250 à 400 euros, notamment si le bien comprend de nombreuses pièces avec des boiseries d’époque.",
        "Pour les parties communes d’un immeuble collectif, le coût est généralement facturé à la copropriété et dépend du linéaire de circulations, des escaliers et des annexes (caves, locaux poubelles, locaux techniques). Pour un immeuble haussmannien de cinq étages avec 20 à 40 lots, le CREP des parties communes oscille entre 400 et 1 200 euros. La mise à jour, moins exhaustive, est généralement facturée 30 à 50 pour cent du coût initial.",
        "Comme pour les autres diagnostics, il est fortement déconseillé de choisir un diagnostiqueur uniquement sur le critère du prix le plus bas. Un CREP réalisé en moins d’une heure sans mesure XRF sérieuse sur toutes les unités de diagnostic expose le propriétaire à un risque juridique et sanitaire majeur. Les CREP positifs non détectés peuvent entraîner des poursuites en responsabilité civile, voire pénale en cas d’intoxication d’un enfant occupant, sans compter les recours en révision du prix de vente ou en annulation de la transaction.",
      ],
      bullets: [
        "CREP studio : 90 à 140 € TTC",
        "CREP T2-T3 : 130 à 200 € TTC",
        "CREP maison individuelle : 250 à 400 € TTC",
        "CREP parties communes copropriété 20-40 lots : 400 à 1 200 € TTC",
        "Pack diagnostics vente avec CREP : 350 à 600 € TTC",
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        "Le rapport CREP suit une trame réglementaire stricte définie par l’arrêté du 19 août 2011. Il commence par l’identification du bien (adresse, parcelle cadastrale, date du permis de construire, propriétaire), l’identification du diagnostiqueur (nom, certification, organisme certificateur, assurance) et l’identification de la mission (vente, location, parties communes). Le diagnostiqueur précise également la liste des pièces ou parties effectivement visitées et le motif de toute pièce non accessible.",
        "Le corps du rapport présente le tableau des unités de diagnostic. Pour chacune, sont indiqués la pièce, le revêtement, le support, la concentration mesurée en plomb (mg/cm²), la classe de l’unité (0 : non mesurable / 1 : négative / 2 : positive non dégradée / 3 : positive état d’usage / 4 : positive dégradée) et la mention « UD avec facteur de dégradation » lorsque c’est le cas. Les classes 3 et 4 imposent une action corrective du propriétaire ; les classes 1 et 2 nécessitent un simple suivi.",
        "Lorsque le diagnostic conclut à la présence d’unités dégradées positives (classe 4), le rapport contient obligatoirement une notice d’information sur les effets du plomb sur la santé, particulièrement chez les jeunes enfants et les femmes enceintes. Cette notice indique les mesures conservatoires à prendre dans l’attente des travaux : interdiction de manipuler les peintures écaillées, nettoyage humide régulier, surveillance des enfants. Le rapport prescrit également les modalités de réalisation des travaux palliatifs et leur planning.",
        "Une fiche récapitulative en fin de rapport synthétise les principales conclusions et les obligations du propriétaire. Pour les CREP des parties communes, cette fiche doit être affichée ou tenue à la disposition de tous les occupants. La transmission du rapport à l’Agence régionale de santé est mentionnée le cas échéant et le diagnostiqueur signale aux autorités sanitaires toute situation d’exposition particulière (présence d’enfants en bas âge, dégradation avancée).",
      ],
    },
    {
      id: 'travaux-palliatifs',
      title: 'Quels travaux en cas de présence de plomb',
      level: 2,
      paragraphs: [
        "Les travaux palliatifs visent à supprimer l’exposition des occupants au plomb sans nécessairement éliminer le plomb lui-même. Trois grandes techniques existent : le recouvrement par un revêtement neuf adhérent (papier peint, peinture, plâtre), le démontage de l’élément avec remplacement (porte, fenêtre, plinthe), et le décapage avec retrait complet de la couche de peinture au plomb. Le choix dépend de la nature de l’unité, de son état, de la valeur patrimoniale de l’élément et du budget disponible.",
        "Le recouvrement est la technique la plus courante car la moins coûteuse. Il consiste à appliquer un revêtement neuf qui isole mécaniquement le plomb des occupants. Pour les murs, un papier peint épais ou une nouvelle peinture suffit en général, à condition que le support soit stable et non dégradé. Pour les boiseries (portes, fenêtres, plinthes), une peinture neuve ou un revêtement plastique peuvent être appliqués après nettoyage et préparation soignés. Cette technique a une efficacité limitée dans le temps : si le revêtement de recouvrement se dégrade, l’exposition réapparaît.",
        "Le démontage avec remplacement est privilégié pour les éléments très dégradés ou difficiles à recouvrir. Les anciennes fenêtres à simple vitrage des immeubles haussmanniens sont par exemple souvent remplacées par des menuiseries neuves performantes thermiquement, ce qui élimine durablement le risque tout en améliorant le confort. Les portes en bois peuvent être remplacées par des portes neuves alvéolaires ou pleines. Cette technique a un coût supérieur mais offre une solution pérenne.",
        "Le décapage avec retrait est la technique la plus radicale et la plus complexe. Elle consiste à retirer entièrement la couche de peinture au plomb par voie chimique, thermique ou mécanique. Cette intervention génère des déchets dangereux qui doivent être traités en filière spécialisée. Les opérateurs doivent porter des EPI adaptés (masques FFP3, combinaisons étanches) et le chantier doit être confiné pour éviter la dispersion de poussières. Le décapage est réservé aux situations où le recouvrement n’est pas possible et où le démontage n’est pas envisageable.",
        "Les coûts varient considérablement selon la technique. Un recouvrement par peinture coûte 20 à 40 euros par mètre carré, un remplacement de menuiseries 600 à 1 500 euros par fenêtre, et un décapage avec retrait peut atteindre 80 à 200 euros par mètre carré. Pour un logement présentant de nombreuses unités dégradées, le budget total des travaux palliatifs peut représenter plusieurs milliers, voire dizaines de milliers d’euros.",
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières pour les travaux de mise en conformité',
      level: 2,
      paragraphs: [
        "Les travaux de traitement du plomb peuvent bénéficier de plusieurs dispositifs publics. L’Anah, dans le cadre du programme « Habiter Sain », finance les opérations de traitement de l’habitat indigne incluant la mise en conformité plomb. Les propriétaires modestes et très modestes peuvent obtenir une aide pouvant atteindre 50 à 70 % du coût des travaux, plafonnée à 30 000 euros. Cette aide est cumulable avec d’autres dispositifs et son octroi nécessite un audit préalable du logement.",
        "Pour les copropriétés, le programme « Plan initiative copropriétés » et certaines opérations programmées d’amélioration de l’habitat (OPAH) peuvent inclure des aides spécifiques au traitement du plomb dans les parties communes. Les conditions varient selon le département et la commune. Renseignez-vous auprès de votre ADIL ou de votre mairie pour identifier les dispositifs locaux mobilisables.",
        "Enfin, la TVA à taux réduit de 5,5 % s’applique automatiquement aux travaux de mise en conformité plomb dans les logements achevés depuis plus de deux ans. Cette TVA réduite, qui couvre matériaux et main-d’œuvre, représente une économie substantielle souvent oubliée. Elle se cumule avec l’ensemble des autres aides publiques sans condition de revenus.",
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur plomb',
      level: 2,
      paragraphs: [
        "Le choix du diagnostiqueur CREP doit s’appuyer sur trois critères principaux. La certification COFRAC selon la norme NF EN ISO/IEC 17024 est obligatoire et doit être à jour ; vérifiez la certification sur l’annuaire des diagnostiqueurs publié par le ministère. L’équipement doit comprendre un appareil XRF récent et certifié, de préférence avec un système d’enregistrement automatique des mesures pour limiter les risques d’erreur de saisie. L’expérience du diagnostiqueur dans des bâtiments similaires au vôtre, en particulier les immeubles haussmanniens et les maisons anciennes, est un gage de fiabilité.",
        "Demandez systématiquement un devis détaillé qui précise le nombre d’unités de diagnostic prévues, la méthode de mesure et le délai de remise du rapport. Comparez plusieurs devis sans céder à la tentation du moins-disant : un CREP réalisé en moins d’une heure sans mesure XRF sérieuse a une valeur juridique très limitée et expose le propriétaire à des recours en cas d’intoxication. Vérifiez également que le diagnostiqueur dispose d’une assurance responsabilité civile professionnelle spécifique au diagnostic immobilier avec une couverture d’au moins 300 000 euros.",
        "La rigueur du diagnostiqueur sur la traçabilité des mesures est un autre indicateur essentiel. Chaque unité de diagnostic doit être numérotée, photographiée et géolocalisée précisément dans le bien. L’appareil XRF doit être étalonné régulièrement (généralement tous les six mois) avec un certificat d’étalonnage qui peut être présenté sur demande. Un diagnostiqueur sérieux explique sa méthode et fournit un rapport détaillé qui permet à un confrère ou à un expert judiciaire de reproduire les mesures en cas de contestation. Cette traçabilité est précieuse pour défendre la validité du CREP en cas de litige post-vente.",
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        "Plusieurs situations nécessitent une attention particulière dans la réalisation du CREP. Les immeubles haussmanniens parisiens des années 1850-1920 sont les plus représentatifs des risques plomb, en raison de l’utilisation massive de céruses dans les peintures intérieures et extérieures de cette époque. Les boiseries (portes, fenêtres, plinthes, lambris), les murs (enduits et stuc peints), les ferronneries (rampes, grilles) et les façades extérieures concentrent les unités de diagnostic positives. Un CREP complet d’un appartement haussmannien peut compter jusqu’à 100 unités de diagnostic et nécessiter trois à quatre heures de mesures.",
        "Les maisons rurales anciennes (avant 1949) présentent une signature différente des immeubles parisiens. Les boiseries y sont souvent moins nombreuses mais peuvent contenir des couches de peinture au plomb appliquées en plusieurs vagues sur plusieurs décennies. Les volets extérieurs sont particulièrement à surveiller car ils combinent une forte exposition aux intempéries (donc dégradation rapide) et une accessibilité aux enfants. Les granges, dépendances et locaux annexes doivent être inspectés même s’ils ne sont pas occupés au moment de la vente.",
        "Les copropriétés mixtes avec parties privatives modernisées et parties communes d’origine présentent un cas typique. Les copropriétaires ont souvent rénové leurs appartements (peintures neuves, doublage des murs, remplacement des fenêtres) ce qui supprime ou recouvre les unités positives. Mais les parties communes (escaliers, paliers, hall d’entrée, façade) conservent généralement leurs revêtements d’origine. Le CREP des parties communes, à la charge du syndicat des copropriétaires, est alors crucial et révèle souvent des situations préoccupantes.",
        "Les biens en cours de rénovation soulèvent une difficulté particulière. Les peintures au plomb sont souvent visibles au cours des travaux (sous les anciennes couches), mais une fois recouvertes ou retirées, leur trace n’apparaît plus à la mesure XRF. Il est important de réaliser le CREP avant le démarrage des travaux, ou de documenter rigoureusement les zones où des couches au plomb ont été identifiées et traitées. À défaut, l’acquéreur ultérieur sera dans l’incapacité de savoir si des résidus subsistent dans le bien.",
        "Les logements occupés par des familles avec enfants en bas âge nécessitent une vigilance maximale. Le risque d’intoxication des enfants par ingestion d’écailles de peinture est avéré, particulièrement chez les 1-6 ans qui portent fréquemment les mains à la bouche. Le diagnostiqueur doit signaler immédiatement à l’ARS toute situation de cohabitation entre un revêtement dégradé positif et un enfant en bas âge. L’ARS peut diligenter une enquête sanitaire et imposer des mesures d’urgence (travaux palliatifs, voire relogement temporaire).",
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        "Une première erreur fréquente consiste à confondre CREP négatif et absence de plomb. Le CREP mesure la concentration en plomb des unités de diagnostic accessibles, mais ne couvre pas l’eau potable circulant dans les canalisations intérieures, ni les sols extérieurs, ni les poussières de plomb diffuses dans l’environnement urbain. Un CREP négatif signifie seulement que les revêtements peints du logement ne contiennent pas de plomb à une concentration mesurable, pas que le bien est exempt de tout risque d’exposition.",
        "Une deuxième erreur consiste à négliger la dégradation progressive des revêtements positifs. Un CREP réalisé il y a dix ans peut indiquer une situation conforme avec uniquement des unités positives en classe 2 (non dégradées). Mais ces revêtements ont pu se dégrader entre-temps sous l’effet de l’humidité, des chocs ou du temps. Pour les biens loués, la mise à jour du CREP à six ans est obligatoire et permet de détecter ces évolutions. Pour les biens occupés en propriété, une visite de contrôle tous les cinq à dix ans est recommandée.",
        "Une troisième erreur consiste à ne pas informer les locataires de la présence de plomb détectée. Lorsqu’un CREP révèle des unités positives, même non dégradées, le bailleur a l’obligation d’en informer le locataire et de lui remettre une notice d’information sur les bonnes pratiques de prévention (nettoyage humide régulier, surveillance des écaillages, etc.). Cette obligation d’information est opposable et son non-respect peut engager la responsabilité civile du bailleur en cas d’exposition.",
        "Une quatrième erreur consiste à entreprendre des travaux sur les revêtements positifs sans précautions adaptées. Le décapage thermique au chalumeau, le ponçage à sec ou le sablage des peintures au plomb génèrent des poussières et des vapeurs extrêmement toxiques qui se déposent durablement dans les locaux et exposent gravement les occupants et le voisinage. Ces techniques sont formellement interdites pour le traitement des peintures au plomb. Les seules méthodes autorisées sont l’encapsulage, le décapage chimique en milieu confiné par une entreprise spécialisée, ou le retrait complet de l’élément avec remplacement.",
        "Une cinquième erreur, fréquente chez les propriétaires-bailleurs, consiste à reporter indéfiniment les travaux palliatifs sur les unités dégradées au prétexte que le locataire actuel n’a pas d’enfants. Cette stratégie est très risquée : un nouveau locataire avec enfants peut s’installer du jour au lendemain, et la responsabilité du bailleur sera engagée si une intoxication survient. Pour les biens loués meublés saisonniers ou en location de courte durée, l’incertitude sur le profil des occupants impose une mise en conformité préventive systématique.",
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        "Le CREP est un diagnostic essentiel pour la protection sanitaire des occupants des logements anciens en France. Sa réalisation conditionne la légalité des transactions immobilières (vente, location) et permet d’identifier précocement les situations à risque pour engager des actions correctives adaptées. Le saturnisme infantile reste une priorité de santé publique en France, et le dispositif réglementaire du CREP est l’un des principaux outils de prévention pour les enfants vivant dans le parc bâti ancien.",
        "Le critère unique est la construction du bâtiment avant le 1ᵉʳ janvier 1949, date d’interdiction du plomb dans les peintures intérieures. Cette ancienneté concerne environ un tiers du parc immobilier français, principalement dans les centres-villes historiques et les départements urbanisés au XIXᵉ siècle. La date de référence est celle du permis de construire, peu importent les rénovations ultérieures. Pour les bâtiments mixtes (construction sur plusieurs périodes), seules les parties antérieures à 1949 sont concernées par le CREP.",
        "La validité du CREP varie considérablement selon le résultat. Un CREP négatif (absence totale de plomb) a une validité illimitée et n’a jamais besoin d’être renouvelé pour le bien. Un CREP positif (présence de plomb détectée) a une validité de 1 an pour les ventes et 6 ans pour les locations. Cette différenciation traduit la nécessité de réévaluer périodiquement l’état des revêtements positifs, qui peuvent se dégrader avec le temps et exposer les occupants à des poussières et des écailles toxiques.",
        "Le coût d’un CREP varie de 90 à 400 euros selon le type de bien et le nombre d’unités de diagnostic. Les copropriétés doivent également supporter le coût du CREP des parties communes (400 à 1 200 euros) à la charge du syndicat des copropriétaires. Les travaux palliatifs en cas de présence de plomb peuvent varier de quelques centaines d’euros (recouvrement par peinture) à plusieurs dizaines de milliers d’euros (décapage complet avec retrait des couches au plomb). Les aides Anah peuvent couvrir 50 à 70 % du coût pour les propriétaires modestes.",
        "Les techniques de traitement (recouvrement, démontage avec remplacement, décapage avec retrait) doivent être adaptées à la nature de l’unité, à son état et à la valeur patrimoniale de l’élément. Les techniques abrasives (ponçage à sec, sablage, décapage thermique au chalumeau) sont formellement interdites pour les peintures au plomb en raison du risque de dispersion massive des poussières toxiques. Seules les techniques agréées (encapsulage, décapage chimique en milieu confiné, retrait complet par entreprise spécialisée) sont autorisées.",
        "Le choix du diagnostiqueur doit privilégier la certification COFRAC à jour, un équipement XRF récent et étalonné, et une expérience dans des bâtiments similaires au vôtre. La rigueur sur la traçabilité des mesures (numérotation, photographies, géolocalisation des unités, plans cotés) est un indicateur clé de qualité. Pour les biens à risque particulier (logements occupés par des enfants en bas âge, immeubles haussmanniens, bâtiments en cours de rénovation), un investissement supplémentaire dans la qualité du diagnostic et dans des analyses complémentaires (eau du robinet par exemple) est largement justifié.",
        "L’information des locataires et des occupants est un volet essentiel souvent négligé. Le bailleur doit non seulement remettre le CREP à la signature du bail, mais également informer activement le locataire des consignes de prévention en cas de présence de plomb détectée. Cette obligation d’information est opposable et son non-respect peut engager la responsabilité civile du bailleur, particulièrement en cas d’intoxication d’un enfant. Pour les biens loués meublés saisonniers ou en location de courte durée, l’incertitude sur le profil des occupants (présence éventuelle d’enfants en bas âge) impose une mise en conformité préventive systématique, même pour les unités positives non encore dégradées.",
        "La coordination avec les autres acteurs sanitaires (Agence régionale de santé, services communaux d’hygiène et de santé, protection maternelle et infantile) renforce l’efficacité du dispositif. En cas de doute sur l’exposition d’un enfant, une plombémie peut être réalisée gratuitement sur prescription médicale. Une plombémie supérieure à 50 µg/L chez un enfant déclenche une enquête sanitaire de l’ARS qui peut imposer des mesures correctives immédiates dans le logement, y compris un éventuel relogement temporaire pendant les travaux. La prévention reste toutefois la stratégie la plus efficace et la moins traumatisante pour les familles.",
      ],
    },
  ],
  faq: [
    {
      question: 'Quels logements sont concernés par le CREP ?',
      answer:
        "Tout immeuble d’habitation construit avant le 1ᵉʳ janvier 1949, date d’interdiction du plomb dans les peintures intérieures en France.",
    },
    {
      question: 'Quelle est la durée de validité d’un CREP ?',
      answer:
        "Validité illimitée si le CREP est négatif (absence de plomb), 1 an pour une vente et 6 ans pour une location si le CREP est positif.",
    },
    {
      question: 'Quel est le seuil réglementaire de plomb ?',
      answer:
        "Le seuil réglementaire est de 1 milligramme par centimètre carré. Au-delà de ce seuil, l’unité de diagnostic est classée comme positive.",
    },
    {
      question: 'Le CREP est-il obligatoire pour une location ?',
      answer:
        "Oui, le bailleur d’un logement antérieur à 1949 doit fournir au locataire un CREP de moins de 6 ans (si positif) à la signature du bail. Si le CREP est négatif, sa validité est illimitée.",
    },
    {
      question: 'Combien coûte un CREP ?',
      answer:
        "Entre 90 et 200 euros TTC pour un appartement et 250 à 400 euros pour une maison individuelle. Le CREP des parties communes d’une copropriété coûte entre 400 et 1 200 euros.",
    },
    {
      question: 'Que faire si du plomb est détecté dans mon logement ?',
      answer:
        "Pour les unités à l’état d’usage, surveillez l’apparition de dégradations. Pour les unités dégradées, engagez sans délai des travaux palliatifs (recouvrement, remplacement ou décapage) par un professionnel qualifié.",
    },
    {
      question: 'Quels sont les risques sanitaires du plomb ?',
      answer:
        "L’exposition au plomb provoque le saturnisme, particulièrement grave chez les jeunes enfants : troubles cognitifs irréversibles, retards de croissance, troubles du comportement, voire encéphalopathies dans les formes sévères.",
    },
    {
      question: 'Qui est responsable du CREP en copropriété ?',
      answer:
        "Le propriétaire de chaque lot est responsable du CREP de ses parties privatives. Le syndicat des copropriétaires, via le syndic, est responsable du CREP des parties communes.",
    },
    {
      question: 'Comment se déroule la mesure XRF ?',
      answer:
        "L’appareil XRF projette des rayons X sur le revêtement et analyse les rayonnements de fluorescence en retour. La mesure est non destructive, prend quelques secondes et donne un résultat instantané en mg/cm².",
    },
    {
      question: 'Le CREP est-il obligatoire pour un logement loué meublé ?',
      answer:
        "Oui, le CREP est obligatoire pour toute location, qu’elle soit vide ou meublée, dès lors que le logement est antérieur à 1949.",
    },
    {
      question: 'Que se passe-t-il si je ne fais pas de CREP ?',
      answer:
        "L’absence de CREP à la vente ou à la location expose le propriétaire à des recours en garantie des vices cachés, à la révision du prix de vente, voire à l’annulation de la transaction et à des sanctions pénales en cas d’intoxication d’un occupant.",
    },
    {
      question: 'Peut-on faire un CREP soi-même ?',
      answer:
        "Non, seul un diagnostiqueur certifié par un organisme accrédité COFRAC peut réaliser un CREP opposable. Les autodiagnostics avec kits du commerce n’ont aucune valeur juridique.",
    },
    {
      question: 'Combien de temps faut-il pour réaliser un CREP ?',
      answer:
        "Entre 1h et 3h selon la surface du logement et le nombre d’unités de diagnostic à mesurer. Le rapport est généralement remis sous 48 à 72 heures.",
    },
    {
      question: 'Le plomb peut-il être présent dans l’eau du robinet ?',
      answer:
        "Oui, les canalisations en plomb des réseaux intérieurs des logements antérieurs à 1995 peuvent libérer du plomb dans l’eau. Une analyse complémentaire est recommandée par l’ANSES pour ces logements.",
    },
    {
      question: 'Faut-il refaire un CREP après des travaux ?',
      answer:
        "Oui, si les travaux ont concerné des unités de diagnostic positives, un nouveau CREP est recommandé pour confirmer l’efficacité du traitement et lever définitivement le risque.",
    },
  ],
}
