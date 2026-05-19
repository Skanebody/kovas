export type DashboardMode = 'morning' | 'evening' | 'auto'

const EVENING_HOUR_PARIS = 14

function isEveningParis(date: Date): boolean {
  const parisHour = Number.parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
    }).format(date),
    10,
  )
  return parisHour >= EVENING_HOUR_PARIS
}

/** `auto` = matin avant 14h Paris, soir après. */
export function resolveDashboardMode(
  mode: DashboardMode,
  now: Date = new Date(),
): 'morning' | 'evening' {
  if (mode === 'morning') return 'morning'
  if (mode === 'evening') return 'evening'
  return isEveningParis(now) ? 'evening' : 'morning'
}
