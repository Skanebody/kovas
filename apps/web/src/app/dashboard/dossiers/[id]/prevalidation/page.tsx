import { PrevalidationForm } from '@/components/ademe/PrevalidationForm'
import type { PrevalidationInitialValues } from '@/components/ademe/PrevalidationForm'
import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { GlossaryTerm } from '@/components/ui/glossary-term'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft, Radar } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Pré-validation DPE' }

/**
 * Pré-validation DPE depuis un dossier existant.
 *
 * Charge le dossier + property et pré-remplit le PrevalidationForm avec les
 * données déjà saisies (adresse, surface, année, type bâtiment). Les autres
 * champs (étiquettes, conso, type chauffage) restent à compléter par le
 * diagnostiqueur car ils dépendent du calcul DPE en cours (Liciel ou autre).
 *
 * Le `source_dossier_id` est passé au form pour traçabilité de la prévalidation
 * dans `ademe_prevalidations.mission_id` (côté Edge Function).
 */
export default async function DossierPrevalidationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, property_id, properties(address, postal_code, city, surface_total, year_built, property_type)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossier) notFound()

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties

  // Mapping property → PrevalidationInitialValues
  const buildingType: PrevalidationInitialValues['type_batiment'] =
    prop?.property_type === 'maison'
      ? 'maison'
      : prop?.property_type === 'immeuble'
        ? 'immeuble'
        : 'appartement'

  // Compose adresse complète pour BAN
  const addressLabel = prop
    ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(' ')
    : ''

  const initialValues: PrevalidationInitialValues = {
    address: addressLabel ? { label: addressLabel } : undefined,
    type_batiment: buildingType,
    annee_construction: typeof prop?.year_built === 'number' ? prop.year_built : undefined,
    surface_habitable_m2: typeof prop?.surface_total === 'number' ? prop.surface_total : undefined,
    source_dossier_id: dossier.id,
  }

  return (
    <div className="max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/dossiers/${dossier.id}`}>
          <ArrowLeft className="size-4" /> Retour au dossier
        </Link>
      </Button>

      <AppPageHeader
        eyebrow={`Dossier ${dossier.reference}`}
        title="Pré-validation"
        accent="ADEME"
        description={
          addressLabel
            ? `Évalue le risque ADEME avant publication du DPE pour ${addressLabel}.`
            : 'Évalue le risque ADEME avant publication du DPE.'
        }
        action={<Radar className="size-5 text-[#0F1419]/72" aria-hidden />}
      />

      <p className="text-xs text-[#0F1419]/72 leading-relaxed">
        Les champs adresse, type bâtiment, année et surface sont pré-remplis depuis le dossier.
        Complétez les champs <GlossaryTerm term="dpe">DPE</GlossaryTerm> (étiquettes, conso,
        chauffage) avec les résultats issus de ton logiciel de calcul (
        <GlossaryTerm term="liciel">Liciel</GlossaryTerm>, AnalysImmo…) avant d&apos;évaluer le
        risque.
      </p>

      <PrevalidationForm initialValues={initialValues} />
    </div>
  )
}
