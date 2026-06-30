import { useEffect, useRef } from 'react'
import type { LoopItem } from '../types'
import { buildEmbedUrl, buildWatchUrl } from '../lib/youtube'

interface Props {
  item: LoopItem
  isFavorited: boolean
  isWatched: boolean
  focusTimerLabel: string | null
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
  startSec,
  endSec,
  partLabel,
  hasNote,
  onToggleFavorite,
  onAttachNote,
  onDone,
  onClose,
  doneLabel = 'Done',
  doneHint
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

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
      if (autoDoneFiredRef.current) return
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
        // Natural full-video end — YouTube fires state 0 ('ended').
        if (info.playerState === 0) {
          autoDoneFiredRef.current = true
          onDone()
          return
        }
        // Partitioned end — fire ~1s before endSec to beat YouTube's own
        // boundary stop, otherwise it pauses there silently and the user is
        // left staring at a paused frame.
        const cur = info.currentTime
        if (endSec && typeof cur === 'number' && cur >= endSec - 1) {
          autoDoneFiredRef.current = true
          onDone()
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
          <div className="focus-pill" title="Focus session — pauses when you pause the video">
            <span className="focus-dot" />
            {focusTimerLabel}
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
        <button className="done done-primary" onClick={onDone} title={doneHint}>
          {doneLabel}
        </button>
      </div>

      <div className="player-stage">
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

      {item.paras && item.paras.length > 0 && (
        <div className="player-paras">
          {item.paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      )}
    </div>
  )
}
