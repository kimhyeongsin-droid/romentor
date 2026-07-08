'use client'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 데스크탑: 항상 표시되는 사이드바 */}
      <div className="hidden md:flex h-full">
        <Sidebar />
      </div>

      {/* 모바일: 오프캔버스 드로어 */}
      <div
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-200 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setDrawerOpen(false)}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div
          className={`absolute left-0 top-0 h-full transition-transform duration-200 ease-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          onClick={e => e.stopPropagation()}
        >
          <Sidebar onNavigate={() => setDrawerOpen(false)} />
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* 모바일 상단바 */}
        <header className="md:hidden flex items-center gap-3 px-4 h-14 bg-slate-900 text-white flex-shrink-0 no-print">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold">로멘토</span>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
