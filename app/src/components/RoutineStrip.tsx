import type { RoutineItem } from '../types'

interface Props {
  items: RoutineItem[]
  doneIds: Set<string>
  onOpen: (item: RoutineItem) => void
  onToggleDone: (id: string) => void
}

export function RoutineStrip({ items, doneIds, onOpen, onToggleDone }: Props) {
  if (items.length === 0) return null
  const doneCount = items.filter((it) => doneIds.has(it.id)).length

  return (
    <div className="routine-strip">
      <div className="routine-head">
        <div className="routine-eyebrow">Daily Ritual</div>
        <div className="routine-progress">
          <div className="routine-bar"><div className="routine-bar-fill" style={{ width: `${(doneCount / items.length) * 100}%` }} /></div>
          <span className="routine-count">{doneCount}/{items.length}</span>
        </div>
      </div>
      <div className="routine-list">
        {items.map((it) => {
          const done = doneIds.has(it.id)
          return (
            <div key={it.id} className={`routine-card${done ? ' done' : ''}`}>
              <button
                className={`routine-check${done ? ' on' : ''}`}
                onClick={() => onToggleDone(it.id)}
                aria-label={done ? 'Mark not done' : 'Mark done'}
                title={done ? 'Mark not done for today' : 'Mark done for today'}
              >
                {done && (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
              <div className="routine-body" onClick={() => onOpen(it)}>
                <div className="routine-title">{it.title}</div>
                <div className="routine-creator">{it.creator}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
