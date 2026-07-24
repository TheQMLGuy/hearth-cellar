import { useState, useMemo, useEffect, useRef } from 'react'
import type { Category, Course, CourseCategory, LoopItem, Mode, Part, VideoProgress, Spark, SparkKind, ExploreTopic, InterestItem, DailySynthesis, PersistedStore } from '../types'
import { DEFAULT_CATEGORIES, makeCategoryMap } from '../lib/categories'
import { shortLabelForUrl } from '../lib/youtube'
import { formatMinutesLabel, formatSeconds } from '../lib/duration'
import { ContextMenu, type MenuEntry } from './ContextMenu'
import { SPARK_KINDS, SPARK_KIND_ORDER, makeSpark, sparkDateKey } from '../lib/sparks'

interface Props {
  items: LoopItem[]
  /** Parts in display order for today (may be empty for legacy plans). */
  parts: Part[]
  /** Per-video progress state. */
  progress: Record<string, VideoProgress>
  /** Sum of minutes-per-day budgets across enabled categories — for the header. */
  totalBudgetMin: number
  /** Day mode — always WKDY now. Kept for back-compat with any caller that
   * was still passing it. */
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
  activeCategoryIds?: string[]
  onUpdateActiveCategories?: (ids: string[]) => void
  onOpen: (item: LoopItem) => void
  onOpenRoutine: () => void
  onOpenCourse: (courseId: string) => void
  onTriggerIngest: () => void
  onToggleWatched: (id: string) => void
  onRemoveFromLoop: (id: string) => void
  onSkipFromToday: (id: string) => void
  onRefreshPlan: () => void
  syncing: boolean
  store: PersistedStore
  sparks: Spark[]
  exploreTopics: ExploreTopic[]
  interests: InterestItem[]
  dailySynthesis: Record<string, DailySynthesis>
  onUpdateStore: (next: PersistedStore) => void
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
  activeCategoryIds,
  onUpdateActiveCategories,
  mode,
  store,
  sparks,
  exploreTopics,
  interests,
  dailySynthesis,
  onUpdateStore
}: Props) {
  // Sunday-mode is dead. Kept the param for back-compat; treat every day
  // as a regular WKDY day. The previous SUN-only chip suppression is gone.
  void mode
  const isSunday = false
  const [menu, setMenu] = useState<MenuState | null>(null)
  const catMap = makeCategoryMap(categories.length > 0 ? categories : DEFAULT_CATEGORIES)
  const [showCatEdit, setShowCatEdit] = useState(false)
  const resolvedActiveCatIds = activeCategoryIds ?? []

  // Sparks Dashboard state
  const [activeSparksTab, setActiveSparksTab] = useState<'captures' | 'review' | 'calendar' | 'explore' | 'interests'>('captures')
  
  // Ocean of exploration state
  const [openTopicId, setOpenTopicId] = useState<string | null>(null)
  const [busyTopicId, setBusyTopicId] = useState<string | null>(null)
  const [newTopicText, setNewTopicText] = useState('')
  
  // Interests state
  const [openInterestId, setOpenInterestId] = useState<string | null>(null)
  const [busyInterestId, setBusyInterestId] = useState<string | null>(null)
  const [newInterestName, setNewInterestName] = useState('')
  
  // Central synthesis state
  const [synthesisLoading, setSynthesisLoading] = useState(false)
  const [showSynthesis, setShowSynthesis] = useState(false)
  
  // Calendar state
  const [calendarMode, setCalendarMode] = useState<'week' | 'month' | 'year'>('week')
  
  // SRS Review state
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewQueue, setReviewQueue] = useState<Spark[]>([])
  const [reviewShowDesc, setReviewShowDesc] = useState(false)
  const currentReviewSpark = reviewQueue[reviewIdx]
  const currentReviewMeta = currentReviewSpark?.kind ? SPARK_KINDS[currentReviewSpark.kind] : undefined


  const today = sparkDateKey()
  const todayCaptures = sparks.filter((s) => s.createdDate === today)
  const todayStarred = sparks.filter((s) => s.starred || s.topOfMind)

  const dueSparks = sparks.filter(i => !i.srs || !i.srs.dueAt || i.srs.dueAt <= today)
    .sort((a, b) => {
      const ad = (a.srs && a.srs.dueAt) || a.createdAt || ''
      const bd = (b.srs && b.srs.dueAt) || b.createdAt || ''
      return ad.localeCompare(bd)
    })
  const srsDueCount = dueSparks.length

  function calculateNextSrs(spark: Spark, grade: 'forgot' | 'got') {
    let reps = spark.srs?.reps ?? 0
    let ease = spark.srs?.ease ?? 2.5
    let interval = spark.srs?.interval ?? 0

    if (grade === 'forgot') {
      reps = 0
      interval = Math.max(1, Math.round((interval || 1) * ease * 0.6))
    } else if (grade === 'got') {
      reps = reps + 1
      interval = Math.max(1, Math.round((interval || 1) * ease))
      ease = Math.min(3.0, ease + 0.1)
    }
    ease = Math.max(1.3, Math.min(3.0, ease))
    const due = new Date()
    due.setDate(due.getDate() + interval)
    return { reps, ease, interval, dueAt: sparkDateKey(due) }
  }



  const handleToggleStar = (sparkId: string) => {
    const nextSparks = (store.sparks ?? []).map(s => 
      s.id === sparkId ? { ...s, starred: !s.starred, topOfMind: !s.starred } : s
    )
    onUpdateStore({
      ...store,
      sparks: nextSparks
    })
  }

  const handleDeleteSpark = (sparkId: string) => {
    const nextSparks = (store.sparks ?? []).filter(s => s.id !== sparkId)
    onUpdateStore({
      ...store,
      sparks: nextSparks
    })
  }

  const handleAddTopic = () => {
    const txt = newTopicText.trim()
    if (!txt) return
    const id = 'top-' + Date.now().toString(36)
    const newTopic: ExploreTopic = {
      id,
      text: txt,
      addedAt: new Date().toISOString(),
      fetchCount: 0
    }
    const nextTopics = [newTopic, ...(store.exploreTopics ?? [])]
    onUpdateStore({
      ...store,
      exploreTopics: nextTopics
    })
    setNewTopicText('')
  }

  const handleRemoveTopic = (id: string) => {
    const nextTopics = (store.exploreTopics ?? []).filter(t => t.id !== id)
    onUpdateStore({
      ...store,
      exploreTopics: nextTopics
    })
  }

  const handleGeneratePitch = async (topic: ExploreTopic) => {
    if (busyTopicId) return
    setBusyTopicId(topic.id)
    let pitchText = ''
    try {
      pitchText = await callLocalOllama(
        `Explain the topic: "${topic.text}". Write a short, highly engaging deep-dive pitch explaining why this topic matters, a key non-obvious hypothesis, and a recommended action plan for a study session. Format with markdown.`,
        "You are a brilliant research analyst."
      )
    } catch (e) {
      pitchText = getMockPitch(topic.text)
    }
    const nextTopics = (store.exploreTopics ?? []).map(t =>
      t.id === topic.id ? { ...t, pitch: pitchText, pitchedAt: new Date().toISOString() } : t
    )
    onUpdateStore({
      ...store,
      exploreTopics: nextTopics
    })
    setBusyTopicId(null)
    setOpenTopicId(topic.id)
  }

  const handleAddInterest = () => {
    const name = newInterestName.trim()
    if (!name) return
    const id = 'int-' + Date.now().toString(36)
    const newInterest: InterestItem = {
      id,
      name,
      addedAt: new Date().toISOString()
    }
    const nextInterests = [newInterest, ...(store.interests ?? [])]
    onUpdateStore({
      ...store,
      interests: nextInterests
    })
    setNewInterestName('')
  }

  const handleRemoveInterest = (id: string) => {
    const nextInterests = (store.interests ?? []).filter(i => i.id !== id)
    onUpdateStore({
      ...store,
      interests: nextInterests
    })
  }

  const handleGeneratePareto = async (interest: InterestItem) => {
    if (busyInterestId) return
    setBusyInterestId(interest.id)
    let paretoText = ''
    try {
      paretoText = await callLocalOllama(
        `Write a ~600-word Pareto summary (the 80/20 rule) for the topic: "${interest.name}". Detail the 20% of concepts/skills that account for 80% of the value/results. Format beautifully using markdown.`,
        "You are an expert tutor synthesizing information."
      )
    } catch (e) {
      paretoText = getMockPareto(interest.name)
    }
    const nextInterests = (store.interests ?? []).map(i =>
      i.id === interest.id ? { ...i, pareto: paretoText, paretoGeneratedAt: new Date().toISOString() } : i
    )
    onUpdateStore({
      ...store,
      interests: nextInterests
    })
    setBusyInterestId(null)
    setOpenInterestId(interest.id)
  }

  const handleGenerateDailySynthesis = async () => {
    const todaySparks = sparks.filter(s => s.createdDate === today)
    if (todaySparks.length < 3) return
    
    setSynthesisLoading(true)
    let text = ''
    try {
      const prompt = `Synthesize today's captured sparks into a unified daily reflection essay. Here are today's sparks:\n` +
        todaySparks.map((s, i) => `${i+1}. [${s.kind}] Title: ${s.title}\nDescription: ${s.description || '(none)'}`).join('\n') +
        `\n\nWeave these thoughts into a single, cohesive thread and outline a 3-step action plan to validate or build on these ideas. Format beautifully in markdown.`
      text = await callLocalOllama(prompt, "You are a cognitive assistant synthesizing the user's daily journal and sparks.")
    } catch (e) {
      text = getMockSynthesis(todaySparks)
    }
    const updatedSynthesis = {
      ...(store.dailySynthesis ?? {}),
      [today]: {
        text,
        generatedAt: new Date().toISOString(),
        sparkIds: todaySparks.map(s => s.id)
      }
    }
    onUpdateStore({
      ...store,
      dailySynthesis: updatedSynthesis
    })
    setSynthesisLoading(false)
    setShowSynthesis(true)
  }

  const handleStartReview = () => {
    const due = sparks.filter(i => !i.srs || !i.srs.dueAt || i.srs.dueAt <= today)
      .sort((a, b) => {
        const ad = (a.srs && a.srs.dueAt) || a.createdAt || ''
        const bd = (b.srs && b.srs.dueAt) || b.createdAt || ''
        return ad.localeCompare(bd)
      })
      .slice(0, 10)
      
    if (due.length === 0) return
    
    setReviewQueue(due)
    setReviewIdx(0)
    setReviewShowDesc(false)
    setReviewOpen(true)
  }

  const handleGradeReview = (grade: 'forgot' | 'got') => {
    if (reviewIdx >= reviewQueue.length) return
    const spark = reviewQueue[reviewIdx]
    const nextSrsObj = calculateNextSrs(spark, grade)
    
    const nextSparks = sparks.map(s => 
      s.id === spark.id ? { ...s, srs: nextSrsObj } : s
    )
    
    onUpdateStore({
      ...store,
      sparks: nextSparks
    })
    
    if (reviewIdx + 1 >= reviewQueue.length) {
      setReviewOpen(false)
      setReviewQueue([])
    } else {
      setReviewIdx(reviewIdx + 1)
      setReviewShowDesc(false)
    }
  }

  const oceanSlice = useMemo(() => {
    const fetchedToday = exploreTopics.filter(t => t.oceanLastFetchedDate === today)
    if (fetchedToday.length >= 1) {
      return fetchedToday.slice(0, 10)
    }
    const sorted = [...exploreTopics].sort((a, b) => {
      const fa = a.fetchCount || 0
      const fb = b.fetchCount || 0
      if (fa !== fb) return fa - fb
      return String(b.addedAt || '').localeCompare(String(a.addedAt || ''))
    })
    return sorted.slice(0, 10)
  }, [exploreTopics, today])

  useEffect(() => {
    const sliceIds = new Set(oceanSlice.map(t => t.id))
    const alreadyStamped = oceanSlice.every(t => t.oceanLastFetchedDate === today)
    if (alreadyStamped || sliceIds.size === 0) return
    
    const nextTopics = exploreTopics.map(t => sliceIds.has(t.id)
      ? { ...t, fetchCount: (t.fetchCount || 0) + 1, oceanLastFetchedDate: today }
      : t
    )
    onUpdateStore({
      ...store,
      exploreTopics: nextTopics
    })
  }, [oceanSlice, today])

  const featuredInterest = useMemo(() => {
    if (interests.length === 0) return null
    const d = new Date(today + 'T00:00:00')
    const start = new Date(d.getFullYear(), 0, 0)
    const diff = d.getTime() - start.getTime()
    const doy = Math.floor(diff / 86400000)
    return interests[doy % interests.length]
  }, [interests, today])
  
  useEffect(() => {
    if (!featuredInterest || busyInterestId) return
    if (featuredInterest.pareto) {
      if (openInterestId === null) {
        setOpenInterestId(featuredInterest.id)
      }
      return
    }
    handleGeneratePareto(featuredInterest)
    setOpenInterestId(featuredInterest.id)
  }, [featuredInterest])

  const sparksByDate = useMemo(() => {
    const m: Record<string, Spark[]> = {}
    sparks.forEach(s => {
      const d = s.createdDate
      if (!d) return
      if (!m[d]) m[d] = []
      m[d].push(s)
    })
    return m
  }, [sparks])

  const renderWeekView = () => {
    const day = (new Date().getDay() + 6) % 7 // 0 = Monday
    const monday = new Date()
    monday.setDate(monday.getDate() - day)
    
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return sparkDateKey(d)
    })
    
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {days.map((d, ix) => {
          const items = sparksByDate[d] || []
          const isToday = d === today
          return (
            <div key={d} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 10,
              background: isToday ? 'var(--ember-tint, rgba(200, 151, 64, 0.08))' : 'var(--paper-deep, #edebe4)',
              border: `1px solid ${isToday ? 'var(--ember)' : 'var(--hairline, #e2dfd5)'}`
            }}>
              <div style={{ width: 50, flexShrink: 0 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--ink-soft, #a09e9a)', fontWeight: 600 }}>{labels[ix]}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{Number(d.slice(8))}</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--ink-faint, #605e5a)', alignSelf: 'center' }}>—</span>
                ) : (
                  items.map(s => (
                    <div key={s.id} style={{
                      fontSize: 11,
                      padding: '3px 10px',
                      borderRadius: 12,
                      background: 'var(--paper, #f5f4f0)',
                      border: '1px solid var(--hairline, #e2dfd5)',
                      color: 'var(--ink)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span className="mono" style={{ fontSize: 9, color: 'var(--ember)' }}>•</span>
                      <strong>{s.title}</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderYearView = () => {
    const y = new Date().getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => i)
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {months.map(m => {
          const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`
          const items = sparks.filter(s => (s.createdAt || '').startsWith(prefix))
          if (items.length === 0) return null
          
          return (
            <div key={m} style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--paper-deep, #edebe4)',
              border: '1px solid var(--hairline, #e2dfd5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ember)', textTransform: 'uppercase' }}>{monthNames[m]}</span>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)' }}>{items.length} spark{items.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {items.map(s => {
                  const day = s.createdAt ? Number(s.createdAt.slice(8, 10)) : null
                  return (
                    <div key={s.id} style={{
                      fontSize: 10.5,
                      padding: '3px 8px',
                      borderRadius: 8,
                      background: 'var(--paper, #f5f4f0)',
                      border: '1px solid var(--hairline, #e2dfd5)',
                      color: 'var(--ink-soft)',
                      display: 'inline-flex',
                      alignItems: 'baseline',
                      gap: 4
                    }}>
                      {day !== null && <span style={{ fontSize: 9, color: 'var(--ink-faint)' }}>{day}</span>}
                      <span>{s.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const activeCategories = (categories.length > 0 ? categories : DEFAULT_CATEGORIES).filter((cat) => resolvedActiveCatIds.includes(cat.id))

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
                  : `${doneCount} / ${total} done · ${formatMinutesLabel(consumedSec)} / ${formatMinutesLabel(allocatedSec)} watched`)
              : 'Curated from your loop'}
          </div>
          {!isSunday && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--ink-subtle)', marginRight: 2 }}>Categories of the Day:</span>
              {activeCategories.map((cat) => (
                <span
                  key={cat.id}
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    color: 'var(--ink)',
                    background: cat.color + '15',
                    border: `1px solid ${cat.color}60`,
                    padding: '2px 8px',
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                >
                  {cat.name}
                </span>
              ))}
              <button
                onClick={() => setShowCatEdit(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ember)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  textDecoration: 'underline',
                  outline: 'none'
                }}
              >
                Change
              </button>
            </div>
          )}
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

      {/* Entertainment now lives on its own top-nav screen, not as a Today
          strip. Today is back to: routine summary → daily plan → courses. */}

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

      {/* Typing Practice */}
      <div className="today-section-head" style={{ marginTop: 32 }}>
        <h2>Typing practice</h2>
        <span className="today-section-sub">15-min regimen</span>
      </div>
      <div
        style={{
          background: 'var(--card-warm, #f8f6f0)',
          border: '1px solid var(--hairline, #e6e4dc)',
          borderRadius: 16,
          padding: '18px 20px',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>⌨️</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>AeroType</span>
            <span
              style={{
                fontSize: 9,
                fontFamily: 'var(--mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                background: 'var(--ember-tint, rgba(200,151,64,0.12))',
                color: 'var(--ember, #c89740)',
                border: '1px solid var(--ember)',
                borderRadius: 6,
                padding: '2px 6px',
              }}
            >
              daily
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
            15-minute alternating drill — sentence typing → wrong-key drill → slowest-key drill.
            Tracks fault transitions and pace against your personal best.
          </p>
        </div>
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0,
            padding: '9px 18px',
            borderRadius: 10,
            background: 'var(--ember, #c89740)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            textDecoration: 'none',
            fontFamily: 'var(--mono)',
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          Start →
        </a>
      </div>

      {/* Today's Sparks Dashboard */}
      <div className="today-section-head" style={{ marginTop: 32 }}>
        <h2>Today's sparks</h2>
        <span className="today-section-sub">Capture & study</span>
      </div>

      <div className="sparks-dashboard-card" style={{
        background: 'var(--card-warm, #f8f6f0)',
        border: '1px solid var(--hairline, #e6e4dc)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        {/* Sparks Sub-tab Bar */}
        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--hairline, #e6e4dc)', paddingBottom: 12, flexWrap: 'wrap' }}>
          {[
            { id: 'captures', label: 'Captures', count: todayCaptures.length },
            { id: 'review', label: 'Review', count: srsDueCount },
            { id: 'calendar', label: 'Calendar' },
            { id: 'explore', label: 'Explore', count: store.exploreTopics?.length ?? 0 },
            { id: 'interests', label: 'Interests', count: store.interests?.length ?? 0 },
          ].map((tab) => {
            const active = activeSparksTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSparksTab(tab.id as any)}
                className="mono"
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  background: active ? 'var(--ember-tint, rgba(200, 151, 64, 0.12))' : 'transparent',
                  color: active ? 'var(--ember, #c89740)' : 'var(--ink-soft, oklch(0.402 0.020 54))',
                  border: `1px solid ${active ? 'var(--ember)' : 'transparent'}`,
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.2s ease'
                }}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{
                    fontSize: 9,
                    padding: '1px 5px',
                    borderRadius: 6,
                    background: active ? 'var(--ember)' : 'var(--paper-deep, #edebe4)',
                    color: active ? '#fff' : 'var(--ink-soft)',
                    fontWeight: 'bold'
                  }}>{tab.count}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab 1: Captures */}
        {activeSparksTab === 'captures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>


            {/* Daily Synthesis Weaving */}
            {todayCaptures.length >= 3 && (
              <div style={{
                background: 'var(--ember-tint, rgba(200, 151, 64, 0.05))',
                border: '1px solid var(--ember)',
                borderRadius: 12,
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ember)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Central Spark of Today
                  </div>
                  {dailySynthesis[today] && (
                    <button
                      onClick={handleGenerateDailySynthesis}
                      style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', fontSize: 10, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Regenerate
                    </button>
                  )}
                </div>
                
                {dailySynthesis[today] ? (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                    {dailySynthesis[today].text}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 8 }}>
                      You have captured {todayCaptures.length} sparks today. Weave them together into a unified daily synthesis essay.
                    </div>
                    <button
                      onClick={handleGenerateDailySynthesis}
                      disabled={synthesisLoading}
                      style={{
                        background: 'var(--ember)',
                        border: 'none',
                        borderRadius: 6,
                        color: '#000',
                        fontSize: 11,
                        padding: '6px 12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      {synthesisLoading ? 'Weaving sparks...' : "Weave today's sparks"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Starred section */}
            {todayStarred.length > 0 && (
              <div>
                <div className="section-rule" style={{ marginBottom: 8 }}>Starred</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {todayStarred.map(s => {
                    const meta = s.kind ? SPARK_KINDS[s.kind as SparkKind] : undefined
                    return (
                      <div key={s.id} style={{
                        background: 'var(--paper, #f5f4f0)',
                        border: '1px solid var(--hairline, #e2dfd5)',
                        borderRadius: 10,
                        padding: 10,
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <span style={{
                            fontSize: 9,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: meta?.bg || 'var(--paper-deep, #edebe4)',
                            color: meta?.color || '#fff'
                          }}>{meta?.glyph} {meta?.label}</span>
                          
                          <button
                            onClick={() => handleToggleStar(s.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--ember)" stroke="var(--ember)">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 6 }}>{s.title}</div>
                        {s.description && (
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>{s.description}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Today's Captures */}
            <div>
              <div className="section-rule" style={{ marginBottom: 8 }}>Captures from today</div>
              {todayCaptures.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  No sparks captured today yet.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {todayCaptures.map(s => {
                    const meta = s.kind ? SPARK_KINDS[s.kind as SparkKind] : undefined
                    return (
                      <div key={s.id} style={{
                        background: 'var(--paper, #f5f4f0)',
                        border: '1px solid var(--hairline, #e2dfd5)',
                        borderRadius: 10,
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span style={{
                              fontSize: 9,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: meta?.bg || 'var(--paper-deep, #edebe4)',
                              color: meta?.color || '#fff'
                            }}>{meta?.glyph} {meta?.label}</span>
                            
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => handleToggleStar(s.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill={s.starred ? 'var(--ember)' : 'none'} stroke="var(--ember)">
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              </button>
                              
                              <button
                                onClick={() => handleDeleteSpark(s.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-faint)', padding: 0 }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                          
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 6 }}>{s.title}</div>
                        </div>
                        {s.srs?.dueAt && (
                          <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', marginTop: 8, fontStyle: 'italic' }}>
                            Next review: {s.srs.dueAt}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Review (SRS Deck) */}
        {activeSparksTab === 'review' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {reviewOpen && reviewQueue.length > 0 ? (
              // Active review session
              <div style={{
                background: 'var(--paper-deep, #edebe4)',
                border: '1px solid var(--hairline, #e2dfd5)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink-soft)' }}>
                  <span>SRS Review Session</span>
                  <span>Card {reviewIdx + 1} of {reviewQueue.length}</span>
                </div>
                
                {/* Active Card */}
                <div style={{
                  background: 'var(--paper, #f5f4f0)',
                  border: '1px solid var(--hairline, #e2dfd5)',
                  borderRadius: 10,
                  padding: 16,
                  minHeight: 120,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 10
                }}>
                  <span style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: currentReviewMeta?.bg,
                    color: currentReviewMeta?.color
                  }}>
                    {currentReviewMeta?.glyph} {currentReviewMeta?.label}
                  </span>
                  
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>
                    "{currentReviewSpark?.title}"
                  </div>
                  
                  {reviewShowDesc ? (
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8, fontStyle: 'italic' }}>
                      {reviewQueue[reviewIdx].description || '(No description)'}
                    </div>
                  ) : (
                    <button
                      onClick={() => setReviewShowDesc(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--ember)',
                        fontSize: 11,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginTop: 8
                      }}
                    >
                      Show Details
                    </button>
                  )}
                </div>
                
                {/* Grade buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => handleGradeReview('forgot')}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      background: 'var(--paper, #f5f4f0)',
                      border: '1px solid rgba(255, 0, 0, 0.2)',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600
                    }}
                  >
                    Forgot it (Soon)
                  </button>
                  
                  <button
                    onClick={() => handleGradeReview('got')}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      background: 'var(--ember)',
                      color: '#000',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      fontWeight: 600
                    }}
                  >
                    Got it! (Done)
                  </button>
                </div>
                
                <button
                  onClick={() => { setReviewOpen(false); setReviewQueue([]); }}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-faint)', fontSize: 11, cursor: 'pointer', alignSelf: 'center', marginTop: 4 }}
                >
                  Cancel Session
                </button>
              </div>
            ) : (
              // Idle review state
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 12 }}>
                  {srsDueCount === 0 ? (
                    "No review cards due today. You are completely caught up! Spaced repetition schedules cards when they need to be reviewed."
                  ) : (
                    `You have ${srsDueCount} spark${srsDueCount === 1 ? '' : 's'} ready for scheduled SRS review.`
                  )}
                </div>
                
                {srsDueCount > 0 && (
                  <button
                    onClick={handleStartReview}
                    style={{
                      background: 'var(--ember)',
                      color: '#000',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 20px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: 13
                    }}
                  >
                    Start Review Session
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Calendar */}
        {activeSparksTab === 'calendar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              {(['week', 'year'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setCalendarMode(m)}
                  style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: calendarMode === m ? 'var(--paper-deep, #edebe4)' : 'transparent',
                    border: '1px solid ' + (calendarMode === m ? 'var(--hairline, #e2dfd5)' : 'transparent'),
                    color: calendarMode === m ? 'var(--ink)' : 'var(--ink-soft)',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            
            {calendarMode === 'week' ? renderWeekView() : renderYearView()}
          </div>
        )}

        {/* Tab 4: Explore (Ocean of Exploration) */}
        {activeSparksTab === 'explore' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Add topic row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newTopicText}
                onChange={e => setNewTopicText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddTopic() }}
                placeholder="Add a topic to explore..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--paper, #f5f4f0)',
                  border: '1px solid var(--hairline, #e2dfd5)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleAddTopic}
                style={{
                  padding: '0 16px',
                  borderRadius: 8,
                  background: 'var(--ember)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                + Add
              </button>
            </div>

            {/* Ocean of Exploration List */}
            <div>
              <div className="section-rule" style={{ marginBottom: 8 }}>Ocean of exploration</div>
              {oceanSlice.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  No exploration topics in your rotation yet. Add one above!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {oceanSlice.map(t => {
                    const open = openTopicId === t.id
                    return (
                      <div key={t.id} style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--paper, #f5f4f0)',
                        border: '1px solid var(--hairline, #e2dfd5)',
                        borderLeft: '4px solid #7387a8'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            onClick={() => setOpenTopicId(open ? null : t.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--ink)',
                              fontSize: 14.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0
                            }}
                          >
                            {t.text}
                          </button>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-faint)' }}>×{t.fetchCount || 1}</span>
                            <button
                              onClick={() => handleRemoveTopic(t.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--ink-faint)',
                                cursor: 'pointer',
                                fontSize: 14,
                                padding: 0
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        
                        {open && (
                          <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline, #e2dfd5)', paddingTop: 10 }}>
                            {t.pitch ? (
                              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                                {t.pitch}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGeneratePitch(t)}
                                disabled={busyTopicId === t.id}
                                style={{
                                  background: 'var(--paper-deep, #edebe4)',
                                  border: '1px solid var(--hairline, #e2dfd5)',
                                  borderRadius: 6,
                                  color: 'var(--ink)',
                                  fontSize: 11,
                                  padding: '5px 10px',
                                  cursor: 'pointer'
                                }}
                              >
                                {busyTopicId === t.id ? 'Generating pitch...' : 'Generate Pitch'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Interests (Pareto) */}
        {activeSparksTab === 'interests' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Add interest row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={newInterestName}
                onChange={e => setNewInterestName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddInterest() }}
                placeholder="e.g. watches, sharks, fountain pens..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--paper, #f5f4f0)',
                  border: '1px solid var(--hairline, #e2dfd5)',
                  color: 'var(--ink)',
                  fontSize: 13,
                  outline: 'none'
                }}
              />
              <button
                onClick={handleAddInterest}
                style={{
                  padding: '0 16px',
                  borderRadius: 8,
                  background: 'var(--ember)',
                  color: '#000',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: 13
                }}
              >
                + Add
              </button>
            </div>

            {/* Featured Pareto of the day */}
            {featuredInterest && (
              <div style={{
                background: 'var(--ember-tint, rgba(200, 151, 64, 0.05))',
                border: '1px solid var(--ember)',
                borderRadius: 12,
                padding: 14
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ember)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                  Pareto of the day (Featured Interest)
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>
                  {featuredInterest.name}
                </div>
                {featuredInterest.pareto ? (
                  <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {featuredInterest.pareto}
                  </div>
                ) : (
                  <button
                    onClick={() => handleGeneratePareto(featuredInterest)}
                    disabled={busyInterestId === featuredInterest.id}
                    style={{
                      background: 'var(--ember)',
                      border: 'none',
                      borderRadius: 6,
                      color: '#000',
                      fontSize: 11,
                      padding: '5px 10px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {busyInterestId === featuredInterest.id ? 'Generating summary...' : 'Generate Pareto summary'}
                  </button>
                )}
              </div>
            )}

            {/* General Interests List */}
            <div>
              <div className="section-rule" style={{ marginBottom: 8 }}>Your interests</div>
              {interests.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                  No interests listed yet. Add one above!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {interests.map(i => {
                    const open = openInterestId === i.id
                    return (
                      <div key={i.id} style={{
                        padding: '12px 14px',
                        borderRadius: 10,
                        background: 'var(--paper, #f5f4f0)',
                        border: '1px solid var(--hairline, #e2dfd5)',
                        borderLeft: '4px solid #a89055'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <button
                            onClick={() => setOpenInterestId(open ? null : i.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--ink)',
                              fontSize: 14.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                              textAlign: 'left',
                              padding: 0
                            }}
                          >
                            {i.name}
                          </button>
                          
                          <button
                            onClick={() => handleRemoveInterest(i.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--ink-faint)',
                              cursor: 'pointer',
                              fontSize: 14,
                              padding: 0
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        
                        {open && (
                          <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline, #e2dfd5)', paddingTop: 10 }}>
                            {i.pareto ? (
                              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {i.pareto}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGeneratePareto(i)}
                                disabled={busyInterestId === i.id}
                                style={{
                                  background: 'var(--paper-deep, #edebe4)',
                                  border: '1px solid var(--hairline, #e2dfd5)',
                                  borderRadius: 6,
                                  color: 'var(--ink)',
                                  fontSize: 11,
                                  padding: '5px 10px',
                                  cursor: 'pointer'
                                }}
                              >
                                {busyInterestId === i.id ? 'Generating summary...' : 'Generate Pareto summary'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

      {showCatEdit && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => setShowCatEdit(false)}
        >
          <div
            style={{
              background: 'var(--paper, #f5f4f0)',
              border: '1px solid var(--hairline, #e2dfd5)',
              borderRadius: 12,
              padding: 20,
              width: 320,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
              color: 'var(--ink)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Categories of the Day</h3>
              <button
                onClick={() => setShowCatEdit(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-faint)',
                  fontSize: 18,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
              {(categories.length > 0 ? categories : DEFAULT_CATEGORIES).map((cat) => {
                const active = resolvedActiveCatIds.includes(cat.id)
                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (!onUpdateActiveCategories) return
                      const nextIds = active
                        ? resolvedActiveCatIds.filter((id) => id !== cat.id)
                        : [...resolvedActiveCatIds, cat.id]
                      onUpdateActiveCategories(nextIds)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: active ? 'var(--paper-deep, #edebe4)' : 'transparent',
                      border: '1px solid transparent'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      readOnly
                      style={{ cursor: 'pointer', width: 14, height: 14 }}
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: cat.color,
                        display: 'inline-block'
                      }}
                    />
                    <span style={{ fontSize: 13, color: active ? 'var(--ink)' : 'var(--ink-subtle)' }}>
                      {cat.name}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                className="set-active-btn"
                onClick={() => setShowCatEdit(false)}
                style={{ width: '100%', padding: '8px 0', fontSize: 12.5 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ Deterministic Mock AI generators ============
async function callLocalOllama(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    const tagsRes = await fetch('http://localhost:11434/api/tags')
    if (!tagsRes.ok) throw new Error('Ollama not running')
    const tagsData = await tagsRes.json()
    const models = tagsData.models || []
    if (models.length === 0) throw new Error('No Ollama models found')
    
    let model = models[0].name
    for (const m of models) {
      const name = String(m.name).toLowerCase()
      if (name.includes('gemma') || name.includes('llama') || name.includes('mistral') || name.includes('phi')) {
        model = m.name
        break
      }
    }
    
    const messages = []
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })
    
    const chatRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false })
    })
    if (!chatRes.ok) throw new Error('Chat request failed')
    const chatData = await chatRes.json()
    return chatData.message?.content || ''
  } catch (e) {
    console.warn('Local Ollama call failed, falling back to mock:', e)
    throw e
  }
}

const MOCK_PARETOS: Record<string, string> = {
  watches: `### 80/20 of Watch Collecting & Horology
- **Focus on movements**: Understanding mechanical vs automatic vs quartz covers 80% of horological value.
- **Learn the icons**: Study the history of the Rolex Submariner, Omega Speedmaster, and Seiko 5.
- **Microbrands**: Explore Baltic, Lorier, and Halios for high-value entry points.
- **Complications**: Study Date, Chronograph, and GMT complications before high-end tourbillons.`,
  sharks: `### 80/20 of Shark Biology & Ecology
- **Anatomy & Senses**: Focus on their cartilaginous skeleton and the Ampullae of Lorenzini (electroreception).
- **Keystone Role**: Understand trophic cascades and how apex predators maintain reef health.
- **Major Orders**: Study the Carcharhiniformes (ground sharks) and Lamniformes (mackerel sharks).
- **Conservation**: Learn how the fin trade and overfishing impacts ocean ecosystem stability.`,
  'fountain pens': `### 80/20 of Fountain Pens
- **Nib Grades**: Focus on Fine vs Medium vs Broad, and steel vs gold nib characteristics.
- **Filling Systems**: Learn cartridge/converter, piston filler, and eyedropper mechanisms.
- **Paper Quality**: 80% of the writing experience depends on fountain-pen-friendly paper (e.g., Tomoe River, Rhodia).
- **Ink Chemistry**: Study dye-based vs pigment-based vs iron-gall inks.`,
}

function getMockPareto(topic: string): string {
  const t = topic.toLowerCase().trim()
  if (MOCK_PARETOS[t]) return MOCK_PARETOS[t]
  return `### 80/20 of Studying "${topic}"
- **Core Concepts**: Focus on the foundational syntax, vocabulary, or rules of ${topic} first.
- **Key Frameworks/Models**: Identify the 3 most popular libraries, tools, or theories used in the field.
- **Practical Application**: Build 2 small projects or apply the concept to a real-world problem immediately.
- **Community Consensus**: Read the top 5 introductory articles or books recommended by experts.`
}

function getMockPitch(topic: string): string {
  return `### Deep Dive: ${topic}
- **Why it matters**: Understanding ${topic} provides critical leverage for cross-disciplinary learning.
- **Key Hypothesis**: Most systems optimizing for ${topic} focus on the wrong variables. By shifting focus to foundational principles, we unlock 10x gains.
- **Recommended Action**: Dedicate a 45-minute study block to outline the core components of ${topic} and map their dependencies.`
}

function getMockSynthesis(sparks: Spark[]): string {
  const titles = sparks.map(s => `"${s.title || '(untitled)'}"`).join(', ')
  return `### daily AI synthesis
Today's reflections centered around: ${titles || 'your daily capture queue'}.

**Unified Thread**:
These sparks highlight a core theme: the need to bridge fast, intuitive capturing with structured retrospective review. By linking these thoughts, we find a logical progression from raw curiosity to actionable projects.

**Key Recommendations**:
1. Map out the overlap between these concepts.
2. Outline a 3-step action plan to validate the core ideas.`
}

