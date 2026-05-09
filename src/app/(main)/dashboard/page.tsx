'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import { TrendingUp, TrendingDown, FileText, AlertTriangle, CreditCard, Bell } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

function Section({ title, count, borderColor, titleColor, icon, rightLink, children }: {
  title: string
  count?: number
  borderColor: string
  titleColor: string
  icon: React.ReactNode
  rightLink?: { href: string; label: string }
  children: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${borderColor} mb-6`}>
      <div className={`flex items-center justify-between p-5 border-b ${borderColor}`}>
        <div className="flex items-center gap-2">
          {icon}
          <h3 className={`font-semibold ${titleColor}`}>
            {title}{count !== undefined ? ` (${count}건)` : ''}
          </h3>
        </div>
        {rightLink && (
          <Link href={rightLink.href} className="text-blue-600 text-sm hover:underline">
            {rightLink.label}
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  )
}

function EmptyMessage({ text }: { text: string }) {
  return <p className="p-6 text-center text-gray-400 text-sm">{text}</p>
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-5 py-3 text-xs font-semibold text-gray-500 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<any[]>([])
  const [quoteItems, setQuoteItems] = useState<any[]>([])
  const [minusAlerts, setMinusAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createClient()

      const [{ data: quotesData }, { data: alertsData }] = await Promise.all([
        sb.from('quotes')
          .select('id, project_id, quote_number, note, total_quote_amount, total_profit, total_profit_rate, payment_due_date, created_at, projects(id, name)')
          .eq('type', '정산')
          .order('created_at', { ascending: false }),
        sb.from('sms_alerts')
          .select('id, quote_id, message, sent_at, status, type, quotes(note)')
          .eq('type', 'item_minus')
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(10),
      ])

      const loadedQuotes = quotesData ?? []
      const quoteIds = loadedQuotes.map((q: any) => q.id)

      let items: any[] = []
      if (quoteIds.length > 0) {
        const { data } = await sb
          .from('quote_items')
          .select('id, quote_id, work_type, item_name, profit, actual_execution_amount')
          .in('quote_id', quoteIds)
        items = data ?? []
      }

      setQuotes(loadedQuotes)
      setQuoteItems(items)
      setMinusAlerts(alertsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // 파생 데이터
  const quoteMap = Object.fromEntries(quotes.map(q => [q.id, q]))

  const totalContracts = quotes.length
  const totalQuoteAmount = quotes.reduce((s, q) => s + Number(q.total_quote_amount ?? 0), 0)
  const totalProfit = quotes.reduce((s, q) => s + Number(q.total_profit ?? 0), 0)
  const negativeItems = quoteItems.filter(i => Number(i.profit) < 0)
  const minusAlertsCount = minusAlerts.length

  // 입금 예정일: payment_due_date 있고 오늘~7일 이내
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const paymentDueQuotes = quotes
    .filter(q => q.payment_due_date)
    .map(q => {
      const due = new Date(q.payment_due_date + 'T00:00:00')
      const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { ...q, diffDays }
    })
    .filter(q => q.diffDays <= 7)
    .sort((a, b) => a.diffDays - b.diffDays)

  const recentQuotes = quotes.slice(0, 5)

  // 핸들러
  const handleSendItemSms = async (item: any) => {
    if (!confirm('마이너스 항목 알림을 발송할까요?')) return
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: item.quote_id, type: 'item', itemId: item.id }),
    })
    alert(res.ok ? '문자가 발송됐습니다.' : '발송 실패')
  }

  const handleResendAlert = async (a: any) => {
    if (!confirm('마이너스 공정 알림을 재발송할까요?')) return
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: a.quote_id, type: 'item_minus', items: [] }),
    })
    alert(res.ok ? '재발송됐습니다.' : '재발송 실패')
  }

  const handleSendPaymentSms = async (quote: any) => {
    if (!confirm('입금 알림을 발송할까요?')) return
    const res = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quoteId: quote.id, type: 'payment' }),
    })
    alert(res.ok ? '문자가 발송됐습니다.' : '발송 실패')
  }

  const ddayLabel = (d: number) => d < 0 ? `D+${Math.abs(d)}` : `D-${d}`
  const ddayColor = (d: number) =>
    d <= 0 ? 'text-red-600 font-bold' : d <= 3 ? 'text-orange-600 font-bold' : 'text-yellow-600 font-bold'

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-gray-500 text-sm mt-1">계약견적서 기준 현황</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {[
          { label: '계약 건수',       value: `${totalContracts}건`,          color: 'blue',   icon: FileText,                                          bold: false },
          { label: '총 견적금액',     value: formatKRW(totalQuoteAmount),    color: 'green',  icon: TrendingUp,                                        bold: false },
          { label: '총 이윤',         value: formatKRW(totalProfit),         color: totalProfit >= 0 ? 'emerald' : 'red', icon: totalProfit >= 0 ? TrendingUp : TrendingDown, bold: false },
          { label: '마이너스 항목',   value: `${negativeItems.length}건`,    color: 'orange', icon: AlertTriangle,                                     bold: false },
          { label: '마이너스 공정 알림', value: `${minusAlertsCount}건`,     color: 'red',    icon: Bell,                                              bold: true  },
        ].map(({ label, value, color, icon: Icon, bold }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className={`inline-flex p-2 rounded-lg bg-${color}-50 mb-3`}>
              <Icon size={20} className={`text-${color}-600`} />
            </div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className={`text-lg font-bold mt-1 ${bold ? `text-${color}-600` : 'text-gray-900'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 섹션 1: 마이너스 항목 */}
      <Section
        title="마이너스 항목"
        count={negativeItems.length}
        borderColor="border-orange-100"
        titleColor="text-orange-700"
        icon={<AlertTriangle size={16} className="text-orange-500" />}
      >
        {negativeItems.length === 0 ? (
          <EmptyMessage text="마이너스 항목이 없습니다 👍" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <Th>프로젝트</Th>
                <Th>공정</Th>
                <Th>항목명</Th>
                <Th right>이윤</Th>
                <Th right>문자발송</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {negativeItems.map(item => {
                const q = quoteMap[item.quote_id]
                const projectName = (q?.projects as any)?.name ?? '-'
                return (
                  <tr key={item.id} className="hover:bg-orange-50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-gray-900">{projectName}</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{item.work_type}</td>
                    <td className="px-5 py-3 text-xs text-gray-700">{item.item_name}</td>
                    <td className="px-5 py-3 text-right text-sm font-bold text-red-600">
                      {formatKRW(Number(item.profit))}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleSendItemSms(item)}
                        className="text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                        📱 문자발송
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>

      {/* 섹션 2: 마이너스 공정 알림 */}
      <Section
        title="마이너스 공정 알림"
        count={minusAlertsCount}
        borderColor="border-red-100"
        titleColor="text-red-700"
        icon={<AlertTriangle size={16} className="text-red-500" />}
      >
        {minusAlerts.length === 0 ? (
          <EmptyMessage text="마이너스 공정 알림이 없습니다 👍" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <Th>견적명</Th>
                <Th>발생일</Th>
                <Th right>재발송</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {minusAlerts.map(a => (
                <tr key={a.id} className="hover:bg-red-50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/quotes/${a.quote_id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">
                      {(a.quotes as any)?.note || a.quote_id}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-400">
                    {new Date(a.sent_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleResendAlert(a)}
                      className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      📱 재발송
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 섹션 3: 입금 예정일 알림 */}
      <Section
        title="입금 예정일 알림"
        count={paymentDueQuotes.length}
        borderColor="border-blue-100"
        titleColor="text-blue-700"
        icon={<CreditCard size={16} className="text-blue-500" />}
      >
        {paymentDueQuotes.length === 0 ? (
          <EmptyMessage text="입금 예정일 데이터가 없습니다" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <Th>프로젝트</Th>
                <Th>견적명</Th>
                <Th>입금 예정일</Th>
                <Th>D-day</Th>
                <Th right>문자발송</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paymentDueQuotes.map(q => (
                <tr key={q.id} className="hover:bg-blue-50 transition-colors">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {(q.projects as any)?.name ?? '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    <Link href={`/quotes/${q.id}`} className="hover:text-blue-600">
                      {q.note || q.quote_number}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {new Date(q.payment_due_date + 'T00:00:00').toLocaleDateString('ko-KR')}
                  </td>
                  <td className={`px-5 py-3 text-sm ${ddayColor(q.diffDays)}`}>
                    {ddayLabel(q.diffDays)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleSendPaymentSms(q)}
                      className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      📱 문자발송
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* 섹션 4: 최근 계약 견적서 */}
      <Section
        title="최근 계약 견적서"
        borderColor="border-gray-100"
        titleColor="text-gray-700"
        icon={<FileText size={16} className="text-gray-500" />}
        rightLink={{ href: '/quotes', label: '전체보기' }}
      >
        {recentQuotes.length === 0 ? (
          <EmptyMessage text="계약 견적서가 없습니다 👍" />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <Th>견적번호</Th>
                <Th>프로젝트</Th>
                <Th right>견적금액</Th>
                <Th right>이윤</Th>
                <Th right>이윤율</Th>
                <Th right>날짜</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentQuotes.map(q => (
                <tr
                  key={q.id}
                  onClick={() => router.push(`/quotes/${q.id}`)}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3 text-sm font-mono text-gray-700">{q.quote_number}</td>
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">
                    {(q.projects as any)?.name ?? '-'}
                  </td>
                  <td className="px-5 py-3 text-right text-sm text-gray-700">
                    {formatKRW(Number(q.total_quote_amount))}
                  </td>
                  <td className={`px-5 py-3 text-right text-sm font-semibold ${Number(q.total_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatKRW(Number(q.total_profit))}
                  </td>
                  <td className={`px-5 py-3 text-right text-sm font-semibold ${Number(q.total_profit_rate) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {Number(q.total_profit_rate).toFixed(1)}%
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-gray-400">
                    {new Date(q.created_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
