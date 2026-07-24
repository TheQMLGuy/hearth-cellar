import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import type {
  ChannelLatest,
  ChannelLookup,
  ChannelRecentVideo,
  FetchedMeta,
  GoogleDeviceCode,
  GooglePollResult,
  GoogleTokenResponse,
  PersistedStore,
  PlaylistVideo,
  YouTubeSubscription
} from './types'
import { DEFAULT_CATEGORIES } from './lib/categories'

const STORAGE_KEY = 'hearth-cellar-store'

const DEFAULT_STORE: PersistedStore = {
  schemaVersion: 6,
  mode: 'WKDY',
  loop: [],
  todayPlan: null,
  courses: [],
  categoryQuotas: { curiosity: 2, reflective: 2, craft: 1 } as Record<string, number>,
  activeCourseId: null,
  watched: [],
  watchedByCourse: {},
  channels: [],
  channelFresh: {},
  focusConfig: { focusMinutes: 40, breakMinutes: 10, courseSessionLimit: 4, enabled: true },
  dailySessions: null,
  routine: [],
  routineDoneByDay: {},
  googleAuth: {
    clientId: '',
    clientSecret: '',
    accessToken: null,
    refreshToken: null,
    expiresAt: null
  },
  youtubeApiKey: '',
  sundayLimit: 5,
  playlistVideosCache: {},
  youtubeSubscriptionsCache: null,
  categories: DEFAULT_CATEGORIES,
  sundayChannelWeekly: {},
  progress: {},
  sliceTargetMin: 30,
  sundayMinutes: 90,
  weekdayMinutes: 60,
  shortsQuarantine: [],
  remarkable: { paired: false },
  done: { weekStart: new Date().toISOString(), items: [] },
  playlistNotes: {},
  courseCategories: [
    { id: 'cc_learning', name: 'Learning', color: 'oklch(0.55 0.14 250)' },
    { id: 'cc_building', name: 'Building', color: 'oklch(0.55 0.14 155)' },
    { id: 'cc_creative', name: 'Creative', color: 'oklch(0.60 0.16 55)' }
  ],
  activeCourseByCategory: {},
  wishlist: [],
  trash: [],
  bookmarks: [],
  courseStreaks: {}
}

let migratedFromLocalStorage = false
let cachedApiKey = ''
let cachedApiKeys: string[] = []
let currentApiKeyIdx = 0

function getApiKey(): string | null {
  if (cachedApiKeys.length > 0) {
    const key = cachedApiKeys[currentApiKeyIdx]
    currentApiKeyIdx = (currentApiKeyIdx + 1) % cachedApiKeys.length
    return key || null
  }
  return cachedApiKey || null
}

async function getStore(): Promise<PersistedStore> {
  // 1. Try the file first
  try {
    const raw = (await invoke('read_store')) as string
    if (raw && raw.trim().length > 0) {
      return JSON.parse(raw) as PersistedStore
    }
  } catch {
    // ignore — file might not exist yet
  }

  // 2. Migrate from localStorage if present (one-time upgrade from earlier versions)
  if (!migratedFromLocalStorage) {
    migratedFromLocalStorage = true
    const fromLS = localStorage.getItem(STORAGE_KEY)
    if (fromLS) {
      try {
        const parsed = JSON.parse(fromLS) as PersistedStore
        await invoke('write_store', { json: JSON.stringify(parsed) })
        // Keep localStorage as a safety copy; clear later if you want
        return parsed
      } catch {
        // ignore corrupt LS
      }
    }
  }

  return DEFAULT_STORE
}

async function setStore(next: PersistedStore): Promise<boolean> {
  const json = JSON.stringify(next)
  try {
    const ok = (await invoke('write_store', { json })) as boolean
    if (ok) {
      // Also mirror to localStorage as a safety net in case the file is lost
      try {
        localStorage.setItem(STORAGE_KEY, json)
      } catch {
        /* ignore quota */
      }
      return true
    }
  } catch {
    // fall through to localStorage-only
  }
  localStorage.setItem(STORAGE_KEY, json)
  return true
}

async function fetchVideoMeta(videoId: string): Promise<FetchedMeta | null> {
  try {
    return (await invoke('fetch_youtube_meta', { videoId, apiKey: getApiKey() })) as FetchedMeta | null
  } catch {
    return null
  }
}

async function fetchVideoTranscript(videoId: string): Promise<import('./types').TranscriptCue[]> {
  try {
    return ((await invoke('fetch_youtube_transcript', { videoId })) as import('./types').TranscriptCue[]) ?? []
  } catch {
    return []
  }
}

async function fetchPlaylistMeta(playlistId: string): Promise<FetchedMeta | null> {
  try {
    return (await invoke('fetch_youtube_playlist_meta', { playlistId, apiKey: getApiKey() })) as FetchedMeta | null
  } catch {
    return null
  }
}

async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  try {
    return ((await invoke('fetch_youtube_playlist_videos', { playlistId, apiKey: getApiKey() })) as PlaylistVideo[]) ?? []
  } catch {
    return []
  }
}

async function resolveChannel(handle: string): Promise<ChannelLookup | null> {
  try {
    return (await invoke('resolve_channel', { handle, apiKey: getApiKey() })) as ChannelLookup | null
  } catch {
    return null
  }
}

async function fetchChannelLatest(channelId: string): Promise<ChannelLatest | null> {
  try {
    return (await invoke('fetch_channel_latest', { channelId, apiKey: getApiKey() })) as ChannelLatest | null
  } catch {
    return null
  }
}

async function fetchChannelRecent(channelId: string, sinceIso: string): Promise<ChannelRecentVideo[]> {
  try {
    return ((await invoke('fetch_channel_recent', { channelId, sinceIso, apiKey: getApiKey() })) as ChannelRecentVideo[]) ?? []
  } catch {
    return []
  }
}

async function searchYoutubeVideos(query: string): Promise<import('./types').ChannelRecentVideo[]> {
  try {
    return ((await invoke('search_youtube_videos_api', { query, apiKey: getApiKey() })) as import('./types').ChannelRecentVideo[]) ?? []
  } catch (err) {
    console.error('searchYoutubeVideos failed:', err)
    return []
  }
}

async function callGeminiApi(apiKey: string, model: string, prompt: string): Promise<string> {
  try {
    return (await invoke('call_gemini_api', { apiKey, model, prompt })) as string
  } catch (err) {
    throw new Error(String(err))
  }
}

async function callOllamaApi(endpoint: string, model: string, prompt: string, formatJson: boolean): Promise<string> {
  try {
    return (await invoke('call_ollama_api', { endpoint, model, prompt, formatJson })) as string
  } catch (err) {
    throw new Error(String(err))
  }
}

async function googleStartDeviceFlow(clientId: string): Promise<GoogleDeviceCode | null> {
  try {
    return (await invoke('google_start_device_flow', { clientId })) as GoogleDeviceCode | null
  } catch {
    return null
  }
}

async function googlePollToken(
  clientId: string,
  clientSecret: string,
  deviceCode: string
): Promise<GooglePollResult> {
  try {
    return (await invoke('google_poll_token', { clientId, clientSecret, deviceCode })) as GooglePollResult
  } catch (e) {
    return { status: 'error', message: String(e) }
  }
}

async function googleRefreshToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<GoogleTokenResponse | null> {
  try {
    return (await invoke('google_refresh_token', { clientId, clientSecret, refreshToken })) as GoogleTokenResponse | null
  } catch {
    return null
  }
}

async function youtubeListSubscriptions(accessToken: string): Promise<YouTubeSubscription[]> {
  try {
    return ((await invoke('youtube_list_subscriptions', { accessToken })) as YouTubeSubscription[]) ?? []
  } catch {
    return []
  }
}

async function rmPair(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await invoke('rm_pair', { code })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

async function rmUnpair(): Promise<boolean> {
  try {
    await invoke('rm_unpair')
    return true
  } catch {
    return false
  }
}

async function rmStatus(): Promise<import('./types').RmStatus> {
  try {
    return (await invoke('rm_status')) as import('./types').RmStatus
  } catch {
    return { paired: false, lastSync: null, docCount: 0 }
  }
}

async function rmListDocs(forceRefresh?: boolean): Promise<import('./types').RmDoc[]> {
  // DO NOT swallow errors here — the modal shows the message to the user so
  // we know which endpoint actually rejected.
  return ((await invoke('rm_list_docs', { forceRefresh })) as import('./types').RmDoc[]) ?? []
}

async function rmDocMeta(uuid: string): Promise<import('./types').RmDoc | null> {
  try {
    return (await invoke('rm_doc_meta', { uuid })) as import('./types').RmDoc | null
  } catch {
    return null
  }
}

async function pickNoteFile(): Promise<string | null> {
  try {
    return (await invoke('pick_note_file')) as string | null
  } catch {
    return null
  }
}

async function rmDiagnose(): Promise<string> {
  try {
    return (await invoke('rm_diagnose')) as string
  } catch (e) {
    return `Diagnose call failed: ${String(e)}`
  }
}

async function openInBrowser(url: string): Promise<void> {
  try {
    await invoke('open_in_browser', { url })
  } catch {}
}

export function installTauriShim(): void {
  const win = getCurrentWindow()
  window.hearth = {
    getStore,
    setStore,
    fetchVideoMeta,
    fetchVideoTranscript,
    fetchPlaylistMeta,
    fetchPlaylistVideos,
    resolveChannel,
    fetchChannelLatest,
    fetchChannelRecent,
    googleStartDeviceFlow,
    googlePollToken,
    googleRefreshToken,
    youtubeListSubscriptions,
    rmPair,
    rmUnpair,
    rmStatus,
    rmListDocs,
    rmDocMeta,
    pickNoteFile,
    rmDiagnose,
    openInBrowser,
    searchYoutubeVideos,
    callGeminiApi,
    callOllamaApi,
    setApiKey: (key: string) => {
      cachedApiKey = key
    },
    setApiKeys: (keys: string[]) => {
      cachedApiKeys = keys
    },
    windowMinimize: () => {
      win.minimize().catch(() => {})
    },
    windowMaximize: () => {
      win.toggleMaximize().catch(() => {})
    },
    windowClose: () => {
      win.close().catch(() => {})
    }
  }
}
