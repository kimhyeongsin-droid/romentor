import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'

export function useResizableColumns(
  storageKey: string,
  defaultWidths: Record<string, number>
): {
  widths: Record<string, number>
  startResize: (columnKey: string, e: React.MouseEvent) => void
  resetWidths: () => void
  isResizing: boolean
} {
  const [widths, setWidths] = useState<Record<string, number>>(defaultWidths)
  const [isResizing, setIsResizing] = useState(false)

  const defaultWidthsRef = useRef(defaultWidths)
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  // Load from localStorage after hydration (client only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>
        setWidths(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignore parse/access errors
    }
  }, [storageKey])

  // Persist widths to localStorage with 200ms debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(widths))
      } catch {
        // ignore storage errors
      }
    }, 200)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [widths, storageKey])

  // Apply cursor + userSelect on body during drag, restore on end
  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    return () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

  const startResize = useCallback((columnKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startWidth =
      widthsRef.current[columnKey] ??
      defaultWidthsRef.current[columnKey] ??
      100

    setIsResizing(true)

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const newWidth = Math.min(600, Math.max(60, startWidth + delta))
      setWidths(prev => ({ ...prev, [columnKey]: newWidth }))
    }

    const onMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, []) // stable — reads via refs, writes via functional updater

  const resetWidths = useCallback(() => {
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    setWidths(defaultWidthsRef.current)
  }, [storageKey])

  return { widths, startResize, resetWidths, isResizing }
}
