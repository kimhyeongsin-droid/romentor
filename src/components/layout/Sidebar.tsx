'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, BookOpen, Bell, ClipboardList, HelpCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'

const nav = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/projects', label: '프로젝트', icon: FileText },
  { href: '/quotes', label: '견적 관리', icon: FileText },
  { href: '/units', label: '단가 마스터', icon: BookOpen },
  { href: '/template', label: '기본 견적 포맷', icon: ClipboardList },
  { href: '/alerts', label: '알람 로그', icon: Bell },
  { href: '/guide', label: '사용 가이드', icon: HelpCircle },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <aside className={cn(
      'min-h-screen bg-slate-900 text-white flex flex-col flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out',
      collapsed ? 'w-14' : 'w-60'
    )}>
      {/* Header */}
      <div className={cn(
        'border-b border-slate-700 flex items-center',
        collapsed ? 'px-3 py-4 justify-center' : 'px-5 py-4 justify-between'
      )}>
        {!collapsed && (
          <div className="min-w-0 mr-2">
            <h1 className="text-xl font-bold text-white whitespace-nowrap">로멘토</h1>
            <p className="text-xs text-slate-400 mt-1 whitespace-nowrap">견적 관리 시스템</p>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          className="flex-shrink-0 p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={cn(
              'flex items-center rounded-lg text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            {!collapsed && <span className="whitespace-nowrap">{label}</span>}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 whitespace-nowrap">
          © 2024 Romentor Interior
        </div>
      )}
    </aside>
  )
}
