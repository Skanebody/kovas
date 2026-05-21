'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type LoginState, loginAction } from './actions'

type LoginFormProps = {
  /** Renseigné en dev via KOVAS_DEV_LOGIN_PREFILL_* (cf. .env.example) */
  defaultEmail?: string
  defaultPassword?: string
}

export function LoginForm({ defaultEmail = '', defaultPassword = '' }: LoginFormProps) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email professionnel</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nom@cabinet.fr"
          defaultValue={defaultEmail}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          defaultValue={defaultPassword}
        />
      </div>

      {state?.error && (
        <p className="text-sm text-[#DC2626]" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Se connecter
      </Button>
    </form>
  )
}
