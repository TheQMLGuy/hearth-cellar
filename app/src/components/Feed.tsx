import React, { useMemo, useState } from 'react'
import type { PersistedStore, LoopItem, CategoryId, Bucket } from '../types'
import { newId } from '../lib/ids'

interface Props {
  store: PersistedStore
  onUpdateStore: (next: PersistedStore) => void
  onOpenVideo: (item: LoopItem) => void
  onRefreshChannels: () => void
  onBack: () => void
}

export function Feed({ store, onUpdateStore, onOpenVideo, onRefreshChannels, onBack }: Props) {
  const [refreshing, setRefreshing] = useState(false)

  // Map channel IDs to names for display
  const channelMap = useMemo(() => {
    const m = new Map<string, { name: string; category: CategoryId; bucket: Bucket }>()
    for (const c of store.channels) {
      m.set(c.channelId, { name: c.name, category: c.category, bucket: c.bucket })
    }
    return m
  }, [store.channels])

  // Extract and compile all cached weekly uploads
  const feedItems = useMemo(() => {
    const list: Array<{
      videoId: string
      title: string
      publishedAt: string
      channelId: string
      channelName: string
      category: CategoryId
      bucket: Bucket
    }> = []

    const dismissedIds = new Set(store.dismissedFeedVideoIds ?? [])

    for (const [chId, weekly] of Object.entries(store.sundayChannelWeekly ?? {})) {
      const chInfo = channelMap.get(chId)
      if (!chInfo) continue

      for (const v of weekly.videos ?? []) {
        if (dismissedIds.has(v.videoId)) continue
        list.push({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
          channelId: chId,
          channelName: chInfo.name,
          category: chInfo.category,
          bucket: chInfo.bucket
        })
      }
    }

    // Sort by publication date descending (newest first)
    return list.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
  }, [store.sundayChannelWeekly, store.dismissedFeedVideoIds, channelMap])

  // Set of videoIds currently in the loop or wishlist or done
  const importedVideoIds = useMemo(() => {
    const set = new Set<string>()
    for (const item of store.loop) set.add(item.videoId)
    for (const item of store.wishlist) set.add(item.videoId)
    for (const item of store.done?.items ?? []) set.add(item.videoId)
    return set
  }, [store.loop, store.wishlist, store.done])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefreshChannels()
    } catch (e) {
      console.error(e)
    } finally {
      // Small delay for UI smoothness
      setTimeout(() => setRefreshing(false), 800)
    }
  }

  const handleDismiss = (videoId: string) => {
    const dismissedFeedVideoIds = [...(store.dismissedFeedVideoIds ?? []), videoId]
    onUpdateStore({ ...store, dismissedFeedVideoIds })
  }

  const createLoopItem = (item: typeof feedItems[0], isWishlist: boolean): LoopItem => {
    return {
      id: newId(isWishlist ? 'wsh_' : 'itm_'),
      url: `https://www.youtube.com/watch?v=${item.videoId}`,
      videoId: item.videoId,
      title: item.title,
      creator: item.channelName,
      duration: '',
      category: item.category,
      bucket: item.bucket,
      addedAt: new Date().toISOString(),
      paras: [],
      lastWatchedAt: null,
      partsConsumed: 0
    }
  }

  const handleAddToLoop = (item: typeof feedItems[0]) => {
    const loopItem = createLoopItem(item, false)
    const loop = [loopItem, ...store.loop]
    onUpdateStore({ ...store, loop })
  }

  const handleAddToWishlist = (item: typeof feedItems[0]) => {
    const loopItem = createLoopItem(item, true)
    const wishlist = [loopItem, ...store.wishlist]
    onUpdateStore({ ...store, wishlist })
  }

  const handleWatchNow = (item: typeof feedItems[0]) => {
    const loopItem = createLoopItem(item, false)
    onOpenVideo(loopItem)
  }

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return isoStr
    }
  }

  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Subscriptions</div>
            <h2 className="page-h2">Channel Feed</h2>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="set-active-btn" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh Feed'}
            </button>
            <button className="set-active-btn" onClick={onBack}>Back</button>
          </div>
        </div>

        <p className="page-lede" style={{ marginBottom: 20 }}>
          Here are the recent uploads from your tracked channels. Let them settle, or add them directly into your workflow.
        </p>

        {feedItems.length === 0 ? (
          <div className="empty" style={{ marginTop: 40, padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12 }}>
            <h2>Feed is empty</h2>
            <p style={{ color: 'var(--ink-faint)', marginTop: 8 }}>
              {store.channels.length === 0
                ? "You aren't tracking any channels yet. Add channels in Settings → Channels."
                : "No new uploads fetched this week. Click 'Refresh Feed' to check now."}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {feedItems.map((item) => {
              const isImported = importedVideoIds.has(item.videoId)
              return (
                <div
                  key={item.videoId}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '16px 20px',
                    gap: 12,
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: 'var(--mono)',
                          color: 'var(--ink-faint)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        {item.channelName} · {formatDate(item.publishedAt)}
                      </div>
                      <h4
                        style={{
                          fontSize: 14.5,
                          fontWeight: 500,
                          color: 'var(--ink)',
                          margin: '4px 0 0 0',
                          lineHeight: 1.4,
                          cursor: 'pointer'
                        }}
                        onClick={() => handleWatchNow(item)}
                        title="Click to watch"
                      >
                        {item.title}
                      </h4>
                    </div>
                    {isImported && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: 'var(--ember-tint)',
                          color: 'var(--ember-ink)',
                          padding: '3px 8px',
                          borderRadius: 4,
                          marginLeft: 12,
                          border: '1px solid var(--ember)'
                        }}
                      >
                        Queued / Watched
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      className="ccat-pill"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleWatchNow(item)}
                    >
                      ▶ Play
                    </button>
                    {!isImported && (
                      <>
                        <button
                          className="ccat-pill"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handleAddToLoop(item)}
                        >
                          ＋ Add to Loop
                        </button>
                        <button
                          className="ccat-pill"
                          style={{ padding: '6px 12px', fontSize: 12 }}
                          onClick={() => handleAddToWishlist(item)}
                        >
                          ❤️ Wishlist
                        </button>
                      </>
                    )}
                    <button
                      className="course-card-btn danger"
                      onClick={() => handleDismiss(item.videoId)}
                      style={{ padding: '6px 10px', fontSize: 12, border: '1px solid var(--border-soft)' }}
                      title="Hide from feed"
                    >
                      ✕ Hide
                    </button>
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
