'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Shield, X, Plus } from 'lucide-react'

interface Profile { id: string; name: string; email: string; role: string }
interface Project { id: string; name: string }

export default function AdminPage() {
  const router = useRouter()
  const sb = useMemo(() => createClient(), [])

  const [me, setMe] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null) // null = 로딩중
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // 섹션 B
  const [selectedProject, setSelectedProject] = useState('')
  const [assignees, setAssignees] = useState<string[]>([])
  const [addPick, setAddPick] = useState('')

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setIsAdmin(false); return }
      setMe(user.id)
      const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single()
      const admin = prof?.role === 'admin'
      setIsAdmin(admin)
      if (!admin) return
      const [{ data: profs }, { data: projs }] = await Promise.all([
        sb.from('profiles').select('id, name, email, role').order('role').order('name'),
        sb.from('projects').select('id, name').order('name'),
      ])
      setProfiles((profs ?? []) as Profile[])
      setProjects((projs ?? []) as Project[])
    })()
  }, [sb])

  useEffect(() => {
    if (!selectedProject) { setAssignees([]); return }
    sb.from('project_assignees').select('user_id').eq('project_id', selectedProject)
      .then(({ data }) => setAssignees(((data ?? []) as any[]).map(r => r.user_id)))
  }, [sb, selectedProject])

  const toggleRole = async (p: Profile) => {
    const next = p.role === 'admin' ? 'staff' : 'admin'
    if (p.id === me && next === 'staff') {
      if (!confirm('본인의 관리자 권한을 해제하시겠습니까?\n해제하면 이 페이지에 더 이상 접근할 수 없습니다.')) return
    }
    const { error } = await sb.from('profiles').update({ role: next }).eq('id', p.id)
    if (error) { alert('역할 변경 실패: ' + error.message); return }
    setProfiles(prev => prev.map(x => x.id === p.id ? { ...x, role: next } : x))
    if (p.id === me && next === 'staff') { router.push('/dashboard') }
  }

  const addAssignee = async (userId: string) => {
    if (!userId || !selectedProject) return
    const { error } = await sb.from('project_assignees').insert({ project_id: selectedProject, user_id: userId })
    if (error) { alert('담당자 추가 실패: ' + error.message); return }
    setAssignees(prev => [...prev, userId])
    setAddPick('')
  }
  const removeAssignee = async (userId: string) => {
    const { error } = await sb.from('project_assignees').delete()
      .eq('project_id', selectedProject).eq('user_id', userId)
    if (error) { alert('담당자 제거 실패: ' + error.message); return }
    setAssignees(prev => prev.filter(id => id !== userId))
  }

  if (isAdmin === null) return <div className="p-8 text-gray-400">불러오는 중...</div>
  if (!isAdmin) return (
    <div className="p-8">
      <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
        <Shield className="mx-auto text-gray-300 mb-3" size={32} />
        <p className="text-gray-600 font-medium">접근 권한이 없습니다</p>
        <p className="text-sm text-gray-400 mt-1">이 페이지는 관리자 전용입니다.</p>
      </div>
    </div>
  )

  const byId = Object.fromEntries(profiles.map(p => [p.id, p]))
  const assignedSet = new Set(assignees)
  const candidates = profiles.filter(p => p.role !== 'admin' && !assignedSet.has(p.id))

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Shield size={22} className="text-gray-700" />
        <h2 className="text-2xl font-bold text-gray-900">팀 관리</h2>
      </div>

      {/* 섹션 A — 권한 관리 */}
      <section className="bg-white rounded-xl border border-gray-100 mb-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">권한 관리</h3>
          <p className="text-xs text-gray-400 mt-0.5">관리자는 모든 견적을 편집할 수 있습니다. 직원은 배정된 프로젝트만 편집합니다.</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">이름</th>
              <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">이메일</th>
              <th className="px-5 py-2 text-left text-xs font-semibold text-gray-500">역할</th>
              <th className="px-5 py-2 text-right text-xs font-semibold text-gray-500">변경</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-5 py-2.5 text-gray-800 font-medium">
                  {p.name}{p.id === me && <span className="ml-1.5 text-xs text-gray-400">(나)</span>}
                </td>
                <td className="px-5 py-2.5 text-gray-500">{p.email}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>{p.role === 'admin' ? '관리자' : '직원'}</span>
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button
                    onClick={() => toggleRole(p)}
                    className="text-xs px-3 py-1 rounded-md border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
                  >
                    {p.role === 'admin' ? '직원으로' : '관리자로'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 섹션 B — 프로젝트 담당자 관리 */}
      <section className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">프로젝트 담당자 관리</h3>
          <p className="text-xs text-gray-400 mt-0.5">선택한 직원만 해당 프로젝트의 견적을 편집할 수 있습니다.</p>
        </div>
        <div className="p-5">
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="w-full max-w-md text-sm border border-gray-200 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white"
          >
            <option value="">프로젝트 선택…</option>
            {projects.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
          </select>

          {!selectedProject ? (
            <p className="text-xs text-gray-400">프로젝트를 선택하세요.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4">
                {assignees.length === 0 && <p className="text-xs text-gray-400">배정된 담당자가 없습니다.</p>}
                {assignees.map(uid => (
                  <span key={uid} className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full pl-3 pr-1.5 py-1">
                    {byId[uid]?.name ?? uid.slice(0, 8)}
                    <button onClick={() => removeAssignee(uid)} className="text-blue-400 hover:text-red-500" aria-label="담당자 제거">
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={addPick}
                  onChange={e => setAddPick(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-400 bg-white"
                >
                  <option value="">직원 추가…</option>
                  {candidates.map(p => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
                </select>
                <button
                  onClick={() => addAssignee(addPick)}
                  disabled={!addPick}
                  className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40"
                >
                  <Plus size={15} /> 추가
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
