/**
 * Page publique `/c/<token>` — Carte de visite numérique partageable.
 *
 * Accessible sans authentification :
 *   - Affiche les infos contact du diagnostiqueur (selon toggles show_*)
 *   - QR central pour scan rapide depuis un autre appareil
 *   - Boutons "Ajouter aux contacts" (.vcf) + "Apple Wallet" + "Partager"
 *
 * Incrémente `view_count` à chaque chargement (stat anonyme).
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { loadBusinessCardByToken } from '@/lib/business-card/loader'
import { isWalletPassEnabled } from '@/lib/business-card/wallet-pass'
import { Globe, Mail, MapPin, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PublicCardActions } from './public-card-actions'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const admin = createAdminClient()
  const ctx = await loadBusinessCardByToken(admin, token)
  if (!ctx) {
    return { title: 'Carte de visite — KOVAS', robots: { index: false, follow: false } }
  }
  const v = ctx.vcardInput
  const title = `${ctx.fullName} — ${v.organization}`
  const description = v.title ?? 'Carte de visite professionnelle'
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'profile',
    },
  }
}

export default async function PublicBusinessCardPage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()
  const ctx = await loadBusinessCardByToken(admin, token)

  if (!ctx) {
    return <InvalidTokenPage />
  }

  // Incrément view_count best-effort (stat anonyme — pas critique).
  // Cast minimal : `business_cards` pas encore dans Database types regen.
  try {
    const client = admin as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: { view_count: number } | null
              error: { message: string } | null
            }>
          }
        }
        update: (row: Record<string, unknown>) => {
          eq: (
            col: string,
            val: string,
          ) => Promise<{
            error: { message: string } | null
          }>
        }
      }
    }
    const { data: row } = await client
      .from('business_cards')
      .select('view_count')
      .eq('public_token', token)
      .maybeSingle()
    const current = row?.view_count ?? 0
    await client
      .from('business_cards')
      .update({ view_count: current + 1 })
      .eq('public_token', token)
  } catch {
    // best-effort
  }

  const v = ctx.vcardInput
  const walletEnabled = isWalletPassEnabled()

  // URLs pour les actions client (relatives → fonctionnent en preview, prod, local)
  const vcardUrl = `/api/business-card/vcard.vcf?token=${encodeURIComponent(token)}`
  const qrSvgUrl = `/api/business-card/qr?token=${encodeURIComponent(token)}&format=svg&size=512`
  const walletUrl = walletEnabled
    ? `/api/business-card/wallet?token=${encodeURIComponent(token)}`
    : null

  return (
    <div className="min-h-screen bg-[#F5F7F4] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 animate-fade-in">
        <Card variant="opaque" padding="default" className="text-center space-y-6">
          {/* Logo */}
          {ctx.logoSignedUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ctx.logoSignedUrl}
                alt={v.organization}
                className="size-16 object-contain"
              />
            </div>
          ) : null}

          {/* Nom — serif italic large */}
          <div className="space-y-1">
            <h1 className="font-serif italic text-[40px] leading-[1.05] text-[#0F1419]">
              {v.firstName} {v.lastName}
            </h1>
            <p className="font-sans font-semibold text-[15px] text-[#0F1419]">{v.organization}</p>
            {v.title ? <p className="text-sm text-[#0F1419]/60">{v.title}</p> : null}
          </div>

          {/* QR central */}
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-4 shadow-glass-sm">
              {/* QR rendu via img qui pointe vers /api → server */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSvgUrl}
                alt="QR code carte de visite"
                width={240}
                height={240}
                className="size-[240px]"
              />
            </div>
          </div>

          {/* Note métier (cert + SIRET) — mono discret */}
          {v.note ? (
            <p className="font-mono text-[11px] text-[#0F1419]/60 leading-relaxed">{v.note}</p>
          ) : null}

          {/* Infos cliquables */}
          <ul className="space-y-3 text-left">
            {v.phoneMobile ? (
              <li>
                <a
                  href={`tel:${v.phoneMobile}`}
                  className="flex items-center gap-3 rounded-lg p-3 text-[15px] text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition"
                >
                  <Phone className="size-4 shrink-0 text-[#0F1419]/60" />
                  <span>{v.phoneMobile}</span>
                </a>
              </li>
            ) : null}
            {v.phoneWork ? (
              <li>
                <a
                  href={`tel:${v.phoneWork}`}
                  className="flex items-center gap-3 rounded-lg p-3 text-[15px] text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition"
                >
                  <Phone className="size-4 shrink-0 text-[#0F1419]/60" />
                  <span>{v.phoneWork}</span>
                </a>
              </li>
            ) : null}
            {v.emailWork ? (
              <li>
                <a
                  href={`mailto:${v.emailWork}`}
                  className="flex items-center gap-3 rounded-lg p-3 text-[15px] text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition"
                >
                  <Mail className="size-4 shrink-0 text-[#0F1419]/60" />
                  <span className="break-all">{v.emailWork}</span>
                </a>
              </li>
            ) : null}
            {v.website ? (
              <li>
                <a
                  href={v.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg p-3 text-[15px] text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition"
                >
                  <Globe className="size-4 shrink-0 text-[#0F1419]/60" />
                  <span className="break-all">{v.website}</span>
                </a>
              </li>
            ) : null}
            {v.addressLine1 ? (
              <li>
                <div className="flex items-start gap-3 rounded-lg p-3 text-[15px] text-[#0F1419]">
                  <MapPin className="size-4 shrink-0 text-[#0F1419]/60 mt-1" />
                  <div className="leading-relaxed">
                    <div>{v.addressLine1}</div>
                    {(v.postalCode || v.city) && (
                      <div className="text-[#0F1419]/70">
                        {v.postalCode} {v.city}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ) : null}
          </ul>

          {/* Actions client */}
          <PublicCardActions
            vcardUrl={vcardUrl}
            walletUrl={walletUrl}
            shareTitle={`${ctx.fullName} — ${v.organization}`}
          />
        </Card>

        {/* Footer KOVAS */}
        <p className="text-center text-[11px] text-[#0F1419]/50">
          Propulsé par{' '}
          <Link href="/" className="underline underline-offset-2 hover:text-[#0F1419]">
            KOVAS
          </Link>{' '}
          · Crée ta carte
        </p>
      </div>
    </div>
  )
}

function InvalidTokenPage() {
  return (
    <div className="min-h-screen bg-[#F5F7F4] flex items-center justify-center px-4 py-10">
      <Card variant="opaque" padding="default" className="max-w-md text-center space-y-3">
        <h1 className="font-serif italic text-3xl text-[#0F1419]">Carte introuvable.</h1>
        <p className="text-sm text-[#0F1419]/70">
          Ce lien n'est plus valide ou a été révoqué par son propriétaire.
        </p>
        <div className="pt-3">
          <Button asChild>
            <Link href="/">Découvrir KOVAS</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
