'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORK_TYPE_COLOR, WORK_ORDER, type WorkType } from '@/types'
import { DEFAULT_RATES, isReadonly as checkReadonly, QUOTE_STATUS_COLOR } from '@/lib/quoteConstants'
import { calcEffectiveExec, calcFinalAmount, isGroupComplete } from '@/lib/quote-calc'
import { generateQuoteNumber } from '@/lib/utils'
import { Printer, ArrowLeft, Save, GripVertical, Plus, Trash2, Send } from 'lucide-react'
import QuoteSummaryTable from '@/components/quotes/QuoteSummaryTable'
import { useResizableColumns } from '@/hooks/useResizableColumns'
import { ResizeHandle } from '@/components/common/ResizeHandle'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const TOGGLEABLE_COLUMNS = [
  { key: 'comment', label: 'Comment' },
  { key: 'unit', label: '단위' },
  { key: 'quantity', label: '수량' },
  { key: 'material_unit_price', label: '재료단가' },
  { key: 'material_amount', label: '재료금액' },
  { key: 'labor_unit_price', label: '노무단가' },
  { key: 'labor_amount', label: '노무금액' },
  { key: 'total_unit_price', label: '합계단가' },
  { key: 'total_amount', label: '합계금액' },
  { key: 'planned_execution', label: '예상실행가' },
  { key: 'execution_date', label: '지출일' },
  { key: 'actual_execution', label: '실제실행가' },
  { key: 'profit', label: '이윤' },
  { key: 'profit_rate', label: '이윤율' },
  { key: 'remark', label: '비고' },
]
const COLUMN_VISIBILITY_KEY = 'romentor.quoteItemTable.settlement.visibleColumns'

const ITEM_DEFAULT_WIDTHS = {
  item_name: 180, comment: 150, unit: 50, quantity: 60,
  material_unit_price: 90, material_amount: 90, labor_unit_price: 90, labor_amount: 90,
  total_unit_price: 80, total_amount: 90, planned_execution: 100, execution_date: 110,
  actual_execution: 100, profit: 80, profit_rate: 70, remark: 100, delete: 32,
}

function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

interface QuoteItem {
  id: string
  work_type: string
  item_name: string
  comment: string
  unit: string
  quantity: number
  material_unit_price: number
  labor_unit_price: number
  planned_execution_amount: number | null
  actual_execution_amount: number | null
  execution_amount: number | null
  execution_date: string | null
  execution_memo: string | null
  note: string
  sort_order: number | null
}

interface SortableItemRowProps {
  item: QuoteItem
  isEditable: boolean
  isSettlement: boolean
  minProfitRate: number | null
  upd: (id: string, key: keyof QuoteItem, value: any) => void
  del: (id: string) => void
  addItemAt: (workType: string, afterId: string) => void
  widths: Record<string, number>
  visibleColumns: Record<string, boolean>
}

const SortableItemRow = React.memo(function SortableItemRow({ item, isEditable, isSettlement, minProfitRate, upd, del, addItemAt, widths, visibleColumns }: SortableItemRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const itemNameRef = useRef<HTMLTextAreaElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (itemNameRef.current) autoResize(itemNameRef.current)
    if (commentRef.current) autoResize(commentRef.current)
  }, [item.item_name, item.comment])

  const mat = item.material_unit_price * item.quantity
  const lab = item.labor_unit_price * item.quantity
  const fmt = (n: number) => n.toLocaleString()

  const quoteAmt = (item.material_unit_price + item.labor_unit_price) * item.quantity
  const actual = item.actual_execution_amount
  const { value: execValue, isProjected } = calcEffectiveExec(actual, quoteAmt, minProfitRate, isSettlement)
  const isActualBased = actual !== null && actual !== undefined
  const profit: number | null = (isActualBased || execValue > 0) && quoteAmt > 0 ? quoteAmt - execValue : null
  const profitRate: number | null = profit !== null && quoteAmt > 0 ? (profit / quoteAmt) * 100 : null
  const isMinus = profit !== null && profit < 0 && isActualBased
  const showCol = (key: string) => !isSettlement || visibleColumns[key] !== false

  return (
    <tr ref={setNodeRef} style={style} className={`group hover:bg-gray-50 ${isSettlement && isMinus ? 'bg-red-50 border-l-2 border-red-400' : ''}`}>
      <td className="px-3 py-1.5 align-top flex items-start gap-1" style={isSettlement ? { width: widths.item_name } : undefined}>
        {isEditable && (
          <>
            <span {...attributes} {...listeners}
              className="no-print flex-shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mt-1">
              <GripVertical size={12} />
            </span>
            <button
              onClick={() => addItemAt(item.work_type, item.id)}
              className="no-print flex-shrink-0 text-gray-200 hover:text-blue-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              title="아래에 항목 추가"
            >
              <Plus size={12} />
            </button>
          </>
        )}
        {isEditable ? (
          <textarea ref={itemNameRef} value={item.item_name}
            onChange={e => { upd(item.id, 'item_name', e.target.value); autoResize(e.target) }}
            onFocus={e => autoResize(e.target)}
            rows={1}
            className="w-full text-xs font-medium text-gray-800 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
        ) : (
          <span className="text-xs font-medium text-gray-800 whitespace-pre-wrap">{item.item_name}</span>
        )}
      </td>
      {showCol('comment') && (
        <td className="px-3 py-1.5 align-top" style={isSettlement ? { width: widths.comment } : undefined}>
          {isEditable ? (
            <textarea ref={commentRef} value={item.comment ?? ''}
              onChange={e => { upd(item.id, 'comment', e.target.value); autoResize(e.target) }}
              onFocus={e => autoResize(e.target)}
              placeholder="Comment"
              rows={1}
              className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white resize-none overflow-hidden leading-relaxed" />
          ) : (
            <span className="text-xs text-gray-400 whitespace-pre-wrap">{item.comment}</span>
          )}
        </td>
      )}
      {showCol('unit') && (
        <td className="px-3 py-1.5" style={isSettlement ? { width: widths.unit } : undefined}>
          {isEditable ? (
            <input value={item.unit}
              onChange={e => upd(item.id, 'unit', e.target.value)}
              className="w-full text-xs text-gray-500 text-center border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1 py-1 focus:outline-none bg-transparent focus:bg-white" />
          ) : (
            <span className="text-xs text-gray-500 block text-center">{item.unit}</span>
          )}
        </td>
      )}
      {showCol('quantity') && (
        <td className="px-3 py-1.5" style={isSettlement ? { width: widths.quantity } : undefined}>
          {isEditable ? (
            <input type="text" value={String(item.quantity)}
              onFocus={e => e.target.select()}
              onChange={e => upd(item.id, 'quantity', Number(e.target.value.replace(/[^0-9.]/g, '')) || 0)}
              className={`w-full text-xs text-right border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white ${item.quantity === 0 ? 'text-red-400' : 'text-gray-700'}`} />
          ) : (
            <span className="text-xs text-gray-700 block text-right">{item.quantity}</span>
          )}
        </td>
      )}
      {showCol('material_unit_price') && (
        <td className="px-3 py-1.5" style={isSettlement ? { width: widths.material_unit_price } : undefined}>
          {isEditable ? (
            <input type="text" value={String(item.material_unit_price)}
              onFocus={e => e.target.select()}
              onChange={e => upd(item.id, 'material_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              className="w-full text-xs text-right text-blue-700 font-medium border border-transparent hover:border-blue-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
          ) : (
            <span className="text-xs text-blue-700 font-medium block text-right">{fmt(item.material_unit_price)}</span>
          )}
        </td>
      )}
      {showCol('material_amount') && <td className="px-3 py-1.5 text-right text-xs font-semibold text-blue-700 bg-blue-50/40" style={isSettlement ? { width: widths.material_amount } : undefined}>{fmt(mat)}</td>}
      {showCol('labor_unit_price') && (
        <td className="px-3 py-1.5" style={isSettlement ? { width: widths.labor_unit_price } : undefined}>
          {isEditable ? (
            <input type="text" value={String(item.labor_unit_price)}
              onFocus={e => e.target.select()}
              onChange={e => upd(item.id, 'labor_unit_price', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)}
              className="w-full text-xs text-right text-amber-700 font-medium border border-transparent hover:border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
          ) : (
            <span className="text-xs text-amber-700 font-medium block text-right">{fmt(item.labor_unit_price)}</span>
          )}
        </td>
      )}
      {showCol('labor_amount') && <td className="px-3 py-1.5 text-right text-xs font-semibold text-amber-700 bg-amber-50/40" style={isSettlement ? { width: widths.labor_amount } : undefined}>{fmt(lab)}</td>}
      {showCol('total_unit_price') && <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-600" style={isSettlement ? { width: widths.total_unit_price } : undefined}>{fmt(item.material_unit_price + item.labor_unit_price)}</td>}
      {showCol('total_amount') && <td className="px-3 py-1.5 text-right text-xs font-semibold text-gray-700" style={isSettlement ? { width: widths.total_amount } : undefined}>{fmt(mat + lab)}</td>}
      {isSettlement && (
        <>
          {showCol('planned_execution') && (
            <td className="internal-only px-3 py-1.5" style={{ width: widths.planned_execution }}>
              <input type="text"
                value={(item.planned_execution_amount ?? 0) > 0 ? item.planned_execution_amount!.toLocaleString() : ''}
                placeholder={isSettlement && minProfitRate != null && quoteAmt > 0
                  ? Math.floor(quoteAmt * (1 - minProfitRate / 100)).toLocaleString()
                  : '-'}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = e.target.value.replace(/[,\s]/g, '').replace(/[^0-9]/g, '')
                  upd(item.id, 'planned_execution_amount', v === '' ? null : Number(v))
                }}
                className={`w-full text-xs text-right border border-transparent hover:border-violet-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white placeholder:text-gray-400 placeholder:italic ${(item.planned_execution_amount ?? 0) > 0 ? 'text-violet-600 font-medium' : 'text-gray-700'}`}
              />
            </td>
          )}
          {showCol('execution_date') && (
            <td className="internal-only px-3 py-1.5" style={{ width: widths.execution_date }}>
              {isEditable ? (
                <input type="date"
                  value={item.execution_date ?? ''}
                  onChange={e => upd(item.id, 'execution_date', e.target.value || null)}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white" />
              ) : (
                <span className="text-xs text-gray-600">{item.execution_date ?? '-'}</span>
              )}
            </td>
          )}
          {showCol('actual_execution') && (
            <td className="internal-only px-3 py-1.5" style={{ width: widths.actual_execution }}>
              <input type="text"
                value={actual !== null && actual !== undefined ? actual.toLocaleString() : ''}
                onFocus={e => e.target.select()}
                onChange={e => { const v = e.target.value.replace(/[^0-9]/g, ''); upd(item.id, 'actual_execution_amount', v === '' ? null : Number(v)) }}
                placeholder="-"
                className="w-full text-xs text-right text-red-600 font-medium border border-transparent hover:border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white placeholder:text-gray-300" />
            </td>
          )}
          {showCol('profit') && (
            <td className={`internal-only px-3 py-1.5 text-right text-xs font-semibold ${
              profit === null ? 'text-gray-300' :
              isMinus ? 'bg-red-50 text-red-600' :
              !isActualBased ? 'text-gray-400 italic' :
              'bg-green-50 text-green-600'
            }`} style={{ width: widths.profit }}>
              {profit !== null ? (isMinus ? '' : '+') + profit.toLocaleString() : '-'}
            </td>
          )}
          {showCol('profit_rate') && (
            <td className={`internal-only px-3 py-1.5 text-right text-xs font-semibold ${
              profitRate === null ? 'text-gray-300' :
              isMinus ? 'bg-red-50 text-red-600' :
              !isActualBased ? 'text-gray-400 italic' :
              'bg-green-50 text-green-600'
            }`} style={{ width: widths.profit_rate }}>
              {profitRate !== null ? profitRate.toFixed(1) + '%' : '-'}
            </td>
          )}
        </>
      )}
      {showCol('remark') && (
        <td className="px-3 py-1.5" style={isSettlement ? { width: widths.remark } : undefined}>
          {isEditable ? (
            <input value={item.note ?? ''}
              onChange={e => upd(item.id, 'note', e.target.value)}
              placeholder="비고"
              className="w-full text-xs text-gray-400 border border-transparent hover:border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 rounded px-1.5 py-1 focus:outline-none bg-transparent focus:bg-white" />
          ) : (
            <span className="text-xs text-gray-400">{item.note}</span>
          )}
        </td>
      )}
      {isEditable && (
        <td className="no-print sticky right-0 w-8 px-2 py-1.5 bg-white group-hover:bg-gray-50" style={isSettlement ? { width: widths.delete } : undefined}>
          <button onClick={() => del(item.id)} className="text-gray-200 hover:text-red-500 p-1">
            <Trash2 size={12} />
          </button>
        </td>
      )}
    </tr>
  )
})

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [quote, setQuote] = useState<any>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [discount, setDiscount] = useState(0)
  const [rates, setRates] = useState(DEFAULT_RATES)
  const [printMode, setPrintMode] = useState<null | 'client' | 'internal'>(null)
  const [minProfitRate, setMinProfitRate] = useState<number | null>(null)
  const [worktypeMemos, setWorktypeMemos] = useState<Record<string, string>>({})
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, true]))
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY)
      if (saved) return JSON.parse(saved)
    } catch {}
    return Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, true]))
  })
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const columnSettingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(visibleColumns)) } catch {}
  }, [visibleColumns])

  useEffect(() => {
    if (!showColumnSettings) return
    const handle = (e: MouseEvent) => {
      if (columnSettingsRef.current && !columnSettingsRef.current.contains(e.target as Node)) {
        setShowColumnSettings(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showColumnSettings])

  useEffect(() => {
    if (!printMode) return
    document.body.classList.remove('print-client', 'print-internal')
    document.body.classList.add(`print-${printMode}`)
    window.print()
    document.body.classList.remove('print-client', 'print-internal')
    setPrintMode(null)
  }, [printMode])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const isSettlement = quote?.type === '정산'
  const isEditable = quote ? !checkReadonly(quote.status) : false
  const { widths: itemResizableWidths, startResize: startItemResize } = useResizableColumns(
    'romentor.quoteItemTable.settlement.colWidths', ITEM_DEFAULT_WIDTHS
  )
  const itemWidths = isSettlement ? itemResizableWidths : ITEM_DEFAULT_WIDTHS
  const showCol = (key: string) => !isSettlement || visibleColumns[key] !== false

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('quotes').select('*, projects(name, min_profit_rate)').eq('id', id).single(),
      sb.from('quote_items').select('*').eq('quote_id', id)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true }),
      sb.from('quote_worktype_memos').select('work_type, memo').eq('quote_id', id)
    ]).then(([{ data: q }, { data: its }, { data: memos }]) => {
      setQuote(q)
      if (q) {
        setMinProfitRate(q.min_profit_rate ?? q.projects?.min_profit_rate ?? null)
        const round2 = (n: number) => Math.round(n * 100) / 100
        if (q.rate_accident_insurance != null) {
          setRates({
            accident: round2(Number(q.rate_accident_insurance) * 100),
            employment: round2(Number(q.rate_employment_insurance) * 100),
            overhead: round2(Number(q.rate_indirect_overhead) * 100),
            profit: round2(Number(q.rate_profit_margin) * 100),
            vat: round2(Number(q.rate_vat) * 100),
          })
        }
        if (q.discount_amount != null) {
          setDiscount(Number(q.discount_amount))
        }
      }
      if (memos) {
        const map: Record<string, string> = {}
        memos.forEach((m: { work_type: string; memo: string }) => { map[m.work_type] = m.memo })
        setWorktypeMemos(map)
      }
      if (its) {
        const sorted = [...its].sort((a, b) => {
          if (a.work_type === '설계비용' && b.work_type !== '설계비용') return -1
          if (b.work_type === '설계비용' && a.work_type !== '설계비용') return 1
          const wtDiff = WORK_ORDER.indexOf(a.work_type as WorkType) - WORK_ORDER.indexOf(b.work_type as WorkType)
          if (wtDiff !== 0) return wtDiff
          const aSo = a.sort_order ?? Infinity
          const bSo = b.sort_order ?? Infinity
          return aSo - bSo
        })
        setItems(sorted)
      }
      setLoading(false)
    })
  }, [id])

  const updateItem = useCallback((itemId: string, key: keyof QuoteItem, value: any) => {
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, [key]: value } : i))
  }, [])

  const deleteItem = useCallback(async (itemId: string) => {
    if (!confirm('이 항목을 삭제할까요?')) return
    await createClient().from('quote_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }, [])

  const addItemAt = useCallback(async (workType: string, afterId: string) => {
    const maxSortOrder = items
      .filter(i => i.work_type === workType)
      .reduce((max, i) => Math.max(max, i.sort_order ?? -1), -1)
    const { data } = await createClient().from('quote_items').insert({
      quote_id: id,
      work_type: workType,
      item_name: '새 항목',
      comment: '',
      unit: '식',
      quantity: 1,
      material_unit_price: 0,
      labor_unit_price: 0,
      note: '',
      sort_order: maxSortOrder + 1,
    }).select().single()
    if (data) {
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === afterId)
        const next = [...prev]
        next.splice(idx + 1, 0, data)
        return next
      })
    }
  }, [id, items])

  const addItem = useCallback(async (workType: string) => {
    const maxSortOrder = items
      .filter(i => i.work_type === workType)
      .reduce((max, i) => Math.max(max, i.sort_order ?? -1), -1)
    const { data } = await createClient().from('quote_items').insert({
      quote_id: id,
      work_type: workType,
      item_name: '새 항목',
      comment: '',
      unit: '식',
      quantity: 1,
      material_unit_price: 0,
      labor_unit_price: 0,
      note: '',
      sort_order: maxSortOrder + 1,
    }).select().single()
    if (data) setItems(prev => [...prev, data])
  }, [id, items])

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems(prev => {
      const dragItem = prev.find(i => i.id === active.id)
      const overItem = prev.find(i => i.id === over.id)
      if (!dragItem || !overItem || dragItem.work_type !== overItem.work_type) return prev
      const wtItems = prev.filter(i => i.work_type === dragItem.work_type)
      const oldIdx = wtItems.findIndex(i => i.id === active.id)
      const newIdx = wtItems.findIndex(i => i.id === over.id)
      const reordered = arrayMove(wtItems, oldIdx, newIdx)
      const result: QuoteItem[] = []
      WORK_ORDER.forEach(wt => {
        result.push(...(wt === dragItem.work_type ? reordered : prev.filter(i => i.work_type === wt)))
      })
      result.push(...prev.filter(i => !WORK_ORDER.includes(i.work_type as any)))
      return result
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const sb = createClient()

      if (isSettlement) {
        const results = await Promise.all(items.map((item, idx) => {
          const effectiveExec = item.actual_execution_amount !== null && item.actual_execution_amount !== undefined
            ? item.actual_execution_amount
            : (item.planned_execution_amount ?? 0)
          return sb.from('quote_items').update({
            item_name: item.item_name,
            comment: item.comment,
            unit: item.unit,
            quantity: item.quantity,
            material_unit_price: item.material_unit_price,
            labor_unit_price: item.labor_unit_price,
            note: item.note,
            sort_order: idx,
            planned_execution_amount: item.planned_execution_amount,
            actual_execution_amount: item.actual_execution_amount,
            execution_amount: effectiveExec,
            execution_date: item.execution_date || null,
          }).eq('id', item.id)
        }))

        const failed = results.filter(r => r.error)
        if (failed.length > 0) {
          alert(`❌ 저장 실패: ${failed[0].error?.message ?? '알 수 없는 오류'}`)
          setSaving(false)
          return
        }

        const memoEntries = Object.entries(worktypeMemos)
          .filter(([, memo]) => memo && memo.trim())
          .map(([work_type, memo]) => ({ quote_id: id, work_type, memo }))
        if (memoEntries.length > 0) {
          await sb.from('quote_worktype_memos')
            .upsert(memoEntries, { onConflict: 'quote_id,work_type' })
        }

        const totalQuote = items.reduce((s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0)
        const totalExec = items.reduce((s, i) => {
          const hasActual = i.actual_execution_amount !== null && i.actual_execution_amount !== undefined
          return s + (hasActual ? i.actual_execution_amount! : (i.planned_execution_amount ?? 0))
        }, 0)
        if (totalExec > 0 && totalQuote > 0) {
          const currentRate = ((totalQuote - totalExec) / totalQuote) * 100
          const smsAlerts: Promise<Response>[] = []
          if (minProfitRate !== null && currentRate < minProfitRate) {
            smsAlerts.push(fetch('/api/sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quoteId: id, type: 'profit_warning' }),
            }))
          }
          if (currentRate < 0) {
            smsAlerts.push(fetch('/api/sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quoteId: id, type: 'total' }),
            }))
          }
          await Promise.all(smsAlerts)

          const workTypeMap: Record<string, { quote: number; actual: number }> = {}
          for (const item of items) {
            const hasActual = item.actual_execution_amount !== null && item.actual_execution_amount !== undefined
            if (!hasActual) continue
            const actual = item.actual_execution_amount!
            if (!workTypeMap[item.work_type]) workTypeMap[item.work_type] = { quote: 0, actual: 0 }
            workTypeMap[item.work_type].quote += (item.material_unit_price + item.labor_unit_price) * item.quantity
            workTypeMap[item.work_type].actual += actual
          }
          const minusWorkTypes = Object.entries(workTypeMap)
            .filter(([, v]) => v.quote - v.actual < 0)
            .map(([name, v]) => ({ name, profit: v.quote - v.actual }))
          if (minusWorkTypes.length > 0) {
            await fetch('/api/sms', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quoteId: id, type: 'item_minus', items: minusWorkTypes }),
            })
          }
        }
      } else {
        const results = await Promise.all(items.map((item, idx) =>
          sb.from('quote_items').update({
            item_name: item.item_name,
            comment: item.comment,
            unit: item.unit,
            quantity: item.quantity,
            material_unit_price: item.material_unit_price,
            labor_unit_price: item.labor_unit_price,
            execution_amount: item.execution_amount ?? 0,
            note: item.note,
            sort_order: idx,
          }).eq('id', item.id)
        ))

        const failed = results.filter(r => r.error)
        if (failed.length > 0) {
          console.error('저장 실패:', failed.map(r => r.error))
          alert(`❌ 저장 실패: ${failed[0].error?.message ?? '알 수 없는 오류'}`)
          setSaving(false)
          return
        }
      }

      await sb.from('quotes').update({
        rate_accident_insurance: rates.accident / 100,
        rate_employment_insurance: rates.employment / 100,
        rate_indirect_overhead: rates.overhead / 100,
        rate_profit_margin: rates.profit / 100,
        rate_vat: rates.vat / 100,
        discount_amount: discount || 0,
        ...(isSettlement && { min_profit_rate: minProfitRate ?? 15 }),
      }).eq('id', id)

      // trg_quotes_discount(BEFORE trigger)가 discount_amount 변경 시 final_amount를
      // 하드코딩 요율로 덮어쓰므로, 별도 UPDATE로 커스텀 요율 기반 정확한 값을 재기록
      const { finalAmount } = calcFinalAmount({ items, rates, discount: discount || 0 })
      await sb.from('quotes').update({ final_amount: finalAmount }).eq('id', id)

      setSaving(false)
      alert('✅ 저장됐습니다.')
    } catch (err) {
      console.error('저장 중 예외:', err)
      alert('❌ 저장 중 오류가 발생했습니다.')
      setSaving(false)
    }
  }

  const handleDeploy = async () => {
    if (!confirm('배포하면 이 견적서는 수정이 불가능합니다. 배포하시겠습니까?')) return
    await createClient().from('quotes').update({ status: '배포' }).eq('id', id)
    setQuote((prev: any) => ({ ...prev, status: '배포' }))
  }

  const handleContract = async () => {
    if (!confirm('계약 처리하면 이 견적서는 수정이 불가능합니다. 계약 처리하시겠습니까?')) return
    await createClient().from('quotes').update({ status: '계약' }).eq('id', id)
    setQuote((prev: any) => ({ ...prev, status: '계약' }))
  }

  const handleCreateSettlement = async () => {
    if (!confirm('계약 견적서를 복사해서 정산견적서를 생성합니다. 진행하시겠습니까?')) return
    const sb = createClient()
    let newQuote: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const quoteNumber = await generateQuoteNumber(sb)
      const { data, error } = await sb.from('quotes').insert({
        project_id: quote.project_id,
        quote_number: quoteNumber,
        status: '정산',
        type: '정산',
        note: '정산견적서',
        min_profit_rate: quote.min_profit_rate,
      }).select().single()
      if (data) { newQuote = data; break }
      if ((error as any)?.code !== '23505') break
    }
    if (!newQuote) { alert('정산견적서 생성 실패'); return }

    const { data: srcItems } = await sb.from('quote_items').select('*').eq('quote_id', id)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
    if (srcItems && srcItems.length > 0) {
      await sb.from('quote_items').insert(
        srcItems.map((item, idx) => ({
          quote_id: newQuote.id,
          work_type: item.work_type,
          item_name: item.item_name,
          comment: item.comment,
          unit: item.unit,
          quantity: item.quantity,
          material_unit_price: item.material_unit_price,
          labor_unit_price: item.labor_unit_price,
          note: item.note,
          sort_order: idx,
          planned_execution_amount: item.planned_execution_amount,
          actual_execution_amount: item.actual_execution_amount,
        }))
      )
    }
    router.push('/quotes/' + newQuote.id)
  }

  const grouped = WORK_ORDER
    .map(wt => ({ wt, items: items.filter(i => i.work_type === wt) }))
    .filter(g => isEditable || g.items.length > 0)

  const fmt = (n: number) => n.toLocaleString()

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  const statusBadgeClass = QUOTE_STATUS_COLOR[quote?.status as keyof typeof QUOTE_STATUS_COLOR] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="p-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900">{quote?.projects?.name ?? '프로젝트 없음'}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass}`}>
                {quote?.status}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">
              {quote?.note && <span className="mr-3">{quote.note}</span>}
              {quote?.created_at && new Date(quote.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={() => setPrintMode('client')}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Printer size={15} /> 고객용 인쇄
          </button>
          <button onClick={() => setPrintMode('internal')}
            className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
            <Printer size={15} /> 내부용 인쇄
          </button>
          {quote?.status === '작성중' && (
            <>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                <Save size={15} /> {saving ? '저장 중...' : '저장'}
              </button>
              <button onClick={handleDeploy}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
                <Send size={15} /> 배포하기
              </button>
            </>
          )}
          {quote?.status === '배포' && (
            <button onClick={handleContract}
              className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700">
              계약하기
            </button>
          )}
          {quote?.status === '계약' && (
            <button onClick={handleCreateSettlement}
              className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
              정산견적 생성
            </button>
          )}
          {quote?.status === '정산' && (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Save size={15} /> {saving ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
      </div>

      {/* 읽기전용 배너 */}
      {checkReadonly(quote?.status ?? '') && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-800">
          이 견적서는 <strong>{quote?.status}</strong> 상태로 읽기 전용입니다.
        </div>
      )}

      {/* 견적 합계표 */}
      <QuoteSummaryTable
        items={items}
        rates={rates}
        discount={discount}
        open={summaryOpen}
        onToggle={() => setSummaryOpen(v => !v)}
        isEditable={isEditable}
        isContract={isSettlement}
        minProfitRate={minProfitRate ?? undefined}
        onMinProfitRateChange={v => setMinProfitRate(v)}
        onRateChange={(key, value) => setRates(r => ({ ...r, [key]: value }))}
        onDiscountChange={setDiscount}
        worktypeMemos={worktypeMemos}
        onWorktypeMemoChange={(wt, memo) => setWorktypeMemos(prev => ({ ...prev, [wt]: memo }))}
      />

      {/* 컬럼 설정 */}
      {isSettlement && (
        <div className="no-print flex justify-end mb-3">
          <div className="relative" ref={columnSettingsRef}>
            <button
              onClick={() => setShowColumnSettings(v => !v)}
              className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-1.5 text-gray-600"
            >
              <span>⚙</span> 컬럼 설정
            </button>
            {showColumnSettings && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 min-w-[180px] z-50">
                <div className="text-xs text-gray-500 mb-2 pb-2 border-b">표시할 컬럼 선택</div>
                {TOGGLEABLE_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-50 px-1 rounded">
                    <input
                      type="checkbox"
                      checked={visibleColumns[col.key] ?? true}
                      onChange={e => setVisibleColumns(prev => ({ ...prev, [col.key]: e.target.checked }))}
                    />
                    <span className="text-sm text-gray-700">{col.label}</span>
                  </label>
                ))}
                <div className="mt-2 pt-2 border-t">
                  <button
                    onClick={() => setVisibleColumns(Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, true])))}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    모두 표시
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 공종별 테이블 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="space-y-4">
          {grouped.map(({ wt, items: gItems }) => (
            <div key={wt} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-2.5 flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${WORK_TYPE_COLOR[wt as WorkType] ?? 'bg-gray-100 text-gray-600'}`}>{wt}</span>
                <span className="text-xs text-gray-400">{gItems.length}개</span>
                {isSettlement && (() => {
                  const actualCount = gItems.filter(i => i.actual_execution_amount !== null && i.actual_execution_amount !== undefined).length
                  return <span className="text-xs text-gray-400 ml-1">{actualCount}/{gItems.length} 실입력</span>
                })()}
                {isEditable && (
                  <button onClick={() => addItem(wt)}
                    className="no-print text-xs text-gray-400 hover:text-blue-600 flex items-center gap-1 ml-auto">
                    <Plus size={12} /> 항목 추가
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className={`w-full text-sm min-w-[1000px]${isSettlement ? ' table-fixed' : ''}`}>
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 w-48${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.item_name } : undefined}>
                        항목명
                        {isSettlement && <ResizeHandle columnKey="item_name" onMouseDown={startItemResize} />}
                      </th>
                      {showCol('comment') && (
                        <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 w-56${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.comment } : undefined}>
                          Comment
                          {isSettlement && <ResizeHandle columnKey="comment" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('unit') && (
                        <th className={`px-3 py-2 text-center text-xs font-semibold text-gray-500 w-12${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.unit } : undefined}>
                          단위
                          {isSettlement && <ResizeHandle columnKey="unit" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('quantity') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-gray-500 w-16${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.quantity } : undefined}>
                          수량
                          {isSettlement && <ResizeHandle columnKey="quantity" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('material_unit_price') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-blue-500 w-28${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.material_unit_price } : undefined}>
                          재료단가
                          {isSettlement && <ResizeHandle columnKey="material_unit_price" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('material_amount') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-blue-600 w-28 bg-blue-50${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.material_amount } : undefined}>
                          재료금액
                          {isSettlement && <ResizeHandle columnKey="material_amount" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('labor_unit_price') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-amber-500 w-28${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.labor_unit_price } : undefined}>
                          노무단가
                          {isSettlement && <ResizeHandle columnKey="labor_unit_price" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('labor_amount') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-amber-600 w-28 bg-amber-50${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.labor_amount } : undefined}>
                          노무금액
                          {isSettlement && <ResizeHandle columnKey="labor_amount" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('total_unit_price') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-gray-500 w-24${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.total_unit_price } : undefined}>
                          합계단가
                          {isSettlement && <ResizeHandle columnKey="total_unit_price" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {showCol('total_amount') && (
                        <th className={`px-3 py-2 text-right text-xs font-semibold text-gray-700 w-28${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.total_amount } : undefined}>
                          합계금액
                          {isSettlement && <ResizeHandle columnKey="total_amount" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {isSettlement && (
                        <>
                          {showCol('planned_execution') && (
                            <th className="internal-only px-3 py-2 text-right text-xs font-semibold text-violet-500 relative" style={{ width: itemWidths.planned_execution }}>
                              예상실행가
                              <ResizeHandle columnKey="planned_execution" onMouseDown={startItemResize} />
                            </th>
                          )}
                          {showCol('execution_date') && (
                            <th className="internal-only px-3 py-2 text-center text-xs font-semibold text-blue-400 relative" style={{ width: itemWidths.execution_date }}>
                              지출일
                              <ResizeHandle columnKey="execution_date" onMouseDown={startItemResize} />
                            </th>
                          )}
                          {showCol('actual_execution') && (
                            <th className="internal-only px-3 py-2 text-right text-xs font-semibold text-red-500 relative" style={{ width: itemWidths.actual_execution }}>
                              실제실행가
                              <ResizeHandle columnKey="actual_execution" onMouseDown={startItemResize} />
                            </th>
                          )}
                          {showCol('profit') && (
                            <th className="internal-only px-3 py-2 text-right text-xs font-semibold text-green-500 relative" style={{ width: itemWidths.profit }}>
                              이윤
                              <ResizeHandle columnKey="profit" onMouseDown={startItemResize} />
                            </th>
                          )}
                          {showCol('profit_rate') && (
                            <th className="internal-only px-3 py-2 text-right text-xs font-semibold text-green-500 relative" style={{ width: itemWidths.profit_rate }}>
                              이윤율
                              <ResizeHandle columnKey="profit_rate" onMouseDown={startItemResize} />
                            </th>
                          )}
                        </>
                      )}
                      {showCol('remark') && (
                        <th className={`px-3 py-2 text-left text-xs font-semibold text-gray-500${isSettlement ? ' relative' : ''}`} style={isSettlement ? { width: itemWidths.remark } : undefined}>
                          비고
                          {isSettlement && <ResizeHandle columnKey="remark" onMouseDown={startItemResize} />}
                        </th>
                      )}
                      {isEditable && <th className="no-print sticky right-0 bg-gray-50 w-8 z-10" style={isSettlement ? { width: itemWidths.delete } : undefined}></th>}
                    </tr>
                  </thead>
                  <SortableContext items={gItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    <tbody className="divide-y divide-gray-50">
                      {gItems.map(item => (
                        <SortableItemRow
                          key={item.id}
                          item={item}
                          isEditable={isEditable}
                          isSettlement={isSettlement}
                          minProfitRate={minProfitRate}
                          upd={updateItem}
                          del={deleteItem}
                          addItemAt={addItemAt}
                          widths={itemWidths}
                          visibleColumns={visibleColumns}
                        />
                      ))}
                      {(() => {
                        const groupQuote = gItems.reduce((s, i) => s + (i.material_unit_price + i.labor_unit_price) * i.quantity, 0)
                        const groupPlanned = gItems.reduce((s, i) => s + (i.planned_execution_amount ?? 0), 0)
                        const groupActual = gItems.reduce((s, i) => s + (i.actual_execution_amount ?? 0), 0)
                        const groupEffective = gItems.reduce((s, i) => {
                          const qa = (i.material_unit_price + i.labor_unit_price) * i.quantity
                          return s + calcEffectiveExec(i.actual_execution_amount, qa, minProfitRate, isSettlement).value
                        }, 0)
                        const groupIsComplete = isGroupComplete(gItems)
                        const groupProfit: number | null = (groupIsComplete || groupEffective > 0) ? groupQuote - groupEffective : null
                        const groupProfitRate: number | null = groupProfit !== null && groupQuote > 0 ? (groupProfit / groupQuote) * 100 : null
                        const leadingSpan = 1 + (['comment', 'unit', 'quantity'] as const).filter(k => showCol(k)).length
                        const trailingSpan = (showCol('remark') ? 1 : 0) + (isEditable ? 1 : 0)
                        return (
                          <tr className="bg-gray-50 border-t-2 border-gray-200">
                            <td colSpan={leadingSpan} className="px-3 py-2 text-xs font-bold text-gray-700 text-right">{wt} 합계</td>
                            {showCol('material_unit_price') && <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>}
                            {showCol('material_amount') && (
                              <td className="px-3 py-2 text-xs text-right text-blue-700 font-bold bg-blue-50/40">
                                {fmt(gItems.reduce((s, i) => s + i.material_unit_price * i.quantity, 0))}
                              </td>
                            )}
                            {showCol('labor_unit_price') && <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>}
                            {showCol('labor_amount') && (
                              <td className="px-3 py-2 text-xs text-right text-amber-700 font-bold bg-amber-50/40">
                                {fmt(gItems.reduce((s, i) => s + i.labor_unit_price * i.quantity, 0))}
                              </td>
                            )}
                            {showCol('total_unit_price') && <td className="px-3 py-2 text-xs text-gray-400 text-right">-</td>}
                            {showCol('total_amount') && (
                              <td className="px-3 py-2 text-xs text-right font-bold text-gray-800 bg-gray-100">
                                {fmt(groupQuote)}
                              </td>
                            )}
                            {isSettlement && (
                              <>
                                {showCol('planned_execution') && (
                                  <td className="internal-only px-3 py-2 text-xs text-right text-violet-600 font-bold">
                                    {groupPlanned > 0 ? fmt(groupPlanned) : '-'}
                                  </td>
                                )}
                                {showCol('execution_date') && <td className="internal-only px-3 py-2 text-xs text-gray-300 text-right">-</td>}
                                {showCol('actual_execution') && (
                                  <td className="internal-only px-3 py-2 text-xs text-right text-red-600 font-bold">
                                    {groupIsComplete || groupActual > 0 ? fmt(groupActual) : '-'}
                                  </td>
                                )}
                                {showCol('profit') && (
                                  <td className={`internal-only px-3 py-2 text-xs text-right font-bold ${
                                    groupProfit === null ? 'text-gray-300' :
                                    !groupIsComplete ? 'text-gray-400 italic' :
                                    groupProfit < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                  }`}>
                                    {groupProfit !== null ? (groupProfit >= 0 ? '+' : '') + fmt(groupProfit) : '-'}
                                  </td>
                                )}
                                {showCol('profit_rate') && (
                                  <td className={`internal-only px-3 py-2 text-xs text-right font-bold ${
                                    groupProfitRate === null ? 'text-gray-300' :
                                    !groupIsComplete ? 'text-gray-400 italic' :
                                    groupProfitRate < 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                                  }`}>
                                    {groupProfitRate !== null ? groupProfitRate.toFixed(1) + '%' : '-'}
                                  </td>
                                )}
                              </>
                            )}
                            {trailingSpan > 0 && <td colSpan={trailingSpan}></td>}
                          </tr>
                        )
                      })()}
                    </tbody>
                  </SortableContext>
                </table>
              </div>
            </div>
          ))}
        </div>
      </DndContext>

      {/* 하단 저장 버튼 */}
      {isEditable && (
        <div className="no-print flex gap-3 mt-8">
          <button onClick={handleSave} disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? '저장 중...' : '견적서 저장'}
          </button>
          {quote?.status === '작성중' && (
            <button onClick={handleDeploy}
              className="bg-purple-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-purple-700">
              배포하기
            </button>
          )}
          <button onClick={() => router.back()}
            className="bg-gray-100 text-gray-600 px-8 py-3 rounded-lg font-medium hover:bg-gray-200">
            목록으로
          </button>
        </div>
      )}
    </div>
  )
}
