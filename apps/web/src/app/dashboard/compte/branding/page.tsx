import { AppPageHeader } from '@/components/app-page-header'
import { SectionHeader } from '@/app/dashboard/dashboard/section-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  DEFAULT_BRAND_COLOR_HEX,
  getOrganizationBranding,
} from '@/lib/branding/get-organization-branding'
import { ArrowLeft, Info } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandingPreview } from './branding-preview'
import { BrandColorPicker } from './color-picker'
import { LogoUpload } from './logo-upload'

export const metadata: Metadata = { title: 'Identité visuelle' }

/**
 * Page `/dashboard/compte/branding` — module branding cabinet.
 *
 * Permet à un diagnostiqueur de personnaliser son logo + sa couleur principale
 * (utilisés ensuite par les générateurs PDF devis/factures cabinet en marque
 * blanche).
 *
 * DS v5 strict : sage `#F5F7F4` + dark `#0F1419` + chartreuse uniquement sur
 * CTAs. Aucun gradient, aucune décoration.
 */
export default async function BrandingPage() {
  const { supabase, orgId } = await getCurrentUser()

  const [branding, orgRow] = await Promise.all([
    getOrganizationBranding(supabase, orgId),
    supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle(),
  ])

  const cabinetName = orgRow.data?.name ?? null

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* RETOUR */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      {/* HEADER PAGE */}
      <AppPageHeader
        title="Identité"
        accent="visuelle"
        description="Personnalisez l'apparence de vos devis et factures."
      />

      {/* ============ 01 · LOGO ============ */}
      <section>
        <SectionHeader number="01" title="Logo cabinet" />
        <Card variant="opaque" padding="default">
          <LogoUpload
            currentLogoUrl={branding.logoSignedUrl}
            currentLogoMime={branding.logoMime}
          />
        </Card>
      </section>

      {/* ============ 02 · COULEUR PRINCIPALE ============ */}
      <section>
        <SectionHeader number="02" title="Couleur principale" />
        <Card variant="opaque" padding="default">
          <BrandColorPicker
            currentHex={branding.brandColorHex || DEFAULT_BRAND_COLOR_HEX}
          />
        </Card>
      </section>

      {/* ============ 03 · APERÇU PDF ============ */}
      <section>
        <SectionHeader number="03" title="Aperçu PDF" />
        <Card variant="opaque" padding="default">
          <BrandingPreview
            logoUrl={branding.logoSignedUrl}
            logoMime={branding.logoMime}
            brandColorHex={branding.brandColorHex || DEFAULT_BRAND_COLOR_HEX}
            cabinetName={cabinetName}
          />
        </Card>
      </section>

      {/* ============ ENCART CONSEILS ============ */}
      <Card variant="opaque" padding="default" className="bg-[#0F1419]/[0.02]">
        <div className="flex gap-3">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#0F1419]/[0.06]"
          >
            <Info className="size-4 text-[#0F1419]/70" />
          </span>
          <div className="space-y-2 text-sm text-[#0F1419]/80 leading-relaxed">
            <p className="font-medium text-[#0F1419]">Conseils</p>
            <ul className="space-y-1.5 text-[13px]">
              <li>
                Format PNG ou SVG avec fond transparent pour un rendu net sur
                tous les supports.
              </li>
              <li>
                Dimensions carrées 400×400 px minimum recommandées (le logo est
                redimensionné automatiquement).
              </li>
              <li>Taille maximum acceptée : 2 Mo.</li>
              <li>
                Privilégiez une couleur sobre et contrastée pour rester
                lisible à l'impression noir et blanc.
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
