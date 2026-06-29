import type { LoopItem } from '../types'
import { CATEGORY_BY_ID } from '../lib/categories'
import { shortLabelForUrl } from '../lib/youtube'

interface Props {
  items: LoopItem[]
  onOpen: (item: LoopItem) => void
  onRemove: (id: string) => void
  onBack: () => void
}

export function Vault({ items, onOpen, onRemove, onBack }: Props) {
  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <button className="back-link" onClick={onBack}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M19 12H5m7-7-7 7 7 7" />
          </svg>{' '}
          Back to Today
        </button>
        <div className="eyebrow">Keepsake</div>
        <h2 className="page-h2">The Vault</h2>
        <p className="page-lede">
          Videos worth returning to. Add anything from the Player with the heart.
        </p>

        {items.length === 0 ? (
          <div className="empty" style={{ marginTop: 24 }}>
            <h2>An empty shelf</h2>
            <p>Watch something, then press the heart in the Player to keep it here.</p>
          </div>
        ) : (
          <div className="vault-list">
            {items.map((item) => {
              const cat = CATEGORY_BY_ID[item.category]
              return (
                <div key={item.id} className="vault-row">
                  <div
                    className="vault-body"
                    onClick={() => onOpen(item)}
                  >
                    <div className="card-chip">
                      <div className="pip" style={{ background: cat.color }} />
                      <span className="label">{item.bucket === 'SUN' ? 'Sunday' : cat.name}</span>
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
                    onClick={() => onRemove(item.id)}
                    title="Remove from Vault"
                    aria-label="Remove from Vault"
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
