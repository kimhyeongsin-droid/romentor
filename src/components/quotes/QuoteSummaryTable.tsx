'use client'

import { ChevronDown } from 'lucide-react'
import { WORK_ORDER, WORK_TYPE_COLOR } from '@/types'

export interface Rates {
  accident: number
  employment: number
  overhead: number
  profit: number
  vat: number
}

interface ItemForSummary {
  work_type: string
  material_unit_price: number
  labor_unit_price: number
  quantity: number
  execution_amount?: number | null
  planned_execution_amount?: number | null
  actual_execution_amount?: number | null
}

interface Props {
  items: ItemForSummary[]
  rates: Rates
  discount: number
  open: boolean
  onToggle: () => void
  isEditable: boolean
  isContract: boolean
  minProfitRate?: number
  onRateChange: (key: keyof Rates, value: number) => void
  onDiscountChange: (value: number) => void
}

const fmt = (n: number) => n.toLocaleString()

export default function QuoteSummaryTable({
  items, rates, discount, open, onToggle, isEditable, isContract, minProfitRate, onRateChange, onDiscountChange,
}: Props) {
  // 공종별 집계 (실행금액 포함)
  const summaryRows = WORK_ORDER.map(wt => {
    const wtItems = items.filter(i => i.work_type === wt)
    const mat  = wtItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0)
    const lab  = wtItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0)
    const total = mat + lab
    const actualExec = wtItems.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
    const plannedExec = wtItems.reduce((s, i) => s + (i.planned_execution_amount ?? 0), 0)
    const effectiveExec = wtItems.reduce((s, i) => {
      const a = i.actual_execution_amount ?? 0
      const p = i.planned_execution_amount ?? 0
      return s + (a > 0 ? a : p)
    }, 0)
    const profit: number | null = effectiveExec > 0 ? total - effectiveExec : null
    const profitRate: number | null = profit !== null && total > 0 ? (profit / total) * 100 : null
    return { wt, materialTotal: mat, laborTotal: lab, total, actualExec, plannedExec, effectiveExec, profit, profitRate }
  })

  const directMaterial = summaryRows.reduce((s, r) => s + r.materialTotal, 0)
  const directLabor    = summaryRows.reduce((s, r) => s + r.laborTotal, 0)
  const directTotal    = directMaterial + directLabor

  const indirectAccident   = Math.round(directLabor * rates.accident / 100)
  const indirectEmployment = Math.round(directLabor * rates.employment / 100)
  const indirectOverhead   = Math.round(directTotal * rates.overhead / 100)
  const indirectProfit     = Math.round(directTotal * rates.profit / 100)
  const indirectTotal      = indirectAccident + indirectEmployment + indirectOverhead + indirectProfit
  const vat                = Math.round(directTotal * rates.vat / 100)
  const finalTotal         = directTotal + indirectTotal + vat + discount

  const totalActualExec = items.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
  const totalEffectiveExec = items.reduce((s, i) => {
    const a = i.actual_execution_amount ?? 0
    const p = i.planned_execution_amount ?? 0
    return s + (a > 0 ? a : p)
  }, 0)
  // 이윤 기준: 직접공사비 - 실행금액 (간접비/VAT 제외)
  const totalProfit         = totalEffectiveExec > 0 ? directTotal - totalEffectiveExec : null
  const totalProfitRate     = totalProfit !== null && directTotal > 0 ? (totalProfit / directTotal) * 100 : null
  const totalActualProfit   = totalActualExec > 0 ? directTotal - totalActualExec : null
  const totalActualProfitRate = totalActualProfit !== null && directTotal > 0 ? (totalActualProfit / directTotal) * 100 : null

  // 계약 모드: 8컬럼, 일반: 5컬럼
  const totalCols = isContract ? 8 : 5

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
      >
        <span className="font-bold text-gray-900 text-sm">견적 합계표</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-2.5 text-center text-xs font-semibold w-12">번호</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold">명 칭</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">재료비 금액</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">노무비 금액</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">합계 금액</th>
                {isContract && (
                  <>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold w-32">실행금액</th>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold w-28">이윤</th>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold w-20">이윤율</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">

              {/* ■ 직접공사비 */}
              <tr className="bg-blue-50">
                <td colSpan={totalCols} className="px-4 py-2 text-xs font-bold text-blue-800 tracking-wide">■ 직접공사비</td>
              </tr>
              {summaryRows.map((row, idx) => (
                <tr key={row.wt} className="hover:bg-blue-50 transition-colors">
                  <td className="px-4 py-2 text-xs text-gray-400 text-center">{idx + 1}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${(WORK_TYPE_COLOR as Record<string, string>)[row.wt] ?? 'bg-gray-100 text-gray-600'}`}>{row.wt}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-blue-700 text-right">{fmt(row.materialTotal)}</td>
                  <td className="px-4 py-2 text-xs text-amber-700 text-right">{fmt(row.laborTotal)}</td>
                  <td className="px-4 py-2 text-xs text-gray-800 font-semibold text-right">{fmt(row.total)}</td>
                  {isContract && (() => {
                    const isActual = row.actualExec > 0
                    const italicCls = !isActual && row.effectiveExec > 0 ? 'italic opacity-70' : ''
                    return (
                      <>
                        <td className={`internal-only px-4 py-2 text-xs text-right ${row.effectiveExec > 0 ? (isActual ? 'text-red-600' : 'text-gray-400') : 'text-gray-300'} ${italicCls}`}>
                          {row.effectiveExec > 0 ? fmt(row.effectiveExec) : '-'}
                        </td>
                        <td className={`internal-only px-4 py-2 text-xs font-semibold text-right ${
                          row.profit === null ? 'text-gray-300' :
                          row.profit < 0 ? 'text-red-600' : 'text-green-600'
                        } ${italicCls}`}>
                          {row.profit !== null ? (row.profit >= 0 ? '+' : '') + fmt(row.profit) : '-'}
                        </td>
                        <td className={`internal-only px-4 py-2 text-xs font-semibold text-right ${
                          row.profitRate === null ? 'text-gray-300' :
                          row.profit! < 0 ? 'text-red-600' : 'text-green-600'
                        } ${italicCls}`}>
                          {row.profitRate !== null ? row.profitRate.toFixed(1) + '%' : '-'}
                        </td>
                      </>
                    )
                  })()}
                </tr>
              ))}

              {/* 직접공사비 합계 */}
              <tr className="bg-gray-100">
                <td colSpan={2} className="px-4 py-2.5 text-xs font-bold text-gray-800">직접공사비 합계</td>
                <td className="px-4 py-2.5 text-xs text-blue-800 font-bold text-right">{fmt(directMaterial)}</td>
                <td className="px-4 py-2.5 text-xs text-amber-800 font-bold text-right">{fmt(directLabor)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-900 font-bold text-right">{fmt(directTotal)}</td>
                {isContract && (
                  <>
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${totalEffectiveExec > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                      {totalEffectiveExec > 0 ? fmt(totalEffectiveExec) : '-'}
                    </td>
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${
                      totalProfitRate === null ? 'text-gray-300' :
                      totalProfit! < 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {totalProfitRate !== null ? (totalProfit! >= 0 ? '+' : '') + fmt(totalProfit!) : '-'}
                    </td>
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${
                      totalProfitRate === null ? 'text-gray-300' :
                      totalProfit! < 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {totalProfitRate !== null ? totalProfitRate.toFixed(1) + '%' : '-'}
                    </td>
                  </>
                )}
              </tr>

              {/* ■ 간접공사비 */}
              <tr className="bg-orange-50">
                <td colSpan={totalCols} className="px-4 py-2 text-xs font-bold text-orange-800 tracking-wide">■ 간접공사비</td>
              </tr>
              {([
                { label: '산재보험료', base: '노무비', key: 'accident' as const, val: indirectAccident, step: '0.01' },
                { label: '고용보험료', base: '노무비', key: 'employment' as const, val: indirectEmployment, step: '0.01' },
                { label: '공과잡비', base: '직접공사비', key: 'overhead' as const, val: indirectOverhead, step: '0.1' },
                { label: '기업이윤', base: '직접공사비', key: 'profit' as const, val: indirectProfit, step: '0.1' },
              ]).map(({ label, base, key, val, step }) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {label} ({base} ×{' '}
                    {isEditable ? (
                      <input type="number" value={rates[key]}
                        onChange={e => onRateChange(key, Number(e.target.value))}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step={step} />
                    ) : rates[key]}
                    %)
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                  <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                  <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(val)}</td>
                  {isContract && (
                    <>
                      <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                      <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                      <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    </>
                  )}
                </tr>
              ))}

              {/* 간접공사비 합계 */}
              <tr className="bg-gray-100">
                <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-800">간접공사비 합계</td>
                <td className="px-4 py-2.5 text-xs text-gray-900 font-bold text-right">{fmt(indirectTotal)}</td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-2.5"></td>
                    <td className="internal-only px-4 py-2.5"></td>
                    <td className="internal-only px-4 py-2.5"></td>
                  </>
                )}
              </tr>

              {/* 부가세 */}
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  부가세 (직접공사비 ×{' '}
                  {isEditable ? (
                    <input type="number" value={rates.vat}
                      onChange={e => onRateChange('vat', Number(e.target.value))}
                      className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                      step="0.1" />
                  ) : rates.vat}
                  %)
                </td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-700 font-medium text-right">{fmt(vat)}</td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                  </>
                )}
              </tr>

              {/* 단수할인 */}
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                <td className="px-4 py-2 text-xs text-gray-700">단수할인 <span className="text-gray-400">(음수 입력 시 차감)</span></td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-right">
                  {isEditable ? (
                    <input type="number" value={discount} onChange={e => onDiscountChange(Number(e.target.value))}
                      className="w-full text-xs text-right text-gray-700 font-medium border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white" />
                  ) : (
                    <span className="text-xs text-gray-700">{fmt(discount)}</span>
                  )}
                </td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                  </>
                )}
              </tr>

              {/* 실행가 요약 (계약 + 실행금액 있을 때만) */}
              {isContract && totalEffectiveExec > 0 && (
                <>
                  {totalActualExec > 0 && (
                    <tr className={`internal-only ${totalActualProfit !== null && totalActualProfit < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">
                        실행금액 합계 <span className="font-normal text-gray-400 text-xs">(실제)</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-bold text-right text-red-600">{fmt(totalActualExec)} 원</td>
                    </tr>
                  )}
                  <tr className={`internal-only ${totalProfit !== null && totalProfit < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">
                      실행금액 합계 <span className="font-normal text-gray-400 text-xs">(예상 포함)</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-bold text-right text-red-600">{fmt(totalEffectiveExec)} 원</td>
                  </tr>
                  {totalActualExec > 0 && totalActualProfit !== null && (
                    <tr className={`internal-only ${totalActualProfit < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                      <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">
                        이윤 (실제) {totalActualProfit < 0 ? '⚠️ 마이너스!' : ''}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalActualProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {fmt(totalActualProfit)} 원
                      </td>
                    </tr>
                  )}
                  <tr className={`internal-only ${totalProfit !== null && totalProfit < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                    <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">
                      이윤 (예상 포함) {totalProfit !== null && totalProfit < 0 ? '⚠️ 마이너스!' : ''}
                    </td>
                    <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalProfit !== null && totalProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {totalProfit !== null ? fmt(totalProfit) + ' 원' : '-'}
                    </td>
                  </tr>
                  {totalActualExec > 0 && totalActualProfitRate !== null && (
                    <tr className={`internal-only ${totalActualProfitRate < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                      <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">이윤율 (실제)</td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalActualProfitRate < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {totalActualProfitRate.toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {totalProfitRate !== null && (
                    <tr className={`internal-only ${totalProfitRate < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                      <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">이윤율 (예상 포함)</td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalProfitRate < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {totalProfitRate.toFixed(1)}%
                      </td>
                    </tr>
                  )}
                  {minProfitRate != null && totalProfitRate !== null && (
                    <tr className={`internal-only ${totalProfitRate >= minProfitRate ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td colSpan={7} className="px-4 py-2.5 text-xs font-bold">
                        목표 이윤율 {totalProfitRate >= minProfitRate ? '✓ 달성' : '✗ 미달'}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalProfitRate >= minProfitRate ? 'text-green-700' : 'text-red-700'}`}>
                        {minProfitRate}%
                      </td>
                    </tr>
                  )}
                </>
              )}

              {/* 최종 합계 (고객 견적금액) */}
              <tr className="bg-gray-900">
                <td colSpan={4} className="px-4 py-3.5 text-sm font-bold text-white">최종 합계</td>
                <td className="px-4 py-3.5 text-sm font-bold text-white text-right">{fmt(finalTotal)} 원</td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-3.5"></td>
                    <td className="internal-only px-4 py-3.5"></td>
                    <td className="internal-only px-4 py-3.5"></td>
                  </>
                )}
              </tr>

            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
