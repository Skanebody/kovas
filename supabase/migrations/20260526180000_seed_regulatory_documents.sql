-- ============================================
-- KOVAS App — Seed initial regulatory_documents (8 documents réels)
-- Date : 2026-05-26
-- Purpose : pré-remplir /app/veille avec du contenu utile dès la première visite,
--           sans dépendre du worker Edge `regulatory-watcher` (non actif en dev).
--
-- Toutes les références JORF ont été vérifiées via Légifrance le 2026-05-20.
-- Les ai_summary et ai_impact_analysis sont rédigés originalement par l'équipe
-- KOVAS (pas de copie textuelle d'arrêté — résumé factuel < 50 mots conformément
-- aux limites éditoriales et au droit d'auteur).
--
-- Mapping source : les arrêtés DPE / amiante / plomb / etc. → 'legifrance-jo'.
-- Le décret 2023-417 (conso/résiliation) → 'legifrance-jo'.
-- Mention "(jurisprudence applicable diagnostiqueur)" laissée hors scope ici.
-- ============================================

INSERT INTO regulatory_documents (
  source_id,
  external_id,
  doc_type,
  title,
  url,
  published_at,
  effective_at,
  jurisdiction,
  raw_text,
  ai_summary,
  topics,
  diagnostic_kinds,
  applies_to,
  importance,
  content_hash,
  processed_at,
  embedding_generated_at,
  is_superseded,
  processed,
  metadata
)
VALUES
  -- ────────────────────────────────────────────────────────────
  -- 1. Arrêté du 31 mars 2021 — Méthode 3CL-2021 DPE habitation
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353335
  -- Réforme fondamentale DPE (opposable, étiquettes A-G, méthode 3CL).
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000043353335',
    'arrete',
    'Arrêté du 31 mars 2021 relatif au diagnostic de performance énergétique pour les bâtiments ou parties de bâtiments à usage d''habitation en France métropolitaine',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353335',
    '2021-04-13',
    '2021-07-01',
    'FR',
    'Texte de référence définissant la méthode 3CL-2021 applicable au diagnostic de performance énergétique pour le résidentiel métropolitain. Encadre le contenu du rapport, les étiquettes énergie et climat, et les modalités de transmission ADEME. Reste la base réglementaire du DPE opposable.',
    'Arrêté fondateur du DPE opposable. Définit la méthode 3CL-2021, le contenu du rapport, les étiquettes A à G et les modalités de transmission à l''observatoire ADEME. Entrée en vigueur au 1er juillet 2021, modifié plusieurs fois depuis (2024, 2025).',
    ARRAY['dpe']::text[],
    ARRAY['dpe']::text[],
    ARRAY['diagnostiqueur','proprietaire','notaire']::text[],
    'critical',
    'kovas_seed_jorf_043353335_v1',
    now() - interval '5 days',
    now() - interval '5 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'nor', 'LOGL2107359A')
  ),

  -- ────────────────────────────────────────────────────────────
  -- 2. Arrêté du 25 mars 2024 — Petites surfaces DPE (≤ 40 m²)
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049446315
  -- Révision étiquettes pour logements de petites surfaces (~140k logements
  -- déclassés sortent des passoires thermiques au 1er juillet 2024).
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000049446315',
    'arrete',
    'Arrêté du 25 mars 2024 modifiant les seuils des étiquettes du diagnostic de performance énergétique pour les logements de petites surfaces et actualisant les tarifs annuels de l''énergie',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049446315',
    '2024-04-20',
    '2024-07-01',
    'FR',
    'Modifie les seuils d''étiquettes DPE pour les logements de surface de référence inférieure à 40 m². Réintroduit la notion de surface de référence (habitable + vérandas chauffées + espaces chauffés sous hauteur ≥ 1,80 m). Actualise les tarifs annuels de l''énergie servant à la conversion conso → étiquette.',
    'Révise les seuils d''étiquettes pour les logements ≤ 40 m² afin de corriger un biais défavorable du calcul 3CL-2021 sur les petits volumes. Conséquence directe : environ 140 000 logements sortent du statut "passoire thermique" au 1er juillet 2024. Tarifs énergie également actualisés.',
    ARRAY['dpe']::text[],
    ARRAY['dpe']::text[],
    ARRAY['diagnostiqueur','proprietaire']::text[],
    'critical',
    'kovas_seed_jorf_049446315_v1',
    now() - interval '4 days',
    now() - interval '4 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'impact_diagnostiqueur', 'recalcul nécessaire pour stock DPE petites surfaces F/G publiés avant 07/2024')
  ),

  -- ────────────────────────────────────────────────────────────
  -- 3. Décret n° 2023-417 du 31 mai 2023 — Résiliation 3 clics
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047613963
  -- Touche tous les SaaS B2C/B2B (incluant KOVAS Stripe Billing).
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000047613963',
    'decret',
    'Décret n° 2023-417 du 31 mai 2023 relatif aux modalités techniques de résiliation des contrats par voie électronique',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000047613963',
    '2023-06-01',
    '2023-06-01',
    'FR',
    'Définit les modalités techniques permettant aux consommateurs et non-professionnels de notifier la résiliation d''un contrat en quelques clics. Accès rapide, facile, direct et permanent à la fonctionnalité de résiliation depuis tout contrat conclu par voie électronique. Code consommation art. D215-1 et suivants.',
    'Décret hors champ diagnostic stricto sensu mais applicable à tout éditeur SaaS proposant un abonnement en ligne (dont KOVAS, Liciel et concurrents). Oblige à un bouton "Résilier mon contrat" accessible en 3 clics maximum depuis l''espace client. Sanctions DGCCRF possibles.',
    ARRAY['rgpd']::text[],
    ARRAY[]::text[],
    ARRAY['diagnostiqueur','proprietaire']::text[],
    'high',
    'kovas_seed_jorf_047613963_v1',
    now() - interval '3 days',
    now() - interval '3 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'kovas_internal_action', 'flux annulation déjà conforme — cf migration 20260520_cancellation_winback')
  ),

  -- ────────────────────────────────────────────────────────────
  -- 4. Arrêté du 4 juin 2024 — Repérage amiante ouvrages non bâtis
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049834826
  -- Extension du repérage amiante avant travaux aux ouvrages de génie civil,
  -- infrastructures de transport et réseaux divers.
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000049834826',
    'arrete',
    'Arrêté du 4 juin 2024 relatif au repérage de l''amiante avant certaines opérations réalisées dans les immeubles autres que bâtis tels que les ouvrages de génie civil, infrastructures de transport ou réseaux divers',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049834826',
    '2024-06-30',
    '2026-07-01',
    'FR',
    'Précise les conditions de réalisation des missions de repérage amiante avant certaines opérations sur immeubles non bâtis (génie civil, voiries, réseaux). Pris en application du décret 2017-899 du 9 mai 2017. Référence la norme NF X 46-102 de novembre 2020.',
    'Étend le périmètre du repérage amiante avant travaux aux ouvrages non bâtis (routes, ponts, réseaux). Entrée en vigueur principale au 1er juillet 2026 — délai de mise à niveau des opérateurs et de leurs certifications. Article 14 et annexes I/II applicables dès le 30 juin 2024.',
    ARRAY['amiante']::text[],
    ARRAY['amiante']::text[],
    ARRAY['diagnostiqueur']::text[],
    'high',
    'kovas_seed_jorf_049834826_v1',
    now() - interval '7 days',
    now() - interval '7 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'norme_referencee', 'NF X 46-102:2020-11')
  ),

  -- ────────────────────────────────────────────────────────────
  -- 5. Décret n° 2024-820 du 15 juillet 2024 — Audit énergétique
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049990218
  -- Modifie le décret 2022-780 sur l'audit énergétique des passoires.
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000049990218',
    'decret',
    'Décret n° 2024-820 du 15 juillet 2024 modifiant le décret n° 2022-780 du 4 mai 2022 relatif à l''audit énergétique mentionné à l''article L. 126-28-1 du code de la construction et de l''habitation',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049990218',
    '2024-07-17',
    '2024-08-01',
    'FR',
    'Ajuste la période transitoire avant pleine application du référentiel de compétences pour les diagnostiqueurs réalisant l''audit énergétique réglementaire. Harmonise la liste des professionnels habilités à conduire un audit à l''échelle d''un logement individuel.',
    'Touche directement les diagnostiqueurs immobiliers proposant l''audit énergétique obligatoire pour la vente de logements F/G (étendu E depuis le 1er janvier 2025). Période transitoire ajustée — vérifier les conditions de certification avant nouvelle mission audit.',
    ARRAY['dpe','audit']::text[],
    ARRAY['dpe']::text[],
    ARRAY['diagnostiqueur']::text[],
    'high',
    'kovas_seed_jorf_049990218_v1',
    now() - interval '10 days',
    now() - interval '10 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'note_kovas', 'audit énergétique exclu du périmètre KOVAS Phase 1 — informatif uniquement')
  ),

  -- ────────────────────────────────────────────────────────────
  -- 6. Arrêté du 1er juillet 2024 — Certification diagnostiqueurs
  --    (amiante, électricité, gaz, plomb, termites)
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049890008
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000049890008',
    'arrete',
    'Arrêté du 1er juillet 2024 définissant les critères de certification des diagnostiqueurs intervenant dans les domaines du diagnostic amiante, électricité, gaz, plomb et termite, de leurs organismes de formation et les exigences applicables aux organismes de certification',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049890008',
    '2024-07-09',
    '2024-09-01',
    'FR',
    'Refond les critères de certification des diagnostiqueurs sur 5 domaines (amiante, électricité, gaz, plomb, termites) ainsi que les exigences pour les organismes de formation et de certification accrédités Cofrac. Remplace plusieurs arrêtés antérieurs et harmonise les pré-requis examen / mention.',
    'Touche l''ensemble des diagnostiqueurs intervenant sur les 5 domaines (hors DPE traité séparément). Vérifier le renouvellement de certification à la prochaine échéance et les nouveaux pré-requis examen. Les organismes de formation doivent se mettre en conformité.',
    ARRAY['amiante','plomb','gaz','electricite','termites']::text[],
    ARRAY['amiante','plomb','gaz','electricite','termites']::text[],
    ARRAY['diagnostiqueur']::text[],
    'critical',
    'kovas_seed_jorf_049890008_v1',
    now() - interval '12 days',
    now() - interval '12 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'cofrac_check', true)
  ),

  -- ────────────────────────────────────────────────────────────
  -- 7. Arrêté du 16 juin 2025 — Modif arrêté 31 mars 2021 DPE
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051754449
  -- Modifie l'arrêté DPE habitation + l'arrêté méthodes / logiciels.
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000051754449',
    'arrete',
    'Arrêté du 16 juin 2025 modifiant l''arrêté du 31 mars 2021 relatif au diagnostic de performance énergétique pour les bâtiments ou parties de bâtiments à usage d''habitation en France métropolitaine et l''arrêté du 31 mars 2021 relatif aux méthodes et procédures applicables au diagnostic de performance énergétique et aux logiciels l''établissant',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051754449',
    '2025-06-25',
    '2025-09-01',
    'FR',
    'Met à jour le contenu réglementaire du DPE habitation et les exigences imposées aux logiciels validés ADEME. Ajustements de calcul, de format du rapport et des modalités de transmission à l''observatoire.',
    'Diagnostiqueurs DPE : nécessite mise à jour du logiciel agréé (Liciel, KOVAS Phase 2, etc.) avant le 1er septembre 2025. Les rapports émis avec une version logicielle non à jour seront refusés par l''observatoire ADEME.',
    ARRAY['dpe']::text[],
    ARRAY['dpe']::text[],
    ARRAY['diagnostiqueur']::text[],
    'critical',
    'kovas_seed_jorf_051754449_v1',
    now() - interval '2 days',
    now() - interval '2 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'logiciel_impact', true)
  ),

  -- ────────────────────────────────────────────────────────────
  -- 8. Arrêté du 16 juin 2025 — Certification DPE diagnostiqueurs
  -- Source : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051754436
  -- Modifie arrêté 20 juillet 2023 certif DPE + arrêté 24 décembre 2021.
  -- ────────────────────────────────────────────────────────────
  (
    (SELECT id FROM regulatory_sources WHERE slug = 'legifrance-jo' LIMIT 1),
    'JORFTEXT000051754436',
    'arrete',
    'Arrêté du 16 juin 2025 modifiant l''arrêté du 20 juillet 2023 définissant les critères de certification des diagnostiqueurs intervenant dans le domaine du diagnostic de performance énergétique, de leurs organismes de formation et les exigences applicables aux organismes de certification et modifiant l''arrêté du 24 décembre 2021 définissant les critères de certification des opérateurs de diagnostic technique et des organismes de formation et d''accréditation des organismes de certification',
    'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051754436',
    '2025-06-25',
    '2025-09-01',
    'FR',
    'Ajuste les critères de certification spécifiques aux diagnostiqueurs DPE et harmonise certaines dispositions avec l''arrêté général du 24 décembre 2021 sur la certification des opérateurs de diagnostic technique. Concerne organismes de formation et certificateurs accrédités.',
    'Diagnostiqueurs DPE certifiés : revoir les modalités de maintien de certification et de surveillance Cofrac. Les organismes de formation et de certification doivent ajuster leurs process avant le 1er septembre 2025.',
    ARRAY['dpe']::text[],
    ARRAY['dpe']::text[],
    ARRAY['diagnostiqueur']::text[],
    'high',
    'kovas_seed_jorf_051754436_v1',
    now() - interval '2 days',
    now() - interval '2 days',
    false,
    true,
    jsonb_build_object('seeded', true, 'seed_version', 1, 'cofrac_check', true)
  )
ON CONFLICT (source_id, external_id) DO NOTHING;

-- ============================================
-- Notifications mock : pour chaque membership active, on injecte
-- des notifications sur les documents les plus récents (effective_at >= 6 mois).
-- Limite : 50 memberships × 3 docs max pour éviter une explosion en prod
-- (en dev on a typiquement 1-3 memberships).
-- ============================================
DO $$
DECLARE
  m RECORD;
  d RECORD;
  v_severity text;
BEGIN
  FOR m IN
    SELECT user_id, organization_id
    FROM memberships
    WHERE status = 'active'
    LIMIT 50
  LOOP
    FOR d IN
      SELECT id, importance, topics
      FROM regulatory_documents
      WHERE metadata->>'seeded' = 'true'
        AND (effective_at IS NULL OR effective_at >= (now() - interval '12 months')::date)
      ORDER BY published_at DESC
      LIMIT 3
    LOOP
      v_severity := CASE
        WHEN d.importance = 'critical' THEN 'critical'
        WHEN d.importance = 'high' THEN 'warning'
        ELSE 'info'
      END;

      INSERT INTO regulatory_notifications (
        user_id,
        document_id,
        organization_id,
        severity,
        reason,
        matched_topics,
        delivered_in_app,
        created_at
      ) VALUES (
        m.user_id,
        d.id,
        m.organization_id,
        v_severity,
        'Nouvelle réglementation détectée — pertinente pour vos missions ' ||
          COALESCE(array_to_string(d.topics, ', '), 'diagnostic'),
        d.topics,
        true,
        now() - (interval '1 day' * (random() * 5)::int)
      )
      ON CONFLICT (user_id, document_id) DO NOTHING;
    END LOOP;
  END LOOP;
END
$$;

-- ============================================
-- FIN MIGRATION seed_regulatory_documents
-- ============================================
