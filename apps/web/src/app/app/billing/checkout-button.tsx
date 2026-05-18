'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CheckoutButtonProps {
  tier: 'discovery' | 'standard' | 'volume'
  label: string
}

export function CheckoutButton({ tier, label }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cycle: 'monthly' }),
      })
      const data = await resp.json()
      if (resp.status === 503 && data.stub) {
        setError('Stripe non configuré (mode dev — STRIPE_SECRET_KEY manquante).')
        setLoading(false)
        return
      }
      if (!resp.ok || !data.url) {
        throw new Error(data.error ?? 'Checkout failed')
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={handleClick} disabled={loading}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        Choisir {label}
      </Button>
      {error && (
        <p className="text-xs text-accent-red" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
