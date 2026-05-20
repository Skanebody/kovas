/**
 * Panneau tests système (smoke tests).
 */

import { Card } from '@/components/ui/card'
import { ActionRunner } from './ActionRunner'

interface SystemTestsPanelProps {
  defaultEmail: string
}

export function SystemTestsPanel({ defaultEmail }: SystemTestsPanelProps) {
  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🧪 Tests · Smoke tests
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Tests système
        </h2>
      </header>

      <ActionRunner
        label="Test envoi email Resend"
        description="Envoie un email à l'adresse renseignée"
        endpoint="/api/admin/tests/resend"
        inputField={{
          key: 'email',
          label: 'Destinataire',
          placeholder: 'admin@example.com',
          defaultValue: defaultEmail,
        }}
      />
      <ActionRunner
        label="Test webhook Stripe"
        description="POST event factice sur /api/webhooks/stripe (V1 log only)"
        endpoint="/api/admin/tests/stripe-webhook"
      />
      <ActionRunner
        label="Test Vision IA Haiku"
        description="Upload photo test + appel Claude Haiku (V1 log only)"
        endpoint="/api/admin/tests/vision-ai"
      />
      <ActionRunner
        label="Test transcription Whisper"
        description="Stub audio 5s + appel Whisper (V1 log only)"
        endpoint="/api/admin/tests/whisper"
      />
      <ActionRunner
        label="Test BAN search"
        description="Ping l'API adresse.data.gouv.fr"
        endpoint="/api/admin/tests/ban-search"
        inputField={{ key: 'q', label: 'Query BAN', placeholder: 'Paris', defaultValue: 'Paris' }}
      />
    </Card>
  )
}
