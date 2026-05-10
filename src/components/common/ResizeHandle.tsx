import type React from 'react'

type Props = {
  columnKey: string
  onMouseDown: (key: string, e: React.MouseEvent) => void
}

export function ResizeHandle({ columnKey, onMouseDown }: Props) {
  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-200/60 transition-colors z-10"
      onMouseDown={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onMouseDown(columnKey, e)
      }}
    />
  )
}
