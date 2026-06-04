import React from 'react'

export default function StickyToolbar({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  )
}
