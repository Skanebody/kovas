import type { Metadata } from 'next'
import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicNav } from '@/components/public/PublicNav'
import { VerifyEmailForm } from './verify-email-form'

export const metadata: Metadata = {
  title: 'Confirmez votre demande — KOVAS',
  description: 'Vérifiez votre adresse email pour transmettre votre demande de devis aux diagnostiqueurs.',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function VerifierMonEmailPage({ params }: PageProps) {
  const { token } = await params

  return (
    <div className="min-h-dvh bg-[#F8F5EE] text-[#0F1E3D] font-sans antialiased flex flex-col">
      <PublicNav variant="b2c" />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <VerifyEmailForm trackingToken={token} />
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
