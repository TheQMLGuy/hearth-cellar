import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  Bucket,
  CategoryId,
  Channel,
  ChannelFresh,
  Course,
  CourseCategory,
  FocusConfig,
  GoogleAuth,
  LoopItem,
  Mode,
  PersistedStore,
  RoutineItem,
  Screen,
  PlaylistNotePageMapping
} from './types'
import { loadStore, saveStore, weekStartIso } from './storeClient'
import {
  autoMode,
  computeDayPlan,
  itemsForPlan,
  planIsStale,
  todayKey
} from './lib/rotation'
import {
  pollCurrentTimeFromIframes,
  postPauseToAllIframes,
  postPlayToAllIframes,
  startListeningToIframes
} from './lib/youtube'
import { Titlebar } from './components/Titlebar'
import { Today } from './components/Today'
import { Player } from './components/Player'
import { CourseFocus } from './components/CourseFocus'
import { IngestPanel } from './components/IngestPanel'
import { Courses } from './components/Courses'
import { Routine } from './components/Routine'
import { Settings } from './components/Settings'
import { Notes } from './components/Notes'
import { Wishlist } from './components/Wishlist'
import { AttachNoteModal } from './components/AttachNoteModal'
import { BreakOverlay } from './components/BreakOverlay'
import { NoteStudyView } from './components/NoteStudyView'

function formatDateLabel(d: Date = new Date()): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function recomputePlan(
  s: PersistedStore,
  channelBucketByChannelId: Record<string, Bucket>
) {
  return computeDayPlan({
    loop: s.loop,
    mode: s.mode,
    channelFresh: s.channelFresh,
    channelBucketByChannelId,
    date: todayKey(),
    sundayMinutes: s.sundayMinutes,
    sliceTargetSec: (s.sliceTargetMin ?? 30) * 60,
    categories: s.categories
  })
}

export function App() {
  const [store, setStore] = useState<PersistedStore | null>(null)
  const [screen, setScreen] = useState<Screen>('today')
  const [activeItem, setActiveItem] = useState<LoopItem | null>(null)
  const [activeCourseFocusId, setActiveCourseFocusId] = useState<string | null>(null)
  const [ingestOpen, setIngestOpen] = useState(false)
  const [attachNoteFor, setAttachNoteFor] = useState<LoopItem | null>(null)
  const [dateLabel] = useState(formatDateLabel())
  const [onBreak, setOnBreak] = useState(false)
  const [breakDurationSec, setBreakDurationSec] = useState(0)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [focusElapsedSec, setFocusElapsedSec] = useState(0)
  const focusContextRef = useRef<'video' | 'course' | null>(null)

  useEffect(() => {
    loadStore().then(async (s) => {
      const today = todayKey()
      if (!s.dailySessions || s.dailySessions.date !== today) {
        s = {
          ...s,
          dailySessions: { date: today, courseSessionsCompleted: 0, totalSessionsCompleted: 0, courseSessionsByCategory: {} }
        }
        saveStore(s)
      }
      // Ensure youtubeApiKey exists (schema migration)
      if (s.youtubeApiKey === undefined) {
        s = { ...s, youtubeApiKey: '' }
      }
      // Ensure sundayLimit exists (schema migration)
      if (s.sundayLimit === undefined) {
        s = { ...s, sundayLimit: 5 }
      }
      // Ensure playlistVideosCache exists (schema migration v7)
      if (!s.playlistVideosCache) {
        s = { ...s, playlistVideosCache: {} }
      }
      // Ensure youtubeSubscriptionsCache exists (schema migration v8)
      if (s.youtubeSubscriptionsCache === undefined) {
        s = { ...s, youtubeSubscriptionsCache: null }
      }
      // Ensure categories exist (schema migration v9)
      if (!s.categories || s.categories.length === 0) {
        const mod = await import('./lib/categories')
        s = { ...s, categories: mod.DEFAULT_CATEGORIES }
      }
      // Ensure sundayChannelWeekly exists (schema migration v10 — Sunday week roundup)
      if (!s.sundayChannelWeekly) {
        s = { ...s, sundayChannelWeekly: {} }
      }
      // Auto-sync mode to today's day so "Today" is whichever today is.
      const m = autoMode()
      if (s.mode !== m) {
        s = { ...s, mode: m, todayPlan: null }
      }
      window.hearth.setApiKey(s.youtubeApiKey)
      setStore(s)
    })
  }, [])

  const channelBucketByChannelId = useMemo(() => {
    const map: Record<string, Bucket> = {}
    if (!store) return map
    for (const ch of store.channels) map[ch.channelId] = ch.bucket
    return map
  }, [store])

  useEffect(() => {
    if (!store) return
    const today = todayKey()
    if (planIsStale(store.todayPlan, store.mode, today)) {
      const next: PersistedStore = {
        ...store,
        todayPlan: recomputePlan(store, channelBucketByChannelId)
      }
      setStore(next)
      saveStore(next)
    }
  }, [store, channelBucketByChannelId])

  const refreshedRef = useRef(false)
  useEffect(() => {
    if (!store || refreshedRef.current) return
    refreshedRef.current = true
    refreshChannelsImpl(store)
    refreshSundayWeekly(store)
  }, [store])

  const refreshChannelsImpl = useCallback(async (s: PersistedStore, force = false) => {
    if (s.channels.length === 0) return
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000
    const now = Date.now()
    const next: Record<string, ChannelFresh> = { ...s.channelFresh }

    // Only fetch channels whose cached freshness is stale or missing. Then
    // hit them in parallel (Promise.all) so wall-time scales with the SLOWEST
    // channel instead of the SUM of all channels.
    const toFetch = s.channels.filter((ch) => {
      if (force) return true
      const existing = s.channelFresh[ch.channelId]
      if (!existing || !existing.fetchedAt) return true
      const age = now - Date.parse(existing.fetchedAt)
      return age >= SIX_HOURS_MS
    })
    if (toFetch.length === 0) return

    const results = await Promise.all(
      toFetch.map((ch) => window.hearth.fetchChannelLatest(ch.channelId))
    )
    for (const res of results) {
      if (!res) continue
      next[res.channelId] = {
        channelId: res.channelId,
        videoId: res.videoId,
        title: res.title,
        publishedAt: res.publishedAt,
        fetchedAt: new Date().toISOString()
      }
    }
    setStore((prev) => {
      if (!prev) return prev
      const updated = { ...prev, channelFresh: next }
      saveStore(updated)
      return updated
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'i' || e.key === 'I')) {
        e.preventDefault()
        setIngestOpen((v) => !v)
      } else if (e.key === 'Escape') {
        if (ingestOpen) setIngestOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [ingestOpen])

  const persist = useCallback((next: PersistedStore) => {
    setStore(next)
    saveStore(next)
  }, [])

  const handleSetMode = useCallback(
    (m: Mode) => {
      if (!store) return
      const updated: PersistedStore = { ...store, mode: m }
      const next: PersistedStore = {
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      }
      persist(next)
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleSaveVideo = useCallback(
    (item: LoopItem) => {
      if (!store) return
      // Don't add the same videoId twice — silently no-op if it's already in
      // loop or done. The user pasted it a second time, the first one is
      // still around.
      if (store.loop.some((it) => it.videoId === item.videoId)) return
      if (store.done.items.some((it) => it.videoId === item.videoId)) return
      const loop = [item, ...store.loop]
      const updated: PersistedStore = { ...store, loop }
      const next: PersistedStore = {
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      }
      persist(next)
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleSaveCourse = useCallback(
    (course: Course) => {
      if (!store) return
      // New courses go to the BOTTOM of the list
      const courses = [...store.courses, course]
      persist({ ...store, courses })
    },
    [store, persist]
  )

  const handleRemoveCourse = useCallback(
    (id: string) => {
      if (!store) return
      const courses = store.courses.filter((c) => c.id !== id)
      // Clean up activeCourseByCategory
      const acbc = { ...store.activeCourseByCategory }
      for (const [catId, cId] of Object.entries(acbc)) {
        if (cId === id) delete acbc[catId]
      }
      const firstActive = Object.values(acbc)[0] ?? null
      persist({
        ...store,
        courses,
        activeCourseId: firstActive,
        activeCourseByCategory: acbc
      })
    },
    [store, persist]
  )

  const handleMoveCourse = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!store) return
      const idx = store.courses.findIndex((c) => c.id === id)
      const swap = idx + dir
      if (idx < 0 || swap < 0 || swap >= store.courses.length) return
      const courses = store.courses.slice()
      ;[courses[idx], courses[swap]] = [courses[swap], courses[idx]]
      persist({ ...store, courses })
    },
    [store, persist]
  )

  const handleSetActiveCourseForCategory = useCallback(
    (categoryId: string, courseId: string | null) => {
      if (!store) return
      const acbc = { ...store.activeCourseByCategory }
      if (courseId) {
        acbc[categoryId] = courseId
      } else {
        delete acbc[categoryId]
      }
      // Also update legacy activeCourseId for backward compat (pick the first active)
      const firstActive = Object.values(acbc)[0] ?? null
      persist({ ...store, activeCourseByCategory: acbc, activeCourseId: firstActive })
    },
    [store, persist]
  )


  const handleUpdateQuota = useCallback(
    (cat: CategoryId, value: number) => {
      if (!store) return
      const categoryQuotas = { ...store.categoryQuotas, [cat]: value }
      const updated: PersistedStore = { ...store, categoryQuotas }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleRecategorize = useCallback(
    (id: string, cat: CategoryId) => {
      if (!store) return
      const loop = store.loop.map((it) => (it.id === id ? { ...it, category: cat } : it))
      const updated: PersistedStore = { ...store, loop }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleSetItemBucket = useCallback(
    (id: string, bucket: Bucket) => {
      if (!store) return
      const loop = store.loop.map((it) => (it.id === id ? { ...it, bucket } : it))
      const updated: PersistedStore = { ...store, loop }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleDeleteVideo = useCallback(
    (id: string) => {
      if (!store) return
      const loop = store.loop.filter((it) => it.id !== id)
      const wishlist = store.wishlist.filter((it) => it.id !== id)
      const watched = store.watched.filter((v) => v !== id)
      const updated: PersistedStore = { ...store, loop, wishlist, watched }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const markWatchedNow = useCallback(
    (id: string) => {
      if (!store) return
      const watched = store.watched.includes(id) ? store.watched : [id, ...store.watched]
      const loop = store.loop.map((it) =>
        it.id === id ? { ...it, lastWatchedAt: new Date().toISOString() } : it
      )
      persist({ ...store, watched, loop })
    },
    [store, persist]
  )

  const handleToggleWatched = useCallback(
    (id: string) => {
      if (!store) return
      const has = store.watched.includes(id)
      const watched = has ? store.watched.filter((v) => v !== id) : [id, ...store.watched]
      const loop = has
        ? store.loop
        : store.loop.map((it) => (it.id === id ? { ...it, lastWatchedAt: new Date().toISOString() } : it))
      persist({ ...store, watched, loop })
    },
    [store, persist]
  )

  const handleMarkCourseVideoWatched = useCallback(
    (courseId: string, videoId: string, mark: boolean) => {
      if (!store) return
      const current = store.watchedByCourse[courseId] ?? []
      const next = mark
        ? Array.from(new Set([...current, videoId]))
        : current.filter((v) => v !== videoId)
      persist({
        ...store,
        watchedByCourse: { ...store.watchedByCourse, [courseId]: next }
      })
    },
    [store, persist]
  )

  // Compute Monday 00:00 local time as the "week start" for Sunday roundup.
  function weekStartIso(now = new Date()): string {
    const d = new Date(now)
    const dow = d.getDay() // 0=Sun .. 6=Sat
    const offset = dow === 0 ? 6 : dow - 1 // days since Monday
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - offset)
    return d.toISOString()
  }

  // Unified channel refresh: pulls the week's uploads for EVERY channel
  // (WKDY and SUN), auto-ingesting each new video as a real LoopItem using
  // the channel's own bucket + category. Shorts are dropped server-side in
  // the Rust fetcher.
  const refreshSundayWeekly = useCallback(async (s: import('./types').PersistedStore, force = false) => {
    if (s.channels.length === 0) return
    const ws = weekStartIso()
    const HOUR_MS = 60 * 60 * 1000
    const now = Date.now()
    const nextCache = { ...s.sundayChannelWeekly }
    const existingVideoIds = new Set([
      ...s.loop.map((i) => i.videoId),
      ...s.done.items.map((i) => i.videoId)
    ])
    const newLoopItems: LoopItem[] = []
    let cacheChanged = false

    // Decide which channels actually need a network round trip; everything
    // else is fresh enough in the cache.
    const toFetch = s.channels.filter((ch) => {
      if (force) return true
      const existing = nextCache[ch.channelId]
      return !existing
        || existing.weekStart !== ws
        || now - Date.parse(existing.fetchedAt) >= HOUR_MS
    })

    // Run all the fetches in parallel — wall time = slowest channel, not sum.
    const fetched = await Promise.all(
      toFetch.map(async (ch) => ({
        channel: ch,
        videos: await window.hearth.fetchChannelRecent(ch.channelId, ws)
      }))
    )
    for (const { channel: ch, videos } of fetched) {
      nextCache[ch.channelId] = {
        channelId: ch.channelId,
        weekStart: ws,
        fetchedAt: new Date().toISOString(),
        videos
      }
      cacheChanged = true
      for (const v of videos) {
        if (existingVideoIds.has(v.videoId)) continue
        existingVideoIds.add(v.videoId)
        newLoopItems.push({
          id: `chn_${v.videoId}`,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          videoId: v.videoId,
          title: v.title,
          creator: ch.name,
          duration: '',
          category: ch.category,
          bucket: ch.bucket,
          addedAt: v.publishedAt,
          paras: [],
          lastWatchedAt: null
        })
      }
    }
    if (cacheChanged || newLoopItems.length > 0) {
      setStore((prev) => {
        if (!prev) return prev
        // Dedup against BOTH loop AND this week's done bucket — channel
        // auto-ingest was re-introducing videoIds users had just skipped or
        // watched. The skipped/watched item should stay in `done` until
        // Monday clears it, not bounce back into `loop` on the next refresh.
        const liveExisting = new Set([
          ...prev.loop.map((i) => i.videoId),
          ...prev.done.items.map((i) => i.videoId)
        ])
        const trulyNew = newLoopItems.filter((it) => !liveExisting.has(it.videoId))
        const loop = trulyNew.length > 0 ? [...trulyNew, ...prev.loop] : prev.loop
        const shouldRecompute = trulyNew.length > 0
        const interim: import('./types').PersistedStore = {
          ...prev,
          sundayChannelWeekly: nextCache,
          loop
        }
        const updated: import('./types').PersistedStore = {
          ...interim,
          todayPlan: shouldRecompute ? recomputePlan(interim, channelBucketByChannelId) : prev.todayPlan
        }
        saveStore(updated)
        return updated
      })
    }
  }, [channelBucketByChannelId])

  const handleAddChannel = useCallback(
    (channel: Channel) => {
      if (!store) return
      persist({ ...store, channels: [channel, ...store.channels] })
      // Kick off Sunday weekly fetch immediately if this is a SUN channel
      if (channel.bucket === 'SUN') {
        refreshSundayWeekly({ ...store, channels: [channel, ...store.channels] }, true)
      }
      window.hearth.fetchChannelLatest(channel.channelId).then((res) => {
        if (!res) return
        setStore((prev) => {
          if (!prev) return prev
          const updated = {
            ...prev,
            channelFresh: {
              ...prev.channelFresh,
              [res.channelId]: {
                channelId: res.channelId,
                videoId: res.videoId,
                title: res.title,
                publishedAt: res.publishedAt,
                fetchedAt: new Date().toISOString()
              }
            }
          }
          saveStore(updated)
          return updated
        })
      })
    },
    [store, persist]
  )

  const handleRemoveChannel = useCallback(
    (id: string) => {
      if (!store) return
      const ch = store.channels.find((c) => c.id === id)
      const channels = store.channels.filter((c) => c.id !== id)
      const channelFresh = { ...store.channelFresh }
      if (ch) delete channelFresh[ch.channelId]
      persist({ ...store, channels, channelFresh })
    },
    [store, persist]
  )

  const handleSetChannelBucket = useCallback(
    (id: string, bucket: Bucket) => {
      if (!store) return
      const channels = store.channels.map((c) => (c.id === id ? { ...c, bucket } : c))
      const updated = { ...store, channels }
      persist(updated)
      // If the channel just became SUN, fetch its week's uploads immediately.
      if (bucket === 'SUN') refreshSundayWeekly(updated, true)
    },
    [store, persist, refreshSundayWeekly]
  )

  const handleSetChannelCategory = useCallback(
    (id: string, category: CategoryId) => {
      if (!store) return
      const channels = store.channels.map((c) => (c.id === id ? { ...c, category } : c))
      persist({ ...store, channels })
    },
    [store, persist]
  )

  const handleImportChannels = useCallback(
    (newChannels: Channel[]) => {
      if (!store) return
      const have = new Set(store.channels.map((c) => c.channelId))
      const additions = newChannels.filter((c) => !have.has(c.channelId))
      if (additions.length === 0) return
      const channels = [...additions, ...store.channels]
      const updated = { ...store, channels }
      persist(updated)
      // If any imports are SUN, kick off the weekly fetch + auto-ingest
      if (additions.some((c) => c.bucket === 'SUN')) {
        refreshSundayWeekly(updated, true)
      }
      // Fetch latest for each imported channel in background
      for (const ch of additions) {
        window.hearth.fetchChannelLatest(ch.channelId).then((res) => {
          if (!res) return
          setStore((prev) => {
            if (!prev) return prev
            const updated = {
              ...prev,
              channelFresh: {
                ...prev.channelFresh,
                [res.channelId]: {
                  channelId: res.channelId,
                  videoId: res.videoId,
                  title: res.title,
                  publishedAt: res.publishedAt,
                  fetchedAt: new Date().toISOString()
                }
              }
            }
            saveStore(updated)
            return updated
          })
        })
      }
    },
    [store, persist, refreshSundayWeekly]
  )

  const handlePlaylistVideosFetched = useCallback(
    (playlistId: string, videos: import('./types').PlaylistVideo[]) => {
      setStore((prev) => {
        if (!prev) return prev
        const next: PersistedStore = {
          ...prev,
          playlistVideosCache: {
            ...prev.playlistVideosCache,
            [playlistId]: { videos, fetchedAt: new Date().toISOString() }
          }
        }
        saveStore(next)
        return next
      })
    },
    []
  )

  const handleAddRoutine = useCallback(
    (item: RoutineItem) => {
      if (!store) return
      persist({ ...store, routine: [...store.routine, item] })
    },
    [store, persist]
  )

  const handleSaveToWishlist = useCallback(
    (item: LoopItem) => {
      if (!store) return
      // Don't double-add the same videoId.
      if (store.wishlist.some((w) => w.videoId === item.videoId)) return
      if (store.loop.some((l) => l.videoId === item.videoId)) return
      persist({ ...store, wishlist: [item, ...store.wishlist] })
    },
    [store, persist]
  )

  const handleRemoveFromWishlist = useCallback(
    (id: string) => {
      if (!store) return
      persist({ ...store, wishlist: store.wishlist.filter((w) => w.id !== id) })
    },
    [store, persist]
  )

  const handlePromoteWishlistToLoop = useCallback(
    (id: string) => {
      if (!store) return
      const item = store.wishlist.find((w) => w.id === id)
      if (!item) return
      // Reuse handleSaveVideo's dedup rules — if already in loop or done,
      // don't double-insert. Drop from wishlist either way.
      const inLoop = store.loop.some((l) => l.videoId === item.videoId)
      const inDone = store.done.items.some((d) => d.videoId === item.videoId)
      const wishlist = store.wishlist.filter((w) => w.id !== id)
      if (inLoop || inDone) {
        persist({ ...store, wishlist })
        return
      }
      // Replace the wsh_ id with an itm_ id so it matches normal loop items.
      const promoted: LoopItem = { ...item, id: item.id.replace(/^wsh_/, 'itm_') }
      const loop = [promoted, ...store.loop]
      const interim: PersistedStore = { ...store, loop, wishlist }
      persist({
        ...interim,
        todayPlan: recomputePlan(interim, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleSetWishlistBucket = useCallback(
    (id: string, bucket: Bucket) => {
      if (!store) return
      const wishlist = store.wishlist.map((w) => (w.id === id ? { ...w, bucket } : w))
      persist({ ...store, wishlist })
    },
    [store, persist]
  )

  const handleToggleFavorite = useCallback(
    (id: string) => {
      if (!store) return
      const inWishlist = store.wishlist.find((w) => w.id === id || w.videoId === id)
      if (inWishlist) {
        handlePromoteWishlistToLoop(inWishlist.id)
      } else {
        const inLoop = store.loop.find((l) => l.id === id || l.videoId === id)
        if (inLoop) {
          const wishId = inLoop.id.startsWith('itm_') ? inLoop.id.replace(/^itm_/, 'wsh_') : `wsh_${inLoop.id}`
          const wishItem: LoopItem = { ...inLoop, id: wishId }
          const wishlist = [wishItem, ...store.wishlist]
          const loop = store.loop.filter((l) => l.id !== inLoop.id)
          const interim: PersistedStore = { ...store, loop, wishlist }
          persist({
            ...interim,
            todayPlan: recomputePlan(interim, channelBucketByChannelId)
          })
          if (activeItem && (activeItem.id === id || activeItem.videoId === id)) {
            setActiveItem(null)
            setScreen('today')
          }
        }
      }
    },
    [store, persist, handlePromoteWishlistToLoop, activeItem, channelBucketByChannelId]
  )

  const handleRemoveRoutine = useCallback(
    (id: string) => {
      if (!store) return
      const routine = store.routine.filter((r) => r.id !== id)
      const routineDoneByDay = { ...store.routineDoneByDay }
      for (const day of Object.keys(routineDoneByDay)) {
        routineDoneByDay[day] = (routineDoneByDay[day] ?? []).filter((rid) => rid !== id)
      }
      persist({ ...store, routine, routineDoneByDay })
    },
    [store, persist]
  )

  const handleToggleRoutineDone = useCallback(
    (id: string) => {
      if (!store) return
      const today = todayKey()
      const cur = store.routineDoneByDay[today] ?? []
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      persist({
        ...store,
        routineDoneByDay: { ...store.routineDoneByDay, [today]: next }
      })
    },
    [store, persist]
  )

  const handleAddCategory = useCallback(
    (cat: import('./types').Category) => {
      if (!store) return
      if (store.categories.some((c) => c.id === cat.id)) return
      persist({
        ...store,
        categories: [...store.categories, cat],
        categoryQuotas: { ...store.categoryQuotas, [cat.id]: 1 }
      })
    },
    [store, persist]
  )

  const handleUpdateCategory = useCallback(
    (id: string, patch: Partial<import('./types').Category>) => {
      if (!store) return
      const categories = store.categories.map((c) => (c.id === id ? { ...c, ...patch } : c))
      const updated: PersistedStore = { ...store, categories }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleDeleteCategory = useCallback(
    (id: string) => {
      if (!store) return
      if (store.categories.length <= 1) return // never delete the last one
      const remaining = store.categories.filter((c) => c.id !== id)
      const fallback = remaining[0].id
      // Migrate any items/channels using this category to the first remaining one
      const loop = store.loop.map((it) => (it.category === id ? { ...it, category: fallback } : it))
      const channels = store.channels.map((ch) => (ch.category === id ? { ...ch, category: fallback } : ch))
      const categoryQuotas = { ...store.categoryQuotas }
      delete categoryQuotas[id]
      const updated: PersistedStore = {
        ...store,
        categories: remaining,
        loop,
        channels,
        categoryQuotas
      }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleSetCourseOrder = useCallback(
    (id: string, order: import('./types').PlaylistOrder, manualOrder?: string[]) => {
      if (!store) return
      const courses = store.courses.map((c) =>
        c.id === id ? { ...c, order, ...(manualOrder ? { manualOrder } : {}) } : c
      )
      persist({ ...store, courses })
    },
    [store, persist]
  )

  // ─── Course category handlers ──────────────────────────────────
  const handleSetCourseCategory = useCallback(
    (courseId: string, categoryId: string | null) => {
      if (!store) return
      const courses = store.courses.map((c) =>
        c.id === courseId ? { ...c, category: categoryId ?? undefined } : c
      )
      // Clear orphaned "active" pointers — if this course was active in any
      // OTHER category, that reference is now stale (the course no longer
      // lives in that category). Keep the entry only for the new category.
      const newCatKey = categoryId ?? '__uncategorized__'
      const acbc: Record<string, string> = { ...store.activeCourseByCategory }
      for (const [catId, cId] of Object.entries(acbc)) {
        if (cId === courseId && catId !== newCatKey) {
          delete acbc[catId]
        }
      }
      persist({ ...store, courses, activeCourseByCategory: acbc })
    },
    [store, persist]
  )

  /**
   * Reorder a course within (or into) a category.
   *   - beforeId === null → push to end of the column
   *   - beforeId === <id> → insert dragged course immediately before <id>
   * The kanban columns derive their order from store.courses' global order,
   * so we just splice the global array. If the drop crosses categories,
   * we also flip the dragged course's `category`.
   */
  const handleReorderCourse = useCallback(
    (draggedId: string, targetCategoryId: string | null, beforeId: string | null) => {
      if (!store) return
      const dragged = store.courses.find((c) => c.id === draggedId)
      if (!dragged) return
      const newCat = targetCategoryId ?? undefined
      const without = store.courses.filter((c) => c.id !== draggedId)
      const repositioned: Course = { ...dragged, category: newCat }
      let next: Course[]
      if (beforeId === null) {
        next = [...without, repositioned]
      } else {
        const idx = without.findIndex((c) => c.id === beforeId)
        if (idx < 0) {
          next = [...without, repositioned]
        } else {
          next = [...without.slice(0, idx), repositioned, ...without.slice(idx)]
        }
      }
      // Same orphan-cleanup as handleSetCourseCategory.
      const newCatKey = targetCategoryId ?? '__uncategorized__'
      const acbc: Record<string, string> = { ...store.activeCourseByCategory }
      for (const [catId, cId] of Object.entries(acbc)) {
        if (cId === draggedId && catId !== newCatKey) delete acbc[catId]
      }
      persist({ ...store, courses: next, activeCourseByCategory: acbc })
    },
    [store, persist]
  )

  const handleAddCourseCategory = useCallback(
    (cat: CourseCategory) => {
      if (!store) return
      if (store.courseCategories.some((c) => c.id === cat.id)) return
      persist({ ...store, courseCategories: [...store.courseCategories, cat] })
    },
    [store, persist]
  )

  const handleUpdateCourseCategory = useCallback(
    (id: string, patch: Partial<CourseCategory>) => {
      if (!store) return
      const courseCategories = store.courseCategories.map((c) =>
        c.id === id ? { ...c, ...patch } : c
      )
      persist({ ...store, courseCategories })
    },
    [store, persist]
  )

  const handleDeleteCourseCategory = useCallback(
    (id: string) => {
      if (!store) return
      // Move courses in this category to uncategorized
      const courses = store.courses.map((c) =>
        c.category === id ? { ...c, category: undefined } : c
      )
      const courseCategories = store.courseCategories.filter((c) => c.id !== id)
      const acbc = { ...store.activeCourseByCategory }
      delete acbc[id]
      persist({ ...store, courses, courseCategories, activeCourseByCategory: acbc })
    },
    [store, persist]
  )

  const handleSubsFetched = useCallback(
    (subs: import('./types').YouTubeSubscription[]) => {
      setStore((prev) => {
        if (!prev) return prev
        const next: PersistedStore = {
          ...prev,
          youtubeSubscriptionsCache:
            subs.length === 0
              ? null
              : { subs, fetchedAt: new Date().toISOString() }
        }
        saveStore(next)
        return next
      })
    },
    []
  )

  const handleUpdateGoogleAuth = useCallback(
    (next: GoogleAuth) => {
      if (!store) return
      persist({ ...store, googleAuth: next })
    },
    [store, persist]
  )

  const handleUpdateApiKey = useCallback(
    (key: string) => {
      if (!store) return
      window.hearth.setApiKey(key)
      persist({ ...store, youtubeApiKey: key })
    },
    [store, persist]
  )

  const handleUpdateSundayLimit = useCallback(
    (n: number) => {
      if (!store) return
      const updated: PersistedStore = { ...store, sundayLimit: n }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleUpdateSliceTargetMin = useCallback(
    (n: number) => {
      if (!store) return
      const updated: PersistedStore = { ...store, sliceTargetMin: n }
      persist({ ...updated, todayPlan: recomputePlan(updated, channelBucketByChannelId) })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleUpdateSundayMinutes = useCallback(
    (n: number) => {
      if (!store) return
      const updated: PersistedStore = { ...store, sundayMinutes: n }
      persist({ ...updated, todayPlan: recomputePlan(updated, channelBucketByChannelId) })
    },
    [store, persist, channelBucketByChannelId]
  )

  // Track concurrent sync operations with a counter so day-rollover + duration
  // backfill don't fight over a single boolean — either one finishing would
  // hide the spinner while the other was still running. Counter only hits 0
  // when every operation has reset.
  //
  // Watchdog: if every code path's finally somehow fails to fire, the spinner
  // could stick on forever. A timer armed by every beginSync and cleared by
  // every endSync forces a reset at 45s — bounded duration, no matter what.
  const syncCountRef = useRef(0)
  const syncWatchdogRef = useRef<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const armSyncWatchdog = useCallback(() => {
    if (syncWatchdogRef.current !== null) {
      window.clearTimeout(syncWatchdogRef.current)
    }
    syncWatchdogRef.current = window.setTimeout(() => {
      syncCountRef.current = 0
      setSyncing(false)
      syncWatchdogRef.current = null
    }, 45_000)
  }, [])
  const clearSyncWatchdog = useCallback(() => {
    if (syncWatchdogRef.current !== null) {
      window.clearTimeout(syncWatchdogRef.current)
      syncWatchdogRef.current = null
    }
  }, [])
  const beginSync = useCallback(() => {
    syncCountRef.current += 1
    setSyncing(true)
    armSyncWatchdog()
  }, [armSyncWatchdog])
  const endSync = useCallback(() => {
    syncCountRef.current = Math.max(0, syncCountRef.current - 1)
    if (syncCountRef.current === 0) {
      setSyncing(false)
      clearSyncWatchdog()
    } else {
      armSyncWatchdog()
    }
  }, [armSyncWatchdog, clearSyncWatchdog])

  const handleRefreshTodayPlan = useCallback(async () => {
    if (!store) return
    beginSync()
    try {
      // 1. Refresh channels AND Sunday weekly in parallel — they hit YouTube
      // independently and don't share state. Wall time = max(both) instead
      // of sum, which is what made the rollover sync feel laggy.
      await Promise.all([
        refreshChannelsImpl(store, true),
        refreshSundayWeekly(store, true)
      ])
      // 2. After those updates settled, recompute the plan & log lastRefreshAt.
      setStore((prev) => {
        if (!prev) return prev
        const todayPlan = recomputePlan(prev, channelBucketByChannelId)
        const nowIso = new Date().toISOString()
        const wkStart = weekStartIso()
        const isNewWeek = prev.done.weekStart !== wkStart
        const updated: PersistedStore = {
          ...prev,
          todayPlan,
          lastRefreshAt: nowIso,
          done: isNewWeek ? { weekStart: wkStart, items: [] } : prev.done
        }
        saveStore(updated)
        return updated
      })
    } finally {
      endSync()
    }
  }, [store, channelBucketByChannelId, refreshChannelsImpl, refreshSundayWeekly, beginSync, endSync])

  // One-shot duration backfill. Items that came in via channel auto-ingest
  // carry `duration: ''` and no `durationSec`. The day plan packer treats
  // those as unknown and uses a 10-minute placeholder, so the visible
  // schedule looks under-budget. On first load, walk the loop and fetch real
  // durations for anything missing them; on completion, recompute the plan
  // so tiles show accurate lengths and the packer fills to your minute budget.
  const backfilledRef = useRef(false)
  // Lightweight progress signal for the background backfill — distinct from
  // the main syncing pill, which only fires for user-driven operations.
  const [backfillRemaining, setBackfillRemaining] = useState<{ done: number; total: number } | null>(null)
  useEffect(() => {
    if (!store || backfilledRef.current) return
    backfilledRef.current = true
    const needs = store.loop.filter((it) => !it.durationSec || it.durationSec === 0)
    if (needs.length === 0) return
    let cancelled = false
    ;(async () => {
      try {
        setBackfillRemaining({ done: 0, total: needs.length })
        const updates: Record<string, { duration: string; durationSec: number }> = {}
        const queue = needs.slice()
        let completed = 0
        const worker = async () => {
          while (queue.length > 0 && !cancelled) {
            const it = queue.shift()!
            const meta = await window.hearth.fetchVideoMeta(it.videoId)
            if (meta && typeof meta.durationSec === 'number' && meta.durationSec > 0) {
              updates[it.id] = {
                duration: meta.duration ?? '',
                durationSec: meta.durationSec
              }
            }
            completed += 1
            if (!cancelled) {
              setBackfillRemaining({ done: completed, total: needs.length })
            }
          }
        }
        await Promise.all([worker(), worker(), worker(), worker(), worker()])
        if (cancelled || Object.keys(updates).length === 0) return
        setStore((prev) => {
          if (!prev) return prev
          const loop = prev.loop.map((it) => (updates[it.id] ? { ...it, ...updates[it.id] } : it))
          const interim: PersistedStore = { ...prev, loop }
          const updated: PersistedStore = {
            ...interim,
            todayPlan: recomputePlan(interim, channelBucketByChannelId)
          }
          saveStore(updated)
          return updated
        })
      } finally {
        if (!cancelled) setBackfillRemaining(null)
      }
    })()
    return () => { cancelled = true; setBackfillRemaining(null) }
  }, [store, channelBucketByChannelId])

  // Day-rollover detection. On first load, if the calendar date has changed
  // since the last logged sync, trigger a full refresh (channels + Sunday
  // weekly + plan + done-on-Monday). Runs once per store load.
  const rolloverCheckedRef = useRef(false)
  useEffect(() => {
    if (!store || rolloverCheckedRef.current) return
    const todayKeyNow = todayKey()
    const lastKey = store.lastRefreshAt ? todayKey(new Date(store.lastRefreshAt)) : null
    const wkStart = weekStartIso()
    const newWeek = store.done.weekStart !== wkStart
    if (lastKey === todayKeyNow && !newWeek) {
      rolloverCheckedRef.current = true
      return
    }
    rolloverCheckedRef.current = true
    handleRefreshTodayPlan()
  }, [store, handleRefreshTodayPlan])

  const handleRestoreFromQuarantine = useCallback(
    (id: string) => {
      if (!store) return
      const item = store.shortsQuarantine.find((it) => it.id === id)
      if (!item) return
      const loop = [item, ...store.loop]
      const shortsQuarantine = store.shortsQuarantine.filter((it) => it.id !== id)
      persist({ ...store, loop, shortsQuarantine })
    },
    [store, persist]
  )

  const handleDeleteFromQuarantine = useCallback(
    (id: string) => {
      if (!store) return
      persist({ ...store, shortsQuarantine: store.shortsQuarantine.filter((it) => it.id !== id) })
    },
    [store, persist]
  )

  const handleAttachNote = useCallback(
    (itemId: string, ref: import('./types').RemarkableNoteRef) => {
      if (!store) return
      // Item may live in loop OR done.items — patch wherever it is.
      const loop = store.loop.map((it) => (it.id === itemId ? { ...it, note: ref } : it))
      const done = {
        ...store.done,
        items: store.done.items.map((it) => (it.id === itemId ? { ...it, note: ref } : it))
      }
      persist({ ...store, loop, done })
    },
    [store, persist]
  )

  const handleDetachNote = useCallback(
    (itemId: string) => {
      if (!store) return
      const loop = store.loop.map((it) => (it.id === itemId ? { ...it, note: undefined } : it))
      const done = {
        ...store.done,
        items: store.done.items.map((it) => (it.id === itemId ? { ...it, note: undefined } : it))
      }
      persist({ ...store, loop, done })
    },
    [store, persist]
  )

  const handleRestoreFromDone = useCallback(
    (itemId: string) => {
      if (!store) return
      const item = store.done.items.find((it) => it.id === itemId)
      if (!item) return
      // Reset its part progress so today's plan can pick it up again.
      const restored: LoopItem = { ...item, partsConsumed: 0 }
      const done = { ...store.done, items: store.done.items.filter((it) => it.id !== itemId) }
      const loop = [...store.loop, restored]
      const progress = { ...store.progress }
      delete progress[item.videoId]
      persist({ ...store, loop, done, progress })
    },
    [store, persist]
  )

  const handleClearDone = useCallback(() => {
    if (!store) return
    persist({
      ...store,
      done: { weekStart: weekStartIso(), items: [] }
    })
  }, [store, persist])

  // Skip a tile from today. We do NOT recompute the whole plan — that would
  // also drop already-completed tiles (since done items aren't in loop, a
  // fresh recompute can't see them) and replace them with new picks, which
  // is the cascading-skip bug. Instead: drop the skipped part from the
  // current plan, compute a fresh plan only to mine a replacement that
  // isn't already in the plan, and slot it into the skipped position.
  const handleSkipFromToday = useCallback(
    (itemId: string) => {
      if (!store) return
      const item = store.loop.find((it) => it.id === itemId)
      if (!item) return

      // Move skipped item out of loop into this week's done bucket.
      const loop = store.loop.filter((it) => it.id !== itemId)
      const done = {
        weekStart: store.done.weekStart,
        items: [
          { ...item, lastWatchedAt: new Date().toISOString() },
          ...store.done.items.filter((d) => d.id !== itemId)
        ]
      }
      const interim: PersistedStore = { ...store, loop, done }

      const currentParts = store.todayPlan?.parts ?? []
      const skippedIdx = currentParts.findIndex((p) => p.itemId === itemId)
      const keptParts = currentParts.filter((p) => p.itemId !== itemId)

      // Mine a fresh plan for a replacement that isn't already on screen.
      const fresh = recomputePlan(interim, channelBucketByChannelId)
      const keptItemIds = new Set(keptParts.map((p) => p.itemId))
      const replacement = (fresh.parts ?? []).find((p) => !keptItemIds.has(p.itemId))

      const newParts = replacement
        ? [
            ...keptParts.slice(0, skippedIdx),
            replacement,
            ...keptParts.slice(skippedIdx)
          ]
        : keptParts

      const newPlan: import('./types').DayPlan = {
        date: store.todayPlan?.date ?? todayKey(),
        mode: store.todayPlan?.mode ?? store.mode,
        itemIds: Array.from(new Set(newParts.map((p) => p.itemId))),
        freshChannelVideoIds: store.todayPlan?.freshChannelVideoIds ?? [],
        parts: newParts
      }

      persist({ ...interim, todayPlan: newPlan })
    },
    [store, persist, channelBucketByChannelId]
  )

  const [playlistNoteTarget, setPlaylistNoteTarget] = useState<{
    courseId: string
    videoId: string
    title: string
    courseTitle: string
  } | null>(null)

  const handleAttachPlaylistNote = useCallback(
    (courseId: string, videoId: string, courseTitle: string, videoTitle: string, ref: import('./types').RemarkableNoteRef) => {
      if (!store) return
      const key = `${courseId}:${videoId}`
      const existing = store.playlistNotes[key]
      const playlistNotes: typeof store.playlistNotes = {
        ...store.playlistNotes,
        [key]: {
          courseId,
          videoId,
          videoTitle,
          courseTitle,
          watchedAt: existing?.watchedAt ?? null,
          note: ref
        }
      }
      persist({ ...store, playlistNotes })
    },
    [store, persist]
  )

  const handleDetachPlaylistNote = useCallback(
    (courseId: string, videoId: string) => {
      if (!store) return
      const key = `${courseId}:${videoId}`
      const playlistNotes = { ...store.playlistNotes }
      delete playlistNotes[key]
      persist({ ...store, playlistNotes })
    },
    [store, persist]
  )

  const handleSaveNoteMappings = useCallback(
    (noteKey: string, mappings: PlaylistNotePageMapping[], pdfPath?: string) => {
      if (!store) return
      setStore((prev) => {
        if (!prev) return prev
        const playlistNotes = { ...prev.playlistNotes }
        if (playlistNotes[noteKey]) {
          playlistNotes[noteKey] = {
            ...playlistNotes[noteKey],
            pageMappings: mappings
          }
          if (pdfPath) {
            playlistNotes[noteKey].note = {
              ...playlistNotes[noteKey].note,
              source: 'local',
              docUuid: pdfPath,
              lastSyncedAt: new Date().toISOString()
            }
          }
        } else {
          const videoId = noteKey.replace(/^global:/, '')
          const item = prev.loop.find((l) => l.videoId === videoId) || prev.done.items.find((d) => d.videoId === videoId)
          if (item) {
            playlistNotes[noteKey] = {
              courseId: 'global',
              videoId: item.videoId,
              videoTitle: item.title,
              courseTitle: 'General',
              watchedAt: item.lastWatchedAt,
              note: item.note || {
                source: 'local',
                docUuid: pdfPath || '',
                label: 'Local Note',
                lastUpdatedAt: new Date().toISOString(),
                lastSyncedAt: new Date().toISOString()
              },
              pageMappings: mappings
            }
          }
        }

        let loop = prev.loop
        let done = prev.done
        if (noteKey.startsWith('global:')) {
          const videoId = noteKey.replace(/^global:/, '')
          loop = prev.loop.map((it) => {
            if (it.videoId === videoId) {
              const updatedNote = { ...it.note, source: 'local', docUuid: pdfPath || it.note?.docUuid || '' } as any
              return { ...it, note: updatedNote }
            }
            return it
          })
          done = {
            ...prev.done,
            items: prev.done.items.map((it) => {
              if (it.videoId === videoId) {
                const updatedNote = { ...it.note, source: 'local', docUuid: pdfPath || it.note?.docUuid || '' } as any
                return { ...it, note: updatedNote }
              }
              return it
            })
          }
        }

        const interim = { ...prev, playlistNotes, loop, done }
        saveStore(interim)
        return interim
      })
    },
    [store]
  )

  const handleMoveLater = useCallback(
    (id: string) => {
      if (!store) return
      const loop = store.loop.map((it) => {
        if (it.id === id) {
          return {
            ...it,
            lastWatchedAt: new Date().toISOString()
          }
        }
        return it
      })
      const watched = store.watched.filter((wId) => wId !== id)
      const updated: PersistedStore = { ...store, loop, watched }
      persist({
        ...updated,
        todayPlan: recomputePlan(updated, channelBucketByChannelId)
      })
    },
    [store, persist, channelBucketByChannelId]
  )

  const handleRefreshChannels = useCallback(() => {
    if (!store) return
    refreshChannelsImpl(store, true)
    refreshSundayWeekly(store, true)
  }, [store, refreshChannelsImpl])

  const handleUpdateFocus = useCallback(
    (cfg: FocusConfig) => {
      if (!store) return
      persist({ ...store, focusConfig: cfg })
    },
    [store, persist]
  )

  const handleClearAll = useCallback(() => {
    if (!store) return
    persist({
      schemaVersion: store.schemaVersion,
      mode: autoMode(),
      loop: [],
      todayPlan: null,
      courses: [],
      categoryQuotas: store.categoryQuotas,
      activeCourseId: null,
      watched: [],
      watchedByCourse: {},
      channels: [],
      channelFresh: {},
      focusConfig: store.focusConfig,
      dailySessions: { date: todayKey(), courseSessionsCompleted: 0, totalSessionsCompleted: 0, courseSessionsByCategory: {} },
      routine: [],
      routineDoneByDay: {},
      googleAuth: store.googleAuth,
      youtubeApiKey: store.youtubeApiKey,
      sundayLimit: store.sundayLimit,
      playlistVideosCache: {},
      youtubeSubscriptionsCache: null,
      categories: store.categories,
      sundayChannelWeekly: {},
      progress: {},
      sliceTargetMin: store.sliceTargetMin ?? 30,
      sundayMinutes: store.sundayMinutes ?? 90,
      shortsQuarantine: [],
      remarkable: store.remarkable ?? { paired: false },
      done: { weekStart: weekStartIso(), items: [] },
      lastRefreshAt: undefined,
      playlistNotes: {},
      courseCategories: store.courseCategories,
      activeCourseByCategory: {},
      wishlist: []
    })
    setScreen('today')
  }, [store, persist])

  // ============ YouTube iframe listener (state + currentTime → progress) ============
  // Each video iframe is tagged with `data-video-id` so incoming infoDelivery
  // events can be attributed by walking from MessageEvent.source back to its
  // iframe and reading the attribute. Per-video in-memory caches live in
  // progressByVideoRef so we can flush multiple videos correctly across course
  // navigation.
  //
  // TODO (future): key progress by `itemId` rather than `videoId`. If two
  // iframes ever render the same videoId concurrently (e.g. a future
  // split-pane layout where Player + CourseFocus show the same video), the
  // current keying makes the last write win and one panel's progress
  // overwrites the other's. Requires a schema migration so deferring.
  const progressByVideoRef = useRef<Record<string, { sec: number; dur: number }>>({})

  function resolveVideoIdFromSource(source: MessageEventSource | null): string | null {
    if (!source) return null
    const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[data-video-id]')
    for (const f of Array.from(iframes)) {
      if (f.contentWindow === source) {
        return f.getAttribute('data-video-id')
      }
    }
    return null
  }

  // Persist whatever progressByVideoRef holds for the given video id. If
  // `forceComplete`, mark `completed: true` regardless of the watched ratio.
  const flushProgress = useCallback(
    (videoId: string, forceComplete = false) => {
      const p = progressByVideoRef.current[videoId]
      if (!p) return
      setStore((prev) => {
        if (!prev) return prev
        const before = prev.progress[videoId]
        const ratioComplete = p.dur > 0 && p.sec / p.dur >= 0.95
        const completed = forceComplete || ratioComplete || before?.completed === true
        if (
          before &&
          Math.abs(before.currentSec - p.sec) < 2 &&
          before.durationSec === p.dur &&
          before.completed === completed
        ) {
          return prev
        }
        const updated: PersistedStore = {
          ...prev,
          progress: {
            ...prev.progress,
            [videoId]: {
              currentSec: p.sec,
              durationSec: p.dur || (before?.durationSec ?? 0),
              lastWatchedAt: new Date().toISOString(),
              completed
            }
          }
        }
        saveStore(updated)
        return updated
      })
    },
    []
  )

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const origin = String(e.origin || '')
      if (!origin.includes('youtube')) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data || !data.info) return
        if (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') return
        const info = data.info as { playerState?: number; currentTime?: number; duration?: number }
        if (typeof info.playerState === 'number') {
          if (info.playerState === 1) setVideoPlaying(true)
          else if (info.playerState === 2 || info.playerState === 0 || info.playerState === -1) {
            setVideoPlaying(false)
          }
        }
        const vid = resolveVideoIdFromSource(e.source)
        if (!vid) return
        const cur = typeof info.currentTime === 'number' ? info.currentTime : null
        const dur = typeof info.duration === 'number' ? info.duration : null
        if (cur !== null || dur !== null) {
          const prev = progressByVideoRef.current[vid] ?? { sec: 0, dur: 0 }
          progressByVideoRef.current[vid] = {
            sec: cur !== null ? cur : prev.sec,
            dur: dur !== null && dur > 0 ? dur : prev.dur
          }
        }
        // Auto-mark completed on YouTube `ended` (state 0).
        if (info.playerState === 0) {
          flushProgress(vid, true)
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [flushProgress])

  // Handshake with iframes after they mount.
  useEffect(() => {
    if (screen !== 'player' && screen !== 'courseFocus' && screen !== 'noteStudy') {
      setVideoPlaying(false)
      return
    }
    const t1 = window.setTimeout(() => startListeningToIframes(), 600)
    const t2 = window.setTimeout(() => startListeningToIframes(), 2000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [screen, activeItem, activeCourseFocusId])

  // Poll currentTime every 5s while playing, and flush progress to disk every
  // 10s. Also flush on unmount (player close / video change).
  useEffect(() => {
    if ((screen !== 'player' && screen !== 'courseFocus' && screen !== 'noteStudy') || !videoPlaying) return
    const poll = window.setInterval(() => pollCurrentTimeFromIframes(), 5000)
    const flushAll = () => {
      for (const vid of Object.keys(progressByVideoRef.current)) flushProgress(vid)
    }
    const flush = window.setInterval(flushAll, 10_000)
    return () => {
      window.clearInterval(poll)
      window.clearInterval(flush)
      flushAll()
    }
  }, [screen, videoPlaying, flushProgress])

  // ============ Focus timer (only ticks while videoPlaying) ============

  // Reset elapsed only when the *context* genuinely changes to a different one.
  // Leaving CourseFocus and returning to the same course preserves the timer,
  // so an accidental back-click doesn't cost you 30 minutes of focus.
  const lastFocusContextRef = useRef<string | null>(null)
  useEffect(() => {
    const newContext = activeItem
      ? `v:${activeItem.id}`
      : activeCourseFocusId
      ? `c:${activeCourseFocusId}`
      : null
    if (newContext && newContext !== lastFocusContextRef.current) {
      setFocusElapsedSec(0)
    }
    if (newContext) lastFocusContextRef.current = newContext
  }, [activeItem?.id, activeCourseFocusId])

  // Format the visible timer label: "MM:SS left"
  const focusTimerLabel = useMemo<string | null>(() => {
    if (!store?.focusConfig.enabled) return null
    if (screen !== 'player' && screen !== 'courseFocus') return null
    const total = store.focusConfig.focusMinutes * 60
    const remaining = Math.max(0, total - focusElapsedSec)
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    const time = `${m}:${String(s).padStart(2, '0')}`
    return videoPlaying ? `${time} left` : `${time} paused`
  }, [focusElapsedSec, store?.focusConfig.enabled, store?.focusConfig.focusMinutes, screen, videoPlaying])

  const triggerBreak = useCallback(
    (isCourse: boolean, categoryId?: string) => {
      if (!store) return
      postPauseToAllIframes()
      setBreakDurationSec(store.focusConfig.breakMinutes * 60)
      setOnBreak(true)
      const today = todayKey()
      const ds = store.dailySessions ?? { date: today, courseSessionsCompleted: 0, totalSessionsCompleted: 0 }
      const categorySessions = { ...(ds.courseSessionsByCategory ?? {}) }
      if (isCourse && categoryId) {
        categorySessions[categoryId] = (categorySessions[categoryId] ?? 0) + 1
      }
      persist({
        ...store,
        dailySessions: {
          date: today,
          totalSessionsCompleted: ds.totalSessionsCompleted + 1,
          courseSessionsCompleted: ds.courseSessionsCompleted + (isCourse ? 1 : 0),
          courseSessionsByCategory: categorySessions
        }
      })
    },
    [store, persist]
  )

  useEffect(() => {
    const inFocusContext = (screen === 'player' || screen === 'courseFocus') && !onBreak
    if (!inFocusContext || !store?.focusConfig.enabled) {
      focusContextRef.current = null
      return
    }
    focusContextRef.current = screen === 'courseFocus' ? 'course' : 'video'
    if (!videoPlaying) return

    const focusSec = (store?.focusConfig.focusMinutes ?? 40) * 60
    const activeCourseCat = activeCourseFocusId
      ? store?.courses.find((c) => c.id === activeCourseFocusId)?.category || '__uncategorized__'
      : undefined

    const id = window.setInterval(() => {
      setFocusElapsedSec((cur) => {
        const next = cur + 1
        if (next >= focusSec) {
          triggerBreak(focusContextRef.current === 'course', activeCourseCat)
          return 0
        }
        return next
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [videoPlaying, screen, onBreak, store?.focusConfig.enabled, store?.focusConfig.focusMinutes, activeCourseFocusId, store?.courses, triggerBreak])

  const endBreak = useCallback(() => {
    setOnBreak(false)
    setTimeout(() => postPlayToAllIframes(), 200)
  }, [])

  // ============ Memos ============
  // Items in today's plan can live in either `loop` (not watched yet today) or
  // `done.items` (watched-and-moved-out this week). Today's UI greys out the
  // ones that landed in done.
  const todayItems = useMemo<LoopItem[]>(() => {
    if (!store || !store.todayPlan) return []
    const combined = [...store.loop, ...store.done.items]
    return itemsForPlan(store.todayPlan, combined)
  }, [store])


  // Notes promotion rule: video appears in Notes view iff (a) it has a note
  // attached AND (b) has been watched-to-done at least once. Aggregates both
  // top-level loop+done items and playlist videos with attached notes.
  const notesItems = useMemo<LoopItem[]>(() => {
    if (!store) return []
    const out: LoopItem[] = []
    // Top-level items.
    for (const it of [...store.loop, ...store.done.items]) {
      if (!it.note) continue
      const watchedOnce =
        it.lastWatchedAt !== null ||
        store.watched.includes(it.id) ||
        store.progress[it.videoId]?.completed === true ||
        (it.partsConsumed ?? 0) > 0
      if (watchedOnce) out.push(it)
    }
    // Playlist notes — synthesize a row per playlist video that has a note
    // AND has been marked watched in its course.
    for (const [key, pn] of Object.entries(store.playlistNotes)) {
      const [courseId] = key.split(':')
      const watched = (store.watchedByCourse[courseId] ?? []).includes(pn.videoId)
      const playerCompleted = store.progress[pn.videoId]?.completed === true
      if (!watched && !playerCompleted) continue
      out.push({
        id: `pl_${key}`,
        url: `https://www.youtube.com/watch?v=${pn.videoId}`,
        videoId: pn.videoId,
        title: pn.videoTitle,
        creator: pn.courseTitle,
        duration: '',
        category: store.categories[0]?.id ?? 'curiosity',
        bucket: 'WKDY',
        addedAt: new Date().toISOString(),
        paras: [],
        lastWatchedAt: pn.watchedAt,
        note: pn.note
      })
    }
    return out
  }, [store])

  const activeCourses = useMemo(() => {
    if (!store) return []
    const result: {
      course: Course
      categoryName: string
      categoryColor: string
      sessionsCompleted: number
      sessionLimit: number
      locked: boolean
    }[] = []
    const acbc = store.activeCourseByCategory
    // Build the effective active-course map: explicit entries win, otherwise
    // the first course in each category is the default-active.
    const effective: Record<string, string> = { ...acbc }
    for (const cat of store.courseCategories) {
      if (effective[cat.id]) continue
      const firstInCat = store.courses.find((c) => c.category === cat.id)
      if (firstInCat) effective[cat.id] = firstInCat.id
    }
    // Also surface the uncategorized bucket if it has courses.
    if (!effective['__uncategorized__']) {
      const firstUncat = store.courses.find((c) => !c.category)
      if (firstUncat) effective['__uncategorized__'] = firstUncat.id
    }
    for (const [catId, courseId] of Object.entries(effective)) {
      const course = store.courses.find((c) => c.id === courseId)
      if (!course) continue
      const cat = store.courseCategories.find((c) => c.id === catId)
      const completed = store.dailySessions?.courseSessionsByCategory?.[catId] ?? 0
      const limit = store.focusConfig.courseSessionLimit ?? 4
      result.push({
        course,
        categoryName: cat?.name ?? 'Uncategorized',
        categoryColor: cat?.color ?? 'oklch(0.55 0.00 0)',
        sessionsCompleted: completed,
        sessionLimit: limit,
        locked: completed >= limit
      })
    }
    return result
  }, [store])

  const courseFocusCourse = useMemo<Course | null>(() => {
    if (!store || !activeCourseFocusId) return null
    return store.courses.find((c) => c.id === activeCourseFocusId) ?? null
  }, [store, activeCourseFocusId])

  const watchedSet = useMemo(() => new Set(store?.watched ?? []), [store])

  const totalBudgetMin = useMemo(() => {
    if (!store) return 0
    if (store.mode === 'SUN') return store.sundayMinutes ?? 0
    return store.categories.reduce((acc, c) => acc + (c.minutesPerDay ?? 0), 0)
  }, [store])

  const courseWatchedSet = useMemo(() => {
    if (!store || !courseFocusCourse) return new Set<string>()
    return new Set(store.watchedByCourse[courseFocusCourse.id] ?? [])
  }, [store, courseFocusCourse])

  const courseSessionsToday = store?.dailySessions?.courseSessionsCompleted ?? 0
  const courseSessionLimit = store?.focusConfig.courseSessionLimit ?? 4
  const courseLocked = activeCourses.length > 0 && activeCourses.every((c) => c.locked)
  const activeCourseCat = courseFocusCourse?.category || '__uncategorized__'
  const categorySessionsToday = store?.dailySessions?.courseSessionsByCategory?.[activeCourseCat] ?? 0
  const isCurrentCourseLocked = categorySessionsToday >= courseSessionLimit

  const routineDoneTodaySet = useMemo(() => {
    if (!store) return new Set<string>()
    const today = todayKey()
    return new Set(store.routineDoneByDay[today] ?? [])
  }, [store])

  if (!store) {
    return (
      <div className="app-shell">
        <div className="app-window">
          <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--ink-faint)' }}>
            <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Lighting the hearth…</span>
          </div>
        </div>
      </div>
    )
  }

  function openCourse(id: string) {
    if (courseLocked) return
    setActiveCourseFocusId(id)
    setScreen('courseFocus')
  }

  function openRoutineAsItem(it: RoutineItem) {
    const item: LoopItem = {
      id: `routine_${it.id}`,
      url: it.url,
      videoId: it.videoId,
      title: it.title,
      creator: it.creator,
      duration: '',
      category: 'curiosity',
      bucket: store?.mode ?? 'WKDY',
      addedAt: it.addedAt,
      paras: [],
      lastWatchedAt: null
    }
    setActiveItem(item)
    setScreen('player')
  }

  function openFreshAsItem(fresh: ChannelFresh, channelName: string) {
    const currentMode: Bucket = store?.mode ?? 'WKDY'
    const item: LoopItem = {
      id: `fresh_${fresh.videoId}`,
      url: `https://www.youtube.com/watch?v=${fresh.videoId}`,
      videoId: fresh.videoId,
      title: fresh.title,
      creator: channelName,
      duration: '',
      category: 'curiosity',
      bucket: currentMode,
      addedAt: fresh.publishedAt,
      paras: [],
      lastWatchedAt: null
    }
    setActiveItem(item)
    setScreen('player')
  }

  return (
    <div className="app-shell">
      <div className="app-window">
        <Titlebar
          mode={store.mode}
          screen={screen}
          onSetMode={handleSetMode}
          onToggleIngest={() => setIngestOpen((v) => !v)}
          onGoToday={() => setScreen('today')}
          onGoCourses={() => setScreen('courses')}
          onGoRoutine={() => setScreen('routine')}
          onGoSettings={() => setScreen('settings')}
          onGoNotes={() => setScreen('notes')}
          onGoWishlist={() => setScreen('wishlist')}
        />
        <div className="body">
          {screen === 'today' && (
            <Today
              items={todayItems}
              parts={store.todayPlan?.parts ?? []}
              progress={store.progress}
              totalBudgetMin={totalBudgetMin}
              mode={store.mode}
              routineCount={store.routine.length}
              routineDoneCount={routineDoneTodaySet.size}
              watched={watchedSet}
              dateLabel={dateLabel}
              activeCourses={activeCourses}
              courseLocked={courseLocked}
              courseSessionsToday={courseSessionsToday}
              courseSessionLimit={courseSessionLimit}
              categories={store.categories}
              onOpen={(it) => {
                setActiveItem(it)
                setScreen('player')
              }}
              onOpenRoutine={() => setScreen('routine')}
              onOpenCourse={(courseId) => openCourse(courseId)}
              onTriggerIngest={() => setIngestOpen(true)}
              onToggleWatched={handleToggleWatched}
              onRemoveFromLoop={handleDeleteVideo}
              onSkipFromToday={handleSkipFromToday}
              onRefreshPlan={handleRefreshTodayPlan}
              syncing={syncing}
            />
          )}
          {/*
            Sunday now uses the same Today card-grid as weekdays — the bucket
            (SUN vs WKDY) controls which loop items are eligible, not the
            layout. Channel weekly uploads still auto-ingest as real LoopItems
            via refreshSundayWeekly, so they show up in the day plan directly
            instead of needing a separate "Harvest" surface.
          */}

          {screen === 'player' && activeItem && (() => {
            // Find the part the day plan picked for this item, if any.
            const todayPart = store.todayPlan?.parts?.find((p) => p.itemId === activeItem.id) ?? null
            const isPartitioned = !!(todayPart && todayPart.partCount > 1)
            const prog = store.progress[activeItem.videoId]
            const partStart = isPartitioned ? (todayPart?.startSec ?? 0) : 0
            // Only set endSec when the video is genuinely partitioned. Setting
            // `end` on the YouTube iframe URL for full-length videos triggers
            // an early autopause near the boundary.
            const partEnd = isPartitioned ? todayPart?.endSec : undefined
            const resumeFromProgress =
              prog && !prog.completed && prog.currentSec > partStart + 5
                ? prog.currentSec
                : undefined
            const startSec = resumeFromProgress ?? (partStart > 0 ? partStart : undefined)
            const partLabel = isPartitioned
              ? `Part ${todayPart!.partIdx + 1} / ${todayPart!.partCount}`
              : null
            return (
              <Player
                key={activeItem.videoId}
                item={activeItem}
                isFavorited={store.wishlist.some(w => w.videoId === activeItem.videoId)}
                isWatched={store.watched.includes(activeItem.id)}
                focusTimerLabel={focusTimerLabel}
                startSec={startSec}
                endSec={partEnd}
                partLabel={partLabel}
                hasNote={!!activeItem.note}
                onAttachNote={() => setAttachNoteFor(activeItem)}
                onToggleFavorite={() => handleToggleFavorite(activeItem.id)}
                onDone={() => {
                  // Single setStore + single saveStore. The previous version
                  // called markWatchedNow() (which did its own persist) AND
                  // then did this setStore. Two async saveStore writes raced
                  // — the earlier one could complete after the later one,
                  // overwriting the move-to-done on disk. That's why items
                  // appeared to stay in loop after marking Done.
                  setStore((prev) => {
                    if (!prev) return prev
                    const isFresh = activeItem.id.startsWith('fresh_')
                    const existing = prev.progress[activeItem.videoId]
                    const inLoop = prev.loop.find((it) => it.id === activeItem.id)
                    const newPartsConsumed = todayPart && inLoop
                      ? Math.min(todayPart.partCount, (inLoop.partsConsumed ?? 0) + 1)
                      : 1
                    const fullyDone = !todayPart || newPartsConsumed >= (todayPart?.partCount ?? 1)

                    let loop = prev.loop
                    let done = prev.done
                    if (inLoop) {
                      if (fullyDone) {
                        loop = prev.loop.filter((it) => it.id !== activeItem.id)
                        const movedItem: LoopItem = {
                          ...inLoop,
                          partsConsumed: newPartsConsumed,
                          lastWatchedAt: new Date().toISOString()
                        }
                        done = {
                          weekStart: prev.done.weekStart,
                          items: [movedItem, ...prev.done.items.filter((d) => d.id !== activeItem.id)]
                        }
                      } else {
                        loop = prev.loop.map((it) =>
                          it.id === activeItem.id
                            ? { ...it, partsConsumed: newPartsConsumed, lastWatchedAt: new Date().toISOString() }
                            : it
                        )
                      }
                    }
                    // Fold markWatchedNow's effect in here so there's a single
                    // atomic write. Skip for fresh_* (channel-fresh) items.
                    const watched = isFresh || prev.watched.includes(activeItem.id)
                      ? prev.watched
                      : [activeItem.id, ...prev.watched]

                    const updated: PersistedStore = {
                      ...prev,
                      loop,
                      done,
                      watched,
                      progress: {
                        ...prev.progress,
                        [activeItem.videoId]: {
                          currentSec: existing?.currentSec ?? 0,
                          durationSec: existing?.durationSec ?? 0,
                          lastWatchedAt: new Date().toISOString(),
                          completed: true
                        }
                      }
                    }
                    saveStore(updated)
                    return updated
                  })
                  setActiveItem(null)
                  setScreen('today')
                }}
                onClose={() => {
                  setActiveItem(null)
                  setScreen('today')
                }}
                doneLabel={store.watched.includes(activeItem.id) ? 'Mark unwatched' : 'Done'}
                doneHint={
                  store.watched.includes(activeItem.id)
                    ? 'Unmark as watched'
                    : 'Mark as watched and return to Today'
                }
              />
            )
          })()}

          {screen === 'courseFocus' && courseFocusCourse && !isCurrentCourseLocked && (
            <CourseFocus
              course={courseFocusCourse}
              watchedIds={courseWatchedSet}
              cachedVideos={store.playlistVideosCache[courseFocusCourse.playlistId]?.videos ?? null}
              focusTimerLabel={focusTimerLabel}
              progress={store.progress}
              playlistNotes={store.playlistNotes}
              onAttachNoteToPlaylistVideo={(videoId, videoTitle) => {
                setPlaylistNoteTarget({
                  courseId: courseFocusCourse.id,
                  videoId,
                  title: videoTitle,
                  courseTitle: courseFocusCourse.title
                })
              }}
              onMarkWatched={(vid) => {
                handleMarkCourseVideoWatched(courseFocusCourse.id, vid, true)
                // Per-part keys look like `<videoId>_p<idx>` (used for single-
                // video courses). Don't write those into the global progress
                // map — they'd shadow the real video's resume state.
                if (vid.includes('_p')) return
                setStore((prev) => {
                  if (!prev) return prev
                  const existing = prev.progress[vid]
                  const updated: PersistedStore = {
                    ...prev,
                    progress: {
                      ...prev.progress,
                      [vid]: {
                        currentSec: existing?.currentSec ?? 0,
                        durationSec: existing?.durationSec ?? 0,
                        lastWatchedAt: new Date().toISOString(),
                        completed: true
                      }
                    }
                  }
                  saveStore(updated)
                  return updated
                })
              }}
              onUnmarkWatched={(vid) => handleMarkCourseVideoWatched(courseFocusCourse.id, vid, false)}
              onVideosFetched={handlePlaylistVideosFetched}
              onSetOrder={(order, manualOrder) => handleSetCourseOrder(courseFocusCourse.id, order, manualOrder)}
              onBack={() => {
                setActiveCourseFocusId(null)
                setScreen('courses')
              }}
            />
          )}

          {screen === 'courseFocus' && isCurrentCourseLocked && (
            <div className="screen">
              <div className="course-locked-full">
                <div className="locked-eyebrow">Done for the day</div>
                <h2>You're done with {courseFocusCourse?.category ? store?.courseCategories.find(c => c.id === courseFocusCourse.category)?.name : 'Uncategorized'} courses for today.</h2>
                <p>Come back tomorrow for fresh focus.</p>
                <button className="ingest-save" onClick={() => setScreen('today')}>Back to Today</button>
              </div>
            </div>
          )}

          {screen === 'courses' && (
            <Courses
              courses={store.courses}
              courseCategories={store.courseCategories}
              activeCourseByCategory={store.activeCourseByCategory}
              onAdd={handleSaveCourse}
              onRemove={handleRemoveCourse}
              onSetActive={handleSetActiveCourseForCategory}
              onSetCourseCategory={handleSetCourseCategory}
              onReorderCourse={handleReorderCourse}
              onOpen={openCourse}
              onBack={() => setScreen('today')}
              onAddCategory={handleAddCourseCategory}
              onUpdateCategory={handleUpdateCourseCategory}
              onDeleteCategory={handleDeleteCourseCategory}
            />
          )}

          {screen === 'routine' && (
            <Routine
              items={store.routine}
              doneIds={routineDoneTodaySet}
              onAdd={handleAddRoutine}
              onRemove={handleRemoveRoutine}
              onToggleDone={handleToggleRoutineDone}
              onOpen={openRoutineAsItem}
              onBack={() => setScreen('today')}
            />
          )}

          {screen === 'settings' && (
            <Settings
              store={store}
              onUpdateQuota={handleUpdateQuota}
              onRecategorize={handleRecategorize}
              onSetItemBucket={handleSetItemBucket}
              onDeleteVideo={handleDeleteVideo}
              onClearAll={handleClearAll}
              onAddChannel={handleAddChannel}
              onImportChannels={handleImportChannels}
              onRemoveChannel={handleRemoveChannel}
              onSetChannelBucket={handleSetChannelBucket}
              onSetChannelCategory={handleSetChannelCategory}
              onRefreshChannels={handleRefreshChannels}
              onUpdateFocus={handleUpdateFocus}
              onAddRoutine={handleAddRoutine}
              onRemoveRoutine={handleRemoveRoutine}
              onUpdateGoogleAuth={handleUpdateGoogleAuth}
              onSubsFetched={handleSubsFetched}
              onUpdateApiKey={handleUpdateApiKey}
              onUpdateSundayLimit={handleUpdateSundayLimit}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onUpdateSliceTargetMin={handleUpdateSliceTargetMin}
              onUpdateSundayMinutes={handleUpdateSundayMinutes}
              onRefreshTodayPlan={handleRefreshTodayPlan}
              onRestoreFromQuarantine={handleRestoreFromQuarantine}
              onDeleteFromQuarantine={handleDeleteFromQuarantine}
              onRestoreFromDone={handleRestoreFromDone}
              onClearDone={handleClearDone}
              onBack={() => setScreen('today')}
            />
          )}

          {screen === 'notes' && (
            <Notes
              items={notesItems}
              categories={store.categories}
              onOpen={(it) => {
                setActiveItem(it)
                setScreen('noteStudy')
              }}
              onDetach={handleDetachNote}
              onBack={() => setScreen('today')}
            />
          )}

          {screen === 'noteStudy' && activeItem && (
            <NoteStudyView
              item={activeItem}
              playlistNotes={store.playlistNotes}
              onSaveMappings={handleSaveNoteMappings}
              onDone={() => {
                const vid = activeItem.videoId
                setStore((prev) => {
                  if (!prev) return prev
                  const existing = prev.progress[vid]
                  const updated: PersistedStore = {
                    ...prev,
                    progress: {
                      ...prev.progress,
                      [vid]: {
                        currentSec: existing?.currentSec ?? 0,
                        durationSec: existing?.durationSec ?? 0,
                        lastWatchedAt: new Date().toISOString(),
                        completed: true
                      }
                    }
                  }
                  saveStore(updated)
                  return updated
                })
                setActiveItem(null)
                setScreen('notes')
              }}
              onClose={() => {
                setActiveItem(null)
                setScreen('notes')
              }}
            />
          )}

          {screen === 'wishlist' && (
            <Wishlist
              items={store.wishlist}
              categories={store.categories}
              onOpen={(it) => {
                setActiveItem(it)
                setScreen('player')
              }}
              onPromoteToLoop={handlePromoteWishlistToLoop}
              onRemove={handleRemoveFromWishlist}
              onSetBucket={handleSetWishlistBucket}
              onTriggerIngest={() => setIngestOpen(true)}
              onBack={() => setScreen('today')}
            />
          )}

          {ingestOpen && (
            <IngestPanel
              currentMode={store.mode}
              categories={store.categories}
              onClose={() => setIngestOpen(false)}
              onSaveVideo={handleSaveVideo}
              onSaveCourse={handleSaveCourse}
              onSaveRoutine={handleAddRoutine}
              onSaveWishlist={handleSaveToWishlist}
            />
          )}

          {attachNoteFor && (
            <AttachNoteModal
              item={attachNoteFor}
              onClose={() => setAttachNoteFor(null)}
              onAttach={(ref) => handleAttachNote(attachNoteFor.id, ref)}
              onDetach={() => {
                handleDetachNote(attachNoteFor.id)
                setAttachNoteFor(null)
              }}
            />
          )}

          {playlistNoteTarget && (() => {
            // Synthesize a temporary LoopItem so AttachNoteModal can render the
            // same UI it uses for top-level videos.
            const target = playlistNoteTarget
            const key = `${target.courseId}:${target.videoId}`
            const existing = store.playlistNotes[key]
            const synthetic: LoopItem = {
              id: key,
              url: `https://www.youtube.com/watch?v=${target.videoId}`,
              videoId: target.videoId,
              title: target.title,
              creator: target.courseTitle,
              duration: '',
              category: store.categories[0]?.id ?? 'curiosity',
              bucket: 'WKDY',
              addedAt: new Date().toISOString(),
              paras: [],
              lastWatchedAt: null,
              note: existing?.note
            }
            return (
              <AttachNoteModal
                item={synthetic}
                onClose={() => setPlaylistNoteTarget(null)}
                onAttach={(ref) => handleAttachPlaylistNote(target.courseId, target.videoId, target.courseTitle, target.title, ref)}
                onDetach={() => {
                  handleDetachPlaylistNote(target.courseId, target.videoId)
                  setPlaylistNoteTarget(null)
                }}
              />
            )
          })()}

          {onBreak && (
            <BreakOverlay
              totalSeconds={breakDurationSec}
              onSkip={endBreak}
              onComplete={endBreak}
            />
          )}

          {syncing && (
            <div
              style={{
                position: 'fixed',
                bottom: 18,
                right: 18,
                padding: '10px 14px',
                background: 'var(--surface, #2a2520)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--ink-faint)',
                zIndex: 100,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              Syncing today's plan…
            </div>
          )}

          {backfillRemaining && backfillRemaining.done < backfillRemaining.total && (
            <div
              style={{
                position: 'fixed',
                bottom: syncing ? 60 : 18,
                right: 18,
                padding: '8px 12px',
                background: 'var(--surface, #2a2520)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--ink-faint)',
                opacity: 0.85,
                zIndex: 99,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
              title="Reading durations from YouTube to fit today's plan more accurately"
            >
              Backfilling durations · {backfillRemaining.done} / {backfillRemaining.total}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
