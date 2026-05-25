import type { SupabaseClient } from '@supabase/supabase-js'

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n)
}

export async function generateQuoteNumber(sb: SupabaseClient<any, any, any>): Promise<string> {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const prefix = `RMT-${y}${m}${d}-`

  const { data } = await sb
    .from('quotes')
    .select('quote_number')
    .like('quote_number', `${prefix}%`)
    .order('quote_number', { ascending: false })
    .limit(1)

  let nextSeq = 1
  if (data && (data as { quote_number: string }[]).length > 0) {
    const last = (data as { quote_number: string }[])[0].quote_number
    const seq = parseInt(last.slice(prefix.length), 10)
    if (!isNaN(seq)) nextSeq = seq + 1
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function getPersonNames(
  list: { name?: string | null }[] | null | undefined,
  legacyName?: string | null
): string[] {
  const names = Array.isArray(list)
    ? list.map(p => p?.name?.trim()).filter((n): n is string => !!n)
    : []
  if (names.length === 0 && legacyName?.trim()) return [legacyName.trim()]
  return names
}

export function formatPersonList(
  list: { name?: string | null }[] | null | undefined,
  legacyName?: string | null
): { display: string; full: string } {
  const names = Array.isArray(list)
    ? list.map(p => p?.name?.trim()).filter((n): n is string => !!n)
    : []

  if (names.length === 0 && legacyName?.trim()) {
    return { display: legacyName.trim(), full: legacyName.trim() }
  }

  if (names.length === 0) return { display: '-', full: '' }
  if (names.length === 1) return { display: names[0], full: names[0] }
  return {
    display: `${names[0]} +${names.length - 1}명`,
    full: names.join(', '),
  }
}
