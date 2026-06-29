import { useEffect, useRef } from 'react'

export interface MenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  divider?: false
}

export interface MenuDivider {
  divider: true
}

export type MenuEntry = MenuItem | MenuDivider

interface Props {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onClickOut)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('mousedown', onClickOut)
      window.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        'divider' in it && it.divider ? (
          <div key={`d-${i}`} className="ctx-divider" />
        ) : (
          <button
            key={i}
            className={`ctx-item${(it as MenuItem).danger ? ' danger' : ''}`}
            onClick={() => {
              ;(it as MenuItem).onClick()
              onClose()
            }}
          >
            {(it as MenuItem).label}
          </button>
        )
      )}
    </div>
  )
}
