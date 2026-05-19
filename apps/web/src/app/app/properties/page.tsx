import { AppPageHeader } from '@/components/app-page-header'
import { Building2, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Biens' }

const TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

export default async function PropertiesPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address, city, postal_code, property_type, surface_total, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Biens"
        description={`${properties?.length ?? 0} bien${(properties?.length ?? 0) > 1 ? 's' : ''}`}
        action={
          <Button asChild>
            <Link href="/app/properties/new">
              <Plus className="size-4" />
              Nouveau bien
            </Link>
          </Button>
        }
      />

      {properties && properties.length > 0 ? (
        <div className="rounded-xl border border-border-soft bg-paper overflow-hidden shadow-glass-sm">
          <table className="w-full text-sm">
            <thead className="bg-cream-deep/80 text-ink-mute">
              <tr>
                <th className="text-left font-medium px-4 py-3">Adresse</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Surface</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/properties/${p.id}`} className="font-medium hover:underline">
                      {p.address}
                    </Link>
                    {(p.postal_code || p.city) && (
                      <div className="text-xs text-ink-mute mt-0.5">
                        {[p.postal_code, p.city].filter(Boolean).join(' ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {p.property_type ? (
                      <Badge variant="muted">{TYPE_LABELS[p.property_type] ?? p.property_type}</Badge>
                    ) : (
                      <span className="text-ink-mute">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-mute hidden md:table-cell">
                    {p.surface_total ? `${p.surface_total} m²` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 pb-8 text-center space-y-4">
            <Building2 className="size-10 mx-auto text-ink-mute" />
            <div className="space-y-1">
              <h2 className="font-semibold">Aucun bien pour le moment</h2>
              <p className="text-sm text-ink-mute">
                Ajoutez un bien pour pouvoir y associer des missions de diagnostic.
              </p>
            </div>
            <Button asChild>
              <Link href="/app/properties/new">
                <Plus className="size-4" />
                Ajouter un bien
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
