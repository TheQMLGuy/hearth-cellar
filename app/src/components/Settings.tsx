import { useState } from 'react'
import type { Bucket, CategoryId, Channel, FocusConfig, GoogleAuth, LoopItem, PersistedStore, RoutineItem } from '../types'
import { DEFAULT_CATEGORIES, COLOR_SWATCHES, dotShadowFor, makeCategoryMap } from '../lib/categories'
import { parseYouTubeUrl, shortLabelForUrl } from '../lib/youtube'
import { newId } from '../lib/ids'
import { GoogleTab } from './GoogleTab'

interface Props {
  store: PersistedStore
  onUpdateQuota: (cat: CategoryId, value: number) => void
  onRecategorize: (id: string, cat: CategoryId) => void
  onSetItemBucket: (id: string, bucket: Bucket) => void
  onDeleteVideo: (id: string) => void
  onClearAll: () => void
  onAddChannel: (channel: Channel) => void
  onImportChannels: (channels: Channel[]) => void
  onRemoveChannel: (id: string) => void
  onSetChannelBucket: (id: string, bucket: Bucket) => void
  onSetChannelCategory: (id: string, cat: CategoryId) => void
  onRefreshChannels: () => void
  onUpdateFocus: (cfg: FocusConfig) => void
  onAddRoutine: (item: RoutineItem) => void
  onRemoveRoutine: (id: string) => void
  onUpdateGoogleAuth: (next: GoogleAuth) => void
  onSubsFetched: (subs: import('../types').YouTubeSubscription[]) => void
  onUpdateApiKey: (key: string) => void
  onUpdateSundayLimit: (n: number) => void
  onAddCategory: (cat: import('../types').Category) => void
  onUpdateCategory: (id: string, patch: Partial<import('../types').Category>) => void
  onDeleteCategory: (id: string) => void
  onUpdateSliceTargetMin: (n: number) => void
  onUpdateSundayMinutes: (n: number) => void
  onRefreshTodayPlan: () => void
  onRestoreFromQuarantine: (id: string) => void
  onDeleteFromQuarantine: (id: string) => void
  onRestoreFromDone: (id: string) => void
  onClearDone: () => void
  onBack: () => void
}

type Tab = 'categories' | 'videos' | 'channels' | 'routine' | 'google' | 'focus' | 'general' | 'done'

function BucketPicker({
  value,
  onChange
}: {
  value: Bucket
  onChange: (b: Bucket) => void
}) {
  return (
    <div className="bucket-pill small">
      <button className={value === 'WKDY' ? 'active' : ''} onClick={() => onChange('WKDY')}>WKDY</button>
      <button className={value === 'SUN' ? 'active' : ''} onClick={() => onChange('SUN')}>SUN</button>
    </div>
  )
}

function VideoRow({
  item,
  categories,
  onRecategorize,
  onSetItemBucket,
  onDelete
}: {
  item: LoopItem
  categories: import('../types').Category[]
  onRecategorize: (id: string, cat: CategoryId) => void
  onSetItemBucket: (id: string, bucket: Bucket) => void
  onDelete: (id: string) => void
}) {
  const catMap = makeCategoryMap(categories.length > 0 ? categories : DEFAULT_CATEGORIES)
  const cat = catMap[item.category] ?? DEFAULT_CATEGORIES[0]
  return (
    <div className="video-row">
      <div className="video-pip" style={{ background: cat.color }} />
      <div className="video-body">
        <div className="video-title">{item.title}</div>
        <div className="video-meta">
          <span>{item.creator || '—'}</span>
          <span className="dot-sep">·</span>
          <span>{shortLabelForUrl(item.url)}</span>
          {item.lastWatchedAt && (
            <>
              <span className="dot-sep">·</span>
              <span>last watched {new Date(item.lastWatchedAt).toLocaleDateString()}</span>
            </>
          )}
        </div>
      </div>
      <BucketPicker value={item.bucket} onChange={(b) => onSetItemBucket(item.id, b)} />
      {item.bucket === 'WKDY' && (
        <select
          className="cat-select"
          value={item.category}
          onChange={(e) => onRecategorize(item.id, e.target.value as CategoryId)}
          title="Category (Weekday only)"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      <button className="x-btn" onClick={() => onDelete(item.id)} title="Delete">
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function Settings(props: Props) {
  const {
    store,
    onUpdateQuota,
    onRecategorize,
    onSetItemBucket,
    onDeleteVideo,
    onClearAll,
    onAddChannel,
    onImportChannels,
    onRemoveChannel,
    onSetChannelBucket,
    onSetChannelCategory,
    onRefreshChannels,
    onUpdateFocus,
    onAddRoutine,
    onRemoveRoutine,
    onUpdateGoogleAuth,
    onSubsFetched,
    onUpdateApiKey,
    onUpdateSundayLimit,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
    onUpdateSliceTargetMin,
    onUpdateSundayMinutes,
    onRefreshTodayPlan,
    onRestoreFromQuarantine,
    onDeleteFromQuarantine,
    onRestoreFromDone,
    onClearDone,
    onBack
  } = props

  const [tab, setTab] = useState<Tab>('categories')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [channelInput, setChannelInput] = useState('')
  const [channelBucket, setChannelBucket] = useState<Bucket>(store.mode)
  const [channelCategory, setChannelCategory] = useState<CategoryId>('curiosity')
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor, setNewCatColor] = useState(COLOR_SWATCHES[3].color)
  function handleAddCategory() {
    const name = newCatName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`
    onAddCategory({ id, name, color: newCatColor, dotShadow: dotShadowFor(newCatColor) })
    setNewCatName('')
  }

  const [routineUrl, setRoutineUrl] = useState('')
  const [routineTitle, setRoutineTitle] = useState('')
  const [routineCreator, setRoutineCreator] = useState('')
  const [routineFetching, setRoutineFetching] = useState(false)
  const [routineError, setRoutineError] = useState('')

  const [apiKeyInput, setApiKeyInput] = useState(store.youtubeApiKey ?? '')
  const [showApiKey, setShowApiKey] = useState(false)
  const [apiKeySaved, setApiKeySaved] = useState(false)

  const [rmPairCode, setRmPairCode] = useState('')
  const [rmPairing, setRmPairing] = useState(false)
  const [rmError, setRmError] = useState('')
  const [rmPaired, setRmPaired] = useState(store.remarkable?.paired === true)
  const [rmDocCount, setRmDocCount] = useState<number | null>(null)

  async function refreshRmStatus() {
    const s = await window.hearth.rmStatus()
    setRmPaired(s.paired)
    setRmDocCount(s.docCount > 0 ? s.docCount : null)
  }

  async function handleRmPair() {
    const code = rmPairCode.trim()
    if (code.length < 6) {
      setRmError('Enter the 8-character code from my.remarkable.com/device/desktop/connect')
      return
    }
    setRmError('')
    setRmPairing(true)
    const res = await window.hearth.rmPair(code)
    setRmPairing(false)
    if (res.ok) {
      setRmPairCode('')
      await refreshRmStatus()
      // Try to list docs to confirm + cache count
      const docs = await window.hearth.rmListDocs()
      setRmDocCount(docs.length)
    } else {
      setRmError(res.error || 'Pairing failed.')
    }
  }

  async function handleRmUnpair() {
    if (!confirm('Unpair from reMarkable cloud? The app forgets the device token.')) return
    await window.hearth.rmUnpair()
    await refreshRmStatus()
    setRmDocCount(null)
  }

  const total = (Object.keys(store.categoryQuotas) as CategoryId[]).reduce(
    (acc, c) => acc + (store.categoryQuotas[c] | 0),
    0
  )

  async function handleAddChannel() {
    setResolveError('')
    const raw = channelInput.trim()
    if (!raw) return
    setResolving(true)
    const meta = await window.hearth.resolveChannel(raw)
    setResolving(false)
    if (!meta) {
      setResolveError("Couldn't find that channel. Paste a UC... channel ID or an @handle from the channel's URL.")
      return
    }
    const ch: Channel = {
      id: newId('chn_'),
      handle: raw.startsWith('UC') ? '' : raw.replace(/^@/, ''),
      channelId: meta.channelId,
      name: meta.name,
      bucket: channelBucket,
      category: channelCategory,
      addedAt: new Date().toISOString()
    }
    onAddChannel(ch)
    setChannelInput('')
  }

  async function handleAddRoutine() {
    setRoutineError('')
    const parsed = parseYouTubeUrl(routineUrl)
    if (!parsed || parsed.kind !== 'video') {
      setRoutineError('Paste a single YouTube video URL.')
      return
    }
    let title = routineTitle.trim()
    let creator = routineCreator.trim()
    if (!title || !creator) {
      setRoutineFetching(true)
      const meta = await window.hearth.fetchVideoMeta(parsed.id)
      setRoutineFetching(false)
      if (meta) {
        if (!title) title = meta.title
        if (!creator) creator = meta.author
      }
    }
    if (!title || !creator) {
      setRoutineError('Fill title and creator manually if auto-fetch fails.')
      return
    }
    const item: RoutineItem = {
      id: newId('rou_'),
      videoId: parsed.id,
      url: routineUrl.trim(),
      title,
      creator,
      addedAt: new Date().toISOString()
    }
    onAddRoutine(item)
    setRoutineUrl('')
    setRoutineTitle('')
    setRoutineCreator('')
  }

  const weekdayVideos = store.loop.filter((it) => it.bucket === 'WKDY')
  const sundayVideos = store.loop.filter((it) => it.bucket === 'SUN')

  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <div className="eyebrow">Settings</div>
        <h2 className="page-h2">Configure Your Ritual</h2>

        <div className="settings-tabs">
          <button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}>Categories</button>
          <button className={tab === 'videos' ? 'active' : ''} onClick={() => setTab('videos')}>Loop</button>
          <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>Done</button>
          <button className={tab === 'routine' ? 'active' : ''} onClick={() => setTab('routine')}>Routine</button>
          <button className={tab === 'channels' ? 'active' : ''} onClick={() => setTab('channels')}>Channels</button>
          <button className={tab === 'google' ? 'active' : ''} onClick={() => setTab('google')}>Google</button>
          <button className={tab === 'focus' ? 'active' : ''} onClick={() => setTab('focus')}>Focus</button>
          <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>General</button>
        </div>

        {tab === 'categories' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 6px' }}>
              Your Weekday content is sorted into categories. Each gets an independent daily quota and a color.
            </p>
            <div className="quota-total">Daily total: <strong>{total}</strong> items</div>

            {store.categories.map((c) => {
              const usedBy = store.loop.filter((it) => it.category === c.id).length
              const editing = editingCatId === c.id
              return (
                <div key={c.id} className="cat-row cat-row-rich">
                  <button
                    className="cat-dot cat-dot-btn"
                    style={{ background: c.color }}
                    onClick={() => setEditingCatId(editing ? null : c.id)}
                    title="Edit color"
                    aria-label="Edit category"
                  />
                  {editing ? (
                    <input
                      className="ingest-input text cat-name-input"
                      value={c.name}
                      autoFocus
                      onChange={(e) => onUpdateCategory(c.id, { name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCatId(null) }}
                      onBlur={() => setEditingCatId(null)}
                    />
                  ) : (
                    <div className="cat-name" onClick={() => setEditingCatId(c.id)} title="Click to rename">{c.name}</div>
                  )}
                  <div className="qty">
                    <span className="qty-label">Min/day</span>
                    <button
                      className="qty-btn"
                      onClick={() => onUpdateCategory(c.id, { minutesPerDay: Math.max(0, (c.minutesPerDay ?? 0) - 5) })}
                    >−</button>
                    <span className="qty-val">{c.minutesPerDay ?? 0}</span>
                    <button
                      className="qty-btn"
                      onClick={() => onUpdateCategory(c.id, { minutesPerDay: Math.min(240, (c.minutesPerDay ?? 0) + 5) })}
                    >+</button>
                  </div>
                  <button
                    className="x-btn"
                    disabled={store.categories.length <= 1}
                    title={
                      store.categories.length <= 1
                        ? "Can't delete the last category"
                        : usedBy > 0
                        ? `Delete (will move ${usedBy} item${usedBy === 1 ? '' : 's'} to the first remaining category)`
                        : 'Delete category'
                    }
                    onClick={() => {
                      if (store.categories.length <= 1) return
                      if (usedBy > 0) {
                        if (!confirm(`Delete "${c.name}"? ${usedBy} item${usedBy === 1 ? '' : 's'} will move to "${store.categories.find(x => x.id !== c.id)?.name}".`)) return
                      }
                      onDeleteCategory(c.id)
                    }}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="day-chips" title="Days this category contributes to Today's plan">
                    {(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).map((label, i) => {
                      const dow = (i + 1) % 7 // 0=Sun .. 6=Sat (JS convention)
                      const days = c.days ?? [0,1,2,3,4,5,6]
                      const on = days.includes(dow)
                      return (
                        <button
                          key={i}
                          className={`day-chip${on ? ' on' : ''}`}
                          title={label}
                          onClick={() => {
                            const set = new Set(c.days ?? [0,1,2,3,4,5,6])
                            if (set.has(dow)) set.delete(dow); else set.add(dow)
                            onUpdateCategory(c.id, { days: [...set].sort((a,b)=>a-b) })
                          }}
                        >
                          {label[0]}
                        </button>
                      )
                    })}
                  </div>
                  {editing && (
                    <div className="swatch-picker">
                      {COLOR_SWATCHES.map((s) => (
                        <button
                          key={s.color}
                          className={`swatch${s.color === c.color ? ' selected' : ''}`}
                          style={{ background: s.color }}
                          title={s.name}
                          onClick={() => onUpdateCategory(c.id, { color: s.color, dotShadow: dotShadowFor(s.color) })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            <div className="cat-add-row">
              <span className="cat-dot" style={{ background: newCatColor }} />
              <input
                className="ingest-input text"
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategory() }}
              />
              <div className="swatch-picker inline">
                {COLOR_SWATCHES.map((s) => (
                  <button
                    key={s.color}
                    className={`swatch small${s.color === newCatColor ? ' selected' : ''}`}
                    style={{ background: s.color }}
                    title={s.name}
                    onClick={() => setNewCatColor(s.color)}
                  />
                ))}
              </div>
              <button
                className="ingest-save"
                disabled={!newCatName.trim()}
                onClick={handleAddCategory}
              >
                + Add
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 16 }}>
              <p className="page-lede" style={{ margin: '0 0 6px' }}>Sunday is category-free — one flat minute budget for the day.</p>
              <div className="cat-row">
                <div className="cat-dot" style={{ background: 'var(--ink-faint)' }} />
                <div className="cat-name">Sunday minutes</div>
                <div className="qty">
                  <span className="qty-label">Min/day</span>
                  <button className="qty-btn" onClick={() => onUpdateSundayMinutes(Math.max(15, (store.sundayMinutes ?? 90) - 15))}>−</button>
                  <span className="qty-val">{store.sundayMinutes ?? 90}</span>
                  <button className="qty-btn" onClick={() => onUpdateSundayMinutes(Math.min(360, (store.sundayMinutes ?? 90) + 15))}>+</button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 16 }}>
              <p className="page-lede" style={{ margin: '0 0 6px' }}>Partitioning — long videos split into part-sized slices, one per day.</p>
              <div className="cat-row">
                <div className="cat-dot" style={{ background: 'var(--ink-faint)' }} />
                <div className="cat-name">Target part length</div>
                <div className="qty">
                  <span className="qty-label">Minutes</span>
                  <button className="qty-btn" onClick={() => onUpdateSliceTargetMin(Math.max(10, (store.sliceTargetMin ?? 30) - 5))}>−</button>
                  <span className="qty-val">{store.sliceTargetMin ?? 30}</span>
                  <button className="qty-btn" onClick={() => onUpdateSliceTargetMin(Math.min(90, (store.sliceTargetMin ?? 30) + 5))}>+</button>
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 16 }}>
              <p className="page-lede" style={{ margin: '0 0 6px' }}>Today's plan is locked once computed — completed videos stay greyed out, no replacements appear. Use this if you need to force a recompute mid-day.</p>
              <button
                className="set-active-btn"
                onClick={() => {
                  if (confirm("Recompute today's plan? Greyed-out videos will be removed and fresh ones picked.")) {
                    onRefreshTodayPlan()
                  }
                }}
              >Refresh today's plan</button>
            </div>

            {store.shortsQuarantine && store.shortsQuarantine.length > 0 && (
              <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 16 }}>
                <p className="page-lede" style={{ margin: '0 0 6px' }}>
                  Shorts quarantine — videos auto-rejected as YouTube Shorts ({store.shortsQuarantine.length}). Restore if you want them back in the loop, or delete for good.
                </p>
                {store.shortsQuarantine.map((it) => (
                  <div key={it.id} className="vault-row">
                    <div className="vault-body">
                      <div className="vault-title">{it.title || it.videoId}</div>
                      <div className="vault-meta">
                        <span>{it.creator || '—'}</span>
                        <span className="dot-sep">·</span>
                        <span className="vault-url">{shortLabelForUrl(it.url)}</span>
                      </div>
                    </div>
                    <button className="set-active-btn" onClick={() => onRestoreFromQuarantine(it.id)} title="Move back into the loop">Restore</button>
                    <button className="x-btn" onClick={() => onDeleteFromQuarantine(it.id)} title="Delete for good">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--hairline)', margin: '22px 0 0', paddingTop: 16 }}>
              <p className="page-lede" style={{ margin: '0 0 6px' }}>
                reMarkable — pair your tablet so the notebook icon in the Player can browse your documents.
              </p>
              {rmPaired ? (
                <div className="cat-row">
                  <div className="cat-dot" style={{ background: 'oklch(0.55 0.10 200)' }} />
                  <div className="cat-name">
                    Paired{rmDocCount !== null ? ` · ${rmDocCount} documents` : ''}
                  </div>
                  <button className="set-active-btn" onClick={refreshRmStatus}>Resync</button>
                  <button className="x-btn" onClick={handleRmUnpair} title="Unpair this device">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <p className="ingest-hint" style={{ marginBottom: 8 }}>
                    Go to <a href="https://my.remarkable.com/device/desktop/connect" target="_blank" rel="noreferrer">my.remarkable.com/device/desktop/connect</a> and paste the 8-character code below.
                  </p>
                  <div className="ingest-row">
                    <input
                      className="ingest-input text"
                      placeholder="8-char pairing code"
                      value={rmPairCode}
                      onChange={(e) => setRmPairCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRmPair() }}
                      maxLength={16}
                    />
                    <button
                      className="ingest-save"
                      disabled={rmPairing || rmPairCode.trim().length < 6}
                      onClick={handleRmPair}
                    >{rmPairing ? 'Pairing…' : 'Pair'}</button>
                  </div>
                  {rmError && (
                    <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)', marginTop: 8 }}>{rmError}</div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {tab === 'done' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 12px' }}>
              Videos you've watched this week. Auto-cleared every Monday so the slate stays clean for the new week.
              {store.done.items.length > 0 && (
                <>
                  {' '}
                  <button
                    className="set-active-btn"
                    style={{ marginLeft: 12 }}
                    onClick={() => {
                      if (confirm('Clear this week\'s done list?')) onClearDone()
                    }}
                  >Clear now</button>
                </>
              )}
            </p>
            {store.done.items.length === 0 ? (
              <div className="empty" style={{ marginTop: 24 }}>
                <h2>Nothing watched yet this week</h2>
                <p>Mark a video Done in the Player and it lands here until Monday.</p>
              </div>
            ) : (
              store.done.items.map((item) => {
                const doneMap = makeCategoryMap(store.categories.length > 0 ? store.categories : DEFAULT_CATEGORIES)
                const cat = doneMap[item.category] ?? DEFAULT_CATEGORIES[0]
                const when = item.lastWatchedAt
                  ? new Date(item.lastWatchedAt).toLocaleDateString(undefined, { weekday: 'short' })
                  : ''
                return (
                  <div key={item.id} className="vault-row">
                    <div className="vault-body">
                      <div className="card-chip">
                        <div className="pip" style={{ background: cat.color }} />
                        <span className="label">{item.bucket === 'SUN' ? 'Sunday' : cat.name}{when ? ` · ${when}` : ''}</span>
                      </div>
                      <div className="vault-title">{item.title}</div>
                      <div className="vault-meta">
                        <span>{item.creator}</span>
                        <span className="dot-sep">·</span>
                        <span className="vault-url">{shortLabelForUrl(item.url)}</span>
                      </div>
                    </div>
                    <button
                      className="set-active-btn"
                      onClick={() => onRestoreFromDone(item.id)}
                      title="Put it back in the loop"
                    >Restore</button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {tab === 'videos' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 16px' }}>
              {store.loop.length === 0
                ? 'Nothing in the loop yet. Press Ctrl+I to ingest.'
                : `${store.loop.length} video${store.loop.length === 1 ? '' : 's'} in your loop. Grouped by bucket.`}
            </p>

            <div className="bucket-section">
              <div className="bucket-section-head">
                <h3>Weekday</h3>
                <span className="bucket-section-count">{weekdayVideos.length}</span>
              </div>
              {weekdayVideos.length === 0 ? (
                <div className="bucket-section-empty">No weekday videos yet.</div>
              ) : (
                weekdayVideos.map((item) => (
                  <VideoRow
                    key={item.id}
                    item={item}
                    categories={store.categories}
                    onRecategorize={onRecategorize}
                    onSetItemBucket={onSetItemBucket}
                    onDelete={onDeleteVideo}
                  />
                ))
              )}
            </div>

            <div className="bucket-section">
              <div className="bucket-section-head">
                <h3>Sunday</h3>
                <span className="bucket-section-count">{sundayVideos.length}</span>
              </div>
              {sundayVideos.length === 0 ? (
                <div className="bucket-section-empty">No Sunday videos yet.</div>
              ) : (
                sundayVideos.map((item) => (
                  <VideoRow
                    key={item.id}
                    item={item}
                    categories={store.categories}
                    onRecategorize={onRecategorize}
                    onSetItemBucket={onSetItemBucket}
                    onDelete={onDeleteVideo}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'channels' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 12px' }}>
              Paste a channel ID (<span className="mono-soft">UC…</span>) or @handle. If the channel releases a video today, it pins to Today.
            </p>
            <div className="channel-add">
              <input
                className="ingest-input text"
                placeholder="UCBJycsmduvYEL83R_U4JriQ  or  @mkbhd"
                value={channelInput}
                onChange={(e) => setChannelInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddChannel() }}
              />
              {channelBucket === 'WKDY' && (
                <select
                  className="cat-select"
                  value={channelCategory}
                  onChange={(e) => setChannelCategory(e.target.value as CategoryId)}
                  title="Category (Weekday only)"
                >
                  {store.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <BucketPicker value={channelBucket} onChange={setChannelBucket} />
              <button className="ingest-save" disabled={resolving || !channelInput.trim()} onClick={handleAddChannel}>
                {resolving ? 'Resolving…' : '+ Add'}
              </button>
            </div>
            {resolveError && (
              <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)' }}>{resolveError}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="set-active-btn" onClick={onRefreshChannels}>Refresh latest</button>
            </div>

            <div style={{ marginTop: 14 }}>
              {store.channels.length === 0 ? (
                <div className="empty" style={{ marginTop: 24 }}>
                  <h2>No channels yet</h2>
                  <p>Once you add a channel, the app polls its RSS feed and surfaces today's uploads on Today.</p>
                </div>
              ) : (() => {
                const renderChannelCard = (ch: typeof store.channels[0]) => {
                  const channelCatMap = makeCategoryMap(store.categories.length > 0 ? store.categories : DEFAULT_CATEGORIES)
                  const cat = channelCatMap[ch.category] ?? DEFAULT_CATEGORIES[0]
                  const fresh = store.channelFresh[ch.channelId]
                  const isSun = ch.bucket === 'SUN'
                  return (
                    <div key={ch.id} className="card" style={{ position: 'relative', cursor: 'default' }}>
                      <button
                        onClick={() => onRemoveChannel(ch.id)}
                        title="Remove channel"
                        aria-label="Remove channel"
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'transparent',
                          border: '1px solid var(--hairline)',
                          color: 'var(--ink-faint)',
                          borderRadius: 4,
                          width: 22,
                          height: 22,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          opacity: 0.6
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.6' }}
                      >
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                      <div className="card-chip">
                        <div className="pip" style={{ background: cat.color }} />
                        <span className="label">{isSun ? 'Sunday' : cat.name}</span>
                      </div>
                      <h3 className="card-title">{ch.name}</h3>
                      <div className="card-meta">
                        {ch.handle && <span className="creator">@{ch.handle}</span>}
                        <span className="url" title={ch.channelId}>{ch.channelId.slice(0, 18)}…</span>
                      </div>
                      {fresh && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTop: '1px solid var(--hairline)',
                            fontSize: 12,
                            color: 'var(--ink-faint)',
                            fontStyle: 'italic',
                            lineHeight: 1.4
                          }}
                        >
                          Latest: {fresh.title}
                          <div style={{ fontSize: 10.5, marginTop: 2, fontStyle: 'normal', fontFamily: 'var(--mono)' }}>
                            {new Date(fresh.publishedAt).toLocaleDateString()}
                          </div>
                        </div>
                      )}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          marginTop: 12,
                          flexWrap: 'wrap'
                        }}
                      >
                        <BucketPicker value={ch.bucket} onChange={(b) => onSetChannelBucket(ch.id, b)} />
                        {!isSun && (
                          <select
                            className="cat-select"
                            value={ch.category}
                            onChange={(e) => onSetChannelCategory(ch.id, e.target.value as CategoryId)}
                            title="Category (Weekday only)"
                            style={{ fontSize: 11 }}
                          >
                            {store.categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )
                }

                const wkdyChannels = store.channels.filter((c) => c.bucket === 'WKDY')
                const sunChannels = store.channels.filter((c) => c.bucket === 'SUN')

                return (
                  <div style={{ display: 'flex', gap: 24, marginTop: 24, alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 16, borderBottom: '1px solid var(--hairline)', paddingBottom: 8, marginBottom: 16, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📅 Weekday Channels</span>
                        <span style={{ fontSize: 12, opacity: 0.6, fontFamily: 'var(--mono)' }}>{wkdyChannels.length}</span>
                      </h3>
                      <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {wkdyChannels.map(renderChannelCard)}
                        {wkdyChannels.length === 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-faint)', padding: '20px 0' }}>No weekday channels</div>
                        )}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 16, borderBottom: '1px solid var(--hairline)', paddingBottom: 8, marginBottom: 16, color: 'var(--ink)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>☀️ Sunday Channels</span>
                        <span style={{ fontSize: 12, opacity: 0.6, fontFamily: 'var(--mono)' }}>{sunChannels.length}</span>
                      </h3>
                      <div className="card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                        {sunChannels.map(renderChannelCard)}
                        {sunChannels.length === 0 && (
                          <div style={{ fontStyle: 'italic', fontSize: 13, color: 'var(--ink-faint)', padding: '20px 0' }}>No Sunday channels</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}



        {tab === 'routine' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 12px' }}>
              Videos you watch every day — meditation, exercise, news ritual. They appear at the top of Today with a daily checkbox that resets at midnight.
            </p>
            <div className="channel-add" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <input
                className="ingest-input text"
                placeholder="Paste a YouTube video URL"
                value={routineUrl}
                onChange={(e) => setRoutineUrl(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="ingest-input text"
                  placeholder="Title (auto-fills)"
                  value={routineTitle}
                  onChange={(e) => setRoutineTitle(e.target.value)}
                />
                <input
                  className="ingest-input text"
                  placeholder="Creator (auto-fills)"
                  value={routineCreator}
                  onChange={(e) => setRoutineCreator(e.target.value)}
                  style={{ flex: '0 0 35%' }}
                />
                <button
                  className="ingest-save"
                  disabled={routineFetching || !routineUrl.trim()}
                  onClick={handleAddRoutine}
                >
                  {routineFetching ? 'Fetching…' : '+ Add to Routine'}
                </button>
              </div>
              {routineError && <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)' }}>{routineError}</div>}
            </div>

            <div style={{ marginTop: 18 }}>
              {store.routine.length === 0 ? (
                <div className="empty" style={{ marginTop: 24 }}>
                  <h2>No routine yet</h2>
                  <p>Add the videos you want to see every single day above. Great for stretches, sit-ups, a daily news clip, or a meditation.</p>
                </div>
              ) : (
                store.routine.map((it) => (
                  <div key={it.id} className="video-row">
                    <div className="video-pip" style={{ background: 'var(--ember)' }} />
                    <div className="video-body">
                      <div className="video-title">{it.title}</div>
                      <div className="video-meta">
                        <span>{it.creator || '—'}</span>
                        <span className="dot-sep">·</span>
                        <span>{shortLabelForUrl(it.url)}</span>
                      </div>
                    </div>
                    <button className="x-btn" onClick={() => onRemoveRoutine(it.id)} title="Remove from routine">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'google' && (
          <GoogleTab
            googleAuth={store.googleAuth}
            existingChannelIds={new Set(store.channels.map((c) => c.channelId))}
            cachedSubs={store.youtubeSubscriptionsCache?.subs ?? null}
            cachedSubsFetchedAt={store.youtubeSubscriptionsCache?.fetchedAt ?? null}
            categories={store.categories}
            onUpdateGoogleAuth={onUpdateGoogleAuth}
            onImportChannels={onImportChannels}
            onSubsFetched={onSubsFetched}
          />
        )}

        {tab === 'focus' && (
          <div className="settings-pane">
            <p className="page-lede" style={{ margin: '0 0 16px' }}>
              Pomodoro-style focus timer. Pauses with the video, resumes when you hit play.
            </p>
            <div className="cat-row">
              <div className="cat-name">Focus enabled</div>
              <div className="qty">
                <button
                  className={`set-active-btn ${store.focusConfig.enabled ? 'active' : ''}`}
                  onClick={() => onUpdateFocus({ ...store.focusConfig, enabled: !store.focusConfig.enabled })}
                  style={{
                    background: store.focusConfig.enabled ? 'var(--ember-tint)' : 'var(--card)',
                    color: store.focusConfig.enabled ? 'var(--ember-ink)' : 'var(--ink-soft)',
                    borderColor: store.focusConfig.enabled ? 'var(--ember)' : 'var(--hairline)'
                  }}
                >
                  {store.focusConfig.enabled ? 'On' : 'Off'}
                </button>
              </div>
            </div>
            <div className="cat-row">
              <div className="cat-name">Focus duration</div>
              <div className="qty">
                <span className="qty-label">Minutes</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, focusMinutes: Math.max(1, store.focusConfig.focusMinutes - 5) })}>−</button>
                <span className="qty-val">{store.focusConfig.focusMinutes}</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, focusMinutes: Math.min(120, store.focusConfig.focusMinutes + 5) })}>+</button>
              </div>
            </div>
            <div className="cat-row">
              <div className="cat-name">Break duration</div>
              <div className="qty">
                <span className="qty-label">Minutes</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, breakMinutes: Math.max(1, store.focusConfig.breakMinutes - 1) })}>−</button>
                <span className="qty-val">{store.focusConfig.breakMinutes}</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, breakMinutes: Math.min(30, store.focusConfig.breakMinutes + 1) })}>+</button>
              </div>
            </div>
            <div className="cat-row">
              <div className="cat-name">Course sessions / day</div>
              <div className="qty">
                <span className="qty-label">Sessions</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, courseSessionLimit: Math.max(1, store.focusConfig.courseSessionLimit - 1) })}>−</button>
                <span className="qty-val">{store.focusConfig.courseSessionLimit}</span>
                <button className="qty-btn" onClick={() => onUpdateFocus({ ...store.focusConfig, courseSessionLimit: Math.min(10, store.focusConfig.courseSessionLimit + 1) })}>+</button>
              </div>
            </div>
            <p className="page-lede" style={{ marginTop: 18, fontSize: 12.5 }}>
              After {store.focusConfig.courseSessionLimit} course sessions today, courses hide and only loop content remains. Resets at midnight.
            </p>
          </div>
        )}

        {tab === 'general' && (
          <div className="settings-pane">
            <div className="info-row"><span className="info-key">Version</span><span className="info-val">1.5.0</span></div>
            <div className="info-row"><span className="info-key">Loop items</span><span className="info-val">{store.loop.length}</span></div>
            <div className="info-row"><span className="info-key">Courses</span><span className="info-val">{store.courses.length}</span></div>
            <div className="info-row"><span className="info-key">Channels</span><span className="info-val">{store.channels.length}</span></div>
            <div className="info-row"><span className="info-key">Routine</span><span className="info-val">{store.routine.length}</span></div>
            <div className="info-row"><span className="info-key">Wishlist items</span><span className="info-val">{store.wishlist.length}</span></div>
            <div className="info-row"><span className="info-key">Sessions today</span><span className="info-val">{store.dailySessions?.totalSessionsCompleted ?? 0} (course: {store.dailySessions?.courseSessionsCompleted ?? 0})</span></div>
            <div className="info-row"><span className="info-key">Data file</span><span className="info-val mono">%APPDATA%\com.hearthcellar.app\config.json</span></div>

            <div className="info-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                <span className="info-key">YouTube API Key</span>
                {store.youtubeApiKey && (
                  <span style={{
                    fontSize: 10.5,
                    fontFamily: 'var(--mono)',
                    color: 'oklch(0.62 0.15 145)',
                    background: 'oklch(0.62 0.15 145 / 0.1)',
                    padding: '2px 6px',
                    borderRadius: 4
                  }}>active</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="ingest-input text"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="AIza..."
                    value={apiKeyInput}
                    onChange={(e) => { setApiKeyInput(e.target.value); setApiKeySaved(false) }}
                    style={{ width: '100%', paddingRight: 36, fontFamily: 'var(--mono)', fontSize: 12 }}
                  />
                  <button
                    onClick={() => setShowApiKey((v) => !v)}
                    style={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-faint)',
                      padding: 4,
                      fontSize: 11,
                      fontFamily: 'var(--mono)'
                    }}
                    title={showApiKey ? 'Hide' : 'Show'}
                  >
                    {showApiKey ? 'hide' : 'show'}
                  </button>
                </div>
                <button
                  className="ingest-save"
                  disabled={apiKeyInput === store.youtubeApiKey}
                  onClick={() => {
                    onUpdateApiKey(apiKeyInput.trim())
                    setApiKeySaved(true)
                    setTimeout(() => setApiKeySaved(false), 2000)
                  }}
                >
                  {apiKeySaved ? '✓ Saved' : 'Save'}
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', lineHeight: 1.45 }}>
                Enables reliable playlist loading via the official YouTube Data API.
                Get a free key from{' '}
                <a
                  href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--ember)' }}
                >
                  Google Cloud Console
                </a>
                {' '}→ Credentials → Create API Key.
              </div>
            </div>

            <div className="danger-zone">
              <div className="danger-label">Danger zone</div>
              {!confirmingClear ? (
                <button className="danger-btn" onClick={() => setConfirmingClear(true)}>Clear all data</button>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="danger-btn confirm" onClick={() => { onClearAll(); setConfirmingClear(false) }}>Yes, wipe everything</button>
                  <button className="danger-btn cancel" onClick={() => setConfirmingClear(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
