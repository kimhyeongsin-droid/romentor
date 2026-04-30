'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatKRW } from '@/lib/utils'
import { TrendingUp, TrendingDown, FileText, AlertTriangle, Building2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentQuotes, setRecentQuotes] = useState<any[]>([])
  const [negativeProjects, setNegativeProjects] = useState<any[]>([])
  const [negativeItems, setNegativeItems] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const [{ count: pCount }, { count: qCount }, { data: quotes }, { data: items }] = await Promise.all([
        sb.from('projects').select('*', { count: 'exact', head: true }),
        sb.from('quotes').select('*', { count: 'exact', head: true }),
        sb.from('quotes').select('*, projects(name, manager_name)').order('created_at', { ascending: false }).limit(5),
        sb.from('quote_items').select('*, quotes(id, quote_number, project_id, projects(name, manager_name, manager_phone))'),
      ])

      const totalQuoteAmount = items?.reduce((s, i) => s + Number(i.quote_amount), 0) ?? 0
      const totalProfit = items?.reduce((s, i) => s + Number(i.profit), 0) ?? 0
      const negCount = items?.filter(i => Number(i.profit) < 0).length ?? 0

      setStats({ totalProjects: pCount ?? 0, totalQuotes: qCount ?? 0, totalQuoteAmount, totalProfit, negativeItems: negCount })
      setRecentQuotes(quotes ?? [])

      // 마이너스 항목
      const negItems = (items ?? []).filter(i => Number(i.profit) < 0)
      setNegativeItems(negItems)

      // 마이너스 프로젝트 (프로젝트별로 이윤 합산)
      const projectMap: Record<string, any> = {}
      for (const item of items ?? []) {
        const pid = item.quotes?.project_id
        if (!pid) continue
        if (!projectMap[pid]) {
          projectMap[pid] = {
            project_id: pid,
            project_name: item.quotes?.projects?.name,
            manager_name: item.quotes?.projects?.manager_name,
            manager_phone: item.quotes?.projects?.manager_phone,
            total_profit: 0,
          }
        }
        projectMap[pid].total_profit += Number(item.profit)
      }
      const negProjects = Object.values(projectMap).filter(p => p.total_profit < 0)
      setNegativeProjects(negProjects)
    }
    load()
  }, [])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>
        <p className="text-gray-500 text-sm mt-1">로멘토 인테리어 견적 현황</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {stats && [
          { label: '전체 프로젝트', value: `${stats.totalProjects}건`, color: 'blue', icon: Building2 },
          { label: '전체 견적', value: `${stats.totalQuotes}건`, color: 'indigo', icon: FileText },
          { label: '총 견적금액', value: formatKRW(stats.totalQuoteAmount), color: 'green', icon: TrendingUp },
          { label: '총 이윤', value: formatKRW(stats.totalProfit), color: stats.totalProfit >= 0 ? 'emerald' : 'red', icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown },
          { label: '마이너스 항목', value: `${stats.negativeItems}건`, color: 'orange', icon: AlertTriangle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className={`inline-flex p-2 rounded-lg bg-${color}-50 mb-3`}>
              <Icon size={20} className={`text-${color}-600`} />
            </div>
            <p className="text-xs text-gray-500 font-medium">{label}</p>
            <p className="text-lg font-bold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 마이너스 프로젝트 */}
        <div className="bg-white rounded-xl shadow-sm border border-red-100">
          <div className="flex items-center gap-2 p-5 border-b border-red-100">
            <AlertTriangle size={16} className="text-red-500" />
            <h3 className="font-semibold text-red-700">마이너스 프로젝트 ({negativeProjects.length}건)</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {negativeProjects.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">마이너스 프로젝트가 없습니다 👍</p>
            ) : negativeProjects.map((p) => (
              <Link key={p.project_id} href={`/projects/${p.project_id}`}
                className="flex items-center justify-between p-4 hover:bg-red-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.project_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.manager_name} · {p.manager_phone}</p>
                </div>
                <p className="text-sm font-bold text-red-600">{formatKRW(p.total_profit)}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* 마이너스 항목 */}
        <div className="bg-white rounded-xl shadow-sm border border-orange-100">
          <div className="flex items-center gap-2 p-5 border-b border-orange-100">
            <AlertTriangle size={16} className="text-orange-500" />
            <h3 className="font-semibold text-orange-700">마이너스 항목 ({negativeItems.length}건)</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {negativeItems.length === 0 ? (
              <p className="p-6 text-center text-gray-400 text-sm">마이너스 항목이 없습니다 👍</p>
            ) : negativeItems.map((item) => (
              <Link key={item.id} href={`/quotes/${item.quote_id}`}
                className="flex items-center justify-between p-4 hover:bg-orange-50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.item_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.quotes?.projects?.name} · {item.work_type} · {item.quotes?.quote_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">{formatKRW(Number(item.profit))}</p>
                  <p className="text-xs text-red-400">{Number(item.profit_rate).toFixed(1)}%</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 최근 견적 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">최근 견적</h3>
          <Link href="/quotes" className="text-blue-600 text-sm hover:underline">전체보기</Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentQuotes.length === 0 && (
            <p className="p-6 text-center text-gray-400 text-sm">견적이 없습니다.</p>
          )}
          {recentQuotes.map((q) => (
            <Link key={q.id} href={`/quotes/${q.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900">{q.quote_number}</p>
                <p className="text-xs text-gray-500">{q.projects?.name} · {q.projects?.manager_name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{formatKRW(q.total_quote_amount)}</p>
                <p className={`text-xs font-medium ${Number(q.total_profit) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  이윤 {formatKRW(q.total_profit)} ({q.total_profit_rate}%)
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
