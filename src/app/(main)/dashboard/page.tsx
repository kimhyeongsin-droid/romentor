'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { calcFinalAmount, isGroupComplete, calcWorkTypeWarnings, calcProjectedExec, type WorkTypeWarning } from '@/lib/quote-calc'
import { DEFAULT_RATES } from '@/lib/quoteConstants'

interface QuoteItem {
  id: string
  work_type: string
  item_name: string
  material_unit_price: number
  labor_unit_price: number
  quantity: number
  actual_execution_amount: number | null
  actual_vat_included: boolean | null
  settlement_type: string | null
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
  minProfitRate: number | null
  warnings: WorkTypeWarning[]
}

interface SmsModal {
  quoteId: string
  projectName: string
  minProfitRate: number | null
  items: WorkTypeWarning[]
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
        .select('id, project_id, quote_number, min_profit_rate, rate_accident_insurance, rate_employment_insurance, rate_indirect_overhead, rate_profit_margin, rate_vat, discount_amount, created_at, updated_at, projects(id, name, min_profit_rate), quote_items(id, work_type, item_name, material_unit_price, labor_unit_price, quantity, actual_execution_amount, actual_vat_included, settlement_type)')
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

        // 직접공사비 + 예상 이윤 (공정별 MAX(실제합, 목표합) lump-safe projection)
        const directQuote = directQuoteCalc
        const projectedProfit = directQuote - calcProjectedExec(items, minProfitRate)
        const projectedProfitRate = directQuote > 0 ? (projectedProfit / directQuote) * 100 : 0

        // 공종별 경고: 마이너스(적자) + 목표미달 (actual만 합산, 부분 입력 실시간 반영)
        const warnings = calcWorkTypeWarnings(items, minProfitRate)

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
          minProfitRate,
          warnings,
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
    setSmsModal({ quoteId: row.quoteId, projectName: row.projectName, minProfitRate: row.minProfitRate, items: row.warnings })
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
          items: smsModal.items.map(w => ({
            name: w.workType,
            profit: w.profit,
            rate: w.rate,
            tier: w.tier,
            target: smsModal.minProfitRate ?? 0,
          })),
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
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">목표 이윤율</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500">예상 이윤</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500">경고 공종</th>
                  <th className="px-5 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => {
                  const progressPct = row.totalGroups > 0
                    ? (row.completedGroups / row.totalGroups) * 100
                    : 0
                  const warningCount = row.warnings.length
                  const hasDeficit = row.warnings.some(w => w.tier === 'deficit')
                  const hasTarget = row.minProfitRate != null
                  const achievingTarget = hasTarget && row.projectedProfitRate >= row.minProfitRate!
                  const belowTarget = hasTarget && row.projectedProfitRate < row.minProfitRate!
                  return (
                    <tr key={row.projectId} className={`transition-colors ${hasDeficit ? 'bg-red-50 hover:bg-red-100' : warningCount > 0 ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'}`}>
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
                      <td className="px-5 py-3.5 text-right text-gray-700 tabular-nums">
                        {row.minProfitRate != null ? `${row.minProfitRate}%` : '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div>
                          <span className={`font-semibold ${row.projectedProfit < 0 ? 'text-red-600' : 'text-gray-900'} tabular-nums`}>
                            {fmt(row.projectedProfit)}원
                          </span>
                          <span className={`text-xs ml-1.5 font-medium ${
                            belowTarget ? 'text-red-600' : achievingTarget ? 'text-green-600' :
                            row.projectedProfitRate < 0 ? 'text-red-400' : 'text-gray-400'
                          }`}>
                            ({row.projectedProfitRate.toFixed(1)}%)
                          </span>
                        </div>
                        {belowTarget && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 ring-1 ring-red-300">
                            ▼ 목표 미달 {(row.minProfitRate! - row.projectedProfitRate).toFixed(1)}%p
                          </span>
                        )}
                        {achievingTarget && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ✓ 이윤 달성중
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {warningCount > 0 ? (
                          <button
                            onClick={() => openModal(row)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${hasDeficit ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}
                          >
                            ⚠ {warningCount}건
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
              <h3 className="font-bold text-gray-900">경고 공종 SMS 발송</h3>
              <p className="text-sm text-gray-500 mt-0.5">{smsModal.projectName}</p>
            </div>

            <div className="px-6 py-4">
              <p className="text-xs text-gray-500 mb-3">PM, 디자이너, 현장소장에게 발송됩니다.</p>
              <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">공종</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-500">상태</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-500">이윤</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {smsModal.items.map((w, idx) => (
                      <tr key={idx} className="hover:bg-red-50">
                        <td className="px-3 py-2 text-gray-700">{w.workType}</td>
                        <td className={`px-3 py-2 ${w.tier === 'deficit' ? 'text-red-600' : 'text-amber-700'}`}>
                          {w.tier === 'deficit' ? '마이너스' : '목표미달'}
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold tabular-nums ${w.tier === 'deficit' ? 'text-red-600' : 'text-amber-700'}`}>
                          {fmt(w.profit)}원 ({w.rate.toFixed(1)}%)
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
