export type Mode = 'WKDY' | 'SUN'

export type Bucket = 'WKDY' | 'SUN'

// CategoryId is open-ended: user-defined categories live in store.categories.
export type CategoryId = string

export interface Category {
  id: CategoryId
  name: string
  color: string
  dotShadow: string
  /**
   * Days of week (0=Sun .. 6=Sat) on which this category contributes items
   * to Today's plan. Empty / undefined = every day.
   */
  days?: number[]
  /** Minutes/day budget for this category. Replaces item-count quota. */
  minutesPerDay?: number
  pinned?: boolean
}

export interface CourseCategory {
  id: string
  name: string
  color: string
  sessionLimit?: number
}

export type PlaylistOrder = 'normal' | 'reverse' | 'manual'

export interface Chapter {
  title: string
  startSec: number
}

export interface RemarkableNoteRef {
  source: 'remarkable' | 'local'
  /** reMarkable document UUID (when source = 'remarkable') or absolute file path (when 'local'). */
  docUuid: string
  label: string
  /** ISO timestamp from reMarkable cloud — used to detect remote updates. */
  lastUpdatedAt: string
  /** ISO local clock at last successful sync. */
  lastSyncedAt: string
}

export interface LoopItem {
  id: string
  url: string
  videoId: string
  title: string
  creator: string
  duration: string
  category: CategoryId
  bucket: Bucket
  addedAt: string
  paras: string[]
  lastWatchedAt: string | null
  /** Parsed YouTube chapters when available — used by the partitioner. */
  chapters?: Chapter[]
  /** Total seconds (cached from YouTube `contentDetails.duration`). */
  durationSec?: number
  /** Number of partition parts the user has finished. */
  partsConsumed?: number
  /** Attached reMarkable / local note. */
  note?: RemarkableNoteRef
}

export interface Part {
  itemId: string
  partIdx: number
  partCount: number
  startSec: number
  endSec: number
}

export interface VideoProgress {
  currentSec: number
  durationSec: number
  lastWatchedAt: string
  completed: boolean
}

export interface RmDoc {
  uuid: string
  name: string
  parent: string | null
  type: 'DocumentType' | 'CollectionType'
  lastModified: string
}

export interface RmStatus {
  paired: boolean
  lastSync: string | null
  docCount: number
}

export interface RemarkableState {
  paired: boolean
  lastSyncAt?: string
  rootCache?: RmDoc[]
}

export interface RoutineItem {
  id: string
  videoId: string
  url: string
  title: string
  creator: string
  addedAt: string
}

export interface DayPlan {
  date: string
  mode: Mode
  itemIds: string[]
  freshChannelVideoIds: string[]
  /**
   * Parts for today, in display order. When present, the UI renders from this
   * (one entry per part, may include multiple parts of the same underlying
   * video). When absent (legacy plan), fall back to `itemIds`.
   */
  parts?: Part[]
  /** Daily Entertainment strip: SUN-bucket items capped at ~60 min total.
   * Sticky for the day same as `parts`. Rendered above the main plan. */
  entertainmentParts?: Part[]
  activeCategoryIds?: string[]
}

export interface Course {
  id: string
  playlistId: string
  url: string
  title: string
  creator: string
  bucket: Bucket
  addedAt: string
  order?: PlaylistOrder
  manualOrder?: string[]
  /** Course category id — matches a CourseCategory.id in store.courseCategories.
   * Missing means "uncategorized" — shown in a fallback column on the Kanban. */
  category?: string
  sessionLimit?: number
  /**
   * Set when this Course was built from a single long video rather than a
   * YouTube playlist. The "playlist" is synthetic — its sidebar entries are
   * `parts`, each playing a slice of the same underlying `videoId`.
   */
  singleVideo?: {
    videoId: string
    durationSec: number
    parts: { startSec: number; endSec: number; title: string }[]
  }
}

export interface PlaylistVideo {
  videoId: string
  title: string
  duration?: string
}

export interface Channel {
  id: string
  handle: string
  channelId: string
  name: string
  bucket: Bucket
  category: CategoryId
  addedAt: string
  isPlaylistChannel?: boolean
  playlistId?: string
  playlistVideos?: PlaylistVideo[]
  releasedVideoIds?: string[]
  videosPerWeek?: number
  isExplore?: boolean
}

export interface ChannelFresh {
  channelId: string
  videoId: string
  title: string
  publishedAt: string
  fetchedAt: string
}

export interface FocusConfig {
  focusMinutes: number
  breakMinutes: number
  courseSessionLimit: number
  enabled: boolean
}

export interface DailySessions {
  date: string
  courseSessionsCompleted: number
  totalSessionsCompleted: number
  courseSessionsByCategory?: Record<string, number>
  courseSessionsByCourse?: Record<string, number>
}

export interface GoogleAuth {
  clientId: string
  clientSecret: string
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
}

export interface YouTubeSubscription {
  channelId: string
  name: string
  description: string
  thumbnailUrl: string
}

export interface PersistedStore {
  schemaVersion: number
  mode: Mode
  loop: LoopItem[]
  todayPlan: DayPlan | null
  courses: Course[]
  categoryQuotas: Record<CategoryId, number>
  activeCourseId: string | null
  watched: string[]
  watchedByCourse: Record<string, string[]>
  channels: Channel[]
  channelFresh: Record<string, ChannelFresh>
  focusConfig: FocusConfig
  dailySessions: DailySessions | null
  routine: RoutineItem[]
  routineDoneByDay: Record<string, string[]>
  googleAuth: GoogleAuth
  youtubeApiKey: string
  youtubeApiKeys?: string[]
  sundayLimit: number
  playlistVideosCache: Record<string, { videos: PlaylistVideo[]; fetchedAt: string }>
  youtubeSubscriptionsCache: { subs: YouTubeSubscription[]; fetchedAt: string } | null
  categories: Category[]
  sundayChannelWeekly: Record<string, ChannelWeekly>
  /** Per-video resume state keyed by YouTube videoId. */
  progress: Record<string, VideoProgress>
  /** Target part length for partitioning long videos, in minutes. */
  sliceTargetMin: number
  /** Sunday total duration cap in minutes (mirrors weekday per-cat budgets). */
  sundayMinutes: number
  /** Weekday total duration cap in minutes. */
  weekdayMinutes: number
  /** Videos auto-detected as YouTube Shorts and pulled out of the loop. */
  shortsQuarantine: LoopItem[]
  /** reMarkable cloud pairing state + last fetched document tree. */
  remarkable: RemarkableState
  /** Videos watched this week. Cleared every Monday. */
  done: { weekStart: string; items: LoopItem[] }
  /** ISO timestamp of last full day-rollover sync, used to detect new-day boot. */
  lastRefreshAt?: string
  /** Notes attached to playlist videos, keyed by `${courseId}:${videoId}`. */
  playlistNotes: Record<string, PlaylistNote>
  /** User-defined course categories for the Kanban board. */
  courseCategories: CourseCategory[]
  /** Per-category active course — keyed by CourseCategory.id, value is Course.id. */
  activeCourseByCategory: Record<string, string>
  /** "Would like to watch eventually" — videos parked outside the daily
   * rotation. Promoted to loop with one click from the Wishlist screen. */
  wishlist: LoopItem[]
  /** Videos selected for Today's plan that were not watched. Fallback pool. */
  delayedLoop?: LoopItem[]
  /** Soft-deleted videos & courses. Auto-purged after 30 days; user can
   * restore or purge earlier from Settings → Trash. */
  trash?: TrashEntry[]
  /** Mid-video bookmarks keyed by videoId+sec. */
  bookmarks?: Bookmark[]
  /** Per-course streak state — updated when a course part is marked done. */
  courseStreaks?: Record<string, CourseStreak>
  /** Captured ideas. Grows unbounded; UI filters by createdDate/kind. */
  sparks?: Spark[]
  exploreTopics?: ExploreTopic[]
  interests?: InterestItem[]
  dailySynthesis?: Record<string, DailySynthesis>
  geminiApiKey?: string
  ollamaUrl?: string
  ollamaModel?: string
  feedMemoryProfile?: string
  feedRatings?: FeedRating[]
  dismissedFeedVideoIds?: string[]
  appSuggestions?: string
}

export interface FeedRating {
  videoId: string
  title: string
  creator: string
  rating: 'love' | 'hate'
  transcriptSnippet: string
  timestamp: string
}

export interface TrashEntry {
  /** ISO timestamp of soft-delete. */
  deletedAt: string
  /** What was deleted — original object stored verbatim for restore. */
  kind: 'video' | 'course'
  video?: LoopItem
  course?: Course
}

export interface Bookmark {
  id: string
  videoId: string
  itemId?: string
  videoTitle: string
  sec: number
  note: string
  createdAt: string
}

export interface CourseStreak {
  lastWatchedDate: string
  currentStreak: number
  longestStreak: number
}

export interface PlaylistNotePageMapping {
  pageIdx: number
  startSec: number
}

export interface PlaylistNote {
  courseId: string
  videoId: string
  videoTitle: string
  courseTitle: string
  watchedAt: string | null
  note: RemarkableNoteRef
  pageMappings?: PlaylistNotePageMapping[]
}

export interface FetchedMeta {
  title: string
  author: string
  thumbnail: string
  duration?: string
  durationSec?: number
  description?: string
  chapters?: Chapter[]
}

export interface TranscriptCue {
  startSec: number
  text: string
}

export interface ChannelLookup {
  channelId: string
  name: string
}

export interface ChannelLatest {
  channelId: string
  videoId: string
  title: string
  publishedAt: string
}

export interface ChannelRecentVideo {
  videoId: string
  title: string
  publishedAt: string
}

export interface ChannelWeekly {
  channelId: string
  weekStart: string // ISO date of the Monday 00:00 we fetched against
  fetchedAt: string
  videos: ChannelRecentVideo[]
}

export interface GoogleDeviceCode {
  deviceCode: string
  userCode: string
  verificationUrl: string
  interval: number
  expiresIn: number
}

export interface GoogleTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export type GooglePollResult =
  | { status: 'ok'; tokens: GoogleTokenResponse }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'error'; message: string }

export type Screen = 'today' | 'player' | 'courses' | 'courseFocus' | 'routine' | 'settings' | 'notes' | 'wishlist' | 'entertainment' | 'noteStudy' | 'sparks' | 'feed' | 'search'

// ============ Sparks (ideation) ============
// Data shape mirrors Ember's `brainState.ideas[]` schema so a future sync layer
// only has to prefix-rewrite ids (`sprk_` ⇄ `idea-`). New fields go at the
// bottom so older stores stay readable.

export type SparkKind = 'problem' | 'idea' | 'question' | 'realization' | 'solution'

export interface SparkKindMeta {
  label: string
  glyph: string
  color: string
  bg: string
  text: string
}

export interface Spark {
  /** `sprk_<epoch>_<rand>` — Ember uses `idea-<epoch>`, sync layer rewrites. */
  id: string
  /** One-sentence essence. Ember auto-shortens via AI; we keep user-typed. */
  title: string
  /** Free-form long-form text. Ember stores the raw user input here. */
  description: string
  kind: SparkKind | ''
  /** Reuses H&C category ids. Ember's `sectionId` maps here through sync. */
  category: CategoryId | ''
  tags: string[]
  /** ISO timestamp of capture. */
  createdAt: string
  /** YYYY-MM-DD, cheap to filter by day without reparsing. */
  createdDate: string
  /** VideoId being watched at capture-time (if any). */
  sourceVideoId?: string
  /** Ember lifecycle status. */
  status?: 'seed' | 'sprouting' | 'mature'
  /** Ember uses -1 for unset. Kept for future sync fidelity. */
  confidence?: number
  messageCount?: number
  topOfMind?: boolean
  /** Empty in H&C, non-empty when Ember sync attaches to a project. */
  projectId?: string
  /** Kept empty in H&C — Ember's cross-section grouping. */
  sectionId?: string
  notes?: string
  topic?: string
  starred?: boolean
  srs?: { reps: number; ease: number; interval: number; dueAt: string }
}


export interface ExploreTopic {
  id: string
  text: string
  addedAt: string
  fetchCount?: number
  oceanLastFetchedDate?: string
  pitch?: string
  pitchedAt?: string
}

export interface InterestItem {
  id: string
  name: string
  addedAt: string
  pareto?: string
  paretoGeneratedAt?: string
}

export interface DailySynthesis {
  text: string
  generatedAt: string
  sparkIds: string[]
}

declare global {
  interface Window {
    hearth: {
      getStore: () => Promise<PersistedStore>
      setStore: (next: PersistedStore) => Promise<boolean>
      fetchVideoMeta: (videoId: string) => Promise<FetchedMeta | null>
      fetchVideoTranscript: (videoId: string) => Promise<TranscriptCue[]>
      fetchPlaylistMeta: (playlistId: string) => Promise<FetchedMeta | null>
      fetchPlaylistVideos: (playlistId: string) => Promise<PlaylistVideo[]>
      resolveChannel: (handle: string) => Promise<ChannelLookup | null>
      fetchChannelLatest: (channelId: string) => Promise<ChannelLatest | null>
      fetchChannelRecent: (channelId: string, sinceIso: string) => Promise<ChannelRecentVideo[]>
      googleStartDeviceFlow: (clientId: string) => Promise<GoogleDeviceCode | null>
      googlePollToken: (
        clientId: string,
        clientSecret: string,
        deviceCode: string
      ) => Promise<GooglePollResult>
      googleRefreshToken: (
        clientId: string,
        clientSecret: string,
        refreshToken: string
      ) => Promise<GoogleTokenResponse | null>
      youtubeListSubscriptions: (accessToken: string) => Promise<YouTubeSubscription[]>
      rmPair: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>
      rmUnpair: () => Promise<boolean>
      rmStatus: () => Promise<RmStatus>
      rmListDocs: (forceRefresh?: boolean) => Promise<RmDoc[]>
      rmDocMeta: (uuid: string) => Promise<RmDoc | null>
      pickNoteFile: () => Promise<string | null>
      rmDiagnose: () => Promise<string>
      openInBrowser: (url: string) => Promise<void>
      setApiKey: (key: string) => void
      setApiKeys: (keys: string[]) => void
      windowMinimize: () => void
      windowMaximize: () => void
      windowClose: () => void
      searchYoutubeVideos: (query: string) => Promise<ChannelRecentVideo[]>
      callGeminiApi: (apiKey: string, model: string, prompt: string) => Promise<string>
      callOllamaApi: (endpoint: string, model: string, prompt: string, formatJson: boolean) => Promise<string>
    }
  }
}
