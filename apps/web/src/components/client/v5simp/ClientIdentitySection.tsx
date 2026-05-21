'use client'

import { Badge } from '@/components/ui/badge'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { FileText, Mail, MessageSquare, Phone } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const TYPE_LABELS_CAPS: Record<string, string> = {
  particulier: 'PARTICULIER',
  agence: 'AGENCE',
  notaire: 'NOTAIRE',
  syndic: 'SYNDIC',
  entreprise: 'ENTREPRISE',
  collectivite: 'COLLECTIVITÉ',
}

interface ClientIdentityProps {
  client: {
    id: string
    display_name: string
    type: string
    city: string | null
    email: string | null
    phone: string | null
  }
  /** True si le client a ≥5 dossiers (badge "fidèle") */
  fidele: boolean
}

/**
 * Section 1 — Identité (page client SIMP-2).
 * Layout vertical sobre :
 *   - Avatar 64px navy / chartreuse (initiales)
 *   - Nom hero <h1>
 *   - Sous-titre mono uppercase ("PARTICULIER · DIEPPE")
 *   - Badge statut "fidèle" si applicable
 *   - 4 boutons actions horizontaux (Appeler / SMS / Email / Devis)
 */
export function ClientIdentitySection({ client, fidele }: ClientIdentityProps) {
  const [smsOpen, setSmsOpen] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)

  const initials = computeInitials(client.display_name)
  const typeLabel = TYPE_LABELS_CAPS[client.type] ?? client.type.toUpperCase()
  const cityCaps = client.city ? client.city.toUpperCase() : null
  const subtitle = [typeLabel, cityCaps].filter(Boolean).join(' · ')

  return (
    <section aria-labelledby="client-identity-title" className="space-y-4">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex size-16 shrink-0 items-center justify-center rounded-full bg-navy font-mono text-[18px] font-semibold text-chartreuse"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1
            id="client-identity-title"
            className="font-sans text-[28px] font-medium leading-tight text-ink"
          >
            {client.display_name}
          </h1>
          {subtitle ? (
            <p className="font-mono text-[12px] uppercase tracking-[0.12em] text-foreground/55">
              {subtitle}
            </p>
          ) : null}
          {fidele ? (
            <div className="pt-1">
              <Badge variant="amber">Fidèle</Badge>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <ActionButton
          icon={Phone}
          label="Appeler"
          href={client.phone ? `tel:${client.phone}` : undefined}
          disabled={!client.phone}
        />
        <ActionButton
          icon={MessageSquare}
          label="SMS"
          onClick={() => setSmsOpen(true)}
          disabled={!client.phone}
        />
        <ActionButton
          icon={Mail}
          label="Email"
          onClick={() => setEmailOpen(true)}
          disabled={!client.email}
        />
        <ActionButton
          icon={FileText}
          label="Devis"
          href={`/dashboard/facturation?client_id=${client.id}`}
        />
      </div>

      {/* Stub SMS (V1 : envoi Brevo non câblé) */}
      <BottomSheet
        open={smsOpen}
        onOpenChange={setSmsOpen}
        title="Envoyer un SMS"
        description="Disponible dans une prochaine version (Brevo SMS)"
      >
        <div className="space-y-3 px-2 pb-4">
          <p className="text-sm text-ink-mute">
            L'envoi de SMS depuis l'application sera disponible dans une prochaine version. Pour
            contacter ce client par SMS, utilisez l'application native de votre téléphone.
          </p>
          {client.phone ? <p className="font-mono text-[13px] text-ink">{client.phone}</p> : null}
        </div>
      </BottomSheet>

      {/* Stub Email compose (V1 : modal compose non câblé) */}
      <BottomSheet
        open={emailOpen}
        onOpenChange={setEmailOpen}
        title="Envoyer un email"
        description="Disponible dans une prochaine version (Resend)"
      >
        <div className="space-y-3 px-2 pb-4">
          <p className="text-sm text-ink-mute">
            La composition d'emails depuis l'application sera disponible dans une prochaine version.
            Pour écrire à ce client maintenant, ouvrez votre client de messagerie habituel.
          </p>
          {client.email ? (
            <a
              href={`mailto:${client.email}`}
              className="font-mono text-[13px] text-ink hover:underline"
            >
              {client.email}
            </a>
          ) : null}
        </div>
      </BottomSheet>
    </section>
  )
}

function computeInitials(name: string): string {
  const cleaned = name.trim()
  if (!cleaned) return '?'
  const parts = cleaned.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface ActionButtonProps {
  icon: React.ElementType
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
}

function ActionButton({ icon: Icon, label, href, onClick, disabled }: ActionButtonProps) {
  const content = (
    <>
      <Icon className="size-4" strokeWidth={1.5} />
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1.5">{label}</span>
    </>
  )
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled aria-label={label}>
        {content}
      </Button>
    )
  }
  if (href) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link href={href} aria-label={label}>
          {content}
        </Link>
      </Button>
    )
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} aria-label={label}>
      {content}
    </Button>
  )
}
