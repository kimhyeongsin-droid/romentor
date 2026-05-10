import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'romentor.sidebar.collapsed'

export function useSidebarCollapsed(): {
  collapsed: boolean
  toggle: () => void
} {
  // Default false (expanded) — matches SSR output, avoids hydration mismatch
  const [collapsed, setCollapsed] = useState(false)

  // Read localStorage only after hydration (client only)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setCollapsed(stored === 'true')
    }
  }, [])

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }, [])

  return { collapsed, toggle }
}
