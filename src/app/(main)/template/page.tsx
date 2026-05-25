'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WORK_TYPE_COLOR, WORK_ORDER, type WorkType } from '@/types'
import { Plus, Trash2, Lock, Unlock, RefreshCw, ChevronDown, GripVertical } from 'lucide-react'
import { verifyAdminPassword } from '@/lib/passwordVerify'
import { fetchCompanyRates, saveCompanyRates } from '@/lib/companySettings'
import { calcFinalAmount } from '@/lib/quote-calc'
import { SIZE_CATEGORIES } from '@/lib/quoteConstants'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'


interface TemplateItem {
  id: string; work_type: WorkType; item_name: string; unit: string
  quantity: number; material_unit_price: number; labor_unit_price: number
  comment: string; note: string; sort_order: number
  space_type: string; size_category: string
}

const fmt = (n: number) => n.toLocaleString()

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

interface SortableRowProps {
  item: TemplateItem
  savingId: string | null
  upd: (id: string, key: keyof TemplateItem, value: any) => void
  sav: (item: TemplateItem) => void
  del: (id: string) => void
  addItemAt: (workType: WorkType, afterSortOrder: number) => void
}

const SortableRow = React.memo(function SortableRow({ item, savingId: sid, upd, sav, del, addItemAt }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const itemNameRef = useRef<HTMLTextAreaElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (itemNameRef.current) autoResize(itemNameRef.current)
    if (commentRef.current) autoResize(commentRef.current)
  }, [item.item_name, item.comment])
  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group ${item.quantity === 0 ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'} ${sid === item.id ? 'bg-blue-50' : ''}`}
    >
      <td className="px-3 py-1.5 align-top flex items-start gap-1">
        <span
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mt-1"
        >
          <GripVertical size={12} />
        </span>
        <button
          onClick={() => addItemAt(item.work_type, item.sort_order)}
          className="flex-shrink-0 text-gray-200 hover:text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="아래에 항목 추가"
        >
          <Plus size={12} />
        </button>
        <textarea ref={itemNameRef} value={item.item_name}
          onChange={e => { upd(item.id, 'item_name', e.target.value); autoResize(e.target) }}
          onFocus={e => autoResize(e.target)}
          onBlur={() => sav(item)}
          rows={1}
          className="w-full text-xs font-medium text-gray-800 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
      </td>
      <td className="px-3 py-1.5 align-top">
        <textarea ref={commentRef} value={item.comment ?? ''}
          onChange={e => { upd(item.id, 'comment', e.target.value); autoResize(e.target) }}
          onFocus={e => autoResize(e.target)}
          onBlur={() => sav(item)}
          placeholder="Comment"
          rows={1}
          className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
      </td>
      <td className="px-3 py-1.5">
        <input value={item.unit}
          onChange={e => upd(item.id, 'unit', e.target.value)}
          onBlur={() => sav(item)}
          className="w-full text-xs text-gray-500 text-center border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5">
        <input type="text" value={item.quantity === 0 ? '0' : String(item.quantity)}
          onFocus={e => e.target.select()}
          onChange={e => {
            const val = e.target.value.replace(/[^0-9.]/g, '')
            const parts = val.split('.')
            const clean = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : val
            upd(item.id, 'quantity', clean === '' ? 0 : Number(clean) || 0)
          }}
          onBlur={() => sav(item)}
          className={`w-full text-xs text-right border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white ${item.quantity === 0 ? 'text-red-400' : 'text-gray-700'}`} />
      </td>
      <td className="px-3 py-1.5">
        <input type="text" value={String(item.material_unit_price)}
          onFocus={e => e.target.select()}
          onChange={e => upd(item.id, 'material_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
          onBlur={() => sav(item)}
          className="w-full text-xs text-right text-blue-700 font-medium border border-transparent hover:border-blue-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-blue-700 whitespace-nowrap bg-blue-50/40 w-28">
        {(item.material_unit_price * item.quantity).toLocaleString()}
      </td>
      <td className="px-3 py-1.5">
        <input type="text" value={String(item.labor_unit_price)}
          onFocus={e => e.target.select()}
          onChange={e => upd(item.id, 'labor_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
          onBlur={() => sav(item)}
          className="w-full text-xs text-right text-amber-700 font-medium border border-transparent hover:border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-amber-700 whitespace-nowrap bg-amber-50/40 w-28">
        {(item.labor_unit_price * item.quantity).toLocaleString()}
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">
        {(item.material_unit_price + item.labor_unit_price).toLocaleString()}
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-700 whitespace-nowrap w-28">
        {((item.material_unit_price + item.labor_unit_price) * item.quantity).toLocaleString()}
      </td>
      <td className="px-3 py-1.5 align-top">
        <textarea value={item.note ?? ''}
          onChange={e => { upd(item.id, 'note', e.target.value); autoResize(e.target) }}
          onFocus={e => autoResize(e.target)}
          onBlur={() => sav(item)}
          placeholder="비고"
          rows={1}
          className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
      </td>
      <td className={`sticky right-0 w-8 px-2 py-1.5 ${sid === item.id ? 'bg-blue-50' : item.quantity === 0 ? 'bg-gray-50' : 'bg-white group-hover:bg-gray-50'}`}>
        <button onClick={() => del(item.id)} className="text-gray-200 hover:text-red-500 p-1">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
})

export default function TemplatePage() {
  const [unlocked, setUnlocked] = useState(false)
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [items, setItems] = useState<TemplateItem[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<WorkType | 'all'>('all')
  const [syncMsg, setSyncMsg] = useState('')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [sizeCategory, setSizeCategory] = useState('50평대')
  const [pyeong, setPyeong] = useState('')
  const [rates, setRates] = useState({
    accident: 3.78,
    employment: 2.05,
    overhead: 5,
    profit: 15,
    vat: 10,
  })
  const [rateSaveStatus, setRateSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [showAddWorkType, setShowAddWorkType] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    if (sessionStorage.getItem('units_unlocked') === 'true') setUnlocked(true)
  }, [])

  async function load() {
    const { data } = await createClient()
      .from('quote_templates')
      .select('*')
      .eq('size_category', sizeCategory)
      .order('sort_order')
    setItems(data ?? [])
  }

  useEffect(() => { if (unlocked) load() }, [unlocked, sizeCategory])

  useEffect(() => {
    if (!unlocked) return
    fetchCompanyRates().then(loaded => {
      if (loaded) setRates(loaded)
    })
  }, [unlocked])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function handleRateChange(newRates: typeof rates) {
    setRates(newRates)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setRateSaveStatus('saving')
    saveTimerRef.current = setTimeout(async () => {
      const result = await saveCompanyRates(newRates)
      setRateSaveStatus(result.success ? 'saved' : 'error')
      setTimeout(() => setRateSaveStatus('idle'), 2000)
    }, 500)
  }

  async function tryUnlock() {
    const ok = await verifyAdminPassword(pwInput)
    if (ok) {
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

  const filtered = filter === 'all' ? items : items.filter(i => i.work_type === filter)
  const grouped = WORK_ORDER
    .map(wt => ({ wt, items: filtered.filter(i => i.work_type === wt) }))
    .filter(g => g.items.length > 0)

  // 공종별 집계 (필터 무관, 전체 items 기준)
  const summaryRows = WORK_ORDER
    .map((wt) => {
      const wtItems = items.filter(i => i.work_type === wt)
      if (wtItems.length === 0) return null
      const materialTotal = wtItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0)
      const laborTotal = wtItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0)
      return { wt, materialTotal, laborTotal, total: materialTotal + laborTotal }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // 직접공사비
  const directMaterial = summaryRows.reduce((s, r) => s + r.materialTotal, 0)
  const directLabor    = summaryRows.reduce((s, r) => s + r.laborTotal, 0)

  const {
    directTotal,
    indirectAccident,
    indirectEmployment,
    indirectOverhead,
    indirectProfit,
    indirectTotal,
    vat,
    finalAmount: finalTotal,
  } = calcFinalAmount({
    items: [{ material_unit_price: 0, labor_unit_price: 0, quantity: 0, material_amount: directMaterial, labor_amount: directLabor }],
    rates,
    discount: discount || 0,
  })

  function scrollToSection(wt: WorkType) {
    document.getElementById(`section-${wt}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const updateItem = useCallback((id: string, key: keyof TemplateItem, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  }, [])

  const saveItem = useCallback(async (item: TemplateItem) => {
    setSavingId(item.id)
    await createClient().from('quote_templates').update({
      item_name: item.item_name, unit: item.unit, quantity: item.quantity,
      material_unit_price: item.material_unit_price,
      labor_unit_price: item.labor_unit_price,
      comment: item.comment, note: item.note,
    }).eq('id', item.id)
    setSavingId(null)
  }, [])

  async function addItem(wt: WorkType) {
    const maxOrder = Math.max(0, ...items.filter(i => i.work_type === wt).map(i => i.sort_order))
    const { data } = await createClient().from('quote_templates').insert({
      work_type: wt, item_name: '새 항목', unit: '식',
      quantity: 1, material_unit_price: 0, labor_unit_price: 0, comment: '', note: '', sort_order: maxOrder + 1,
      size_category: sizeCategory,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }

  const deleteItem = useCallback(async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await createClient().from('quote_templates').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }, [])

  const addItemAt = useCallback(async (workType: WorkType, afterSortOrder: number) => {
    const sb = createClient()
    const wtItems = items.filter(i => i.work_type === workType)
    const toUpdate = wtItems.filter(i => i.sort_order > afterSortOrder)
    await Promise.all(toUpdate.map(i =>
      sb.from('quote_templates').update({ sort_order: i.sort_order + 1 }).eq('id', i.id)
    ))
    const { data } = await sb.from('quote_templates').insert({
      work_type: workType,
      item_name: '새 항목',
      unit: '식',
      quantity: 1,
      material_unit_price: 0,
      labor_unit_price: 0,
      comment: '',
      note: '',
      sort_order: afterSortOrder + 1,
      space_type: '주거',
      size_category: sizeCategory,
    }).select().single()
    if (data) {
      setItems(prev => {
        const updated = prev.map(i =>
          i.work_type === workType && i.sort_order > afterSortOrder
            ? { ...i, sort_order: i.sort_order + 1 }
            : i
        )
        return [...updated, data].sort((a, b) =>
          WORK_ORDER.indexOf(a.work_type) - WORK_ORDER.indexOf(b.work_type) || a.sort_order - b.sort_order
        )
      })
    }
  }, [items, sizeCategory])

  const applyAutoCalcToTemplate = useCallback(async () => {
    const p = Number(pyeong)
    if (!p || p <= 0) { alert('평수를 입력해주세요'); return }
    if (!confirm(`${sizeCategory} 포맷의 수량을 ${p}평 기준으로 자동계산할까요?\n해당 항목들이 DB에 바로 저장됩니다.`)) return

    const PYEONG_MAP: Record<string, { quantity?: number; material_unit_price?: number }> = {
      '공정중 현장 보양 및 시공': { quantity: p },
      '가설전기': { quantity: p },
      '준공청소': { quantity: p },
      '내부 전열,조명 배선작업': { quantity: p },
      '인건비 / 폐기물 처리비용': { quantity: Math.round(p * 0.8) },
      '실크벽지': { quantity: Math.round(p * 3) },
      '원목마루 시공': { quantity: Math.round(p * 0.9) },
      '전체 실리콘 마감': { quantity: p },
      '입주청소': { quantity: p },
    }

    const sb = createClient()
    const updatedItems = [...items]

    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i]

      if (item.work_type === '설계비용') {
        const newPrice = p * 150000
        await sb.from('quote_templates')
          .update({ material_unit_price: newPrice, quantity: 1 })
          .eq('id', item.id)
        updatedItems[i] = { ...item, material_unit_price: newPrice, quantity: 1 }
        continue
      }

      if (PYEONG_MAP[item.item_name] !== undefined) {
        const updates = PYEONG_MAP[item.item_name]
        await sb.from('quote_templates')
          .update(updates)
          .eq('id', item.id)
        updatedItems[i] = { ...item, ...updates }
      }
    }

    setItems(updatedItems)
    alert(`✅ ${p}평 기준으로 ${sizeCategory} 수량 자동계산 및 저장 완료!`)
  }, [pyeong, sizeCategory, items])

  async function loadFromUnitPrices() {
    if (!confirm(`단가 마스터의 단가를 모든 평형(${SIZE_CATEGORIES.length}개) 포맷에 반영할까요?\n(기존 항목명·Comment·수량·순서는 유지되고, 단가만 업데이트됩니다. 단가 마스터에만 있는 새 항목은 모든 평형에 추가됩니다.)`)) return
    setSyncMsg('단가 마스터 반영 중...')
    const sb = createClient()
    const [{ data: existing }, { data: units }] = await Promise.all([
      sb.from('quote_templates').select('*'),
      sb.from('unit_prices').select('*'),
    ])
    if (!units) { setSyncMsg(''); return }
    const currentItems = existing ?? []

    const updates: any[] = []
    const inserts: any[] = []
    let updatedCount = 0
    let insertedCount = 0

    for (const u of units) {
      for (const size of SIZE_CATEGORIES) {
        const match = currentItems.find(
          (t: any) =>
            t.size_category === size &&
            t.work_type === u.work_type &&
            t.item_name === u.item_name
        )
        if (match) {
          updates.push(sb.from('quote_templates').update({
            unit: u.unit,
            material_unit_price: u.material_unit_price ?? 0,
            labor_unit_price: u.labor_unit_price ?? 0,
          }).eq('id', match.id))
          updatedCount++
        } else {
          const sizeWtItems = currentItems.filter(
            (t: any) => t.size_category === size && t.work_type === u.work_type
          )
          const maxOrder = sizeWtItems.length > 0
            ? Math.max(...sizeWtItems.map((t: any) => t.sort_order ?? -1))
            : -1
          inserts.push({
            work_type: u.work_type,
            item_name: u.item_name,
            unit: u.unit,
            quantity: 1,
            material_unit_price: u.material_unit_price ?? 0,
            labor_unit_price: u.labor_unit_price ?? 0,
            comment: '',
            note: '',
            sort_order: maxOrder + 1,
            space_type: '주거',
            size_category: size,
          })
          insertedCount++
        }
      }
    }

    await Promise.all(updates)
    if (inserts.length > 0) {
      await sb.from('quote_templates').insert(inserts)
    }

    await load()
    setSyncMsg(`✅ ${SIZE_CATEGORIES.length}개 평형에 반영 완료 · 업데이트 ${updatedCount} / 신규 ${insertedCount}`)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  async function syncToUnitPrices() {
    if (!confirm('현재 포맷의 단가를 단가 마스터에 반영할까요?\n(항목명, 단위, 재료단가, 노무단가가 업데이트됩니다. 마스터에 없는 항목은 신규 추가됩니다.)')) return
    setSyncMsg('동기화 중...')
    const sb = createClient()
    const { data: units } = await sb.from('unit_prices').select('id, work_type, item_name')
    if (!units) { setSyncMsg(''); return }
    let updated = 0
    let inserted = 0
    for (const item of items) {
      const match = units.find(u => u.work_type === item.work_type && u.item_name === item.item_name)
      const sum = item.material_unit_price + item.labor_unit_price
      if (match) {
        await sb.from('unit_prices').update({
          unit: item.unit,
          material_unit_price: item.material_unit_price,
          labor_unit_price: item.labor_unit_price,
          unit_price: sum,
        }).eq('id', match.id)
        updated++
      } else {
        await sb.from('unit_prices').insert({
          work_type: item.work_type,
          item_name: item.item_name,
          unit: item.unit,
          material_unit_price: item.material_unit_price,
          labor_unit_price: item.labor_unit_price,
          unit_price: sum,
        })
        inserted++
      }
    }
    setSyncMsg(`✅ 단가 마스터 반영 완료 · 업데이트 ${updated} / 신규 ${inserted}`)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  const handleDragEnd = useCallback(async (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const dragItem = items.find(i => i.id === active.id)
    const overItem = items.find(i => i.id === over.id)
    if (!dragItem || !overItem || dragItem.work_type !== overItem.work_type) return

    const wtItems = items.filter(i => i.work_type === dragItem.work_type)
    const oldIdx = wtItems.findIndex(i => i.id === active.id)
    const newIdx = wtItems.findIndex(i => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(wtItems, oldIdx, newIdx)
    const updates = reordered.map((it, idx) => ({ ...it, sort_order: idx }))

    await Promise.all(updates.map(u =>
      createClient().from('quote_templates').update({ sort_order: u.sort_order }).eq('id', u.id)
    ))

    await load()
  }, [items])

  if (!unlocked) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-96 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock size={28} className="text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">기본 견적 포맷</h2>
        <p className="text-sm text-gray-400 mb-6">관리자 비밀번호를 입력하세요</p>
        {!process.env.NEXT_PUBLIC_FORMAT_PASSWORD_HASH && (
          <p className="text-xs text-orange-500 mb-3">비밀번호 설정 오류: 환경변수가 설정되지 않았습니다</p>
        )}
        <input type="password" value={pwInput}
          onChange={e => setPwInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && tryUnlock()}
          placeholder="비밀번호"
          className={`w-full border rounded-lg px-4 py-3 text-sm text-center focus:outline-none focus:ring-2 mb-3 ${pwError ? 'border-red-400 focus:ring-red-300' : 'border-gray-200 focus:ring-blue-300'}`}
        />
        {pwError && <p className="text-xs text-red-500 mb-3">비밀번호가 올바르지 않습니다</p>}
        <button onClick={tryUnlock} className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700">입력</button>
      </div>
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">기본 견적 포맷</h2>
          <p className="text-gray-500 text-sm mt-1">총 {items.length}개 항목 · 셀 클릭 후 수정, 포커스 아웃 시 자동 저장</p>
          {syncMsg && <p className="text-sm text-emerald-600 mt-1 font-medium">{syncMsg}</p>}
          {rateSaveStatus === 'saving' && <p className="text-xs text-gray-500 mt-1">저장 중...</p>}
          {rateSaveStatus === 'saved' && <p className="text-xs text-green-600 mt-1">저장됨 ✓</p>}
          {rateSaveStatus === 'error' && <p className="text-xs text-red-600 mt-1">저장 실패</p>}
        </div>
        <div className="flex items-start gap-3 flex-shrink-0">
          <div className="flex flex-col items-end gap-1">
            <button onClick={syncToUnitPrices}
              className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700">
              <RefreshCw size={15} /> 단가 마스터에 반영
            </button>
            <span className="text-xs text-gray-400 leading-tight">
              포맷에서 수정한 단가 → 마스터에 저장
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button onClick={loadFromUnitPrices}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
              단가 초기화
            </button>
            <span className="text-xs text-gray-400 leading-tight">
              마스터 저장값으로 단가 초기화
            </span>
          </div>
          <button onClick={() => setShowAddWorkType(true)}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700">
            <Plus size={15} /> 공종 추가
          </button>
          <button onClick={lock}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Unlock size={16} /> 잠금
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-700">
        💡 <strong>사용법:</strong> 항목명·단위·수량·재료단가·노무단가·비고를 클릭해 수정 → 자동 저장.
        수량 <strong>0</strong> = 견적 작성 시 제외. 수정 완료 후 <strong>단가 마스터에 반영</strong> 버튼으로 마스터에 저장하고, <strong>단가 초기화</strong> 버튼으로 마스터 최신값을 모든 평형에 일괄 반영하세요.
      </div>

      {/* 평형대 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SIZE_CATEGORIES.map(size => (
          <button key={size} onClick={() => setSizeCategory(size)}
            className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${sizeCategory === size ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {size}
          </button>
        ))}
      </div>

      {/* 평수 자동계산 */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-gray-500">평수 입력:</span>
        <input
          type="number"
          value={pyeong}
          onChange={e => setPyeong(e.target.value)}
          placeholder="예) 50"
          className="w-24 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={applyAutoCalcToTemplate}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          수량 자동계산
        </button>
        <span className="text-xs text-gray-400">현재 평형대 데이터에 적용 후 자동 저장</span>
      </div>

      {/* 공종 필터 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <button onClick={() => setFilter('all')}
          className={`text-xs px-3 py-1.5 rounded-full font-medium ${filter === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          전체
        </button>
        {WORK_ORDER.map(wt => {
          const cnt = items.filter(i => i.work_type === wt).length
          if (!cnt) return null
          return (
            <button key={wt} onClick={() => setFilter(wt)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium ${filter === wt ? WORK_TYPE_COLOR[wt] + ' ring-2 ring-current ring-offset-1' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {wt} <span className="opacity-60">({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* ── 견적 합계표 ── */}
      {items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setSummaryOpen(v => !v)}
            className="w-full px-5 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-sm">견적 합계표</span>
              <span className="text-xs text-gray-400">공종 행 클릭 시 해당 섹션으로 이동</span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${summaryOpen ? '' : '-rotate-90'}`} />
          </button>

          {summaryOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-2.5 text-center text-xs font-semibold w-12">번호</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold">명 칭</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold w-14">단위</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold w-14">수량</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">재료비 금액</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">노무비 금액</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold w-36">합계 금액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">

                  {/* ── 직접공사비 섹션 헤더 ── */}
                  <tr className="bg-blue-50">
                    <td colSpan={7} className="px-4 py-2 text-xs font-bold text-blue-800 tracking-wide">
                      ■ 직접공사비
                    </td>
                  </tr>

                  {/* 공종별 행 */}
                  {summaryRows.map((row, idx) => (
                    <tr key={row.wt}
                      onClick={() => scrollToSection(row.wt)}
                      className="hover:bg-blue-50 cursor-pointer transition-colors">
                      <td className="px-4 py-2 text-xs text-gray-400 text-center">{idx + 1}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${WORK_TYPE_COLOR[row.wt]}`}>{row.wt}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                      <td className="px-4 py-2 text-xs text-gray-500 text-center">1</td>
                      <td className="px-4 py-2 text-xs text-blue-700 text-right">{fmt(row.materialTotal)}</td>
                      <td className="px-4 py-2 text-xs text-amber-700 text-right">{fmt(row.laborTotal)}</td>
                      <td className="px-4 py-2 text-xs text-gray-800 font-semibold text-right">{fmt(row.total)}</td>
                    </tr>
                  ))}

                  {/* 직접공사비 합계 */}
                  <tr className="bg-gray-100">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-800">직접공사비 합계</td>
                    <td className="px-4 py-2.5 text-xs text-blue-800 font-bold text-right">{fmt(directMaterial)}</td>
                    <td className="px-4 py-2.5 text-xs text-amber-800 font-bold text-right">{fmt(directLabor)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-900 font-bold text-right">{fmt(directTotal)}</td>
                  </tr>

                  {/* ── 간접공사비 섹션 헤더 ── */}
                  <tr className="bg-orange-50">
                    <td colSpan={7} className="px-4 py-2 text-xs font-bold text-orange-800 tracking-wide">
                      ■ 간접공사비
                    </td>
                  </tr>

                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      산재보험료 (노무비 ×{' '}
                      <input type="number" value={rates.accident}
                        onChange={e => handleRateChange({ ...rates, accident: Number(e.target.value) })}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step="0.01" />
                      %)
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(indirectAccident)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      고용보험료 (노무비 ×{' '}
                      <input type="number" value={rates.employment}
                        onChange={e => handleRateChange({ ...rates, employment: Number(e.target.value) })}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step="0.01" />
                      %)
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(indirectEmployment)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      공과잡비 (직접공사비 ×{' '}
                      <input type="number" value={rates.overhead}
                        onChange={e => handleRateChange({ ...rates, overhead: Number(e.target.value) })}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step="0.1" />
                      %)
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(indirectOverhead)}</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      기업이윤 (직접공사비 ×{' '}
                      <input type="number" value={rates.profit}
                        onChange={e => handleRateChange({ ...rates, profit: Number(e.target.value) })}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step="0.1" />
                      %)
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 text-right">{fmt(indirectProfit)}</td>
                  </tr>

                  {/* 간접공사비 합계 */}
                  <tr className="bg-gray-100">
                    <td colSpan={6} className="px-4 py-2.5 text-xs font-bold text-gray-800">간접공사비 합계</td>
                    <td className="px-4 py-2.5 text-xs text-gray-900 font-bold text-right">{fmt(indirectTotal)}</td>
                  </tr>

                  {/* 부가세 */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      부가세{' '}
                      <input type="number" value={rates.vat}
                        onChange={e => handleRateChange({ ...rates, vat: Number(e.target.value) })}
                        className="w-14 text-xs text-center border-b border-gray-300 focus:outline-none focus:border-blue-400 bg-transparent"
                        step="0.1" />
                      %
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-700 font-medium text-right">{fmt(vat)}</td>
                  </tr>

                  {/* 단수할인 */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-xs text-gray-400 text-center"></td>
                    <td className="px-4 py-2 text-xs text-gray-700">
                      단수할인 <span className="text-gray-400">(음수 입력 시 차감)</span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">식</td>
                    <td className="px-4 py-2 text-xs text-gray-400 text-center">1</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-xs text-gray-300 text-right">-</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        value={discount}
                        onChange={e => setDiscount(Number(e.target.value))}
                        className="w-full text-xs text-right text-gray-700 font-medium border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white"
                      />
                    </td>
                  </tr>

                  {/* 최종 합계 */}
                  <tr className="bg-gray-900">
                    <td colSpan={6} className="px-4 py-3.5 text-sm font-bold text-white">최종 합계</td>
                    <td className="px-4 py-3.5 text-sm font-bold text-white text-right">{fmt(finalTotal)} 원</td>
                  </tr>

                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center">
          <p className="text-gray-400 mb-4">기본 견적 포맷이 없습니다.</p>
          <button onClick={loadFromUnitPrices} className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700">
            단가 마스터에서 불러오기
          </button>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-4">
            {grouped.map(({ wt, items: gItems }) => (
              <div key={wt} id={`section-${wt}`} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${WORK_TYPE_COLOR[wt]}`}>{wt}</span>
                    <span className="text-xs text-gray-400">{gItems.length}개</span>
                  </div>
                  <button onClick={() => addItem(wt)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1">
                    <Plus size={12} /> 항목 추가
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-48">항목명</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-56">Comment</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 w-12">단위</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-16">수량</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-blue-500 w-28">재료단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-blue-600 w-24 bg-blue-50">재료금액</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-amber-500 w-28">노무단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-amber-600 w-24 bg-amber-50">노무금액</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">합계단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-24">합계금액</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-32">비고</th>
                        <th className="sticky right-0 bg-gray-50 w-8 z-10"></th>
                      </tr>
                    </thead>
                    <SortableContext items={gItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                      <tbody className="divide-y divide-gray-50">
                        {gItems.map(item => (
                          <SortableRow
                            key={item.id}
                            item={item}
                            savingId={savingId}
                            upd={updateItem}
                            sav={saveItem}
                            del={deleteItem}
                            addItemAt={addItemAt}
                          />
                        ))}
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">
                            {wt} 합계
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-gray-400">-</td>
                          <td className="px-3 py-2 text-xs text-right text-blue-700 font-bold bg-blue-50/40">
                            {gItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-gray-400">-</td>
                          <td className="px-3 py-2 text-xs text-right text-amber-700 font-bold bg-amber-50/40">
                            {gItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-gray-400">-</td>
                          <td className="px-3 py-2 text-xs text-right font-bold text-gray-800 bg-gray-100">
                            {gItems.reduce((s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0).toLocaleString()}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tbody>
                    </SortableContext>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </DndContext>
      )}

      {showAddWorkType && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h3 className="font-bold text-gray-900 mb-4">공종 추가</h3>
            <input
              type="text"
              placeholder="공종명 입력 (예: 특수공사)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300"
              id="new-work-type-input"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const input = document.getElementById('new-work-type-input') as HTMLInputElement
                  const newWt = input?.value?.trim()
                  if (!newWt) return
                  const { data } = await createClient().from('quote_templates').insert({
                    work_type: newWt, item_name: '새 항목', unit: '식',
                    quantity: 1, material_unit_price: 0, labor_unit_price: 0,
                    comment: '', note: '', sort_order: 0,
                    space_type: '주거', size_category: sizeCategory,
                  }).select().single()
                  if (data) {
                    setItems(prev => [...prev, data])
                    setShowAddWorkType(false)
                  }
                }}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >추가</button>
              <button
                onClick={() => setShowAddWorkType(false)}
                className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
