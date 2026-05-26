import { AppPageHeader } from '@/components/app-page-header'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { ScanWorkspace } from './scan-workspace'

export const metadata: Metadata = {
  title: 'Vérification de validité',
  description: "Scannez vos diagnostics existants et laissez l'IA les classer dans vos dossiers.",
}

export const dynamic = 'force-dynamic'

export default async function VerificationValiditePage() {
  const { supabase, orgId } = await getCurrentUser()

  const [scansRes, clientsRes, propertiesRes] = await Promise.all([
    supabase
      .from('diagnostic_scans')
      .select(
        'id, original_name, mime_type, size_bytes, diagnostic_type, date_emission, date_expiration, adresse, proprietaire, ademe_number, energy_class, result_positive, usage_context, ai_confidence, status, client_id, property_id, created_at',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name'),
    supabase
      .from('properties')
      .select('id, address, city, postal_code, client_id')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('address'),
  ])

  const scans = scansRes.data ?? []
  const clients = clientsRes.data ?? []
  const properties = propertiesRes.data ?? []

  return (
    <div className="max-w-5xl w-full mx-auto space-y-8 animate-fade-in">
      <AppPageHeader
        title="Vérification de"
        accent="validité"
        description="Scannez vos diagnostics — KOVAS détecte type, date et adresse pour les classer."
      />

      <ScanWorkspace initialScans={scans} clients={clients} properties={properties} />
    </div>
  )
}
