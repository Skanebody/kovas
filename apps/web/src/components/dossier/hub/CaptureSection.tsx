import { Card } from '@/components/ui/card'
import { Camera, FileText, Home, Mic } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { HubOwnerDocMini, HubPhotoMini, HubRoom, HubVoiceNoteMini } from './types'

interface CaptureSectionProps {
  dossierId: string
  rooms: HubRoom[]
  photos: HubPhotoMini[]
  voiceNotes: HubVoiceNoteMini[]
  ownerDocs: HubOwnerDocMini[]
}

interface SignedThumb {
  id: string
  url: string
}

async function signThumbs(photos: HubPhotoMini[]): Promise<SignedThumb[]> {
  if (photos.length === 0) return []
  const supabase = await createClient()
  const paths = photos.slice(0, 6).map((p) => p.storage_path)
  const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 3600)
  if (!data) return []
  const out: SignedThumb[] = []
  data.forEach((entry, i) => {
    const id = photos[i]?.id
    const url = entry.signedUrl
    if (id && url) out.push({ id, url })
  })
  return out
}

/**
 * Section 2 — Capture terrain (compteurs + thumbnails + extraits voix).
 * Server Component, signe les URLs des thumbnails.
 */
export async function CaptureSection({
  dossierId,
  rooms,
  photos,
  voiceNotes,
  ownerDocs,
}: CaptureSectionProps) {
  const thumbs = await signThumbs(photos)
  const latestVoice = voiceNotes.slice(0, 2)

  return (
    <Card variant="flat" padding="default" id="capture" className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Capture terrain</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 02</p>
      </div>

      {/* 4 compteurs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Counter icon={Home} label="Pièces" value={rooms.length} />
        <Counter icon={Camera} label="Photos" value={photos.length} />
        <Counter icon={Mic} label="Notes vocales" value={voiceNotes.length} />
        <Counter icon={FileText} label="Documents" value={ownerDocs.length} />
      </div>

      {/* Thumbnails photos */}
      {thumbs.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Dernières photos
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {thumbs.map((t) => (
              <Link
                key={t.id}
                href={`/app/dossiers/${dossierId}#photo-${t.id}`}
                className="block aspect-square overflow-hidden rounded-md border border-rule/60 bg-cream-deep"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.url}
                  alt="Photo de mission"
                  className="size-full object-cover transition-transform duration-base hover:scale-105"
                  loading="lazy"
                />
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Extraits voice notes */}
      {latestVoice.length > 0 ? (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
            Derniers extraits vocaux
          </p>
          <ul className="space-y-2">
            {latestVoice.map((v) => (
              <li
                key={v.id}
                className="rounded-md border border-rule/50 bg-cream-deep/40 p-3 text-[13px] text-ink-soft"
              >
                <p className="line-clamp-2">
                  {v.transcript_raw ?? <span className="italic text-ink-faint">Transcription en cours…</span>}
                </p>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                  <Mic className="size-3" />
                  {v.duration_seconds ? `${v.duration_seconds}s` : '—'}
                  {v.ai_confidence ? ` · IA ${Math.round(v.ai_confidence * 100)}%` : null}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Empty state global */}
      {rooms.length === 0 && photos.length === 0 && voiceNotes.length === 0 ? (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-4 text-center text-[13px] text-ink-mute">
          Aucune donnée de terrain capturée pour le moment.
        </div>
      ) : null}
    </Card>
  )
}

function Counter({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Camera
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border border-rule/60 bg-cream-deep/30 p-3">
      <div className="flex items-center gap-2 text-ink-mute">
        <Icon className="size-3.5" />
        <p className="font-mono text-[10px] uppercase tracking-[0.06em]">{label}</p>
      </div>
      <p className="mt-1 font-serif italic text-[28px] leading-none text-ink">{value}</p>
    </div>
  )
}
