'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { getPersonNames } from '@/lib/utils'
import { format } from 'date-fns'
import type { Project } from '@/types'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { ResizeHandle } from '@/components/common/ResizeHandle'

const PROJECT_STATUS_LABEL: Record<Project['status'], string> = {
  draft: '작성중',
  active: '진행중',
  completed: '완료',
}

const PROJECT_STATUS_COLOR: Record<Project['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
}

type SortKey = 'created_at' | 'name' | 'client_name' | 'status'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'created_at', label: '생성일' },
  { value: 'name', label: '프로젝트명' },
  { value: 'client_name', label: '고객명' },
  { value: 'status', label: '상태' },
]

const DEFAULT_WIDTHS = {
  name: 160,
  client_name: 100,
  address: 180,
  manager_name: 90,
  designer_name: 90,
  site_manager_name: 90,
  status: 80,
  created_at: 96,
  actions: 220,
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const { widths, startResize, resetWidths } = useResizableColumns(
    'romentor.projectsTable.colWidths',
    DEFAULT_WIDTHS
  )

  async function load() {
    const { data } = await createClient().from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function deleteProject(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n\n관련 견적서도 모두 삭제됩니다.`)) return
    setDeleting(id)
    const sb = createClient()
    await sb.from('quote_items').delete().in('quote_id',
      (await sb.from('quotes').select('id').eq('project_id', id)).data?.map((q: any) => q.id) ?? []
    )
    await sb.from('quotes').delete().eq('project_id', id)
    await sb.from('projects').delete().eq('id', id)
    setDeleting(null)
    await load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? projects.filter(p =>
          [p.name, p.client_name, p.address, p.manager_name, p.designer_name, p.site_manager_name]
            .some(v => v?.toLowerCase().includes(q))
        )
      : projects
  }, [projects, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      const cmp = String(av).localeCompare(String(bv), 'ko')
      return sortAsc ? cmp : -cmp
    })
  }, [filtered, sortKey, sortAsc])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트</h2>
          <p className="text-gray-500 text-sm mt-1">총 {sorted.length}개 프로젝트</p>
        </div>
        <button
          onClick={() => router.push('/projects/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> 새 프로젝트
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="프로젝트명, 고객명, 주소, 담당자로 검색"
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
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.name }}>
                프로젝트명
                <ResizeHandle columnKey="name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.client_name }}>
                고객명
                <ResizeHandle columnKey="client_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.address }}>
                주소
                <ResizeHandle columnKey="address" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.manager_name }}>
                담당 PM
                <ResizeHandle columnKey="manager_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.designer_name }}>
                디자이너
                <ResizeHandle columnKey="designer_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.site_manager_name }}>
                현장소장
                <ResizeHandle columnKey="site_manager_name" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.status }}>
                상태
                <ResizeHandle columnKey="status" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide relative" style={{ width: widths.created_at }}>
                생성일
                <ResizeHandle columnKey="created_at" onMouseDown={startResize} />
              </th>
              <th className="px-3 py-2.5" style={{ width: widths.actions }}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-gray-400">
                  {search ? '검색 결과가 없습니다.' : '프로젝트가 없습니다. 새 프로젝트를 추가하세요.'}
                </td>
              </tr>
            )}
            {sorted.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 align-top">
                <td className="px-3 py-2.5 overflow-hidden">
                  <button
                    onClick={() => router.push(`/projects/${p.id}`)}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors text-left truncate w-full block"
                    title={p.name}
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 overflow-hidden">
                  <div className="truncate" title={p.client_name}>{p.client_name || '-'}</div>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-600 overflow-hidden">
                  <div className="truncate" title={p.address}>{p.address || '-'}</div>
                </td>
                {(() => {
                  const pmNames  = getPersonNames((p as any).pms,          p.manager_name)
                  const desNames = getPersonNames((p as any).designers,     p.designer_name)
                  const smNames  = getPersonNames((p as any).site_managers, p.site_manager_name)
                  return (
                    <>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {pmNames.length === 0 ? '-' : pmNames.map((n, i) => <div key={i}>{n}</div>)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {desNames.length === 0 ? '-' : desNames.map((n, i) => <div key={i}>{n}</div>)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">
                        {smNames.length === 0 ? '-' : smNames.map((n, i) => <div key={i}>{n}</div>)}
                      </td>
                    </>
                  )
                })()}
                <td className="px-3 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${PROJECT_STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                  {p.created_at ? format(new Date(p.created_at), 'yyyy-MM-dd') : '-'}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => router.push(`/quotes/new?projectId=${p.id}`)}
                      className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                    >
                      견적 작성
                    </button>
                    <button
                      onClick={() => router.push(`/quotes?projectId=${p.id}`)}
                      className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium"
                    >
                      견적 히스토리
                    </button>
                    <button
                      onClick={() => router.push(`/projects/${p.id}/edit`)}
                      className="text-xs px-2 py-1 rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium flex items-center gap-0.5"
                    >
                      <Pencil size={11} /> 수정
                    </button>
                    <button
                      onClick={() => deleteProject(p.id, p.name)}
                      disabled={deleting === p.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-40 px-1"
                    >
                      {deleting === p.id ? <span className="text-xs">삭제중</span> : <Trash2 size={13} />}
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
