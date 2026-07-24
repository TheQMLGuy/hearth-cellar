import { useEffect, useMemo, useRef, useState } from 'react'
import type { Course, PlaylistOrder, PlaylistVideo, VideoProgress } from '../types'
import { buildEmbedUrl, buildPlaylistWatchUrl, buildWatchUrl, startListeningToIframes } from '../lib/youtube'

interface Props {
  course: Course
  watchedIds: Set<string>
  cachedVideos: PlaylistVideo[] | null
  cacheFetchedAt?: string | null
  focusTimerLabel: string | null
  isFocusTimerManuallyPaused?: boolean
  onToggleFocusTimerPause?: () => void
  /** Per-video resume state. Course videos use the raw YouTube videoId as key. */
  progress: Record<string, VideoProgress>
  /** Notes attached to playlist videos, keyed `${courseId}:${videoId}`. */
  playlistNotes: Record<string, import('../types').PlaylistNote>
  onMarkWatched: (videoId: string) => void
  onUnmarkWatched: (videoId: string) => void
  onVideosFetched: (playlistId: string, videos: PlaylistVideo[]) => void
  onSetOrder: (order: PlaylistOrder, manualOrder?: string[]) => void
  onAttachNoteToPlaylistVideo: (videoId: string, videoTitle: string) => void
  onActiveVideoChange?: (videoId: string | null) => void
  onBack: () => void
}

/**
 * Renders the YouTube iframe with start/end locked at first mount so it
 * doesn't get re-mounted by progress updates. The parent forces a re-mount
 * by changing the `videoId` (and thus React's key on this component).
 */
function CourseIframe({
  videoId,
  title,
  initialResumeSec,
  partStartSec,
  partEndSec
}: {
  videoId: string
  title: string
  initialResumeSec?: number
  partStartSec?: number
  partEndSec?: number
}) {
  // For single-video courses we want to start at the part's startSec unless
  // resume position is beyond it.
  const computedStart =
    initialResumeSec !== undefined && initialResumeSec > (partStartSec ?? 0) + 5
      ? initialResumeSec
      : partStartSec && partStartSec > 0
        ? partStartSec
        : undefined
  const startRef = useRef(computedStart)
  const endRef = useRef(partEndSec)
  return (
    <iframe
      key={`${videoId}-${startRef.current ?? 0}-${endRef.current ?? 0}`}
      src={buildEmbedUrl(videoId, { startSec: startRef.current, endSec: endRef.current })}
      title={title}
      data-video-id={videoId}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}

/**
 * Build the "watched" key for a playlist video. Normal playlists use the raw
 * YouTube videoId; single-video courses include the part index so each part
 * can have its own watched flag despite sharing one videoId.
 */
function watchKey(course: Course, videoId: string, partIdx: number): string {
  return course.singleVideo ? `${videoId}_p${partIdx}` : videoId
}

function isCompleted(course: Course, p: Record<string, VideoProgress>, watchedIds: Set<string>, videoId: string, partIdx: number): boolean {
  if (watchedIds.has(watchKey(course, videoId, partIdx))) return true
  // For multi-video playlists, progress.completed on the raw videoId is also
  // a "done" signal; for single-video courses the same videoId shows up many
  // times, so progress completion alone isn't enough — only the part-specific
  // watched flag counts.
  if (course.singleVideo) return false
  const entry = p[videoId]
  return !!entry?.completed
}

function firstNotCompletedIdx(
  course: Course,
  list: PlaylistVideo[],
  p: Record<string, VideoProgress>,
  watchedIds: Set<string>
): number {
  const idx = list.findIndex((v, i) => !isCompleted(course, p, watchedIds, v.videoId, i))
  return idx >= 0 ? idx : 0
}

type LoadState = 'loading' | 'ok' | 'fail'

function applyOrder(videos: PlaylistVideo[], course: Course): PlaylistVideo[] {
  const order = course.order ?? 'normal'
  if (order === 'reverse') return [...videos].reverse()
  if (order === 'manual' && course.manualOrder && course.manualOrder.length > 0) {
    const byId = new Map(videos.map((v) => [v.videoId, v]))
    const out: PlaylistVideo[] = []
    for (const id of course.manualOrder) {
      const v = byId.get(id)
      if (v) {
        out.push(v)
        byId.delete(id)
      }
    }
    // Append anything not in manualOrder (newly fetched videos) at the end
    for (const v of byId.values()) out.push(v)
    return out
  }
  return videos
}

export function CourseFocus({
  course,
  watchedIds,
  cachedVideos,
  cacheFetchedAt,
  focusTimerLabel,
  isFocusTimerManuallyPaused,
  onToggleFocusTimerPause,
  progress,
  playlistNotes,
  onMarkWatched,
  onUnmarkWatched,
  onVideosFetched,
  onSetOrder,
  onAttachNoteToPlaylistVideo,
  onActiveVideoChange,
  onBack
}: Props) {
  // For single-video courses, synthesise PlaylistVideo entries (one per part)
  // so the rest of the component doesn't need to special-case them.
  const syntheticVideos: PlaylistVideo[] | null = course.singleVideo
    ? course.singleVideo.parts.map((p, idx) => ({
        videoId: course.singleVideo!.videoId,
        title: p.title || `Part ${idx + 1}`,
        duration: `${Math.round((p.endSec - p.startSec) / 60)}m`
      }))
    : null

  const [rawVideos, setRawVideos] = useState<PlaylistVideo[]>(
    syntheticVideos ?? cachedVideos ?? []
  )
  const [loadState, setLoadState] = useState<LoadState>(
    syntheticVideos || (cachedVideos && cachedVideos.length > 0) ? 'ok' : 'loading'
  )
  const orderedVideos = useMemo(() => applyOrder(rawVideos, course), [rawVideos, course])
  const [activeIdx, setActiveIdx] = useState(() => {
    const list = applyOrder(syntheticVideos ?? cachedVideos ?? [], course)
    return firstNotCompletedIdx(course, list, progress, watchedIds)
  })

  useEffect(() => {
    // Single-video courses already have all data in-memory — skip the API call.
    if (course.singleVideo) return
    let cancelled = false

    const hasCache = cachedVideos && cachedVideos.length > 0
    
    // Skip playlist videos refresh if cached within the last 24 hours
    let isCacheFresh = false
    if (hasCache && cacheFetchedAt) {
      try {
        const diffMs = Date.now() - new Date(cacheFetchedAt).getTime()
        const diffHours = diffMs / (1000 * 60 * 60)
        if (diffHours < 24) {
          isCacheFresh = true
        }
      } catch {
        // ignore date parse errors
      }
    }

    if (!hasCache) {
      setLoadState('loading')
    }

    if (isCacheFresh) {
      return
    }

    window.hearth.fetchPlaylistVideos(course.playlistId).then((list) => {
      if (cancelled) return
      
      const cacheIds = (cachedVideos ?? []).map(v => v.videoId).join(',')
      const fetchedIds = list.map(v => v.videoId).join(',')
      
      if (list.length > 0 && fetchedIds !== cacheIds) {
        setRawVideos(list)
        setLoadState('ok')
        onVideosFetched(course.playlistId, list)
        const ordered = applyOrder(list, course)
        setActiveIdx(firstNotCompletedIdx(course, ordered, progress, watchedIds))
      } else if (list.length === 0 && !hasCache) {
        setLoadState('fail')
      }
    })

    return () => {
      cancelled = true
    }
  }, [course.playlistId, cacheFetchedAt])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onBack])

  const current = orderedVideos[activeIdx]

  // Re-arm YouTube state listener when the iframe video changes — the
  // postMessage handshake is gone after the iframe `key` swap.
  useEffect(() => {
    if (!current) return
    const t1 = window.setTimeout(() => startListeningToIframes(), 600)
    const t2 = window.setTimeout(() => startListeningToIframes(), 2000)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [current?.videoId])

  useEffect(() => {
    if (onActiveVideoChange) {
      onActiveVideoChange(current?.videoId || null)
    }
  }, [current?.videoId, onActiveVideoChange])

  const watchedCount = orderedVideos.filter((v, i) =>
    watchedIds.has(watchKey(course, v.videoId, i))
  ).length
  const total = orderedVideos.length
  const pct = total ? Math.round((watchedCount / total) * 100) : 0
  const orderMode: PlaylistOrder = course.order ?? 'normal'

  function handleDone() {
    if (!current) return
    const key = watchKey(course, current.videoId, activeIdx)
    onMarkWatched(key)
    const nextIdx = findNextUnwatched(course, orderedVideos, activeIdx, watchedIds, key)
    if (nextIdx >= 0) setActiveIdx(nextIdx)
  }

  function changeOrder(next: PlaylistOrder) {
    if (next === orderMode) return
    const currentVideoId = current?.videoId
    if (next === 'manual') {
      // Lock current ordering into manualOrder so the user starts from "what you see"
      onSetOrder('manual', orderedVideos.map((v) => v.videoId))
    } else {
      onSetOrder(next)
    }
    // Try to keep the same video active after reorder
    if (currentVideoId) {
      setTimeout(() => {
        const after = applyOrder(rawVideos, { ...course, order: next, manualOrder: next === 'manual' ? orderedVideos.map((v) => v.videoId) : course.manualOrder })
        const newIdx = after.findIndex((v) => v.videoId === currentVideoId)
        if (newIdx >= 0) setActiveIdx(newIdx)
      }, 0)
    }
  }

  function moveManual(idx: number, dir: -1 | 1) {
    if (orderMode !== 'manual') return
    const ids = orderedVideos.map((v) => v.videoId)
    const swap = idx + dir
    if (swap < 0 || swap >= ids.length) return
    ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
    onSetOrder('manual', ids)
    // Follow the moved video
    if (activeIdx === idx) setActiveIdx(swap)
    else if (activeIdx === swap) setActiveIdx(idx)
  }

  return (
    <div className="course-focus">
      <aside className="cf-sidebar">
        <div className="cf-side-head">
          <h3 className="cf-title">{course.title}</h3>
          <div className="cf-creator">{course.creator}</div>
          <div className="cf-progress">
            <div className="cf-bar">
              <div className="cf-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="cf-pct">{watchedCount}/{total || '?'}</span>
          </div>
          <div className="cf-order">
            <span className="cf-order-label">Order</span>
            <div className="bucket-pill small">
              <button className={orderMode === 'normal' ? 'active' : ''} onClick={() => changeOrder('normal')}>Normal</button>
              <button className={orderMode === 'reverse' ? 'active' : ''} onClick={() => changeOrder('reverse')}>Reverse</button>
              <button className={orderMode === 'manual' ? 'active' : ''} onClick={() => changeOrder('manual')}>Manual</button>
            </div>
          </div>
        </div>
        <div className="cf-list">
          {loadState === 'loading' && (
            <div className="cf-loading">
              <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>Loading playlist…</span>
            </div>
          )}
          {loadState === 'fail' && (
            <div className="cf-fail">
              <p>Couldn't read the playlist videos.</p>
              <p style={{ marginTop: 8, fontSize: 12 }}>
                Some playlists block scraping. Add your YouTube Data API key in Settings → Google for direct access, or open the playlist on YouTube:
              </p>
              <a
                className="done"
                style={{ marginTop: 10, display: 'inline-block', textDecoration: 'none' }}
                href={buildPlaylistWatchUrl(course.playlistId)}
                target="_blank"
                rel="noreferrer"
              >
                YouTube ↗
              </a>
            </div>
          )}
          {loadState === 'ok' &&
            orderedVideos.map((v, i) => {
              const done = watchedIds.has(watchKey(course, v.videoId, i))
              const active = i === activeIdx
              return (
                <div
                  key={v.videoId}
                  className={`cf-row${active ? ' active' : ''}${done ? ' done' : ''}`}
                >
                  <button
                    className="cf-row-main"
                    onClick={() => setActiveIdx(i)}
                  >
                    <span className="cf-num">{i + 1}</span>
                    <span className="cf-row-title">{v.title}</span>
                    {v.duration && <span className="cf-row-dur">{v.duration}</span>}
                    {done && (
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="cf-check">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                  {orderMode === 'manual' && (
                    <div className="cf-manual-arrows">
                      <button
                        className="cf-arrow"
                        title="Move up"
                        onClick={() => moveManual(i, -1)}
                        disabled={i === 0}
                      >
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                          <path d="M18 15l-6-6-6 6" />
                        </svg>
                      </button>
                      <button
                        className="cf-arrow"
                        title="Move down"
                        onClick={() => moveManual(i, 1)}
                        disabled={i === orderedVideos.length - 1}
                      >
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" viewBox="0 0 24 24">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
        </div>
      </aside>

      <div className="cf-main">
        <div className="cf-player">
          {current ? (() => {
            const part = course.singleVideo?.parts[activeIdx]
            return (
              <CourseIframe
                key={`${current.videoId}-${activeIdx}`}
                videoId={current.videoId}
                title={current.title}
                initialResumeSec={progress[current.videoId]?.completed === false ? progress[current.videoId]?.currentSec : undefined}
                partStartSec={part?.startSec}
                partEndSec={part?.endSec}
              />
            )
          })() : (
            <div className="cf-noselect">
              {loadState === 'loading'
                ? 'Loading…'
                : loadState === 'fail'
                ? 'Open the playlist on YouTube to continue.'
                : 'Select a video from the sidebar.'}
            </div>
          )}
        </div>
        <div className="cf-controls">
          <div className="cf-cur">
            {current && (
              <>
                <span className="cf-cur-title">{current.title}</span>
                <div className="cf-cur-meta">
                  Video {activeIdx + 1} of {total}
                  {current.duration && <> · {current.duration}</>}
                  {' · '}
                  <a
                    href={buildWatchUrl(current.videoId)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    YouTube ↗
                  </a>
                </div>
              </>
            )}
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
          {current && (
            <>
              {watchedIds.has(watchKey(course, current.videoId, activeIdx)) ? (
                <button
                  className="done"
                  onClick={() => onUnmarkWatched(watchKey(course, current.videoId, activeIdx))}
                  title="Mark this video as unwatched"
                >
                  Unmark
                </button>
              ) : null}
              {current && (() => {
                const key = `${course.id}:${current.videoId}`
                const hasNote = !!playlistNotes[key]
                return (
                  <button
                    className="done"
                    onClick={() => onAttachNoteToPlaylistVideo(current.videoId, current.title)}
                    title={hasNote ? 'Notes attached — change' : 'Attach reMarkable / local notes'}
                    style={{ marginRight: 8 }}
                  >
                    {hasNote ? '📝 Notes' : '+ Notes'}
                  </button>
                )
              })()}
              <button
                className="done done-primary"
                onClick={handleDone}
                title="Mark watched and play the next video"
              >
                {findNextUnwatched(course, orderedVideos, activeIdx, watchedIds, watchKey(course, current.videoId, activeIdx)) >= 0
                  ? 'Done & Next'
                  : 'Done'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function findNextUnwatched(
  course: Course,
  videos: PlaylistVideo[],
  currentIdx: number,
  watchedIds: Set<string>,
  currentKeyBeingMarked: string
): number {
  for (let i = currentIdx + 1; i < videos.length; i++) {
    const v = videos[i]
    const key = watchKey(course, v.videoId, i)
    if (key === currentKeyBeingMarked) continue
    if (!watchedIds.has(key)) return i
  }
  for (let i = 0; i < currentIdx; i++) {
    const v = videos[i]
    const key = watchKey(course, v.videoId, i)
    if (key === currentKeyBeingMarked) continue
    if (!watchedIds.has(key)) return i
  }
  return -1
}
