import { useState } from 'react'
import type { RoutineItem } from '../types'
import { parseYouTubeUrl, shortLabelForUrl } from '../lib/youtube'
import { newId } from '../lib/ids'

interface Props {
  items: RoutineItem[]
  doneIds: Set<string>
  onAdd: (item: RoutineItem) => void
  onRemove: (id: string) => void
  onToggleDone: (id: string) => void
  onOpen: (item: RoutineItem) => void
  onBack: () => void
}

export function Routine({
  items,
  doneIds,
  onAdd,
  onRemove,
  onToggleDone,
  onOpen,
  onBack
}: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [creator, setCreator] = useState('')
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  async function handleAdd() {
    setError('')
    const parsed = parseYouTubeUrl(url)
    if (!parsed || parsed.kind !== 'video') {
      setError('Paste a single YouTube video URL.')
      return
    }
    let t = title.trim()
    let c = creator.trim()
    if (!t || !c) {
      setFetching(true)
      const meta = await window.hearth.fetchVideoMeta(parsed.id)
      setFetching(false)
      if (meta) {
        if (!t) t = meta.title
        if (!c) c = meta.author
      }
    }
    if (!t || !c) {
      setError("Couldn't auto-fetch title/creator. Fill them manually.")
      return
    }
    onAdd({
      id: newId('rou_'),
      videoId: parsed.id,
      url: url.trim(),
      title: t,
      creator: c,
      addedAt: new Date().toISOString()
    })
    setUrl('')
    setTitle('')
    setCreator('')
  }

  const doneCount = items.filter((it) => doneIds.has(it.id)).length

  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <div className="eyebrow">Daily Ritual</div>
        <h2 className="page-h2">Routine</h2>
        <p className="page-lede">
          Videos you do every day. Tick them off as you go. Resets at midnight.
        </p>

        {items.length > 0 && (
          <div className="routine-page-progress">
            <div className="routine-bar"><div className="routine-bar-fill" style={{ width: `${(doneCount / items.length) * 100}%` }} /></div>
            <span className="routine-count">{doneCount} of {items.length} done today</span>
          </div>
        )}

        <div className="channel-add" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, marginTop: 16 }}>
          <input
            className="ingest-input text"
            placeholder="Paste a YouTube video URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="ingest-input text"
              placeholder="Title (auto-fills)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="ingest-input text"
              placeholder="Creator (auto-fills)"
              value={creator}
              onChange={(e) => setCreator(e.target.value)}
              style={{ flex: '0 0 35%' }}
            />
            <button
              className="ingest-save"
              disabled={fetching || !url.trim()}
              onClick={handleAdd}
            >
              {fetching ? 'Fetching…' : '+ Add'}
            </button>
          </div>
          {error && <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)' }}>{error}</div>}
        </div>

        <div style={{ marginTop: 22 }}>
          {items.length === 0 ? (
            <div className="empty" style={{ marginTop: 24 }}>
              <h2>No routine yet</h2>
              <p>Add the videos you want to see every single day above. Great for stretches, sit-ups, a daily news clip, or a meditation.</p>
            </div>
          ) : (
            <div className="routine-grid">
              {items.map((it) => {
                const done = doneIds.has(it.id)
                return (
                  <div key={it.id} className={`routine-page-card${done ? ' done' : ''}`}>
                    <button
                      className={`routine-check large${done ? ' on' : ''}`}
                      onClick={() => onToggleDone(it.id)}
                      title={done ? 'Mark not done' : 'Mark done for today'}
                      aria-label={done ? 'Mark not done' : 'Mark done'}
                    >
                      {done && (
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <div className="routine-page-body" onClick={() => onOpen(it)}>
                      <div className="routine-page-title">{it.title}</div>
                      <div className="routine-page-meta">
                        <span>{it.creator}</span>
                        <span className="dot-sep">·</span>
                        <span className="vault-url">{shortLabelForUrl(it.url)}</span>
                      </div>
                    </div>
                    <button className="x-btn" onClick={() => onRemove(it.id)} title="Remove">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
