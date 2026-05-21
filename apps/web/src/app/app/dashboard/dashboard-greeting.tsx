interface DashboardGreetingProps {
  firstName: string
}

const FR_WEEKDAY_SHORT = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

function formatDateMono(d: Date): string {
  const wk = FR_WEEKDAY_SHORT[d.getDay()]
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  return `${wk} ${dd}.${mm}.${yy}`
}

function formatTimeMono(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * En-tête de page du dashboard — style mockup data-dense terminal.
 *
 *   Bonjour Benjamin,                                MER 20.05.2026
 *   votre journée commence.                                   09:42
 *   ──────────────────────────────────────────────────────────────
 *
 * - Titre en Urbanist 28px font-light + accent serif italic
 * - Date/heure en JetBrains Mono uppercase
 * - Séparateur 1px bottom border
 *
 * TODO V1.5 : ajouter ligne meta météo (Dieppe · 14°C couvert · vent SW 12 km/h)
 *   via OpenWeather API + cache 30 min. Skip V1 pour minimiser dépendances.
 */
export function DashboardGreeting({ firstName }: DashboardGreetingProps) {
  const now = new Date()
  const hour = now.getHours()

  // Salutation contextuelle sobre selon heure
  const greeting =
    hour < 6
      ? 'Bonne nuit'
      : hour < 12
        ? 'Bonjour'
        : hour < 18
          ? 'Bon après-midi'
          : 'Bonsoir'

  return (
    <header className="flex items-baseline justify-between gap-6 pb-6 mb-8 border-b border-rule/60">
      <div className="space-y-1.5">
        <h1 className="font-sans font-light text-2xl sm:text-3xl tracking-tight text-ink leading-tight">
          {greeting} {firstName},{' '}
          <span className="font-serif italic font-normal text-ink-mute">
            votre journée commence.
          </span>
        </h1>
      </div>
      <div className="text-right hidden sm:block">
        <p className="font-mono text-[11px] text-ink-mute tracking-[0.08em] leading-tight">
          {formatDateMono(now)}
        </p>
        <p className="font-mono text-sm font-medium text-ink tracking-[0.05em] mt-1">
          {formatTimeMono(now)}
        </p>
      </div>
    </header>
  )
}
