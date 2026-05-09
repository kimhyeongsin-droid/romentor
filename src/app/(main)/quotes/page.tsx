'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Copy, Plus, Trash2, X } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { QUOTE_STATUS_COLOR } from '@/lib/quoteConstants'

function QuotesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [quotes, setQuotes] = useState<any[]>([])
  const [projectName, setProjectName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    let query = createClient()
      .from('quotes')
      .select('id, quote_number, type, status, total_quote_amount, total_execution_amount, total_profit, total_profit_rate, note, updated_at, projects(name, client_name, manager_name)')
      .order('created_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data } = await query
    setQuotes(data ?? [])

    if (projectId && data && data.length > 0) {
      const proj = data[0].projects
      setProjectName(((Array.isArray(proj) ? proj[0] : proj) as { name?: string } | null)?.name ?? null)
    }
  }

  useEffect(() => { load() }, [projectId])

  async function deleteQuote(id: string, number: string) {
    if (!confirm(`"${number}" 견적서를 삭제하시겠습니까?`)) return
    setDeleting(id)
    const sb = createClient()
    await sb.from('quote_items').delete().eq('quote_id', id)
    await sb.from('quotes').delete().eq('id', id)
    setDeleting(null)
    await load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">견적 관리</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">총 {quotes.length}건</p>
            {projectId && projectName && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                {projectName}
                <button
                  onClick={() => router.push('/quotes')}
                  className="ml-0.5 hover:text-blue-900"
                >
                  <X size={11} />
                </button>
              </span>
            )}
            {projectId && !projectName && (
              <button
                onClick={() => router.push('/quotes')}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                전체 보기
              </button>
            )}
          </div>
        </div>
        <Link
          href={projectId ? `/quotes/new?projectId=${projectId}` : '/quotes/new'}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> 새 견적
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[130px]">견적번호</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[180px]">프로젝트</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[76px]">고객</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[76px]">담당자</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[100px]">견적금액</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[100px]">실행금액</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[92px]">이윤</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide w-[56px]">이윤율</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-[120px]">상태</th>
              <th className="px-3 py-2.5 w-[82px]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-12 text-center text-gray-400">견적이 없습니다.</td></tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-3 py-2.5 overflow-hidden">
                  <div className="font-mono text-xs text-gray-600 truncate">{q.quote_number}</div>
                  {q.updated_at && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(q.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 overflow-hidden">
                  <div className="text-sm font-medium text-gray-900 truncate" title={q.projects?.name}>
                    {q.projects?.name}
                  </div>
                  {q.note && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <span className="truncate" title={q.note}>💬 {q.note}</span>
                      {q.type === '정산' && (
                        <span className="flex-shrink-0 px-1 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">정산</span>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 overflow-hidden">
                  <div className="truncate">{q.projects?.client_name}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 overflow-hidden">
                  <div className="truncate">{q.projects?.manager_name}</div>
                </td>
                <td className="px-3 py-2.5 text-right text-xs font-medium whitespace-nowrap">{formatKRW(q.total_quote_amount)}</td>
                <td className="px-3 py-2.5 text-right text-xs whitespace-nowrap">{formatKRW(q.total_execution_amount)}</td>
                <td className={`px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${Number(q.total_profit) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatKRW(q.total_profit)}
                </td>
                <td className={`px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap ${Number(q.total_profit_rate) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {q.total_profit_rate}%
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${QUOTE_STATUS_COLOR[q.status as keyof typeof QUOTE_STATUS_COLOR] ?? 'bg-gray-100 text-gray-600'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:underline text-xs">상세</Link>
                    <button
                      onClick={() => router.push(`/quotes/new?copyFrom=${q.id}`)}
                      title="견적 복사"
                      className="text-gray-400 hover:text-blue-600"
                    >
                      <Copy size={12} />
                    </button>
                    <button onClick={() => deleteQuote(q.id, q.quote_number)} disabled={deleting === q.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40">
                      {deleting === q.id ? '...' : <Trash2 size={12} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">로딩중...</div>}>
      <QuotesContent />
    </Suspense>
  )
}
