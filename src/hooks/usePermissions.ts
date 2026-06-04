'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// 현재 로그인 유저의 역할(admin 여부)과, 주어진 프로젝트의 담당자 여부를 반환.
// projectId 미지정 시 isAssignee는 항상 false (관리자 판정만 필요할 때 사용).
export function usePermissions(projectId?: string | null) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isAssignee, setIsAssignee] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const sb = createClient()
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { if (active) setLoading(false); return }

      const { data: prof } = await sb.from('profiles').select('role').eq('id', user.id).single()

      let assignee = false
      if (projectId) {
        // project_assignees 미적용(테이블 없음) 시 error → assignee=false (graceful)
        const { data: pa } = await sb.from('project_assignees')
          .select('project_id').eq('project_id', projectId).eq('user_id', user.id).maybeSingle()
        assignee = !!pa
      }

      if (active) {
        setIsAdmin(prof?.role === 'admin')
        setIsAssignee(assignee)
        setLoading(false)
      }
    })()
    return () => { active = false }
  }, [projectId])

  return { isAdmin, isAssignee, loading }
}
