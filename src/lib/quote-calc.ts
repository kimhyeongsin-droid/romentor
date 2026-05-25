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
