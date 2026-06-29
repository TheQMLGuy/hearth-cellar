import { useRef, useState } from 'react'
import type { Course, CourseCategory } from '../types'
import { parseYouTubeUrl } from '../lib/youtube'
import { newId } from '../lib/ids'

const PALETTE = [
  'oklch(0.55 0.14 250)', // blue
  'oklch(0.55 0.14 155)', // green
  'oklch(0.60 0.16 55)',  // orange
  'oklch(0.55 0.14 320)', // purple
  'oklch(0.58 0.16 25)',  // red
  'oklch(0.58 0.10 195)', // teal
  'oklch(0.55 0.14 100)', // lime
  'oklch(0.55 0.12 280)', // indigo
  'oklch(0.60 0.14 80)',  // yellow
  'oklch(0.55 0.10 350)', // pink
  'oklch(0.50 0.08 60)',  // brown
  'oklch(0.55 0.00 0)',   // grey
]

const UNCATEGORIZED_ID = '__uncategorized__'

interface Props {
  courses: Course[]
  courseCategories: CourseCategory[]
  activeCourseByCategory: Record<string, string>
  onAdd: (course: Course) => void
  onRemove: (id: string) => void
  onSetActive: (categoryId: string, courseId: string | null) => void
  onSetCourseCategory: (courseId: string, categoryId: string | null) => void
  onOpen: (id: string) => void
  onBack: () => void
  onAddCategory: (cat: CourseCategory) => void
  onUpdateCategory: (id: string, patch: Partial<CourseCategory>) => void
  onDeleteCategory: (id: string) => void
}

interface EditState {
  catId: string
  name: string
  color: string
}

export function Courses({
  courses,
  courseCategories,
  activeCourseByCategory,
  onAdd,
  onRemove,
  onSetActive,
  onSetCourseCategory,
  onOpen,
  onBack,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}: Props) {
  const [draftUrl, setDraftUrl] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [error, setError] = useState('')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const dragDataRef = useRef<string | null>(null)

  // Build columns: one per category + uncategorized
  const columns: { id: string; name: string; color: string; courses: Course[] }[] = [
    ...courseCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      courses: courses.filter((c) => c.category === cat.id)
    })),
    {
      id: UNCATEGORIZED_ID,
      name: 'Uncategorized',
      color: 'oklch(0.55 0.00 0)',
      courses: courses.filter(
        (c) => !c.category || !courseCategories.some((cat) => cat.id === c.category)
      )
    }
  ]

  async function handleAdd() {
    setError('')
    const parsed = parseYouTubeUrl(draftUrl)
    if (!parsed) {
      setError('Paste a YouTube URL — a playlist (with "list=") or a single video.')
      return
    }
    setDrafting(true)
    if (parsed.kind === 'playlist') {
      const meta = await window.hearth.fetchPlaylistMeta(parsed.id)
      setDrafting(false)
      const course: Course = {
        id: newId('crs_'),
        playlistId: parsed.id,
        url: draftUrl.trim(),
        title: meta?.title ?? 'Untitled course',
        creator: meta?.author ?? '',
        bucket: 'WKDY',
        addedAt: new Date().toISOString()
      }
      onAdd(course)
      setDraftUrl('')
      return
    }
    // Single video → auto-split
    const meta = await window.hearth.fetchVideoMeta(parsed.id)
    setDrafting(false)
    if (!meta) {
      setError("Couldn't read that video's metadata.")
      return
    }
    let total = meta.durationSec ?? 0
    if (total <= 0) {
      const manual = prompt(
        `Couldn't auto-read the length of "${meta.title || parsed.id}".\n\nHow many minutes long is it? (whole number)`
      )
      if (!manual) return
      const mins = parseInt(manual.trim(), 10)
      if (!Number.isFinite(mins) || mins <= 0) {
        setError("That didn't look like a valid number of minutes.")
        return
      }
      total = mins * 60
    }
    const TARGET_SEC = 45 * 60
    const chapters = meta.chapters ?? []
    let segments: { startSec: number; endSec: number; title: string }[] = []
    if (chapters.length >= 3) {
      let i = 0
      while (i < chapters.length) {
        const startSec = chapters[i].startSec
        let j = i
        let endSec = i + 1 < chapters.length ? chapters[i + 1].startSec : total
        while (j + 1 < chapters.length) {
          const nextEnd = j + 2 < chapters.length ? chapters[j + 2].startSec : total
          if (nextEnd - startSec > TARGET_SEC * 1.3) break
          endSec = nextEnd
          j += 1
        }
        segments.push({ startSec, endSec, title: chapters[i].title })
        i = j + 1
      }
    } else {
      const n = Math.max(2, Math.ceil(total / TARGET_SEC))
      const span = total / n
      for (let k = 0; k < n; k++) {
        const startSec = Math.round(k * span)
        const endSec = k === n - 1 ? total : Math.round((k + 1) * span)
        segments.push({ startSec, endSec, title: `Part ${k + 1}` })
      }
    }
    const sourceLabel = chapters.length >= 3 ? 'YouTube chapters' : 'even 45-min slices'
    const ok = confirm(
      `"${meta.title}" is ${Math.round(total / 60)} minutes long.\n\n` +
      `It will be split into ${segments.length} parts using ${sourceLabel} and added to Courses.\n\n` +
      `Continue?`
    )
    if (!ok) return
    const course: Course = {
      id: newId('crs_'),
      playlistId: `single:${parsed.id}`,
      url: draftUrl.trim(),
      title: meta.title || 'Untitled course',
      creator: meta.author || '',
      bucket: 'WKDY',
      addedAt: new Date().toISOString(),
      singleVideo: {
        videoId: parsed.id,
        durationSec: total,
        parts: segments
      }
    }
    onAdd(course)
    setDraftUrl('')
  }

  // ─── Drag handlers ────────────────────────────────
  function onDragStart(e: React.DragEvent, courseId: string) {
    dragDataRef.current = courseId
    setDraggingId(courseId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', courseId)
  }
  function onDragEnd() {
    setDraggingId(null)
    setDragOverCol(null)
    dragDataRef.current = null
  }
  function onDragOver(e: React.DragEvent, colId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverCol !== colId) setDragOverCol(colId)
  }
  function onDragLeave(e: React.DragEvent, colId: string) {
    // Only clear if truly leaving the column
    const related = e.relatedTarget as HTMLElement | null
    const colEl = (e.currentTarget as HTMLElement)
    if (related && colEl.contains(related)) return
    if (dragOverCol === colId) setDragOverCol(null)
  }
  function onDrop(e: React.DragEvent, colId: string) {
    e.preventDefault()
    setDragOverCol(null)
    setDraggingId(null)
    const courseId = dragDataRef.current ?? e.dataTransfer.getData('text/plain')
    if (!courseId) return
    const newCat = colId === UNCATEGORIZED_ID ? null : colId
    onSetCourseCategory(courseId, newCat)
    dragDataRef.current = null
  }

  // ─── Category editing ─────────────────────────────
  function handleAddCat() {
    const id = newId('cc_')
    const nextColor = PALETTE[(courseCategories.length) % PALETTE.length]
    onAddCategory({ id, name: 'New Category', color: nextColor })
    setEditState({ catId: id, name: 'New Category', color: nextColor })
  }
  function saveEdit() {
    if (!editState) return
    onUpdateCategory(editState.catId, { name: editState.name, color: editState.color })
    setEditState(null)
  }
  function deleteEditCat() {
    if (!editState) return
    if (!confirm(`Delete category "${editState.name}"? Courses will move to Uncategorized.`)) return
    onDeleteCategory(editState.catId)
    setEditState(null)
  }

  return (
    <div className="screen scroll-pad kanban-screen">
      {/* Header */}
      <div className="kanban-header">
        <div>
          <div className="eyebrow">Learning</div>
          <h2 style={{ fontFamily: 'var(--serif)', fontWeight: 400 }}>Course Board</h2>
        </div>
      </div>

      {/* Add course bar */}
      <div className="kanban-add-bar">
        <input
          type="text"
          value={draftUrl}
          onChange={(e) => setDraftUrl(e.target.value)}
          placeholder="Paste a YouTube playlist URL — or a long single video to auto-split..."
          className="ingest-input"
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
        />
        <button
          className="ingest-save"
          disabled={drafting || draftUrl.trim().length === 0}
          onClick={handleAdd}
        >
          {drafting ? 'Adding…' : '+ Add'}
        </button>
      </div>
      {error && <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)', marginBottom: 12 }}>{error}</div>}

      {/* Category strip */}
      <div className="ccat-strip">
        {courseCategories.map((cat) => {
          const count = courses.filter((c) => c.category === cat.id).length
          return (
            <button
              key={cat.id}
              className="ccat-pill"
              onClick={() => setEditState({ catId: cat.id, name: cat.name, color: cat.color })}
            >
              <span className="ccat-dot" style={{ background: cat.color }} />
              {cat.name}
              <span className="ccat-count">{count}</span>
            </button>
          )
        })}
        <button className="ccat-add-btn" onClick={handleAddCat}>+ Category</button>
      </div>

      {/* Category edit popover */}
      {editState && (
        <div style={{ position: 'relative', zIndex: 20 }}>
          <div className="ccat-edit-popover" style={{ position: 'relative' }}>
            <input
              autoFocus
              value={editState.name}
              onChange={(e) => setEditState({ ...editState, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }}
              placeholder="Category name"
            />
            <div className="ccat-color-grid">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`ccat-color-swatch${editState.color === c ? ' selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setEditState({ ...editState, color: c })}
                />
              ))}
            </div>
            <div className="ccat-edit-actions">
              {courseCategories.length > 1 && (
                <button className="danger" onClick={deleteEditCat}>Delete</button>
              )}
              <button onClick={() => setEditState(null)}>Cancel</button>
              <button onClick={saveEdit} style={{ background: 'var(--ember-tint)', borderColor: 'var(--ember)', color: 'var(--ember-ink)' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      {courses.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <h2>No courses yet</h2>
          <p>Paste a YouTube playlist URL — or a single long video, which will auto-split into ~45-min parts.</p>
        </div>
      ) : (
        <div className="kanban-board">
          {columns.map((col) => {
            // Don't render uncategorized column if it's empty
            if (col.id === UNCATEGORIZED_ID && col.courses.length === 0) return null
            const activeId = activeCourseByCategory[col.id] ?? null
            return (
              <div
                key={col.id}
                className={`kanban-col${dragOverCol === col.id ? ' drag-over' : ''}`}
                onDragOver={(e) => onDragOver(e, col.id)}
                onDragLeave={(e) => onDragLeave(e, col.id)}
                onDrop={(e) => onDrop(e, col.id)}
              >
                <div className="kanban-col-head">
                  <span className="kanban-col-dot" style={{ background: col.color }} />
                  <span className="kanban-col-name">{col.name}</span>
                  <span className="kanban-col-count">{col.courses.length}</span>
                </div>
                <div
                  className="kanban-col-body"
                  /* Belt-and-suspenders: the parent .kanban-col already has
                   * drag handlers and events bubble, but on some Windows
                   * webview builds the drop event got eaten by the cards'
                   * own draggable=true children. Wiring drag/drop directly
                   * on the body too makes the drop zone unambiguous. */
                  onDragOver={(e) => onDragOver(e, col.id)}
                  onDrop={(e) => onDrop(e, col.id)}
                >
                  {col.courses.length === 0 ? (
                    <div
                      className="kanban-empty"
                      onDragOver={(e) => onDragOver(e, col.id)}
                      onDrop={(e) => onDrop(e, col.id)}
                    >Drag courses here</div>
                  ) : (
                    col.courses.map((c) => (
                      <div
                        key={c.id}
                        className={`course-card${draggingId === c.id ? ' dragging' : ''}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, c.id)}
                        onDragEnd={onDragEnd}
                        onClick={() => onOpen(c.id)}
                      >
                        <div className="course-card-accent" style={{ background: col.color }} />
                        <div className="course-card-body">
                          <div className="course-card-title">{c.title}</div>
                          {c.creator && <div className="course-card-creator">{c.creator}</div>}
                          <div className="course-card-footer">
                            <span className="course-card-bucket">{c.bucket === 'WKDY' ? 'Wkdy' : 'Sun'}</span>
                            {activeId === c.id && (
                              <span className="course-card-active">Active</span>
                            )}
                            <div className="course-card-actions" onClick={(e) => e.stopPropagation()}>
                              {activeId === c.id ? (
                                <button
                                  className="course-card-btn"
                                  onClick={() => onSetActive(col.id, null)}
                                  title="Unset active"
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  className="course-card-btn"
                                  onClick={() => onSetActive(col.id, c.id)}
                                  title="Set as active for this category"
                                >
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path d="M9 12l2 2 4-4" />
                                    <circle cx="12" cy="12" r="10" />
                                  </svg>
                                </button>
                              )}
                              <button
                                className="course-card-btn danger"
                                onClick={() => onRemove(c.id)}
                                title="Remove course"
                              >
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
