import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bucket, Category, CategoryId, Chapter, Course, LoopItem, RoutineItem } from '../types'
import { parseYouTubeUrl } from '../lib/youtube'
import { parseDurationLabel } from '../lib/duration'
import { newId } from '../lib/ids'

interface Props {
  currentMode: Bucket
  categories: Category[]
  onClose: () => void
  onSaveVideo: (item: LoopItem) => void
  onSaveCourse: (course: Course) => void
  onSaveRoutine: (item: RoutineItem) => void
  onSaveWishlist: (item: LoopItem) => void
}

type FetchState = 'idle' | 'loading' | 'ok' | 'fail'
type SaveAs = 'loop' | 'routine' | 'wishlist'

export function IngestPanel({
  currentMode,
  categories,
  onClose,
  onSaveVideo,
  onSaveCourse,
  onSaveRoutine,
  onSaveWishlist
}: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [creator, setCreator] = useState('')
  const [category, setCategory] = useState<CategoryId>(categories[0]?.id ?? 'curiosity')
  const [bucket, setBucket] = useState<Bucket>(currentMode)
  const [saveAs, setSaveAs] = useState<SaveAs>('loop')
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [duration, setDuration] = useState('')
  const [durationSec, setDurationSec] = useState(0)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [saved, setSaved] = useState<'video' | 'course' | 'routine' | 'wishlist' | null>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const lastFetchedKey = useRef<string | null>(null)

  const isShortUrl = /\/shorts\//i.test(url)
  const isShortByDuration = durationSec > 0 && durationSec <= 60
  const isShort = isShortUrl || isShortByDuration

  useEffect(() => {
    urlInputRef.current?.focus()
  }, [])

  const parsed = useMemo(() => parseYouTubeUrl(url), [url])

  useEffect(() => {
    if (!parsed) {
      setFetchState('idle')
      lastFetchedKey.current = null
      return
    }
    const key = `${parsed.kind}:${parsed.id}`
    if (lastFetchedKey.current === key) return
    lastFetchedKey.current = key
    let cancelled = false
    setFetchState('loading')
    const handle = window.setTimeout(async () => {
      const meta =
        parsed.kind === 'video'
          ? await window.hearth.fetchVideoMeta(parsed.id)
          : await window.hearth.fetchPlaylistMeta(parsed.id)
      if (cancelled) return
      if (meta && (meta.title || meta.author)) {
        setTitle((t) => (t.trim() ? t : meta.title))
        setCreator((c) => (c.trim() ? c : meta.author))
        if (meta.duration) setDuration(meta.duration)
        if (typeof meta.durationSec === 'number') setDurationSec(meta.durationSec)
        else if (meta.duration) setDurationSec(parseDurationLabel(meta.duration))
        if (meta.chapters && meta.chapters.length > 0) setChapters(meta.chapters)
        setFetchState('ok')
      } else {
        setFetchState('fail')
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [parsed])

  const urlInvalid = url.trim().length > 0 && parsed === null
  const isPlaylist = parsed?.kind === 'playlist'
  const canSave =
    parsed !== null && title.trim().length > 0 && creator.trim().length > 0 && (isPlaylist || !isShort)

  function handleSave() {
    if (!canSave || !parsed) return
    if (parsed.kind === 'playlist') {
      const course: Course = {
        id: newId('crs_'),
        playlistId: parsed.id,
        url: url.trim(),
        title: title.trim(),
        creator: creator.trim(),
        bucket,
        addedAt: new Date().toISOString()
      }
      onSaveCourse(course)
      setSaved('course')
    } else if (saveAs === 'routine') {
      const item: RoutineItem = {
        id: newId('rou_'),
        url: url.trim(),
        videoId: parsed.id,
        title: title.trim(),
        creator: creator.trim(),
        addedAt: new Date().toISOString()
      }
      onSaveRoutine(item)
      setSaved('routine')
    } else {
      const item: LoopItem = {
        id: newId(saveAs === 'wishlist' ? 'wsh_' : 'itm_'),
        url: url.trim(),
        videoId: parsed.id,
        title: title.trim(),
        creator: creator.trim(),
        duration,
        category,
        bucket,
        addedAt: new Date().toISOString(),
        paras: [],
        lastWatchedAt: null,
        durationSec: durationSec || parseDurationLabel(duration),
        chapters: chapters.length > 0 ? chapters : undefined,
        partsConsumed: 0
      }
      if (saveAs === 'wishlist') {
        onSaveWishlist(item)
        setSaved('wishlist')
      } else {
        onSaveVideo(item)
        setSaved('video')
      }
    }
    setUrl('')
    setTitle('')
    setCreator('')
    setDuration('')
    setDurationSec(0)
    setChapters([])
    lastFetchedKey.current = null
    window.setTimeout(() => {
      setSaved(null)
      onClose()
    }, 1000)
  }

  const hint =
    fetchState === 'loading'
      ? 'Fetching title from YouTube…'
      : isShort && !isPlaylist
      ? "Skipped — looks like a Short."
      : fetchState === 'fail'
      ? "Couldn't auto-fetch. Fill title and creator manually."
      : urlInvalid
      ? "Doesn't look like a YouTube URL."
      : isPlaylist
      ? 'Playlist detected — saves as a Course.'
      : saveAs === 'routine'
      ? 'Routine: appears on Today every day with a daily checkbox.'
      : saveAs === 'wishlist'
      ? 'Wishlist: parked outside your rotation until you promote it.'
      : ''

  return (
    <>
      <div className="ingest-scrim" onClick={onClose} />
      <div
        className="ingest-bar"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'Enter' && canSave) handleSave()
        }}
      >
        {saved ? (
          <div className="ingest-saved">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>
            Saved{saved === 'course' ? ' as a Course' : saved === 'routine' ? ' to your Routine' : saved === 'wishlist' ? ' to your Wishlist' : ' to your loop'}
          </div>
        ) : (
          <>
            <div className="ingest-row">
              <input
                ref={urlInputRef}
                className={`ingest-input${urlInvalid ? ' invalid' : ''}`}
                placeholder="Paste a YouTube video or playlist URL — title fills in automatically"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="ingest-row">
              <input
                className="ingest-input text"
                placeholder={fetchState === 'loading' ? 'Fetching title…' : 'Title'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="ingest-input text"
                placeholder={fetchState === 'loading' ? 'Fetching creator…' : 'Creator'}
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                style={{ flex: '0 0 38%' }}
              />
            </div>

            {!isPlaylist && (
              <div className="ingest-row" style={{ gap: 12, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>SAVE AS</span>
                <div className="bucket-pill">
                  <button className={saveAs === 'loop' ? 'active' : ''} onClick={() => setSaveAs('loop')}>Loop</button>
                  <button className={saveAs === 'routine' ? 'active' : ''} onClick={() => setSaveAs('routine')}>Routine</button>
                  <button className={saveAs === 'wishlist' ? 'active' : ''} onClick={() => setSaveAs('wishlist')}>Wishlist</button>
                </div>
                {saveAs === 'loop' && (
                  <>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)', marginLeft: 8 }}>FOR</span>
                    <div className="bucket-pill">
                      <button className={bucket === 'WKDY' ? 'active' : ''} onClick={() => setBucket('WKDY')}>Weekday</button>
                      <button className={bucket === 'SUN' ? 'active' : ''} onClick={() => setBucket('SUN')}>Sunday</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {isPlaylist && (
              <div className="ingest-row" style={{ gap: 12, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-faint)' }}>FOR</span>
                <div className="bucket-pill">
                  <button className={bucket === 'WKDY' ? 'active' : ''} onClick={() => setBucket('WKDY')}>Weekday</button>
                  <button className={bucket === 'SUN' ? 'active' : ''} onClick={() => setBucket('SUN')}>Sunday</button>
                </div>
              </div>
            )}

            {!isPlaylist && saveAs === 'loop' && bucket !== 'SUN' && (
              <div className="ingest-row" style={{ justifyContent: 'space-between' }}>
                <div className="cat-chips">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      className={`cat-chip${category === c.id ? ' active' : ''}`}
                      onClick={() => setCategory(c.id)}
                    >
                      <span className="dot" style={{ background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
                <button className="ingest-save" disabled={!canSave} onClick={handleSave}>Save</button>
              </div>
            )}
            {!isPlaylist && saveAs === 'loop' && bucket === 'SUN' && (
              <div className="ingest-row" style={{ justifyContent: 'flex-end' }}>
                <button className="ingest-save" disabled={!canSave} onClick={handleSave}>Save to Sunday</button>
              </div>
            )}
            {(isPlaylist || saveAs === 'routine') && (
              <div className="ingest-row" style={{ justifyContent: 'flex-end' }}>
                <button className="ingest-save" disabled={!canSave} onClick={handleSave}>
                  {isPlaylist ? 'Save as Course' : 'Save to Routine'}
                </button>
              </div>
            )}

            {!isPlaylist && saveAs === 'wishlist' && (
              <div className="ingest-row" style={{ justifyContent: 'space-between' }}>
                <div className="cat-chips">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      className={`cat-chip${category === c.id ? ' active' : ''}`}
                      onClick={() => setCategory(c.id)}
                    >
                      <span className="dot" style={{ background: c.color }} />
                      {c.name}
                    </button>
                  ))}
                </div>
                <button className="ingest-save" disabled={!canSave} onClick={handleSave}>Save to Wishlist</button>
              </div>
            )}

            {hint && (
              <div
                className="ingest-hint"
                style={{
                  color:
                    fetchState === 'fail' || urlInvalid
                      ? 'oklch(0.55 0.15 25)'
                      : 'var(--ink-faint)'
                }}
              >
                {hint}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
