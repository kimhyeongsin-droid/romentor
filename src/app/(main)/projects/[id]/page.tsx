'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Phone, MapPin, Ruler, ArrowLeft, Plus, FileText, Calendar, Pencil } from 'lucide-react'
import type { Project, Quote } from '@/types'

const STATUS_LABEL: Record<string, string> = { draft: '작성중', active: '진행중', completed: '완료' }
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
}
const QUOTE_STATUS_LABEL: Record<string, string> = { draft: '작성중', confirmed: '확정', executed: '실행' }
const QUOTE_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  confirmed: 'bg-blue-100 text-blue-700',
  executed: 'bg-emerald-100 text-emerald-700',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = createClient()
    Promise.all([
      sb.from('projects').select('*').eq('id', id).single(),
      sb.from('quotes').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: q }]) => {
      setProject(p)
      setQuotes(q ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-8 text-gray-400">불러오는 중...</div>
  if (!project) return <div className="p-8 text-gray-400">프로젝트를 찾을 수 없습니다.</div>

  return (
    <div className="p-8 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
          <p className="text-gray-500 text-sm mt-0.5">{project.client_name}</p>
        </div>
        <span className={`ml-2 text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[project.status]}`}>
          {STATUS_LABEL[project.status]}
        </span>
        <Link href={`/projects/${project.id}/edit`}
          className="ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium">
          <Pencil size={14} /> 수정
        </Link>
      </div>

      {/* 프로젝트 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">프로젝트 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <MapPin size={16} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">현장 주소</p>
              <p className="text-sm text-gray-700 mt-0.5">{project.address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Ruler size={16} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">면적</p>
              <p className="text-sm text-gray-700 mt-0.5">{project.area_sqm ? `${project.area_sqm} m²` : '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 size={16} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">담당자</p>
              <p className="text-sm text-gray-700 mt-0.5">{project.manager_name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Phone size={16} className="text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400">연락처</p>
              <p className="text-sm text-gray-700 mt-0.5">{project.manager_phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 견적서 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">견적서 ({quotes.length}개)</h3>
          <Link href={`/quotes/new?projectId=${project.id}`}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            <Plus size={14} /> 견적 작성
          </Link>
        </div>

        {quotes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            아직 견적서가 없습니다.
          </div>
        ) : (
          <div className="grid gap-3">
            {quotes.map((q) => (
              <Link key={q.id} href={`/quotes/${q.id}`}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-50 p-2 rounded-lg">
                    <FileText size={16} className="text-gray-500" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{q.quote_number}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Calendar size={11} className="text-gray-400" />
                      <p className="text-xs text-gray-400">{new Date(q.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-gray-400">최종금액</p>
                    <p className="text-sm font-bold text-blue-700">
                      ₩{(q.final_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${QUOTE_STATUS_COLOR[q.status]}`}>
                    {QUOTE_STATUS_LABEL[q.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
