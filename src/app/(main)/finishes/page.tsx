'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Search, Layers, ChevronRight } from 'lucide-react'
import { WORK_TYPE_COLOR, type WorkType } from '@/types'

interface SiteRow {
  id: string
  updated_at: string
  project_name: string
  client_name: string
  address: string
}

interface FinishRow {
  id: string
  quote_id: string
  work_type: WorkType
  location: string | null
  brand: string | null
  vendor: string | null
  product_name: string | null
  color_code: string | null
}

function wtColor(wt: string): string {
  return (WORK_TYPE_COLOR as Record<string, string>)[wt] ?? 'bg-gray-100 text-gray-600'
}

export default function FinishesHubPage() {
  const [sites, setSites] = useState<SiteRow[]>([])
  const [finishes, setFinishes] = useState<FinishRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, updated_at, projects(name, client_name, address)')
      .eq('status', '정산')
      .order('updated_at', { ascending: false })

    const siteRows: SiteRow[] = (quotes ?? []).map((row: any) => ({
      id: row.id,
      updated_at: row.updated_at,
      project_name: row.projects?.name ?? '(이름 없음)',
      client_name: row.projects?.client_name ?? '',
      address: row.projects?.address ?? '',
    }))
    setSites(siteRows)

    const ids = siteRows.map(s => s.id)
    if (ids.length) {
      const { data: fin } = await supabase
        .from('project_finishes')
        .select('id, quote_id, work_type, location, brand, vendor, product_name, color_code')
        .in('quote_id', ids)
      setFinishes((fin ?? []) as FinishRow[])
    } else {
      setFinishes([])
    }
    setLoading(false)
  }

  const countByQuote = useMemo(() => {
    const m: Record<string, { total: number; filled: number }> = {}
    for (const f of finishes) {
      const e = m[f.quote_id] ?? { total: 0, filled: 0 }
      e.total += 1
      if (f.product_name && f.product_name.trim()) e.filled += 1
      m[f.quote_id] = e
    }
    return m
  }, [finishes])

  const siteById = useMemo(() => {
    const m: Record<string, SiteRow> = {}
    for (const s of sites) m[s.id] = s
    return m
  }, [sites])

  const searchResults = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return finishes.filter(f => {
      const hay = [f.brand, f.vendor, f.product_name, f.color_code, f.location, f.work_type]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [q, finishes])

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Layers size={22} className="text-blue-600" /> 마감재 관리
        </h2>
        <p className="text-gray-500 text-sm mt-1 break-keep">정산 완료 현장의 마감재를 조회하고 브랜드·발주처·제품으로 교차 검색합니다.</p>
      </div>

      <div className="relative mb-2">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="브랜드·발주처·품번·제품명 검색"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>
      <p className="text-xs text-gray-400 mb-6 break-keep">검색하면 여러 현장에 걸쳐 결과가 나옵니다 — AS 재주문 시 활용</p>

      {loading ? (
        <div className="text-center text-gray-400 py-12">불러오는 중…</div>
      ) : q.trim() ? (
        <>
          {/* 데스크탑: 표 */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['제품명', '브랜드', '발주처', '컬러/품번', '공종', '현장', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {searchResults.map(f => {
                  const s = siteById[f.quote_id]
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{f.product_name || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{f.brand || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{f.vendor || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{f.color_code || '—'}</td>
                      <td className="px-4 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${wtColor(f.work_type)}`}>{f.work_type}</span></td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{s?.project_name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/finishes/${f.quote_id}`} className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1">열기 <ChevronRight size={12} /></Link>
                      </td>
                    </tr>
                  )
                })}
                {searchResults.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">검색 결과가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 모바일: 카드 */}
          <div className="md:hidden space-y-2">
            {searchResults.map(f => {
              const s = siteById[f.quote_id]
              return (
                <Link key={f.id} href={`/finishes/${f.quote_id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-blue-200">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-medium text-gray-900 break-keep">{f.product_name || '(제품명 미입력)'}</p>
                    <span className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${wtColor(f.work_type)}`}>{f.work_type}</span>
                  </div>
                  <p className="text-xs text-gray-500 break-keep">
                    {[f.brand, f.vendor, f.color_code].filter(Boolean).join(' · ') || '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 break-keep">{s?.project_name ?? '—'}</p>
                </Link>
              )
            })}
            {searchResults.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">검색 결과가 없습니다.</div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          {sites.map(s => {
            const c = countByQuote[s.id] ?? { total: 0, filled: 0 }
            const done = c.total > 0 && c.filled === c.total
            return (
              <Link key={s.id} href={`/finishes/${s.id}`}
                className="flex items-center gap-3 md:gap-4 bg-white rounded-xl border border-gray-100 shadow-sm px-4 md:px-5 py-4 hover:border-blue-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{s.project_name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.client_name}{s.address ? ` · ${s.address}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 whitespace-nowrap">{c.total === 0 ? '미입력' : `${c.filled} / ${c.total}`}</p>
                </div>
                <span className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium ${c.total === 0 ? 'bg-gray-100 text-gray-500' : done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {c.total === 0 ? '시작 전' : done ? '완료' : '입력중'}
                </span>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
              </Link>
            )
          })}
          {sites.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">정산 완료된 현장이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  )
}
