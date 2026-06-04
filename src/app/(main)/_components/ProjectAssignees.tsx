'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'

interface Person { id: string; name: string; job_title: string | null }

export default function ProjectAssignees({ projectId }: { projectId: string }) {
  const { isAdmin, loading: permLoading } = usePermissions()
  const [people, setPeople] = useState<Person[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const sb = createClient()
    Promise.all([
      sb.from('profiles').select('id, name, job_title, role').order('name'),
      sb.from('project_assignees').select('user_id').eq('project_id', projectId),
    ]).then(([{ data: profs }, { data: pa }]) => {
      setPeople(((profs ?? []) as any[]).filter(p => p.role !== 'admin'))
      setAssigned(new Set(((pa ?? []) as any[]).map(r => r.user_id)))
      setReady(true)
    })
  }, [isAdmin, projectId])

  if (permLoading || !isAdmin) return null

  const toggle = async (userId: string) => {
    const sb = createClient()
    const on = assigned.has(userId)
    // 낙관적 갱신
    setAssigned(prev => {
      const n = new Set(prev)
      on ? n.delete(userId) : n.add(userId)
      return n
    })
    if (on) {
      await sb.from('project_assignees').delete().eq('project_id', projectId).eq('user_id', userId)
    } else {
      await sb.from('project_assignees').insert({ project_id: projectId, user_id: userId })
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">담당자 (편집 권한)</h3>
        <span className="text-xs text-gray-400">관리자 전용 · 선택된 팀원만 이 프로젝트의 견적을 편집할 수 있습니다</span>
      </div>
      {!ready ? (
        <p className="text-xs text-gray-400">불러오는 중…</p>
      ) : people.length === 0 ? (
        <p className="text-xs text-gray-400">표시할 팀원이 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {people.map(p => {
            const on = assigned.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  on ? 'bg-blue-600 text-white border-blue-600'
                     : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                {on ? '✓ ' : ''}{p.name}{p.job_title ? ` · ${p.job_title}` : ''}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
