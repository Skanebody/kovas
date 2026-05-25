/**
 * Guide long — DPE (Diagnostic de Performance Énergétique).
 *
 * Sources : article L126-26 du Code de la construction et de l'habitation,
 * décret 2020-1610, arrêté du 31 mars 2021 (méthode 3CL-2021),
 * loi Climat et Résilience 2021, Service-public.fr, ADEME observatoire DPE.
 *
 * Dernière révision réglementaire intégrée : 22 mai 2026.
 */

import type { Guide } from '../types'

export const DPE_GUIDE: Guide = {
  type: 'dpe',
  slug: 'dpe',
  shortTitle: 'DPE',
  title: 'Diagnostic de performance énergétique (DPE) : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout ce qu’il faut savoir sur le DPE : obligation, méthode 3CL-2021, classes A à G, validité, audit énergétique et travaux d’amélioration.',
  metaDescription:
    'DPE 2026 : obligation, méthode 3CL-2021, classes énergétiques, validité 10 ans, prix moyen, travaux, aides MaPrimeRénov. Guide complet par KOVAS.',
  teaser:
    'Méthode 3CL-2021, classes A à G, calendrier passoires thermiques, prix, validité et travaux.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 27,
  wordCount: 5400,
  relatedTypes: ['audit-energetique', 'amiante', 'electricite', 'erp'],
  sections: [
    {
      id: 'qu-est-ce-que-le-dpe',
      title: 'Qu’est-ce que le DPE et à quoi sert-il',
      level: 2,
      paragraphs: [
        'Le diagnostic de performance énergétique, plus connu sous l’acronyme DPE, est un document réglementaire qui évalue à la fois la consommation d’énergie primaire d’un logement et son impact sur le climat en équivalent kilogrammes de CO₂. Son cadre légal est défini par l’article L126-26 du Code de la construction et de l’habitation, complété par les articles R126-15 à R126-29 du même code et par l’arrêté du 31 mars 2021 qui a profondément refondu la méthode de calcul.',
        'Pour le propriétaire vendeur ou bailleur, le DPE n’est pas un simple papier administratif. C’est une pièce contractuelle obligatoire, opposable juridiquement depuis le 1ᵉʳ juillet 2021, qui doit figurer dans le dossier de diagnostic technique remis à l’acquéreur lors de la promesse de vente ou au locataire avant la signature du bail. Sa mention est également exigée dans toute annonce de vente ou de location, qu’elle soit publiée par un particulier, un notaire ou une agence immobilière, sur Internet comme en agence physique.',
        'Le DPE remplit trois fonctions principales. La première est informative : il permet à l’acquéreur ou au locataire de connaître la performance énergétique du bien avant son engagement, c’est-à-dire la facture d’énergie annuelle à laquelle il doit s’attendre. La deuxième fonction est prescriptive : depuis 2021, le DPE comprend obligatoirement des recommandations de travaux hiérarchisées et un bouquet de scénarios pour atteindre la classe B. La troisième est réglementaire : il conditionne désormais le droit de louer un bien et déclenche, pour les logements F et G, l’obligation d’un audit énergétique réglementaire lors d’une mise en vente.',
        'Concrètement, le DPE attribue au logement deux étiquettes distinctes. L’étiquette énergie classe le bien de A à G selon sa consommation annuelle d’énergie primaire exprimée en kWh par mètre carré et par an. L’étiquette climat reprend la même échelle mais mesure les émissions de gaz à effet de serre en kilogrammes équivalent CO₂. C’est la plus défavorable des deux étiquettes qui détermine la classe finale du logement, ce qui pénalise particulièrement les logements anciens chauffés au fioul ou à l’électricité ancienne génération.',
        'Le DPE concerne tous les logements d’habitation : maisons individuelles, appartements en copropriété, logements meublés, résidences principales et secondaires. Certaines catégories de bâtiments restent toutefois dispensées, notamment les constructions provisoires occupées moins de deux ans, les bâtiments indépendants de moins de 50 m², les bâtiments à usage agricole, artisanal ou industriel sans système de chauffage permanent, les monuments historiques classés ou inscrits, et les lieux de culte. Pour les biens mis en location saisonnière, le DPE n’est pas exigé tant que la durée cumulée de location dans l’année reste inférieure à quatre mois.',
      ],
    },
    {
      id: 'quand-le-dpe-est-il-obligatoire',
      title: 'Quand le DPE est-il obligatoire',
      level: 2,
      paragraphs: [
        'Le DPE doit obligatoirement être réalisé dans quatre cas de figure principaux. Lors d’une mise en vente, il doit être tenu à disposition de tout acquéreur potentiel dès la mise en ligne de l’annonce, puis remis intégralement au compromis de vente et figurer dans le dossier de diagnostic technique annexé à l’acte authentique chez le notaire. Lors d’une mise en location, le DPE est obligatoire à la signature du bail et son étiquette doit apparaître dans toute annonce, y compris pour les renouvellements de bail conclus depuis le 1ᵉʳ janvier 2022.',
        'Pour les bâtiments neufs, un DPE neuf est obligatoirement réalisé à la livraison du logement. Il est produit à partir des caractéristiques techniques du bâtiment telles qu’elles figurent dans l’étude thermique RT 2012 ou RE 2020 et fait partie des documents que le promoteur doit remettre au premier acquéreur. Enfin, depuis le 1ᵉʳ janvier 2024 pour les copropriétés de plus de 200 lots et depuis le 1ᵉʳ janvier 2026 pour toutes les copropriétés à usage principal d’habitation, un DPE collectif doit être réalisé à l’échelle de l’immeuble entier et renouvelé tous les dix ans.',
        'Le DPE collectif a vocation à se substituer aux DPE individuels pour les logements qui en sont dépourvus, à condition qu’il ait été établi selon la méthode 3CL-2021 et qu’il intègre une étiquette individualisée par lot. Cette possibilité concerne en pratique les immeubles équipés d’un chauffage collectif et facilite considérablement la mise en conformité des bailleurs qui n’avaient pas commandé de DPE individuel récent. Le syndic de copropriété est responsable de la commande du DPE collectif et inscrit sa réalisation à l’ordre du jour de l’assemblée générale.',
      ],
      callout: {
        type: 'warning',
        text: 'Depuis le 1ᵉʳ janvier 2025, il est interdit de mettre en location un logement classé G au DPE. À partir du 1ᵉʳ janvier 2028, l’interdiction s’étendra aux logements classés F, puis aux classes E au 1ᵉʳ janvier 2034. Ces interdictions s’appliquent aux nouveaux baux et aux renouvellements, mais pas aux baux en cours conclus avant ces dates tant qu’ils ne sont pas reconduits.',
      },
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les nouvelles règles 2026',
      level: 2,
      paragraphs: [
        'L’année 2026 marque une étape majeure dans la généralisation du DPE collectif. Depuis le 1ᵉʳ janvier 2026, toutes les copropriétés à usage principal d’habitation, quelle que soit leur taille, doivent disposer d’un DPE collectif valide. Cette obligation s’ajoute à celle déjà en vigueur pour les copropriétés de plus de 200 lots depuis le 1ᵉʳ janvier 2024 et pour celles entre 50 et 200 lots depuis le 1ᵉʳ janvier 2025. Le coût moyen d’un DPE collectif se situe entre 1 000 et 5 000 euros selon la taille de la copropriété, à la charge du syndicat des copropriétaires.',
        'Le calendrier d’interdiction de location des passoires thermiques continue de produire ses effets. Au 1ᵉʳ janvier 2025, les logements classés G sont déjà sortis du marché locatif neuf. Le seuil suivant est fixé au 1ᵉʳ janvier 2028 pour les logements F, puis au 1ᵉʳ janvier 2034 pour les logements E. Cette trajectoire, prévue par la loi Climat et Résilience du 22 août 2021, vise un parc locatif majoritairement classé D à l’horizon 2034 et exclusivement A, B ou C à l’horizon 2050.',
        'Une réforme méthodologique importante est entrée en vigueur le 1ᵉʳ juillet 2024 pour corriger une anomalie qui pénalisait les petites surfaces. Avant cette date, un studio chauffé à l’électricité affichait souvent une classe énergétique deux à trois niveaux inférieure à celle d’un grand appartement comparable, en raison du poids relatif de l’eau chaude sanitaire et des consommations de base. Depuis juillet 2024, un coefficient correcteur s’applique aux logements de moins de 40 m², ce qui a fait remonter d’environ 140 000 logements en classe acceptable selon les estimations de l’Observatoire DPE de l’ADEME.',
        'Pour les logements F et G mis en vente, un audit énergétique réglementaire distinct du DPE est obligatoire depuis le 1ᵉʳ avril 2023. Cette obligation s’étend aux logements E depuis le 1ᵉʳ janvier 2025 et concernera les logements D à partir du 1ᵉʳ janvier 2034. L’audit, réalisé par un professionnel certifié distinct du diagnostiqueur DPE, propose au minimum deux scénarios de travaux permettant d’atteindre respectivement la classe C et la classe B, avec un chiffrage détaillé.',
        'Un autre changement structurant concerne la durée de conservation des DPE par le diagnostiqueur. Depuis 2021, chaque diagnostic est transmis à l’ADEME dans une base nationale qui attribue un numéro unique à 13 caractères. Ce numéro doit obligatoirement figurer sur le rapport remis au client et permet à n’importe qui de vérifier l’authenticité du DPE en consultant l’observatoire public. Un DPE qui ne comporte pas ce numéro est de plein droit inopposable.',
        'Enfin, plusieurs ajustements concernent la prise en compte des énergies renouvelables. Depuis 2024, l’autoconsommation photovoltaïque est mieux valorisée dans le calcul, à condition que le système soit déclaré et que la production annuelle soit justifiée. Les pompes à chaleur air-eau et géothermiques bénéficient également d’un coefficient de performance saisonnier actualisé. Ces évolutions permettent à des logements bien rénovés de gagner une à deux classes par rapport à un DPE réalisé avant 2024.',
      ],
      bullets: [
        'DPE collectif obligatoire pour toutes les copropriétés depuis le 1ᵉʳ janvier 2026',
        'Interdiction de louer un logement G en vigueur depuis le 1ᵉʳ janvier 2025',
        'Coefficient correcteur petites surfaces appliqué depuis juillet 2024',
        'Audit énergétique obligatoire à la vente pour F, G, et E depuis 2025',
        'Numéro ADEME à 13 caractères obligatoire sur tout DPE',
        'Meilleure valorisation des énergies renouvelables dans la méthode 3CL-2021',
      ],
    },
    {
      id: 'deroulement-du-diagnostic',
      title: 'Comment se déroule un diagnostic DPE',
      level: 2,
      paragraphs: [
        'Un DPE typique dure entre une heure et trois heures sur place selon la surface et la complexité du logement. Le diagnostiqueur, certifié par un organisme accrédité par le COFRAC, commence systématiquement par une phase administrative : vérification de l’identité du propriétaire ou du mandataire, collecte de la matrice cadastrale, du règlement de copropriété pour les appartements, et de l’ensemble des documents techniques disponibles tels que factures d’énergie, attestation RT 2012, plans, ancienne attestation thermique ou rapport de chaudière.',
        'Sur le terrain, le diagnostiqueur procède à un relevé exhaustif de toutes les caractéristiques physiques et énergétiques du bien. Il mesure les surfaces habitables, repère l’orientation des baies vitrées, identifie la nature et l’épaisseur des matériaux d’isolation lorsque celle-ci est accessible, inventorie tous les systèmes de chauffage, d’eau chaude sanitaire, de ventilation et de climatisation. Pour chacun de ces équipements, il consigne la marque, la puissance, l’année de mise en service et l’état général. Il photographie les éléments visibles et les plaques signalétiques.',
        'La méthode 3CL-2021 utilisée depuis le 1ᵉʳ juillet 2021 a définitivement remplacé l’ancienne méthode dite « sur factures » qui était jugée trop imprécise et trop dépendante du comportement de l’occupant. La méthode 3CL est dite « conventionnelle » car elle calcule la consommation théorique du logement à partir d’hypothèses standardisées : un occupant moyen, un climat moyen de la zone climatique, des consignes de température fixées par arrêté. Ce calcul élimine les biais comportementaux mais peut surprendre certains propriétaires dont les factures réelles sont sensiblement différentes.',
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Prise de rendez-vous et collecte documentaire',
          text: 'Le diagnostiqueur recueille en amont les éléments administratifs : titre de propriété, plans, factures énergétiques, attestation RT 2012 ou RE 2020 pour le neuf, anciens diagnostics et rapport d’entretien de la chaudière.',
        },
        {
          position: 2,
          name: 'Visite technique sur place',
          text: 'Le professionnel mesure les surfaces, identifie les matériaux et l’isolation, relève tous les équipements de chauffage, d’eau chaude sanitaire, de ventilation et de climatisation, et prend des photographies des plaques signalétiques.',
        },
        {
          position: 3,
          name: 'Saisie et calcul 3CL-2021',
          text: 'Les données sont saisies dans un logiciel agréé par l’ADEME. La méthode 3CL-2021 calcule la consommation conventionnelle en énergie primaire et les émissions de CO₂ équivalent à partir d’hypothèses standardisées.',
        },
        {
          position: 4,
          name: 'Génération du rapport',
          text: 'Le rapport contient les étiquettes énergie et climat, le détail des consommations par poste, les recommandations de travaux hiérarchisées et au moins un scénario chiffré pour atteindre la classe B.',
        },
        {
          position: 5,
          name: 'Transmission à l’ADEME et au client',
          text: 'Le diagnostic est transmis à l’observatoire DPE de l’ADEME qui attribue un numéro unique à 13 caractères. Ce numéro figure sur le rapport remis au propriétaire et permet la vérification publique de l’authenticité.',
        },
      ],
    },
    {
      id: 'prix-d-un-dpe',
      title: 'Combien coûte un DPE en France',
      level: 2,
      paragraphs: [
        'Le tarif d’un DPE n’est pas réglementé par les pouvoirs publics, ce qui se traduit par une grande variabilité des prix sur le territoire. Selon les relevés effectués par les fédérations professionnelles et par la Direction générale de la concurrence, de la consommation et de la répression des fraudes, le prix moyen constaté en 2026 oscille entre 100 et 250 euros toutes taxes comprises pour un appartement, et entre 130 et 300 euros pour une maison individuelle. Les prestations groupant plusieurs diagnostics dans un même pack permettent de réduire le coût unitaire de 20 à 40 pour cent.',
        'Plusieurs facteurs expliquent les écarts de prix observés. La surface du bien intervient en premier lieu : un T2 de 45 m² sera facturé environ 120 euros tandis qu’un T5 de 130 m² peut atteindre 220 euros. La zone géographique compte également, les diagnostics réalisés en Île-de-France, en Provence-Alpes-Côte d’Azur et en Auvergne-Rhône-Alpes étant en moyenne 15 à 25 pour cent plus chers qu’en zone rurale. Enfin, le délai d’intervention demandé influe sur le tarif : une intervention en urgence sous 48 heures peut faire l’objet d’une majoration.',
        'Il est fortement déconseillé de choisir le diagnostiqueur uniquement sur le critère du prix le plus bas. Un DPE bâclé en moins d’une heure, sans relevé sérieux des surfaces ni inventaire détaillé des équipements, expose le vendeur à un risque juridique majeur. Depuis 2021, l’opposabilité du DPE permet à un acquéreur déçu de demander en justice la révision du prix de vente, le remboursement d’une partie du prix, voire l’annulation pure et simple de la transaction si la classe énergétique réelle s’avère sensiblement éloignée de celle annoncée.',
      ],
      bullets: [
        'DPE appartement : 100 à 250 € TTC',
        'DPE maison individuelle : 130 à 300 € TTC',
        'DPE collectif copropriété : 1 000 à 5 000 € TTC',
        'Pack DPE + diagnostics obligatoires vente : 350 à 600 € TTC',
        'Audit énergétique réglementaire F/G/E : 500 à 1 200 € TTC',
      ],
    },
    {
      id: 'comprendre-le-rapport-dpe',
      title: 'Comment lire le résultat et le rapport',
      level: 2,
      paragraphs: [
        'Le rapport DPE depuis 2021 comprend systématiquement les mêmes huit grandes parties dont la structure est fixée par l’arrêté du 31 mars 2021. La première page affiche l’étiquette énergie et l’étiquette climat sous forme graphique avec la classe finale du logement, qui correspond à la moins favorable des deux. Le numéro à 13 caractères attribué par l’ADEME, la date de réalisation et la date d’expiration figurent obligatoirement en en-tête.',
        'Les pages suivantes détaillent la consommation théorique en énergie finale et en énergie primaire, ventilée par poste : chauffage, eau chaude sanitaire, refroidissement, auxiliaires et éclairage. Cette ventilation permet d’identifier le ou les postes les plus énergivores et de prioriser les travaux. Une estimation de la facture annuelle pour des prix d’énergie de référence fixés par arrêté est également indiquée, ce qui donne à l’acquéreur ou au locataire une vision concrète des dépenses prévisibles.',
        'Le rapport intègre obligatoirement une fiche descriptive complète du logement, qui répertorie l’ensemble des données d’entrée : surface habitable, période de construction, type de bâtiment, orientation, ponts thermiques, nature et performance de l’enveloppe, équipements de chauffage et d’eau chaude sanitaire, ventilation, énergies renouvelables. Cette fiche est précieuse en cas de contestation, car elle permet de comparer les hypothèses du calcul aux caractéristiques réelles du bâtiment.',
        'Les recommandations de travaux sont présentées dans une section dédiée. Elles sont hiérarchisées du plus rentable au moins rentable et incluent au minimum un bouquet de travaux permettant d’atteindre la classe B, avec un coût estimatif et une économie d’énergie attendue. Pour chaque action recommandée, le rapport indique également les aides financières mobilisables, les certifications professionnelles requises et les ordres de grandeur de travaux. Cette section est notamment essentielle pour les vendeurs de logements F ou G qui doivent fournir un audit énergétique distinct.',
      ],
    },
    {
      id: 'travaux-pour-ameliorer-le-dpe',
      title: 'Quels travaux pour améliorer le résultat',
      level: 2,
      paragraphs: [
        'Améliorer la classe énergétique d’un logement passe par une logique d’intervention coordonnée. Les diagnostiqueurs et les bureaux d’études thermiques recommandent unanimement de commencer par l’enveloppe du bâtiment avant de s’attaquer aux équipements. Isoler les combles et la toiture est généralement le premier poste à traiter : c’est le plus rentable, avec un retour sur investissement de cinq à huit ans, et il s’agit du gisement d’économies le plus important dans un logement ancien, puisque jusqu’à 30 pour cent des déperditions thermiques s’y concentrent.',
        'Vient ensuite l’isolation des murs, qui représente environ 25 pour cent des déperditions. Deux techniques principales s’offrent au propriétaire : l’isolation par l’extérieur, plus performante car elle traite efficacement les ponts thermiques, et l’isolation par l’intérieur, moins onéreuse mais qui réduit la surface habitable. Le choix dépend largement de l’aspect architectural du bâtiment, du type de copropriété et du budget disponible. Un mur correctement isolé permet de gagner souvent une classe entière au DPE.',
        'Le remplacement des menuiseries simple vitrage par du double ou triple vitrage à haute performance vient compléter l’enveloppe. Les fenêtres représentent à elles seules 10 à 15 pour cent des déperditions et leur remplacement améliore également le confort acoustique et la sécurité. Pour bénéficier des aides publiques, les menuiseries installées doivent répondre à des seuils de performance précis, notamment un coefficient Uw inférieur ou égal à 1,3 W/m²·K.',
        'Après le traitement de l’enveloppe, le remplacement du système de chauffage devient particulièrement rentable. Le passage d’une chaudière fioul ou d’une vieille chaudière gaz vers une pompe à chaleur air-eau de classe A++ permet de diviser par trois la consommation d’énergie primaire et d’améliorer significativement les deux étiquettes. Les pompes à chaleur géothermiques offrent des performances encore supérieures mais nécessitent un terrain disponible et un investissement initial plus élevé.',
        'Pour l’eau chaude sanitaire, l’installation d’un chauffe-eau thermodynamique en remplacement d’un ballon électrique classique divise la consommation par trois à quatre. Cette intervention, relativement peu coûteuse comparée aux travaux d’enveloppe, est souvent réalisée en complément lorsque l’on installe une pompe à chaleur. Enfin, la pose d’une ventilation mécanique contrôlée double flux dans les rénovations performantes permet de récupérer jusqu’à 90 pour cent de la chaleur de l’air extrait.',
        'Sur des logements de petite taille ou bien isolés, une approche modulaire peut également porter ses fruits. L’installation de robinets thermostatiques sur tous les radiateurs, le calorifugeage des canalisations dans les locaux non chauffés, le réglage et le désembouage de l’installation hydraulique apportent quelques pour cent d’économies et peuvent suffire à faire basculer un logement de classe D vers classe C lorsque le bouquet précédent est déjà bien engagé.',
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières disponibles',
      level: 2,
      paragraphs: [
        'Plusieurs dispositifs publics permettent de financer les travaux d’amélioration énergétique. MaPrimeRénov’ est l’aide phare distribuée par l’Anah. Elle s’adresse à tous les propriétaires occupants et bailleurs sans condition de plafond depuis 2020 et concerne aussi les copropriétés via le dispositif MaPrimeRénov’ Copropriétés. Le montant accordé dépend des revenus du foyer, classés en quatre catégories (très modestes, modestes, intermédiaires, supérieures), et de la nature des travaux entrepris. Une rénovation globale permettant de gagner au minimum deux classes peut être subventionnée jusqu’à 70 000 euros pour les ménages les plus modestes.',
        'Les certificats d’économies d’énergie, dits CEE, constituent le second pilier du financement. Versés par les fournisseurs d’énergie obligés (EDF, Engie, TotalEnergies, etc.), ils sont mobilisables pour l’isolation, le chauffage performant, la ventilation et la régulation. Ils se cumulent avec MaPrimeRénov’ et peuvent réduire la facture finale de 10 à 30 pour cent supplémentaires. Le « coup de pouce chauffage » majore les CEE pour les remplacements de chaudières fioul et gaz par des équipements à énergie renouvelable.',
        'L’éco-prêt à taux zéro, appelé éco-PTZ, finance jusqu’à 50 000 euros de travaux sur une durée de remboursement de 20 ans sans intérêts. Il est accessible sans condition de ressources et peut financer aussi bien des actions isolées que des rénovations globales. Pour les rénovations dites « performantes » permettant d’atteindre la classe B ou de gagner au minimum deux classes, le plafond a été relevé à 50 000 euros depuis 2022.',
        'Enfin, la TVA à taux réduit de 5,5 pour cent s’applique automatiquement à l’ensemble des travaux d’amélioration de la performance énergétique réalisés par un professionnel dans un logement achevé depuis plus de deux ans. Cette TVA réduite s’applique aussi bien aux matériaux qu’à la main-d’œuvre et constitue une économie souvent oubliée mais substantielle pour les ménages dont les revenus ne leur ouvrent pas droit à MaPrimeRénov’.',
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur certifié',
      level: 2,
      paragraphs: [
        'Pour réaliser un DPE valide, le diagnostiqueur doit être certifié par un organisme accrédité par le COFRAC. Cinq organismes principaux délivrent cette certification en France : Bureau Veritas Certification, Dekra Certification, ICert, Qualixpert et Socotec Certification France. La certification est délivrée pour cinq ans et fait l’objet d’une surveillance annuelle. Depuis le 1ᵉʳ janvier 2024, deux niveaux de certification existent : un niveau de base pour la plupart des logements et un niveau avec mention pour les bâtiments complexes (immeubles de grande hauteur, locaux tertiaires).',
        'Avant de signer un devis, il est recommandé de vérifier trois éléments. Le certificat de compétence du diagnostiqueur doit être à jour et téléchargeable sur le site de l’annuaire national des diagnostiqueurs. L’attestation d’assurance responsabilité civile professionnelle doit comporter une couverture spécifique au métier de diagnostiqueur immobilier et une garantie d’au moins 300 000 euros par sinistre. L’indépendance du professionnel doit être attestée : la loi interdit à un diagnostiqueur d’avoir un quelconque lien financier ou commercial avec une entreprise de travaux susceptible d’intervenir sur les recommandations du DPE.',
        'La transparence sur la méthode de travail est un autre indicateur de sérieux. Demandez au diagnostiqueur de vous expliquer en amont la procédure qu’il suivra : durée prévue sur place, documents qu’il devra examiner, photographies à prévoir, équipements de mesure utilisés. Un professionnel sérieux prend systématiquement un télémètre laser de précision, un appareil photo pour les plaques signalétiques, et un logiciel agréé ADEME synchronisé en temps réel avec l’observatoire DPE. Une visite expédiée en moins d’une heure pour un appartement de plus de 60 mètres carrés doit éveiller votre vigilance.',
        'Méfiez-vous également des offres « DPE en 24 heures » à prix cassé que l’on trouve parfois en ligne. Ces prestations sont souvent réalisées sans réelle inspection physique, à partir des seules informations cadastrales et des déclarations du propriétaire. Elles aboutissent à des classes énergétiques fantaisistes que la première contestation par un acquéreur fait s’effondrer. La crédibilité du diagnostiqueur tient à la rigueur de la collecte des données et à la traçabilité de sa méthode, pas à sa rapidité d’exécution.',
        'Demandez systématiquement plusieurs devis, comparez non seulement les prix mais aussi les délais d’intervention, les modalités de remise du rapport (numérique, papier, signature), et les services associés (explication du rapport, conseils sur les travaux à envisager, accompagnement post-vente). Une fois la prestation effectuée, conservez précieusement le rapport DPE dans vos archives. Ce document est un élément clé du dossier de diagnostic technique et peut être consulté plusieurs fois durant les dix années suivantes par les futurs acquéreurs ou locataires.',
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        'Certaines situations particulières nécessitent une attention spécifique pour la réalisation et l’interprétation du DPE. Les logements à usage mixte (habitation + activité professionnelle dans le même bâtiment) doivent faire l’objet d’un DPE distinct pour chaque partie si les surfaces et les usages sont clairement séparés. À défaut, le DPE doit prendre en compte l’ensemble des consommations en pondérant selon les surfaces et les usages. Cette situation concerne notamment les commerces avec logement de fonction, les professions libérales exerçant à domicile, et certaines maisons d’hôtes.',
        'Les logements alimentés en chauffage collectif posent une difficulté particulière car les consommations individuelles ne sont pas mesurables directement. Le diagnostiqueur calcule alors la consommation théorique sur la base de la quote-part de charges du copropriétaire dans le règlement de copropriété, ajustée par les caractéristiques propres du lot (orientation, exposition, surface). Cette méthode peut donner des résultats sensiblement différents de la consommation réelle, ce qui justifie l’intérêt du DPE collectif obligatoire depuis 2024-2026 qui donne une vision plus juste à l’échelle de l’immeuble.',
        'Pour les logements ayant fait l’objet de travaux de rénovation énergétique récents mais sans nouveau DPE, le propriétaire vendeur ou bailleur peut joindre les factures et attestations de conformité (RGE, MaPrimeRénov’) pour démontrer l’amélioration. Il est toutefois fortement recommandé de commander un DPE à jour qui prendra en compte les travaux et donnera une classe énergétique conforme à la réalité du bien après rénovation. L’ancien DPE peut être trompeur pour l’acquéreur et engager la responsabilité du vendeur en cas de divergence significative.',
        'Les biens classés monuments historiques ou inscrits à l’inventaire supplémentaire bénéficient d’un régime dérogatoire. Le DPE reste obligatoire mais le vendeur peut produire une attestation de l’architecte des bâtiments de France indiquant les contraintes patrimoniales qui empêchent d’atteindre certains seuils de performance. Cette attestation est précieuse pour la vente ou la location car elle limite les exigences de mise en conformité énergétique qui s’appliqueraient autrement au logement.',
        'Les studios et logements de très petite surface (moins de 30 mètres carrés) ont longtemps été pénalisés par la méthode 3CL-2021 en raison du poids relatif de l’eau chaude sanitaire et des consommations de base dans le total. Le coefficient correcteur introduit en juillet 2024 a partiellement corrigé ce biais, mais une vigilance demeure pour les studios chauffés à l’électricité par convecteurs anciens, qui restent souvent classés F ou G malgré des consommations absolues modestes en kWh. Pour ces logements, l’installation de radiateurs électriques à inertie sèche performants peut suffire à passer en classe E ou D, sans travaux d’enveloppe lourds.',
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        'Plusieurs erreurs récurrentes sont constatées dans la pratique du DPE et peuvent avoir des conséquences importantes pour le vendeur ou le bailleur. La première erreur fréquente concerne la sous-estimation des délais. Un DPE de qualité demande une à trois heures sur place, un délai de saisie de 24 à 48 heures, et la transmission à l’ADEME peut prendre jusqu’à deux à trois jours ouvrés. Anticiper la commande deux à trois semaines avant la mise en vente ou en location évite les ruptures de chaîne dans le processus.',
        'Une deuxième erreur consiste à choisir un diagnostiqueur uniquement sur le prix, sans vérifier sa certification ni son assurance. Les diagnostiqueurs « low cost » qui pratiquent des tarifs très inférieurs au marché compensent généralement par une dégradation de la qualité : visite raccourcie, données saisies sommairement, absence de photographies, rapport non vérifié. Or, depuis l’opposabilité du DPE en 2021, un rapport bâclé expose le vendeur à des risques juridiques importants. Un écart de 30 euros sur le prix du DPE peut se traduire par plusieurs milliers d’euros de litige post-vente.',
        'Une troisième erreur consiste à ne pas préparer la visite. Le diagnostiqueur a besoin d’accéder à toutes les pièces, y compris les combles, les caves, les locaux techniques et les annexes. Il doit pouvoir consulter les factures d’énergie des trois dernières années, les attestations de travaux récents, et les documents d’origine du bâtiment (permis de construire, étude thermique). Sans ces éléments, le diagnostiqueur est obligé de faire des hypothèses conservatrices qui dégradent la classe énergétique du bien. Préparer un dossier complet à l’avance améliore la précision du diagnostic et peut faire gagner une à deux classes.',
        'Une quatrième erreur consiste à ignorer les recommandations de travaux. Le DPE comprend systématiquement une section dédiée aux travaux d’amélioration énergétique, avec des estimations de coût et d’économies attendues. Pour le vendeur d’un bien classé F ou G, ces recommandations sont précieuses car elles permettent d’anticiper les arguments de négociation de l’acquéreur. Pour le propriétaire qui souhaite louer son bien à long terme, elles tracent une trajectoire de mise en conformité avant les interdictions progressives de location.',
        'Une cinquième erreur, particulièrement coûteuse, consiste à manipuler les données saisies pour obtenir artificiellement une classe meilleure. Surestimer l’épaisseur d’isolation, masquer un système de chauffage défaillant, déclarer une chaudière inexistante : ces pratiques engagent la responsabilité civile et pénale du propriétaire et du diagnostiqueur. Le DPE est désormais croisé avec les données ADEME et les déclarations fiscales, et les fraudes sont détectables. Les sanctions peuvent atteindre 15 000 euros d’amende et l’annulation pure et simple de la vente.',
      ],
    },
  ],
  faq: [
    {
      question: 'Combien de temps est valide un DPE ?',
      answer:
        'Un DPE réalisé selon la méthode 3CL-2021 est valide 10 ans. Les anciens DPE réalisés entre le 1ᵉʳ janvier 2013 et le 31 décembre 2017 sont caducs depuis le 1ᵉʳ janvier 2023, et ceux réalisés entre le 1ᵉʳ janvier 2018 et le 30 juin 2021 expirent au 31 décembre 2024.',
    },
    {
      question: 'Le DPE est-il opposable ?',
      answer:
        "Oui, depuis le 1ᵉʳ juillet 2021, le DPE est juridiquement opposable. L'acquéreur ou le locataire peut engager la responsabilité du vendeur ou du bailleur si la classe énergétique réelle s'écarte sensiblement de celle indiquée au DPE.",
    },
    {
      question: 'Qui doit payer le DPE en cas de vente ?',
      answer:
        "C'est le vendeur qui prend en charge le coût du DPE. Le tarif moyen se situe entre 100 et 250 euros TTC pour un appartement et entre 130 et 300 euros pour une maison individuelle.",
    },
    {
      question: 'Peut-on louer un logement classé G en 2026 ?',
      answer:
        "Non, depuis le 1ᵉʳ janvier 2025, il est interdit de mettre en location un logement classé G au DPE. L'interdiction s'étend aux logements F au 1ᵉʳ janvier 2028 et aux logements E au 1ᵉʳ janvier 2034.",
    },
    {
      question: 'Qu’est-ce que la méthode 3CL-2021 ?',
      answer:
        "La méthode 3CL-2021 (Calcul de Consommation Conventionnelle des Logements) est la méthode de calcul réglementaire du DPE en vigueur depuis le 1ᵉʳ juillet 2021. Elle évalue la consommation théorique d'un logement à partir de ses caractéristiques techniques et d'un usage standardisé.",
    },
    {
      question: 'Le DPE collectif remplace-t-il le DPE individuel ?',
      answer:
        "Oui, le DPE collectif réalisé selon la méthode 3CL-2021 et intégrant une étiquette individualisée par lot peut se substituer au DPE individuel pour les ventes et locations à l'intérieur de la copropriété.",
    },
    {
      question: 'Que faire si je ne suis pas d’accord avec mon DPE ?',
      answer:
        "Vous pouvez d'abord demander une explication détaillée au diagnostiqueur, voire un contre-diagnostic auprès d'un confrère. En cas de désaccord persistant, vous pouvez saisir la DGCCRF ou engager la responsabilité civile professionnelle du diagnostiqueur.",
    },
    {
      question: 'Le DPE est-il obligatoire pour une location saisonnière ?',
      answer:
        "Non, le DPE n'est pas exigé pour les locations saisonnières dont la durée cumulée annuelle reste inférieure à quatre mois. Pour les meublés de tourisme classés ou loués plus longtemps, le DPE redevient obligatoire.",
    },
    {
      question: 'Le DPE est-il obligatoire pour une vente en viager ?',
      answer:
        "Oui, toutes les ventes immobilières d'habitation sont soumises à l'obligation de DPE, y compris les ventes en viager occupé ou libre.",
    },
    {
      question: 'Audit énergétique et DPE : quelle différence ?',
      answer:
        "Le DPE évalue la performance énergétique actuelle d'un logement. L'audit énergétique, obligatoire à la vente pour les logements F, G et E, propose en plus des scénarios chiffrés de travaux permettant d'atteindre la classe C puis la classe B.",
    },
    {
      question: 'Comment vérifier l’authenticité d’un DPE ?',
      answer:
        "Le numéro à 13 caractères attribué par l'ADEME doit figurer sur le rapport. Il permet de consulter le DPE sur l'observatoire public de l'ADEME et de vérifier sa validité.",
    },
    {
      question: 'Quel est le coût d’un DPE pour un appartement T3 ?',
      answer:
        'Le prix moyen constaté pour un appartement T3 de 60 à 70 m² se situe entre 130 et 180 euros TTC. Les écarts dépendent de la zone géographique, du diagnostiqueur et des options choisies.',
    },
    {
      question: 'Peut-on faire un DPE soi-même ?',
      answer:
        "Non, seul un diagnostiqueur certifié par un organisme accrédité COFRAC peut réaliser un DPE opposable. Un autodiagnostic n'a aucune valeur juridique et ne peut être annexé à un acte de vente ou de location.",
    },
    {
      question: 'Le DPE blanc ou vierge existe-t-il encore ?',
      answer:
        'Non, les DPE blancs ou vierges, autorisés avant 2021 quand les données étaient insuffisantes, ont été supprimés. Tout DPE doit désormais aboutir à une classe énergétique.',
    },
    {
      question: 'Comment passer d’une classe G à une classe C ?',
      answer:
        "Un tel saut nécessite généralement un bouquet de travaux complet : isolation des combles et des murs, remplacement des menuiseries et du système de chauffage, installation d'une VMC. Le coût moyen se situe entre 30 000 et 70 000 euros, finançable en grande partie par MaPrimeRénov' et les CEE.",
    },
  ],
  sources: [
    {
      id: 1,
      title: 'Article L126-26 du Code de la construction et de l’habitation (DPE)',
      organization: 'Légifrance · République française',
      url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043978478',
      accessedAt: '2026-05-22',
    },
    {
      id: 2,
      title: 'Arrêté du 31 mars 2021 relatif au DPE et à l’affichage de la performance énergétique',
      organization: 'Légifrance · Journal officiel',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043372224',
      accessedAt: '2026-05-22',
    },
    {
      id: 3,
      title:
        'Loi n° 2021-1104 du 22 août 2021 portant lutte contre le dérèglement climatique (Climat & Résilience)',
      organization: 'Légifrance · Journal officiel',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043956924',
      accessedAt: '2026-05-22',
    },
    {
      id: 4,
      title:
        'Observatoire DPE-Audit : statistiques publiques sur les diagnostics de performance énergétique',
      organization: 'ADEME',
      url: 'https://observatoire-dpe-audit.ademe.fr/',
      accessedAt: '2026-05-22',
    },
    {
      id: 5,
      title:
        'Arrêté du 25 mars 2024 modifiant la méthode 3CL-2021 pour les logements de petite surface',
      organization: 'Légifrance · Journal officiel',
      url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049346257',
      accessedAt: '2026-05-22',
    },
    {
      id: 6,
      title: 'MaPrimeRénov’ : aide à la rénovation énergétique des logements',
      organization: 'Agence nationale de l’habitat (Anah)',
      url: 'https://www.anah.gouv.fr/proprietaires/proprietaires-occupants/maprimerenov',
      accessedAt: '2026-05-22',
    },
    {
      id: 7,
      title: 'Diagnostic de performance énergétique (DPE) — Fiche pratique officielle',
      organization: 'Service-public.fr · DILA',
      url: 'https://www.service-public.fr/particuliers/vosdroits/F16096',
      accessedAt: '2026-05-22',
    },
    {
      id: 8,
      title: 'Certificats d’économies d’énergie (CEE) — Dispositif & barèmes',
      organization:
        'Direction générale de l’énergie et du climat (DGEC) · Ministère de la Transition écologique',
      url: 'https://www.ecologie.gouv.fr/dispositif-des-certificats-deconomies-denergie',
      accessedAt: '2026-05-22',
    },
  ],
}
