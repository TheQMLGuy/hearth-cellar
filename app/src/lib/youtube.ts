export type YouTubeRef =
  | { kind: 'video'; id: string }
  | { kind: 'playlist'; id: string }

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/
const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{13,}$/

export function parseYouTubeUrl(input: string): YouTubeRef | null {
  const raw = input.trim()
  if (!raw) return null

  if (VIDEO_ID_RE.test(raw)) return { kind: 'video', id: raw }

  let u: URL
  try {
    u = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }

  const host = u.hostname.replace(/^www\./, '')

  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '').split('/')[0]
    return VIDEO_ID_RE.test(id) ? { kind: 'video', id } : null
  }

  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    const list = u.searchParams.get('list')
    if (u.pathname === '/playlist' && list && PLAYLIST_ID_RE.test(list)) {
      return { kind: 'playlist', id: list }
    }
    if (u.pathname === '/watch') {
      if (list && PLAYLIST_ID_RE.test(list)) {
        return { kind: 'playlist', id: list }
      }
      const v = u.searchParams.get('v') ?? ''
      if (VIDEO_ID_RE.test(v)) return { kind: 'video', id: v }
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/')[2] ?? ''
      if (VIDEO_ID_RE.test(id)) return { kind: 'video', id }
    }
    if (u.pathname.startsWith('/embed/')) {
      const id = u.pathname.split('/')[2] ?? ''
      if (id === 'videoseries' && list && PLAYLIST_ID_RE.test(list)) {
        return { kind: 'playlist', id: list }
      }
      if (VIDEO_ID_RE.test(id)) return { kind: 'video', id }
    }
  }

  return null
}

export interface EmbedOptions {
  startSec?: number
  endSec?: number
}

export function buildEmbedUrl(videoId: string, opts: EmbedOptions = {}): string {
  // enablejsapi=1 lets us send postMessage commands (pause/play) into the iframe
  // when the focus timer hits the break interval.
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1',
    enablejsapi: '1'
  })
  if (opts.startSec && opts.startSec > 0) {
    params.set('start', String(Math.floor(opts.startSec)))
  }
  if (opts.endSec && opts.endSec > 0) {
    params.set('end', String(Math.floor(opts.endSec)))
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

export function postPauseToAllIframes(): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed"]')
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
        '*'
      )
    } catch {
      // ignore
    }
  })
}

export function postPlayToAllIframes(): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed"]')
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
        '*'
      )
    } catch {
      // ignore
    }
  })
}

/**
 * Tell every YouTube iframe to start sending us onStateChange events.
 * Must be called AFTER the iframe has loaded — give it ~500ms after mount.
 */
export function startListeningToIframes(): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed"]')
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'hearth', channel: 'hearth' }),
        '*'
      )
    } catch {
      // ignore
    }
  })
}

/**
 * YouTube IFrame Player API state codes:
 *   -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
 */
export type YTPlayerState = -1 | 0 | 1 | 2 | 3 | 5

/**
 * Ask every visible YouTube iframe to broadcast its current playback time.
 * The response arrives via the existing `infoDelivery` message — `info.currentTime`.
 * We piggy-back on the `enablejsapi=1` channel.
 */
export function pollCurrentTimeFromIframes(): void {
  const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe[src*="youtube.com/embed"]')
  iframes.forEach((iframe) => {
    try {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }),
        '*'
      )
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'getDuration', args: [] }),
        '*'
      )
    } catch {
      // ignore
    }
  })
}

export function buildPlaylistEmbedUrl(playlistId: string): string {
  const params = new URLSearchParams({
    list: playlistId,
    rel: '0',
    modestbranding: '1',
    iv_load_policy: '3',
    playsinline: '1'
  })
  return `https://www.youtube.com/embed/videoseries?${params.toString()}`
}

export function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function buildPlaylistWatchUrl(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`
}

export function shortLabelForUrl(url: string): string {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return `youtu.be/${u.pathname.slice(1, 9)}`
    const v = u.searchParams.get('v')
    if (v) return `youtube.com/watch?v=${v.slice(0, 6)}`
    return host + u.pathname.slice(0, 12)
  } catch {
    return url.length > 28 ? url.slice(0, 28) + '…' : url
  }
}
