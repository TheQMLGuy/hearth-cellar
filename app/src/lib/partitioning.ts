import type { Chapter, LoopItem, Part } from '../types'
import { parseDurationLabel } from './duration'

/** Tolerance: if a video is only ~15% over the slice target, leave it whole. */
const SOLO_TOLERANCE = 1.15
/** Allow a part to grow up to ~30% over the slice if it lets a chapter end cleanly. */
const PART_GROW_TOLERANCE = 1.3

/** True total length in seconds, preferring cached durationSec then label. */
export function itemDurationSec(item: LoopItem): number {
  if (typeof item.durationSec === 'number' && item.durationSec > 0) return item.durationSec
  return parseDurationLabel(item.duration)
}

/**
 * Split a LoopItem into 0+ ordered parts using YouTube chapters when present,
 * else even N-second slices. Returns a single full-length part when the video
 * is at or below the target slice size (with tolerance).
 */
export function splitIntoParts(item: LoopItem, sliceTargetSec: number): Part[] {
  const total = itemDurationSec(item)
  if (total <= 0) {
    // No duration metadata — present as a single full-video part. Use a
    // 10-minute placeholder for budget accounting so the packer doesn't fill
    // a category with unlimited unknown-duration videos.
    return [{ itemId: item.id, partIdx: 0, partCount: 1, startSec: 0, endSec: 600 }]
  }
  if (total <= sliceTargetSec * SOLO_TOLERANCE) {
    return [{ itemId: item.id, partIdx: 0, partCount: 1, startSec: 0, endSec: total }]
  }

  const partsFromChapters = item.chapters && item.chapters.length >= 3
    ? splitByChapters(item.chapters, total, sliceTargetSec)
    : null
  const raw = partsFromChapters ?? splitEvenly(total, sliceTargetSec)

  const partCount = raw.length
  return raw.map((segment, idx) => ({
    itemId: item.id,
    partIdx: idx,
    partCount,
    startSec: segment.start,
    endSec: segment.end
  }))
}

interface RawSegment { start: number; end: number }

function splitEvenly(total: number, target: number): RawSegment[] {
  const n = Math.max(2, Math.ceil(total / target))
  const span = total / n
  const out: RawSegment[] = []
  for (let i = 0; i < n; i++) {
    const start = Math.round(i * span)
    const end = i === n - 1 ? total : Math.round((i + 1) * span)
    out.push({ start, end })
  }
  return out
}

/**
 * Greedy chapter merge. Walk chapters in order and pack them into the current
 * part until adding the next would exceed `target * PART_GROW_TOLERANCE`. If a
 * single chapter is itself too long, sub-slice it evenly.
 */
function splitByChapters(chapters: Chapter[], total: number, target: number): RawSegment[] {
  const maxPartLen = target * PART_GROW_TOLERANCE
  const out: RawSegment[] = []
  let currentStart = chapters[0]?.startSec ?? 0

  for (let i = 0; i < chapters.length; i++) {
    const chStart = chapters[i].startSec
    const chEnd = i + 1 < chapters.length ? chapters[i + 1].startSec : total
    const chLen = chEnd - chStart

    if (chLen > maxPartLen) {
      // Flush whatever's pending first.
      if (chStart > currentStart) {
        out.push({ start: currentStart, end: chStart })
      }
      // Sub-slice this chapter evenly.
      const sub = splitEvenly(chLen, target).map((s) => ({
        start: chStart + s.start,
        end: chStart + s.end
      }))
      out.push(...sub)
      currentStart = chEnd
      continue
    }

    const pendingLen = chEnd - currentStart
    if (pendingLen > maxPartLen) {
      // Close the previous part at the *previous* chapter boundary.
      out.push({ start: currentStart, end: chStart })
      currentStart = chStart
    }
  }
  if (total > currentStart) {
    out.push({ start: currentStart, end: total })
  }
  return out.length >= 2 ? out : splitEvenly(total, target)
}

/** Cosmetic label like "Part 2 / 4 · 28m" for the Player header. */
export function formatPartLabel(part: Part): string {
  if (part.partCount <= 1) return ''
  const lenMin = Math.max(1, Math.round((part.endSec - part.startSec) / 60))
  return `Part ${part.partIdx + 1} / ${part.partCount} · ${lenMin}m`
}
