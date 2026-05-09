'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Project } from '@/types'

export default function ProjectsPage() {
  const router = useRouter()
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
        <button
          onClick={() => router.push('/projects/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> 새 프로젝트
        </button>
      </div>

      <div className="grid gap-4">
        {projects.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            프로젝트가 없습니다. 새 프로젝트를 추가하세요.
          </div>
        )}
        {projects.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="text-left hover:text-blue-600 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 text-base">{p.name}</h3>
                </button>
                {p.address && (
                  <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-2">
                  {p.manager_name && (
                    <span className="text-xs text-gray-500">PM: <span className="font-medium text-gray-700">{p.manager_name}</span></span>
                  )}
                  {p.designer_name && (
                    <span className="text-xs text-gray-500">디자이너: <span className="font-medium text-gray-700">{p.designer_name}</span></span>
                  )}
                  {p.site_manager_name && (
                    <span className="text-xs text-gray-500">소장: <span className="font-medium text-gray-700">{p.site_manager_name}</span></span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-4">
                <button
                  onClick={() => router.push(`/quotes/new?projectId=${p.id}`)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                >
                  견적 작성
                </button>
                <button
                  onClick={() => router.push(`/quotes?projectId=${p.id}`)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 font-medium"
                >
                  견적 히스토리
                </button>
                <button
                  onClick={() => router.push(`/projects/${p.id}/edit`)}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium flex items-center gap-1"
                >
                  <Pencil size={13} /> 수정
                </button>
                <button
                  onClick={() => deleteProject(p.id, p.name)}
                  disabled={deleting === p.id}
                  className="text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-medium disabled:opacity-40"
                >
                  {deleting === p.id ? '삭제중...' : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
