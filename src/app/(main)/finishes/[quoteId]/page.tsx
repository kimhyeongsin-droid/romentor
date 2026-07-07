'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Trash2, Printer, Lock, Eye, Download } from 'lucide-react'
import { WORK_TYPE_COLOR, type WorkType } from '@/types'
import {
  FINISH_WORK_TYPES, FINISH_ATTR_FIELDS, ATTR_LABEL,
  type ProjectFinish, type FinishAttrs,
} from '@/lib/finishes'

type Mode = 'internal' | 'customer'

export default function FinishDetailPage() {
  const quoteId = (useParams() as any)?.quoteId as string

  const [rows, setRows] = useState<ProjectFinish[]>([])
  const [site, setSite] = useState<{ name: string; client: string; address: string }>({ name: '', client: '', address: '' })
  const [mode, setMode] = useState<Mode>('internal')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => { load() }, [quoteId])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, projects(name, client_name, address)')
      .eq('id', quoteId)
      .single()
    if (quote) {
      const p: any = (quote as any).projects
      setSite({ name: p?.name ?? '', client: p?.client_name ?? '', address: p?.address ?? '' })
    }
    const { data } = await supabase
      .from('project_finishes')
      .select('*')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    setRows((data ?? []) as ProjectFinish[])
    setLoading(false)
  }

  async function seedFromQuote() {
    setSeeding(true)
    const supabase = createClient()
    const { data: items } = await supabase
      .from('quote_items')
      .select('work_type, execution_date')
      .eq('quote_id', quoteId)
    const existing = new Set(rows.map(r => r.work_type))
    const execByType: Record<string, string | null> = {}
    for (const it of (items ?? []) as any[]) {
      const wt = it.work_type as WorkType
      if (!FINISH_WORK_TYPES.includes(wt)) continue
      if (!(wt in execByType)) execByType[wt] = it.execution_date ?? null
      else if (!execByType[wt] && it.execution_date) execByType[wt] = it.execution_date
    }
    const toInsert = FINISH_WORK_TYPES
      .filter(wt => (wt in execByType) && !existing.has(wt))
      .map(wt => ({
        quote_id: quoteId,
        work_type: wt,
        installed_at: execByType[wt],
        customer_visible: true,
        attrs: {},
        sort_order: FINISH_WORK_TYPES.indexOf(wt) * 100,
      }))
    if (toInsert.length) {
      await supabase.from('project_finishes').insert(toInsert)
      await load()
    }
    setSeeding(false)
  }

  async function addRow(wt: WorkType) {
    const supabase = createClient()
    await supabase.from('project_finishes').insert({
      quote_id: quoteId, work_type: wt, customer_visible: true, attrs: {},
      sort_order: FINISH_WORK_TYPES.indexOf(wt) * 100 + rows.filter(r => r.work_type === wt).length + 1,
    })
    await load()
  }

  async function deleteRow(id: string) {
    if (!confirm('이 행을 삭제하시겠습니까?')) return
    await createClient().from('project_finishes').delete().eq('id', id)
    setRows(rs => rs.filter(r => r.id !== id))
  }

  function setLocal(id: string, patch: Partial<ProjectFinish>) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  function setAttr(id: string, key: keyof FinishAttrs, value: string) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, attrs: { ...r.attrs, [key]: value } } : r))
  }

  async function saveRow(row: ProjectFinish) {
    await createClient().from('project_finishes').update({
      location: row.location, brand: row.brand, vendor: row.vendor,
      product_name: row.product_name, color_code: row.color_code,
      installed_at: row.installed_at || null, warranty_until: row.warranty_until || null,
      note: row.note, attrs: row.attrs,
    }).eq('id', row.id)
  }

  const groups = useMemo(() => {
    const g: { wt: WorkType; items: ProjectFinish[] }[] = []
    for (const wt of FINISH_WORK_TYPES) {
      const items = rows.filter(r => r.work_type === wt)
      if (items.length) g.push({ wt, items })
    }
    return g
  }, [rows])

  const isCustomer = mode === 'customer'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <Link href="/finishes" className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> 마감재 목록
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">{site.name || '현장'} · 마감재</h2>
          <p className="text-gray-500 text-sm mt-1">{site.client}{site.address ? ` · ${site.address}` : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-gray-200 rounded-lg overflow-hidden text-sm">
            <button onClick={() => setMode('internal')}
              className={`px-3 py-2 flex items-center gap-1 ${!isCustomer ? 'bg-slate-800 text-white' : 'bg-white text-gray-500'}`}>
              <Lock size={13} /> 내부용
            </button>
            <button onClick={() => setMode('customer')}
              className={`px-3 py-2 flex items-center gap-1 ${isCustomer ? 'bg-slate-800 text-white' : 'bg-white text-gray-500'}`}>
              <Eye size={13} /> 고객용
            </button>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Printer size={16} /> 인쇄
          </button>
        </div>
      </div>

      {isCustomer && (
        <p className="text-xs text-gray-400 mb-4 print:hidden">고객용 보기 — 발주처·수량 등 내부 정보가 숨겨졌습니다.</p>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-12">불러오는 중…</div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 mb-4">아직 마감재가 없습니다.</p>
          <button onClick={seedFromQuote} disabled={seeding}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            <Download size={16} /> {seeding ? '불러오는 중…' : '정산 견적에서 공종 불러오기'}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(({ wt, items }) => {
            const attrFields = FINISH_ATTR_FIELDS[wt] ?? []
            const visibleAttrs = attrFields.filter(a => !(isCustomer && (a === 'quantity' || a === 'unit')))
            return (
              <div key={wt} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${WORK_TYPE_COLOR[wt] ?? 'bg-gray-100 text-gray-600'}`}>{wt}</span>
                  <button onClick={() => addRow(wt)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 print:hidden">
                    <Plus size={12} /> 행 추가
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">적용위치</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">브랜드</th>
                        {!isCustomer && <th className="px-3 py-2.5 text-left text-xs font-semibold text-amber-600 whitespace-nowrap">발주처</th>}
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">제품명</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">컬러/품번</th>
                        {visibleAttrs.map(a => (
                          <th key={a} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{ATTR_LABEL[a]}</th>
                        ))}
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">시공일</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">보증만료</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">비고</th>
                        {!isCustomer && <th className="px-3 py-2.5 print:hidden"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5"><input value={r.location ?? ''} onChange={e => setLocal(r.id, { location: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-24" placeholder="전체" /></td>
                          <td className="px-3 py-1.5"><input value={r.brand ?? ''} onChange={e => setLocal(r.id, { brand: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-24" /></td>
                          {!isCustomer && <td className="px-3 py-1.5"><input value={r.vendor ?? ''} onChange={e => setLocal(r.id, { vendor: e.target.value })} onBlur={() => saveRow(r)} className="border border-amber-200 rounded px-2 py-1 text-xs w-24" /></td>}
                          <td className="px-3 py-1.5"><input value={r.product_name ?? ''} onChange={e => setLocal(r.id, { product_name: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-32" /></td>
                          <td className="px-3 py-1.5"><input value={r.color_code ?? ''} onChange={e => setLocal(r.id, { color_code: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-24" /></td>
                          {visibleAttrs.map(a => (
                            <td key={a} className="px-3 py-1.5"><input value={r.attrs?.[a] ?? ''} onChange={e => setAttr(r.id, a, e.target.value)} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-20" /></td>
                          ))}
                          <td className="px-3 py-1.5"><input type="date" value={r.installed_at ?? ''} onChange={e => setLocal(r.id, { installed_at: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-32" /></td>
                          <td className="px-3 py-1.5"><input type="date" value={r.warranty_until ?? ''} onChange={e => setLocal(r.id, { warranty_until: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-32" /></td>
                          <td className="px-3 py-1.5"><input value={r.note ?? ''} onChange={e => setLocal(r.id, { note: e.target.value })} onBlur={() => saveRow(r)} className="border border-gray-200 rounded px-2 py-1 text-xs w-28" /></td>
                          {!isCustomer && <td className="px-3 py-1.5 print:hidden"><button onClick={() => deleteRow(r.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={13} /></button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
