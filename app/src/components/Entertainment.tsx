import { useState } from 'react'
import type { LoopItem, Part, VideoProgress } from '../types'
import { shortLabelForUrl } from '../lib/youtube'
import { formatMinutesLabel, formatSeconds } from '../lib/duration'
import { ContextMenu, type MenuEntry } from './ContextMenu'

interface Props {
  items: LoopItem[]
  parts: Part[]
  progress: Record<string, VideoProgress>
  budgetMin: number
  watched: Set<string>
  dateLabel: string
  onOpen: (item: LoopItem) => void
  onTriggerIngest: () => void
  onToggleWatched: (id: string) => void
  onRemoveFromLoop: (id: string) => void
  onSkipFromToday: (id: string) => void
  onRefreshPlan: () => void
  syncing: boolean
}

interface TileEntry {
  item: LoopItem
  part: Part | null
  completed: boolean
}

interface MenuState {
  x: number
  y: number
  item: LoopItem
}

export function Entertainment({
  items,
  parts,
  progress,
  budgetMin,
  watched,
  dateLabel,
  onOpen,
  onTriggerIngest,
  onToggleWatched,
  onRemoveFromLoop,
  onSkipFromToday,
  onRefreshPlan,
  syncing
}: Props) {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const tiles: TileEntry[] = (() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    return parts
      .map<TileEntry | null>((p) => {
        const item = byId.get(p.itemId)
        if (!item) return null
        const done = progress[item.videoId]?.completed === true || watched.has(item.id)
        return { item, part: p, completed: done }
      })
      .filter((x): x is TileEntry => x !== null)
  })()

  function tileSec(t: TileEntry): number {
    if (t.part && t.part.partCount > 1) return Math.max(0, t.part.endSec - t.part.startSec)
    return t.item.durationSec ?? 0
  }
  const total = tiles.length
  const doneCount = tiles.filter((t) => t.completed).length
  const consumedSec = tiles.reduce((acc, t) => (t.completed ? acc + tileSec(t) : acc), 0)
  const allocatedSec = tiles.reduce((acc, t) => acc + tileSec(t), 0)

  return (
    <div className="screen today">
      <div className="today-head">
        <div>
          <h1>
            {total > 0 ? `Your ${total} for ` : 'Entertainment for '}<em>today</em>
          </h1>
          <div className="sub">
            {total > 0
              ? (
                <>
                  {doneCount} / {total} done · {formatMinutesLabel(allocatedSec)} / {budgetMin}m
                  {consumedSec > 0 ? ` · ${formatMinutesLabel(consumedSec)} watched` : ''}
                </>
              )
              : `${budgetMin}m daily cap`}
          </div>
        </div>
        <div className="date" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="set-active-btn"
            onClick={onRefreshPlan}
            disabled={syncing}
            title="Recompute today's entertainment picks"
          >
            {syncing ? 'Refreshing…' : 'Refresh'}
          </button>
          <span>{dateLabel}</span>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty">
          <h2>Nothing queued</h2>
          <p>
            Press <kbd>Ctrl</kbd> <kbd>I</kbd> and pick the <strong>Entertainment</strong> target
            to add videos here. The {budgetMin}m daily cap keeps the strip from sprawling — when
            today's budget is full, the rest waits its turn.
          </p>
          <p style={{ marginTop: 14 }}>
            <button onClick={onTriggerIngest} className="ingest-save" style={{ padding: '9px 16px' }}>
              Ingest a video
            </button>
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {tiles.map((entry, idx) => {
            const item = entry.item
            const isCompleted = entry.completed
            const tileDur = item.duration || (item.durationSec ? formatSeconds(item.durationSec) : '')
            return (
              <div
                key={`ent-${item.id}-${idx}`}
                className={`card${isCompleted ? ' watched' : ''}`}
                onClick={() => onOpen(item)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, item })
                }}
                style={{ position: 'relative', ...(isCompleted ? { opacity: 0.5 } : {}) }}
              >
                {!isCompleted && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Skip "${item.title}" today? It'll move to Done and a replacement will take its place.`)) {
                        onSkipFromToday(item.id)
                      }
                    }}
                    title="Skip this video"
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'transparent', border: '1px solid var(--hairline)',
                      color: 'var(--ink-faint)', borderRadius: 4, padding: '2px 7px',
                      fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer', opacity: 0.6
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6' }}
                  >skip</button>
                )}
                {isCompleted && <div className="watched-badge">Watched</div>}
                <div className="card-chip">
                  <div className="pip" style={{ background: 'oklch(0.70 0.13 60)' }} />
                  <span className="label">Entertainment{tileDur ? ` · ${tileDur}` : ''}</span>
                </div>
                <h3
                  className="card-title"
                  style={isCompleted ? { textDecoration: 'line-through' } : undefined}
                >
                  {item.title}
                </h3>
                <div className="card-meta">
                  <span className="creator">{item.creator}</span>
                  <span className="url">{shortLabelForUrl(item.url)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: menu.item.note ? 'Reattach note' : 'Attach note', onClick: () => onOpen(menu.item) },
            { label: 'Toggle watched', onClick: () => onToggleWatched(menu.item.id) },
            { label: 'Remove from loop', danger: true, onClick: () => onRemoveFromLoop(menu.item.id) }
          ] as MenuEntry[]}
        />
      )}
    </div>
  )
}
