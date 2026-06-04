'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UserMenu() {
  const router = useRouter()
  const supabase = createClient()
  const [name, setName] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles')
        .select('name, email').eq('id', user.id).single()
      setName(data?.name || data?.email || user.email || '')
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm border-t border-slate-700">
      <span className="text-slate-300 truncate">{name}</span>
      <button onClick={handleLogout} className="text-slate-400 hover:text-white shrink-0">로그아웃</button>
    </div>
  )
}
