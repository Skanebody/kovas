import { FileText, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Tableau de bord',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, default_org_id')
    .eq('id', user!.id)
    .single()

  const firstName = profile?.full_name?.split(' ')[0] ?? 'à vous'

  const { count: missionsCount } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Bonjour {firstName}</h1>
        <p className="text-muted-foreground">
          {missionsCount === 0
            ? 'Aucune mission pour le moment — créez la première.'
            : `${missionsCount} mission${missionsCount === 1 ? '' : 's'} en cours.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="size-4" /> Nouvelle mission
            </CardTitle>
            <CardDescription>DPE, amiante, plomb, gaz, électricité…</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Bientôt disponible
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Missions récentes
            </CardTitle>
            <CardDescription>Vos diagnostics en cours et terminés</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucune mission</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
