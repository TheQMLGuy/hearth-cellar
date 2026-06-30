import React, { useState, useEffect, useRef } from 'react'
import type { LoopItem, PlaylistNote, PlaylistNotePageMapping } from '../types'
import { buildEmbedUrl, buildWatchUrl } from '../lib/youtube'
import { convertFileSrc } from '@tauri-apps/api/core'

interface Props {
  item: LoopItem
  playlistNotes: Record<string, PlaylistNote>
  onSaveMappings: (noteKey: string, mappings: PlaylistNotePageMapping[], pdfPath?: string) => void
  onDone: () => void
  onClose: () => void
}

function formatTime(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function parseTime(str: string): number {
  const parts = str.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const s = parseInt(parts[1], 10)
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  const val = parseInt(str, 10)
  return isNaN(val) ? 0 : val
}

export function NoteStudyView({
  item,
  playlistNotes,
  onSaveMappings,
  onDone,
  onClose
}: Props) {
  const noteKey = item.id.startsWith('pl_') ? item.id.replace(/^pl_/, '') : `global:${item.videoId}`
  const existingNoteInfo = playlistNotes[noteKey]
  const initialMappings = existingNoteInfo?.pageMappings || []

  // Component states
  const [isLinking, setIsLinking] = useState(initialMappings.length === 0)
  const [mappings, setMappings] = useState<PlaylistNotePageMapping[]>(
    initialMappings.length > 0 ? initialMappings : [{ pageIdx: 1, startSec: 0 }]
  )
  const [videoTime, setVideoTime] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pdfPath, setPdfPath] = useState<string>(existingNoteInfo?.note?.source === 'local' ? existingNoteInfo.note.docUuid : '')
  const [autoSync, setAutoSync] = useState(true)

  // References
  const initialStart = useRef<number>(0)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Listen to Escape key to close the study session
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Listen to message events from the YouTube IFrame player to track video currentTime
  useEffect(() => {
    function handleTimeMessage(e: MessageEvent) {
      const origin = String(e.origin || '')
      if (!origin.includes('youtube')) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (!data || !data.info) return
        if (data.event !== 'infoDelivery' && data.event !== 'initialDelivery') return
        const info = data.info
        if (typeof info.currentTime === 'number') {
          setVideoTime(info.currentTime)
        }
      } catch (err) {}
    }
    window.addEventListener('message', handleTimeMessage)
    return () => window.removeEventListener('message', handleTimeMessage)
  }, [])

  // Auto-scroll note pages based on videoTime
  useEffect(() => {
    if (!autoSync || isLinking || mappings.length === 0) return

    // Find the mapping that applies to the current time:
    // the page with the largest startSec that is <= videoTime.
    let activePage = 1
    let maxStart = -1
    for (const m of mappings) {
      if (m.startSec <= videoTime && m.startSec > maxStart) {
        maxStart = m.startSec
        activePage = m.pageIdx
      }
    }
    if (activePage !== currentPage) {
      setCurrentPage(activePage)
    }
  }, [videoTime, mappings, autoSync, isLinking, currentPage])

  // Prompt native file-picker to select a PDF copy of note
  async function handleAttachPDF() {
    try {
      const chosen = await window.hearth.pickNoteFile()
      if (chosen) {
        setPdfPath(chosen)
      }
    } catch (err) {
      alert(`Failed to pick file: ${err}`)
    }
  }

  // Save mappings to disk
  function handleSave() {
    // Sort mappings by pageIdx or startSec before saving
    const sorted = [...mappings].sort((a, b) => a.startSec - b.startSec)
    onSaveMappings(noteKey, sorted, pdfPath || undefined)
    setIsLinking(false)
  }

  const isLocalPDF = !!pdfPath

  return (
    <div className="player note-study-container">
      <div className="player-head">
        <button onClick={onClose} aria-label="Back" className="back-chevron">
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="title">
            {item.title}
            <span className="title-tag" style={{ background: 'var(--card-warm)', color: 'var(--ink)' }}>Study Mode</span>
          </div>
          <div className="meta">
            {item.creator} · Attached Note: {item.note?.label || 'Local Document'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isLinking ? (
            <button className="done done-primary" onClick={handleSave}>
              Save and Play
            </button>
          ) : (
            <>
              <button className="done" onClick={() => setIsLinking(true)}>
                Edit Page Links
              </button>
              <button className="done done-primary" onClick={onDone}>
                Complete Study
              </button>
            </>
          )}
        </div>
      </div>

      <div className="note-study-split">
        {/* Left Pane: YouTube Player */}
        <div className="note-study-video-pane">
          <div className="player-frame-wrap" style={{ aspectRatio: '16/9', width: '100%', height: 'auto', maxHeight: 'none' }}>
            <iframe
              key={item.videoId}
              src={buildEmbedUrl(item.videoId, {
                startSec: initialStart.current
              })}
              title={item.title}
              data-video-id={item.videoId}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen; accelerometer; gyroscope"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
          <div className="note-study-video-info">
            <div className="info-row">
              <span className="time-badge">🕒 {formatTime(videoTime)}</span>
              {!isLinking && (
                <label className="sync-toggle-label">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                  />
                  Auto-sync notes with video playback
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Notes (Config/Viewer) */}
        <div className="note-study-notes-pane">
          {isLinking ? (
            /* LINKING MODE CONFIGURATION */
            <div className="note-study-config">
              <h3>Link Note Pages to Video</h3>
              <p className="lede-hint">
                Define the timestamp when each page of your notebook should open. Use <strong>Grab Current Time</strong> to set it instantly while watching.
              </p>

              <div className="config-file-row">
                <span className="label">Note Document Source:</span>
                {isLocalPDF ? (
                  <span className="file-path-badge" title={pdfPath}>
                    📄 {pdfPath.split(/[\\/]/).pop()}
                  </span>
                ) : (
                  <span className="file-path-badge remark-cloud-badge">
                    ☁️ reMarkable Cloud Sync ({item.note?.label})
                  </span>
                )}
                <button className="ccat-add-btn" onClick={handleAttachPDF}>
                  {isLocalPDF ? 'Change PDF Copy' : 'Attach PDF Copy'}
                </button>
              </div>

              <div className="mappings-list">
                <div className="mappings-header">
                  <span>Page</span>
                  <span>Start Time (MM:SS)</span>
                  <span>Actions</span>
                </div>
                {mappings.map((m, idx) => (
                  <div key={idx} className="mapping-row">
                    <span className="page-number-lbl">Page {m.pageIdx}</span>
                    <input
                      type="text"
                      className="ingest-input text time-input"
                      placeholder="e.g. 1:15 or 75"
                      value={formatTime(m.startSec)}
                      onChange={(e) => {
                        const val = parseTime(e.target.value)
                        setMappings(prev =>
                          prev.map((item, i) => (i === idx ? { ...item, startSec: val } : item))
                        )
                      }}
                    />
                    <div className="mapping-actions">
                      <button
                        className="ccat-pill"
                        style={{ padding: '4px 8px' }}
                        onClick={() => {
                          setMappings(prev =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, startSec: Math.floor(videoTime) } : item
                            )
                          )
                        }}
                        title="Set start time to current video playback time"
                      >
                        ⏱️ Grab Current Time
                      </button>
                      {mappings.length > 1 && (
                        <button
                          className="course-card-btn danger"
                          onClick={() => {
                            setMappings(prev => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, pageIdx: i + 1 })))
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  className="ccat-add-btn"
                  onClick={() => {
                    const nextPage = mappings.length + 1
                    const lastStart = mappings[mappings.length - 1]?.startSec ?? 0
                    setMappings([...mappings, { pageIdx: nextPage, startSec: lastStart + 10 }])
                  }}
                >
                  ＋ Add Next Page
                </button>
              </div>
            </div>
          ) : (
            /* STUDY MODE NOTE VIEWER */
            <div className="note-study-viewer">
              <div className="viewer-controls">
                <div className="page-indicator">
                  Page {currentPage} of {mappings.length}
                </div>
                <div className="nav-buttons">
                  <button
                    className="ccat-pill"
                    disabled={currentPage <= 1}
                    onClick={() => {
                      setCurrentPage(p => Math.max(1, p - 1))
                      setAutoSync(false)
                    }}
                  >
                    ◀ Prev
                  </button>
                  <button
                    className="ccat-pill"
                    disabled={currentPage >= mappings.length}
                    onClick={() => {
                      setCurrentPage(p => Math.min(mappings.length, p + 1))
                      setAutoSync(false)
                    }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>

              <div className="viewer-frame-container">
                {isLocalPDF ? (
                  <iframe
                    ref={iframeRef}
                    key={`${pdfPath}#page=${currentPage}`}
                    src={`${convertFileSrc(pdfPath)}#page=${currentPage}`}
                    className="note-pdf-iframe"
                    title="Note PDF"
                  />
                ) : (
                  <div className="remarkable-placeholder">
                    <div className="placeholder-icon">☁️</div>
                    <h4>reMarkable Note: "{item.note?.label}"</h4>
                    <p>
                      The page mapping is configured, but this document is synced directly via the reMarkable Cloud.
                    </p>
                    <p className="secondary-hint">
                      For a side-by-side view of your notes, export the PDF from your tablet or desktop app, then attach it locally:
                    </p>
                    <button className="ccat-add-btn" style={{ margin: '14px auto 0' }} onClick={handleAttachPDF}>
                      Attach Local PDF Copy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
