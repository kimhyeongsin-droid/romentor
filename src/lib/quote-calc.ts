export interface FinalAmountInput {
  items: Array<{
    material_unit_price: number
    labor_unit_price: number
    quantity: number
    material_amount?: number
    labor_amount?: number
    settlement_type?: string | null
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
  const totalMaterial = items.reduce((s, i) => s + (isExcludedFromProfit(i) ? 0 : (i.material_amount ?? i.material_unit_price * i.quantity)), 0)
  const totalLabor    = items.reduce((s, i) => s + (isExcludedFromProfit(i) ? 0 : (i.labor_amount    ?? i.labor_unit_price    * i.quantity)), 0)
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
  actual_vat_included?: boolean | null
  planned_execution_amount?: number | null
  settlement_type?: string | null
  execution_date?: string | null
}

// 이윤 계산용 실제 원가. 부가세 포함 입력이면 공급가(÷1.1)로 환산, 별도면 입력값 그대로.
// 표시/raw 합계에는 쓰지 말 것 (입력 총액을 보여줘야 하는 곳은 actual_execution_amount 사용).
export function actualCost(
  i: { actual_execution_amount?: number | null; actual_vat_included?: boolean | null }
): number {
  const a = i.actual_execution_amount
  if (a == null) return 0
  return i.actual_vat_included ? Math.round(a / 1.1) : a
}

// 별도(외부 정산)·제외 항목은 이윤 계산(매출 분모·원가 분자) 양쪽에서 완전히 빠진다.
export function isExcludedFromProfit(i: { settlement_type?: string | null }): boolean {
  return i.settlement_type === '별도' || i.settlement_type === '제외'
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
  warnings: WorkTypeWarning[]
}

export interface WorkTypeWarning {
  workType: string
  tier: 'below_target' | 'deficit'
  amount: number
  effective: number
  profit: number
  rate: number
  latestExecDate?: string | null
  isProjected: boolean
}

// 하이브리드 경고:
// - 완료 공종(isGroupComplete): effective=ΣactualCost(실입력)로 tierOf → below_target/deficit 둘 다 경고(isProjected:false).
// - 미완료 공종: projEffective=ΣactualCost + Σ(미입력 라인 목표실행가)로 tierOf → deficit일 때만 경고(isProjected:true).
//   미입력 라인 목표실행가 = planned_execution_amount>0 ? planned : floor(qa*(1-min/100)) (calcProjectedExec와 동일).
// expected(tierOf 경계)는 목표 이윤율 기반 합 그대로. latestExecDate = 공종 라인 execution_date 최대값.
export function calcWorkTypeWarnings(
  items: QuoteSummaryItem[],
  minProfitRate: number | null | undefined
): WorkTypeWarning[] {
  const map: Record<string, { amount: number; expected: number; effective: number; plannedMissing: number; items: QuoteSummaryItem[] }> = {}
  for (const i of items) {
    if (isExcludedFromProfit(i)) continue
    const wt = i.work_type || '기타'
    if (!map[wt]) map[wt] = { amount: 0, expected: 0, effective: 0, plannedMissing: 0, items: [] }
    const e = map[wt]
    e.items.push(i)
    const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
    if (qa <= 0) continue
    e.amount += qa
    e.expected += minProfitRate != null ? Math.floor(qa * (1 - minProfitRate / 100)) : qa
    e.effective += actualCost(i)
    const hasActual = i.actual_execution_amount != null
    if (!hasActual) {
      e.plannedMissing += (i.planned_execution_amount ?? 0) > 0
        ? i.planned_execution_amount!
        : (minProfitRate != null ? Math.floor(qa * (1 - minProfitRate / 100)) : qa)
    }
  }
  const out: WorkTypeWarning[] = []
  for (const [workType, v] of Object.entries(map)) {
    if (v.amount <= 0) continue
    const complete = isGroupComplete(v.items)
    let eff: number
    let tier: 'below_target' | 'deficit'
    if (complete) {
      const t = tierOf(v.effective, v.expected, v.amount)
      if (t === 'normal') continue
      tier = t; eff = v.effective
    } else {
      const projEff = v.effective + v.plannedMissing
      const t = tierOf(projEff, v.expected, v.amount)
      if (t !== 'deficit') continue // 미완료는 적자(projection)만 경고
      tier = t; eff = projEff
    }
    const profit = v.amount - eff
    const latestExecDate = v.items.reduce<string | null>((max, it) => {
      const d = it.execution_date ?? null
      if (!d) return max
      return max == null || d > max ? d : max
    }, null)
    out.push({ workType, tier, amount: v.amount, effective: eff, profit, rate: (profit / v.amount) * 100, latestExecDate, isProjected: !complete })
  }
  return out
}

// 공종(work_type) 하나의 lump-safe effective 원가.
// - 완료 공종(모든 항목 실입력): Σ actualCost(실입력) → 목표 초과분도 그대로 드러남.
// - 미완료 공종: Σ actualCost(실입력) + Σ 미입력라인 예상실행가 — 통금액을 한 항목에 몰아 입력해도
//   실제 지출이 그대로 반영되어 적자를 가리지 않는다.
// 예상실행가(라인) = planned_execution_amount>0 ? planned : (min있으면 floor(qa*(1-min/100)), 없으면 qa). qa<=0 라인은 0 기여.
// calcWorkTypeWarnings의 미완료 판정(v.effective + v.plannedMissing)과 동일 계산.
export function workTypeEffectiveCost(
  items: QuoteSummaryItem[],
  minProfitRate: number | null | undefined
): number {
  const included = items.filter(i => !isExcludedFromProfit(i))
  const complete = isGroupComplete(included)
  let effective = 0
  let plannedMissing = 0
  for (const i of included) {
    const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
    effective += actualCost(i)
    if (i.actual_execution_amount == null && qa > 0) {
      plannedMissing += (i.planned_execution_amount ?? 0) > 0
        ? i.planned_execution_amount!
        : (minProfitRate != null ? Math.floor(qa * (1 - minProfitRate / 100)) : qa)
    }
  }
  return complete ? effective : effective + plannedMissing
}

// 공정(work_type) 단위 lump-safe projection. 공종별 effective 원가(workTypeEffectiveCost)의 합.
export function calcProjectedExec(
  items: QuoteSummaryItem[],
  minProfitRate: number | null | undefined
): number {
  const map: Record<string, QuoteSummaryItem[]> = {}
  for (const i of items) {
    if (isExcludedFromProfit(i)) continue
    const wt = i.work_type || '기타'
    if (!map[wt]) map[wt] = []
    map[wt].push(i)
  }
  return Object.values(map).reduce((s, g) => s + workTypeEffectiveCost(g, minProfitRate), 0)
}

export function calcQuoteSummary(
  items: QuoteSummaryItem[],
  rates: { accident: number; employment: number; overhead: number; profit: number; vat: number },
  discount: number,
  minProfitRate: number | null | undefined,
  isSettlement: boolean
): QuoteSummary {
  const profitItems = items.filter(i => !isExcludedFromProfit(i))
  const { finalAmount, directTotal } = calcFinalAmount({ items: profitItems, rates, discount })

  const grouped = profitItems.reduce((acc, i) => {
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

  const currentExec = completedGroupItems.reduce((s, i) => s + actualCost(i), 0)
  const currentQuoteSum = completedGroupItems.reduce(
    (s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0
  )
  const currentProfit: number | null = currentQuoteSum > 0 ? currentQuoteSum - currentExec : null
  const currentProfitRate: number | null = currentProfit !== null && currentQuoteSum > 0
    ? (currentProfit / currentQuoteSum) * 100 : null

  const projectedProfit = directTotal - calcProjectedExec(profitItems, minProfitRate)
  const projectedProfitRate = directTotal > 0 ? (projectedProfit / directTotal) * 100 : 0

  const warnings = calcWorkTypeWarnings(profitItems, minProfitRate)

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
    warnings,
  }
}

// ── 정산 조정(추가청구·반환) ──────────────────────────────────
// 정산 시점에 고객에게 추가로 청구하거나 돌려줄 금액. 견적 라인(quote_items)과 별개로
// quotes.settlement_adjustments(JSONB 배열)에 저장. 담당자 누락 방지용 목록 + 이윤 반영.
export interface SettlementAdjustment {
  id: string
  type: '추가청구' | '반환'
  description?: string
  amount: number          // 부가세 포함 총액(고객 청구/반환 실액)으로 입력
  done?: boolean          // 청구완료/반환완료 체크
}

// 조정액을 공급가(÷1.1)로 환산해 합산. 이윤은 공급가 기준이므로 actualCost와 동일 규칙.
// 추가청구는 매출·이윤 증가(+), 반환은 감소(−).
export function settlementAdjustmentSupply(
  adjustments: SettlementAdjustment[] | null | undefined
): { chargeSupply: number; refundSupply: number; netSupply: number } {
  let chargeSupply = 0
  let refundSupply = 0
  for (const a of adjustments ?? []) {
    const supply = Math.round((Number(a.amount) || 0) / 1.1)
    if (a.type === '추가청구') chargeSupply += supply
    else if (a.type === '반환') refundSupply += supply
  }
  return { chargeSupply, refundSupply, netSupply: chargeSupply - refundSupply }
}
