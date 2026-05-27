import {
  ProfileSection,
  type ProfileSectionInitialValues,
} from '@/components/annuaire-dashboard/ProfileSection'
import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { PageTabs } from '@/components/ui/page-tabs'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import {
  Bell,
  CalendarClock,
  ExternalLink,
  FileSignature,
  IdCard,
  Image as ImageIcon,
  MapPin,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TrendingUp,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Ma fiche annuaire' }

const SECTIONS = [
  { key: 'profil', label: 'Profil', icon: IdCard },
  { key: 'photos', label: 'Photos', icon: ImageIcon },
  { key: 'legal', label: 'Légal & Certifs', icon: ShieldCheck },
  { key: 'zone-tarifs', label: 'Zone & Tarifs', icon: MapPin },
  { key: 'disponibilites', label: 'Disponibilités', icon: CalendarClock },
  { key: 'preferences-leads', label: 'Préférences leads', icon: SlidersHorizontal },
  { key: 'booking', label: 'Booking & CGV', icon: FileSignature },
  { key: 'reviews', label: 'Reviews', icon: Star },
  { key: 'visibility', label: 'Visibility', icon: TrendingUp },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'reglages', label: 'Réglages avancés', icon: Settings },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

const SECTION_KEYS = SECTIONS.map((s) => s.key) as readonly SectionKey[]

function isSectionKey(value: string | undefined): value is SectionKey {
  return typeof value === 'string' && (SECTION_KEYS as readonly string[]).includes(value)
}

interface MaFichePageProps {
  searchParams: Promise<{ section?: string }>
}

interface DiagnosticianRow {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  bio: string | null
  years_active: number | null
  slug: string | null
  slug_city: string | null
  slug_dept: string | null
}

async function loadInitialProfile(): Promise<{
  isClaimed: boolean
  publicSlugPath: string | null
  initial: ProfileSectionInitialValues
}> {
  const { user, supabase, profile } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB régénérés async
  const sb = supabase as any

  const { data } = await sb
    .from('diagnosticians')
    .select(
      'id, full_name, first_name, last_name, company_name, bio, years_active, slug, slug_city, slug_dept',
    )
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  const diag = (data ?? null) as DiagnosticianRow | null

  const displayName =
    diag?.full_name?.trim() ||
    [diag?.first_name, diag?.last_name].filter(Boolean).join(' ').trim() ||
    profile.full_name ||
    ''

  const publicSlugPath =
    diag?.slug && diag.slug_dept && diag.slug_city
      ? `/diagnostiqueurs/${diag.slug_dept}/${diag.slug_city}/${diag.slug}`
      : null

  return {
    isClaimed: Boolean(diag?.id),
    publicSlugPath,
    initial: {
      displayName,
      // TODO: migration column `title` — pour l'instant on dérive depuis company_name
      title: diag?.company_name ?? '',
      // TODO: migration column `slogan`
      slogan: '',
      bio: diag?.bio ?? '',
      // TODO: migration column `languages`
      languages: [],
      yearsExperience:
        typeof diag?.years_active === 'number' && diag.years_active > 0 ? diag.years_active : null,
    },
  }
}

export default async function MaFichePage({ searchParams }: MaFichePageProps) {
  const sp = await searchParams
  const active: SectionKey = isSectionKey(sp.section) ? sp.section : 'profil'

  const { isClaimed, publicSlugPath, initial } = await loadInitialProfile()

  return (
    <div className="space-y-6 pb-8">
      <AppPageHeader
        eyebrow="Annuaire · Ma fiche"
        title="Ma fiche"
        accent="annuaire"
        description="Configurez ce qui s'affiche sur kovas.fr, comment vos clients vous trouvent et vous contactent."
        action={
          publicSlugPath ? (
            <Button asChild variant="outline">
              <Link href={publicSlugPath} target="_blank" rel="noopener noreferrer">
                Aperçu public
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Onglets : horizontal scroll mobile + tablet ; vertical sidebar desktop. */}
      <div className="md:hidden -mx-1 px-1">
        <PageTabs
          basePath="/dashboard/annuaire/ma-fiche"
          paramName="section"
          active={active}
          tabs={SECTIONS.map((s) => ({ key: s.key, label: s.label, icon: s.icon }))}
        />
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6 items-start">
        {/* Vertical desktop tabs */}
        <nav
          aria-label="Sections de la fiche"
          className="hidden md:flex flex-col gap-1 sticky top-24"
        >
          {SECTIONS.map((s) => {
            const isActive = s.key === active
            const Icon = s.icon
            return (
              <Link
                key={s.key}
                href={`/dashboard/annuaire/ma-fiche?section=${s.key}`}
                scroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors',
                  isActive
                    ? 'bg-navy text-paper font-semibold shadow-glass-sm'
                    : 'text-ink-mute hover:text-ink hover:bg-cream-deep/60',
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{s.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Content area */}
        <div className="min-w-0">
          {active === 'profil' ? (
            <ProfileSection initial={initial} isClaimed={isClaimed} />
          ) : (
            <SectionPlaceholder section={active} />
          )}
        </div>
      </div>
    </div>
  )
}

function SectionPlaceholder({ section }: { section: SectionKey }) {
  const meta = SECTIONS.find((s) => s.key === section)
  if (!meta) return null
  const Icon = meta.icon
  return (
    <Card variant="flat" padding="lg">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full bg-cream-deep text-ink shrink-0"
        >
          <Icon className="size-5" strokeWidth={1.5} />
        </div>
        <div className="space-y-2">
          <CardTitle>{meta.label}</CardTitle>
          <CardDescription>Section en cours de finalisation — disponible bientôt.</CardDescription>
          <p className="text-[12px] text-ink-mute leading-relaxed max-w-prose">
            Cette section sera activée dans les prochaines itérations du module annuaire. En
            attendant, la section <strong>Profil</strong> est entièrement éditable et vos
            modifications sont publiées immédiatement sur votre fiche publique.
          </p>
        </div>
      </div>
    </Card>
  )
}
