'use client'

import React, { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { generateQuoteNumber } from '@/lib/utils'
import { WORK_TYPE_COLOR, WORK_ORDER, type WorkType } from '@/types'
import { DEFAULT_RATES } from '@/lib/quoteConstants'
import { fetchCompanyRates } from '@/lib/companySettings'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import QuoteSummaryTable from '@/components/quotes/QuoteSummaryTable'

const SIZE_CATEGORIES = ['20평대','30평대','40평대','50평대','60평대','70평대','80평대','90평대','100평대이상']


interface QuoteItem {
  tempId: string
  work_type: string
  item_name: string
  comment: string
  unit: string
  quantity: number
  material_unit_price: number
  labor_unit_price: number
  note: string
  sort_order: number
}

function colorOf(wt: string) {
  return (WORK_TYPE_COLOR as Record<string, string>)[wt] ?? 'bg-gray-100 text-gray-600'
}

function autoResizeNew(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

interface SortableQuoteRowProps {
  item: QuoteItem
  upd: (tempId: string, key: keyof QuoteItem, value: any) => void
  del: (tempId: string) => void
  addItemAt: (workType: string, afterTempId: string) => void
}

const SortableQuoteRow = React.memo(function SortableQuoteRow({ item, upd, del, addItemAt }: SortableQuoteRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.tempId })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const itemNameRef = useRef<HTMLTextAreaElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (itemNameRef.current) autoResizeNew(itemNameRef.current)
    if (commentRef.current) autoResizeNew(commentRef.current)
  }, [item.item_name, item.comment])

  const mat = item.material_unit_price * item.quantity
  const lab = item.labor_unit_price * item.quantity

  return (
    <tr ref={setNodeRef} style={style} className="group hover:bg-gray-50">
      <td className="px-3 py-1.5 align-top flex items-start gap-1">
        <span {...attributes} {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mt-1">
          <GripVertical size={12} />
        </span>
        <button
          onClick={e => { e.stopPropagation(); addItemAt(item.work_type, item.tempId) }}
          className="flex-shrink-0 text-gray-200 hover:text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
          title="아래에 항목 추가"
        >
          <Plus size={12} />
        </button>
        <textarea ref={itemNameRef} value={item.item_name}
          onChange={e => { upd(item.tempId, 'item_name', e.target.value); autoResizeNew(e.target) }}
          onFocus={e => autoResizeNew(e.target)}
          rows={1}
          className="w-full text-xs font-medium text-gray-800 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
      </td>
      <td className="px-3 py-1.5 align-top">
        <textarea ref={commentRef} value={item.comment ?? ''}
          onChange={e => { upd(item.tempId, 'comment', e.target.value); autoResizeNew(e.target) }}
          onFocus={e => autoResizeNew(e.target)}
          placeholder="Comment"
          rows={1}
          className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
      </td>
      <td className="px-3 py-1.5">
        <input value={item.unit}
          onChange={e => upd(item.tempId, 'unit', e.target.value)}
          className="w-full text-xs text-gray-500 text-center border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5">
        <input type="text" value={String(item.quantity)}
          onFocus={e => e.target.select()}
          onChange={e => upd(item.tempId, 'quantity', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
          className={`w-full text-xs text-right border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white ${item.quantity === 0 ? 'text-red-400' : 'text-gray-700'}`} />
      </td>
      <td className="px-3 py-1.5">
        <input type="text" value={String(item.material_unit_price)}
          onFocus={e => e.target.select()}
          onChange={e => upd(item.tempId, 'material_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
          className="w-full text-xs text-right text-blue-700 font-medium border border-transparent hover:border-blue-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-blue-700 bg-blue-50/40">{mat.toLocaleString()}</td>
      <td className="px-3 py-1.5">
        <input type="text" value={String(item.labor_unit_price)}
          onFocus={e => e.target.select()}
          onChange={e => upd(item.tempId, 'labor_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
          className="w-full text-xs text-right text-amber-700 font-medium border border-transparent hover:border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-amber-700 bg-amber-50/40">{lab.toLocaleString()}</td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600">{(item.material_unit_price + item.labor_unit_price).toLocaleString()}</td>
      <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-700">{(mat + lab).toLocaleString()}</td>
      <td className="px-3 py-1.5">
        <input value={item.note ?? ''}
          onChange={e => upd(item.tempId, 'note', e.target.value)}
          placeholder="비고"
          className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
      </td>
      <td className="sticky right-0 w-8 px-2 py-1.5 bg-white group-hover:bg-gray-50">
        <button onClick={() => del(item.tempId)} className="text-gray-200 hover:text-red-500 p-1">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  )
})

function NewQuoteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const copyFromId = searchParams.get('copyFrom')

  const [projects, setProjects] = useState<any[]>([])
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '')
  const [copyFromProjectId, setCopyFromProjectId] = useState('')
  const [copyFromProjectName, setCopyFromProjectName] = useState('')
  const [note, setNote] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [sizeCategory, setSizeCategory] = useState('50평대')
  const [pyeong, setPyeong] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [rates, setRates] = useState(DEFAULT_RATES)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 프로젝트 목록 로드
  useEffect(() => {
    createClient()
      .from('projects')
      .select('id, name')
      .order('created_at', { ascending: false })
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  // 기본 포맷 자동 로드 (복사 모드에서는 스킵)
  useEffect(() => {
    if (copyFromId) return
    const autoLoad = async () => {
      const { data: templates } = await createClient()
        .from('quote_templates')
        .select('*')
        .eq('size_category', sizeCategory)
        .order('sort_order')
      setLoadingTemplate(false)
      if (!templates || templates.length === 0) return
      const sorted = [...templates].sort((a: any, b: any) => {
        if (a.work_type === '설계비용') return -1
        if (b.work_type === '설계비용') return 1
        return (WORK_ORDER.indexOf(a.work_type) - WORK_ORDER.indexOf(b.work_type)) || (a.sort_order - b.sort_order)
      })
      setItems(sorted.map((t: any, idx: number) => ({
        tempId: `tmp_${t.id}_${idx}`,
        work_type: t.work_type,
        item_name: t.item_name,
        comment: t.comment ?? '',
        unit: t.unit,
        quantity: t.quantity,
        material_unit_price: t.material_unit_price ?? 0,
        labor_unit_price: t.labor_unit_price ?? 0,
        note: t.note ?? '',
        sort_order: t.sort_order,
      })))
    }
    autoLoad()
  }, [])

  // 새 견적: company_settings에서 요율 로드 (복사 모드는 원본 견적 요율 사용)
  useEffect(() => {
    if (copyFromId) return
    fetchCompanyRates().then(loaded => {
      if (loaded) setRates(loaded)
    })
  }, [])

  // 복사 모드: 원본 견적 로드
  useEffect(() => {
    if (!copyFromId) return
    const loadCopy = async () => {
      const sb = createClient()
      const [{ data: q }, { data: its }] = await Promise.all([
        sb.from('quotes').select('*, projects(id, name)').eq('id', copyFromId).single(),
        sb.from('quote_items').select('*').eq('quote_id', copyFromId).order('work_type').order('created_at'),
      ])

      if (q) {
        setProjectId(q.project_id ?? '')
        setCopyFromProjectId(q.project_id ?? '')
        const proj = Array.isArray(q.projects) ? q.projects[0] : q.projects
        setCopyFromProjectName((proj as { name?: string } | null)?.name ?? '')
        setNote(q.note ? `복사본 - ${q.note}` : '복사본')
        if (q.rates && typeof q.rates === 'object') setRates(q.rates)
        if (q.discount != null) setDiscount(Number(q.discount))
      }

      if (its && its.length > 0) {
        const sorted = [...its].sort((a: any, b: any) => {
          if (a.work_type === '설계비용') return -1
          if (b.work_type === '설계비용') return 1
          return WORK_ORDER.indexOf(a.work_type as WorkType) - WORK_ORDER.indexOf(b.work_type as WorkType)
        })
        setItems(sorted.map((t: any, idx: number) => ({
          tempId: `copy_${t.id}_${idx}`,
          work_type: t.work_type,
          item_name: t.item_name,
          comment: t.comment ?? '',
          unit: t.unit,
          quantity: t.quantity,
          material_unit_price: t.material_unit_price ?? 0,
          labor_unit_price: t.labor_unit_price ?? 0,
          note: t.note ?? '',
          sort_order: t.sort_order ?? idx,
        })))
      }

      setLoadingTemplate(false)
    }
    loadCopy()
  }, [])

  const grouped = WORK_ORDER
    .map(wt => ({ wt, items: items.filter(i => i.work_type === wt) }))

  const unknownWts = [...new Set(items.filter(i => !WORK_ORDER.includes(i.work_type as WorkType)).map(i => i.work_type))]
  const allGrouped = [...grouped, ...unknownWts.map(wt => ({ wt, items: items.filter(i => i.work_type === wt) }))]

  const loadFromTemplate = async () => {
    const sb = createClient()
    const { data: templates } = await sb
      .from('quote_templates')
      .select('*')
      .eq('size_category', sizeCategory)
      .order('sort_order')
    if (!templates || templates.length === 0) { alert('해당 평형대의 기본 포맷이 없습니다.'); return }
    if (!confirm(`${sizeCategory} 포맷 ${templates.length}개 항목을 불러올까요?\n기존 항목은 초기화됩니다.`)) return

    const sorted = [...templates].sort((a: any, b: any) => {
      if (a.work_type === '설계비용') return -1
      if (b.work_type === '설계비용') return 1
      return (WORK_ORDER.indexOf(a.work_type) - WORK_ORDER.indexOf(b.work_type)) || (a.sort_order - b.sort_order)
    })
    setItems(sorted.map((t: any, idx: number) => ({
      tempId: `tmp_${t.id}_${idx}`,
      work_type: t.work_type,
      item_name: t.item_name,
      comment: t.comment ?? '',
      unit: t.unit,
      quantity: t.quantity,
      material_unit_price: t.material_unit_price ?? 0,
      labor_unit_price: t.labor_unit_price ?? 0,
      note: t.note ?? '',
      sort_order: t.sort_order,
    })))
  }

  const updateItem = useCallback((tempId: string, key: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(i => i.tempId === tempId ? { ...i, [key]: value } : i))
  }, [])

  const deleteItem = useCallback((tempId: string) => {
    setItems(prev => prev.filter(i => i.tempId !== tempId))
  }, [])

  const addItem = useCallback((workType: string) => {
    const newItem: QuoteItem = {
      tempId: `tmp_${Date.now()}_${Math.random()}`,
      work_type: workType,
      item_name: '새 항목',
      comment: '',
      unit: '식',
      quantity: 1,
      material_unit_price: 0,
      labor_unit_price: 0,
      note: '',
      sort_order: 0,
    }
    setItems(prev => {
      const idx = prev.findLastIndex(i => i.work_type === workType)
      if (idx === -1) return [...prev, newItem]
      const next = [...prev]
      next.splice(idx + 1, 0, newItem)
      return next
    })
  }, [])

  const addItemAt = useCallback((workType: string, afterTempId: string) => {
    const newItem: QuoteItem = {
      tempId: `tmp_${Date.now()}_${Math.random()}`,
      work_type: workType,
      item_name: '새 항목',
      comment: '',
      unit: '식',
      quantity: 1,
      material_unit_price: 0,
      labor_unit_price: 0,
      note: '',
      sort_order: 0,
    }
    setItems(prev => {
      const idx = prev.findIndex(i => i.tempId === afterTempId)
      if (idx === -1) return [...prev, newItem]
      const next = [...prev]
      next.splice(idx + 1, 0, newItem)
      return next
    })
  }, [])

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const dragItem = prev.find(i => i.tempId === active.id)
      const overItem = prev.find(i => i.tempId === over.id)
      if (!dragItem || !overItem || dragItem.work_type !== overItem.work_type) return prev
      const wtItems = prev.filter(i => i.work_type === dragItem.work_type)
      const oldIdx = wtItems.findIndex(i => i.tempId === active.id)
      const newIdx = wtItems.findIndex(i => i.tempId === over.id)
      const reordered = arrayMove(wtItems, oldIdx, newIdx)
      const result: QuoteItem[] = []
      WORK_ORDER.forEach(wt => {
        const wtGroup = wt === dragItem.work_type
          ? reordered
          : prev.filter(i => i.work_type === wt)
        result.push(...wtGroup)
      })
      const remaining = prev.filter(i => !WORK_ORDER.includes(i.work_type as any))
      return [...result, ...remaining]
    })
  }, [])

  const applyAutoCalc = () => {
    const p = Number(pyeong)
    if (!p || p <= 0) { alert('평수를 입력해주세요'); return }

    const PYEONG_MAP: Record<string, number> = {
      '공정중 현장 보양 및 시공': p,
      '가설전기': p,
      '준공청소': p,
      '내부 전열,조명 배선작업': p,
      '인건비 / 폐기물 처리비용': Math.round(p * 0.8),
      '실크벽지': Math.round(p * 3),
      '원목마루 시공': Math.round(p * 0.9),
      '전체 실리콘 마감': p,
      '입주청소': p,
    }

    setItems(prev => prev.map(item => {
      if (item.work_type === '설계비용') {
        return { ...item, material_unit_price: p * 150000, quantity: 1 }
      }
      if (PYEONG_MAP[item.item_name] !== undefined) {
        return { ...item, quantity: PYEONG_MAP[item.item_name] }
      }
      return item
    }))
    alert(`✅ ${p}평 기준으로 수량 자동계산 완료!`)
  }

  const handleSave = async () => {
    if (!projectId) { alert('프로젝트를 선택해주세요'); return }

    // 복사 모드에서 원본과 동일한 프로젝트 선택 시 경고
    if (copyFromId && projectId === copyFromProjectId) {
      if (!confirm('같은 프로젝트에 복사합니다. 계속하시겠습니까?')) return
    }

    const insertItems = items
      .filter(i => i.quantity > 0)
      .map((i, idx) => ({
        work_type: i.work_type,
        item_name: i.item_name,
        comment: i.comment,
        unit: i.unit,
        quantity: i.quantity,
        material_unit_price: i.material_unit_price,
        labor_unit_price: i.labor_unit_price,
        note: i.note,
        sort_order: idx,
        planned_execution_amount: null,
        actual_execution_amount: null,
      }))

    if (insertItems.length === 0) {
      alert('수량이 입력된 항목이 없습니다. 최소 1개 이상 입력해주세요.')
      return
    }

    setLoading(true)
    const sb = createClient()

    let quote = null
    let quoteError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const quoteNumber = await generateQuoteNumber(sb)
      const { data, error } = await sb.from('quotes').insert({
        project_id: projectId,
        quote_number: quoteNumber,
        note,
        status: '작성중',
        type: '견적',
        rate_accident_insurance: rates.accident / 100,
        rate_employment_insurance: rates.employment / 100,
        rate_indirect_overhead: rates.overhead / 100,
        rate_profit_margin: rates.profit / 100,
        rate_vat: rates.vat / 100,
        discount_amount: discount || 0,
      }).select().single()
      if (data) { quote = data; break }
      quoteError = error
      if ((error as any)?.code !== '23505') break
    }

    if (!quote) {
      alert('견적서 저장 실패: ' + ((quoteError as any)?.message ?? '알 수 없는 오류'))
      setLoading(false)
      return
    }

    const { error: itemsError } = await sb.from('quote_items').insert(
      insertItems.map(i => ({ quote_id: (quote as any).id, ...i }))
    )
    if (itemsError) {
      console.error('quote_items 저장 실패:', itemsError)
      alert('항목 저장 실패: ' + itemsError.message)
      setLoading(false)
      return
    }
    router.push(`/quotes/${(quote as any).id}`)
  }

  const isSameProject = copyFromId && projectId === copyFromProjectId

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">새 견적서 작성</h2>

      {/* 복사 모드 배너 */}
      {copyFromId && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4 flex items-start gap-3">
          <span className="text-xl leading-none mt-0.5">⚠️</span>
          <div>
            <p className="font-bold text-amber-800 text-sm">견적 복사 모드</p>
            <p className="text-amber-700 text-xs mt-0.5">원본 견적의 모든 항목을 복사했습니다. 저장 전 아래에서 프로젝트를 반드시 확인하세요.</p>
          </div>
        </div>
      )}

      {/* 복사 모드 프로젝트 확인 섹션 (최상단 강조) */}
      {copyFromId && (
        <div className={`bg-white rounded-xl border-2 shadow-sm p-6 mb-4 ${isSameProject ? 'border-red-400' : 'border-green-400'}`}>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-bold text-gray-800">프로젝트 확인</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSameProject ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {isSameProject ? '원본과 동일' : '변경됨'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            원본 프로젝트: <span className="font-semibold text-gray-800">{copyFromProjectName || '(로딩 중...)'}</span>
          </p>
          <select
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className={`w-full border-2 rounded-lg px-3 py-2 text-sm focus:outline-none ${
              isSameProject
                ? 'border-red-400 focus:ring-2 focus:ring-red-300'
                : 'border-green-400 focus:ring-2 focus:ring-green-300'
            }`}
          >
            <option value="">프로젝트 선택</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className={`text-xs mt-2 font-medium ${isSameProject ? 'text-red-500' : 'text-green-600'}`}>
            {isSameProject
              ? '반드시 프로젝트를 확인하거나 변경하세요'
              : '✅ 다른 프로젝트로 변경됐습니다'}
          </p>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-gray-800 mb-4">기본 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* 복사 모드가 아닐 때만 여기에 프로젝트 선택 표시 */}
          {!copyFromId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">프로젝트 *</label>
              <select value={projectId} onChange={e => setProjectId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">프로젝트 선택</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className={copyFromId ? 'col-span-2' : ''}>
            <label className="block text-sm font-medium text-gray-700 mb-1">파일명</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="참고 사항" />
          </div>
        </div>
      </div>

      {/* 평형대 탭 + 불러오기 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {SIZE_CATEGORIES.map(size => (
          <button key={size} onClick={() => setSizeCategory(size)}
            className={`text-sm px-4 py-1.5 rounded-full font-medium border transition-colors ${sizeCategory === size ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {size}
          </button>
        ))}
        <button onClick={loadFromTemplate}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          기본 포맷 불러오기
        </button>
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
          onClick={applyAutoCalc}
          className="flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-violet-700"
        >
          수량 자동계산
        </button>
        <span className="text-xs text-gray-400">불러온 항목에 적용</span>
      </div>

      {/* 견적 합계표 */}
      {items.length > 0 && (
        <QuoteSummaryTable
          items={items}
          rates={rates}
          discount={discount}
          open={summaryOpen}
          onToggle={() => setSummaryOpen(v => !v)}
          isEditable={true}
          isContract={false}
          onRateChange={(key, value) => setRates(r => ({ ...r, [key]: value }))}
          onDiscountChange={setDiscount}
        />
      )}

      {/* 공종별 그룹 테이블 */}
      {loadingTemplate ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center mb-6">
          <p className="text-gray-400">{copyFromId ? '원본 견적 불러오는 중...' : '기본 포맷 불러오는 중...'}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-16 text-center mb-6">
          <p className="text-gray-400">평형대를 선택하고 <strong>기본 포맷 불러오기</strong>를 클릭하세요.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="space-y-4 mb-6">
            {allGrouped.map(({ wt, items: gItems }) => (
              <div key={wt} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${colorOf(wt)}`}>{wt}</span>
                  <span className="text-xs text-gray-400">{gItems.length}개</span>
                  <button onClick={() => addItem(wt)} className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 ml-auto">
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
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-20">수량</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-blue-500 w-28">재료단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-blue-600 w-28 bg-blue-50">재료금액</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-amber-500 w-28">노무단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-amber-600 w-28 bg-amber-50">노무금액</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24">합계단가</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28">합계금액</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">비고</th>
                        <th className="sticky right-0 bg-gray-50 w-8 z-10"></th>
                      </tr>
                    </thead>
                    <SortableContext items={gItems.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
                      <tbody className="divide-y divide-gray-50">
                        {gItems.map(item => (
                          <SortableQuoteRow
                            key={item.tempId}
                            item={item}
                            upd={updateItem}
                            del={deleteItem}
                            addItemAt={addItemAt}
                          />
                        ))}
                        <tr className="bg-gray-50 border-t-2 border-gray-200">
                          <td colSpan={4} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">{wt} 합계</td>
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

      {/* 저장 버튼 */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={loading || loadingTemplate || !projectId}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? '저장중...' : '견적서 저장'}
        </button>
        <button onClick={() => router.back()}
          className="bg-gray-100 text-gray-700 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200">취소</button>
      </div>
    </div>
  )
}

export default function NewQuotePage() {
  return <Suspense><NewQuoteForm /></Suspense>
}
