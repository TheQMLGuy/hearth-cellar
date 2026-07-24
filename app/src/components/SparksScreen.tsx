import { useMemo, useState } from 'react'
import type { Category, Spark } from '../types'
import { SPARK_KINDS, SPARK_KIND_ORDER, sparkDateKey } from '../lib/sparks'
import { makeCategoryMap, DEFAULT_CATEGORIES } from '../lib/categories'

interface Props {
  sparks: Spark[]
  categories: Category[]
  onDelete: (id: string) => void
  onTriggerCapture: () => void
  onBack: () => void
}

type Filter = 'today' | 'all'

export function SparksScreen({ sparks, categories, onDelete, onTriggerCapture, onBack }: Props) {
  void onBack
  const [filter, setFilter] = useState<Filter>('today')
  const [kindFilter, setKindFilter] = useState<'' | Spark['kind']>('')
  const catMap = makeCategoryMap(categories.length > 0 ? categories : DEFAULT_CATEGORIES)
  const today = sparkDateKey()

  const visible = useMemo(() => {
    let out = sparks.slice()
    if (filter === 'today') out = out.filter((s) => s.createdDate === today)
    if (kindFilter) out = out.filter((s) => s.kind === kindFilter)
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [sparks, filter, kindFilter, today])

  const todayCount = sparks.filter((s) => s.createdDate === today).length

  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <div className="eyebrow">Ideation</div>
        <h2 className="page-h2">Sparks</h2>
        <p className="page-lede">
          Catch a thought while it's warm. Press <kbd>Ctrl</kbd> <kbd>S</kbd> anywhere to open the
          capture dialog — the spark is timestamped and (if you're watching a video) linked to it.
        </p>

        {/* Filter row */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 18,
            flexWrap: 'wrap',
            alignItems: 'center'
          }}
        >
          <div className="bucket-pill small">
            <button
              className={filter === 'today' ? 'active' : ''}
              onClick={() => setFilter('today')}
            >
              Today · {todayCount}
            </button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All · {sparks.length}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => setKindFilter('')}
              className="mono"
              style={{
                padding: '4px 10px',
                fontSize: 10.5,
                borderRadius: 999,
                background: kindFilter === '' ? 'var(--ember)' : 'transparent',
                color: kindFilter === '' ? 'white' : 'var(--ink-subtle)',
                border: `1px solid ${kindFilter === '' ? 'var(--ember)' : 'var(--hairline)'}`,
                cursor: 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              All kinds
            </button>
            {SPARK_KIND_ORDER.map((k) => {
              const meta = SPARK_KINDS[k]
              const on = kindFilter === k
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(on ? '' : k)}
                  className="mono"
                  style={{
                    padding: '4px 10px',
                    fontSize: 10.5,
                    borderRadius: 999,
                    background: on ? meta.color : 'transparent',
                    color: on ? 'white' : 'var(--ink-subtle)',
                    border: `1px solid ${on ? meta.color : 'var(--hairline)'}`,
                    cursor: 'pointer',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span aria-hidden>{meta.glyph}</span>
                  {meta.label}
                </button>
              )
            })}
          </div>
          <button
            onClick={onTriggerCapture}
            className="ingest-save"
            style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12 }}
          >
            + Capture
          </button>
        </div>

        {visible.length === 0 ? (
          <div className="empty" style={{ marginTop: 32 }}>
            <h2>
              {filter === 'today' ? 'No sparks yet today.' : 'No sparks match this filter.'}
            </h2>
            <p>
              Press <kbd>Ctrl</kbd> <kbd>S</kbd> to catch one. Or click{' '}
              <button
                onClick={onTriggerCapture}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ember)',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 'inherit'
                }}
              >
                Capture
              </button>{' '}
              above.
            </p>
          </div>
        ) : (
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {visible.map((spark) => {
              const kindMeta = spark.kind ? SPARK_KINDS[spark.kind] : null
              const cat = spark.category ? catMap[spark.category] : null
              return (
                <div
                  key={spark.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: 'var(--coal-light, #2a2520)',
                    border: '1px solid var(--hairline)',
                    position: 'relative'
                  }}
                >
                  <button
                    onClick={() => {
                      if (confirm(`Delete this spark? "${spark.title}"`)) onDelete(spark.id)
                    }}
                    aria-label="Delete spark"
                    title="Delete"
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
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
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = '1'
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.opacity = '0.6'
                    }}
                  >
                    <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 6,
                      flexWrap: 'wrap'
                    }}
                  >
                    {kindMeta && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: kindMeta.color + '25',
                          color: kindMeta.color,
                          border: `1px solid ${kindMeta.color}60`,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <span aria-hidden>{kindMeta.glyph}</span>
                        {kindMeta.label}
                      </span>
                    )}
                    {cat && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 10,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: cat.color + '15',
                          color: 'var(--ink)',
                          border: `1px solid ${cat.color}60`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: cat.color,
                            display: 'inline-block'
                          }}
                        />
                        {cat.name}
                      </span>
                    )}
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: 'var(--ink-faint)', marginLeft: 'auto', paddingRight: 32 }}
                    >
                      {formatTime(spark.createdAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: 'var(--serif)',
                      fontSize: 15.5,
                      lineHeight: 1.4,
                      color: 'var(--ink)',
                      paddingRight: 28
                    }}
                  >
                    {spark.title}
                  </div>

                  {spark.description && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12.5,
                        lineHeight: 1.5,
                        color: 'var(--ink-subtle)',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {spark.description}
                    </div>
                  )}

                  {spark.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                      {spark.tags.map((t) => (
                        <span
                          key={t}
                          className="mono"
                          style={{
                            fontSize: 9.5,
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: 'var(--coal)',
                            color: 'var(--ink-faint)',
                            border: '1px solid var(--hairline)'
                          }}
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {spark.sourceVideoId && (
                    <div
                      className="mono"
                      style={{
                        marginTop: 8,
                        fontSize: 10,
                        color: 'var(--ink-faint)'
                      }}
                    >
                      From video · {spark.sourceVideoId}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
