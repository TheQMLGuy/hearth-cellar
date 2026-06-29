import { useEffect, useState } from 'react'
import type { LoopItem, RemarkableNoteRef, RmDoc } from '../types'

interface Props {
  item: LoopItem
  onClose: () => void
  onAttach: (ref: RemarkableNoteRef) => void
  onDetach: () => void
}

type LoadState = 'idle' | 'loading' | 'ok' | 'unpaired' | 'fail'
type SourceTab = 'remarkable' | 'local'

export function AttachNoteModal({ item, onClose, onAttach, onDetach }: Props) {
  const [docs, setDocs] = useState<RmDoc[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [loadError, setLoadError] = useState<string>('')
  const [search, setSearch] = useState('')
  const [manualUuid, setManualUuid] = useState('')
  const [manualLabel, setManualLabel] = useState('')
  const [localPath, setLocalPath] = useState('')
  const [localLabel, setLocalLabel] = useState('')
  const [diagnoseText, setDiagnoseText] = useState<string>('')
  const [diagnosing, setDiagnosing] = useState(false)
  // Default to local file — reMarkable Cloud's docs API is currently rotated
  // and unreliable. Local file works against PDFs you've exported from the
  // tablet (Share > Send as PDF) or any other notes app on your desktop.
  const [sourceTab, setSourceTab] = useState<SourceTab>('local')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadState('loading')
      const status = await window.hearth.rmStatus()
      if (cancelled) return
      if (!status.paired) {
        setLoadState('unpaired')
        return
      }
      try {
        const list = await window.hearth.rmListDocs()
        if (cancelled) return
        if (!Array.isArray(list)) throw new Error('non-array response')
        setDocs(list.filter((d) => d.type === 'DocumentType'))
        setLoadState(list.length === 0 ? 'fail' : 'ok')
      } catch (e) {
        if (cancelled) return
        // The listing error already includes every probe's HTTP status +
        // body + Allow header (production try_tectonic_docs runs them in
        // parallel). Don't auto-run rm_diagnose — it'd duplicate the same
        // work and double the wait.
        setLoadError(String(e))
        setLoadState('fail')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  function attachDoc(doc: RmDoc) {
    onAttach({
      source: 'remarkable',
      docUuid: doc.uuid,
      label: doc.name,
      lastUpdatedAt: doc.lastModified,
      lastSyncedAt: new Date().toISOString()
    })
    onClose()
  }

  function attachManual() {
    const uuid = manualUuid.trim()
    if (!uuid) return
    onAttach({
      source: 'remarkable',
      docUuid: uuid,
      label: manualLabel.trim() || uuid,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    })
    onClose()
  }

  function attachLocal() {
    const path = localPath.trim()
    if (!path) return
    const inferredName = (() => {
      const m = path.match(/[\\/]([^\\/]+?)(?:\.[^.]+)?$/)
      return m ? m[1] : path
    })()
    onAttach({
      source: 'local',
      docUuid: path,
      label: localLabel.trim() || inferredName,
      lastUpdatedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString()
    })
    onClose()
  }

  const filtered = search
    ? docs.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : docs

  return (
    <>
      <div className="ingest-scrim" onClick={onClose} />
      <div className="ingest-bar" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <div className="eyebrow">Margin</div>
        <h3 style={{ marginTop: 4 }}>Attach notes</h3>
        <p className="ingest-hint" style={{ marginBottom: 12 }}>
          Pick the document you took notes on for &ldquo;{item.title}&rdquo;.
        </p>

        <div className="bucket-pill small" style={{ marginBottom: 12 }}>
          <button
            className={sourceTab === 'remarkable' ? 'active' : ''}
            onClick={() => setSourceTab('remarkable')}
          >reMarkable cloud</button>
          <button
            className={sourceTab === 'local' ? 'active' : ''}
            onClick={() => setSourceTab('local')}
          >Local file</button>
        </div>

        {sourceTab === 'remarkable' && (
        <>
        {loadState === 'loading' && (
          <div className="ingest-hint">Loading documents from reMarkable…</div>
        )}

        {loadState === 'unpaired' && (
          <div className="ingest-hint">
            Not paired yet. Open Settings → reMarkable to pair your tablet first, or use the Local file tab above.
          </div>
        )}

        {loadState === 'fail' && (
          <div className="ingest-hint">
            <strong>Couldn&rsquo;t list documents.</strong>
            {loadError && (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 6, fontFamily: 'var(--mono)' }}>{loadError}</pre>
            )}
            <p style={{ marginTop: 8 }}>
              The Local file tab still works. To unblock the cloud path, run the diagnostic below — it probes every known header variant against tectonic and reports exactly which one your account accepts. Paste the output anywhere and I (or the dev) can hardcode the working combination.
            </p>
            <div style={{ marginTop: 12 }}>
              <button
                className="set-active-btn"
                disabled={diagnosing}
                onClick={async () => {
                  setDiagnosing(true)
                  setDiagnoseText('')
                  const text = await window.hearth.rmDiagnose()
                  setDiagnosing(false)
                  setDiagnoseText(text)
                }}
              >{diagnosing ? 'Diagnosing…' : 'Run cloud diagnostic'}</button>
              {diagnoseText && (
                <>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontSize: 10.5,
                      marginTop: 8,
                      padding: 8,
                      background: 'var(--surface-2, rgba(0,0,0,0.04))',
                      fontFamily: 'var(--mono)',
                      maxHeight: 280,
                      overflowY: 'auto'
                    }}
                  >{diagnoseText}</pre>
                  <button
                    className="set-active-btn"
                    style={{ marginTop: 6 }}
                    onClick={() => {
                      navigator.clipboard?.writeText(diagnoseText).catch(() => {})
                    }}
                  >Copy diagnostic to clipboard</button>
                </>
              )}
            </div>
          </div>
        )}

        {loadState === 'ok' && (
          <>
            <input
              className="ingest-input text"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div style={{ marginTop: 12, maxHeight: 240, overflowY: 'auto' }}>
              {filtered.map((d) => (
                <div
                  key={d.uuid}
                  className="vault-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => attachDoc(d)}
                >
                  <div className="vault-body">
                    <div className="vault-title">{d.name}</div>
                    <div className="vault-meta">
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5 }}>{d.uuid.slice(0, 8)}</span>
                      {d.lastModified && (
                        <>
                          <span className="dot-sep">·</span>
                          <span>{new Date(d.lastModified).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="ingest-hint">No documents match that search.</div>
              )}
            </div>
          </>
        )}

        <div style={{ borderTop: '1px solid var(--hairline)', marginTop: 16, paddingTop: 14 }}>
          <p className="ingest-hint" style={{ marginBottom: 8 }}>Or paste a document UUID manually:</p>
          <div className="ingest-row">
            <input
              className="ingest-input text"
              placeholder="UUID (e.g. d4f5a2b8-…)"
              value={manualUuid}
              onChange={(e) => setManualUuid(e.target.value)}
            />
            <input
              className="ingest-input text"
              placeholder="Label"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              style={{ flex: '0 0 40%' }}
            />
            <button
              className="ingest-save"
              disabled={!manualUuid.trim()}
              onClick={attachManual}
            >Attach</button>
          </div>
        </div>
        </>
        )}

        {sourceTab === 'local' && (
          <div>
            <p className="ingest-hint" style={{ marginBottom: 8 }}>
              Click <strong>Pick file…</strong> to choose a PDF / .rmdoc / EPUB, or drag a file onto the path box below, or paste an absolute file path.
            </p>
            <div style={{ marginBottom: 10 }}>
              <button
                className="ingest-save"
                onClick={async () => {
                  const picked = await window.hearth.pickNoteFile()
                  if (picked) setLocalPath(picked)
                }}
              >Pick file…</button>
            </div>
            <div
              className="ingest-row"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0] as (File & { path?: string }) | undefined
                if (f?.path) setLocalPath(f.path)
                else if (f?.name) setLocalPath(f.name)
              }}
            >
              <input
                className="ingest-input text"
                placeholder="C:\Users\you\Documents\notes.pdf"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
              />
              <input
                className="ingest-input text"
                placeholder="Label (optional)"
                value={localLabel}
                onChange={(e) => setLocalLabel(e.target.value)}
                style={{ flex: '0 0 40%' }}
              />
              <button
                className="ingest-save"
                disabled={!localPath.trim()}
                onClick={attachLocal}
              >Attach</button>
            </div>
          </div>
        )}

        {item.note && (
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="x-btn" onClick={onDetach} title="Remove the attached note">
              Detach current note
            </button>
          </div>
        )}
      </div>
    </>
  )
}
