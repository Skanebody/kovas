'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  DIAGNOSTIC_TYPE_LABELS,
  type DiagnosticType,
  type Usage,
  calculateExpiration,
} from '@/lib/diagnostic-validity/expiration-calculator'
import { Loader2, Sparkles } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import { confirmDiagnosticScanAction } from './actions'

interface ScanRow {
  id: string
  original_name: string | null
  diagnostic_type: DiagnosticType | null
  date_emission: string | null
  date_expiration: string | null
  adresse: string | null
  proprietaire: string | null
  ademe_number: string | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  result_positive: boolean | null
  usage_context: 'vente' | 'location' | 'unknown' | null
  ai_confidence: number | null
  client_id: string | null
  property_id: string | null
}

interface ClientOption {
  id: string
  display_name: string
}
interface PropertyOption {
  id: string
  address: string
  city: string | null
  postal_code: string | null
  client_id: string | null
}

interface ScanProposalDialogProps {
  scan: ScanRow
  clients: ClientOption[]
  properties: PropertyOption[]
  onClose: () => void
}

const DIAG_TYPES: DiagnosticType[] = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
]

export function ScanProposalDialog({
  scan,
  clients,
  properties,
  onClose,
}: ScanProposalDialogProps) {
  const [diagnosticType, setDiagnosticType] = useState<DiagnosticType>(
    scan.diagnostic_type ?? 'dpe',
  )
  const [dateEmission, setDateEmission] = useState<string>(scan.date_emission ?? '')
  const [usage, setUsage] = useState<Usage>((scan.usage_context as Usage | null) ?? 'vente')
  const [resultPositive, setResultPositive] = useState<'true' | 'false' | ''>(
    scan.result_positive === true ? 'true' : scan.result_positive === false ? 'false' : '',
  )
  const [energyClass, setEnergyClass] = useState<string>(scan.energy_class ?? '')
  const [ademeNumber, setAdemeNumber] = useState<string>(scan.ademe_number ?? '')
  const [clientId, setClientId] = useState<string>(scan.client_id ?? '')
  const [propertyId, setPropertyId] = useState<string>(scan.property_id ?? '')
  const [overrideExpiration, setOverrideExpiration] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filtrage des biens : si client choisi, on prioritise les biens de ce client
  const filteredProperties = useMemo(() => {
    if (!clientId) return properties
    const ofClient = properties.filter((p) => p.client_id === clientId)
    if (ofClient.length === 0) return properties
    return ofClient
  }, [properties, clientId])

  // Calcul live de la date d'expiration
  const computedExpiration = useMemo(() => {
    if (!dateEmission) return null
    return calculateExpiration({
      type: diagnosticType,
      dateEmission,
      usage,
      resultPositive:
        resultPositive === 'true' ? true : resultPositive === 'false' ? false : undefined,
    })
  }, [diagnosticType, dateEmission, usage, resultPositive])

  const finalExpiration = overrideExpiration || computedExpiration?.dateExpiration || ''

  const isDpe = diagnosticType === 'dpe'
  const needsResultPositive = diagnosticType === 'amiante' || diagnosticType === 'plomb'
  const needsUsage =
    diagnosticType === 'gaz' || diagnosticType === 'electricite' || diagnosticType === 'plomb'

  function handleConfirm() {
    setError(null)
    if (!dateEmission) {
      setError("La date d'émission est requise.")
      return
    }
    startTransition(async () => {
      try {
        await confirmDiagnosticScanAction({
          scanId: scan.id,
          diagnostic_type: diagnosticType,
          date_emission: dateEmission,
          client_id: clientId || null,
          property_id: propertyId || null,
          usage_context: usage,
          result_positive:
            resultPositive === 'true' ? true : resultPositive === 'false' ? false : null,
          energy_class: isDpe
            ? ((energyClass || null) as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null)
            : null,
          ademe_number: isDpe ? ademeNumber || null : null,
        })
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur')
      }
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Proposition de rangement</DialogTitle>
          <DialogDescription>
            Ce diagnostic semble correspondre aux éléments suivants. Vérifiez, corrigez si besoin,
            puis confirmez.
            {scan.ai_confidence != null ? (
              <>
                {' '}
                <Badge variant="muted" className="ml-1 align-middle">
                  <Sparkles className="size-3 mr-1" />
                  {Math.round(scan.ai_confidence * 100)}% confiance IA
                </Badge>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
          <FormField htmlFor="diagnostic_type" label="Type de diagnostic">
            <Select
              id="diagnostic_type"
              value={diagnosticType}
              onChange={(e) => setDiagnosticType(e.target.value as DiagnosticType)}
            >
              {DIAG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DIAGNOSTIC_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField htmlFor="date_emission" label="Date d'émission">
              <Input
                id="date_emission"
                type="date"
                value={dateEmission}
                onChange={(e) => setDateEmission(e.target.value)}
              />
            </FormField>

            <FormField
              htmlFor="date_expiration"
              label="Date d'expiration"
              hint={
                computedExpiration ? `Calcul auto : ${computedExpiration.validityLabel}` : undefined
              }
            >
              <Input
                id="date_expiration"
                type="date"
                value={finalExpiration}
                onChange={(e) => setOverrideExpiration(e.target.value)}
                placeholder={
                  computedExpiration?.dateExpiration === null ? 'Validité illimitée' : undefined
                }
                disabled={computedExpiration?.dateExpiration === null && !overrideExpiration}
              />
            </FormField>
          </div>

          {needsUsage ? (
            <FormField htmlFor="usage_context" label="Usage du diagnostic">
              <Select
                id="usage_context"
                value={usage}
                onChange={(e) => setUsage(e.target.value as Usage)}
              >
                <option value="vente">Vente</option>
                <option value="location">Location</option>
              </Select>
            </FormField>
          ) : null}

          {needsResultPositive ? (
            <FormField htmlFor="result_positive" label="Résultat">
              <Select
                id="result_positive"
                value={resultPositive}
                onChange={(e) => setResultPositive(e.target.value as 'true' | 'false' | '')}
              >
                <option value="">Non précisé</option>
                <option value="false">Négatif (aucun matériau détecté)</option>
                <option value="true">Positif (matériaux détectés)</option>
              </Select>
            </FormField>
          ) : null}

          {isDpe ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField htmlFor="energy_class" label="Classe énergétique">
                <Select
                  id="energy_class"
                  value={energyClass}
                  onChange={(e) => setEnergyClass(e.target.value)}
                >
                  <option value="">—</option>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField htmlFor="ademe_number" label="Numéro ADEME">
                <Input
                  id="ademe_number"
                  value={ademeNumber}
                  onChange={(e) => setAdemeNumber(e.target.value)}
                  placeholder="2168E1234567A"
                />
              </FormField>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-rule/60">
            <FormField
              htmlFor="client_id"
              label="Client"
              hint={scan.proprietaire ? `Détecté : ${scan.proprietaire}` : undefined}
            >
              <Select
                id="client_id"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value)
                  // si on change de client, on réinitialise le bien si plus cohérent
                  const target = e.target.value
                  if (target && propertyId) {
                    const prop = properties.find((p) => p.id === propertyId)
                    if (prop?.client_id && prop.client_id !== target) {
                      setPropertyId('')
                    }
                  }
                }}
              >
                <option value="">— Aucun (à créer plus tard) —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.display_name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              htmlFor="property_id"
              label="Bien"
              hint={scan.adresse ? `Détecté : ${scan.adresse}` : undefined}
            >
              <Select
                id="property_id"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
              >
                <option value="">— Aucun (à créer plus tard) —</option>
                {filteredProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {[p.address, p.postal_code, p.city].filter(Boolean).join(' ')}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          {(!clientId || !propertyId) && (scan.adresse || scan.proprietaire) ? (
            <p className="text-xs text-ink-mute">
              {!clientId && scan.proprietaire ? (
                <>
                  Aucun client correspondant. Vous pouvez{' '}
                  <a
                    href={`/dashboard/clients/new?display_name=${encodeURIComponent(scan.proprietaire)}`}
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    créer un client
                  </a>{' '}
                  puis revenir.
                </>
              ) : null}
              {!propertyId && scan.adresse ? (
                <>
                  {!clientId ? ' ' : ''}Aucun bien correspondant. Vous pouvez{' '}
                  <a
                    href={`/dashboard/properties/new?address=${encodeURIComponent(scan.adresse)}`}
                    className="underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    créer un bien
                  </a>
                  .
                </>
              ) : null}
            </p>
          ) : null}

          {error ? (
            <p className="text-xs text-accent-red" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="accent" onClick={handleConfirm} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Confirmer le rangement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
