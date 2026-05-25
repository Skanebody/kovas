/**
 * Vitest — Algo A1.3.7 document classifier.
 */

import { describe, expect, it } from 'vitest'
import { classifyDocument } from './document-classifier'

describe('classifyDocument', () => {
  it('returns photo for image MIME', () => {
    const res = classifyDocument({
      filename: 'IMG_1234.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 2_500_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('photo')
    expect(res.confidence).toBeGreaterThanOrEqual(0.9)
    expect(res.requires_ai_fallback).toBe(false)
  })

  it('returns photo for HEIC extension even without MIME', () => {
    const res = classifyDocument({
      filename: 'photo.heic',
      mime_type: null,
      size_bytes: 4_000_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('photo')
  })

  it('detects previous DPE via filename', () => {
    const res = classifyDocument({
      filename: 'ancien-dpe-2022.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1_000_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('previous_dpe')
    expect(res.confidence).toBeGreaterThanOrEqual(0.85)
    expect(res.suggested_use).toContain('DPE shopping')
  })

  it('detects energy bill via filename', () => {
    const res = classifyDocument({
      filename: 'facture-edf-2024.pdf',
      mime_type: 'application/pdf',
      size_bytes: 800_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('energy_bill')
    expect(res.suggested_use).toContain('DPE 3CL')
  })

  it('detects invoice works via filename', () => {
    const res = classifyDocument({
      filename: 'facture-isolation-combles.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1_200_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('invoice_works')
  })

  it('detects floor plan via filename', () => {
    const res = classifyDocument({
      filename: 'plan-rdc-appartement.pdf',
      mime_type: 'application/pdf',
      size_bytes: 500_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('floor_plan')
  })

  it('detects property deed via filename', () => {
    const res = classifyDocument({
      filename: 'compromis-vente-2025.pdf',
      mime_type: 'application/pdf',
      size_bytes: 2_000_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('property_deed')
  })

  it('detects safety certificate via filename', () => {
    const res = classifyDocument({
      filename: 'attestation-consuel.pdf',
      mime_type: 'application/pdf',
      size_bytes: 200_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('safety_certificate')
  })

  it('detects tax document via filename', () => {
    const res = classifyDocument({
      filename: 'taxe-fonciere-2024.pdf',
      mime_type: 'application/pdf',
      size_bytes: 300_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('tax_document')
  })

  it('falls back to other_admin for unknown PDF with no keyword match', () => {
    const res = classifyDocument({
      filename: 'document.pdf',
      mime_type: 'application/pdf',
      size_bytes: 500_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('other_admin')
    expect(res.requires_ai_fallback).toBe(true)
  })

  it('returns unknown for unsupported extensions', () => {
    const res = classifyDocument({
      filename: 'archive.zip',
      mime_type: 'application/zip',
      size_bytes: 5_000_000,
      ocr_preview: null,
    })
    expect(res.predicted_type).toBe('unknown')
    expect(res.requires_ai_fallback).toBe(true)
  })

  it('uses OCR preview for energy bill when filename ambiguous', () => {
    const res = classifyDocument({
      filename: 'releve-2024.pdf',
      mime_type: 'application/pdf',
      size_bytes: 800_000,
      ocr_preview: 'EDF — votre facture mensuelle, consommation annuelle 12450 kWh',
    })
    expect(res.predicted_type).toBe('energy_bill')
    expect(res.confidence).toBeGreaterThanOrEqual(0.9)
  })
})
