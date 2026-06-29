import type { LoopItem } from '../types'

export interface SundayWeeklyEntry {
  channelName: string
  videoId: string
  title: string
  publishedAt: string
}

interface Props {
  items: LoopItem[]
  totalSundayCount: number
  weeklyEntries: SundayWeeklyEntry[]
  onOpen: (item: LoopItem) => void
  onOpenWeekly: (entry: SundayWeeklyEntry) => void
  onMoveLater: (id: string) => void
  onTriggerIngest: () => void
}

function formatPublished(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function Harvest({
  items,
  totalSundayCount,
  weeklyEntries,
  onOpen,
  onOpenWeekly,
  onMoveLater,
  onTriggerIngest
}: Props) {
  const nothing = items.length === 0 && weeklyEntries.length === 0
  return (
    <div className="screen harvest">
      <div className="harvest-head">
        <div className="harvest-eyebrow">The Sunday</div>
        <h1 className="harvest-h1">Harvest</h1>
      </div>
      {nothing ? (
        <div className="empty" style={{ marginTop: 24 }}>
          <h2>An empty Sunday</h2>
          <p>
            No Sunday items in your loop yet, and no SUN-bucketed channels have uploaded this week.
            Press <kbd>Ctrl</kbd> <kbd>I</kbd> to ingest a Sunday video, or add channels in Settings → Channels.
          </p>
          <p style={{ marginTop: 14 }}>
            <button onClick={onTriggerIngest} className="ingest-save" style={{ padding: '9px 16px' }}>
              Ingest your first video
            </button>
          </p>
        </div>
      ) : (
        <div className="harvest-body">
          {weeklyEntries.length > 0 && (
            <>
              <div className="harvest-group-head">
                <h3>This week's uploads</h3>
                <div className="harvest-line" />
                <span className="harvest-count">{weeklyEntries.length} from your channels</span>
              </div>
              {weeklyEntries.map((e) => (
                <div key={e.videoId} className="harvest-row">
                  <div className="harvest-row-body" onClick={() => onOpenWeekly(e)}>
                    <span className="harvest-creator">{e.channelName}</span>
                    <span className="harvest-title">{e.title}</span>
                    <span className="harvest-dur">{formatPublished(e.publishedAt)}</span>
                  </div>
                </div>
              ))}
            </>
          )}

          {items.length > 0 && (
            <>
              <div className="harvest-group-head" style={{ marginTop: weeklyEntries.length > 0 ? 28 : 0 }}>
                <h3>Today's pick</h3>
                <div className="harvest-line" />
                <span className="harvest-count">{items.length} of {totalSundayCount}</span>
              </div>
              {items.map((item) => (
                <div key={item.id} className="harvest-row">
                  <div className="harvest-row-body" onClick={() => onOpen(item)}>
                    <span className="harvest-creator">{item.creator || '—'}</span>
                    <span className="harvest-title">{item.title}</span>
                    {item.duration && <span className="harvest-dur">{item.duration}</span>}
                  </div>
                  <button
                    className="harvest-later-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveLater(item.id)
                    }}
                    title="Move to end of loop — watch it another time"
                  >
                    Later →
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
