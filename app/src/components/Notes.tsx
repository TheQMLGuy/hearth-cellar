import type { LoopItem } from '../types'
import { DEFAULT_CATEGORIES, makeCategoryMap } from '../lib/categories'
import { shortLabelForUrl } from '../lib/youtube'
import type { Category } from '../types'

interface Props {
  items: LoopItem[]
  categories: Category[]
  onOpen: (item: LoopItem) => void
  onDetach: (id: string) => void
  onBack: () => void
}

export function Notes({ items, categories, onOpen, onDetach, onBack }: Props) {
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
        <div className="eyebrow">Margin</div>
        <h2 className="page-h2">Notes</h2>
        <p className="page-lede">
          Videos you've watched and taken reMarkable notes on. Open one to re-watch alongside the page you wrote.
        </p>

        {items.length === 0 ? (
          <div className="empty" style={{ marginTop: 24 }}>
            <h2>No notes yet</h2>
            <p>Attach a reMarkable doc from the Player (notebook icon), then finish the video. It will appear here.</p>
          </div>
        ) : (
          <div className="vault-list">
            {items.map((item) => {
              const cat = catMap[item.category] ?? DEFAULT_CATEGORIES[0]
              return (
                <div key={item.id} className="vault-row">
                  <div
                    className="vault-body"
                    onClick={() => onOpen(item)}
                  >
                    <div className="card-chip">
                      <div className="pip" style={{ background: cat.color }} />
                      <span className="label">{item.bucket === 'SUN' ? 'Entertainment' : cat.name}</span>
                      {item.note && (
                        <span className="label" style={{ marginLeft: 8, opacity: 0.7 }}>
                          📝 {item.note.label}
                        </span>
                      )}
                    </div>
                    <div className="vault-title">{item.title}</div>
                    <div className="vault-meta">
                      <span>{item.creator}</span>
                      <span className="dot-sep">·</span>
                      <span className="vault-url">{shortLabelForUrl(item.url)}</span>
                    </div>
                  </div>
                  <button
                    className="x-btn"
                    onClick={() => onDetach(item.id)}
                    title="Detach note"
                    aria-label="Detach note"
                  >
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
  )
}
