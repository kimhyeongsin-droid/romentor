'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { QUOTE_STATUS_COLOR } from '@/lib/quoteConstants'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { ResizeHandle } from '@/components/common/ResizeHandle'

type SortKey = 'updated_at' | 'quote_number' | 'project_name' | 'total_quote_amount' | 'total_profit_rate' | 'status'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated_at', label: '수정일' },
  { value: 'quote_number', label: '견적번호' },
  { value: 'project_name', label: '프로젝트명' },
  { value: 'total_quote_amount', label: '견적금액' },
  { value: 'total_profit_rate', label: '이윤율' },
  { value: 'status', label: '상태' },
]

const NUMERIC_KEYS: SortKey[] = ['total_quote_amount', 'total_profit_rate']

function getSortValue(q: any, key: SortKey): string | number {
  if (key === 'project_name') return q.projects?.name ?? ''
  if (NUMERIC_KEYS.includes(key)) return Number(q[key]) || 0
  return q[key] ?? ''
}

const DEFAULT_WIDTHS = {
  quote_number: 130,
  project_name: 180,
  client_name: 76,
  manager_name: 76,
  total_quote_amount: 100,
  total_execution_amount: 100,
  total_profit: 92,
  total_profit_rate: 56,
  status: 120,
  actions: 82,
}

function QuotesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [quotes, setQuotes] = useState<any[]>([])
  const [projectName, setProjectName] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortAsc, setSortAsc] = useState(false)

  const { widths, startResize, resetWidths } = useResizableColumns(
    'romentor.quotesTable.colWidths',
    DEFAULT_WIDTHS
  )

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return quotes
    return quotes.filter(row =>
      [row.quote_number, row.projects?.name, row.projects?.client_name, row.projects?.manager_name]
        .some(v => v?.toLowerCase().includes(q))
    )
  }, [quotes, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey)
      const bv = getSortValue(b, sortKey)
      if (NUMERIC_KEYS.includes(sortKey)) {
        const cmp = (av as number) - (bv as number)
        return sortAsc ? cmp : -cmp
      }
      const cmp = String(av).localeCompare(String(bv), 'ko')
      return sortAsc ? cmp : -cmp
    })
  }, [filtered, sortKey, sortAsc])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">견적 관리</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">총 {sorted.length}건</p>
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

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="견적번호, 프로젝트, 고객, 담당자로 검색"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as SortKey)}
          className="w-36 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={() => setSortAsc(v => !v)}
          className="flex items-center justify-center w-9 h-9 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 transition-colors"
          title={sortAsc ? '오름차순' : '내림차순'}
        >
          {sortAsc ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
        </button>
        <button
          onClick={resetWidths}
          className="flex items-center gap-1.5 px-2.5 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors whitespace-nowrap"
          title="컬럼 폭 초기화"
        >
          <RotateCcw size={13} />
          폭 초기화
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.quote_number }}>
                견적번호
                <ResizeHandle columnKey="quote_number" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.project_name }}>
                프로젝트
                <ResizeHandle columnKey="project_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.client_name }}>
                고객
                <ResizeHandle columnKey="client_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.manager_name }}>
                담당자
                <ResizeHandle columnKey="manager_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.total_quote_amount }}>
                견적금액
                <ResizeHandle columnKey="total_quote_amount" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.total_execution_amount }}>
                실행금액
                <ResizeHandle columnKey="total_execution_amount" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.total_profit }}>
                이윤
                <ResizeHandle columnKey="total_profit" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.total_profit_rate }}>
                이윤율
                <ResizeHandle columnKey="total_profit_rate" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.status }}>
                상태
                <ResizeHandle columnKey="status" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5" style={{ width: widths.actions }}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-gray-400">
                  {search ? '검색 결과가 없습니다.' : '견적이 없습니다.'}
                </td>
              </tr>
            )}
            {sorted.map((q) => (
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
