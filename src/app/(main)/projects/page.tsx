'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Building2, Phone, Trash2 } from 'lucide-react'
import type { Project } from '@/types'

const STATUS_LABEL: Record<string, string> = { draft: '작성중', active: '진행중', completed: '완료' }
const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  async function load() {
    const { data } = await createClient().from('projects').select('*').order('created_at', { ascending: false })
    setProjects(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function deleteProject(id: string, name: string) {
    if (!confirm(`"${name}" 프로젝트를 삭제하시겠습니까?\n\n관련 견적서도 모두 삭제됩니다.`)) return
    setDeleting(id)
    const sb = createClient()
    await sb.from('quote_items').delete().in('quote_id',
      (await sb.from('quotes').select('id').eq('project_id', id)).data?.map((q: any) => q.id) ?? []
    )
    await sb.from('quotes').delete().eq('project_id', id)
    await sb.from('projects').delete().eq('id', id)
    setDeleting(null)
    await load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">프로젝트</h2>
          <p className="text-gray-500 text-sm mt-1">총 {projects.length}개 프로젝트</p>
        </div>
        <Link href="/projects/new" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} /> 새 프로젝트
        </Link>
      </div>

      <div className="grid gap-4">
        {projects.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            프로젝트가 없습니다. 새 프로젝트를 추가하세요.
          </div>
        )}
        {projects.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <Building2 size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{p.client_name} · {p.address}</p>
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Phone size={12} /> {p.manager_name} {p.manager_phone}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/quotes/new?projectId=${p.id}`} className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">견적 작성</Link>
              <Link href={`/projects/${p.id}`} className="text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium">상세보기</Link>
              <button onClick={() => deleteProject(p.id, p.name)} disabled={deleting === p.id}
                className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium disabled:opacity-40">
                {deleting === p.id ? '삭제중...' : <Trash2 size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
