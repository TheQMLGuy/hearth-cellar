import type { Mode, Screen } from '../types'

interface Props {
  mode: Mode
  screen: Screen
  onSetMode: (m: Mode) => void
  onToggleIngest: () => void
  onGoToday: () => void
  onGoCourses: () => void
  onGoRoutine: () => void
  onGoSettings: () => void
  onGoNotes: () => void
  onGoWishlist: () => void
  onGoEntertainment: () => void
  onGoSparks: () => void
  onGoFeed: () => void
  onGoSearch: () => void
}

export function Titlebar(props: Props) {
  const { mode, screen, onToggleIngest, onGoToday, onGoCourses, onGoRoutine, onGoSettings, onGoNotes, onGoWishlist, onGoEntertainment, onGoSparks, onGoFeed, onGoSearch } = props
  void mode
  const inCourses = screen === 'courses' || screen === 'courseFocus'
  const inRoutine = screen === 'routine'
  const inSettings = screen === 'settings'
  const inNotes = screen === 'notes'
  const inWishlist = screen === 'wishlist'
  const inEntertainment = screen === 'entertainment'
  const inSparks = screen === 'sparks'
  const inToday = screen === 'today'
  const inFeed = screen === 'feed'
  const inSearch = screen === 'search'

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar-left" data-tauri-drag-region="false">
        <button
          className="ingest-btn"
          title="Ingest a video or playlist (Ctrl+I)"
          onClick={onToggleIngest}
          aria-label="Ingest"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="titlebar-center" data-tauri-drag-region="false">
        <button onClick={onGoToday} title="Today" className="brand-btn">
          Hearth <em>&amp;</em> Cellar
        </button>
        <div className="unified-toggle">
          <button
            className={inToday ? 'seg active' : 'seg'}
            onClick={onGoToday}
          >
            Today
          </button>
          <button
            className={inRoutine ? 'seg active' : 'seg'}
            onClick={onGoRoutine}
          >
            Routine
          </button>
          <button
            className={inFeed ? 'seg active' : 'seg'}
            onClick={onGoFeed}
          >
            Feed
          </button>
          <button
            className={inSearch ? 'seg active' : 'seg'}
            onClick={onGoSearch}
          >
            Search
          </button>
          <button
            className={inCourses ? 'seg active' : 'seg'}
            onClick={onGoCourses}
          >
            Courses
          </button>
          <button
            className={inEntertainment ? 'seg active' : 'seg'}
            onClick={onGoEntertainment}
          >
            Entertainment
          </button>
          <button
            className={inNotes ? 'seg active' : 'seg'}
            onClick={onGoNotes}
          >
            Notes
          </button>
          <button
            className={inSparks ? 'seg active' : 'seg'}
            onClick={onGoSparks}
            title="Sparks — capture ideas (Ctrl+S)"
          >
            Sparks
          </button>
          <button
            className={inWishlist ? 'seg active' : 'seg'}
            onClick={onGoWishlist}
          >
            Wishlist
          </button>
          <button
            className={inSettings ? 'seg active' : 'seg'}
            onClick={onGoSettings}
          >
            Settings
          </button>
        </div>
      </div>

      <div className="titlebar-right" data-tauri-drag-region="false">
        <div className="win-controls bare">
          <button className="win-ctrl" title="Minimize" aria-label="Minimize" onClick={() => window.hearth.windowMinimize()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" strokeWidth="1" /></svg>
          </button>
          <button className="win-ctrl" title="Maximize" aria-label="Maximize" onClick={() => window.hearth.windowMaximize()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
          </button>
          <button className="win-ctrl close" title="Close" aria-label="Close" onClick={() => window.hearth.windowClose()}>
            <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
