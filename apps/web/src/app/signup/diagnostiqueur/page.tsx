import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { WhyVerification } from './_components/why-verification'
import { WizardProgress } from './_components/wizard-progress'
import { Step1AccountForm } from './_steps/step1-account-form'
import { Step2PlanForm } from './_steps/step2-plan-form'
import { Step3IdentityForm } from './_steps/step3-identity-form'
import { Step4CofracForm } from './_steps/step4-cofrac-form'
import { Step5RcproForm } from './_steps/step5-rcpro-form'
import { Step6SireneForm } from './_steps/step6-sirene-form'
import { Step7Confirmation } from './_steps/step7-confirmation'

export const metadata: Metadata = {
  title: 'Inscription diagnostiqueur — KOVAS',
  description:
    'Activation conditionnelle stricte (Doctolib-style 2022) — vérification identité civile, COFRAC, RC Pro, SIRENE en 7 étapes.',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ step?: string }>
}

export default async function DiagnostiqueurOnboardingPage({ searchParams }: PageProps) {
  const { step: stepRaw } = await searchParams
  const stepNum = Number.parseInt(stepRaw ?? '1', 10)
  const step = Number.isFinite(stepNum) && stepNum >= 1 && stepNum <= 7 ? stepNum : 1

  if (stepRaw && step.toString() !== stepRaw) {
    redirect('/signup/diagnostiqueur?step=1')
  }

  return (
    <div className="space-y-6">
      <WizardProgress currentStep={step} />
      <div className="rounded-2xl bg-white border border-[#0F1419]/[0.08] p-6 sm:p-8 shadow-sm">
        {step === 1 && <Step1AccountForm />}
        {step === 2 && <Step2PlanForm />}
        {step === 3 && <Step3IdentityForm />}
        {step === 4 && <Step4CofracForm />}
        {step === 5 && <Step5RcproForm />}
        {step === 6 && <Step6SireneForm />}
        {step === 7 && <Step7Confirmation />}
      </div>
      {step >= 3 && step <= 6 && <WhyVerification />}
    </div>
  )
}
