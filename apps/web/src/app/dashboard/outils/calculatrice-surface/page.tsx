import { AppPageHeader } from '@/components/app-page-header'
import { SurfaceCalculator } from '@/components/utilities/tools/SurfaceCalculator'

export const metadata = {
  title: 'Calculatrice surface — KOVAS',
}

export default function CalculatriceSurfacePage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Calculatrice"
        accent="surface"
        description="Rectangle, L, T, trapèze, triangle, cercle… additionnez vos pièces, le total se met à jour en direct."
      />
      <SurfaceCalculator />
    </div>
  )
}
