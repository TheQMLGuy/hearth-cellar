import type { Bucket, Category, CategoryId, ChannelFresh, DayPlan, LoopItem, Mode, Part } from '../types'
import { splitIntoParts, itemDurationSec } from './partitioning'

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

// Lower score = higher priority. Order: unwatched → oldest-watched → recently
// watched.
export function priorityScore(item: LoopItem, now: Date): number {
  if (!item.lastWatchedAt) return 0 // unwatched first
  const watched = Date.parse(item.lastWatchedAt)
  if (!isFinite(watched)) return 0
  const ageDays = Math.max(0, (now.getTime() - watched) / 86_400_000)
  // older = smaller score = higher priority among watched
  return 1 / (1 + ageDays)
}

function categoryAllowedToday(categories: Category[] | undefined, catId: CategoryId, dayOfWeek: number): boolean {
  if (!categories) return true
  const cat = categories.find((c) => c.id === catId)
  if (!cat) return true
  if (!cat.days || cat.days.length === 0) return true
  return cat.days.includes(dayOfWeek)
}

export interface ComputeDayPlanOpts {
  loop: LoopItem[]
  mode: Mode
  channelFresh: Record<string, ChannelFresh>
  channelBucketByChannelId: Record<string, Bucket>
  date?: string
  sundayMinutes?: number
  /** Slice target in seconds. */
  sliceTargetSec?: number
  categories?: Category[]
}

const FALLBACK_MINUTES_PER_DAY = 30

function partLengthSec(part: Part): number {
  return Math.max(0, part.endSec - part.startSec)
}

/** Pick the next un-consumed part for an item, or null if all parts are done. */
function nextPartFor(item: LoopItem, sliceTargetSec: number): Part | null {
  const parts = splitIntoParts(item, sliceTargetSec)
  const consumed = item.partsConsumed ?? 0
  if (consumed >= parts.length) return null
  return parts[consumed]
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
    mode,
    channelFresh,
    channelBucketByChannelId,
    date = todayKey(),
    sundayMinutes = 90,
    sliceTargetSec = 1800,
    categories
  } = opts
  const now = new Date()
  const dow = now.getDay()
  // Eligible items: bucket must match today's mode, and the video must NOT
  // be a confirmed Short (duration > 0 AND <= 60). Items with unknown
  // duration (durationSec === 0, e.g. channel-auto-ingested videos that
  // haven't had their metadata fetched yet) are allowed through — refusing
  // them is what caused "Today is empty even though my loop has videos".
  const eligible = loop.filter((it) => {
    if (!bucketMatches(it.bucket, mode)) return false
    const secs = itemDurationSec(it)
    if (secs > 0 && secs <= 60) return false
    return true
  })

  const parts: Part[] = []
  const seenItemIds = new Set<string>()
  const MIN_PART_FLOOR = 60

  if (mode === 'SUN') {
    // Sunday = the harvest day. Show EVERY eligible SUN-bucket item as a
    // single full-video tile. No minute budget (Sunday is catch-up mode,
    // not portion control). No partitioning (you watch the whole video, or
    // mark it skip). The previous 90-min cap meant one 60-min video filled
    // the day and the rest of the week's uploads vanished.
    // `sundayMinutes` is preserved as a setting but treated as informational
    // only — it's not enforced for picking.
    void sundayMinutes
    void MIN_PART_FLOOR
    const sorted = sortByPriority(eligible, now)
    for (const item of sorted) {
      const total = itemDurationSec(item)
      parts.push({
        itemId: item.id,
        partIdx: 0,
        partCount: 1,
        startSec: 0,
        endSec: total
      })
      seenItemIds.add(item.id)
    }
  } else {
    // Weekday: bucket by category and pack each one to its own minute budget.
    const byCategory: Record<string, LoopItem[]> = {}
    for (const item of eligible) {
      if (!byCategory[item.category]) byCategory[item.category] = []
      byCategory[item.category].push(item)
    }

    const catList = (categories ?? [])
      .filter((c) => categoryAllowedToday(categories, c.id, dow))
      .filter((c) => (c.minutesPerDay ?? FALLBACK_MINUTES_PER_DAY) > 0)

    const partsByCategory: Record<string, Part[]> = {}
    for (const cat of catList) {
      let budget = Math.max(60, (cat.minutesPerDay ?? FALLBACK_MINUTES_PER_DAY) * 60)
      const list = byCategory[cat.id] ?? []
      const sorted = sortByPriority(list, now)
      const cur: Part[] = []
      for (const item of sorted) {
        if (budget < MIN_PART_FLOOR) break
        const part = nextPartFor(item, sliceTargetSec)
        if (!part) continue
        const len = partLengthSec(part)
        // Allow the first part of an empty category to overflow slightly so a
        // single 32-minute slice still gets shown under a 30-minute budget.
        if (len > budget && cur.length > 0) continue
        cur.push(part)
        seenItemIds.add(item.id)
        budget -= len
      }
      partsByCategory[cat.id] = cur
    }
    parts.push(...interleavePartsByCategory(partsByCategory, catList.map((c) => c.id)))
  }

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
    parts
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
    if (secs > 0 && secs <= 60) return false       // reject Shorts
    if (secs > 0 && secs > budgetSec) return false // can't fit in a day
    return true
  })
  const sorted = sortByPriority(eligible, new Date())
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
