import { useEffect, useRef, useState, useMemo } from 'react'
import type { LoopItem } from '../types'
import { buildEmbedUrl, buildWatchUrl } from '../lib/youtube'

interface Props {
  item: LoopItem
  isFavorited: boolean
  isWatched: boolean
  focusTimerLabel: string | null
  isFocusTimerManuallyPaused?: boolean
  onToggleFocusTimerPause?: () => void
  /** Seconds to resume from (0 / undefined = start). */
  startSec?: number
  /** Hard stop boundary for partitioned playback (undefined = play to end). */
  endSec?: number
  /** Optional caption like "Part 2 / 4 · 28m". */
  partLabel?: string | null
  /** Whether the underlying video currently has a note attached. */
  hasNote?: boolean
  onToggleFavorite: () => void
  onAttachNote?: () => void
  onDone: () => void
  onClose: () => void
  doneLabel?: string
  doneHint?: string
  /** Save a mid-video bookmark at the current playback position with a note.
   * Fired by the `b` key. */
  onBookmark?: (sec: number, note: string) => void
}

const NotebookIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
)

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
)

export function Player({
  item,
  isFavorited,
  isWatched,
  focusTimerLabel,
  isFocusTimerManuallyPaused,
  onToggleFocusTimerPause,
  startSec,
  endSec,
  partLabel,
  hasNote,
  onToggleFavorite,
  onAttachNote,
  onDone,
  onClose,
  doneLabel = 'Done',
  doneHint,
  onBookmark
}: Props) {
  const [rewatchPromptOpen, setRewatchPromptOpen] = useState(false)
  const [rewatchArmed, setRewatchArmed] = useState(false) // heart already clicked in this session

  const [showTranscript, setShowTranscript] = useState(false)
  const [transcript, setTranscript] = useState<import('../types').TranscriptCue[]>([])
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptError, setTranscriptError] = useState('')
  const [videoTime, setVideoTime] = useState<number>(startSec ?? 0)
  const [searchTerm, setSearchTerm] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)

  const handleToggleTranscript = async () => {
    const nextShow = !showTranscript
    setShowTranscript(nextShow)
    if (nextShow && transcript.length === 0 && !transcriptLoading) {
      setTranscriptLoading(true)
      setTranscriptError('')
      try {
        const cues = await window.hearth.fetchVideoTranscript(item.videoId)
        setTranscript(cues)
        if (cues.length === 0) {
          setTranscriptError('No transcript available for this video.')
        }
      } catch (err) {
        setTranscriptError('Failed to fetch transcript.')
      } finally {
        setTranscriptLoading(false)
      }
    }
  }

  const activeCueIndex = useMemo(() => {
    if (transcript.length === 0) return -1
    return transcript.findIndex((cue, i) => {
      const nextCue = transcript[i + 1]
      return videoTime >= cue.startSec && (!nextCue || videoTime < nextCue.startSec)
    })
  }, [transcript, videoTime])

  // Scroll active cue into view
  useEffect(() => {
    if (!autoScroll || activeCueIndex < 0) return
    const el = document.querySelector(`.cue-item[data-index="${activeCueIndex}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeCueIndex, autoScroll])

  // Keep a live currentTime for chapter/bookmark commands. This is a ref so
  // the postMessage handler updates don't cause re-renders.
  const currentTimeRef = useRef<number>(startSec ?? 0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (rewatchPromptOpen) return // let the modal own keys
      // Ignore keys while typing in an input.
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'Escape') { onClose(); return }
      // Chapter navigation.
      if (e.key === 'n' || e.key === 'N') { seekToChapter(+1); return }
      if (e.key === 'p' || e.key === 'P') { seekToChapter(-1); return }
      // Mid-video bookmark. Ask for a note inline.
      if ((e.key === 'b' || e.key === 'B') && onBookmark) {
        const sec = Math.round(currentTimeRef.current)
        const note = prompt(`Bookmark at ${formatHms(sec)}. Optional note:`, '')
        if (note !== null) onBookmark(sec, note)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, onBookmark, rewatchPromptOpen])

  // Send a `seekTo` command to the player iframe (YouTube IFrame API).
  function seekTo(sec: number) {
    const iframe = document.querySelector<HTMLIFrameElement>(`iframe[data-video-id="${item.videoId}"]`)
    if (!iframe || !iframe.contentWindow) return
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: 'seekTo', args: [Math.max(0, sec), true] }),
      '*'
    )
  }

  function seekToChapter(dir: 1 | -1) {
    const chapters = item.chapters ?? []
    if (chapters.length === 0) return
    const cur = currentTimeRef.current
    // Find current chapter index (largest chapter.startSec <= cur+0.5).
    let idx = -1
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].startSec <= cur + 0.5) idx = i
      else break
    }
    const target = Math.min(chapters.length - 1, Math.max(0, idx + dir))
    if (target === idx && dir === -1) {
      // Already at first chapter — jump to 0.
      seekTo(0)
      return
    }
    seekTo(chapters[target].startSec)
  }

  function formatHms(sec: number): string {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
  }

  // Lock start/end at mount time. If we re-derived these from props on every
  // render, the iframe URL would change every time progress flushed, causing
  // YouTube to re-mount the player — which kills 2x speed, scrubs, and feels
  // like the video is auto-pausing. The Player remounts when the videoId
  // changes (key on <Player>), so this captures a fresh window each time.
  const initialStart = useRef(startSec)
  const initialEnd = useRef(endSec)

  // Auto-mark Done when the user crosses the partition's end boundary. The
  // YouTube IFrame API's `end=` URL param fires `onStateChange(0)` reliably
  // for natural video end, but for partitioned videos we need to detect it
  // ourselves — YouTube treats `end=` as "stop playback", not "video ended".
  // We watch postMessage timeUpdate events from THIS player's iframe and
  // fire onDone() once when currentTime crosses endSec.
  const autoDoneFiredRef = useRef(false)
  useEffect(() => {
    autoDoneFiredRef.current = false

    function onMessage(e: MessageEvent) {
      if (!String(e.origin || '').includes('youtube')) return
      // Only listen to messages from OUR iframe — otherwise a second player
      // (e.g. CourseFocus) would fire our onDone.
      const ours = document.querySelector<HTMLIFrameElement>(
        `iframe[data-video-id="${item.videoId}"]`
      )
      if (!ours || ours.contentWindow !== e.source) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data || !data.info) return
        const info = data.info as { currentTime?: number; playerState?: number }
        // Track live playhead so chapter/bookmark commands know where we are.
        if (typeof info.currentTime === 'number') {
          currentTimeRef.current = info.currentTime
          setVideoTime(info.currentTime)
        }
        if (autoDoneFiredRef.current) return
        // Natural full-video end — YouTube fires state 0 ('ended').
        if (info.playerState === 0) {
          autoDoneFiredRef.current = true
          setRewatchPromptOpen(true)
          return
        }
        // Partitioned end — fire ~1s before endSec to beat YouTube's own
        // boundary stop, otherwise it pauses there silently and the user is
        // left staring at a paused frame.
        const cur = info.currentTime
        if (endSec && typeof cur === 'number' && cur >= endSec - 1) {
          autoDoneFiredRef.current = true
          setRewatchPromptOpen(true)
        }
      } catch {
        // ignore non-JSON
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [endSec, item.videoId, onDone])

  return (
    <div className="player">
      <div className="player-head">
        <button
          onClick={onClose}
          aria-label="Back"
          className="back-chevron"
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">{item.title}{isWatched && <span className="title-tag">watched</span>}</div>
          <div className="meta">
            {item.creator}
            {item.duration ? ` · ${item.duration}` : ''}
            {partLabel ? ` · ${partLabel}` : ''}
          </div>
        </div>
        {focusTimerLabel && (
          <div className="focus-pill" title="Focus session — ticks at half-speed when video is paused until stopped. Click pause button to hold completely.">
            <span className={`focus-dot ${isFocusTimerManuallyPaused ? 'paused' : ''}`} />
            {focusTimerLabel}
            {onToggleFocusTimerPause && (
              <button
                type="button"
                className="focus-pill-toggle"
                onClick={onToggleFocusTimerPause}
                title={isFocusTimerManuallyPaused ? 'Resume focus timer' : 'Manually pause focus timer'}
                aria-label={isFocusTimerManuallyPaused ? 'Resume focus timer' : 'Manually pause focus timer'}
              >
                {isFocusTimerManuallyPaused ? '▶' : '❚❚'}
              </button>
            )}
          </div>
        )}
        <button
          className={`heart-btn ${isFavorited ? 'on' : ''}`}
          onClick={onToggleFavorite}
          title={isFavorited ? 'Remove from Wishlist' : 'Send to Wishlist (removes from Loop)'}
          aria-label={isFavorited ? 'Remove from Wishlist' : 'Send to Wishlist'}
          style={{ marginLeft: 4 }}
        >
          <HeartIcon filled={isFavorited} />
        </button>
        <button
          className={`heart-btn ${showTranscript ? 'on' : ''}`}
          onClick={handleToggleTranscript}
          title={showTranscript ? 'Hide Transcript' : 'Show Transcript'}
          aria-label={showTranscript ? 'Hide Transcript' : 'Show Transcript'}
          style={{ marginLeft: 4 }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h11" />
          </svg>
        </button>
        {onAttachNote && (
          <button
            className={`heart-btn ${hasNote ? 'on' : ''}`}
            onClick={onAttachNote}
            title={hasNote ? 'Notes attached — change' : 'Attach reMarkable notes'}
            aria-label="Attach reMarkable notes"
            style={{ marginLeft: 4 }}
          >
            <NotebookIcon filled={!!hasNote} />
          </button>
        )}
        <a
          href={buildWatchUrl(item.videoId)}
          target="_blank"
          rel="noreferrer"
          className="done"
          style={{ textDecoration: 'none', marginRight: 8 }}
          title="Open on YouTube"
        >
          YouTube ↗
        </a>
        <button
          className="done done-primary"
          onClick={() => {
            // If the video already fired the auto-done (natural end), the
            // prompt is showing; the Done button then just dismisses it.
            // Otherwise open the rewatch prompt — mirror the auto-done flow.
            if (rewatchPromptOpen) { setRewatchPromptOpen(false); onDone(); return }
            setRewatchPromptOpen(true)
          }}
          title={doneHint}
        >
          {doneLabel}
        </button>
      </div>

      <div className="player-content-wrap">
        <div className={`player-stage${showTranscript ? ' with-transcript' : ''}`}>
          <div className="player-frame-wrap">
            <iframe
              key={item.videoId}
              src={buildEmbedUrl(item.videoId, {
                startSec: initialStart.current,
                endSec: initialEnd.current
              })}
              title={item.title}
              data-video-id={item.videoId}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </div>

        {showTranscript && (
          <div className="player-transcript-pane">
            <div className="transcript-head">
              <h3>Transcript</h3>
              <div className="transcript-search-wrap">
                <input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="ingest-input text"
                  style={{ fontSize: 12, padding: '4px 8px', width: '100%', background: 'var(--bg-card)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-faint)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                  />
                  Auto-scroll
                </label>
              </div>
            </div>

            <div className="transcript-body" style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
              {transcriptLoading && <div className="transcript-status" style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>Loading transcript...</div>}
              {transcriptError && <div className="transcript-status error" style={{ padding: '20px', textAlign: 'center', color: 'oklch(0.55 0.15 25)', fontSize: 13 }}>{transcriptError}</div>}
              
              {!transcriptLoading && !transcriptError && (() => {
                const filteredCues = transcript.map((c, i) => ({ ...c, originalIndex: i }))
                  .filter(c => c.text.toLowerCase().includes(searchTerm.toLowerCase()))

                if (filteredCues.length === 0) {
                  return <div className="transcript-status" style={{ padding: '20px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>No matching lines found.</div>
                }

                return filteredCues.map((c) => {
                  const isActive = c.originalIndex === activeCueIndex
                  const timeLabel = formatHms(c.startSec)
                  return (
                    <div
                      key={c.originalIndex}
                      className={`cue-item${isActive ? ' active-cue' : ''}`}
                      data-index={c.originalIndex}
                      onClick={() => seekTo(c.startSec)}
                      style={{
                        padding: '8px 14px',
                        cursor: 'pointer',
                        borderRadius: 6,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                        transition: 'background 0.12s ease',
                        background: isActive ? 'var(--ember-tint)' : ''
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: 'var(--ember)',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          marginTop: 2
                        }}
                      >
                        {timeLabel}
                      </span>
                      <span
                        style={{
                          fontSize: 13,
                          lineHeight: 1.5,
                          color: isActive ? 'var(--ink)' : 'var(--ink-soft)'
                        }}
                      >
                        {c.text}
                      </span>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        )}
      </div>

      {item.paras && item.paras.length > 0 && (
        <div className="player-paras">
          {item.paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}

      {/* Subtle shortcut hint. Chapter-aware skip (n/p), bookmark (b),
       * close (Esc). Rendered as a right-aligned tiny caption; visible but
       * unobtrusive so first-timers discover the keys. */}
      <div className="player-shortcut-hint">
        <kbd>n</kbd>/<kbd>p</kbd> chapter · <kbd>b</kbd> bookmark · <kbd>Esc</kbd> close
      </div>

      {/* Rewatch prompt — the twist on the heart. When the video hits its
       * end (natural or partition boundary), pop this overlay. Clicking the
       * heart moves the just-watched item into Wishlist for a return trip;
       * "No, done" just fires the normal onDone. Either path closes. */}
      {rewatchPromptOpen && (
        <div
          className="rewatch-prompt-backdrop"
          onClick={() => { setRewatchPromptOpen(false); onDone() }}
        >
          <div
            className="rewatch-prompt-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rewatch-prompt-eyebrow">Video complete</div>
            <div className="rewatch-prompt-title">Worth rewatching?</div>
            <div className="rewatch-prompt-body">
              Save "{item.title}" to your Wishlist for later. Or move on.
            </div>
            <div className="rewatch-prompt-actions">
              <button
                className={`heart-btn rewatch-heart ${rewatchArmed ? 'on' : ''}`}
                onClick={() => {
                  if (!rewatchArmed) {
                    // First click on heart: send to wishlist.
                    onToggleFavorite()
                    setRewatchArmed(true)
                  }
                }}
                title="Save to Wishlist for a rewatch"
                aria-label="Save to Wishlist"
              >
                <HeartIcon filled={rewatchArmed || isFavorited} />
                <span style={{ marginLeft: 6 }}>
                  {rewatchArmed ? 'Saved to Wishlist' : 'Yes, save it'}
                </span>
              </button>
              <button
                className="ingest-save"
                onClick={() => { setRewatchPromptOpen(false); onDone() }}
              >
                {rewatchArmed ? 'Close' : 'No, done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
