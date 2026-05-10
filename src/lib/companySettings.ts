import { createClient } from '@/lib/supabase/client'
import type { Rates } from '@/components/quotes/QuoteSummaryTable'

export async function fetchCompanyRates(): Promise<Rates | null> {
  const sb = createClient()
  const { data, error } = await sb
    .from('company_settings')
    .select('rate_accident_insurance, rate_employment_insurance, rate_indirect_overhead, rate_profit_margin, rate_vat')
    .single()

  if (error || !data) {
    console.warn('[companySettings] fetch failed:', error)
    return null
  }

  const round2 = (n: number) => Math.round(n * 100) / 100

  return {
    accident: round2(Number(data.rate_accident_insurance) * 100),
    employment: round2(Number(data.rate_employment_insurance) * 100),
    overhead: round2(Number(data.rate_indirect_overhead) * 100),
    profit: round2(Number(data.rate_profit_margin) * 100),
    vat: round2(Number(data.rate_vat) * 100),
  }
}

export async function saveCompanyRates(rates: Rates): Promise<{ success: boolean; error?: string }> {
  const sb = createClient()

  const { data: existing, error: fetchError } = await sb
    .from('company_settings')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: 'company_settings row not found' }
  }

  const { error } = await sb
    .from('company_settings')
    .update({
      rate_accident_insurance: rates.accident / 100,
      rate_employment_insurance: rates.employment / 100,
      rate_indirect_overhead: rates.overhead / 100,
      rate_profit_margin: rates.profit / 100,
      rate_vat: rates.vat / 100,
    })
    .eq('id', existing.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
