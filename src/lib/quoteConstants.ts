import type { Rates } from '@/components/quotes/QuoteSummaryTable'

export const DEFAULT_RATES: Rates = {
  accident: 3.78,
  employment: 2.05,
  overhead: 5,
  profit: 15,
  vat: 10,
}

export const QUOTE_STATUS = {
  DRAFT: '작성중',
  DEPLOYED: '배포',
  CONTRACT: '계약',
  SETTLEMENT: '정산',
} as const

export type QuoteStatus = typeof QUOTE_STATUS[keyof typeof QUOTE_STATUS]

export const QUOTE_STATUS_COLOR: Record<QuoteStatus, string> = {
  작성중: 'bg-blue-100 text-blue-700',
  배포: 'bg-purple-100 text-purple-700',
  계약: 'bg-green-100 text-green-700',
  정산: 'bg-orange-100 text-orange-700',
}

export const READONLY_STATUSES: QuoteStatus[] = ['배포', '계약']

export const isReadonly = (status: string) =>
  READONLY_STATUSES.includes(status as QuoteStatus)

export const SIZE_CATEGORIES = [
  '20평대','30평대','40평대','50평대','60평대','70평대','80평대','90평대','100평대이상',
] as const
export type SizeCategory = typeof SIZE_CATEGORIES[number]
