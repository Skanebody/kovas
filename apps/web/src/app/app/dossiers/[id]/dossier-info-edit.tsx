'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { Loader2, Pencil, X } from 'lucide-react'
import { useState, useTransition } from 'react'
import { updateDossierInfoAction } from './actions'

interface DossierInfoEditProps {
  dossierId: string
  scheduledAt: string | null
  notes: string | null
  clientId: string | null
  clients: { id: string; display_name: string }[]
}

/**
 * Format ISO date → input datetime-local (YYYY-MM-DDTHH:mm).
 */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function DossierInfoEdit({
  dossierId,
  scheduledAt,
  notes,
  clientId,
  clients,
}: DossierInfoEditProps) {
  const [open, setOpen] = useState(false)
  const [scheduled, setScheduled] = useState(toLocalInput(scheduledAt))
  const [notesVal, setNotesVal] = useState(notes ?? '')
  const [clientVal, setClientVal] = useState(clientId ?? '')
  const [saving, startSave] = useTransition()

  function save() {
    startSave(async () => {
      const result = await updateDossierInfoAction(dossierId, {
        scheduled_at: scheduled || null,
        notes: notesVal || null,
        client_id: clientVal || null,
      })
      if (result.conflicts.length > 0) {
        const list = result.conflicts
          .map((c) => {
            const t = new Date(c.scheduledAt).toLocaleTimeString('fr-FR', {
              hour: '2-digit',
              minute: '2-digit',
            })
            return `${t} · ${c.clientName ?? c.reference}`
          })
          .join(', ')
        toast.warning(
          `Conflit planning : ${result.conflicts.length} autre${result.conflicts.length > 1 ? 's' : ''} RDV dans ±90 min (${list})`,
          { duration: 8000 },
        )
      } else {
        toast.success('Dossier mis à jour')
      }
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Modifier
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-md border border-foreground/30 bg-card p-4 mt-3">
      <FormField label="Date prévue" htmlFor="scheduledAt">
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
        />
      </FormField>
      <FormField label="Client donneur d'ordre" htmlFor="clientId">
        <Select id="clientId" value={clientVal} onChange={(e) => setClientVal(e.target.value)}>
          <option value="">— Aucun client lié —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.display_name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Notes internes" htmlFor="notes">
        <Textarea
          id="notes"
          rows={3}
          value={notesVal}
          onChange={(e) => setNotesVal(e.target.value)}
        />
      </FormField>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          <X className="size-4" /> Annuler
        </Button>
      </div>
    </div>
  )
}
