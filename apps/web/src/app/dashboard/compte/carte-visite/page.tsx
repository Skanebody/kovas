import { AppPageHeader } from '@/components/app-page-header'
import { SectionHeader } from '@/app/dashboard/dashboard/section-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loadBusinessCardByOrg } from '@/lib/business-card/loader'
import { isWalletPassEnabled } from '@/lib/business-card/wallet-pass'
import { ArrowLeft, Info } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { VCardFieldsEditor } from './vcard-fields-editor'
import { VCardQrPreview } from './vcard-qr-preview'

export const metadata: Metadata = { title: 'Carte de visite' }
export const dynamic = 'force-dynamic'

/**
 * Page `/dashboard/compte/carte-visite` — édition de la carte de visite numérique.
 *
 * - Aperçu QR live (320×320) avec logo central
 * - Boutons download : QR PNG, PDF imprimable A4, Apple Wallet, Lien public
 * - Toggles d'affichage (8 informations) + 3 champs custom
 * - Statistiques anonymes (vues + téléchargements)
 * - URL publique `https://kovas.fr/c/<token>` avec bouton régénérer
 *
 * DS v5 : sage `#F5F7F4` + opaque cards + chartreuse uniquement CTA primaire.
 */
export default async function BusinessCardPage() {
  const { supabase, orgId, user } = await getCurrentUser()

  const context = await loadBusinessCardByOrg(supabase, orgId, user.id)

  if (!context) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <Card variant="opaque" padding="default">
          <p className="text-sm text-[#0F1419]/70">
            Impossible de charger votre carte de visite. Vérifiez votre profil et votre cabinet.
          </p>
        </Card>
      </div>
    )
  }

  const { card, vcardInput, fullName, logoSignedUrl } = context
  const walletEnabled = isWalletPassEnabled()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  const publicUrl = `${baseUrl.replace(/\/$/, '')}/c/${card.public_token}`

  // Disponibilité réelle des données source (pour griser les toggles)
  const availability = {
    phoneMobile: Boolean(vcardInput.phoneMobile || vcardInput.phoneWork),
    email: Boolean(vcardInput.emailWork),
    address: Boolean(vcardInput.addressLine1 || vcardInput.city || vcardInput.postalCode),
    certification: Boolean(vcardInput.note?.includes('Cert.')),
    siret: Boolean(vcardInput.note?.includes('SIRET')),
    logo: Boolean(logoSignedUrl),
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Retour */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      {/* Header */}
      <AppPageHeader
        title="Votre"
        accent="carte de visite"
        description="Partagez vos coordonnées professionnelles d'un simple scan QR."
      />

      {/* 01 — APERÇU QR */}
      <section>
        <SectionHeader number="01" title="Aperçu" />
        <Card variant="opaque" padding="default">
          <VCardQrPreview
            fullName={fullName}
            organization={vcardInput.organization}
            title={vcardInput.title ?? null}
            publicUrl={publicUrl}
            walletEnabled={walletEnabled}
            refreshKey={card.updated_at}
          />
        </Card>
      </section>

      {/* 02 — INFORMATIONS PARTAGÉES */}
      <section>
        <SectionHeader number="02" title="Informations partagées" />
        <Card variant="opaque" padding="default">
          <VCardFieldsEditor
            initial={{
              show_phone_mobile: card.show_phone_mobile,
              show_phone_fixed: card.show_phone_fixed,
              show_email: card.show_email,
              show_address: card.show_address,
              show_website: card.show_website,
              show_certification: card.show_certification,
              show_siret: card.show_siret,
              show_logo: card.show_logo,
              custom_title: card.custom_title,
              custom_website: card.custom_website,
              custom_phone_fixed: card.custom_phone_fixed,
            }}
            availability={availability}
          />
        </Card>
      </section>

      {/* 03 — STATISTIQUES */}
      <section>
        <SectionHeader number="03" title="Statistiques" />
        <Card variant="opaque" padding="default">
          <div className="grid grid-cols-2 gap-6">
            <Stat label="Vues" value={card.view_count} hint="Page publique" />
            <Stat
              label="Téléchargements"
              value={card.scan_count}
              hint="Fichier .vcf"
            />
          </div>
        </Card>
      </section>

      {/* Encart conseils */}
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
                Le QR code encode l'URL publique de votre carte. Le scan ouvre une page sobre où le client peut ajouter vos coordonnées d'un tap.
              </li>
              <li>
                Plus vous remplissez votre profil et votre cabinet, plus la carte est complète. Les informations manquantes sont masquées automatiquement.
              </li>
              <li>
                Le bouton « Régénérer le lien » invalide les anciens QR imprimés.
                À utiliser uniquement en cas de fuite ou de changement majeur.
              </li>
              <li>
                Pour l'impression : utilisez le PDF A4 (10 cartes par feuille
                avec repères de découpe).
              </li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="space-y-1">
      <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[#0F1419]/60">
        {label}
      </p>
      <p className="font-serif italic text-[36px] leading-none text-[#0F1419]">
        {value.toLocaleString('fr-FR')}
      </p>
      <p className="text-[11px] text-[#0F1419]/50">{hint}</p>
    </div>
  )
}
