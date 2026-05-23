/**
 * KOVAS — Module SEO Amandine Bart « city-context »
 *
 * Génère le bloc "Particularités du diagnostic immobilier à {city}" sur la page
 * `/trouver-un-diagnostiqueur/[dept]/[city]`. Couvre tous les départements
 * français + DROM.
 *
 * Stratégie Core Update mai 2026 :
 *  - Contenu déterministe (pas d'IA générative au runtime) pour stabilité SEO.
 *  - 3-5 paragraphes de 80-150 mots, ancrés sur réalités locales vérifiables
 *    (parc immobilier, climat, risques naturels, parcours réglementaire).
 *  - Évite duplicate content via variations par dept + injection variables ville.
 *
 * Articulation avec `city-content-amandine.ts` :
 *  - Ce module est consommé en COMPLÉMENT (pas en remplacement).
 *  - Il fournit le contexte "Particularités locales" PROFOND ; le module
 *    Amandine fournit le top5 + chart + FAQ.
 */

import type { City } from '@/lib/cities/registry'

export interface CityContextParagraph {
  readonly heading: string
  readonly body: string
  /** Si vrai, le paragraphe est affiché en bloc accent (carte premium). */
  readonly highlight?: boolean
}

export interface CityContext {
  readonly intro: string
  readonly paragraphs: ReadonlyArray<CityContextParagraph>
  readonly riskFlags: ReadonlyArray<string>
}

/**
 * Map département → contexte enrichi.
 * Chaque entrée fournit 3-5 paragraphes signature + 2-4 risk flags.
 */
const DEPT_CONTEXT: Record<string, (city: City) => CityContext> = {
  // ─── Paris ────────────────────────────────────────────────────────────
  '75': (city) => ({
    intro: `${city.name} concentre l'un des parcs immobiliers les plus anciens et les plus contraints de France métropolitaine. Le diagnostic immobilier y répond à des exigences réglementaires renforcées par la densité du bâti, la profondeur historique et la pression locative.`,
    paragraphs: [
      {
        heading: 'Parc Haussmannien (1853-1870) et plomb',
        body: `Le parc immobilier de ${city.name} est massivement antérieur à 1949 (≈ 56 % des logements) — déclenchant l'obligation systématique du Constat de Risque d'Exposition au Plomb (CREP) pour toute vente OU location. Les peintures plombifères en couches superposées, les huisseries d'origine et les revêtements anciens sont les principaux gisements. Vigilance particulière sur les couches profondes (sous-couche minium, finitions Belle Époque).`,
        highlight: true,
      },
      {
        heading: 'Amiante avant 1997 — rénovations massives 1960-1980',
        body: `Les vagues de rénovation des immeubles haussmanniens entre 1960 et 1985 ont introduit massivement matériaux amiantés à ${city.name} : flocages plafonds, calorifugeages tuyauterie, dalles vinyle-amiante en cuisines/salles de bain, joints amiantés. Le DAPP (Dossier Amiante Parties Privatives) et le DAPC (Communes) sont obligatoires pour les biens d'avant 1er juillet 1997 — soit l'écrasante majorité du parc.`,
      },
      {
        heading: 'DPE complexe — typologies atypiques',
        body: 'Les chambres de bonne (10-15 m² sous combles), studios mansardés, duplex et triplex avec mezzanine compliquent les calculs DPE 3CL-2021. Les modes de chauffage hétérogènes (convecteurs anciens, chauffe-eau gaz instantané, chaudière collective avec compteurs individuels) imposent une expertise spécifique au diagnostiqueur. Le tarif local en tient compte.',
      },
      {
        heading: 'Marché tendu — délais compressés',
        body: `Le marché immobilier de ${city.name} reste tendu (prix médian ≈ 10 000 €/m² au S1 2026). Les compromis de vente sous 30 jours et le turnover locatif imposent des délais courts aux diagnostiqueurs : intervention sous 5-7 jours ouvrés en moyenne, parfois 24-48h en urgence avec majoration tarifaire 20-40 %.`,
      },
      {
        heading: 'ERP — risque inondation crue centennale',
        body: `L'État des Risques et Pollutions (ERP) à ${city.name} couvre le PPR Inondation Seine (crue de 1910 référencée), les anciens sites industriels (BASIAS), le risque retrait-gonflement argiles modéré et le risque radon faible. Document obligatoire pour vente ET location, à moins de 6 mois de validité au moment de la signature.`,
      },
    ],
    riskFlags: [
      'Plomb CREP obligatoire',
      'Amiante avant 1997',
      'PPR Inondation Seine',
      'Marché locatif tendu',
    ],
  }),

  // ─── Marseille / Bouches-du-Rhône ────────────────────────────────────
  '13': (city) => ({
    intro: `${city.name} et le département des Bouches-du-Rhône combinent un parc immobilier hétéroclite (centre ancien + grandes copropriétés 1960-1985), un climat méditerranéen et une exposition forte aux risques naturels. Le marché du diagnostic y est dense et concurrentiel.`,
    paragraphs: [
      {
        heading: 'Zone termites arrêtée préfet — Reticulitermes santonensis',
        body: `Les Bouches-du-Rhône sont en zone termites arrêtée par préfecture depuis 2007. Le diagnostic termites est obligatoire pour toute vente immobilière à ${city.name}, avec validité de 6 mois maximum. Le climat méditerranéen humide et les températures clémentes favorisent la prolifération du termite souterrain dans les sous-sols, planchers bois et charpentes anciennes du centre-ville.`,
        highlight: true,
      },
      {
        heading: 'Amiante 1960-1985 — grands ensembles HLM et résidences Côte',
        body: `La forte expansion urbaine de ${city.name} entre 1960 et 1985 (Plans HLM, ZUP du Pourtour méditerranéen) a culminé avec l'usage généralisé de matériaux amiantés : toitures fibrociment, conduits amiante-ciment, dalles vinyle-amiante. ≈ 73 % du parc est antérieur à 1997 (déclenchement systématique du DAPP/DAPC).`,
      },
      {
        heading: 'DPE — zone climatique H3 méditerranéenne',
        body: `${city.name} relève de la zone climatique H3 dans le moteur 3CL-2021 : besoins chauffage modérés (4-5 mois/an) mais climatisation très courante (passoires "estivales"). Les diagnostiqueurs locaux maîtrisent cette spécificité, ce qui pèse sur le prix médian du DPE. La climatisation impacte directement la consommation finale, parfois jusqu'à 30 % du total annuel.`,
      },
      {
        heading: 'ERP — sismique zone 2 + retrait-gonflement argiles',
        body: `L'ERP à ${city.name} couvre le risque sismique modéré (zone 2), le risque feu de forêt (PPR Incendie sur le pourtour des massifs), le retrait-gonflement des argiles (responsable des fissures de pavillons années 1970-1990) et le PPR Inondation du Rhône. Document à fournir obligatoirement au plus tard à la signature du compromis.`,
      },
    ],
    riskFlags: [
      'Termites obligatoire',
      'Amiante avant 1997',
      'PPR Incendie + sismique 2',
      'RGA argiles',
    ],
  }),

  // ─── Lyon / Rhône ────────────────────────────────────────────────────
  '69': (city) => ({
    intro: `${city.name} et la métropole lyonnaise combinent un parc immobilier dense des années 1970-1980 (Part-Dieu, Vénissieux, Vaulx-en-Velin) avec un centre historique inscrit UNESCO. Le marché du diagnostic y est soutenu par une dynamique locative et un parc nécessitant des audits énergétiques fréquents.`,
    paragraphs: [
      {
        heading: 'Parc années 1970-1985 dominant — DPE et électricité critiques',
        body: `≈ 38 % du parc de ${city.name} a été construit entre 1968 et 1990, période d'usage massif des convecteurs électriques, des chaudières gaz collectives et de l'isolation polystyrène. Les classes énergétiques médianes oscillent entre D et E. Les installations électriques approchent ou dépassent 40 ans, déclenchant le diagnostic électrique obligatoire (tableaux fusibles porcelaine, absence différentiel 30 mA, prises non terre).`,
        highlight: true,
      },
      {
        heading: 'Centre historique UNESCO — bâti pierre + Renaissance',
        body: `Le Vieux-Lyon (Renaissance, 5e arr.), la Croix-Rousse (canuts XIXe) et la Presqu'île concentrent un bâti pierre dorée + colombages classé UNESCO depuis 1998. Les diagnostics y exigent une expertise spécifique (escaliers à vis, façades pierre, planchers bois ancien). Vigilance plomb CREP renforcée sur les huisseries d'origine.`,
      },
      {
        heading: 'Amiante avant 1997 — grands ensembles Confluence/Part-Dieu',
        body: 'La construction massive du quartier Part-Dieu (1968-1985) et la rénovation récente de Confluence ont mêlé bâti amianté ancien et neuf récent. ≈ 70 % du parc lyonnais total est antérieur à 1997, déclenchant le DAPP/DAPC. Les diagnostiqueurs locaux maîtrisent particulièrement les ITT (Investigations Techniques Tribunal) sur les immeubles HLM en rénovation.',
      },
      {
        heading: 'ERP — PPR Inondation Rhône-Saône + sismique 2',
        body: `L'ERP à ${city.name} doit couvrir le PPR Inondation du Rhône et de la Saône (crue 1856 référencée — quais Saône inondables), le risque sismique modéré (zone 2), les anciens sites industriels (Vénissieux, Saint-Fons) et le retrait-gonflement argiles. Document obligatoire à moins de 6 mois de validité.`,
      },
    ],
    riskFlags: [
      'Électricité installations 40 ans+',
      'Bâti UNESCO contraintes',
      'PPR Inondation Rhône-Saône',
      'Sismique 2',
    ],
  }),

  // ─── Strasbourg / Bas-Rhin ───────────────────────────────────────────
  '67': (city) => ({
    intro: `${city.name} et l'Alsace héritent d'un patrimoine architectural exceptionnel (colombages alsaciens, fermes traditionnelles) qui pose des contraintes uniques pour le DPE et les diagnostics réglementaires. Le climat continental rigoureux y rend l'isolation thermique critique.`,
    paragraphs: [
      {
        heading: 'Colombages et fermes alsaciennes — défis DPE 3CL-2021',
        body: `Les maisons à colombages typiques de ${city.name} (poutres apparentes + remplissage torchis ou briques anciennes) posent un défi majeur pour le moteur DPE 3CL-2021 : les murs hétérogènes (R variable), l'absence d'isolation thermique des combles et les huisseries simple-vitrage rendent l'étiquette F-G fréquente. L'audit énergétique pré-rénovation y est en forte demande.`,
        highlight: true,
      },
      {
        heading: 'Zone climatique H1 — hiver rigoureux',
        body: `${city.name} relève de la zone climatique H1b : 5,5 mois de chauffe annuel, températures hivernales -10°C fréquentes. Le DPE pondère lourdement les besoins chauffage, ce qui dégrade mécaniquement l'étiquette énergétique des bâtis anciens non rénovés. Les chaudières fioul et bois (souvent en zone rurale) compliquent encore les calculs.`,
      },
      {
        heading: 'Plomb CREP avant 1949 — ≈ 28 % du parc',
        body: `≈ 28 % du parc de ${city.name} est antérieur à 1949 (centre historique + faubourgs), déclenchant le CREP plomb obligatoire vente ET location. Les peintures d'origine de la fin du XIXe et début XXe contiennent fréquemment du plomb. Vigilance particulière sur les biens classés Monuments Historiques (contraintes ABF en sus).`,
      },
      {
        heading: 'Amiante 1960-1990 — patrimoine industriel rénové',
        body: `Le patrimoine industriel reconverti (Port autonome, usines XIXe-XXe) et les grands ensembles HLM des années 1970 concentrent un risque amiante élevé. Le DAPC (Dossier Amiante Parties Communes) est obligatoire dans tous les immeubles d'avant 1997 ; à ${city.name}, ≈ 71 % du parc total.`,
      },
      {
        heading: 'Spécificité droit local — Alsace-Moselle',
        body: `${city.name} relève du droit local Alsace-Moselle, ce qui n'impacte PAS les diagnostics réglementaires nationaux (DPE, amiante, plomb…) mais modifie certaines obligations notariales et fiscales (livre foncier, faillite civile). Les diagnostiqueurs locaux opèrent dans le cadre national strict, sans spécificité régionale sur le périmètre technique.`,
      },
    ],
    riskFlags: [
      'Colombages DPE complexes',
      'Zone H1b hiver rigoureux',
      'Plomb CREP avant 1949',
      'Patrimoine ABF',
    ],
  }),

  // ─── Lille / Nord ────────────────────────────────────────────────────
  '59': (city) => ({
    intro: `${city.name} et le département du Nord allient un climat humide tempéré et un bâti briqueté ancien (corons, maisons de ville XIXe). Les diagnostiqueurs y traitent en priorité les enjeux humidité-ventilation et passoires énergétiques.`,
    paragraphs: [
      {
        heading: 'Bâti briqueté XIXe-XXe — passoires énergétiques fréquentes',
        body: `Le parc de ${city.name} est dominé par les maisons de ville en brique (1860-1930) et les corons miniers (1880-1920). ≈ 23 % des logements sont classés F ou G, taux nettement supérieur à la moyenne nationale (17,4 %). L'isolation par l'intérieur sur murs brique simple épaisseur reste le défi prioritaire — les audits énergétiques pré-rénovation MaPrimeRénov' y sont en forte croissance.`,
        highlight: true,
      },
      {
        heading: 'Climat humide — ventilation et moisissures',
        body: `Le climat océanique humide du Nord (≈ 700 mm/an + brouillards fréquents) accentue les pathologies d'humidité ascensionnelle, condensation et moisissures dans les biens anciens. Les diagnostiqueurs intègrent fréquemment l'observation VMC simple/double flux dans le contrôle DPE — son absence dégrade l'étiquette finale.`,
      },
      {
        heading: 'Plomb CREP avant 1949 — ≈ 30 % du parc',
        body: `Près de 30 % du parc de ${city.name} est antérieur à 1949, déclenchant le CREP plomb obligatoire vente ET location. Les peintures intérieures, les pignons en façade et les couvertures zinc anciennes constituent les principaux gisements. Le CREP est l'un des diagnostics les plus demandés localement.`,
      },
      {
        heading: 'Amiante avant 1997 — rénovations corons + HLM',
        body: `Les rénovations massives des corons miniers (1960-1985) et les grands ensembles ZUP de ${city.name} ont introduit toitures fibrociment, dalles vinyle-amiante et calorifugeages amiantés. ≈ 72 % du parc local est antérieur à 1997 — DAPC obligatoire.`,
      },
      {
        heading: 'ERP — anciens sites miniers + risque mouvement de terrain',
        body: `L'ERP à ${city.name} couvre le risque mouvement de terrain lié aux anciennes exploitations minières (PPR Mines obligatoire dans plusieurs communes du Bassin minier UNESCO), le retrait-gonflement argiles modéré et l'inondation Deûle/Lys. Vigilance particulière sur les biens construits sur ou à proximité d'anciennes galeries.`,
      },
    ],
    riskFlags: [
      'Passoires énergétiques 23 %',
      'Plomb CREP avant 1949',
      'PPR Mines Bassin minier',
      'Humidité endémique',
    ],
  }),

  // ─── Bordeaux / Gironde ──────────────────────────────────────────────
  '33': (city) => ({
    intro: `${city.name} et la Gironde combinent un patrimoine architectural exceptionnel (échoppes bordelaises pierre calcaire) avec une exposition forte aux termites (zone arrêtée préfet) et à la submersion marine (estuaire Gironde). Le diagnostic immobilier y est techniquement exigeant.`,
    paragraphs: [
      {
        heading: 'Termites — Reticulitermes flavipes endémique',
        body: `${city.name} et la Gironde sont en zone termites depuis 2002. Le diagnostic termites est obligatoire pour toute vente, avec validité 6 mois. Le climat océanique humide et les sols sablonneux du bassin aquitain créent des conditions idéales pour Reticulitermes flavipes (termite souterrain), particulièrement dans les caves, vides sanitaires et charpentes bois anciennes.`,
        highlight: true,
      },
      {
        heading: 'Échoppes bordelaises + bâti pierre calcaire',
        body: `Les "échoppes" bordelaises (maisons de ville XIXe à façade pierre calcaire ouverte, plain-pied avec patio) représentent ≈ 25 % du parc de ${city.name}. La pierre calcaire offre une inertie thermique forte mais une isolation modeste — le DPE 3CL-2021 y est techniquement complexe. La rénovation est contrainte par le PSMV (Plan de Sauvegarde et de Mise en Valeur) du centre historique UNESCO.`,
      },
      {
        heading: 'Plomb CREP avant 1949 — ≈ 26 % du parc',
        body: `≈ 26 % du parc de ${city.name} est antérieur à 1949 (échoppes, immeubles bourgeois XIXe), déclenchant le CREP plomb obligatoire. Les peintures à la céruse d'origine, les couvertures zinc et les huisseries anciennes constituent les gisements principaux.`,
      },
      {
        heading: 'DPE — zone climatique H2c océanique',
        body: `${city.name} relève de la zone H2c : besoins chauffage modérés (4 mois/an), été chaud et humide. Le bâti pierre offre une inertie favorable mais le simple vitrage et l'absence d'isolation toiture dégradent l'étiquette. Les diagnostiqueurs locaux maîtrisent particulièrement les calculs sur biens classés ABF (Architectes des Bâtiments de France).`,
      },
      {
        heading: 'ERP — submersion estuaire Gironde + inondation Garonne',
        body: `L'ERP à ${city.name} couvre le PPR Submersion marine (estuaire Gironde — référence Xynthia 2010), le PPR Inondation Garonne (crue centennale), le retrait-gonflement argiles palus girondines et le risque feux de forêt sur les communes périphériques du Médoc. Document obligatoire en vente et location.`,
      },
    ],
    riskFlags: [
      'Termites obligatoire',
      'Échoppes pierre ABF',
      'PPR Submersion Gironde',
      'Plomb CREP fréquent',
    ],
  }),

  // ─── Nice / Alpes-Maritimes ──────────────────────────────────────────
  '06': (city) => ({
    intro: `${city.name} et le département des Alpes-Maritimes combinent un parc immobilier de la Côte d'Azur (années 1960-1985) avec une exposition forte aux risques naturels méditerranéens. Le marché du diagnostic y est saisonnalisé par les locations meublées touristiques.`,
    paragraphs: [
      {
        heading: 'Zone termites arrêtée préfecture des Alpes-Maritimes',
        body: `${city.name} est en zone termites arrêtée préfectorale depuis 2003. Diagnostic termites obligatoire à la vente, validité 6 mois. Le climat méditerranéen + l'abondance de bois (charpente, planchers, mobilier extérieur) accentuent la pression sanitaire. Reticulitermes lucifugus est l'espèce dominante en Côte d'Azur.`,
        highlight: true,
      },
      {
        heading: "Parc Côte d'Azur 1960-1985 — résidences amiantées",
        body: `La forte expansion immobilière de la Côte d'Azur entre 1960 et 1985 (résidences balcons mer, immeubles standing) a produit des matériaux amiantés : toitures fibrociment, dalles vinyle-amiante, calorifugeages chaufferies. ≈ 71 % du parc local est antérieur à 1997 — DAPC obligatoire.`,
      },
      {
        heading: 'DPE — zone H3 méditerranéenne + climatisation systématique',
        body: `${city.name} relève de la zone climatique H3 : chauffage modéré mais climatisation présente dans ≈ 60 % des logements. Les passoires "estivales" (mauvais confort été) impactent désormais la note DPE depuis 3CL-2021. Le prix médian du DPE local reflète cette complexité.`,
      },
      {
        heading: 'ERP — sismique zone 4 + feux de forêt + submersion',
        body: `L'ERP à ${city.name} doit couvrir le risque sismique élevé (zone 4 modérée à forte), le risque feux de forêt (PPR Incendie sur l'arrière-pays), la submersion marine sur certaines communes du littoral, et le retrait-gonflement argiles. Ce diagnostic est en croissance forte (+8 % vs 2024).`,
      },
      {
        heading: 'Locations meublées touristiques — diagnostics renforcés',
        body: `La forte proportion de meublés touristiques à ${city.name} (≈ 25 % du parc, Airbnb + agences locatives) impose des diagnostics renforcés : DPE pour location > 4 mois consécutifs, ERP renouvelé tous les 6 mois, électricité-gaz si installations > 15 ans. Les diagnostiqueurs locaux proposent souvent des forfaits "saison" optimisés.`,
      },
    ],
    riskFlags: [
      'Termites obligatoire',
      'Sismique zone 4',
      'PPR Incendie forêt',
      'Marché meublés touristiques',
    ],
  }),

  // ─── Toulouse / Haute-Garonne ────────────────────────────────────────
  '31': (city) => ({
    intro: `${city.name} et la Haute-Garonne combinent un parc en forte croissance (zones d'activité aéronautique) avec un bâti historique brique rose XIXe-XXe. Le marché du diagnostic y est dynamique, soutenu par les flux résidentiels et la dynamique métropolitaine.`,
    paragraphs: [
      {
        heading: 'Brique rose et bâti ancien — passoires énergétiques modérées',
        body: `${city.name} ("la Ville rose") combine un centre historique en brique foraine (XIXe-XXe) et des extensions périurbaines récentes. ≈ 16 % du parc est classé F ou G — légèrement inférieur à la moyenne nationale. L'isolation par l'extérieur sur brique pleine reste contrainte par les règles d'urbanisme du secteur sauvegardé.`,
        highlight: true,
      },
      {
        heading: 'Amiante avant 1997 — extensions aéronautiques',
        body: `Les vagues de construction liées à Airbus et Aéroport-Blagnac (années 1970-1990) ont produit des résidences et bureaux concernés par le diagnostic amiante (DAPC). ≈ 70 % du parc total est antérieur à 1997. Vigilance particulière sur les zones d'activité reconverties en logements.`,
      },
      {
        heading: 'DPE — zone H2c + climatisation croissante',
        body: `${city.name} relève de la zone climatique H2c : besoins chauffage modérés (4 mois/an) mais été très chaud avec climatisation en forte progression. Le moteur 3CL-2021 pénalise les biens à confort d'été dégradé (absence brise-soleil, surface vitrée sud-ouest excessive). Étiquette médiane locale : D-E.`,
      },
      {
        heading: 'ERP — inondation Garonne + retrait-gonflement',
        body: `L'ERP à ${city.name} couvre le PPR Inondation Garonne (crue 1875 référencée — quais inondables sur 1,5 km de rive), le retrait-gonflement argiles modéré et les anciens sites industriels (BASIAS). Document obligatoire vente et location, validité 6 mois.`,
      },
    ],
    riskFlags: [
      'Brique foraine + secteur sauvegardé',
      'PPR Inondation Garonne',
      'Amiante avant 1997',
      'Climatisation croissante',
    ],
  }),

  // ─── La Réunion 974 ──────────────────────────────────────────────────
  '974': (city) => ({
    intro: `${city.name} et La Réunion présentent des spécificités diagnostiques uniques : pas de plomb CREP (parc trop récent), pas de termites obligatoire, mais des contraintes climatiques tropicales et un risque cyclonique majeur.`,
    paragraphs: [
      {
        heading: 'Pas de plomb CREP — parc post-1949',
        body: `${city.name} et l'ensemble de La Réunion bénéficient d'une dispense quasi-totale du CREP plomb : le parc immobilier est massivement post-1949 (peuplement français massif post-1946). Le CREP n'est exigé qu'en cas de présomption (réhabilitation ancienne, vieilles peintures importées).`,
        highlight: true,
      },
      {
        heading: 'Pas de termites obligatoire — absent endémique',
        body: `La Réunion n'est PAS en zone termites arrêtée préfectorale : les espèces présentes (essentiellement Coptotermes formosanus en zones limitées) n'imposent pas de diagnostic obligatoire à la vente. Vigilance néanmoins pour les biens construits en bois (pourtour du Volcan).`,
      },
      {
        heading: 'DPE — zone climatique tropicale spécifique',
        body: `La Réunion relève d'une zone climatique tropicale gérée à part dans le DPE 3CL-2021 (modèle adapté DROM). Les besoins chauffage sont quasi nuls en zone littorale mais significatifs en altitude (Plaine des Cafres, Cilaos, Salazie). La climatisation est très répandue, impactant directement la note DPE.`,
      },
      {
        heading: 'ERP — cyclonique + volcanique + houle',
        body: `L'ERP à ${city.name} doit couvrir le risque cyclonique tropical (saison décembre-avril, vents > 200 km/h), le risque volcanique pour les communes du sud-est (Piton de la Fournaise actif), le risque submersion marine houle cyclonique et le risque inondation/mouvement de terrain en zones ravines. Document obligatoire vente ET location.`,
      },
    ],
    riskFlags: [
      'Pas de plomb CREP',
      'Pas de termites',
      'Risque cyclonique',
      'Risque volcanique sud',
    ],
  }),
}

/**
 * Génère le contexte par défaut basé sur la région (fallback générique).
 */
function buildGenericRegionContext(city: City): CityContext {
  const regionLabels: Record<string, string> = {
    'ile-de-france': 'Île-de-France',
    paca: "Provence-Alpes-Côte d'Azur",
    'auvergne-rhone-alpes': 'Auvergne-Rhône-Alpes',
    occitanie: 'Occitanie',
    'nouvelle-aquitaine': 'Nouvelle-Aquitaine',
    'hauts-de-france': 'Hauts-de-France',
    'grand-est': 'Grand Est',
    'pays-de-la-loire': 'Pays de la Loire',
    bretagne: 'Bretagne',
    normandie: 'Normandie',
    'bourgogne-franche-comte': 'Bourgogne-Franche-Comté',
    'centre-val-de-loire': 'Centre-Val de Loire',
    corse: 'Corse',
    guadeloupe: 'Guadeloupe',
    martinique: 'Martinique',
    guyane: 'Guyane',
    'la-reunion': 'La Réunion',
    mayotte: 'Mayotte',
  }
  const regionName = regionLabels[city.region] ?? 'France'
  const isCoastal = [
    'paca',
    'occitanie',
    'corse',
    'bretagne',
    'nouvelle-aquitaine',
    'pays-de-la-loire',
    'normandie',
  ].includes(city.region)
  const isCold = [
    'grand-est',
    'bourgogne-franche-comte',
    'hauts-de-france',
    'auvergne-rhone-alpes',
  ].includes(city.region)

  const paragraphs: CityContextParagraph[] = [
    {
      heading: `Parc immobilier ${regionName}`,
      body: `${city.name} (${city.dept}, ${regionName}) totalise environ ${city.population.toLocaleString('fr-FR')} habitants. Le parc immobilier local mélange bâti ancien (centre historique, faubourgs) et constructions récentes (extensions périurbaines). Les diagnostiqueurs intervenant à ${city.name} y appliquent le cadre réglementaire national strict (DPE, amiante, plomb, gaz, électricité, termites selon zone, Carrez, ERP).`,
      highlight: true,
    },
    {
      heading: 'DPE et étiquette énergétique',
      body: `Comme partout en France, le DPE à ${city.name} est calculé selon la méthode 3CL-2021. Sa validité est de 10 ans (sauf travaux de rénovation). Les passoires énergétiques (étiquettes F et G) sont progressivement interdites à la location depuis 2025 (G+) et 2028 (G). Un audit énergétique est obligatoire en sus du DPE pour la vente de tout bien classé F ou G.`,
    },
    {
      heading: isCoastal
        ? 'Spécificités côtières — termites et humidité'
        : isCold
          ? 'Climat continental — DPE et isolation critique'
          : 'Climat tempéré — équilibre chauffage et confort été',
      body: isCoastal
        ? `${city.name}, située dans une région côtière (${regionName}), peut être concernée par le diagnostic termites obligatoire selon les arrêtés préfectoraux de son département. Le climat humide accentue les pathologies d'humidité et de moisissures dans les biens anciens.`
        : isCold
          ? `${city.name} relève d'une zone climatique exigeante : 5 à 6 mois de chauffe par an, températures hivernales basses. Le DPE 3CL-2021 pondère lourdement les besoins chauffage, dégradant mécaniquement l'étiquette des bâtis anciens non isolés.`
          : `${city.name} bénéficie d'un climat tempéré équilibré : chauffage modéré 4-5 mois/an et confort d'été acceptable sans climatisation. Le DPE y privilégie l'isolation toiture et le double-vitrage comme leviers d'amélioration prioritaires.`,
    },
    {
      heading: 'Diagnostiqueurs locaux et délais',
      body: `Les diagnostiqueurs certifiés exerçant à ${city.name} ou dans le département ${city.dept} sont accrédités COFRAC selon la norme ISO 17024. Délai médian de livraison rapport : 5 à 7 jours ouvrés. Tarification dépendant de la surface, du type de bien et du pack de diagnostics demandé.`,
    },
  ]

  return {
    intro: `${city.name} (${city.dept}, ${regionName}) compte environ ${city.population.toLocaleString('fr-FR')} habitants. Le marché du diagnostic immobilier y répond au cadre réglementaire national avec quelques spécificités liées à la région et au parc local.`,
    paragraphs,
    riskFlags: isCoastal
      ? ['Zone potentiellement termites', 'Humidité endémique', 'Passoires F-G interdites location']
      : isCold
        ? [
            'Climat froid DPE pénalisant',
            'Isolation prioritaire',
            'Passoires F-G interdites location',
          ]
        : ['Climat tempéré équilibré', 'Audit énergétique F-G obligatoire'],
  }
}

/**
 * Point d'entrée canonique — retourne le contexte SEO Amandine Bart pour
 * une ville donnée. Couvre les 8 départements prioritaires (75, 13, 69, 67,
 * 59, 33, 06, 31) + La Réunion (974). Fallback générique par région sinon.
 */
export function buildCityContextAmandine(city: City): CityContext {
  const dept = city.dept
  const builder = DEPT_CONTEXT[dept]
  if (builder) return builder(city)
  return buildGenericRegionContext(city)
}
