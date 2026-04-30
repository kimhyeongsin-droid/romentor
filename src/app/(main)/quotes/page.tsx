'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { formatKRW } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = { '작성중': '작성중', '배포완료': '배포완료' }
const STATUS_COLOR: Record<string, string> = {
  '작성중': 'bg-blue-100 text-blue-700',
  '배포완료': 'bg-green-100 text-green-700',
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const { data } = await createClient()
      .from('quotes')
      .select('*, projects(name, client_name, manager_name)')
      .order('created_at', { ascending: false })
    setQuotes(data ?? [])
  }

  useEffect(() => { load() }, [])

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
          <p className="text-gray-500 text-sm mt-1">총 {quotes.length}건</p>
        </div>
        <Link href="/quotes/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> 새 견적
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['견적번호', '프로젝트', '고객', '담당자', '견적금액', '실행금액', '이윤', '이윤율', '상태', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {quotes.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">견적이 없습니다.</td></tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">{q.quote_number}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{q.projects?.name}</td>
                <td className="px-4 py-3 text-gray-600">{q.projects?.client_name}</td>
                <td className="px-4 py-3 text-gray-600">{q.projects?.manager_name}</td>
                <td className="px-4 py-3 text-right font-medium">{formatKRW(q.total_quote_amount)}</td>
                <td className="px-4 py-3 text-right">{formatKRW(q.total_execution_amount)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(q.total_profit) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {formatKRW(q.total_profit)}
                </td>
                <td className={`px-4 py-3 text-right font-semibold ${Number(q.total_profit_rate) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {q.total_profit_rate}%
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {q.quote_number && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        {q.quote_number}
                      </span>
                    )}
                    {q.status === '배포완료'
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">배포완료</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">작성중</span>
                    }
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/quotes/${q.id}`} className="text-blue-600 hover:underline text-xs">상세</Link>
                    <button onClick={() => deleteQuote(q.id, q.quote_number)} disabled={deleting === q.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40">
                      {deleting === q.id ? '...' : <Trash2 size={13} />}
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
