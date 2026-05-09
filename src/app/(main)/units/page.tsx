'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WORK_TYPE_COLOR, type WorkType, type UnitPrice } from '@/types'
import { Plus, Pencil, Trash2, Save, X, Lock, Unlock } from 'lucide-react'

const PASSWORD = 'romentor2024'

const WORK_ORDER: WorkType[] = [
  '가설공사', '철거', '마루철거', '설비', '전기배선', '창호', '목공', '도어',
  '타일', '도장', '필름', '도배', '욕실도기', '조명', '바닥', '가구', '금속',
  '유리실리콘', '공조', '홈스타일링', '기타'
]

interface EditState {
  item_name: string; unit: string
  material_unit_price: string; labor_unit_price: string
  description: string; work_type: WorkType
}

export default function UnitsPage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [units, setUnits] = useState<UnitPrice[]>([])
  const [filter, setFilter] = useState<WorkType | 'all'>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState<EditState>({
    work_type: '철거', item_name: '', unit: '식',
    material_unit_price: '0', labor_unit_price: '0', description: '',
  })

  useEffect(() => {
    const saved = sessionStorage.getItem('units_unlocked')
    if (saved === 'true') setUnlocked(true)
  }, [])

  async function load() {
    const { data } = await createClient().from('unit_prices').select('*')
    if (!data) return
    // WORK_ORDER 순서로 정렬
    const sorted = [...data].sort((a, b) => {
      const ai = WORK_ORDER.indexOf(a.work_type as WorkType)
      const bi = WORK_ORDER.indexOf(b.work_type as WorkType)
      if (ai !== bi) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      return a.item_name.localeCompare(b.item_name, 'ko')
    })
    setUnits(sorted)
  }

  useEffect(() => { if (unlocked) load() }, [unlocked])

  function tryUnlock() {
    if (pwInput === PASSWORD) {
      setUnlocked(true)
      sessionStorage.setItem('units_unlocked', 'true')
      setPwError(false)
    } else {
      setPwError(true)
    }
  }

  function lock() {
    setUnlocked(false)
    sessionStorage.removeItem('units_unlocked')
  }

  const filtered = filter === 'all' ? units : units.filter(u => u.work_type === filter)

  // 공종별 그룹핑 (화면 표시용)
  const grouped: { wt: WorkType; items: UnitPrice[] }[] = []
  const displayList = filter === 'all' ? WORK_ORDER : [filter as WorkType]
  for (const wt of displayList) {
    const items = filtered.filter(u => u.work_type === wt)
    if (items.length > 0) grouped.push({ wt, items })
  }

  async function saveEdit(id: string) {
    if (!editState) return
    const mat = Number(editState.material_unit_price) || 0
    const lab = Number(editState.labor_unit_price) || 0
    await createClient().from('unit_prices').update({
      work_type: editState.work_type, item_name: editState.item_name,
      unit: editState.unit, material_unit_price: mat,
      labor_unit_price: lab, unit_price: mat + lab,
      description: editState.description || null,
    }).eq('id', id)
    setEditId(null)
    await load()
  }

  async function deleteUnit(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await createClient().from('unit_prices').delete().eq('id', id)
    await load()
  }

  async function addUnit() {
    if (!newItem.item_name.trim()) return alert('항목명을 입력하세요.')
    const mat = Number(newItem.material_unit_price) || 0
    const lab = Number(newItem.labor_unit_price) || 0
    await createClient().from('unit_prices').insert({
      work_type: newItem.work_type, item_name: newItem.item_name,
      unit: newItem.unit, material_unit_price: mat,
      labor_unit_price: lab, unit_price: mat + lab,
      description: newItem.description || null,
    })
    setAdding(false)
    setNewItem({ work_type: '철거', item_name: '', unit: '식', material_unit_price: '0', labor_unit_price: '0', description: '' })
    await load()
  }

  // 비밀번호 잠금 화면
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-96 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">단가 마스터</h2>
          <p className="text-sm text-gray-400 mb-6">관리자 비밀번호를 입력하세요</p>
          <input
            type="password"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && tryUnlock()}
            placeholder="비밀번호"
            className={`w-full border rounded-lg px-4 py-3 text-sm text-center focus:outline-none focus:ring-2 mb-3 ${pwError ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-300'}`}
          />
          {pwError && <p className="text-xs text-red-500 mb-3">비밀번호가 올바르지 않습니다</p>}
          <button onClick={tryUnlock} className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700">
            입력
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">단가 마스터</h2>
          <p className="text-gray-500 text-sm mt-1">총 {units.length}개 단가 · 견적서 출력 순서로 정렬</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAdding(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            <Plus size={16} /> 단가 추가
          </button>
          <button onClick={lock}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Unlock size={16} /> 잠금
          </button>
        </div>
      </div>

      {/* 공종 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          전체
        </button>
        {WORK_ORDER.map(wt => (
          <button key={wt} onClick={() => setFilter(wt)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === wt ? WORK_TYPE_COLOR[wt] + ' ring-2 ring-current ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {wt}
          </button>
        ))}
      </div>

      {/* 단가 추가 폼 */}
      {adding && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">새 단가 추가</h3>
          <div className="grid grid-cols-7 gap-2 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">공종</label>
              <select value={newItem.work_type} onChange={e => setNewItem(p => ({ ...p, work_type: e.target.value as WorkType }))}
                className="border border-gray-200 rounded px-2 py-1.5 text-xs w-full">
                {WORK_ORDER.map(wt => <option key={wt} value={wt}>{wt}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">항목명</label>
              <input value={newItem.item_name} onChange={e => setNewItem(p => ({ ...p, item_name: e.target.value }))}
                placeholder="항목명" className="border border-gray-200 rounded px-2 py-1.5 text-xs w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">단위</label>
              <input value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
                className="border border-gray-200 rounded px-2 py-1.5 text-xs w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">재료단가</label>
              <input type="number" value={newItem.material_unit_price} onChange={e => setNewItem(p => ({ ...p, material_unit_price: e.target.value }))}
                className="border border-blue-200 rounded px-2 py-1.5 text-xs w-full text-right" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">노무단가</label>
              <input type="number" value={newItem.labor_unit_price} onChange={e => setNewItem(p => ({ ...p, labor_unit_price: e.target.value }))}
                className="border border-amber-200 rounded px-2 py-1.5 text-xs w-full text-right" />
            </div>
            <div className="flex gap-1">
              <button onClick={addUnit} className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 flex-1">저장</button>
              <button onClick={() => setAdding(false)} className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs hover:bg-gray-200"><X size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {/* 공종별 그룹 테이블 */}
      <div className="space-y-6">
        {grouped.map(({ wt, items }) => (
          <div key={wt} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 공종 헤더 */}
            <div className={`px-5 py-3 flex items-center justify-between ${WORK_TYPE_COLOR[wt]} bg-opacity-30`}
              style={{ background: 'rgba(0,0,0,0.03)' }}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${WORK_TYPE_COLOR[wt]}`}>{wt}</span>
                <span className="text-xs text-gray-400">{items.length}개 항목</span>
              </div>
              <button
                onClick={() => { setAdding(true); setNewItem(p => ({ ...p, work_type: wt })) }}
                className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1">
                <Plus size={12} /> 항목 추가
              </button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['항목명', '단위', '재료단가', '노무단가', '합계단가', '설명', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    {editId === u.id && editState ? (
                      <>
                        <td className="px-4 py-2">
                          <input value={editState.item_name} onChange={e => setEditState(p => p ? { ...p, item_name: e.target.value } : p)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={editState.unit} onChange={e => setEditState(p => p ? { ...p, unit: e.target.value } : p)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-14" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={editState.material_unit_price} onChange={e => setEditState(p => p ? { ...p, material_unit_price: e.target.value } : p)}
                            className="border border-blue-200 rounded px-2 py-1 text-xs w-28 text-right" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" value={editState.labor_unit_price} onChange={e => setEditState(p => p ? { ...p, labor_unit_price: e.target.value } : p)}
                            className="border border-amber-200 rounded px-2 py-1 text-xs w-28 text-right" />
                        </td>
                        <td className="px-4 py-2 text-right text-xs font-semibold text-gray-700">
                          {((Number(editState.material_unit_price)||0)+(Number(editState.labor_unit_price)||0)).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <input value={editState.description} onChange={e => setEditState(p => p ? { ...p, description: e.target.value } : p)}
                            className="border border-gray-200 rounded px-2 py-1 text-xs w-full" />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(u.id)} className="bg-blue-600 text-white p-1.5 rounded hover:bg-blue-700"><Save size={12} /></button>
                            <button onClick={() => setEditId(null)} className="bg-gray-100 text-gray-600 p-1.5 rounded hover:bg-gray-200"><X size={12} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{u.item_name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{u.unit}</td>
                        <td className="px-4 py-2.5 text-right text-blue-700 font-medium text-xs">{Number(u.material_unit_price??0).toLocaleString()}원</td>
                        <td className="px-4 py-2.5 text-right text-amber-700 font-medium text-xs">{Number(u.labor_unit_price??0).toLocaleString()}원</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-800 text-xs">{Number(u.unit_price).toLocaleString()}원</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{u.description}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <button onClick={() => { setEditId(u.id); setEditState({ work_type: u.work_type as WorkType, item_name: u.item_name, unit: u.unit, material_unit_price: String(u.material_unit_price??0), labor_unit_price: String(u.labor_unit_price??0), description: u.description??'' }) }} className="text-gray-400 hover:text-blue-600 p-1"><Pencil size={13} /></button>
                            <button onClick={() => deleteUnit(u.id)} className="text-gray-400 hover:text-red-600 p-1"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {grouped.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            단가가 없습니다. 단가를 추가해주세요.
          </div>
        )}
      </div>
    </div>
  )
}
