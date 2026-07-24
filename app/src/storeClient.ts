import type { CategoryId, CourseCategory, FocusConfig, GoogleAuth, LoopItem, PersistedStore } from './types'
import { autoMode } from './lib/rotation'
import { DEFAULT_CATEGORIES } from './lib/categories'
import { parseDurationLabel } from './lib/duration'

const CURRENT_SCHEMA = 14

const DEFAULT_QUOTAS: Record<CategoryId, number> = {
  curiosity: 2,
  reflective: 2,
  craft: 1
}

const DEFAULT_MINUTES_PER_CATEGORY: Record<CategoryId, number> = {
  curiosity: 30,
  reflective: 20,
  craft: 10
}

const DEFAULT_SLICE_TARGET_MIN = 30
// "sundayMinutes" is the legacy field name — it now powers the daily
// Entertainment strip's minute cap, not a Sunday-only budget.
const DEFAULT_SUNDAY_MINUTES = 60

/** Heuristic: ≤60s OR `/shorts/` in the URL = Short. */
function looksLikeShort(item: LoopItem): boolean {
  if (typeof item.url === 'string' && /\/shorts\//i.test(item.url)) return true
  const secs = item.durationSec ?? parseDurationLabel(item.duration)
  return secs > 0 && secs <= 60
}

const DEFAULT_FOCUS: FocusConfig = {
  focusMinutes: 40,
  breakMinutes: 10,
  courseSessionLimit: 4,
  enabled: true
}

const DEFAULT_GOOGLE: GoogleAuth = {
  clientId: '',
  clientSecret: '',
  accessToken: null,
  refreshToken: null,
  expiresAt: null
}

function normalizeBucket(b: unknown, fallback: 'WKDY' | 'SUN' = 'WKDY'): 'WKDY' | 'SUN' {
  return b === 'WKDY' || b === 'SUN' ? b : fallback
}

const DEFAULT_COURSE_CATEGORIES: CourseCategory[] = [
  { id: 'cc_learning', name: 'Learning', color: 'oklch(0.55 0.14 250)' },
  { id: 'cc_building', name: 'Building', color: 'oklch(0.55 0.14 155)' },
  { id: 'cc_creative', name: 'Creative', color: 'oklch(0.60 0.16 55)' }
]

function normalizeCategory(c: unknown): CategoryId {
  return typeof c === 'string' && c.length > 0 ? c : 'curiosity'
}

export async function loadStore(): Promise<PersistedStore> {
  const raw = (await window.hearth.getStore()) as Partial<PersistedStore>
  if (!raw.schemaVersion || raw.schemaVersion < CURRENT_SCHEMA) {
    const loopIn = (raw.loop ?? []).filter((item) => !item.id.startsWith('seed-'))
    const allLoop: LoopItem[] = loopIn.map((it) => ({
      ...it,
      bucket: normalizeBucket((it as { bucket?: unknown }).bucket),
      lastWatchedAt:
        (it as { lastWatchedAt?: string | null }).lastWatchedAt ?? null,
      durationSec:
        (it as { durationSec?: number }).durationSec ?? parseDurationLabel(it.duration ?? ''),
      partsConsumed: (it as { partsConsumed?: number }).partsConsumed ?? 0
    }))
    // Pull Shorts out of the loop into quarantine so the user can review/delete.
    const existingQuarantine = (raw.shortsQuarantine ?? []) as LoopItem[]
    const shortsQuarantine = [
      ...existingQuarantine,
      ...allLoop.filter(looksLikeShort)
    ]
    const courses = (raw.courses ?? []).map((c) => ({
      ...c,
      bucket: normalizeBucket((c as { bucket?: unknown }).bucket)
    }))
    const channels = (raw.channels ?? []).map((ch) => ({
      ...ch,
      bucket: normalizeBucket((ch as { bucket?: unknown }).bucket),
      category: normalizeCategory((ch as { category?: unknown }).category)
    }))
    const incomingCats = (raw.categories && raw.categories.length > 0)
      ? raw.categories
      : DEFAULT_CATEGORIES
    const categories = incomingCats.map((c) => {
      const oldQuota = raw.categoryQuotas?.[c.id]
      const defaultMin = DEFAULT_MINUTES_PER_CATEGORY[c.id]
      return {
        ...c,
        days: c.days && c.days.length > 0 ? c.days : [0, 1, 2, 3, 4, 5, 6],
        minutesPerDay:
          c.minutesPerDay ??
          defaultMin ??
          Math.max(20, (typeof oldQuota === 'number' ? oldQuota : 1) * 20)
      }
    })
    // Migrate old activeCourseId → activeCourseByCategory
    const oldActiveId = raw.activeCourseId ?? null
    const existingAcbc = (raw as any).activeCourseByCategory ?? {}
    const activeCourseByCategory: Record<string, string> = { ...existingAcbc }
    if (oldActiveId && Object.keys(activeCourseByCategory).length === 0) {
      // Put the old active course under a special uncategorized key
      activeCourseByCategory['__uncategorized__'] = oldActiveId
    }
    const courseCategories: CourseCategory[] =
      ((raw as any).courseCategories && (raw as any).courseCategories.length > 0)
        ? (raw as any).courseCategories
        : DEFAULT_COURSE_CATEGORIES

    // Migrated vault to wishlist
    const rawVault: string[] = (raw as any).vault ?? []
    const rawWishlist: LoopItem[] = (raw as any).wishlist ?? []
    const wishlistVideoIds = new Set(rawWishlist.map(w => w.videoId))
    const allPossibleItems = [...allLoop, ...(raw.done?.items ?? [])]
    const itemsById = new Map(allPossibleItems.map(it => [it.id, it]))
    const migratedWishlist = [...rawWishlist]
    for (const id of rawVault) {
      const item = itemsById.get(id)
      if (item && !wishlistVideoIds.has(item.videoId)) {
        wishlistVideoIds.add(item.videoId)
        const wshId = item.id.startsWith('itm_') ? item.id.replace(/^itm_/, 'wsh_') : item.id.startsWith('wsh_') ? item.id : `wsh_${item.videoId}`
        migratedWishlist.push({ ...item, id: wshId })
      }
    }
    const vaultIdSet = new Set(rawVault)
    const loop = allLoop.filter((it) => !looksLikeShort(it) && !vaultIdSet.has(it.id))

    const migrated: PersistedStore = {
      schemaVersion: CURRENT_SCHEMA,
      mode: raw.mode ?? autoMode(),
      loop,
      todayPlan: null,
      courses,
      categoryQuotas: raw.categoryQuotas ?? DEFAULT_QUOTAS,
      activeCourseId: raw.activeCourseId ?? null,
      watched: raw.watched ?? [],
      watchedByCourse: raw.watchedByCourse ?? {},
      channels,
      channelFresh: raw.channelFresh ?? {},
      focusConfig: raw.focusConfig ?? DEFAULT_FOCUS,
      dailySessions: raw.dailySessions ?? null,
      routine: raw.routine ?? [],
      routineDoneByDay: raw.routineDoneByDay ?? {},
      googleAuth: raw.googleAuth ?? DEFAULT_GOOGLE,
      youtubeApiKey: raw.youtubeApiKey ?? '',
      youtubeApiKeys: raw.youtubeApiKeys ?? (raw.youtubeApiKey ? [raw.youtubeApiKey] : []),
      sundayLimit: raw.sundayLimit ?? 5,
      playlistVideosCache: raw.playlistVideosCache ?? {},
      youtubeSubscriptionsCache: raw.youtubeSubscriptionsCache ?? null,
      categories,
      sundayChannelWeekly: raw.sundayChannelWeekly ?? {},
      progress: raw.progress ?? {},
      sliceTargetMin: raw.sliceTargetMin ?? DEFAULT_SLICE_TARGET_MIN,
      sundayMinutes: raw.sundayMinutes ?? DEFAULT_SUNDAY_MINUTES,
      weekdayMinutes: (raw as any).weekdayMinutes ?? 60,
      shortsQuarantine,
      remarkable: raw.remarkable ?? { paired: false },
      done: raw.done ?? { weekStart: weekStartIso(), items: [] },
      lastRefreshAt: raw.lastRefreshAt,
      playlistNotes: raw.playlistNotes ?? {},
      courseCategories,
      activeCourseByCategory,
      wishlist: migratedWishlist,
      delayedLoop: raw.delayedLoop ?? []
    }
    await window.hearth.setStore(migrated)
    return migrated
  }
  // Already at current schema — still backfill any optional fields that were
  // added without a version bump (defensive, no-op for fully-up-to-date stores).
  const s = raw as PersistedStore
  if (s.dailySessions && !s.dailySessions.courseSessionsByCourse) {
    s.dailySessions.courseSessionsByCourse = {}
  }
  if (!s.progress) s.progress = {}
  if (s.sliceTargetMin === undefined) s.sliceTargetMin = DEFAULT_SLICE_TARGET_MIN
  if (s.sundayMinutes === undefined) s.sundayMinutes = DEFAULT_SUNDAY_MINUTES
  if (s.weekdayMinutes === undefined) s.weekdayMinutes = 60
  if (!s.youtubeApiKeys) s.youtubeApiKeys = s.youtubeApiKey ? [s.youtubeApiKey] : []
  if (!s.shortsQuarantine) s.shortsQuarantine = []
  if (!s.remarkable) s.remarkable = { paired: false }
  if (!s.done) s.done = { weekStart: weekStartIso(), items: [] }
  if (!s.playlistNotes) s.playlistNotes = {}
  if (!s.courseCategories || s.courseCategories.length === 0) s.courseCategories = DEFAULT_COURSE_CATEGORIES
  if (!s.activeCourseByCategory) {
    const acbc: Record<string, string> = {}
    if (s.activeCourseId) acbc['__uncategorized__'] = s.activeCourseId
    s.activeCourseByCategory = acbc
  }
  if (!s.wishlist) s.wishlist = []
  if (!s.delayedLoop) s.delayedLoop = []
  if (!s.trash) s.trash = []
  if (!s.bookmarks) s.bookmarks = []
  if (!s.courseStreaks) s.courseStreaks = {}
  if (!s.sparks) s.sparks = []
  if (s.geminiApiKey === undefined) s.geminiApiKey = ''
  if (s.ollamaUrl === undefined) s.ollamaUrl = 'http://localhost:11434'
  if (s.ollamaModel === undefined) s.ollamaModel = 'gemma4:e2b'
  if (s.feedMemoryProfile === undefined) s.feedMemoryProfile = 'The user\'s preferences are not yet known.'
  if (!s.feedRatings) s.feedRatings = []
  if (!s.dismissedFeedVideoIds) s.dismissedFeedVideoIds = []
  // Auto-purge trash entries older than 30 days.
  if (s.trash && s.trash.length > 0) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    s.trash = s.trash.filter((t) => {
      const at = Date.parse(t.deletedAt)
      return Number.isFinite(at) && at >= cutoff
    })
  }
  if ((s as any).vault) {
    const rawVault: string[] = (s as any).vault ?? []
    const wishlistVideoIds = new Set(s.wishlist.map((w) => w.videoId))
    const byId = new Map<string, LoopItem>()
    for (const it of s.loop) byId.set(it.id, it)
    for (const it of s.done?.items ?? []) byId.set(it.id, it)
    const migratedList: LoopItem[] = []
    for (const id of rawVault) {
      const item = byId.get(id)
      if (!item) continue
      if (wishlistVideoIds.has(item.videoId)) continue
      wishlistVideoIds.add(item.videoId)
      const wshId = item.id.startsWith('itm_') ? item.id.replace(/^itm_/, 'wsh_') : item.id.startsWith('wsh_') ? item.id : `wsh_${item.videoId}`
      migratedList.push({ ...item, id: wshId })
    }
    if (migratedList.length > 0) {
      s.wishlist = [...migratedList, ...s.wishlist]
    }
    const vaultIdSet = new Set(rawVault)
    s.loop = s.loop.filter(it => !vaultIdSet.has(it.id))
    delete (s as any).vault
  }
  // One-time loop dedup. Earlier builds let concurrent channel refreshes
  // insert the same videoId twice; sweep them out on first load of the fix.
  // ALSO drop any loop entry whose videoId is already in this week's done
  // bucket — the channel re-ingest bug let watched/skipped items leak back.
  const doneVideoIds = new Set(s.done.items.map((it) => it.videoId))
  const seen = new Set<string>()
  const deduped = s.loop.filter((it) => {
    if (doneVideoIds.has(it.videoId)) return false
    if (seen.has(it.videoId)) return false
    seen.add(it.videoId)
    return true
  })
  if (deduped.length !== s.loop.length) {
    s.loop = deduped
    s.todayPlan = null // recompute with the cleaned loop
  }
  // Backfill minutesPerDay on any category that doesn't have it yet — without
  // this, the new duration-based packer treats those categories as 0 budget
  // and Today comes back empty even when the loop is full.
  let needsCatBackfill = false
  for (const c of s.categories) {
    if (typeof c.minutesPerDay !== 'number') { needsCatBackfill = true; break }
  }
  if (needsCatBackfill) {
    s.categories = s.categories.map((c) => {
      if (typeof c.minutesPerDay === 'number') return c
      const fallback = DEFAULT_MINUTES_PER_CATEGORY[c.id]
        ?? Math.max(20, (s.categoryQuotas?.[c.id] ?? 1) * 20)
      return { ...c, minutesPerDay: fallback }
    })
    s.todayPlan = null // force recompute with the new budgets
  }
  return s
}

/** ISO date of the Monday 00:00 local for the current week — used as the done-bucket key. */
export function weekStartIso(now: Date = new Date()): string {
  const d = new Date(now)
  const dow = d.getDay() // 0=Sun .. 6=Sat
  const offset = dow === 0 ? 6 : dow - 1
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offset)
  return d.toISOString()
}

export async function saveStore(next: PersistedStore): Promise<void> {
  await window.hearth.setStore(next)
}

/**
 * Every videoId the user has ALREADY seen or explicitly parked — used by the
 * channel refresh + ingest paths to avoid re-adding a video that lives in any
 * of the bookkeeping buckets. Kept in one place so a new bucket only needs one
 * line here to be respected everywhere.
 *
 *   - loop            : currently in daily rotation
 *   - done.items      : watched or skipped this week
 *   - wishlist        : parked for later (would come back if we ignored it)
 *   - trash           : soft-deleted (still restorable for 30 days)
 *   - shortsQuarantine: flagged Shorts awaiting review
 */
export function knownVideoIds(s: PersistedStore): Set<string> {
  const out = new Set<string>()
  for (const it of s.loop) out.add(it.videoId)
  for (const it of s.delayedLoop ?? []) out.add(it.videoId)
  for (const it of s.done?.items ?? []) out.add(it.videoId)
  for (const it of s.wishlist ?? []) out.add(it.videoId)
  for (const t of s.trash ?? []) {
    const vid = t.video?.videoId
    if (vid) out.add(vid)
  }
  for (const it of s.shortsQuarantine ?? []) out.add(it.videoId)
  return out
}
