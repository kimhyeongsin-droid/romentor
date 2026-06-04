export interface FinalAmountInput {
  items: Array<{
    material_unit_price: number
    labor_unit_price: number
    quantity: number
    material_amount?: number
    labor_amount?: number
  }>
  rates: {
    accident: number
    employment: number
    overhead: number
    profit: number
    vat: number
  }
  discount: number
}

export interface FinalAmountResult {
  directTotal: number
  totalMaterial: number
  totalLabor: number
  indirectAccident: number
  indirectEmployment: number
  indirectOverhead: number
  indirectProfit: number
  indirectTotal: number
  vat: number
  finalAmount: number
}

export function calcFinalAmount(input: FinalAmountInput): FinalAmountResult {
  const { items, rates, discount } = input
  const totalMaterial = items.reduce((s, i) => s + (i.material_amount ?? i.material_unit_price * i.quantity), 0)
  const totalLabor    = items.reduce((s, i) => s + (i.labor_amount    ?? i.labor_unit_price    * i.quantity), 0)
  const directTotal   = totalMaterial + totalLabor
  const indirectAccident   = Math.floor(totalLabor  * rates.accident   / 100)
  const indirectEmployment = Math.floor(totalLabor  * rates.employment / 100)
  const indirectOverhead   = Math.floor(directTotal * rates.overhead   / 100)
  const indirectProfit     = Math.floor(directTotal * rates.profit     / 100)
  const indirectTotal      = indirectAccident + indirectEmployment + indirectOverhead + indirectProfit
  const vat                = Math.floor((directTotal + indirectTotal) * rates.vat / 100)
  const finalAmount        = directTotal + indirectTotal + vat + discount
  return { directTotal, totalMaterial, totalLabor, indirectAccident, indirectEmployment, indirectOverhead, indirectProfit, indirectTotal, vat, finalAmount }
}

/**
 * 행별 effective execution amount 계산.
 * - actual이 입력되어 있으면 그대로 반환 (isProjected: false)
 * - 정산견적서 + 목표이윤율 설정 시: quoteAmount × (1 - rate) (isProjected: true)
 * - 그 외: 0 (isProjected: false)
 */
export function isGroupComplete<T extends { actual_execution_amount?: number | null }>(
  items: T[]
): boolean {
  if (items.length === 0) return false
  return items.every(i => i.actual_execution_amount !== null && i.actual_execution_amount !== undefined)
}

export function calcEffectiveExec(
  actual: number | null,
  quoteAmount: number,
  targetProfitRate: number | null | undefined,
  isSettlement: boolean
): { value: number; isProjected: boolean } {
  if (actual !== null && actual !== undefined) return { value: actual, isProjected: false }
  if (isSettlement && targetProfitRate != null && quoteAmount > 0) {
    const rate = targetProfitRate / 100
    return { value: Math.floor(quoteAmount * (1 - rate)), isProjected: true }
  }
  return { value: 0, isProjected: false }
}

export type AlertTier = 'normal' | 'below_target' | 'deficit'

export interface AlertState {
  tier: AlertTier
  profit: number
  rate: number
}

// 동일 tier 재발송 히스테리시스 임계값 (미세 악화로 인한 폭주 방지)
export const ALERT_DEFICIT_MIN_DROP = 100000 // 적자: 이윤이 이만큼(원) 더 하락했을 때만 재발송
export const ALERT_BELOW_TARGET_MIN_DROP = 1.0 // 목표미달: 이윤율이 이만큼(%p) 더 하락했을 때만 재발송

const TIER_RANK: Record<AlertTier, number> = { normal: 0, below_target: 1, deficit: 2 }

// 공종 실행가 경계선으로 판정. 실제(effectiveExec)가 expected를 초과하면 악화.
//   effectiveExec ≤ expected            → normal
//   expected < effectiveExec ≤ amount   → below_target
//   effectiveExec > amount              → deficit
export function tierOf(effectiveExec: number, expected: number, amount: number): AlertTier {
  if (effectiveExec > amount) return 'deficit'
  if (effectiveExec > expected) return 'below_target'
  return 'normal'
}

export function decideAlert(cur: AlertState, prev: AlertState | undefined): boolean {
  if (cur.tier === 'normal') return false
  if (!prev || TIER_RANK[cur.tier] > TIER_RANK[prev.tier]) return true
  if (TIER_RANK[cur.tier] === TIER_RANK[prev.tier]) {
    if (cur.tier === 'deficit') return prev.profit - cur.profit >= ALERT_DEFICIT_MIN_DROP
    if (cur.tier === 'below_target') return prev.rate - cur.rate >= ALERT_BELOW_TARGET_MIN_DROP
  }
  return false
}

export interface QuoteSummaryItem {
  work_type: string
  item_name?: string
  material_unit_price: number
  labor_unit_price: number
  quantity: number
  material_amount?: number
  labor_amount?: number
  actual_execution_amount?: number | null
}

export interface QuoteSummary {
  finalAmount: number
  directTotal: number
  currentExec: number
  completedGroups: number
  totalGroups: number
  progressRate: number
  currentProfit: number | null
  currentProfitRate: number | null
  projectedProfit: number
  projectedProfitRate: number
  minusCount: number
  negativeItems: Array<{ name: string; profit: number }>
}

export function calcQuoteSummary(
  items: QuoteSummaryItem[],
  rates: { accident: number; employment: number; overhead: number; profit: number; vat: number },
  discount: number,
  minProfitRate: number | null | undefined,
  isSettlement: boolean
): QuoteSummary {
  const { finalAmount, directTotal } = calcFinalAmount({ items, rates, discount })

  const grouped = items.reduce((acc, i) => {
    const wt = i.work_type || '기타'
    if (!acc[wt]) acc[wt] = []
    acc[wt].push(i)
    return acc
  }, {} as Record<string, QuoteSummaryItem[]>)
  const nonEmptyGroups = Object.values(grouped).filter(g => g.length > 0)
  const totalGroups = nonEmptyGroups.length
  const completedGroupsArr = nonEmptyGroups.filter(g => isGroupComplete(g))
  const completedGroups = completedGroupsArr.length
  const completedGroupItems = completedGroupsArr.flat()
  const progressRate = totalGroups > 0 ? (completedGroups / totalGroups) * 100 : 0

  const currentExec = completedGroupItems.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
  const currentQuoteSum = completedGroupItems.reduce(
    (s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0
  )
  const currentProfit: number | null = currentQuoteSum > 0 ? currentQuoteSum - currentExec : null
  const currentProfitRate: number | null = currentProfit !== null && currentQuoteSum > 0
    ? (currentProfit / currentQuoteSum) * 100 : null

  const effectiveTotal = items.reduce((s, i) => {
    const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
    return s + calcEffectiveExec(i.actual_execution_amount ?? null, qa, minProfitRate, isSettlement).value
  }, 0)
  const projectedProfit = directTotal - effectiveTotal
  const projectedProfitRate = directTotal > 0 ? (projectedProfit / directTotal) * 100 : 0

  const negativeItems = items
    .filter(i =>
      i.actual_execution_amount !== null &&
      i.actual_execution_amount !== undefined &&
      i.actual_execution_amount > (i.material_unit_price + i.labor_unit_price) * i.quantity
    )
    .map(i => {
      const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
      return {
        name: `${i.work_type} - ${i.item_name ?? ''}`,
        profit: qa - (i.actual_execution_amount ?? 0),
      }
    })

  return {
    finalAmount,
    directTotal,
    currentExec,
    completedGroups,
    totalGroups,
    progressRate,
    currentProfit,
    currentProfitRate,
    projectedProfit,
    projectedProfitRate,
    minusCount: negativeItems.length,
    negativeItems,
  }
}
