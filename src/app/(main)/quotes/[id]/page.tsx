'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORK_TYPE_COLOR, type WorkType } from '@/types'
import { ChevronDown, Printer, ArrowLeft, Save } from 'lucide-react'

const WORK_ORDER: WorkType[] = [
  '설계비용', '가설공사', '철거', '마루철거', '설비', '전기배선', '창호', '목공', '도어',
  '타일', '도장', '필름', '도배', '욕실도기', '조명', '바닥', '가구', '금속',
  '유리실리콘', '공조', '홈스타일링', '기타'
]

const fmt = (n: number) => n.toLocaleString()

interface QuoteItem {
  id: string
  work_type: string
  item_name: string
  comment: string
  unit: string
  quantity: number
  material_unit_price: number
  labor_unit_price: number
  execution_amount: number
  note: string
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<any>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [rates, setRates] = useState({
    accident: 3.78, employment: 2.05, overhead: 5, profit: 15, vat: 10
  })

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('quotes').select('*, projects(name)').eq('id', id).single(),
      sb.from('quote_items').select('*').eq('quote_id', id).order('work_type').order('created_at')
    ]).then(([{ data: q }, { data: its }]) => {
      setQuote(q)
      if (its) {
        const sorted = [...its].sort((a, b) => {
          if (a.work_type === '설계비용') return -1
          if (b.work_type === '설계비용') return 1
          return (WORK_ORDER.indexOf(a.work_type as WorkType) - WORK_ORDER.indexOf(b.work_type as WorkType))
        })
        setItems(sorted)
      }
      setLoading(false)
    })
  }, [id])

  const updateItem = useCallback((itemId: string, key: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [key]: value } : i))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const sb = createClient()
    await Promise.all(items.map(item =>
      sb.from('quote_items').update({
        quantity: item.quantity,
        material_unit_price: item.material_unit_price,
        labor_unit_price: item.labor_unit_price,
        execution_amount: item.execution_amount ?? 0,
        note: item.note,
      }).eq('id', item.id)
    ))
    setSaving(false)
    alert('✅ 견적서가 저장됐습니다.')
  }

  const grouped = WORK_ORDER
    .map(wt => ({ wt, items: items.filter(i => i.work_type === wt) }))
    .filter(g => g.items.length > 0)

  const directMaterial = items.reduce((s, i) => s + i.material_unit_price * i.quantity, 0)
  const directLabor = items.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0)
  const directTotal = directMaterial + directLabor
  const indirectAccident = Math.round(directLabor * rates.accident / 100)
  const indirectEmployment = Math.round(directLabor * rates.employment / 100)
  const indirectOverhead = Math.round(directTotal * rates.overhead / 100)
  const indirectProfit = Math.round(directTotal * rates.profit / 100)
  const indirectTotal = indirectAccident + indirectEmployment + indirectOverhead + indirectProfit
  const vat = Math.round(directTotal * rates.vat / 100)
  const finalTotal = directTotal + indirectTotal + vat + discount
  const totalExecution = items.reduce((s, i) => s + (i.execution_amount ?? 0), 0)
  const totalProfit = finalTotal - totalExecution

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {quote?.projects?.name ?? '프로젝트 없음'}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {quote?.note && <span className="mr-3">{quote.note}</span>}
              {quote?.created_at && new Date(quote.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Printer size={15} /> 인쇄
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Save size={15} /> {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 견적 합계표 */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <button onClick={() => setSummaryOpen(v => !v)}
          className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 border-b border-gray-200">
          <span className="font-bold text-gray-900 text-sm">견적 합계표</span>
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${summaryOpen ? '' : '-rotate-90'}`} />
        </button>
        {summaryOpen && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="px-4 py-2.5 text-center text-xs w-12">번호</th>
                  <th className="px-4 py-2.5 text-left text-xs">명 칭</th>
                  <th className="px-4 py-2.5 text-right text-xs w-36">재료비</th>
                  <th className="px-4 py-2.5 text-right text-xs w-36">노무비</th>
                  <th className="px-4 py-2.5 text-right text-xs w-36">합계</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-blue-50">
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold text-blue-800">■ 직접공사비</td>
                </tr>
                {WORK_ORDER.map((wt, idx) => {
                  const wtItems = items.filter(i => i.work_type === wt)
                  if (!wtItems.length) return null
                  const mat = wtItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0)
                  const lab = wtItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0)
                  return (
                    <tr key={wt} className="hover:bg-gray-50 border-t border-gray-100">
                      <td className="px-4 py-2 text-xs text-gray-400 text-center">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${WORK_TYPE_COLOR[wt as WorkType] ?? 'bg-gray-100 text-gray-600'}`}>{wt}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-blue-700 text-right">{fmt(mat)}</td>
                      <td className="px-4 py-2 text-xs text-amber-700 text-right">{fmt(lab)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-right">{fmt(mat + lab)}</td>
                    </tr>
                  )
                })}
                <tr className="bg-gray-100">
                  <td colSpan={2} className="px-4 py-2.5 text-xs font-bold">직접공사비 합계</td>
                  <td className="px-4 py-2.5 text-xs text-blue-800 font-bold text-right">{fmt(directMaterial)}</td>
                  <td className="px-4 py-2.5 text-xs text-amber-800 font-bold text-right">{fmt(directLabor)}</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-right">{fmt(directTotal)}</td>
                </tr>
                <tr className="bg-orange-50">
                  <td colSpan={5} className="px-4 py-2 text-xs font-bold text-orange-800">■ 간접공사비</td>
                </tr>
                {[
                  { label: '산재보험료', key: 'accident', base: '노무비', val: indirectAccident },
                  { label: '고용보험료', key: 'employment', base: '노무비', val: indirectEmployment },
                  { label: '공과잡비', key: 'overhead', base: '직접공사비', val: indirectOverhead },
                  { label: '기업이윤', key: 'profit', base: '직접공사비', val: indirectProfit },
                ].map(({ label, key, base, val }) => (
                  <tr key={key} className="hover:bg-gray-50 border-t border-gray-100">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      {label} ({base} ×{' '}
                      <input type="number" value={rates[key as keyof typeof rates]}
                        onChange={e => setRates(r => ({ ...r, [key]: Number(e.target.value) }))}
                        className="w-12 text-xs text-center border-b border-gray-300 focus:outline-none bg-transparent"
                        step="0.01" />
                      %)
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(val)}</td>
                  </tr>
                ))}
                <tr className="bg-gray-100">
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold">간접공사비 합계</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-right">{fmt(indirectTotal)}</td>
                </tr>
                <tr className="hover:bg-gray-50 border-t border-gray-100">
                  <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    부가세 (직접공사비 ×{' '}
                    <input type="number" value={rates.vat}
                      onChange={e => setRates(r => ({ ...r, vat: Number(e.target.value) }))}
                      className="w-12 text-xs text-center border-b border-gray-300 focus:outline-none bg-transparent"
                      step="0.1" />
                    %)
                  </td>
                  <td colSpan={2} className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                  <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(vat)}</td>
                </tr>
                <tr className="hover:bg-gray-50 border-t border-gray-100">
                  <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                  <td className="px-4 py-2 text-xs text-gray-700">단수할인 (음수 입력 시 차감)</td>
                  <td colSpan={2} className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                  <td className="px-4 py-2 text-right">
                    <input type="number" value={discount}
                      onChange={e => setDiscount(Number(e.target.value))}
                      className="w-full text-xs text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300" />
                  </td>
                </tr>
                <tr className={totalProfit < 0 ? 'bg-red-50' : 'bg-green-50'}>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold">실행금액 합계</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-right text-red-600">{fmt(totalExecution)} 원</td>
                </tr>
                <tr className={totalProfit < 0 ? 'bg-red-100' : 'bg-green-100'}>
                  <td colSpan={4} className="px-4 py-2.5 text-xs font-bold">예상 이윤 {totalProfit < 0 ? '⚠️ 마이너스!' : ''}</td>
                  <td className={`px-4 py-2.5 text-xs font-bold text-right ${totalProfit < 0 ? 'text-red-700' : 'text-green-700'}`}>{fmt(totalProfit)} 원</td>
                </tr>
                <tr className="bg-gray-900">
                  <td colSpan={4} className="px-4 py-3.5 text-sm font-bold text-white">최종 합계</td>
                  <td className="px-4 py-3.5 text-sm font-bold text-white text-right">{fmt(finalTotal)} 원</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 공종별 테이블 */}
      <div className="space-y-4">
        {grouped.map(({ wt, items: gItems }) => (
          <div key={wt} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.03)' }}>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${WORK_TYPE_COLOR[wt as WorkType] ?? 'bg-gray-100 text-gray-600'}`}>{wt}</span>
              <span className="text-xs text-gray-400">{gItems.length}개</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-48">항목명</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-56">Comment</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-12">단위</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-20">수량</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-blue-500 w-28">재료단가</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-blue-600 w-28 bg-blue-50">재료금액</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-amber-500 w-28">노무단가</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-amber-600 w-28 bg-amber-50">노무금액</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">합계단가</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">합계금액</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-red-500 w-28">실행금액</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {gItems.map(item => {
                    const mat = item.material_unit_price * item.quantity
                    const lab = item.labor_unit_price * item.quantity
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-medium text-gray-800">{item.item_name}</td>
                        <td className="px-3 py-2 text-xs text-gray-400">{item.comment}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 text-center">{item.unit}</td>
                        <td className="px-3 py-2">
                          <input type="text" value={String(item.quantity)}
                            onFocus={e => e.target.select()}
                            onChange={e => updateItem(item.id, 'quantity', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
                            className="w-full text-xs text-right border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
                        </td>
                        <td className="px-3 py-2">
                          <input type="text" value={String(item.material_unit_price)}
                            onFocus={e => e.target.select()}
                            onChange={e => updateItem(item.id, 'material_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                            className="w-full text-xs text-right text-blue-700 font-medium border border-transparent hover:border-blue-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-blue-700 bg-blue-50/40">{fmt(mat)}</td>
                        <td className="px-3 py-2">
                          <input type="text" value={String(item.labor_unit_price)}
                            onFocus={e => e.target.select()}
                            onChange={e => updateItem(item.id, 'labor_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                            className="w-full text-xs text-right text-amber-700 font-medium border border-transparent hover:border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-amber-700 bg-amber-50/40">{fmt(lab)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-600">{fmt(item.material_unit_price + item.labor_unit_price)}</td>
                        <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">{fmt(mat + lab)}</td>
                        <td className="px-3 py-2">
                          <input type="text"
                            value={String(item.execution_amount ?? 0)}
                            onFocus={e => e.target.select()}
                            onChange={e => updateItem(item.id, 'execution_amount', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
                            className="w-full text-xs text-right text-red-600 font-medium border border-transparent hover:border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
                        </td>
                        <td className="px-3 py-2">
                          <input value={item.note ?? ''}
                            onChange={e => updateItem(item.id, 'note', e.target.value)}
                            placeholder="비고"
                            className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
                        </td>
                      </tr>
                    )
                  })}
                  {/* 공종 합계 행 */}
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">{wt} 합계</td>
                    <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>
                    <td className="px-3 py-2 text-xs text-right text-blue-700 font-bold bg-blue-50/40">
                      {fmt(gItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0))}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>
                    <td className="px-3 py-2 text-xs text-right text-amber-700 font-bold bg-amber-50/40">
                      {fmt(gItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0))}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>
                    <td className="px-3 py-2 text-xs text-right font-bold text-gray-800 bg-gray-100">
                      {fmt(gItems.reduce((s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0))}
                    </td>
                    <td className="px-3 py-2 text-xs text-right text-red-600 font-bold">
                      {fmt(gItems.reduce((s, i) => s + (i.execution_amount ?? 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 저장 버튼 */}
      <div className="flex gap-3 mt-8">
        <button onClick={handleSave} disabled={saving}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
          {saving ? '저장 중...' : '견적서 저장'}
        </button>
        <button onClick={() => router.back()}
          className="bg-gray-100 text-gray-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-200">
          목록으로
        </button>
      </div>
    </div>
  )
}
