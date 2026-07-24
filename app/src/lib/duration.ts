/**
 * Duration utilities. The Rust backend already converts ISO 8601 (e.g.
 * "PT1H30M15S") to a colon label (e.g. "1:30:15"); this module provides the
 * inverse (label → seconds) plus a formatter for parts.
 */

/** "1:30:15" → 5415, "5:12" → 312, "" / invalid → 0. */
export function parseDurationLabel(label: string | undefined | null): number {
  if (!label) return 0
  const parts = String(label).trim().split(':')
  if (parts.length === 0 || parts.some((p) => !/^\d+$/.test(p))) return 0
  const nums = parts.map((p) => Number(p))
  if (nums.some((n) => !Number.isFinite(n))) return 0
  const [n0, n1, n2] = nums
  if (nums.length === 1 && n0 !== undefined) return n0
  if (nums.length === 2 && n0 !== undefined && n1 !== undefined) return n0 * 60 + n1
  if (nums.length === 3 && n0 !== undefined && n1 !== undefined && n2 !== undefined) return n0 * 3600 + n1 * 60 + n2
  return 0
}

/** Inverse: 5415 → "1:30:15", 312 → "5:12". */
export function formatSeconds(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0:00'
  const t = Math.round(totalSec)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Friendlier "32m" / "1h 8m" used in headers and part labels. */
export function formatMinutesLabel(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec <= 0) return '0m'
  const mins = Math.round(totalSec / 60)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}
