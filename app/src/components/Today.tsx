import { useState } from 'react'
import type { Category, Course, CourseCategory, LoopItem, Mode, Part, VideoProgress } from '../types'
import { DEFAULT_CATEGORIES, makeCategoryMap } from '../lib/categories'
import { shortLabelForUrl } from '../lib/youtube'
import { formatMinutesLabel, formatSeconds } from '../lib/duration'
import { ContextMenu, type MenuEntry } from './ContextMenu'

interface Props {
  items: LoopItem[]
  /** Parts in display order for today (may be empty for legacy plans). */
  parts: Part[]
  /** Per-video progress state. */
  progress: Record<string, VideoProgress>
  /** Sum of minutes-per-day budgets across enabled categories — for the header. */
  totalBudgetMin: number
  /** Day mode — SUN suppresses category chips (Sunday is the catch-up day,
   * not category-organized). */
  mode: Mode
  routineCount: number
  routineDoneCount: number
  watched: Set<string>
  dateLabel: string
  activeCourses: {
    course: Course
    categoryName: string
    categoryColor: string
    sessionsCompleted?: number
    sessionLimit?: number
    locked?: boolean
  }[]
  courseLocked: boolean
  courseSessionsToday: number
  courseSessionLimit: number
  categories: Category[]
  onOpen: (item: LoopItem) => void
  onOpenRoutine: () => void
  onOpenCourse: (courseId: string) => void
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

export function Today({
  items,
  parts,
  progress,
  totalBudgetMin,
  routineCount,
  routineDoneCount,
  watched,
  dateLabel,
  activeCourses,
  courseLocked,
  courseSessionsToday,
  courseSessionLimit,
  onOpen,
  onOpenRoutine,
  onOpenCourse,
  onTriggerIngest,
  onToggleWatched,
  onRemoveFromLoop,
  onSkipFromToday,
  onRefreshPlan,
  syncing,
  categories,
  mode
}: Props) {
  // Sunday is the harvest day — category labels just leak per-channel metadata
  // that's irrelevant to the catch-up flow. Strip the chip text on SUN tiles.
  const isSunday = mode === 'SUN'
  const [menu, setMenu] = useState<MenuState | null>(null)
  const catMap = makeCategoryMap(categories.length > 0 ? categories : DEFAULT_CATEGORIES)

  // Build the sticky tile list — one entry per part (or per item if no parts).
  // Completion: `progress[videoId]?.completed === true` OR legacy `watched.has(id)`.
  const tiles: TileEntry[] = (() => {
    const byId = new Map(items.map((i) => [i.id, i]))
    if (parts.length > 0) {
      return parts
        .map<TileEntry | null>((p) => {
          const item = byId.get(p.itemId)
          if (!item) return null
          const done = progress[item.videoId]?.completed === true || watched.has(item.id)
          return { item, part: p, completed: done }
        })
        .filter((x): x is TileEntry => x !== null)
    }
    return items.map<TileEntry>((item) => {
      const done = progress[item.videoId]?.completed === true || watched.has(item.id)
      return { item, part: null, completed: done }
    })
  })()

  const total = tiles.length
  const doneCount = tiles.filter((t) => t.completed).length
  function tileSec(t: TileEntry): number {
    // Real video duration trumps part length when the video isn't partitioned.
    if (t.part && t.part.partCount > 1) return Math.max(0, t.part.endSec - t.part.startSec)
    return t.item.durationSec ?? 0
  }
  const consumedSec = tiles.reduce((acc, t) => (t.completed ? acc + tileSec(t) : acc), 0)
  const allocatedSec = tiles.reduce((acc, t) => acc + tileSec(t), 0)

  const sessionPct = courseSessionLimit > 0
    ? Math.min(100, Math.round((courseSessionsToday / courseSessionLimit) * 100))
    : 0

  return (
    <div className="screen today">
      <div className="today-head">
        <div>
          <h1>
            Your {total || 'next'} for <em>today</em>
          </h1>
          <div className="sub">
            {total > 0
              ? (isSunday
                  ? `${doneCount} / ${total} done · ${formatMinutesLabel(allocatedSec)} total` +
                    (consumedSec > 0 ? ` · ${formatMinutesLabel(consumedSec)} watched` : '')
                  : `${doneCount} / ${total} done · ${formatMinutesLabel(allocatedSec)} / ${totalBudgetMin}m` +
                    (consumedSec > 0 ? ` · ${formatMinutesLabel(consumedSec)} watched` : ''))
              : 'Curated from your loop'}
          </div>
        </div>
        <div className="date" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className="set-active-btn"
            onClick={onRefreshPlan}
            disabled={syncing}
            title="Recompute today's plan (also refreshes channels)"
          >
            {syncing ? 'Refreshing…' : 'Refresh'}
          </button>
          <span>{dateLabel}</span>
        </div>
      </div>

      {routineCount > 0 && (
        <div className="routine-summary" onClick={onOpenRoutine}>
          <div className="routine-summary-left">
            <span className="routine-eyebrow">Routine</span>
            <span className="routine-summary-text">
              {routineDoneCount} of {routineCount} done today
            </span>
          </div>
          <div className="routine-summary-right">
            <div className="routine-bar"><div className="routine-bar-fill" style={{ width: `${(routineDoneCount / routineCount) * 100}%` }} /></div>
            <span className="active-cta">Open →</span>
          </div>
        </div>
      )}



      {items.length === 0 ? (
        <div className="empty">
          <h2>An empty hearth</h2>
          <p>
            Today's plan is empty. If you have videos in your loop, hit Refresh above to recompute — channels and durations sync along with it.
          </p>
          <p style={{ marginTop: 14 }}>
            Or press <kbd>Ctrl</kbd> <kbd>I</kbd> (or the <strong>+</strong> in the titlebar) to ingest a new video.
          </p>
          <p style={{ marginTop: 14 }}>
            <button onClick={onTriggerIngest} className="ingest-save" style={{ padding: '9px 16px' }}>
              Ingest a video
            </button>
          </p>
        </div>
      ) : doneCount === total && total > 0 ? (
        <>
          <div className="today-section-head">
            <h2>Today's daily</h2>
            <span className="today-section-sub">complete</span>
          </div>
          <div className="card-grid">
            {tiles.map((entry, idx) => {
              const cat = (catMap[entry.item.category] ?? DEFAULT_CATEGORIES[0])
              const partLabel = entry.part && entry.part.partCount > 1
                ? `Part ${entry.part.partIdx + 1} / ${entry.part.partCount}`
                : null
              const tileDur = entry.item.duration || (entry.item.durationSec ? formatSeconds(entry.item.durationSec) : '')
              const chipExtra = partLabel ?? (tileDur ? tileDur : null)
              return (
                <div
                  key={`${entry.item.id}-${entry.part?.partIdx ?? 0}-${idx}`}
                  className="card watched"
                  onClick={() => onOpen(entry.item)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenu({ x: e.clientX, y: e.clientY, item: entry.item })
                  }}
                  style={{ opacity: 0.5 }}
                >
                  <div className="watched-badge">Watched</div>
                  <div className="card-chip">
                    <div className="pip" style={{ background: cat.color }} />
                    <span className="label">{isSunday ? 'Sunday' : cat.name}{chipExtra ? ` · ${chipExtra}` : ''}</span>
                  </div>
                  <h3 className="card-title" style={{ textDecoration: 'line-through' }}>{entry.item.title}</h3>
                  <div className="card-meta">
                    <span className="creator">{entry.item.creator}</span>
                    <span className="url">{shortLabelForUrl(entry.item.url)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="empty" style={{ marginTop: 24 }}>
            <h2>Done for today.</h2>
            <p>See you tomorrow.</p>
          </div>
        </>
      ) : (
        <>
          <div className="today-section-head">
            <h2>Today's daily</h2>
            <span className="today-section-sub">{total - doneCount} left · {total} total</span>
          </div>
          <div className="card-grid">
              {tiles.map((entry, idx) => {
              const item = entry.item
              const part = entry.part
              const cat = (catMap[item.category] ?? DEFAULT_CATEGORIES[0])
              const isCompleted = entry.completed
              const partLabel = part && part.partCount > 1
                ? `Part ${part.partIdx + 1} / ${part.partCount} · ${Math.max(1, Math.round((part.endSec - part.startSec) / 60))}m`
                : null
              const tileDur = item.duration || (item.durationSec ? formatSeconds(item.durationSec) : '')
              const chipExtra = partLabel ?? (tileDur ? tileDur : null)
              return (
                <div
                  key={`${item.id}-${part?.partIdx ?? 0}-${idx}`}
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
                        if (confirm(`Skip "${item.title}" today? It'll move to Done and a new video will take its place.`)) {
                          onSkipFromToday(item.id)
                        }
                      }}
                      title="Skip this video (move to Done and bring in a replacement)"
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        background: 'transparent',
                        border: '1px solid var(--hairline)',
                        color: 'var(--ink-faint)',
                        borderRadius: 4,
                        padding: '2px 7px',
                        fontSize: 11,
                        fontFamily: 'var(--mono)',
                        cursor: 'pointer',
                        opacity: 0.6
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6' }}
                    >skip</button>
                  )}
                  {isCompleted && <div className="watched-badge">Watched</div>}
                  <div className="card-chip">
                    <div className="pip" style={{ background: cat.color }} />
                    <span className="label">{isSunday ? 'Sunday' : cat.name}{chipExtra ? ` · ${chipExtra}` : ''}</span>
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
                  {(() => {
                    // Progress visualization: how much of THIS tile (whole video
                    // OR current part) the user has watched. Always shown for
                    // completed tiles (so the user can see what they wrapped up);
                    // shown for in-progress tiles when currentSec > 0; hidden
                    // when there's nothing useful to display yet.
                    const prog = progress[item.videoId]
                    const hasPlaybackProgress = prog && prog.currentSec > 0
                    if (!isCompleted && !hasPlaybackProgress) return null
                    const partLen = part && part.partCount > 1 ? Math.max(0, part.endSec - part.startSec) : 0
                    const totalSec = partLen > 0 ? partLen : (item.durationSec ?? prog?.durationSec ?? 0)
                    const watchedInTile = (() => {
                      if (isCompleted) return totalSec
                      if (!prog) return 0
                      if (partLen > 0) {
                        return Math.max(0, Math.min(partLen, prog.currentSec - (part?.startSec ?? 0)))
                      }
                      return Math.min(Math.max(totalSec, 0), prog.currentSec)
                    })()
                    const pct = totalSec > 0
                      ? Math.min(100, Math.max(isCompleted ? 100 : 0, Math.round((watchedInTile / totalSec) * 100)))
                      : (isCompleted ? 100 : 0)
                    return (
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            height: 3,
                            background: 'var(--hairline)',
                            borderRadius: 2,
                            overflow: 'hidden'
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: cat.color,
                              transition: 'width 200ms ease'
                            }}
                          />
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 10.5,
                            color: 'var(--ink-faint)',
                            marginTop: 4
                          }}
                        >
                          {isCompleted
                            ? 'Watched'
                            : `${formatMinutesLabel(watchedInTile)} watched · ${pct}%`}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Active courses or course lockout */}
      {(activeCourses.length > 0 || courseLocked) && (
        <div className="today-section-head">
          <h2>{courseLocked ? 'Today\'s courses' : 'Now studying'}</h2>
          <span className="today-section-sub">{courseLocked ? 'wrapped' : 'click to continue'}</span>
        </div>
      )}
      {courseLocked ? (
        <div className="course-locked">
          <div className="locked-eyebrow">Done for the day</div>
          <h3 className="locked-h">
            {courseSessionLimit} course session{courseSessionLimit !== 1 ? 's' : ''} complete. <em>Well done.</em>
          </h3>
          <p>Courses are tucked away until tomorrow. Loop content is still here whenever you want it.</p>
          <div className="session-bar lit">
            <div className="session-bar-fill" style={{ width: '100%' }} />
          </div>
        </div>
      ) : (
        activeCourses.length > 0 && (
          <div className="active-courses-grid">
            {activeCourses.map(({ course, categoryName, categoryColor, sessionsCompleted, sessionLimit, locked }) => {
              const comp = sessionsCompleted !== undefined ? sessionsCompleted : courseSessionsToday
              const lim = sessionLimit !== undefined ? sessionLimit : courseSessionLimit
              const isLocked = locked !== undefined ? locked : courseLocked
              const pct = lim > 0 ? Math.min(100, Math.round((comp / lim) * 100)) : 0
              return (
                <div
                  key={course.id}
                  className={`active-course-multi ${isLocked ? 'locked' : ''}`}
                  onClick={() => {
                    if (!isLocked) onOpenCourse(course.id)
                  }}
                  style={isLocked ? { opacity: 0.65, cursor: 'not-allowed' } : undefined}
                >
                  <div className="active-bar" style={{ background: categoryColor }} />
                  <div className="active-body">
                    <div className="active-eyebrow-row">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: categoryColor }}>
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                      <span className="active-eyebrow">{categoryName}</span>
                      {isLocked && <span className="title-tag" style={{ marginLeft: 6, background: 'var(--ember-tint)', color: 'var(--ember-ink)' }}>Locked</span>}
                      <span className="active-creator">{course.creator}</span>
                    </div>
                    <h3 className="active-title">{course.title}</h3>
                    <div className="session-row">
                      <div className="session-bar">
                        <div className="session-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="session-text">
                        {comp} of {lim} sessions today
                      </span>
                    </div>
                  </div>
                  <div className="active-cta">{isLocked ? 'Done ✓' : 'Open →'}</div>
                </div>
              )
            })}
          </div>
        )
      )}

      {menu && (() => {
        const isWatched = watched.has(menu.item.id)
        const items: MenuEntry[] = [
          {
            label: isWatched ? 'Mark unwatched' : 'Mark watched',
            onClick: () => onToggleWatched(menu.item.id)
          },
          {
            label: 'Open on YouTube',
            onClick: () => {
              const url = `https://www.youtube.com/watch?v=${menu.item.videoId}`
              window.open(url, '_blank', 'noreferrer')
            }
          },
          { divider: true },
          {
            label: 'Remove from loop',
            danger: true,
            onClick: () => onRemoveFromLoop(menu.item.id)
          }
        ]
        return <ContextMenu x={menu.x} y={menu.y} items={items} onClose={() => setMenu(null)} />
      })()}
    </div>
  )
}
