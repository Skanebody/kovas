type Certification = {
  type: string
  organism: string
  number: string | null
  valid_until: string | null
  status?: 'active' | 'expired' | 'pending' | null
}

type CertCardProps = {
  certification: Certification
}

/**
 * Card de certification COFRAC.
 * Affiche le type de diagnostic, l'organisme, le numéro et la validité.
 */
export function CertCard({ certification }: CertCardProps) {
  const { type, organism, number, valid_until, status } = certification

  const isExpired = status === 'expired' || isPastDate(valid_until)
  const isActive = !isExpired && status !== 'pending'

  return (
    <div className="rounded-2xl border border-black/8 bg-white p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.08em] text-black/50">
            Certification
          </p>
          <h3 className="text-base font-semibold text-[#0B1D33] mt-1">{type}</h3>
        </div>
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
            isActive
              ? 'bg-emerald-50 text-emerald-700'
              : isExpired
                ? 'bg-red-50 text-red-700'
                : 'bg-amber-50 text-amber-700',
          ].join(' ')}
        >
          <span
            aria-hidden
            className={[
              'h-1.5 w-1.5 rounded-full',
              isActive ? 'bg-emerald-500' : isExpired ? 'bg-red-500' : 'bg-amber-500',
            ].join(' ')}
          />
          {isActive ? 'Active' : isExpired ? 'Expirée' : 'En attente'}
        </span>
      </div>

      <dl className="grid gap-1.5 text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-black/50 shrink-0">Organisme</dt>
          <dd className="text-black/80">{organism}</dd>
        </div>
        {number ? (
          <div className="flex items-baseline gap-2">
            <dt className="text-black/50 shrink-0">N°</dt>
            <dd className="font-mono text-xs text-black/80">{number}</dd>
          </div>
        ) : null}
        {valid_until ? (
          <div className="flex items-baseline gap-2">
            <dt className="text-black/50 shrink-0">Valide jusqu&apos;au</dt>
            <dd className="text-black/80">{formatDate(valid_until)}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function isPastDate(iso: string | null): boolean {
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}
