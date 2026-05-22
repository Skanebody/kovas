/**
 * Guide long — Audit énergétique réglementaire.
 *
 * Sources : décret 2022-780 du 4 mai 2022, articles L126-28-1 et L271-4 du
 * Code de la construction et de l'habitation, arrêté du 4 mai 2022, loi
 * Climat et Résilience du 22 août 2021, ADEME, Anah, France Rénov'.
 */

import type { Guide } from '../types'

export const AUDIT_ENERGETIQUE_GUIDE: Guide = {
  type: 'audit-energetique',
  slug: 'audit-energetique',
  shortTitle: 'Audit énergétique',
  title: 'Audit énergétique réglementaire : guide complet 2026',
  category: 'audit',
  tagline:
    'Tout savoir sur l’audit énergétique obligatoire à la vente : décret 2022-780, calendrier F, G, E, D, deux scénarios chiffrés et aides financières.',
  metaDescription:
    'Audit énergétique 2026 : obligatoire vente F, G, E (D en 2034), décret 2022-780, scénarios travaux, prix, aides MaPrimeRénov. Guide KOVAS.',
  teaser:
    'Obligatoire à la vente F/G depuis 2023 et E depuis 2025, scénarios chiffrés et aides MaPrimeRénov.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 27,
  wordCount: 5350,
  relatedTypes: ['dpe', 'electricite', 'gaz', 'amiante'],
  sections: [
    {
      id: 'qu-est-ce-que-l-audit-energetique',
      title: 'Qu’est-ce que l’audit énergétique réglementaire',
      level: 2,
      paragraphs: [
        "L’audit énergétique réglementaire, instauré par la loi Climat et Résilience du 22 août 2021 et précisé par le décret 2022-780 du 4 mai 2022, est un diagnostic approfondi qui vise à proposer aux propriétaires de logements les plus consommateurs en énergie un parcours de rénovation chiffré et hiérarchisé. Il complète le diagnostic de performance énergétique (DPE) en allant beaucoup plus loin dans l’analyse et en proposant deux scénarios de travaux distincts permettant d’atteindre respectivement la classe C et la classe B au DPE.",
        "Contrairement au DPE qui se limite à une évaluation de la performance énergétique actuelle et à des recommandations indicatives, l’audit énergétique constitue une véritable étude de faisabilité technique et économique. Il intègre une analyse approfondie de l’enveloppe du bâtiment, des systèmes de chauffage, de ventilation et de production d’eau chaude sanitaire, et propose un plan de travaux détaillé avec des estimations de coûts, d’économies d’énergie attendues et d’aides financières mobilisables. Ce document constitue un véritable outil d’aide à la décision pour l’acquéreur d’un logement énergivore.",
        "L’audit énergétique réglementaire ne doit pas être confondu avec l’audit énergétique incitatif, qui est une démarche volontaire d’un propriétaire occupant en vue d’engager des travaux de rénovation. L’audit incitatif, soutenu par MaPrimeRénov’ Sérénité (ex Habiter Mieux Sérénité), suit un protocole similaire mais n’est pas obligatoire et ne s’inscrit pas dans le cadre d’une vente. Les deux documents partagent toutefois la même méthodologie de référence définie par l’arrêté du 4 mai 2022.",
        "L’objectif principal de l’audit énergétique réglementaire est de garantir une transparence renforcée sur le coût de la rénovation à venir des logements les plus énergivores. L’acquéreur d’un logement classé F au DPE, par exemple, sait dès l’étape du compromis qu’il devra engager des travaux à hauteur estimative de 30 000 à 70 000 euros pour atteindre la classe B et que ces travaux bénéficient potentiellement de 15 000 à 40 000 euros d’aides publiques. Cette information conditionne souvent le prix de vente et explique en partie la décote des passoires thermiques observée sur le marché depuis 2023.",
      ],
    },
    {
      id: 'quand-l-audit-est-il-obligatoire',
      title: 'Quand l’audit énergétique est-il obligatoire',
      level: 2,
      paragraphs: [
        "L’audit énergétique réglementaire est obligatoire à la vente pour les maisons individuelles et les bâtiments en monopropriété (entièrement détenus par un seul propriétaire) classés F ou G au DPE depuis le 1ᵉʳ avril 2023. Cette obligation s’étend aux logements classés E depuis le 1ᵉʳ janvier 2025 et s’étendra aux logements classés D à partir du 1ᵉʳ janvier 2034. Cette montée en puissance progressive accompagne le calendrier d’interdiction de location des passoires thermiques et vise à accélérer la rénovation du parc bâti.",
        "L’audit doit obligatoirement être remis à l’acquéreur lors de la première visite du bien (visite ayant donné lieu à compte rendu) et figurer dans le dossier de diagnostic technique annexé à la promesse de vente puis à l’acte authentique. Sa validité est de cinq ans à compter de sa réalisation, ce qui est plus court que celle du DPE (dix ans). Si l’audit a plus de cinq ans au moment de la vente, un nouvel audit doit être commandé. La modification significative du bâtiment (travaux d’isolation, changement de système de chauffage, extension) impose également un renouvellement de l’audit.",
        "L’audit énergétique n’est pas obligatoire pour les ventes d’appartements en copropriété, qui restent dispensées de cette obligation individuelle. Cette exception s’explique par la difficulté à dissocier les travaux des parties privatives de ceux des parties communes : la rénovation énergétique d’une copropriété passe avant tout par des décisions collectives prises en assemblée générale et par la mobilisation du dispositif MaPrimeRénov’ Copropriétés. Pour les copropriétés, c’est le DPE collectif qui joue un rôle similaire en orientant les choix de rénovation à l’échelle de l’immeuble.",
        "Sont également exemptés de l’audit les logements destinés à être démolis dans le cadre d’une opération attestée par un arrêté municipal ou préfectoral, ainsi que les biens classés monuments historiques ou inscrits à l’inventaire supplémentaire lorsque les contraintes patrimoniales rendent impossible l’atteinte des objectifs énergétiques. Pour ces situations particulières, une attestation spécifique doit être fournie par le vendeur en remplacement de l’audit.",
      ],
      callout: {
        type: 'warning',
        text: "L’audit énergétique est distinct du DPE et ne le remplace pas. Pour la vente d’un logement F ou G en maison individuelle, le vendeur doit fournir à la fois un DPE de moins de 10 ans et un audit énergétique de moins de 5 ans. Le coût et le délai de réalisation de l’audit sont sensiblement plus importants que ceux du DPE.",
      },
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        "Le cadre réglementaire 2026 de l’audit énergétique repose sur le décret 2022-780, l’arrêté du 4 mai 2022 (mise à jour par l’arrêté du 14 octobre 2022) et la loi Climat et Résilience. Un arrêté complémentaire du 9 mai 2024 a précisé le contenu du rapport d’audit, en imposant notamment une présentation plus pédagogique des scénarios de travaux, des modes de financement et des aides mobilisables. Cette évolution vise à rendre le document plus utile pour l’acquéreur et à faciliter le passage à l’acte de rénovation.",
        "Depuis le 1ᵉʳ janvier 2025, l’obligation d’audit s’étend aux logements classés E. Cette extension a doublé le nombre de transactions concernées, passant de 350 000 par an environ (F+G) à plus de 700 000 par an. Cette montée en puissance a parfois posé des difficultés d’organisation, certaines régions connaissant des délais d’attente de plusieurs semaines pour obtenir un audit. Les acquéreurs et vendeurs doivent désormais anticiper le calendrier de l’audit en amont de la mise en vente.",
        "Le calendrier des prochaines étapes est désormais précis. Les logements classés D seront soumis à l’obligation d’audit à partir du 1ᵉʳ janvier 2034. Cette extension concernera environ 30 % du parc bâti français et accompagnera la trajectoire de réduction des émissions de gaz à effet de serre du bâtiment. Pour les bâtiments tertiaires, des obligations similaires existent déjà via le décret tertiaire de 2019 qui impose une réduction de 40 % des consommations d’énergie d’ici 2030.",
        "Les évolutions méthodologiques sont également notables. Depuis 2024, les auditeurs doivent intégrer dans leur analyse les enjeux liés au confort d’été (notamment dans les zones climatiques chaudes ou les bâtiments à forte exposition solaire), à la qualité de l’air intérieur, à la gestion de l’humidité et à la durabilité des matériaux mis en œuvre. Cette approche élargie traduit la prise de conscience que la performance énergétique n’est qu’un aspect de la qualité globale d’un logement et que les rénovations doivent s’inscrire dans une vision systémique.",
        "Pour les copropriétés, la généralisation du DPE collectif depuis le 1ᵉʳ janvier 2026 a un impact indirect sur l’audit énergétique individuel. Lorsque le DPE collectif comporte une étiquette individualisée par lot, celle-ci peut se substituer au DPE individuel pour la vente, et donc déterminer l’obligation d’audit énergétique. Le syndic doit transmettre une copie du DPE collectif à tout copropriétaire qui en fait la demande, ce qui simplifie les démarches en cas de vente.",
        "La qualification des auditeurs a été précisée par arrêté du 7 avril 2023. Les audits énergétiques réglementaires doivent désormais être réalisés par des professionnels disposant de l’une des trois qualifications suivantes : qualification OPQIBI 1905 « audit énergétique en maison individuelle », architecte avec attestation de formation, ou bureau d’études thermiques disposant de la certification RGE Études. Cette restriction garantit un haut niveau de compétence et exclut les diagnostiqueurs DPE de la réalisation des audits, sauf à ce qu’ils disposent par ailleurs des qualifications requises.",
      ],
      bullets: [
        "Obligation vente F et G depuis le 1ᵉʳ avril 2023",
        "Obligation vente E depuis le 1ᵉʳ janvier 2025",
        "Obligation vente D à partir du 1ᵉʳ janvier 2034",
        "Validité 5 ans (vs 10 ans pour le DPE)",
        "Non applicable aux copropriétés (appartements individuels)",
        "Réalisé par OPQIBI 1905, architecte qualifié ou RGE Études",
      ],
    },
    {
      id: 'deroulement-de-l-audit',
      title: 'Comment se déroule un audit énergétique',
      level: 2,
      paragraphs: [
        "Un audit énergétique réglementaire est un exercice technique approfondi qui dure typiquement entre une demi-journée et une journée sur place, suivi de plusieurs jours de calculs et de rédaction. L’auditeur commence par une phase de collecte documentaire approfondie : permis de construire, plans d’architecte, factures détaillées d’énergie sur trois années, attestation thermique RT 2012 ou RE 2020 le cas échéant, anciens diagnostics, devis de travaux récents ou en cours, contrats d’entretien des équipements.",
        "Sur place, l’inspection est beaucoup plus poussée que celle d’un DPE. L’auditeur mesure précisément toutes les surfaces, identifie la nature exacte des matériaux d’isolation lorsque c’est possible (sondages destructifs en accord avec le propriétaire ou photos endoscopiques), évalue l’état de chaque équipement, mesure les caractéristiques thermiques des baies (Uw, Sw, transmission lumineuse), inventorie les ponts thermiques structurels, et identifie les éventuelles pathologies du bâtiment (humidité, infiltrations, déperditions ciblées).",
        "L’étude des consommations réelles complète l’analyse technique. L’auditeur compare la consommation théorique calculée selon la méthode 3CL-2021 à la consommation réelle constatée sur les factures, et explique les éventuels écarts (comportement de l’occupant, conditions d’usage atypiques, défaut d’étanchéité à l’air, dysfonctionnement d’équipement). Cette comparaison est précieuse pour calibrer le modèle de calcul et pour proposer des scénarios de travaux réalistes.",
        "La phase de modélisation et de calcul prend plusieurs jours. L’auditeur utilise un logiciel agréé qui simule le comportement thermique du bâtiment et permet de tester différents scénarios de travaux. Pour chaque action envisagée (isolation des combles, des murs, remplacement de la chaudière, etc.), le logiciel calcule l’économie d’énergie attendue, le gain en classe DPE et le coût des travaux. L’auditeur combine ensuite ces actions en deux scénarios cohérents permettant d’atteindre la classe C (scénario 1) et la classe B (scénario 2).",
        "Le rapport d’audit, rédigé sur la base des résultats du modèle, présente les deux scénarios de manière détaillée. Pour chaque scénario, le document précise les travaux à réaliser, l’ordre dans lequel les engager, le coût estimatif total, les économies d’énergie annuelles attendues, les aides financières mobilisables (MaPrimeRénov’, CEE, éco-PTZ, aides locales), le reste à charge pour le propriétaire et le temps de retour sur investissement. Une partie pédagogique explique les enjeux de chaque travaux et les certifications professionnelles à exiger des entreprises.",
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Collecte documentaire approfondie',
          text: "L’auditeur recueille les permis de construire, plans, factures d’énergie sur 3 ans, anciens diagnostics, devis de travaux et contrats d’entretien des équipements.",
        },
        {
          position: 2,
          name: 'Inspection technique détaillée',
          text: "Mesures précises des surfaces, identification des matériaux d’isolation (sondages possibles), évaluation des baies, inventaire des ponts thermiques, identification des pathologies du bâtiment.",
        },
        {
          position: 3,
          name: 'Étude des consommations réelles',
          text: "Comparaison entre la consommation théorique 3CL-2021 et la consommation réelle des factures. Identification des écarts et de leurs causes.",
        },
        {
          position: 4,
          name: 'Modélisation et simulation des travaux',
          text: "Simulation thermique avec logiciel agréé. Test de différents scénarios de travaux et calcul des économies d’énergie et du gain en classe DPE.",
        },
        {
          position: 5,
          name: 'Élaboration des deux scénarios',
          text: "Combinaison cohérente des actions en deux scénarios : scénario 1 (classe C minimum) et scénario 2 (classe B minimum). Chaque scénario est chiffré et hiérarchisé.",
        },
        {
          position: 6,
          name: 'Rédaction du rapport d’audit',
          text: "Rédaction du rapport pédagogique avec présentation des scénarios, des coûts, des aides mobilisables, du reste à charge et du temps de retour sur investissement.",
        },
      ],
    },
    {
      id: 'prix-d-un-audit-energetique',
      title: 'Combien coûte un audit énergétique',
      level: 2,
      paragraphs: [
        "Le prix d’un audit énergétique réglementaire est significativement plus élevé que celui d’un DPE en raison de la profondeur de l’analyse. Pour une maison individuelle standard de 90 à 130 m², le tarif moyen constaté en 2026 se situe entre 500 et 1 000 euros toutes taxes comprises. Pour une maison de plus grande taille ou avec une configuration complexe (bâti ancien, plusieurs annexes, géothermie), le tarif peut atteindre 1 200 à 2 000 euros. Les écarts géographiques sont également marqués, avec des tarifs en moyenne 20 à 30 % supérieurs en Île-de-France et dans les grandes métropoles.",
        "Le coût de l’audit est généralement supporté par le vendeur car il s’inscrit dans le cadre d’une vente. Toutefois, certains vendeurs négocient avec l’acquéreur une prise en charge partagée ou un déduction du prix de vente correspondant. Le coût de l’audit peut également être inclus dans les frais d’agence immobilière dans le cadre de certains mandats. Pour les propriétaires occupants qui commandent un audit volontaire en vue d’une rénovation, le coût est entièrement supporté par eux.",
        "Une aide spécifique de MaPrimeRénov’ peut prendre en charge tout ou partie du coût de l’audit dans le cadre du parcours d’accompagnement « Mon Accompagnateur Rénov’ ». Cette aide, d’un montant maximal de 500 euros, est accordée aux ménages aux revenus très modestes et modestes qui s’engagent dans un parcours de rénovation globale. Pour les propriétaires de logements classés F ou G en vente, l’aide n’est pas applicable car l’audit est obligatoire dans le cadre de la transaction.",
        "Les écarts de prix entre auditeurs sont importants et ne reflètent pas toujours la qualité de la prestation. Il est essentiel de comparer plusieurs devis sur des critères précis : durée de la visite sur place (au minimum 3 à 4 heures pour un bien standard), nombre de scénarios proposés, qualité du rapport (présentation des plans, photographies, schémas), accompagnement post-audit pour le suivi des travaux. Un audit à 400 euros qui se limite à 1h30 sur place et un rapport stéréotypé n’a pas la même valeur qu’un audit à 800 euros avec une analyse approfondie.",
      ],
      bullets: [
        "Audit maison standard 90-130 m² : 500 à 1 000 € TTC",
        "Audit maison grande taille ou complexe : 1 200 à 2 000 € TTC",
        "Aide MaPrimeRénov’ accompagnement : jusqu’à 500 € (audit volontaire uniquement)",
        "À ne pas confondre avec le DPE (entre 130 et 300 €)",
        "Durée minimale recommandée sur place : 3 à 4 heures",
      ],
    },
    {
      id: 'comprendre-le-rapport',
      title: 'Comment lire le rapport d’audit énergétique',
      level: 2,
      paragraphs: [
        "Le rapport d’audit énergétique réglementaire suit une structure standardisée définie par l’arrêté du 4 mai 2022 et par ses textes complémentaires. Il comprend une dizaine de chapitres présentés dans un ordre logique. La première partie identifie le bien (adresse, références cadastrales, surface, période de construction, type de bâtiment) et l’auditeur (nom, qualifications OPQIBI 1905 ou équivalent, attestation d’assurance, signature engageante).",
        "La deuxième partie présente l’état initial du bâtiment et de ses équipements de manière exhaustive : enveloppe (murs, toiture, plancher bas, menuiseries), systèmes de chauffage, d’eau chaude sanitaire, de ventilation, de climatisation, et le cas échéant de production d’électricité photovoltaïque. Pour chaque élément, le rapport indique sa nature, ses caractéristiques techniques, son état général et sa performance énergétique. Cette présentation est généralement illustrée par des photographies et des plans cotés.",
        "La troisième partie présente le bilan énergétique du logement : consommation théorique en énergie primaire et finale par poste, étiquette énergie, étiquette climat, comparaison entre consommation théorique et consommation réelle des factures, identification des principaux postes de déperdition. Cette analyse permet de prioriser les actions de travaux les plus rentables et de proposer des scénarios cohérents.",
        "La quatrième partie, qui est le cœur du rapport, présente les deux scénarios de travaux. Pour chaque scénario, le rapport détaille les actions à réaliser, leur ordre, leur coût estimatif, l’économie d’énergie annuelle attendue, le gain en classe DPE, les aides mobilisables et le reste à charge pour le propriétaire. Le scénario 1 vise au minimum la classe C et le scénario 2 la classe B. Une logique d’intervention par étapes peut être proposée, par exemple commencer par l’isolation des combles puis poursuivre par les menuiseries et le système de chauffage.",
        "La cinquième partie aborde les modes de financement et les aides mobilisables de manière pédagogique. MaPrimeRénov’, les certificats d’économies d’énergie (CEE), l’éco-prêt à taux zéro, la TVA à taux réduit de 5,5 %, les aides locales et le « coup de pouce chauffage » sont détaillés avec leurs conditions d’éligibilité et leurs montants applicables au cas d’espèce. Une simulation chiffrée permet à l’acquéreur de visualiser le reste à charge réel et le temps de retour sur investissement.",
        "La sixième partie présente les certifications professionnelles à exiger des entreprises (RGE QualiPV, RGE Quali’Bat, RGE Chauffage, RGE Isolation, etc.), les bonnes pratiques en matière de contractualisation et les points de vigilance lors des travaux. Une partie pédagogique sur l’importance d’une approche globale et sur les bénéfices indirects de la rénovation (confort, qualité de l’air, valorisation du bien) conclut le document.",
      ],
    },
    {
      id: 'travaux-recommandes',
      title: 'Quels travaux sont généralement recommandés',
      level: 2,
      paragraphs: [
        "Les travaux recommandés par un audit énergétique suivent une logique d’intervention coordonnée qui privilégie l’enveloppe avant les équipements. Pour un logement classé F ou G, le scénario type comprend systématiquement plusieurs actions : isolation des combles ou de la toiture, isolation des murs (par l’extérieur ou par l’intérieur), remplacement des menuiseries simple vitrage par du double vitrage haute performance, et remplacement du système de chauffage par une solution performante (pompe à chaleur air-eau, géothermie, chaudière biomasse).",
        "L’isolation des combles et de la toiture est généralement la première action prioritaire car elle traite le poste de déperdition le plus important (jusqu’à 30 % des pertes thermiques dans un logement ancien) et offre un retour sur investissement rapide (5 à 8 ans). Le coût se situe entre 30 et 80 euros par mètre carré de surface isolée selon la technique (laine soufflée, panneaux rigides, isolation extérieure de la toiture). MaPrimeRénov’ et les CEE permettent de couvrir 40 à 90 % du coût selon les revenus du foyer.",
        "L’isolation des murs représente le deuxième poste prioritaire avec environ 25 % des déperditions. Deux techniques principales coexistent : l’isolation thermique par l’extérieur (ITE), plus performante mais nécessitant un budget plus important (120 à 250 euros par mètre carré), et l’isolation thermique par l’intérieur (ITI), moins onéreuse (60 à 120 euros par mètre carré) mais qui réduit légèrement la surface habitable. Le choix dépend de l’aspect architectural du bâtiment, des contraintes du PLU et du budget disponible.",
        "Le remplacement des menuiseries simple vitrage représente environ 10 à 15 % des déperditions. Le passage à du double vitrage à haute performance (Uw ≤ 1,3 W/m²·K) ou du triple vitrage améliore significativement le confort thermique et acoustique. Le coût se situe entre 600 et 1 200 euros par fenêtre selon le matériau (PVC, aluminium, bois) et la performance. Cette action est souvent combinée avec l’isolation des murs pour traiter les ponts thermiques au niveau des tableaux.",
        "Le remplacement du système de chauffage vient après le traitement de l’enveloppe. Le passage d’une chaudière fioul ou gaz ancienne vers une pompe à chaleur air-eau de classe A++ permet de diviser par trois la consommation d’énergie primaire et d’améliorer significativement la classe DPE. Le coût se situe entre 12 000 et 25 000 euros pour une installation complète, avec des aides MaPrimeRénov’ et CEE pouvant atteindre 14 000 euros pour les ménages très modestes. Pour les zones sans gaz de ville, la chaudière biomasse à granulés constitue également une alternative performante.",
        "La ventilation mécanique contrôlée double flux complète souvent les scénarios de rénovation performante. En récupérant jusqu’à 90 % de la chaleur de l’air extrait, elle améliore significativement le bilan énergétique sans pour autant dégrader la qualité de l’air intérieur. Le coût d’une installation double flux complète se situe entre 5 000 et 10 000 euros pour un logement de taille moyenne, avec une aide MaPrimeRénov’ pouvant atteindre 3 000 euros.",
      ],
    },
    {
      id: 'aides-financieres',
      title: 'Aides financières mobilisables pour les travaux',
      level: 2,
      paragraphs: [
        "MaPrimeRénov’ est l’aide phare distribuée par l’Anah. Elle s’adresse à tous les propriétaires occupants et bailleurs sans condition de plafond depuis 2020 et concerne aussi les copropriétés via le dispositif MaPrimeRénov’ Copropriétés. Le montant accordé dépend des revenus du foyer (catégories très modestes, modestes, intermédiaires, supérieures) et de la nature des travaux entrepris. Une rénovation globale permettant de gagner au minimum deux classes peut être subventionnée jusqu’à 70 000 euros pour les ménages les plus modestes.",
        "MaPrimeRénov’ Parcours Accompagné est une variante du dispositif qui s’adresse spécifiquement aux rénovations globales permettant de gagner au minimum deux classes au DPE. Elle nécessite l’intervention d’un « Mon Accompagnateur Rénov’ » qui guide le propriétaire dans son projet (audit, choix des travaux, sélection des entreprises, suivi du chantier). Les montants d’aide sont supérieurs à ceux du parcours classique, jusqu’à 80 % du coût pour les ménages très modestes plafonnés à 70 000 euros.",
        "Les certificats d’économies d’énergie (CEE) constituent le second pilier du financement. Versés par les fournisseurs d’énergie obligés (EDF, Engie, TotalEnergies, etc.), ils sont mobilisables pour l’isolation, le chauffage performant, la ventilation et la régulation. Ils se cumulent avec MaPrimeRénov’ et peuvent réduire la facture finale de 10 à 30 % supplémentaires. Le « coup de pouce chauffage » majore les CEE pour les remplacements de chaudières fioul ou gaz par des équipements à énergie renouvelable.",
        "L’éco-prêt à taux zéro, appelé éco-PTZ, finance jusqu’à 50 000 euros de travaux sur une durée de remboursement de 20 ans sans intérêts. Il est accessible sans condition de ressources et peut financer aussi bien des actions isolées que des rénovations globales. Pour les rénovations dites « performantes » permettant d’atteindre la classe B ou de gagner au minimum deux classes, le plafond a été relevé à 50 000 euros depuis 2022.",
        "La TVA à taux réduit de 5,5 % s’applique automatiquement à l’ensemble des travaux d’amélioration de la performance énergétique réalisés par un professionnel dans un logement achevé depuis plus de deux ans. Cette TVA réduite s’applique aussi bien aux matériaux qu’à la main-d’œuvre et constitue une économie souvent oubliée mais substantielle pour les ménages dont les revenus ne leur ouvrent pas droit à MaPrimeRénov’. Pour les travaux induits (déplacement de radiateur, raccordement électrique, etc.), la même TVA réduite s’applique.",
        "Enfin, certaines collectivités locales (régions, départements, communes) proposent des aides complémentaires pour la rénovation énergétique. Ces aides varient selon les territoires et peuvent atteindre plusieurs milliers d’euros. L’ADIL et France Rénov’ peuvent renseigner sur les dispositifs locaux mobilisables dans votre commune. Pour les ménages très modestes, l’accompagnement personnalisé par un opérateur Anah ou un point info Énergie est gratuit et permet d’optimiser le plan de financement.",
      ],
    },
    {
      id: 'choisir-son-auditeur',
      title: 'Comment choisir son auditeur énergétique',
      level: 2,
      paragraphs: [
        "L’audit énergétique réglementaire doit être réalisé par un professionnel qualifié selon l’une des trois voies prévues par l’arrêté du 7 avril 2023. La première est la qualification OPQIBI 1905 « audit énergétique en maison individuelle » délivrée par l’Organisme professionnel de qualification des ingénieurs-conseils du bâtiment et de l’infrastructure. La deuxième est le statut d’architecte avec attestation de formation spécifique à l’audit énergétique. La troisième est la certification RGE Études (BAT-EN-101 ou BAT-EN-102) délivrée par OPQIBI, Qualibat ou Cequami.",
        "Au-delà de la qualification, plusieurs critères permettent de juger de la qualité d’un auditeur. L’expérience pratique dans des bâtiments similaires au vôtre est un indicateur important : un auditeur habitué aux maisons des années 1920 ne sera pas nécessairement compétent sur une maison contemporaine, et inversement. La présence d’assurance responsabilité civile professionnelle adaptée et de garantie décennale est obligatoire. Demandez plusieurs devis détaillés, comparez la durée de visite sur place, le nombre de scénarios proposés et la qualité des références.",
        "La méthode de travail de l’auditeur et la qualité du logiciel de simulation utilisé sont également des indicateurs clés. Les logiciels professionnels agréés (PERRENOUD, BBS Slama, ClimaWin) offrent des simulations thermiques précises qui prennent en compte les ponts thermiques, les apports solaires, l’inertie du bâtiment et les usages réels. Un auditeur qui se contente d’un calcul DPE simplifié sans simulation thermique dynamique produira un audit de qualité inférieure, peu utile pour orienter les choix de rénovation. Demandez à voir un exemple de rapport d’audit pour juger de la pédagogie et de la rigueur du livrable.",
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        "Plusieurs configurations particulières demandent une expertise renforcée. Les maisons anciennes en pierre (avant 1948) présentent des spécificités importantes : forte inertie thermique, absence de membrane d’étanchéité à l’air, sensibilité à l’humidité, contraintes patrimoniales sur les façades. Un audit énergétique adapté doit prendre en compte ces particularités et proposer des solutions compatibles avec la nature du bâti (isolation par l’intérieur avec membranes hygrovariables, conservation des matériaux capillaires, traitement spécifique des ponts thermiques). Une rénovation mal adaptée peut générer des désordres importants (condensation, moisissures, dégradation des matériaux anciens).",
        "Les maisons à ossature bois ou à structure légère (années 1970-1990) peuvent atteindre rapidement la classe C ou B avec des rénovations relativement légères grâce à leur structure peu massive. L’audit doit identifier les ponts thermiques structurels (jonctions ossature/menuiseries, planchers bas, toitures) et proposer des solutions de traitement spécifiques. Le remplacement des menuiseries et l’ajout d’une isolation thermique extérieure sont souvent les leviers les plus rentables sur ces bâtiments.",
        "Les maisons des années 1980-2000 construites avant la RT 2005 présentent généralement une isolation insuffisante par rapport aux standards actuels. L’audit type pour ces maisons identifie des potentiels d’amélioration substantiels : rénovation des combles (isolation portée de 100 mm à 350-400 mm), isolation thermique extérieure des murs, remplacement du double vitrage 4/12/4 par du double vitrage performant 4/16/4 ou triple vitrage, et passage à un système de chauffage performant. Ces rénovations permettent généralement de gagner 2 à 3 classes au DPE pour un budget de 30 000 à 60 000 euros.",
        "Les maisons RT 2012 (2013-2021) sont généralement bien construites et offrent peu de marges d’amélioration énergétique. L’audit pour ces maisons cible plutôt l’optimisation des systèmes (régulation, programmation, pompes à chaleur de dernière génération) et l’ajout de production d’électricité photovoltaïque en autoconsommation. Les gains attendus sont moins spectaculaires (passage de B à A par exemple) mais permettent d’atteindre le maximum de performance dans le cadre d’une recherche d’excellence énergétique ou d’une revente valorisée.",
        "Les maisons rurales isolées non raccordées au gaz de ville méritent une analyse spécifique. Sans accès au gaz, les principaux choix se résument à la pompe à chaleur air-eau, la pompe à chaleur géothermique (si la surface du terrain le permet), la chaudière biomasse à granulés, ou les radiateurs électriques performants. L’audit doit comparer ces options en intégrant le coût d’installation, le coût d’usage annuel, l’impact carbone, et la maintenance prévisible. Pour les maisons exposées (haute altitude, climat rigoureux), la pompe à chaleur géothermique offre généralement les meilleurs résultats malgré son coût d’installation élevé.",
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        "Une première erreur fréquente consiste à confondre audit énergétique et DPE. Ces deux documents sont distincts et ont des finalités différentes : le DPE est une évaluation de la performance actuelle (130-300 euros) ; l’audit est une étude approfondie avec scénarios de travaux (500-2000 euros). Pour la vente d’un logement F ou G en maison individuelle, le vendeur doit fournir LES DEUX documents, pas seulement l’un ou l’autre. Confondre les deux et ne fournir que le DPE expose le vendeur à des sanctions et à un retard significatif dans le processus de vente.",
        "Une deuxième erreur consiste à choisir l’auditeur sur le seul critère du prix. Un audit à 400 euros qui se limite à 1h30 sur place et un rapport stéréotypé n’a pas la même valeur qu’un audit à 800 euros avec une analyse approfondie. La qualité de l’audit conditionne directement la pertinence des scénarios proposés et la facilité d’engagement des travaux pour l’acquéreur. Un audit bâclé peut conduire à des choix de rénovation inadaptés et à des surcoûts importants. L’écart de 400 euros sur le prix de l’audit est dérisoire par rapport au budget travaux qui peut atteindre 70 000 euros.",
        "Une troisième erreur consiste à ignorer les scénarios proposés et à entreprendre des travaux fragmentaires sans cohérence. La rénovation énergétique efficace suit une logique d’intervention coordonnée : enveloppe avant équipements, isolation avant chauffage, ventilation après étanchéité. Inverser cet ordre (par exemple remplacer la chaudière par une pompe à chaleur avant d’isoler les murs) génère des sous-performances importantes et compromet la rentabilité de l’opération. Les scénarios de l’audit énergétique sont conçus pour optimiser ce séquencement.",
        "Une quatrième erreur consiste à confier les travaux à des entreprises non RGE. Les aides publiques (MaPrimeRénov’, CEE, éco-PTZ) sont conditionnées au recours à des entreprises certifiées RGE (Reconnu Garant de l’Environnement) pour les actions financées. Confier les travaux à une entreprise non RGE prive le propriétaire des aides et représente une perte financière importante. La vérification de la certification RGE en cours de validité est indispensable avant tout engagement contractuel.",
        "Une cinquième erreur consiste à sous-estimer le temps total d’un projet de rénovation globale. Entre la commande de l’audit, la sélection des entreprises, la demande des aides, l’exécution des travaux et la réception finale, il faut généralement compter 12 à 24 mois pour une rénovation performante d’une maison individuelle. Anticiper ce délai est crucial, particulièrement pour les bailleurs concernés par les interdictions progressives de location (logements G en 2025, F en 2028). Démarrer la démarche dès l’identification de l’obligation est la seule façon d’éviter une rupture de location ou une décote importante du bien.",
      ],
    },
  ],
  faq: [
    {
      question: 'À partir de quand l’audit énergétique est-il obligatoire ?',
      answer:
        "Pour les ventes de maisons individuelles et de bâtiments en monopropriété : depuis le 1ᵉʳ avril 2023 pour F et G, depuis le 1ᵉʳ janvier 2025 pour E, et à partir du 1ᵉʳ janvier 2034 pour D.",
    },
    {
      question: 'Quelle est la différence entre DPE et audit énergétique ?',
      answer:
        "Le DPE évalue la performance énergétique actuelle d’un logement. L’audit énergétique propose en plus deux scénarios chiffrés de travaux permettant d’atteindre la classe C et la classe B.",
    },
    {
      question: 'Quelle est la durée de validité d’un audit énergétique ?',
      answer:
        "La validité est de 5 ans à compter de la réalisation. Une modification significative du bâtiment (travaux, extension, changement de système) impose un renouvellement.",
    },
    {
      question: 'L’audit énergétique est-il obligatoire pour les appartements en copropriété ?',
      answer:
        "Non, l’obligation ne s’applique qu’aux maisons individuelles et aux bâtiments en monopropriété. Pour les copropriétés, c’est le DPE collectif qui joue un rôle similaire.",
    },
    {
      question: 'Combien coûte un audit énergétique ?',
      answer:
        "Entre 500 et 1 000 € TTC pour une maison standard de 90 à 130 m², et 1 200 à 2 000 € pour les biens complexes. Aide MaPrimeRénov’ accompagnement possible (jusqu’à 500 €) pour les audits volontaires.",
    },
    {
      question: 'Qui peut réaliser un audit énergétique réglementaire ?',
      answer:
        "Trois qualifications possibles : OPQIBI 1905 audit énergétique en maison individuelle, architecte avec attestation de formation, ou certification RGE Études (BAT-EN-101/102).",
    },
    {
      question: 'Combien de temps prend la réalisation d’un audit ?',
      answer:
        "Compter une demi-journée à une journée complète sur place, plus 5 à 10 jours pour les calculs et la rédaction du rapport.",
    },
    {
      question: 'L’audit doit-il être remis à l’acquéreur dès la première visite ?',
      answer:
        "Oui, l’audit doit obligatoirement être communiqué à l’acquéreur dès la première visite ayant donné lieu à compte rendu, et annexé au compromis puis à l’acte authentique.",
    },
    {
      question: 'Quelles aides peuvent financer les travaux recommandés ?',
      answer:
        "MaPrimeRénov’ (jusqu’à 70 000 € pour rénovation globale), CEE, éco-PTZ (50 000 € sans intérêts), TVA 5,5 %, aides locales. Le cumul peut atteindre 80-90 % du coût pour les ménages très modestes.",
    },
    {
      question: 'L’audit propose-t-il combien de scénarios de travaux ?',
      answer:
        "Au minimum 2 scénarios cohérents : scénario 1 permettant d’atteindre au moins la classe C, scénario 2 permettant d’atteindre au moins la classe B.",
    },
    {
      question: 'Que se passe-t-il si je vends sans audit ?',
      answer:
        "L’absence d’audit obligatoire expose le vendeur à des sanctions et engage sa responsabilité civile au titre de la garantie des vices cachés. L’acquéreur peut demander la révision du prix de vente.",
    },
    {
      question: 'Faut-il refaire l’audit après les travaux ?',
      answer:
        "Non, l’audit n’est requis qu’en vue d’une vente. Après les travaux, un nouveau DPE peut être réalisé pour officialiser le gain de classe énergétique.",
    },
    {
      question: 'L’audit peut-il être réalisé par mon diagnostiqueur DPE ?',
      answer:
        "Non, sauf s’il dispose par ailleurs des qualifications requises (OPQIBI 1905, architecte avec attestation ou RGE Études). La qualification DPE n’est pas suffisante.",
    },
    {
      question: 'L’audit s’applique-t-il aux locations ?',
      answer:
        "Non, l’audit énergétique réglementaire ne s’applique qu’aux ventes. Pour les locations, ce sont les interdictions progressives de location des passoires thermiques (G en 2025, F en 2028, E en 2034) qui s’appliquent.",
    },
    {
      question: 'Mon Accompagnateur Rénov’ est-il obligatoire ?',
      answer:
        "Le recours à un Accompagnateur Rénov’ est obligatoire pour bénéficier de MaPrimeRénov’ Parcours Accompagné et pour les rénovations globales. Pour les rénovations par geste, il reste facultatif mais conseillé.",
    },
  ],
}
