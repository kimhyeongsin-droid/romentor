'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, MessageSquare, Bell, AlertTriangle, CreditCard } from 'lucide-react'
import Link from 'next/link'

const TYPE_LABEL: Record<string, { label: string; icon: any; color: string }> = {
  total:   { label: '마이너스 전체', icon: AlertTriangle, color: 'bg-red-100 text-red-700' },
  item:    { label: '마이너스 공정', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700' },
  payment: { label: '입금 알림',    icon: CreditCard,    color: 'bg-blue-100 text-blue-700' },
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'total' | 'item' | 'payment'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/alert-logs')
      .then(r => r.json())
      .then(data => {
        setAlerts(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = filter === 'all' ? alerts : alerts.filter(a => {
    if (filter === 'payment') return a.message?.includes('입금')
    if (filter === 'total') return a.message?.includes('마이너스 발생')
    if (filter === 'item') return a.message?.includes('마이너스 공정')
    return true
  })

  const counts = {
    all: alerts.length,
    total: alerts.filter(a => a.message?.includes('마이너스 발생')).length,
    item: alerts.filter(a => a.message?.includes('마이너스 공정')).length,
    payment: alerts.filter(a => a.message?.includes('입금')).length,
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">알람 로그</h2>
        <p className="text-gray-500 text-sm mt-1">문자 발송 내역을 확인하세요</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { key: 'all',     label: '전체 발송',    color: 'blue',    icon: MessageSquare },
          { key: 'total',   label: '마이너스 전체', color: 'red',     icon: AlertTriangle },
          { key: 'item',    label: '마이너스 공정', color: 'orange',  icon: AlertTriangle },
          { key: 'payment', label: '입금 알림',     color: 'emerald', icon: CreditCard },
        ].map(({ key, label, color, icon: Icon }) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md
              ${filter === key ? `border-${color}-400 shadow-md` : 'border-gray-100'}`}>
            <div className={`inline-flex p-2 rounded-lg bg-${color}-50 mb-2`}>
              <Icon size={16} className={`text-${color}-600`} />
            </div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 text-${color}-600`}>{counts[key as keyof typeof counts]}</p>
          </button>
        ))}
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: '전체' },
          { key: 'total', label: '마이너스 전체' },
          { key: 'item', label: '마이너스 공정' },
          { key: 'payment', label: '입금 알림' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key as any)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
              ${filter === key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 알람 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <p>불러오는 중...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p>알람 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((a) => {
              const isPayment = a.message?.includes('입금')
              const isTotal = a.message?.includes('마이너스 발생')
              const typeKey = isPayment ? 'payment' : isTotal ? 'total' : 'item'
              const typeInfo = TYPE_LABEL[typeKey]
              const Icon = typeInfo.icon

              return (
                <div key={a.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${typeInfo.color} mt-0.5`}>
                    <Icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {a.quotes?.projects?.name && (
                        <Link href={`/projects/${a.quotes?.project_id}`}
                          className="text-xs text-blue-600 hover:underline font-medium">
                          {a.quotes.projects.name}
                        </Link>
                      )}
                      {a.quotes?.quote_number && (
                        <Link href={`/quotes/${a.quote_id}`}
                          className="text-xs text-gray-400 hover:underline font-mono">
                          {a.quotes.quote_number}
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                      {a.message}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="flex items-center gap-1 justify-end mb-1">
                      {a.status === 'sent'
                        ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium">
                            <CheckCircle size={12} /> 발송완료
                          </span>
                        : <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                            <XCircle size={12} /> 실패
                          </span>
                      }
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{a.recipient_phone}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {a.sent_at ? new Date(a.sent_at).toLocaleString('ko-KR') : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
