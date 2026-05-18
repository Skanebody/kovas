import { NextResponse } from 'next/server'
import { searchBanAddress } from '@/lib/ban'

/**
 * Endpoint proxy pour le widget BAN autocomplete client-side.
 * Évite d'exposer l'URL externe directement + permet de centraliser le rate-limit plus tard.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const features = await searchBanAddress(q)
  return NextResponse.json({ features })
}
