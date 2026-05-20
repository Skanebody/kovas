'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import {
  type Channel,
  DEFAULT_REQUESTED_DOCUMENTS,
  type EmailTemplateKey,
  type GeneratedTemplate,
  type SmsTemplateKey,
  type TemplateVars,
  generateTemplate,
} from '@/lib/utilities/client-template-generator'
import { Copy, Mail, MessageCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

const EMAIL_OPTIONS: { value: EmailTemplateKey; label: string }[] = [
  { value: 'demande_documents', label: 'Demande de documents' },
  { value: 'confirmation_rdv', label: 'Confirmation de RDV' },
  { value: 'rappel_rdv', label: 'Rappel J-1' },
  { value: 'rapport_envoye', label: 'Rapport envoyé' },
  { value: 'relance_paiement', label: 'Relance paiement (V2)' },
]

const SMS_OPTIONS: { value: SmsTemplateKey; label: string }[] = [
  { value: 'rappel_rdv', label: 'Rappel J-1' },
  { value: 'confirmation_rdv', label: 'Confirmation RDV' },
  { value: 'rapport_envoye', label: 'Rapport envoyé' },
]

export function ClientTemplateGenerator() {
  const [channel, setChannel] = useState<Channel>('email')
  const [emailKey, setEmailKey] = useState<EmailTemplateKey>('demande_documents')
  const [smsKey, setSmsKey] = useState<SmsTemplateKey>('rappel_rdv')
  const [vars, setVars] = useState<Partial<TemplateVars>>({})
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(
    new Set(DEFAULT_REQUESTED_DOCUMENTS.slice(0, 3)),
  )

  const templateKey: EmailTemplateKey | SmsTemplateKey = channel === 'email' ? emailKey : smsKey

  const generated: GeneratedTemplate = useMemo(() => {
    return generateTemplate({
      channel,
      templateKey,
      vars,
      requestedDocuments:
        channel === 'email' && emailKey === 'demande_documents'
          ? Array.from(checkedDocs)
          : undefined,
    })
  }, [channel, templateKey, emailKey, vars, checkedDocs])

  const trackUsage = () => {
    void fetch('/api/utilities/generate-client-template', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        channel,
        templateKey,
        vars,
        requestedDocuments:
          channel === 'email' && emailKey === 'demande_documents'
            ? Array.from(checkedDocs)
            : undefined,
      }),
    }).catch(() => undefined)
  }

  const copyToClipboard = () => {
    const text =
      generated.subject !== undefined
        ? `Sujet : ${generated.subject}\n\n${generated.body}`
        : generated.body
    void navigator.clipboard.writeText(text)
    toast.success('Copié', { description: 'Le message est dans le presse-papier.' })
    trackUsage()
  }

  const sendVia = () => {
    if (channel === 'email') {
      const url = `mailto:?subject=${encodeURIComponent(generated.subject ?? '')}&body=${encodeURIComponent(generated.body)}`
      window.location.href = url
    } else {
      const url = `sms:?body=${encodeURIComponent(generated.body)}`
      window.location.href = url
    }
    trackUsage()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      <Card variant="opaque" padding="default">
        <CardTitle>Paramètres</CardTitle>
        <CardDescription className="mt-1 mb-5">
          Sélectionnez le canal et le modèle, complétez les variables.
        </CardDescription>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={channel === 'email' ? 'default' : 'outline'}
              onClick={() => setChannel('email')}
            >
              <Mail className="size-4" /> Email
            </Button>
            <Button
              type="button"
              variant={channel === 'sms' ? 'default' : 'outline'}
              onClick={() => setChannel('sms')}
            >
              <MessageCircle className="size-4" /> SMS
            </Button>
          </div>

          {channel === 'email' ? (
            <div>
              <Label htmlFor="ek" className="mb-1.5">
                Modèle email
              </Label>
              <Select
                id="ek"
                value={emailKey}
                onChange={(e) => setEmailKey(e.target.value as EmailTemplateKey)}
              >
                {EMAIL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <div>
              <Label htmlFor="sk" className="mb-1.5">
                Modèle SMS
              </Label>
              <Select
                id="sk"
                value={smsKey}
                onChange={(e) => setSmsKey(e.target.value as SmsTemplateKey)}
              >
                {SMS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <VarsForm vars={vars} setVars={setVars} />

          {channel === 'email' && emailKey === 'demande_documents' ? (
            <div className="space-y-2">
              <Label className="mb-1">Documents demandés</Label>
              {DEFAULT_REQUESTED_DOCUMENTS.map((doc) => {
                const checked = checkedDocs.has(doc)
                return (
                  <label key={doc} className="flex items-start gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setCheckedDocs((s) => {
                          const next = new Set(s)
                          if (e.target.checked) next.add(doc)
                          else next.delete(doc)
                          return next
                        })
                      }}
                      className="size-4 rounded border-rule accent-navy mt-0.5"
                    />
                    {doc}
                  </label>
                )
              })}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="space-y-4">
        <Card variant="opaque" padding="default">
          <CardTitle>Aperçu</CardTitle>
          {generated.subject !== undefined ? (
            <div className="mt-3">
              <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint mb-1">
                Sujet
              </p>
              <p className="text-[14px] font-semibold text-ink">{generated.subject}</p>
            </div>
          ) : null}
          <div className="mt-3">
            <p className="font-mono text-[11px] uppercase tracking-wide text-ink-faint mb-1">
              {channel === 'email' ? 'Corps' : 'Message SMS'}
            </p>
            <Textarea
              value={generated.body}
              readOnly
              rows={channel === 'email' ? 14 : 3}
              className="font-mono text-[12.5px] leading-relaxed bg-paper/60"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={copyToClipboard}>
              <Copy className="size-4" />
              Copier
            </Button>
            <Button type="button" variant="accent" onClick={sendVia}>
              {channel === 'email' ? (
                <>
                  <Mail className="size-4" /> Ouvrir dans email
                </>
              ) : (
                <>
                  <MessageCircle className="size-4" /> Ouvrir dans SMS
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

interface VarsFormProps {
  vars: Partial<TemplateVars>
  setVars: (v: Partial<TemplateVars>) => void
}

function VarsForm({ vars, setVars }: VarsFormProps) {
  const set = (patch: Partial<TemplateVars>) => setVars({ ...vars, ...patch })
  return (
    <div className="grid grid-cols-1 gap-3 pt-2 border-t border-rule/40">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-faint">Variables</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cn" className="mb-1.5">
            Nom client
          </Label>
          <Input
            id="cn"
            value={vars.clientName ?? ''}
            onChange={(e) => set({ clientName: e.target.value })}
            placeholder="M. Dupont"
          />
        </div>
        <div>
          <Label htmlFor="dn" className="mb-1.5">
            Votre nom
          </Label>
          <Input
            id="dn"
            value={vars.diagnosticianName ?? ''}
            onChange={(e) => set({ diagnosticianName: e.target.value })}
            placeholder="Benjamin Bel"
          />
        </div>
        <div>
          <Label htmlFor="ad" className="mb-1.5">
            Date RDV
          </Label>
          <Input
            id="ad"
            value={vars.appointmentDate ?? ''}
            onChange={(e) => set({ appointmentDate: e.target.value })}
            placeholder="vendredi 23 mai 2026"
          />
        </div>
        <div>
          <Label htmlFor="at" className="mb-1.5">
            Heure RDV
          </Label>
          <Input
            id="at"
            value={vars.appointmentTime ?? ''}
            onChange={(e) => set({ appointmentTime: e.target.value })}
            placeholder="14h30"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="aa" className="mb-1.5">
            Adresse
          </Label>
          <Input
            id="aa"
            value={vars.appointmentAddress ?? ''}
            onChange={(e) => set({ appointmentAddress: e.target.value })}
            placeholder="12 rue de Paris, 75001 Paris"
          />
        </div>
        <div>
          <Label htmlFor="dp" className="mb-1.5">
            Votre téléphone
          </Label>
          <Input
            id="dp"
            value={vars.diagnosticianPhone ?? ''}
            onChange={(e) => set({ diagnosticianPhone: e.target.value })}
            placeholder="+33 6 12 34 56 78"
          />
        </div>
        <div>
          <Label htmlFor="de" className="mb-1.5">
            Votre email
          </Label>
          <Input
            id="de"
            value={vars.diagnosticianEmail ?? ''}
            onChange={(e) => set({ diagnosticianEmail: e.target.value })}
            placeholder="contact@kovas.fr"
          />
        </div>
        <div className="col-span-2">
          <Label htmlFor="rl" className="mb-1.5">
            Lien rapport
          </Label>
          <Input
            id="rl"
            value={vars.reportLink ?? ''}
            onChange={(e) => set({ reportLink: e.target.value })}
            placeholder="https://kovas.fr/rapports/..."
          />
        </div>
      </div>
    </div>
  )
}
