'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcEffectiveExec, calcFinalAmount, isGroupComplete } from '@/lib/quote-calc'
import { DEFAULT_RATES } from '@/lib/quoteConstants'

interface QuoteItem {
  id: string
  work_type: string
  item_name: string
  material_unit_price: number
  labor_unit_price: number
  quantity: number
  actual_execution_amount: number | null
}

interface NegativeItem {
  name: string  // "공종 - 항목명"
  profit: number  // quoteAmt - actual (음수)
}

interface ProjectRow {
  projectId: string
  projectName: string
  quoteId: string
  quoteNumber: string
  finalAmount: number  // calcFinalAmount로 계산된 커스텀 요율 기반 값
  directQuote: number
  createdAt: string
  totalGroups: number
  completedGroups: number
  projectedProfit: number
  projectedProfitRate: number
  minusCount: number
  negativeItems: NegativeItem[]
}

interface SmsModal {
  quoteId: string
  projectName: string
  items: NegativeItem[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export default function DashboardPage() {
  const [rows, setRows] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [smsModal, setSmsModal] = useState<SmsModal | null>(null)
  const [sending, setSending] = useState(false)
  const [smsError, setSmsError] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: quotes } = await sb
        .from('quotes')
        .select('id, project_id, quote_number, min_profit_rate, rate_accident_insurance, rate_employment_insurance, rate_indirect_overhead, rate_profit_margin, rate_vat, discount_amount, created_at, updated_at, projects(id, name, min_profit_rate), quote_items(id, work_type, item_name, material_unit_price, labor_unit_price, quantity, actual_execution_amount)')
        .eq('type', '정산')
        .order('updated_at', { ascending: false })

      if (!quotes) { setLoading(false); return }

      // 프로젝트별 최신 정산만 (updated_at desc 정렬 기준, 첫 등장만)
      const seen = new Set<string>()
      const latest = quotes.filter(q => {
        if (seen.has(q.project_id)) return false
        seen.add(q.project_id)
        return true
      })

      const computed: ProjectRow[] = latest.map(q => {
        const items: QuoteItem[] = (q.quote_items as any[]) ?? []
        const projectName = (q.projects as any)?.name ?? q.project_id
        const minProfitRate: number | null = q.min_profit_rate ?? (q.projects as any)?.min_profit_rate ?? null

        // 견적금액: DB 트리거는 하드코딩 요율로 final_amount를 계산하므로 커스텀 요율로 직접 계산
        const round2 = (n: number) => Math.round(n * 100) / 100
        const rates = {
          accident:   q.rate_accident_insurance   != null ? round2(Number(q.rate_accident_insurance)   * 100) : DEFAULT_RATES.accident,
          employment: q.rate_employment_insurance != null ? round2(Number(q.rate_employment_insurance) * 100) : DEFAULT_RATES.employment,
          overhead:   q.rate_indirect_overhead    != null ? round2(Number(q.rate_indirect_overhead)    * 100) : DEFAULT_RATES.overhead,
          profit:     q.rate_profit_margin        != null ? round2(Number(q.rate_profit_margin)        * 100) : DEFAULT_RATES.profit,
          vat:        q.rate_vat                  != null ? round2(Number(q.rate_vat)                  * 100) : DEFAULT_RATES.vat,
        }
        const discount = Number(q.discount_amount ?? 0)
        const { finalAmount, directTotal: directQuoteCalc } = calcFinalAmount({ items, rates, discount })

        // 진행률
        const grouped = items.reduce((acc, i) => {
          if (!acc[i.work_type]) acc[i.work_type] = []
          acc[i.work_type].push(i)
          return acc
        }, {} as Record<string, QuoteItem[]>)
        const nonEmpty = Object.values(grouped).filter(g => g.length > 0)
        const totalGroups = nonEmpty.length
        const completedGroups = nonEmpty.filter(g => isGroupComplete(g)).length

        // 직접공사비 + 예상이윤
        const directQuote = directQuoteCalc
        const effectiveTotal = items.reduce((s, i) => {
          const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
          return s + calcEffectiveExec(i.actual_execution_amount, qa, minProfitRate, true).value
        }, 0)
        const projectedProfit = directQuote - effectiveTotal
        const projectedProfitRate = directQuote > 0 ? (projectedProfit / directQuote) * 100 : 0

        // 마이너스 항목: actual 입력됐고 actual > 행 견적금액
        const negativeItems: NegativeItem[] = items
          .filter(i =>
            i.actual_execution_amount !== null &&
            i.actual_execution_amount !== undefined &&
            i.actual_execution_amount > (i.material_unit_price + i.labor_unit_price) * i.quantity
          )
          .map(i => {
            const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
            return {
              name: `${i.work_type} - ${i.item_name}`,
              profit: qa - i.actual_execution_amount!,
            }
          })

        return {
          projectId: q.project_id,
          projectName,
          quoteId: q.id,
          quoteNumber: q.quote_number ?? '',
          finalAmount,
          directQuote,
          createdAt: q.created_at,
          totalGroups,
          completedGroups,
          projectedProfit,
          projectedProfitRate,
          minusCount: negativeItems.length,
          negativeItems,
        }
      })

      setRows(computed)
      setLoading(false)
    }
    load()
  }, [])

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!smsModal) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [smsModal])

  function openModal(row: ProjectRow) {
    setSmsError(null)
    setSmsModal({ quoteId: row.quoteId, projectName: row.projectName, items: row.negativeItems })
  }

  function closeModal() {
    if (sending) return
    setSmsModal(null)
    setSmsError(null)
  }

  async function handleSend() {
    if (!smsModal) return
    setSending(true)
    setSmsError(null)
    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'item_minus',
          quoteId: smsModal.quoteId,
          items: smsModal.items,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setSmsError(data.error ?? '발송 실패')
      } else {
        setSmsModal(null)
        alert('발송 완료')
      }
    } catch {
      setSmsError('네트워크 오류가 발생했습니다.')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  const fmt = (n: number) => n.toLocaleString()

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 text-sm">진행 중 프로젝트 ({rows.length}건)</h3>
        </div>

        {rows.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">진행 중인 프로젝트가 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">정산견적서</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">견적금액</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">직접공사비</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">시작일</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">진행률</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">현재까지 예상 이윤</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">마이너스</th>
                  <th className="px-5 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => {
                  const progressPct = row.totalGroups > 0
                    ? (row.completedGroups / row.totalGroups) * 100
                    : 0
                  const hasMinus = row.minusCount > 0
                  return (
                    <tr key={row.projectId} className={`transition-colors ${hasMinus ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-900">{row.projectName}</div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{row.quoteNumber}</div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-700 tabular-nums">
                        {fmt(row.finalAmount)}원
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-600 tabular-nums">
                        {fmt(row.directQuote)}원
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {row.completedGroups}/{row.totalGroups}
                        <span className="text-gray-400 text-xs ml-1.5">({progressPct.toFixed(1)}%)</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-semibold ${row.projectedProfit < 0 ? 'text-red-600' : 'text-gray-900'} tabular-nums`}>
                          {fmt(row.projectedProfit)}원
                        </span>
                        <span className={`text-xs ml-1.5 ${row.projectedProfitRate < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                          ({row.projectedProfitRate.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {hasMinus ? (
                          <button
                            onClick={() => openModal(row)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors cursor-pointer"
                          >
                            ⚠ {row.minusCount}건
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">정상</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/quotes/${row.quoteId}`}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          상세 →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SMS 확인 모달 */}
      {smsModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div ref={modalRef} className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">마이너스 항목 SMS 발송</h3>
              <p className="text-sm text-gray-500 mt-0.5">{smsModal.projectName}</p>
            </div>

            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 mb-3">PM, 디자이너, 현장소장에게 발송됩니다.</p>
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">항목</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">이윤</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {smsModal.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-red-50">
                        <td className="px-3 py-2 text-gray-700">{item.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-red-600 tabular-nums">
                          {fmt(item.profit)}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {smsError && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{smsError}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={sending}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium disabled:opacity-50 transition-colors"
              >
                {sending ? '발송 중...' : '📱 발송'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
