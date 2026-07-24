import type { Spark, SparkKind, SparkKindMeta } from '../types'

// Mirrors Ember's `BRAIN_KINDS` / `BRAIN_KIND_ORDER` so future sync is a
// direct copy. Do not rename — the ids are the wire format.
export const SPARK_KINDS: Record<SparkKind, SparkKindMeta> = {
  problem:     { label: 'Problem',     glyph: '!',  color: '#c4683d', bg: '#f5e3d6', text: '#7a3d1d' },
  idea:        { label: 'Idea',        glyph: '💡', color: '#c89740', bg: '#f3e5c4', text: '#7a5215' },
  question:    { label: 'Question',    glyph: '?',  color: '#5b9472', bg: '#dde9e0', text: '#2d5a3e' },
  realization: { label: 'Realization', glyph: '✦', color: '#9c7aa0', bg: '#ebe1ee', text: '#4a3251' },
  solution:    { label: 'Solution',    glyph: '◆', color: '#7387a8', bg: '#dde4ec', text: '#324158' },
}

export const SPARK_KIND_ORDER: SparkKind[] = ['problem', 'idea', 'question', 'realization', 'solution']

/** YYYY-MM-DD in local time. Matches todayKey() elsewhere in the app. */
export function sparkDateKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function newSparkId(): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `sprk_${Date.now()}_${rand}`
}

/**
 * Build a Spark with sensible defaults. Fields the user hasn't touched fall
 * through to Ember-compatible defaults (`confidence: -1`, `status: 'seed'`)
 * so a future export doesn't have to fill blanks.
 */
export function makeSpark(input: {
  title: string
  description: string
  kind: SparkKind | ''
  category: string
  tags: string[]
  sourceVideoId?: string
}): Spark {
  const now = new Date()
  return {
    id: newSparkId(),
    title: input.title.trim(),
    description: input.description.trim(),
    kind: input.kind,
    category: input.category,
    tags: input.tags,
    createdAt: now.toISOString(),
    createdDate: sparkDateKey(now),
    sourceVideoId: input.sourceVideoId,
    status: 'seed',
    confidence: -1,
    messageCount: 0,
    topOfMind: false,
    projectId: '',
    sectionId: '',
    notes: '',
  }
}
