'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { WORK_ORDER, WORK_TYPE_COLOR } from '@/types'
import { calcFinalAmount, isGroupComplete, actualCost } from '@/lib/quote-calc'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { ResizeHandle } from '@/components/common/ResizeHandle'

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
  actual_vat_included?: boolean | null
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
  onMinProfitRateChange?: (value: number) => void
  onRateChange: (key: keyof Rates, value: number) => void
  onDiscountChange: (value: number) => void
  worktypeMemos?: Record<string, string>
  onWorktypeMemoChange?: (workType: string, memo: string) => void
}

const fmt = (n: number) => n.toLocaleString()

const SUMMARY_DEFAULT_WIDTHS = {
  number: 50, name: 200, material_amount: 110, labor_amount: 110, total_amount: 110,
  execution_amount: 110, profit: 100, profit_rate: 80, memo: 150,
}

export default function QuoteSummaryTable({
  items, rates, discount, open, onToggle, isEditable, isContract, minProfitRate, onMinProfitRateChange, onRateChange, onDiscountChange, worktypeMemos = {}, onWorktypeMemoChange,
}: Props) {
  const [rawDiscount, setRawDiscount] = useState<string | null>(null)
  const { widths: resizableSummaryWidths, startResize: startSummaryResize } = useResizableColumns(
    'romentor.quoteSummaryTable.settlement.colWidths', SUMMARY_DEFAULT_WIDTHS
  )
  const summaryWidths = isContract ? resizableSummaryWidths : SUMMARY_DEFAULT_WIDTHS
  // 공종별 집계 (실행금액 포함)
  const summaryRows = WORK_ORDER.map(wt => {
    const wtItems = items.filter(i => i.work_type === wt)
    const mat  = wtItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0)
    const lab  = wtItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0)
    const total = mat + lab
    const actualExec = wtItems.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
    const actualCostSum = wtItems.reduce((s, i) => s + actualCost(i), 0)
    const plannedExec = wtItems.reduce((s, i) => s + (i.planned_execution_amount ?? 0), 0)
    const isComplete = isGroupComplete(wtItems)
    const profit: number | null = (isComplete || actualExec > 0) ? total - actualCostSum : null
    const profitRate: number | null = profit !== null && total > 0 ? (profit / total) * 100 : null
    return { wt, materialTotal: mat, laborTotal: lab, total, actualExec, plannedExec, profit, profitRate, isComplete }
  })

  const directMaterial = summaryRows.reduce((s, r) => s + r.materialTotal, 0)
  const directLabor    = summaryRows.reduce((s, r) => s + r.laborTotal, 0)
  const {
    directTotal,
    indirectAccident,
    indirectEmployment,
    indirectOverhead,
    indirectProfit,
    indirectTotal,
    vat,
    finalAmount: finalTotal,
  } = calcFinalAmount({
    items: [{ material_unit_price: 0, labor_unit_price: 0, quantity: 0, material_amount: directMaterial, labor_amount: directLabor }],
    rates,
    discount,
  })

  // 확정 공종 기준 집계 (공종 내 모든 행 actual 입력 완료된 공종만 포함)
  const groupedByWt = items.reduce((acc, i) => {
    const wt = i.work_type || '기타'
    if (!acc[wt]) acc[wt] = []
    acc[wt].push(i)
    return acc
  }, {} as Record<string, typeof items>)
  const nonEmptyGroups = Object.values(groupedByWt).filter(g => g.length > 0)
  const totalGroups = nonEmptyGroups.length
  const completedGroups = nonEmptyGroups.filter(g => isGroupComplete(g)).length
  const completedGroupItems = nonEmptyGroups.filter(g => isGroupComplete(g)).flat()
  const totalActualExec = completedGroupItems.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
  const totalActualCost = completedGroupItems.reduce((s, i) => s + actualCost(i), 0)
  const totalActualQuoteSum = completedGroupItems.reduce(
    (s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0
  )
  const totalActualProfit = totalActualQuoteSum > 0 ? totalActualQuoteSum - totalActualCost : null
  const totalActualProfitRate = totalActualProfit !== null && totalActualQuoteSum > 0
    ? (totalActualProfit / totalActualQuoteSum) * 100 : null

  // 계약 모드: 9컬럼 (기본5 + 실행금액/이윤/이윤율/메모), 일반: 5컬럼
  const totalCols = isContract ? 9 : 5

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
      >
        <span className="font-bold text-gray-900 text-sm">견적 합계표</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>

      {isContract && (
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 text-sm">
          <span className="text-gray-600 font-medium">목표 이윤율</span>
          <input
            type="number"
            value={minProfitRate ?? 15}
            min={0}
            max={100}
            step={1}
            onChange={e => {
              const v = e.target.value === '' ? 15 : Number(e.target.value)
              onMinProfitRateChange?.(isNaN(v) ? 15 : v)
            }}
            className="w-20 text-center border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400"
          />
          <span className="text-gray-500">%</span>
          <span className="text-xs text-gray-400">(기준: 직접공사비 합계)</span>
        </div>
      )}

      {open && (
        <div className="overflow-x-auto">
          <table className={`w-full text-sm min-w-[600px]${isContract ? ' table-fixed' : ''}`}>
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className={`px-4 py-2.5 text-center text-xs font-semibold w-12${isContract ? ' relative' : ''}`} style={isContract ? { width: summaryWidths.number } : undefined}>
                  번호
                  {isContract && <ResizeHandle columnKey="number" onMouseDown={startSummaryResize} />}
                </th>
                <th className={`px-4 py-2.5 text-left text-xs font-semibold${isContract ? ' relative' : ''}`} style={isContract ? { width: summaryWidths.name } : undefined}>
                  명 칭
                  {isContract && <ResizeHandle columnKey="name" onMouseDown={startSummaryResize} />}
                </th>
                <th className={`px-4 py-2.5 text-right text-xs font-semibold w-36${isContract ? ' relative' : ''}`} style={isContract ? { width: summaryWidths.material_amount } : undefined}>
                  재료비 금액
                  {isContract && <ResizeHandle columnKey="material_amount" onMouseDown={startSummaryResize} />}
                </th>
                <th className={`px-4 py-2.5 text-right text-xs font-semibold w-36${isContract ? ' relative' : ''}`} style={isContract ? { width: summaryWidths.labor_amount } : undefined}>
                  노무비 금액
                  {isContract && <ResizeHandle columnKey="labor_amount" onMouseDown={startSummaryResize} />}
                </th>
                <th className={`px-4 py-2.5 text-right text-xs font-semibold w-36${isContract ? ' relative' : ''}`} style={isContract ? { width: summaryWidths.total_amount } : undefined}>
                  합계 금액
                  {isContract && <ResizeHandle columnKey="total_amount" onMouseDown={startSummaryResize} />}
                </th>
                {isContract && (
                  <>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold relative" style={{ width: summaryWidths.execution_amount }}>
                      실행금액
                      <ResizeHandle columnKey="execution_amount" onMouseDown={startSummaryResize} />
                    </th>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold relative" style={{ width: summaryWidths.profit }}>
                      이윤
                      <ResizeHandle columnKey="profit" onMouseDown={startSummaryResize} />
                    </th>
                    <th className="internal-only px-4 py-2.5 text-right text-xs font-semibold relative" style={{ width: summaryWidths.profit_rate }}>
                      이윤율
                      <ResizeHandle columnKey="profit_rate" onMouseDown={startSummaryResize} />
                    </th>
                    <th className="internal-only px-4 py-2.5 text-left text-xs font-semibold relative" style={{ width: summaryWidths.memo }}>
                      메모
                      <ResizeHandle columnKey="memo" onMouseDown={startSummaryResize} />
                    </th>
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
                  {isContract && (
                    <>
                      <td className={`internal-only px-4 py-2 text-xs text-right ${
                        row.isComplete || row.actualExec > 0
                          ? (row.isComplete ? 'text-red-600' : 'text-gray-400 italic')
                          : 'text-gray-300'
                      }`}>
                        {row.isComplete || row.actualExec > 0 ? fmt(row.actualExec) : '-'}
                      </td>
                      <td className={`internal-only px-4 py-2 text-xs font-semibold text-right ${
                        row.profit === null ? 'text-gray-300' :
                        !row.isComplete ? 'text-gray-400 italic' :
                        row.profit < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {row.profit !== null ? (row.profit >= 0 ? '+' : '') + fmt(row.profit) : '-'}
                      </td>
                      <td className={`internal-only px-4 py-2 text-xs font-semibold text-right ${
                        row.profitRate === null ? 'text-gray-300' :
                        !row.isComplete ? 'text-gray-400 italic' :
                        row.profit! < 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {row.profitRate !== null ? row.profitRate.toFixed(1) + '%' : '-'}
                      </td>
                      <td className="internal-only px-4 py-2">
                        {isEditable ? (
                          <input
                            type="text"
                            value={worktypeMemos[row.wt] ?? ''}
                            onChange={e => onWorktypeMemoChange?.(row.wt, e.target.value)}
                            placeholder="-"
                            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white placeholder:text-gray-300"
                          />
                        ) : (
                          <span className="text-xs text-gray-600">{worktypeMemos[row.wt] ?? '-'}</span>
                        )}
                      </td>
                    </>
                  )}
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
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${completedGroups > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                      {completedGroups > 0 ? fmt(totalActualExec) : '-'}
                    </td>
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${
                      totalActualProfit === null ? 'text-gray-300' :
                      totalActualProfit < 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {totalActualProfit !== null ? (totalActualProfit >= 0 ? '+' : '') + fmt(totalActualProfit) : '-'}
                    </td>
                    <td className={`internal-only px-4 py-2.5 text-xs font-bold text-right ${
                      totalActualProfitRate === null ? 'text-gray-300' :
                      totalActualProfit! < 0 ? 'text-red-700' : 'text-green-700'
                    }`}>
                      {totalActualProfitRate !== null ? totalActualProfitRate.toFixed(1) + '%' : '-'}
                    </td>
                    <td className="internal-only px-4 py-2.5 text-xs text-gray-300">-</td>
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
                    <td className="internal-only px-4 py-2.5"></td>
                  </>
                )}
              </tr>

              {/* 부가세 */}
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  부가세{' '}
                  {isEditable ? (
                    <input type="number" value={rates.vat}
                      onChange={e => onRateChange('vat', Number(e.target.value))}
                      className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                      step="0.1" />
                  ) : rates.vat}
                  %
                </td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                <td className="px-4 py-2 text-xs text-gray-700 font-medium text-right">{fmt(vat)}</td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
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
                    <input
                      type="text"
                      value={rawDiscount ?? String(discount)}
                      onFocus={e => { setRawDiscount(String(discount)); e.target.select() }}
                      onChange={e => {
                        const v = e.target.value
                        if (v !== '' && v !== '-' && !/^-?\d+$/.test(v)) return
                        setRawDiscount(v)
                        if (v === '' || v === '-') return
                        onDiscountChange(Number(v))
                      }}
                      onBlur={() => {
                        if (rawDiscount !== null) {
                          onDiscountChange(rawDiscount === '' || rawDiscount === '-' ? 0 : Number(rawDiscount))
                        }
                        setRawDiscount(null)
                      }}
                      className="w-full text-xs text-right text-gray-700 font-medium border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white"
                    />
                  ) : (
                    <span className="text-xs text-gray-700">{fmt(discount)}</span>
                  )}
                </td>
                {isContract && (
                  <>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                    <td className="internal-only px-4 py-2 text-xs text-gray-200 text-right">-</td>
                  </>
                )}
              </tr>

              {/* 실행가 요약 (계약 + 실제 실행금액 있을 때만) */}
              {isContract && completedGroups > 0 && (
                <>
                  <tr className={`internal-only ${totalActualProfit !== null && totalActualProfit < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <td colSpan={8} className="px-4 py-2.5 text-xs font-bold">현재까지 실행금액 합계</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-right text-red-600">{fmt(totalActualExec)} 원</td>
                  </tr>
                  {totalActualProfit !== null && (
                    <tr className={`internal-only ${totalActualProfit < 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                      <td colSpan={8} className="px-4 py-2.5 text-xs font-bold">
                        현재까지 이윤 (확정분 · {completedGroups}/{totalGroups} 공종){totalActualProfit < 0 ? ' ⚠️ 마이너스!' : ''}
                        {totalActualProfitRate !== null && (
                          <span className={`ml-2 font-normal ${totalActualProfitRate < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            ({totalActualProfitRate.toFixed(1)}%)
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalActualProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {fmt(totalActualProfit)} 원
                      </td>
                    </tr>
                  )}
                  {minProfitRate != null && totalActualProfitRate !== null && (
                    <tr className={`internal-only ${totalActualProfitRate >= minProfitRate ? 'bg-green-50' : 'bg-red-50'}`}>
                      <td colSpan={8} className="px-4 py-2.5 text-xs font-bold">
                        목표 이윤율 {totalActualProfitRate >= minProfitRate ? '✓ 달성' : '✗ 미달'}
                      </td>
                      <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalActualProfitRate >= minProfitRate ? 'text-green-700' : 'text-red-700'}`}>
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
