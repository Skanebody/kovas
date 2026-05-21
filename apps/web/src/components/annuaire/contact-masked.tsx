import { Lock, Mail, Phone } from 'lucide-react'

/**
 * Affiche les coordonnées masquées ("06 ** ** ** **") avec icône cadenas.
 * Utilisé sur les fiches `basic` (non-réclamée) de l'annuaire.
 */
export function ContactMasked({ kind }: { kind: 'phone' | 'email' }) {
  const Icon = kind === 'phone' ? Phone : Mail
  const masked = kind === 'phone' ? '06 ** ** ** **' : '*****@*****.fr'
  return (
    <div className="flex items-center gap-2 text-sm text-neutral-500">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span aria-label={kind === 'phone' ? 'Téléphone masqué' : 'Email masqué'}>{masked}</span>
      <Lock className="size-3.5 shrink-0" aria-hidden />
    </div>
  )
}
