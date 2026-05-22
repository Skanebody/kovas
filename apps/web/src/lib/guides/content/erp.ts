/**
 * Guide long — État des Risques et Pollutions (ERP, ex-ERNMT).
 *
 * Sources : article L125-5 du Code de l'environnement, décret 2005-134,
 * loi 2003-699 du 30 juillet 2003, loi 2014-366 du 24 mars 2014 (ALUR),
 * loi 2018-1021 du 23 novembre 2018 (ELAN), service Géorisques.
 */

import type { Guide } from '../types'

export const ERP_GUIDE: Guide = {
  type: 'erp',
  slug: 'erp',
  shortTitle: 'ERP',
  title: 'État des risques et pollutions (ERP) : guide complet 2026',
  category: 'vente',
  tagline:
    'Tout savoir sur l’ERP : risques naturels, miniers, technologiques, pollution des sols, radon, validité 6 mois et obligations vendeur/bailleur.',
  metaDescription:
    'ERP 2026 : risques naturels, miniers, technologiques, radon, validité 6 mois, prix gratuit Géorisques. Guide complet KOVAS.',
  teaser:
    'Risques naturels, miniers, technologiques, radon, pollution des sols et validité 6 mois.',
  publishedAt: '2026-05-22T08:00:00.000Z',
  updatedAt: '2026-05-22T08:00:00.000Z',
  readingTimeMinutes: 25,
  wordCount: 5000,
  relatedTypes: ['termites', 'dpe', 'audit-energetique', 'amiante'],
  sections: [
    {
      id: 'qu-est-ce-que-l-erp',
      title: 'Qu’est-ce que l’ERP et à quoi sert-il',
      level: 2,
      paragraphs: [
        "L’état des risques et pollutions, désigné par l’acronyme ERP (anciennement ERNMT, ERNT puis ESRIS), est un document d’information obligatoire qui doit être remis à tout acquéreur ou locataire d’un bien immobilier. Il informe sur les risques naturels, miniers, technologiques et de pollution des sols auxquels le bien est exposé, ainsi que sur l’éventuelle existence d’un plan de prévention applicable à la zone. Il est encadré par l’article L125-5 du Code de l’environnement, par le décret 2005-134 du 15 février 2005 et par les évolutions successives apportées par les lois ALUR de 2014 et ELAN de 2018.",
        "L’ERP a pour finalité principale de garantir la transparence sur les risques et nuisances auxquels le bien est exposé. Cette information permet à l’acquéreur de prendre une décision d’achat en connaissance de cause, d’adapter le prix proposé en conséquence et de mettre en œuvre des mesures de protection adaptées (assurance multirisque habitation avec garanties spécifiques, travaux préventifs, plan familial de mise en sûreté). Pour le locataire, l’ERP permet de connaître les risques pesant sur le logement et les consignes à suivre en cas d’événement.",
        "Le périmètre couvert par l’ERP s’est progressivement élargi depuis sa création en 2006. À l’origine limité aux risques naturels et technologiques, il a été étendu aux risques miniers en 2014, à la pollution des sols en 2018, au radon en 2018, et plus récemment à l’information sur le recul du trait de côte pour les communes littorales en 2022. Chaque évolution réglementaire enrichit le document et renforce la protection de l’acquéreur ou du locataire.",
        "Contrairement aux autres diagnostics, l’ERP n’est pas réalisé par un diagnostiqueur certifié mais peut être établi par le vendeur ou le bailleur lui-même à partir des informations publiques disponibles sur le site Géorisques (georisques.gouv.fr) géré par le ministère de la Transition écologique et le BRGM. Cette particularité fait de l’ERP le diagnostic le moins coûteux à produire (souvent gratuit), mais aussi celui qui exige une vigilance particulière sur la justesse des informations renseignées.",
      ],
    },
    {
      id: 'quand-l-erp-est-il-obligatoire',
      title: 'Quand l’ERP est-il obligatoire',
      level: 2,
      paragraphs: [
        "L’ERP est obligatoire pour tout bien immobilier situé dans une commune concernée par au moins un des plans de prévention listés à l’article R125-23 du Code de l’environnement : plan de prévention des risques naturels (PPRN), plan de prévention des risques miniers (PPRM), plan de prévention des risques technologiques (PPRT), zone de sismicité de niveau 2, 3, 4 ou 5, ou zone à potentiel radon de niveau 3. La quasi-totalité des communes françaises sont concernées par au moins l’un de ces critères, ce qui rend l’ERP de facto universel en pratique.",
        "Pour vérifier si votre commune est concernée, vous pouvez consulter le site Géorisques qui recense l’ensemble des plans de prévention applicables. Le site permet également de générer automatiquement un ERP pré-rempli à partir de l’adresse précise du bien, ce qui simplifie grandement la démarche du vendeur ou du bailleur. La mairie peut également renseigner sur les plans en vigueur dans la commune.",
        "L’ERP est exigé dans deux contextes principaux. Lors d’une vente, il doit être annexé au compromis de vente et figurer dans le dossier de diagnostic technique remis chez le notaire. Sa validité est limitée à six mois à compter de sa réalisation, ce qui implique souvent de le renouveler en fin de processus de vente. Lors d’une mise en location (vide ou meublée, principale ou secondaire), l’ERP doit être annexé au bail et sa validité est également limitée à six mois.",
        "L’ERP est également exigé en cas de location saisonnière dans certaines communes, en cas de don manuel, de partage successoral comportant un immeuble, ou de toute autre opération transférant la propriété ou la jouissance d’un bien. Sont exemptés de l’obligation les contrats de bail rural, les baux commerciaux et les baux professionnels lorsque le bien est situé hors zone à risque (mais dans la pratique, l’ERP est souvent réalisé même pour ces contrats à titre de précaution).",
      ],
    },
    {
      id: 'reglementation-2026',
      title: 'Quelles sont les règles applicables en 2026',
      level: 2,
      paragraphs: [
        "Le cadre réglementaire 2026 de l’ERP a été progressivement enrichi depuis sa création. La dernière évolution majeure est intervenue le 1ᵉʳ janvier 2023 avec l’extension de l’obligation à l’information sur le recul du trait de côte pour les communes littorales identifiées comme particulièrement vulnérables au changement climatique. Cette mention obligatoire s’ajoute aux risques traditionnels et concerne environ 130 communes côtières françaises, principalement en Aquitaine, Bretagne, Normandie et sur le pourtour méditerranéen.",
        "Le radon, gaz radioactif d’origine naturelle issu de la désintégration de l’uranium présent dans certaines roches granitiques, a fait l’objet d’une attention croissante depuis 2018. Les communes situées en zone à potentiel radon de niveau 3 (potentiel significatif) doivent être mentionnées dans l’ERP. Cette catégorie concerne principalement le Massif central, les Vosges, la Bretagne et la Corse, soit environ 7 500 communes françaises. Pour ces zones, le vendeur ou bailleur est tenu d’informer l’acquéreur ou le locataire et de recommander la mise en place de mesures de prévention (ventilation, étanchéité des soubassements).",
        "La pollution des sols a également été intégrée à l’ERP en 2018. Le site Géorisques recense les sites pollués répertoriés dans les bases BASOL (sites pollués connus) et BASIAS (anciens sites industriels et activités de service). Lorsqu’un bien est situé à proximité immédiate d’un site identifié, l’ERP doit le mentionner et préciser la nature de la pollution éventuelle. Cette information permet à l’acquéreur d’engager des investigations complémentaires (analyses de sol) avant son acquisition s’il le juge nécessaire.",
        "Une évolution notable de 2024 concerne l’information sur les arrêtés de catastrophe naturelle. L’ERP doit désormais mentionner explicitement l’historique des arrêtés de catastrophe naturelle pris pour la commune au cours des cinq dernières années, ce qui permet d’apprécier l’exposition réelle du bien aux événements climatiques. Cette information complète les informations sur les plans de prévention et donne une vision plus opérationnelle des risques.",
        "Enfin, depuis 2025, l’ERP intègre une mention spécifique sur le risque de retrait-gonflement des argiles (RGA), qui touche particulièrement les constructions sur sols argileux et qui est responsable de nombreux sinistres en période de sécheresse prolongée. Cette mention concerne environ 50 % des communes françaises et peut conditionner les obligations de l’acquéreur en matière de gestion de l’humidité autour de la construction (gestion des plantations, drainage, étanchéité des fondations).",
      ],
      bullets: [
        "ERP obligatoire dans les communes avec PPRN, PPRM, PPRT, zone sismique ou radon 3",
        "Validité 6 mois à compter de la réalisation",
        "Inclut désormais : radon, pollution sols, trait de côte, RGA, catastrophes naturelles",
        "Génération gratuite sur Géorisques (georisques.gouv.fr)",
        "Concerne aussi les locations (vide ou meublée)",
        "Tient compte des arrêtés CatNat des 5 dernières années",
      ],
    },
    {
      id: 'comment-realiser-un-erp',
      title: 'Comment réaliser un ERP',
      level: 2,
      paragraphs: [
        "La réalisation d’un ERP est l’une des démarches les plus simples parmi les diagnostics obligatoires, car elle peut être effectuée gratuitement en ligne par le vendeur ou le bailleur lui-même. Le site Géorisques (georisques.gouv.fr), service public géré par le ministère de la Transition écologique et le BRGM, permet de générer automatiquement un ERP pré-rempli à partir de l’adresse précise du bien. La démarche prend moins de cinq minutes et le document obtenu est un formulaire officiel directement utilisable.",
        "Pour générer l’ERP, il suffit de se rendre sur la page « Mon état des risques réglementé » de Géorisques, de saisir l’adresse complète du bien (commune, voie, numéro), de valider la géolocalisation sur la carte et de télécharger le document généré au format PDF. Le formulaire inclut automatiquement les informations sur les plans de prévention en vigueur, les zones de sismicité, le potentiel radon, la proximité de sites pollués, et les arrêtés de catastrophe naturelle.",
        "Le vendeur ou bailleur doit ensuite compléter manuellement quelques informations complémentaires : l’indication de la déclaration des sinistres ayant fait l’objet d’une indemnisation par une assurance multirisque habitation au titre de la catastrophe naturelle ou de la pollution, et l’information sur les éventuelles servitudes ou prescriptions individuelles applicables au bien. Cette information complémentaire est sous la responsabilité du déclarant et engage sa responsabilité civile.",
        "Si le bien est situé dans une commune complexe ou si vous souhaitez bénéficier d’une expertise approfondie, vous pouvez également faire appel à un diagnostiqueur certifié qui réalisera l’ERP avec un travail d’analyse plus poussé. Le coût d’une telle prestation se situe entre 15 et 40 euros TTC, ce qui reste très abordable et donne une garantie supplémentaire en cas de litige. Pour les biens à risque particulier (proximité d’un site industriel, zone d’écoulement de coulée de boue, zone d’inondation), cette expertise est souvent recommandée.",
      ],
      howToSteps: [
        {
          position: 1,
          name: 'Accéder à Géorisques',
          text: "Connectez-vous sur georisques.gouv.fr et cliquez sur « Mon état des risques réglementé » dans la rubrique « Particuliers et entreprises ».",
        },
        {
          position: 2,
          name: 'Saisir l’adresse précise',
          text: "Indiquez la commune, la voie et le numéro du bien. Validez la géolocalisation sur la carte interactive pour confirmer la position exacte.",
        },
        {
          position: 3,
          name: 'Télécharger le document généré',
          text: "Le système génère automatiquement un ERP pré-rempli avec les informations officielles. Téléchargez le document au format PDF.",
        },
        {
          position: 4,
          name: 'Compléter les informations manuelles',
          text: "Renseignez les informations sur les sinistres antérieurs ayant fait l’objet d’une indemnisation et les éventuelles servitudes individuelles applicables au bien.",
        },
        {
          position: 5,
          name: 'Signer et dater',
          text: "Datez et signez le document. La validité court pour 6 mois à compter de la date de signature.",
        },
        {
          position: 6,
          name: 'Annexer au contrat',
          text: "Annexez l’ERP au compromis de vente ou au bail. Le notaire ou le gestionnaire de location vérifiera sa présence et sa validité.",
        },
      ],
    },
    {
      id: 'prix-d-un-erp',
      title: 'Combien coûte un ERP',
      level: 2,
      paragraphs: [
        "L’ERP peut être réalisé gratuitement par le vendeur ou le bailleur lui-même via le site Géorisques. Cette option, encouragée par les pouvoirs publics, ne nécessite aucune compétence technique particulière et prend moins de cinq minutes. Elle constitue la solution la plus économique et reste valable juridiquement à condition que les informations saisies soient exactes et complètes.",
        "Pour les vendeurs ou bailleurs qui préfèrent déléguer la démarche, un ERP réalisé par un diagnostiqueur certifié coûte entre 15 et 40 euros TTC. Ce service est généralement inclus gratuitement ou pour un coût symbolique dans un pack de diagnostics obligatoires à la vente ou à la location. Cette option garantit la fiabilité du document et engage la responsabilité du diagnostiqueur en cas d’erreur ou d’omission.",
        "Pour les biens situés en zone à risque particulier (proximité de site classé Seveso, zone de coulée de boue, zone inondable à fort enjeu), une expertise complémentaire peut être commandée à un bureau d’études spécialisé. Le coût d’une telle expertise se situe entre 200 et 800 euros selon la complexité, et fournit des informations détaillées sur les niveaux de risque, les mesures de protection à mettre en œuvre et les aides éventuellement mobilisables. Cette expertise est généralement réservée aux biens à forte valeur ou aux situations particulières.",
      ],
      bullets: [
        "ERP gratuit via Géorisques (auto-réalisation)",
        "ERP par diagnostiqueur certifié : 15 à 40 € TTC",
        "ERP inclus dans pack vente : généralement gratuit",
        "Expertise risque approfondie par bureau d’études : 200 à 800 €",
      ],
    },
    {
      id: 'comprendre-le-document',
      title: 'Comment lire et utiliser l’ERP',
      level: 2,
      paragraphs: [
        "Le document ERP suit un formulaire standardisé qui présente une structure simple. Il commence par l’identification du bien (adresse précise, commune, références cadastrales) et par la liste des risques applicables avec, pour chacun, une mention « oui » ou « non ». Les principaux risques répertoriés sont les inondations, les mouvements de terrain (glissements, retrait-gonflement des argiles, cavités souterraines), les séismes, les avalanches, les feux de forêt, les éruptions volcaniques, les risques miniers, les risques technologiques industriels, le radon et la pollution des sols.",
        "Pour chaque risque applicable, le document indique le plan de prévention de référence (PPRN, PPRT, etc.), la zone d’aléa dans laquelle se trouve le bien (faible, moyen, fort, très fort) et les éventuelles prescriptions individuelles applicables au bien. Ces prescriptions peuvent imposer des travaux de mise en sécurité (renforcement des fondations, surélévation, occultation des baies) ou des contraintes d’usage (interdiction d’ajouter des étages, contraintes paysagères).",
        "Une section dédiée traite des sinistres antérieurs ayant fait l’objet d’une indemnisation au titre de la catastrophe naturelle. Cette information, à renseigner par le vendeur ou bailleur à partir de ses archives personnelles ou des informations transmises par l’assureur, permet à l’acquéreur d’apprécier la fréquence réelle des événements et de prévoir une adaptation de la couverture d’assurance. Une déclaration intentionnellement incomplète ou inexacte peut engager la responsabilité du déclarant.",
        "L’ERP doit être lu attentivement par l’acquéreur ou le locataire qui doit en accuser réception et en conserver une copie. En cas de zone d’aléa fort à très fort sur un risque majeur (inondation, mouvement de terrain), il est recommandé de consulter le plan de prévention complet en mairie ou sur Géorisques pour comprendre les prescriptions applicables et leurs conséquences pratiques. Une assurance multirisque habitation adaptée doit être souscrite en conséquence.",
      ],
    },
    {
      id: 'risques-principaux-en-france',
      title: 'Quels sont les principaux risques en France',
      level: 2,
      paragraphs: [
        "Le risque d’inondation est le risque naturel le plus répandu en France et concerne environ 17 millions de personnes selon le ministère de la Transition écologique. Les bassins de la Loire, du Rhône, de la Garonne, de la Seine et de la Meuse présentent des zones d’aléa significatif. Les inondations peuvent être de plusieurs types : crues lentes des grands fleuves (avec des hauteurs d’eau atteignant plusieurs mètres en plusieurs jours), crues éclair des cours d’eau de montagne ou méditerranéens, débordements urbains, remontées de nappes phréatiques.",
        "Le risque de mouvement de terrain regroupe plusieurs phénomènes : glissements de terrain (déplacements lents ou rapides de masses de sol sur des pentes), retrait-gonflement des argiles (RGA, qui touche 50 % des communes françaises et est responsable de fissures dans les constructions en période de sécheresse), cavités souterraines (mines, carrières, gypse en région parisienne), éboulements rocheux. Le RGA est devenu un enjeu majeur avec le réchauffement climatique et les sécheresses prolongées récentes.",
        "Le risque sismique est classé en cinq niveaux de zonage (1 à 5, du plus faible au plus fort). Les zones de niveau 2 et plus déclenchent l’obligation d’ERP et imposent des règles parasismiques pour les constructions neuves. Les Antilles françaises (Guadeloupe, Martinique) et la zone des Pyrénées sont les zones les plus exposées en France métropolitaine et ultramarine. La Provence et l’Alsace sont également concernées par un aléa modéré.",
        "Le risque technologique provient de la présence d’établissements industriels classés à risque (sites Seveso bas et haut), de canalisations de transport de matières dangereuses, ou d’installations nucléaires. Les communes situées dans le périmètre de protection d’un site Seveso seuil haut sont soumises à un PPRT qui impose des prescriptions strictes sur les constructions existantes et futures. La France compte environ 700 sites Seveso, dont 100 communes accueillent des installations seuil haut.",
        "Le risque radon est lié à la présence naturelle d’uranium dans certaines roches granitiques. Le radon, gaz radioactif inodore et incolore, peut s’accumuler dans les bâtiments et constitue la deuxième cause de cancer du poumon après le tabac selon l’OMS. Les zones à potentiel radon 3 (Massif central, Bretagne, Vosges, Corse) concentrent environ 7 500 communes. Des mesures simples (ventilation, étanchéité des soubassements) permettent de réduire significativement les concentrations.",
      ],
    },
    {
      id: 'consequences-en-cas-d-omission',
      title: 'Quelles conséquences en cas d’omission de l’ERP',
      level: 2,
      paragraphs: [
        "L’absence d’ERP dans un compromis de vente ou un bail de location expose le vendeur ou le bailleur à des sanctions civiles importantes. L’acquéreur ou le locataire peut, dans un délai de un an à compter de la signature de l’acte, demander la résolution du contrat (annulation de la vente ou du bail) ou une diminution du prix correspondant au préjudice subi. Cette action peut être intentée même si l’acquéreur ou le locataire avait connaissance des risques par d’autres moyens.",
        "Au-delà de la sanction contractuelle, le vendeur ou bailleur peut être condamné au paiement de dommages-intérêts si l’absence d’information sur un risque s’est traduite par un préjudice particulier pour l’acquéreur ou le locataire. Par exemple, l’absence de mention d’une zone d’inondation ayant entraîné la perte de biens lors d’une crue ultérieure peut donner lieu à une condamnation à indemnisation de ces biens.",
        "Pour limiter ce risque, il est recommandé aux vendeurs et bailleurs de générer systématiquement un ERP à jour avant toute signature, même s’ils ont la conviction qu’aucun risque ne s’applique. La démarche est gratuite et rapide via Géorisques et constitue une protection juridique efficace. De plus, l’ERP doit être actualisé en cours de processus de vente si plus de six mois se sont écoulés depuis sa réalisation initiale.",
        "Il est également recommandé aux acquéreurs et locataires de vérifier eux-mêmes les informations de l’ERP en consultant Géorisques avant de s’engager. Cette vérification permet de s’assurer que les informations sont complètes et conformes à la réalité, et facilite la négociation du prix ou des conditions du bail le cas échéant. En cas de doute, la mairie peut être consultée pour obtenir des précisions sur les plans de prévention en vigueur.",
      ],
    },
    {
      id: 'choisir-son-diagnostiqueur',
      title: 'Comment choisir son diagnostiqueur ou son prestataire',
      level: 2,
      paragraphs: [
        "L’ERP est le diagnostic le plus simple à réaliser et la délégation à un professionnel n’est pas systématiquement nécessaire. Pour la plupart des biens, le vendeur ou le bailleur peut générer l’ERP directement via Géorisques en quelques minutes, ce qui constitue la solution la plus économique et la plus rapide. Cette auto-réalisation est juridiquement valable et engage la responsabilité du déclarant comme s’il avait fait appel à un professionnel.",
        "Pour les biens complexes (zone à risque particulier, configuration atypique, antécédents de sinistres) ou pour les vendeurs et bailleurs qui préfèrent déléguer la démarche, un diagnostiqueur certifié peut réaliser l’ERP dans le cadre d’un pack de diagnostics obligatoires. Vérifiez que le professionnel est certifié COFRAC et qu’il dispose d’une assurance responsabilité civile professionnelle adaptée. Le coût marginal de l’ERP dans un pack est généralement très faible (5 à 15 euros).",
        "Pour les biens à risque particulier (proximité d’un site Seveso, zone d’écoulement de coulée de boue, zone inondable à fort enjeu, terrain pollué identifié), une expertise approfondie par un bureau d’études spécialisé peut être utile. Ces bureaux peuvent réaliser des analyses complémentaires (étude de sol, modélisation des risques, expertise des fondations) qui dépassent le périmètre de l’ERP réglementaire. Leur coût (200 à 800 euros) peut être largement compensé par la sécurisation de l’achat et l’optimisation de la couverture d’assurance.",
      ],
    },
    {
      id: 'cas-particuliers',
      title: 'Cas particuliers et situations spéciales',
      level: 2,
      paragraphs: [
        "Plusieurs situations particulières demandent une attention spécifique pour l’ERP. Les biens situés en zone côtière soumise au recul du trait de côte sont concernés par une nouvelle obligation d’information depuis le 1ᵉʳ janvier 2023. Environ 130 communes littorales françaises sont classées comme particulièrement vulnérables au changement climatique, et l’ERP doit mentionner explicitement le niveau d’exposition du bien. Cette information est cruciale pour l’acquéreur car certains biens proches du trait de côte pourraient devenir inhabitables à moyen terme (10-50 ans) en raison de l’érosion ou de la submersion.",
        "Les biens situés dans le périmètre d’un PPRT (plan de prévention des risques technologiques) autour d’un site Seveso seuil haut sont soumis à des prescriptions strictes. L’ERP doit mentionner les contraintes applicables au bien : interdiction d’ajouter des étages, obligations de renforcement parasismique ou anti-souffle, restrictions d’usage. Ces contraintes peuvent significativement impacter la valeur du bien et limiter les projets de rénovation ou d’extension. Pour ces biens, une consultation du PPRT complet en mairie est indispensable avant tout engagement d’achat.",
        "Les communes touchées par le retrait-gonflement des argiles (RGA) représentent environ 50 % du territoire français. Le RGA, accentué par les sécheresses prolongées récentes, est responsable de nombreux sinistres sur les constructions (fissures, désordres structurels). Pour les biens en zone RGA d’aléa moyen ou fort, des prescriptions techniques s’appliquent aux constructions neuves (fondations renforcées, gestion de l’humidité autour de la maison, choix des plantations). Les biens anciens en zone RGA doivent faire l’objet d’une vigilance particulière sur l’état des fondations et des murs porteurs.",
        "Les biens situés en zone à potentiel radon 3 (Massif central, Bretagne, Vosges, Corse) doivent intégrer cette information dans l’ERP. Le radon, gaz radioactif d’origine naturelle, peut s’accumuler dans les bâtiments et constitue la deuxième cause de cancer du poumon après le tabac selon l’OMS. Les mesures de prévention sont simples (ventilation, étanchéité des soubassements) et peu coûteuses (quelques centaines d’euros), mais doivent être mises en œuvre systématiquement pour les biens situés dans ces zones. Une mesure de la concentration en radon est recommandée et peut être réalisée gratuitement ou pour quelques dizaines d’euros par certains organismes.",
        "Les biens situés à proximité d’un ancien site industriel (base BASIAS) ou d’un site pollué connu (base BASOL) doivent faire l’objet d’une vigilance renforcée. La pollution des sols peut être à l’origine de contaminations des eaux souterraines, de vapeurs intérieures dans les bâtiments, ou de dépôts surfaciques toxiques. Une analyse de sol par un bureau d’études spécialisé (300 à 1 500 euros) peut révéler des contaminations invisibles à l’œil nu et permettre d’adapter le projet immobilier en conséquence (assainissement, dépollution, recouvrement).",
      ],
    },
    {
      id: 'erreurs-frequentes',
      title: 'Erreurs fréquentes à éviter',
      level: 2,
      paragraphs: [
        "Une première erreur fréquente consiste à négliger la mise à jour de l’ERP en cours de processus de vente. La validité de l’ERP est de seulement six mois, et le délai entre la signature du compromis et l’acte authentique peut largement excéder cette durée (notamment lorsque le financement de l’acquéreur prend du temps). Un ERP périmé au moment de l’acte authentique constitue un défaut qui peut être invoqué par l’acquéreur pour contester la vente ou exiger une diminution du prix. La règle simple est de vérifier la validité de l’ERP juste avant la signature notariée et de le renouveler si nécessaire.",
        "Une deuxième erreur consiste à ne pas mentionner les sinistres antérieurs ayant fait l’objet d’une indemnisation. Cette obligation, qui repose sur le vendeur ou bailleur déclarant, est souvent oubliée par méconnaissance ou par négligence. Or, elle est cruciale pour l’acquéreur ou le locataire qui doit pouvoir apprécier la fréquence réelle des événements et adapter sa couverture d’assurance en conséquence. La déclaration intentionnellement incomplète peut engager la responsabilité civile du déclarant en cas de sinistre ultérieur non couvert.",
        "Une troisième erreur consiste à utiliser un ERP généré par un service tiers payant alors que Géorisques le fournit gratuitement. Plusieurs sites internet commerciaux proposent des « ERP rapides » à 10-30 euros qui ne font que reformater les informations publiques de Géorisques. Cette pratique est légale mais inutile, et expose à des risques si le site tiers ne met pas à jour ses données en temps réel. La solution Géorisques officielle est gratuite, exhaustive et toujours à jour.",
        "Une quatrième erreur consiste à confondre les niveaux d’aléa. L’ERP mentionne les zones d’aléa selon une échelle qui varie selon le risque (faible/moyen/fort pour les inondations, niveau 1-5 pour les séismes, etc.). Un aléa fort ne signifie pas qu’un sinistre est certain, et un aléa faible ne signifie pas qu’aucun sinistre ne peut survenir. La lecture de l’ERP doit toujours être faite en lien avec le plan de prévention applicable (PPRN, PPRT) qui détaille les prescriptions opérationnelles. La consultation de ces plans en mairie ou sur Géorisques est utile pour comprendre les implications réelles.",
        "Une cinquième erreur consiste à minimiser l’impact de l’ERP sur la valeur du bien. Un bien situé en zone d’aléa fort sur un risque majeur (inondation, mouvement de terrain) subit généralement une décote de 5 à 15 % par rapport à un bien comparable hors zone à risque. Cette décote peut atteindre 20 à 30 % pour les biens soumis à des prescriptions individuelles strictes ou exposés à un recul du trait de côte. Anticiper cette décote dans les négociations et dans le plan de financement est essentiel pour éviter les déconvenues.",
      ],
    },
    {
      id: 'points-cles-a-retenir',
      title: 'Récapitulatif des points-clés à retenir',
      level: 2,
      paragraphs: [
        "L’ERP (état des risques et pollutions) est le document d’information obligatoire qui synthétise les risques naturels, miniers, technologiques et de pollution des sols auxquels un bien immobilier est exposé. Son périmètre s’est progressivement enrichi depuis sa création en 2006 et inclut désormais le radon, la pollution des sols, le recul du trait de côte pour les communes littorales, les arrêtés de catastrophe naturelle des cinq dernières années, et le retrait-gonflement des argiles. La quasi-totalité des communes françaises sont concernées par au moins un des critères qui rendent l’ERP obligatoire.",
        "L’ERP est exigé dans toutes les transactions immobilières : vente, location vide ou meublée, donation, partage successoral. Sa validité est limitée à six mois, ce qui impose souvent un renouvellement en cours de processus de vente. L’absence d’ERP ou un ERP périmé expose le vendeur ou bailleur à des sanctions civiles importantes : l’acquéreur ou le locataire peut demander la résolution du contrat ou une diminution du prix dans le délai d’un an à compter de la signature, avec d’éventuels dommages-intérêts en cas de préjudice particulier.",
        "L’ERP peut être généré gratuitement par le vendeur ou le bailleur lui-même via le site Géorisques (georisques.gouv.fr), service public géré par le ministère de la Transition écologique et le BRGM. Cette démarche prend moins de cinq minutes et produit un document officiel directement utilisable. Pour les biens à risque particulier (proximité de site Seveso, zone d’inondation à fort enjeu, terrain pollué), une expertise complémentaire par un diagnostiqueur certifié ou un bureau d’études spécialisé peut être utile, pour un coût modeste (15 à 40 euros pour un diagnostiqueur, 200 à 800 euros pour un bureau d’études).",
        "Le document ERP suit un formulaire standardisé qui présente les risques applicables avec, pour chacun, le plan de prévention de référence, la zone d’aléa (faible, moyen, fort, très fort) et les éventuelles prescriptions individuelles applicables au bien. Une section dédiée traite des sinistres antérieurs ayant fait l’objet d’une indemnisation au titre de la catastrophe naturelle, à renseigner par le vendeur ou bailleur. Une déclaration intentionnellement incomplète peut engager la responsabilité civile du déclarant en cas de sinistre ultérieur.",
        "Les principaux risques en France incluent les inondations (17 millions de personnes concernées), les mouvements de terrain (dont le RGA qui touche 50 % des communes), les séismes (zonage en cinq niveaux), les risques technologiques (700 sites Seveso, 100 en seuil haut), le radon (7 500 communes en zone 3, principalement Massif central, Bretagne, Vosges, Corse), et le recul du trait de côte (130 communes littorales vulnérables). Chaque risque a ses spécificités et nécessite une lecture attentive de l’ERP combinée à la consultation du plan de prévention applicable.",
        "L’impact de l’ERP sur la valeur d’un bien peut être significatif. Une zone d’aléa fort sur un risque majeur génère typiquement une décote de 5 à 15 %, qui peut atteindre 20 à 30 % pour les biens soumis à des prescriptions strictes ou exposés à un recul du trait de côte. Anticiper cette décote dans les négociations est essentiel pour le vendeur, et la consultation préalable du plan de prévention permet à l’acquéreur de comprendre les contraintes opérationnelles (travaux, assurance, restrictions d’usage) qui pèseront sur le bien acquis.",
        "Pour les acquéreurs comme pour les bailleurs, la lecture attentive de l’ERP n’est qu’un point de départ. Une consultation complémentaire du plan de prévention applicable (PPRN, PPRT, etc.) en mairie ou sur Géorisques permet d’appréhender concrètement les prescriptions individuelles qui pèsent sur le bien : limitations d’usage, obligations de travaux préventifs, contraintes d’assurance. Pour les biens à risque significatif, la souscription d’une assurance multirisque habitation avec garanties spécifiques (catastrophe naturelle, technologique, dommages-ouvrage renforcés) est indispensable et son coût peut représenter une charge fixe importante à long terme.",
        "Enfin, l’ERP doit être considéré comme un outil de gestion patrimoniale active et non comme une simple formalité administrative. Les propriétaires bailleurs qui anticipent les évolutions du zonage (notamment le recul du trait de côte pour les communes littorales et l’extension des zones d’inondation liée au changement climatique) peuvent adapter leur stratégie patrimoniale : travaux préventifs, diversification géographique, vente anticipée des biens les plus exposés. Cette vision prospective protège la valeur du patrimoine et évite les déconvenues à long terme face à des risques en évolution rapide.",
      ],
    },
  ],
  faq: [
    {
      question: 'L’ERP est-il obligatoire dans toutes les communes ?',
      answer:
        "L’ERP est obligatoire dans les communes concernées par un plan de prévention (PPRN, PPRM, PPRT), une zone sismique 2-5 ou une zone à potentiel radon 3. En pratique, la quasi-totalité des communes françaises sont concernées par au moins l’un de ces critères.",
    },
    {
      question: 'Quelle est la durée de validité d’un ERP ?',
      answer:
        "La validité est de 6 mois à compter de la date de signature du document.",
    },
    {
      question: 'Peut-on réaliser un ERP soi-même ?',
      answer:
        "Oui, l’ERP peut être généré gratuitement par le vendeur ou bailleur sur le site Géorisques (georisques.gouv.fr). La démarche prend moins de 5 minutes et le document est juridiquement valable.",
    },
    {
      question: 'Combien coûte un ERP ?',
      answer:
        "L’ERP est gratuit via Géorisques. Un ERP réalisé par un diagnostiqueur certifié coûte 15 à 40 € TTC, et est généralement inclus gratuitement dans un pack de diagnostics obligatoires.",
    },
    {
      question: 'L’ERP est-il obligatoire pour une location meublée ?',
      answer:
        "Oui, l’ERP est obligatoire pour toute location, vide ou meublée, principale ou secondaire, dès lors que le bien est situé dans une commune concernée par un plan de prévention.",
    },
    {
      question: 'Quels risques sont couverts par l’ERP ?',
      answer:
        "Inondations, mouvements de terrain, séismes, avalanches, feux de forêt, éruptions volcaniques, risques miniers, risques technologiques, radon, pollution des sols, recul du trait de côte et retrait-gonflement des argiles.",
    },
    {
      question: 'Que se passe-t-il en cas d’omission de l’ERP ?',
      answer:
        "L’acquéreur ou le locataire peut demander la résolution du contrat ou une diminution du prix dans le délai d’un an à compter de la signature. Des dommages-intérêts peuvent également être réclamés en cas de préjudice particulier.",
    },
    {
      question: 'Le radon est-il systématiquement mentionné dans l’ERP ?',
      answer:
        "Le radon n’est mentionné que pour les communes situées en zone à potentiel radon 3 (potentiel significatif), soit environ 7 500 communes en France (Massif central, Bretagne, Vosges, Corse principalement).",
    },
    {
      question: 'L’ERP couvre-t-il les anciennes activités industrielles ?',
      answer:
        "Oui, depuis 2018, l’ERP intègre la mention des sites pollués répertoriés dans les bases BASOL et BASIAS. Cette information permet à l’acquéreur d’engager des investigations complémentaires si nécessaire.",
    },
    {
      question: 'Faut-il refaire l’ERP en cas de prolongation du processus de vente ?',
      answer:
        "Oui, si plus de 6 mois s’écoulent entre la signature du compromis et l’acte authentique, l’ERP doit être actualisé avec une nouvelle date.",
    },
    {
      question: 'Le RGA (retrait-gonflement des argiles) est-il dans l’ERP ?',
      answer:
        "Oui, depuis 2025, le RGA est mentionné dans l’ERP avec le niveau d’aléa (faible, moyen, fort) applicable au bien. Cette mention est importante car le RGA touche 50 % des communes françaises.",
    },
    {
      question: 'Comment vérifier l’exactitude d’un ERP ?',
      answer:
        "Consultez Géorisques avec l’adresse précise du bien et comparez avec les informations renseignées dans l’ERP. Vous pouvez également contacter la mairie pour confirmer les plans de prévention en vigueur.",
    },
    {
      question: 'L’ERP est-il valable pour une donation ?',
      answer:
        "Oui, l’ERP est exigé en cas de donation, de partage successoral ou de toute autre opération transférant la propriété d’un immeuble.",
    },
    {
      question: 'Le bailleur doit-il informer des sinistres passés ?',
      answer:
        "Oui, le bailleur doit mentionner dans l’ERP les sinistres antérieurs ayant fait l’objet d’une indemnisation au titre de la catastrophe naturelle dans son logement.",
    },
    {
      question: 'L’ERP est-il obligatoire pour un terrain non bâti ?',
      answer:
        "Oui, l’ERP s’applique également aux terrains non bâtis situés dans une commune concernée par un plan de prévention. Cette information est précieuse en vue d’une construction future.",
    },
  ],
}
