'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { MapPin, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, useState } from 'react'

interface GuideLocalSearchProps {
  readonly diagnosticLabel: string
}

/**
 * CTA "Trouver un diagnostiqueur [type] dans votre ville" en bas de guide.
 *
 * Input code postal + bouton ; submit redirige vers `/trouver-un-diagnostiqueur?cp=XX`
 * qui prend en charge le filtrage côté annuaire. En l'absence de code postal
 * valide (5 chiffres FR), fallback vers `/trouver-un-diagnostiqueur` simple.
 */
export function GuideLocalSearch({ diagnosticLabel }: GuideLocalSearchProps) {
  const router = useRouter()
  const [postalCode, setPostalCode] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = postalCode.trim()
    if (/^\d{5}$/.test(trimmed)) {
      router.push(`/trouver-un-diagnostiqueur?cp=${trimmed}`)
    } else {
      router.push('/trouver-un-diagnostiqueur')
    }
  }

  return (
    <Card variant="opaque" padding="lg" className="my-12">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink"
          >
            <MapPin className="size-5" />
          </span>
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
              Annuaire KOVAS
            </p>
            <h3 className="mt-1 font-display text-xl font-bold text-ink md:text-2xl">
              Trouver un diagnostiqueur {diagnosticLabel} près de chez vous
            </h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
              Comparez les professionnels certifiés de votre département.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex w-full max-w-md shrink-0 gap-2">
          <label htmlFor="local-search-cp" className="sr-only">
            Code postal de votre bien
          </label>
          <input
            id="local-search-cp"
            type="text"
            inputMode="numeric"
            pattern="\d{5}"
            placeholder="75008"
            maxLength={5}
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            className="h-12 flex-1 rounded-pill border border-rule bg-paper px-5 font-mono text-sm text-ink placeholder:text-ink-faint focus:border-ink focus:outline-none"
            aria-label="Code postal"
          />
          <Button type="submit" size="lg" variant="default" className="shrink-0">
            <Search className="size-4" aria-hidden />
            Trouver
          </Button>
        </form>
      </div>
    </Card>
  )
}
