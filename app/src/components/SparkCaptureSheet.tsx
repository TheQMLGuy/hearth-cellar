import { useEffect, useMemo, useRef, useState } from 'react'
import type { Category, CategoryId, Spark, SparkKind } from '../types'
import { SPARK_KINDS, SPARK_KIND_ORDER, makeSpark } from '../lib/sparks'

function addAlphaToColor(color: string, alpha: number): string {
  if (color.startsWith('oklch(')) {
    return color.replace(')', ` / ${alpha})`)
  }
  if (color.startsWith('#')) {
    const rawAlpha = Math.round(alpha * 255).toString(16).padStart(2, '0')
    return color + rawAlpha
  }
  return color
}

interface Props {
  open: boolean
  categories: Category[]
  /** Video the user is currently watching, if any — tagged onto the spark. */
  sourceVideoId?: string
  onClose: () => void
  onSave: (spark: Spark) => void
}

/**
 * Centered modal for capturing a new spark. Mirrors Ember's CaptureSheet
 * fields (title, kind, category, tags, notes) but drops the section/project/
 * concrete pickers — H&C's category model is already flat.
 *
 * On submit we mint a Spark via `makeSpark` and hand it upward; the parent is
 * responsible for persisting it to the store.
 */
export function SparkCaptureSheet({ open, categories, sourceVideoId, onClose, onSave }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<SparkKind | ''>('idea')
  const [category, setCategory] = useState<CategoryId>('')
  const [tagsRaw, setTagsRaw] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Reset every time the sheet opens so consecutive captures don't leak state.
  useEffect(() => {
    if (open) {
      setTitle('')
      setDescription('')
      setKind('idea')
      setCategory('')
      setTagsRaw('')
      // Autofocus after the modal mounts.
      setTimeout(() => titleRef.current?.focus(), 40)
    }
  }, [open])

  // Ctrl+Enter or Ctrl+S to save from anywhere inside the sheet.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        submit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, description, kind, category, tagsRaw])

  const canSave = title.trim().length > 0

  const tags = useMemo(
    () => tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
    [tagsRaw]
  )

  function submit() {
    if (!canSave) return
    const spark = makeSpark({
      title: title.trim(),
      description: description.trim(),
      kind,
      category,
      tags,
      sourceVideoId
    })
    onSave(spark)
    onClose()
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.42)',
        backdropFilter: 'blur(3px)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--paper, #f5f4f0)',
          border: '1px solid var(--hairline, #e2dfd5)',
          borderRadius: 14,
          width: 'min(840px, 92vw)',
          maxHeight: '85vh',
          overflow: 'auto',
          padding: 22,
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
          color: 'var(--ink)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: SPARK_KINDS[kind || 'idea'].color,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              fontSize: 15,
              fontFamily: 'var(--mono)'
            }}
            aria-hidden
          >
            {SPARK_KINDS[kind || 'idea'].glyph}
          </div>
          <div style={{ flex: 1 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)'
              }}
            >
              Capture
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18 }}>A new spark.</div>
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-faint)',
              fontSize: 18,
              cursor: 'pointer',
              padding: 4
            }}
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is it? One sentence."
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'var(--paper-deep, #edebe4)',
            border: '1px solid var(--hairline, #e2dfd5)',
            outline: 'none',
            resize: 'none',
            fontFamily: 'var(--serif)',
            fontSize: 16,
            lineHeight: 1.4,
            color: 'var(--ink)',
            boxSizing: 'border-box'
          }}
        />

        {/* Kind picker */}
        <div style={{ marginTop: 14 }}>
          <SparkFieldLabel>Kind</SparkFieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SPARK_KIND_ORDER.map((k) => {
              const meta = SPARK_KINDS[k]
              const on = kind === k
              return (
                <button
                  type="button"
                  key={k}
                  onClick={() => setKind(on ? '' : k)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 999,
                    background: on ? meta.color : 'var(--paper-deep, #edebe4)',
                    color: on ? 'white' : 'var(--ink-soft)',
                    border: `1px solid ${on ? meta.color : 'var(--hairline, #e2dfd5)'}`,
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <span aria-hidden>{meta.glyph}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Category picker — H&C's flat categories */}
        {categories.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <SparkFieldLabel>Category</SparkFieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {categories.map((c) => {
                const on = category === c.id
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setCategory(on ? '' : c.id)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      background: on ? addAlphaToColor(c.color, 0.15) : 'var(--paper-deep, #edebe4)',
                      color: on ? 'var(--ink)' : 'var(--ink-soft)',
                      border: `1px solid ${on ? addAlphaToColor(c.color, 0.5) : 'var(--hairline, #e2dfd5)'}`,
                      fontSize: 12,
                      fontFamily: 'var(--mono)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: c.color,
                        display: 'inline-block'
                      }}
                    />
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <div style={{ marginTop: 14 }}>
          <SparkFieldLabel>Description (optional)</SparkFieldLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Full thought — where did it come from, what does it point at?"
            rows={6}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--paper-deep, #edebe4)',
              border: '1px solid var(--hairline, #e2dfd5)',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--serif)',
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--ink)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Tags */}
        <div style={{ marginTop: 14 }}>
          <SparkFieldLabel>Tags (comma-separated)</SparkFieldLabel>
          <input
            type="text"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="e.g. cross-field, ux, follow-up"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--paper-deep, #edebe4)',
              border: '1px solid var(--hairline, #e2dfd5)',
              outline: 'none',
              fontFamily: 'var(--mono)',
              fontSize: 13,
              color: 'var(--ink)',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {sourceVideoId && (
          <div
            style={{
              marginTop: 14,
              padding: '6px 10px',
              borderRadius: 6,
              background: 'var(--paper-deep, #edebe4)',
              border: '1px dashed var(--hairline, #e2dfd5)',
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-faint)'
            }}
          >
            Linked to video · <span style={{ color: 'var(--ember)' }}>{sourceVideoId}</span>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 20
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 10, color: 'var(--ink-faint)', letterSpacing: '0.08em' }}
          >
            Ctrl+Enter to save · Esc to cancel
          </span>
          <button
            onClick={submit}
            disabled={!canSave}
            className="ingest-save"
            style={{ padding: '8px 18px', opacity: canSave ? 1 : 0.4 }}
          >
            Save spark
          </button>
        </div>
      </div>
    </div>
  )
}

function SparkFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-faint)',
        marginBottom: 6
      }}
    >
      {children}
    </div>
  )
}
