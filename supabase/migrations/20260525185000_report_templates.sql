-- ============================================
-- KOVAS App — Module 8 : Templates de rapports (versionnés selon réglementation)
-- Date : 2026-05-25
-- Référentiel système global : sources de vérité pour générer PDF/Word DPE, amiante, etc.
-- ============================================

CREATE TABLE report_templates (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  text NOT NULL,
  diagnostic_kind       text NOT NULL,
    -- 'dpe' | 'amiante' | 'plomb_crep' | 'gaz' | 'electricite' | 'termites' | 'carrez_boutin' | 'erp'
  version               text NOT NULL,  -- ex : '3CL-2021', 'arr-15-09-2006-v2'
  format                text NOT NULL DEFAULT 'pdf'
    CHECK (format IN ('pdf','docx','html','json')),
  -- Contenu (template engine — Handlebars/Liquid côté worker).
  template_engine       text NOT NULL DEFAULT 'handlebars',
  template_body         text NOT NULL,
  default_variables     jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Conformité.
  legal_basis           text,            -- ex : 'Arrêté du 31/03/2021 - DPE 3CL-2021'
  effective_from        date,
  effective_until       date,
  is_active             boolean NOT NULL DEFAULT true,
  -- Auto-update (lien vers le document qui a déclenché la mise à jour si applicable).
  triggered_by_doc_id   uuid REFERENCES regulatory_documents(id) ON DELETE SET NULL,
  -- Description et changelog.
  description           text,
  changelog             text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE INDEX idx_report_templates_kind_active ON report_templates (diagnostic_kind, is_active);
CREATE INDEX idx_report_templates_effective ON report_templates (diagnostic_kind, effective_from DESC)
  WHERE is_active = true;
CREATE INDEX idx_report_templates_slug ON report_templates (slug);

COMMENT ON TABLE report_templates IS
  'Templates de rapports (PDF/Word) versionnés selon la réglementation. Lecture publique, écriture admin uniquement.';

CREATE TRIGGER trg_report_templates_updated BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

-- SELECT public (utilisé par le worker d'export ET par l'UI pour preview).
CREATE POLICY "report_templates_public_read"
  ON report_templates FOR SELECT TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE admin uniquement.
CREATE POLICY "report_templates_admin_insert"
  ON report_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "report_templates_admin_update"
  ON report_templates FOR UPDATE TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

CREATE POLICY "report_templates_admin_delete"
  ON report_templates FOR DELETE TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- ============================================
-- FIN MIGRATION report_templates
-- ============================================
