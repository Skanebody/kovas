'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { MapPin, MessageSquare, Phone, Send } from 'lucide-react'

interface TodayMissionActionsProps {
  phone: string | null
  address: string
  dossierId: string
  uploadToken: string | null
  docsMissing: boolean
}

/**
 * F5 — Actions rapides sur card mission du jour : tel, SMS, GPS, Relancer client.
 * cf. docs/dashboard-spec.md F5.
 */
export function TodayMissionActions({
  phone,
  address,
  dossierId,
  uploadToken,
  docsMissing,
}: TodayMissionActionsProps) {
  const cleanPhone = phone?.replace(/\s+/g, '') ?? ''
  const hasPhone = cleanPhone.length > 0
  const hasAddress = address.length > 0

  function handleCall() {
    if (!hasPhone) return
    window.location.href = `tel:${cleanPhone}`
  }

  function handleSms() {
    if (!hasPhone) return
    const body = encodeURIComponent(
      "Bonjour, j'arrive dans environ 15 min pour votre diagnostic. Cordialement.",
    )
    window.location.href = `sms:${cleanPhone}?body=${body}`
  }

  function handleMaps() {
    if (!hasAddress) return
    const encoded = encodeURIComponent(address)
    const ua = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(ua)
    const isAndroid = /Android/.test(ua)
    const url = isIOS
      ? `maps://?daddr=${encoded}`
      : isAndroid
        ? `geo:0,0?q=${encoded}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
    window.open(url, isIOS || isAndroid ? '_self' : '_blank')
  }

  async function handleRelance() {
    if (!uploadToken) {
      toast.error("Aucun lien d'upload actif sur ce dossier. Génère-le depuis le dossier.")
      return
    }
    const url = `${window.location.origin}/upload/${uploadToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien upload copié — partagez-le au client par SMS ou email')
    } catch {
      // Fallback : ouvre l'URL dans un nouvel onglet si le presse-papier est bloqué
      window.open(url, '_blank')
      toast.info('Lien upload ouvert dans un nouvel onglet')
    }
    // Petit boost UX : pré-rempli un SMS au passage si on a un téléphone
    if (hasPhone) {
      const body = encodeURIComponent(
        `Bonjour, pouvez-vous m'envoyer les documents manquants via ce lien sécurisé : ${url}`,
      )
      // Pas d'ouverture automatique pour éviter de spawn 2 actions, juste un toast d'info
      void body
    }
    void dossierId
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleCall}
        disabled={!hasPhone}
        aria-label="Appeler le client"
        title={hasPhone ? `Appeler ${phone}` : 'Aucun numéro renseigné'}
      >
        <Phone className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleSms}
        disabled={!hasPhone}
        aria-label="Envoyer un SMS au client"
        title={hasPhone ? 'SMS au client' : 'Aucun numéro renseigné'}
      >
        <MessageSquare className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleMaps}
        disabled={!hasAddress}
        aria-label="Ouvrir l'itinéraire GPS"
        title={hasAddress ? `GPS vers ${address}` : 'Pas d’adresse'}
      >
        <MapPin className="size-4" />
      </Button>
      {docsMissing && (
        <Button
          variant="glass"
          size="sm"
          onClick={handleRelance}
          aria-label="Relancer le client pour les documents manquants"
        >
          <Send className="size-3" /> Relancer
        </Button>
      )}
    </>
  )
}
