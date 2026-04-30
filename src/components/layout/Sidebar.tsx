'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, BookOpen, Bell, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/projects', label: '프로젝트', icon: FileText },
  { href: '/quotes', label: '견적 관리', icon: FileText },
  { href: '/units', label: '단가 마스터', icon: BookOpen },
  { href: '/template', label: '기본 견적 포맷', icon: ClipboardList },
  { href: '/alerts', label: '알람 로그', icon: Bell },
]

export default function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="w-60 min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">로멘토</h1>
        <p className="text-xs text-slate-400 mt-1">견적 관리 시스템</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        © 2024 Romentor Interior
      </div>
    </aside>
  )
}
