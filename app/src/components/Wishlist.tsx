import type { Bucket, Category, LoopItem } from '../types'
import { DEFAULT_CATEGORIES, makeCategoryMap } from '../lib/categories'
import { shortLabelForUrl } from '../lib/youtube'
import { formatSeconds } from '../lib/duration'

interface Props {
  items: LoopItem[]
  categories: Category[]
  onOpen: (item: LoopItem) => void
  onPromoteToLoop: (id: string) => void
  onRemove: (id: string) => void
  onSetBucket: (id: string, bucket: Bucket) => void
  onTriggerIngest: () => void
  onBack: () => void
}

export function Wishlist({
  items,
  categories,
  onOpen,
  onPromoteToLoop,
  onRemove,
  onSetBucket,
  onTriggerIngest,
  onBack
}: Props) {
  const catMap = makeCategoryMap(categories.length > 0 ? categories : DEFAULT_CATEGORIES)
  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <button className="back-link" onClick={onBack}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>{' '}
          Back to Today
        </button>
        <div className="eyebrow">For later</div>
        <h2 className="page-h2">Wishlist</h2>
        <p className="page-lede">
          Videos parked outside your daily rotation. Hit <strong>Move to Loop</strong> when you're ready to actually watch one — it joins your today picks. Hit <strong>×</strong> to drop it.
        </p>

        {items.length === 0 ? (
          <div className="empty" style={{ marginTop: 24 }}>
            <h2>Nothing on the wishlist</h2>
            <p>Press <kbd>Ctrl</kbd> <kbd>I</kbd> to ingest something. Pick <strong>Wishlist</strong> as the save target.</p>
            <p style={{ marginTop: 14 }}>
              <button onClick={onTriggerIngest} className="ingest-save" style={{ padding: '9px 16px' }}>
                Ingest a video
              </button>
            </p>
          </div>
        ) : (
          <div className="card-grid">
            {items.map((item) => {
              const cat = catMap[item.category] ?? DEFAULT_CATEGORIES[0]
              const dur = item.duration || (item.durationSec ? formatSeconds(item.durationSec) : '')
              return (
                <div key={item.id} className="card" style={{ position: 'relative', cursor: 'default' }}>
                  <button
                    onClick={() => onRemove(item.id)}
                    title="Remove from wishlist"
                    aria-label="Remove from wishlist"
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
                  <div className="card-chip" onClick={() => onOpen(item)} style={{ cursor: 'pointer' }}>
                    <div className="pip" style={{ background: cat.color }} />
                    <span className="label">{item.bucket === 'SUN' ? 'Sunday' : cat.name}{dur ? ` · ${dur}` : ''}</span>
                  </div>
                  <h3 className="card-title" onClick={() => onOpen(item)} style={{ cursor: 'pointer' }}>{item.title}</h3>
                  <div className="card-meta" onClick={() => onOpen(item)} style={{ cursor: 'pointer' }}>
                    <span className="creator">{item.creator}</span>
                    <span className="url">{shortLabelForUrl(item.url)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 12,
                      flexWrap: 'wrap'
                    }}
                  >
                    <div className="bucket-pill small">
                      <button
                        className={item.bucket === 'WKDY' ? 'active' : ''}
                        onClick={() => onSetBucket(item.id, 'WKDY')}
                      >WKDY</button>
                      <button
                        className={item.bucket === 'SUN' ? 'active' : ''}
                        onClick={() => onSetBucket(item.id, 'SUN')}
                      >SUN</button>
                    </div>
                    <button
                      className="ingest-save"
                      style={{ marginLeft: 'auto', padding: '6px 12px', fontSize: 12 }}
                      onClick={() => onPromoteToLoop(item.id)}
                      title="Move into your loop so it can show up on Today"
                    >Move to Loop →</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
