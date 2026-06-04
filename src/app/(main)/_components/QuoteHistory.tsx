'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ACTION_LABEL: Record<string, string> = { INSERT: '생성', UPDATE: '수정', DELETE: '삭제' }

interface Row { id: number; action: string; changed_by: string | null; changed_at: string }

export default function QuoteHistory({ quoteId }: { quoteId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const sb = createClient()
    sb.from('quote_history')
      .select('id, action, changed_by, changed_at')
      .eq('quote_id', quoteId)
      .order('changed_at', { ascending: false })
      .then(async ({ data, error }) => {
        // quote_history 미적용(테이블 없음) 시 error → 빈 목록
        if (error || !data) { setRows([]); return }
        setRows(data as Row[])
        const ids = [...new Set(data.map(r => r.changed_by).filter(Boolean) as string[])]
        if (ids.length) {
          const { data: profs } = await sb.from('profiles').select('id, name').in('id', ids)
          if (profs) setNames(Object.fromEntries(profs.map(p => [p.id, p.name])))
        }
      })
  }, [quoteId])

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mt-6 no-print">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">변경 이력</h3>
      {rows === null ? (
        <p className="text-xs text-gray-400">불러오는 중…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-400">이력이 없습니다.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map(r => (
            <li key={r.id} className="flex items-center gap-3 text-xs">
              <span className="text-gray-400 w-40 shrink-0">{new Date(r.changed_at).toLocaleString('ko-KR')}</span>
              <span className={`px-1.5 py-0.5 rounded font-medium ${
                r.action === 'DELETE' ? 'bg-red-50 text-red-600'
                : r.action === 'INSERT' ? 'bg-green-50 text-green-600'
                : 'bg-blue-50 text-blue-600'
              }`}>{ACTION_LABEL[r.action] ?? r.action}</span>
              <span className="text-gray-700">{names[r.changed_by ?? ''] ?? (r.changed_by ? r.changed_by.slice(0, 8) : '시스템')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
