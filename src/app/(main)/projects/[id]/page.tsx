'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, FileText, TrendingUp, TrendingDown, AlertTriangle, Plus, Copy } from 'lucide-react'
import { QUOTE_STATUS_COLOR } from '@/lib/quoteConstants'

const fmt = (n: number) => n?.toLocaleString() ?? '0'
const fmtRate = (n: number) => (n ? n.toFixed(1) : '0')

const VERSION_COLOR: Record<string, string> = {
  '가견적': 'bg-gray-100 text-gray-600',
  '1차견적': 'bg-blue-100 text-blue-700',
  '2차견적': 'bg-violet-100 text-violet-700',
  '3차견적': 'bg-orange-100 text-orange-700',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [quotes, setQuotes] = useState<any[]>([])
  const [quoteItems, setQuoteItems] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('projects').select('*').eq('id', id).single(),
      sb.from('quotes').select('*').eq('project_id', id).order('created_at', { ascending: true }),
    ]).then(async ([{ data: p }, { data: qs }]) => {
      setProject(p)
      setQuotes(qs ?? [])
      if (qs && qs.length > 0) {
        const itemsMap: Record<string, any[]> = {}
        await Promise.all(qs.map(async (q) => {
          const { data: its } = await sb.from('quote_items').select('*').eq('quote_id', q.id)
          itemsMap[q.id] = its ?? []
        }))
        setQuoteItems(itemsMap)
      }
      setLoading(false)
    })
  }, [id])

  const contractQuotes = quotes.filter(q => q.status === '계약')
  const latestContract = contractQuotes[contractQuotes.length - 1]
  const latestItems = latestContract ? (quoteItems[latestContract.id] ?? []) : []

  const totalExecutionAmount = Number(latestContract?.total_execution_amount ?? 0)
  const totalProfit = Number(latestContract?.total_profit ?? 0)
  const profitRate = Number(latestContract?.total_profit_rate ?? 0)

  const minusItems = latestItems.filter(i => {
    const quoteAmt = (i.material_unit_price + i.labor_unit_price) * i.quantity
    const execAmt = i.execution_amount ?? 0
    return execAmt > 0 && execAmt > quoteAmt
  })

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{project?.name}</h2>
            {project?.address && <p className="text-sm text-gray-400 mt-0.5">{project.address}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/quotes?projectId=${id}`)}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            견적 히스토리
          </button>
          <button onClick={() => router.push(`/quotes/new?projectId=${id}`)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={15} /> 새 견적서 작성
          </button>
        </div>
      </div>

      {/* 담당자 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5 grid grid-cols-3 gap-4">
        {project?.manager_name && (
          <div>
            <p className="text-xs text-gray-400">PM</p>
            <p className="text-sm font-medium text-gray-800">{project.manager_name}
              {project.manager_phone && <span className="text-xs text-gray-400 ml-2">{project.manager_phone}</span>}
            </p>
          </div>
        )}
        {project?.designer_name && (
          <div>
            <p className="text-xs text-gray-400">담당디자이너</p>
            <p className="text-sm font-medium text-gray-800">{project.designer_name}
              {project.designer_phone && <span className="text-xs text-gray-400 ml-2">{project.designer_phone}</span>}
            </p>
          </div>
        )}
        {project?.site_manager_name && (
          <div>
            <p className="text-xs text-gray-400">담당소장</p>
            <p className="text-sm font-medium text-gray-800">{project.site_manager_name}
              {project.site_manager_phone && <span className="text-xs text-gray-400 ml-2">{project.site_manager_phone}</span>}
            </p>
          </div>
        )}
        {project?.min_profit_rate != null && (
          <div>
            <p className="text-xs text-gray-400">목표 이윤율</p>
            <p className={`text-sm font-medium ${
              totalExecutionAmount > 0
                ? profitRate >= project.min_profit_rate ? 'text-green-700' : 'text-red-700'
                : 'text-gray-800'
            }`}>
              {project.min_profit_rate}%
            </p>
          </div>
        )}
        {project?.note && (
          <div className="col-span-3 border-t border-gray-100 pt-3 mt-1">
            <p className="text-xs text-gray-400">메모/참고사항</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mt-1">{project.note}</p>
          </div>
        )}
      </div>

      {/* 이익률 현황 (계약견적서 기준) */}
      {latestContract && (
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div className="col-span-4 mb-2">
            <span className="text-xs text-gray-400">
              계약견적서 기준 ({latestContract?.quote_number ?? '-'} · {latestContract ? new Date(latestContract.created_at).toLocaleDateString('ko-KR') : ''})
            </span>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">견적금액</p>
            <p className="text-lg font-bold text-gray-900">{fmt(Number(latestContract.final_amount ?? 0))}</p>
            <p className="text-xs text-gray-400">원</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-400 mb-1">실행금액</p>
            <p className="text-lg font-bold text-red-600">{fmt(totalExecutionAmount)}</p>
            <p className="text-xs text-gray-400">원</p>
          </div>
          <div className={`rounded-xl border p-4 ${totalProfit >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-xs text-gray-400 mb-1">예상 이익</p>
            <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)}
            </p>
            <p className="text-xs text-gray-400">원</p>
          </div>
          <div className={`rounded-xl border p-4 ${profitRate >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className="text-xs text-gray-400 mb-1">이익률</p>
            <div className="flex items-center gap-1">
              {profitRate >= 0
                ? <TrendingUp size={18} className="text-green-600" />
                : <TrendingDown size={18} className="text-red-600" />
              }
              <p className={`text-lg font-bold ${profitRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmtRate(profitRate)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 마이너스 항목 경고 */}
      {minusItems.length > 0 && (
        <div className="bg-red-50 rounded-xl border border-red-100 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-red-500" />
            <span className="text-sm font-bold text-red-700">마이너스 항목 {minusItems.length}개</span>
          </div>
          <div className="space-y-2">
            {minusItems.map(item => {
              const quoteAmt = (item.material_unit_price + item.labor_unit_price) * item.quantity
              const diff = quoteAmt - (item.execution_amount ?? 0)
              return (
                <div key={item.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">{item.work_type}</span>
                    <span className="text-xs text-gray-700">{item.item_name}</span>
                  </div>
                  <span className="text-xs font-bold text-red-600">{fmt(diff)}원</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 견적 히스토리 */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-gray-900 text-sm">견적 히스토리</span>
          <span className="text-xs text-gray-400">{quotes.length}건</span>
        </div>
        {quotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">작성된 견적서가 없습니다</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">구분</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">상태</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">견적금액</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">실행금액</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">이익률</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">작성일</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500">바로가기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {quotes.map(q => {
                const eAmt = Number(q.total_execution_amount ?? 0)
                const rate = Number(q.total_profit_rate ?? 0)
                return (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${VERSION_COLOR[q.quote_number] ?? 'bg-gray-100 text-gray-600'}`}>
                        {q.quote_number ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUOTE_STATUS_COLOR[q.status as keyof typeof QUOTE_STATUS_COLOR] ?? 'bg-gray-100 text-gray-600'}`}>
                        {q.status ?? '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-700">{Number(q.final_amount) > 0 ? fmt(Number(q.final_amount)) : '-'}</td>
                    <td className="px-4 py-3 text-right text-xs text-red-600">{eAmt > 0 ? fmt(eAmt) : '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {eAmt > 0 ? (
                        <span className={`text-xs font-bold ${rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {fmtRate(rate)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(q.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/quotes/${q.id}`)}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <FileText size={12} />
                          {" 열기"}
                        </button>
                        <button
                          onClick={() => router.push(`/quotes/new?copyFrom=${q.id}`)}
                          title="견적 복사"
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
