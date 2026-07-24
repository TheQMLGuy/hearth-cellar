import type { Bucket, Category, CategoryId, ChannelFresh, DayPlan, LoopItem, Mode, Part, VideoProgress } from '../types'
import { splitIntoParts, itemDurationSec } from './partitioning'

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Cheap deterministic string→uint32 seed. Not cryptographic — just needs
// to spread `2026-07-01` and `2026-07-02` to different-looking numbers.
function seedFromDate(key: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// xorshift32(seed ⊕ hash(itemId)) → number in [0, 1). Used as a stable
// tie-breaker within a priority bucket so the same-priority items don't
// always appear in the same insertion order.
function jitter(itemId: string, seed: number): number {
  let x = seed >>> 0
  for (let i = 0; i < itemId.length; i++) {
    x ^= itemId.charCodeAt(i)
    x = Math.imul(x, 16777619) >>> 0
  }
  x ^= x << 13; x >>>= 0
  x ^= x >>> 17
  x ^= x << 5; x >>>= 0
  return (x >>> 0) / 4294967296
}

export function autoMode(_d: Date = new Date()): Mode {
  // Sunday-mode was killed. SUN-bucket items are now the daily "Entertainment"
  // strip rendered on Today, capped to ~60 min/day. Every day uses WKDY mode
  // for the main plan; entertainment is a sibling, not a Sunday-only thing.
  return 'WKDY'
}

export function bucketMatches(itemBucket: Bucket, mode: Mode): boolean {
  return itemBucket === mode
}

// Lower score = higher priority. Order: in-progress (most recently watched first) → unwatched → oldest-watched → recently watched.
export function priorityScore(item: LoopItem, now: Date): number {
  const consumed = item.partsConsumed ?? 0
  if (consumed > 0) {
    if (!item.lastWatchedAt) return -2
    const watched = Date.parse(item.lastWatchedAt)
    if (!isFinite(watched)) return -2
    const ageDays = Math.max(0, (now.getTime() - watched) / 86_400_000)
    // Most recently watched in-progress video should have the lowest score (highest priority)
    return -2 + (1 - 1 / (1 + ageDays))
  }

  if (!item.lastWatchedAt) return 0 // unwatched first
  const watched = Date.parse(item.lastWatchedAt)
  if (!isFinite(watched)) return 0
  const ageDays = Math.max(0, (now.getTime() - watched) / 86_400_000)
  // older = smaller score = higher priority among watched
  return 1 / (1 + ageDays)
}

export function categoryAllowedToday(categories: Category[] | undefined, catId: CategoryId, dayOfWeek: number): boolean {
  if (!categories) return true
  const cat = categories.find((c) => c.id === catId)
  if (!cat) return true
  if (cat.days === undefined) return true
  return cat.days.includes(dayOfWeek)
}

export function getRoundRobinCategoriesForDate(categories: Category[], dateStr: string): string[] {
  if (categories.length === 0) return []
  
  const dateParts = dateStr.split('-').map(Number)
  let dayOfWeek = new Date().getDay()
  if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
    dayOfWeek = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay()
  }

  const allowedCategories = categories.filter(c => categoryAllowedToday(categories, c.id, dayOfWeek))
  if (allowedCategories.length === 0) {
    return []
  }

  const pinnedCat = allowedCategories.find(c => c.pinned)
  const activeIds: string[] = []
  
  if (pinnedCat) {
    activeIds.push(pinnedCat.id)
  }
  
  const remainingCats = allowedCategories.filter(c => c.id !== pinnedCat?.id)
  if (remainingCats.length === 0) {
    return activeIds
  }
  
  const cleanStr = dateStr.replace(/-/g, '')
  const dayNum = parseInt(cleanStr, 10) || 0
  const N = remainingCats.length
  const targetLimit = Math.min(3 - activeIds.length, N)
  
  for (let i = 0; i < targetLimit; i++) {
    const idx = (dayNum * targetLimit + i) % N
    const cat = remainingCats[idx]
    if (cat) activeIds.push(cat.id)
  }
  
  return activeIds
}

export interface ComputeDayPlanOpts {
  loop: LoopItem[]
  delayedLoop?: LoopItem[]
  mode: Mode
  channelFresh: Record<string, ChannelFresh>
  channelBucketByChannelId: Record<string, Bucket>
  date?: string
  sundayMinutes?: number
  weekdayMinutes?: number
  /** Slice target in seconds. */
  sliceTargetSec?: number
  categories?: Category[]
  progress?: Record<string, VideoProgress>
  activeCategoryIds?: string[]
}

const FALLBACK_MINUTES_PER_DAY = 30

function partLengthSec(part: Part): number {
  return Math.max(0, part.endSec - part.startSec)
}

/** Pick the next un-consumed part for an item, or null if all parts are done. */
function nextPartFor(
  item: LoopItem,
  sliceTargetSec: number,
  prog?: VideoProgress
): Part | null {
  const total = itemDurationSec(item)
  if (total <= 0) {
    return { itemId: item.id, partIdx: 0, partCount: 1, startSec: 0, endSec: 600 }
  }

  const startSec = prog && prog.currentSec > 0 ? Math.floor(prog.currentSec) : 0
  if (startSec >= total - 5) {
    return null // Already fully watched
  }

  const staticParts = splitIntoParts(item, sliceTargetSec)
  let partIdx = staticParts.findIndex((p) => startSec >= p.startSec && startSec < p.endSec)
  if (partIdx === -1) {
    partIdx = staticParts.length - 1
  }

  const targetPart = staticParts[partIdx]
  if (!targetPart) {
    return {
      itemId: item.id,
      partIdx: 0,
      partCount: 1,
      startSec,
      endSec: total
    }
  }
  return {
    itemId: item.id,
    partIdx,
    partCount: staticParts.length,
    startSec,
    endSec: targetPart.endSec
  }
}

function sortByPriority(items: LoopItem[], now: Date): LoopItem[] {
  return items.slice().sort((a, b) => {
    const sa = priorityScore(a, now)
    const sb = priorityScore(b, now)
    return sa - sb
  })
}

export function computeDayPlan(opts: ComputeDayPlanOpts): DayPlan {
  const {
    loop,
    delayedLoop = [],
    mode,
    channelFresh,
    channelBucketByChannelId,
    date = todayKey(),
    sundayMinutes = 90,
    weekdayMinutes = 60,
    sliceTargetSec = 1800,
    categories,
    progress = {},
    activeCategoryIds
  } = opts
  const now = new Date()
  const dateParts = date.split('-').map(Number)
  let dow = now.getDay()
  if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
    dow = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay()
  }
  
  // Filter helper to exclude Shorts and check mode bucket (CON-0005: 180s threshold)
  const filterEligible = (list: LoopItem[]) => {
    return list.filter((it) => {
      if (!bucketMatches(it.bucket, mode)) return false
      const secs = itemDurationSec(it)
      if (secs > 0 && secs <= 180) return false
      return true
    })
  }

  const eligibleLoop = filterEligible(loop)
  const eligibleDelayed = filterEligible(delayedLoop)

  const parts: Part[] = []
  const seenItemIds = new Set<string>()
  void sundayMinutes
  void mode

  const catsToUse = (categories ?? []).filter((c) => categoryAllowedToday(categories, c.id, dow))

  // Resolve the active categories of the day (exactly 3, round robin)
  let selectedCatIds = (activeCategoryIds ?? []).filter((id) =>
    catsToUse.some((c) => c.id === id)
  )
  if (selectedCatIds.length === 0) {
    selectedCatIds = getRoundRobinCategoriesForDate(categories ?? [], date)
  }

  // Overall daily budget from weekdayMinutes setting
  let budgetSec = weekdayMinutes * 60
  if (budgetSec <= 0) {
    budgetSec = 60 * 60
  }

  // Initialize queues of sorted items for all categories
  // Draw from loop first; if empty, pull from delayedLoop (per category)
  const queues: Record<string, LoopItem[]> = {}
  for (const cat of catsToUse) {
    let list = eligibleLoop.filter((it) => it.category === cat.id)
    if (list.length === 0) {
      list = eligibleDelayed.filter((it) => it.category === cat.id)
    }
    queues[cat.id] = sortByPriority(list, now)
  }

  const chosenParts: Part[] = []
  let budgetRemaining = budgetSec

  // Phase 1: Prioritize scheduling exactly 1 video from each of today's active categories.
  const primaryCats = catsToUse.filter((c) => selectedCatIds.includes(c.id))
  for (const cat of primaryCats) {
    if (budgetRemaining <= 0) break
    const list = queues[cat.id]
    if (!list || list.length === 0) continue

    let part: Part | null = null
    let itemIndex = 0
    while (itemIndex < list.length) {
      const item = list[itemIndex]
      if (!item) {
        itemIndex++
        continue
      }
      const prog = progress[item.videoId]
      const candidatePart = nextPartFor(item, sliceTargetSec, prog)
      if (candidatePart) {
        const len = partLengthSec(candidatePart)
        if (len <= budgetRemaining) {
          part = candidatePart
          list.splice(itemIndex, 1) // Consume
          break
        } else {
          itemIndex++
        }
      } else {
        itemIndex++
      }
    }

    if (part) {
      chosenParts.push(part)
      seenItemIds.add(part.itemId)
      budgetRemaining -= partLengthSec(part)
    }
  }

  // Phase 2: Cycle round-robin through ALL categories to fill up any remaining daily budget.
  let madeProgress = true
  while (budgetRemaining > 0 && madeProgress) {
    madeProgress = false
    for (const cat of catsToUse) {
      if (budgetRemaining <= 0) break
      const list = queues[cat.id]
      if (!list || list.length === 0) continue

      let part: Part | null = null
      let itemIndex = 0
      while (itemIndex < list.length) {
        const item = list[itemIndex]
        if (!item) {
          itemIndex++
          continue
        }
        const prog = progress[item.videoId]
        const candidatePart = nextPartFor(item, sliceTargetSec, prog)
        if (candidatePart) {
          const len = partLengthSec(candidatePart)
          if (len <= budgetRemaining) {
            part = candidatePart
            list.splice(itemIndex, 1) // Consume
            break
          } else {
            itemIndex++
          }
        } else {
          itemIndex++
        }
      }

      if (part) {
        chosenParts.push(part)
        seenItemIds.add(part.itemId)
        budgetRemaining -= partLengthSec(part)
        madeProgress = true
      }
    }
  }

  parts.push(...chosenParts)

  const freshIds: string[] = []
  for (const [channelId, fresh] of Object.entries(channelFresh)) {
    if (!fresh) continue
    const pubDate = new Date(fresh.publishedAt)
    if (todayKey(pubDate) !== date) continue
    const bucket = channelBucketByChannelId[channelId] ?? 'WKDY'
    if (!bucketMatches(bucket, mode)) continue
    freshIds.push(fresh.videoId)
  }

  return {
    date,
    mode,
    itemIds: Array.from(seenItemIds),
    freshChannelVideoIds: freshIds,
    parts,
    activeCategoryIds: selectedCatIds
  }
}

function interleavePartsByCategory(
  byCat: Record<string, Part[]>,
  order: string[]
): Part[] {
  const out: Part[] = []
  let added = true
  while (added) {
    added = false
    for (const cat of order) {
      const list = byCat[cat]
      if (list && list.length > 0) {
        out.push(list.shift()!)
        added = true
      }
    }
  }
  return out
}

export function planIsStale(
  plan: DayPlan | null,
  mode: Mode,
  date: string = todayKey()
): boolean {
  if (!plan) return true
  return plan.date !== date || plan.mode !== mode
}

export function itemsForPlan(plan: DayPlan, loop: LoopItem[]): LoopItem[] {
  const byId = new Map(loop.map((i) => [i.id, i]))
  const out: LoopItem[] = []
  for (const id of plan.itemIds) {
    const it = byId.get(id)
    if (it) out.push(it)
  }
  return out
}

/**
 * Pick today's Entertainment items from the loop's SUN-bucket pool — the
 * stuff you watch while eating, capped at a daily minute budget (default
 * 60 min). One item per row, no partitioning: each video plays start-to-end
 * within its time slot (or skip).
 *
 *   - Items longer than the daily cap are excluded (they could never fit).
 *   - Greedy fit by priority (unwatched → oldest-watched first).
 *   - Shorts (≤60s) are still filtered out (same as the main plan).
 */
export interface ComputeEntertainmentOpts {
  loop: LoopItem[]
  entertainmentMinutes?: number
}

export function computeEntertainmentPlan(opts: ComputeEntertainmentOpts): {
  parts: Part[]
  itemIds: string[]
} {
  const { loop, entertainmentMinutes = 60 } = opts
  const budgetSec = Math.max(60, entertainmentMinutes * 60)
  const eligible = loop.filter((it) => {
    if (it.bucket !== 'SUN') return false
    const secs = itemDurationSec(it)
    if (secs > 0 && secs <= 180) return false       // CON-0005: reject Shorts
    if (secs > 0 && secs > budgetSec) return false // can't fit in a day
    return true
  })
  // Deterministic daily shuffle — same order all day, different tomorrow.
  // xorshift32 seeded by (dateStamp ⊕ item.id hash) gives us a stable but
  // date-varying tie-breaker on top of the priority sort.
  const dateSeed = seedFromDate(todayKey())
  const sorted = sortByPriority(eligible, new Date()).slice().sort((a, b) => {
    const sa = priorityScore(a, new Date())
    const sb = priorityScore(b, new Date())
    if (sa !== sb) return sa - sb
    // Same priority bucket — shuffle deterministically per day.
    return jitter(a.id, dateSeed) - jitter(b.id, dateSeed)
  })
  const parts: Part[] = []
  const ids: string[] = []
  let remaining = budgetSec
  for (const item of sorted) {
    const total = itemDurationSec(item)
    // Unknown-duration items (channel auto-ingests without metadata) get
    // a conservative ~30 min assumption so we don't pack the day with
    // mystery videos. They still play start-to-end.
    const len = total > 0 ? total : 30 * 60
    if (len > remaining && parts.length > 0) continue
    parts.push({
      itemId: item.id,
      partIdx: 0,
      partCount: 1,
      startSec: 0,
      endSec: total // 0 means "play to natural end"
    })
    ids.push(item.id)
    remaining -= len
    if (remaining <= 60) break
  }
  return { parts, itemIds: ids }
}
