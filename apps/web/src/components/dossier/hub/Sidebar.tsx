import type { CalendarEntry } from './SidebarBlocks/CalendarBlock'
import { CalendarBlock } from './SidebarBlocks/CalendarBlock'
import type { OtherDossier } from './SidebarBlocks/OtherDossiersBlock'
import { OtherDossiersBlock } from './SidebarBlocks/OtherDossiersBlock'
import type { Opportunity } from './SidebarBlocks/OpportunitiesBlock'
import { OpportunitiesBlock } from './SidebarBlocks/OpportunitiesBlock'
import type { PropertyHistoryItem } from './SidebarBlocks/PropertyHistoryBlock'
import { PropertyHistoryBlock } from './SidebarBlocks/PropertyHistoryBlock'
import { QuickActionsBlock } from './SidebarBlocks/QuickActionsBlock'
import type { VigilanceSignal } from './SidebarBlocks/VigilanceBlock'
import { VigilanceBlock } from './SidebarBlocks/VigilanceBlock'
import { AdminShortcutsBlock } from './SidebarBlocks/AdminShortcutsBlock'

interface SidebarProps {
  dossierId: string
  dossierReference: string
  clientName: string | null
  clientPhone: string | null
  clientEmail: string | null
  clientAddress: string | null
  propertyAddress: string | null
  calendarEntries: ReadonlyArray<CalendarEntry>
  propertyHistory: ReadonlyArray<PropertyHistoryItem>
  otherDossiers: ReadonlyArray<OtherDossier>
  opportunities: ReadonlyArray<Opportunity>
  vigilanceSignals: ReadonlyArray<VigilanceSignal>
}

/**
 * Sidebar contextuelle 4 colonnes sticky du Hub Dossier.
 * 7 blocs : Actions rapides / Calendrier / Historique bien / Autres dossiers /
 *           Opportunités / Vigilance / Raccourcis administratifs.
 */
export function Sidebar({
  dossierId,
  dossierReference,
  clientName,
  clientPhone,
  clientEmail,
  clientAddress,
  propertyAddress,
  calendarEntries,
  propertyHistory,
  otherDossiers,
  opportunities,
  vigilanceSignals,
}: SidebarProps) {
  return (
    <aside className="space-y-3 lg:sticky lg:top-[88px] lg:max-h-[calc(100vh-100px)] lg:overflow-y-auto lg:pr-1">
      <QuickActionsBlock
        dossierId={dossierId}
        clientPhone={clientPhone}
        clientEmail={clientEmail}
      />
      <CalendarBlock entries={calendarEntries} />
      <PropertyHistoryBlock items={propertyHistory} />
      <OtherDossiersBlock dossiers={otherDossiers} />
      <OpportunitiesBlock opportunities={opportunities} />
      <VigilanceBlock signals={vigilanceSignals} />
      <AdminShortcutsBlock
        dossierId={dossierId}
        dossierReference={dossierReference}
        clientName={clientName}
        clientAddress={clientAddress}
        propertyAddress={propertyAddress}
      />
    </aside>
  )
}
