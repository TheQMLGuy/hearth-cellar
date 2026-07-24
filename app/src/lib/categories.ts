import type { Category, CategoryId } from '../types'

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'curiosity',
    name: 'Curiosity',
    color: 'oklch(0.640 0.150 47)',
    dotShadow: '0 0 0 3px oklch(0.640 0.150 47 / 0.18)',
    days: ALL_DAYS
  },
  {
    id: 'reflective',
    name: 'Reflective',
    color: 'oklch(0.55 0.10 250)',
    dotShadow: '0 0 0 3px oklch(0.55 0.10 250 / 0.18)',
    days: ALL_DAYS
  },
  {
    id: 'craft',
    name: 'Craft',
    color: 'oklch(0.50 0.12 145)',
    dotShadow: '0 0 0 3px oklch(0.50 0.12 145 / 0.18)',
    days: ALL_DAYS
  }
]

export const COLOR_SWATCHES: Array<{ name: string; color: string }> = [
  { name: 'Ember',    color: 'oklch(0.640 0.150 47)' },
  { name: 'Twilight', color: 'oklch(0.55 0.10 250)' },
  { name: 'Moss',     color: 'oklch(0.50 0.12 145)' },
  { name: 'Plum',     color: 'oklch(0.55 0.12 320)' },
  { name: 'Ochre',    color: 'oklch(0.65 0.13 80)' },
  { name: 'Teal',     color: 'oklch(0.55 0.10 200)' },
  { name: 'Coral',    color: 'oklch(0.70 0.16 30)' },
  { name: 'Slate',    color: 'oklch(0.52 0.02 250)' }
]

export function dotShadowFor(color: string): string {
  return `0 0 0 3px ${color.replace(')', ' / 0.18)').replace('oklch(', 'oklch(')}`
}

export function lookupCategory(categories: Category[], id: CategoryId): Category {
  const found = categories.find((c) => c.id === id)
  if (found) return found
  const def = DEFAULT_CATEGORIES[0]
  if (def) return def
  throw new Error("Default category not found")
}

export function makeCategoryMap(categories: Category[]): Record<CategoryId, Category> {
  return Object.fromEntries(categories.map((c) => [c.id, c])) as Record<CategoryId, Category>
}

// Backward-compat alias for components that haven't been threaded the
// per-user categories yet. They get the defaults; live custom categories
// only show when the prop is passed.
export const CATEGORIES = DEFAULT_CATEGORIES
export const CATEGORY_BY_ID = makeCategoryMap(DEFAULT_CATEGORIES)

