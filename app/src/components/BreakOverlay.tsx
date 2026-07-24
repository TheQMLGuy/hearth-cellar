import { useEffect, useState, useRef } from 'react'

interface Props {
  totalSeconds: number
  onSkip: () => void
  onComplete: () => void
}

const EXERCISES: { title: string; cue: string; svg: (frame: number) => JSX.Element }[] = [
  {
    title: 'Shoulder rolls',
    cue: 'Slow circles, both shoulders, both directions.',
    svg: (frame) => {
      // Stick figure rolling shoulders up/down based on frame
      const yOffset = Math.sin((frame * Math.PI) / 30) * 4
      return (
        <g>
          {/* head */}
          <circle cx="100" cy={40 + yOffset} r="14" fill="none" stroke="currentColor" strokeWidth="2" />
          {/* body */}
          <line x1="100" y1={54 + yOffset} x2="100" y2="120" stroke="currentColor" strokeWidth="2" />
          {/* arms — shoulder roll up */}
          <line x1="100" y1={62 + yOffset} x2={70 + yOffset} y2={82 - yOffset} stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1={62 + yOffset} x2={130 - yOffset} y2={82 - yOffset} stroke="currentColor" strokeWidth="2" />
          {/* legs */}
          <line x1="100" y1="120" x2="84" y2="170" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="120" x2="116" y2="170" stroke="currentColor" strokeWidth="2" />
        </g>
      )
    }
  },
  {
    title: 'Stand up & stretch',
    cue: 'Reach for the ceiling. Hold for 10. Repeat.',
    svg: (frame) => {
      // arms going up and down
      const t = (frame % 60) / 60
      const armY = 82 - Math.sin(t * Math.PI) * 40
      return (
        <g>
          <circle cx="100" cy="40" r="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="54" x2="100" y2="120" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="62" x2="70" y2={armY} stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="62" x2="130" y2={armY} stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="120" x2="84" y2="170" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="120" x2="116" y2="170" stroke="currentColor" strokeWidth="2" />
        </g>
      )
    }
  },
  {
    title: 'Neck side-bends',
    cue: 'Ear toward shoulder, alternating, slow.',
    svg: (frame) => {
      const sway = Math.sin((frame * Math.PI) / 40) * 10
      return (
        <g>
          <circle cx={100 + sway} cy={40} r="14" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1={100 + sway * 0.4} y1="54" x2="100" y2="120" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="70" x2="70" y2="100" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="70" x2="130" y2="100" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="120" x2="84" y2="170" stroke="currentColor" strokeWidth="2" />
          <line x1="100" y1="120" x2="116" y2="170" stroke="currentColor" strokeWidth="2" />
        </g>
      )
    }
  },
  {
    title: 'Look away from the screen',
    cue: '20 feet away, 20 seconds. Let your eyes rest.',
    svg: (frame) => {
      const blink = Math.sin((frame * Math.PI) / 25) > 0.6
      return (
        <g>
          <circle cx="100" cy="50" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
          {/* eyes */}
          {blink ? (
            <>
              <line x1="91" y1="48" x2="97" y2="48" stroke="currentColor" strokeWidth="2" />
              <line x1="103" y1="48" x2="109" y2="48" stroke="currentColor" strokeWidth="2" />
            </>
          ) : (
            <>
              <circle cx="94" cy="48" r="2" fill="currentColor" />
              <circle cx="106" cy="48" r="2" fill="currentColor" />
            </>
          )}
          {/* smile */}
          <path d="M 92 58 Q 100 64 108 58" fill="none" stroke="currentColor" strokeWidth="2" />
        </g>
      )
    }
  }
]

export function BreakOverlay({ totalSeconds, onSkip, onComplete }: Props) {
  const [phase, setPhase] = useState<'stretch_video' | 'eye_video' | 'stretch'>('stretch_video')
  const [playbackRate, setPlaybackRate] = useState(1.5)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoProgress, setVideoProgress] = useState(0)
  const [stretchSecondsLeft, setStretchSecondsLeft] = useState(120)
  const [frame, setFrame] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideo = phase === 'stretch_video' || phase === 'eye_video'

  // Autoplay/playback rate sync effect
  useEffect(() => {
    if (isVideo && videoRef.current) {
      videoRef.current.playbackRate = playbackRate
      videoRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.log("Autoplay blocked:", err)
          setIsPlaying(false)
        })
    }
  }, [phase, playbackRate, isVideo])

  // Timer for Phase 3: Stretching & Hydration
  useEffect(() => {
    if (phase !== 'stretch') return
    const id = window.setInterval(() => {
      setStretchSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          onComplete()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [phase, onComplete])

  // Stick figure frame animation tick
  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => f + 1), 50)
    return () => window.clearInterval(id)
  }, [])

  // Video controls
  const togglePlay = () => {
    if (!videoRef.current) return
    if (isPlaying) {
      videoRef.current.pause()
      setIsPlaying(false)
    } else {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !isMuted
    setIsMuted(!isMuted)
  }

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed)
    if (videoRef.current) {
      videoRef.current.playbackRate = speed
    }
  }

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value)
    setVideoProgress(time)
    if (videoRef.current) {
      videoRef.current.currentTime = time
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${String(s).padStart(2, '0')}`
  }

  // Calculate remaining real-time
  let mins = 0
  let secs = 0
  if (isVideo) {
    const currentVideoDur = videoDuration || (phase === 'stretch_video' ? 300 : 307)
    let remainingSec = Math.max(0, Math.ceil((currentVideoDur - videoProgress) / playbackRate))
    if (phase === 'stretch_video') {
      remainingSec += Math.ceil(307 / playbackRate) // Add eye video estimate
    }
    remainingSec += 120 // Add final hydration stretch
    mins = Math.floor(remainingSec / 60)
    secs = remainingSec % 60
  } else {
    mins = Math.floor(stretchSecondsLeft / 60)
    secs = stretchSecondsLeft % 60
  }

  // 120 seconds divided by 4 exercises = 30 seconds each
  const exerciseIdx = Math.min(
    EXERCISES.length - 1,
    Math.floor((120 - stretchSecondsLeft) / 30)
  )
  const exercise = EXERCISES[exerciseIdx]

  return (
    <div className="break-overlay">
      <div className="break-inner" style={{ maxWidth: isVideo ? '640px' : '520px' }}>
        <div className="break-eyebrow">
          {phase === 'stretch_video' && 'Phase 1: Full Body Stretch'}
          {phase === 'eye_video' && 'Phase 2: Eye Exercises'}
          {phase === 'stretch' && 'Phase 3: Stretch & Hydrate'}
        </div>

        {/* Phase Progress Indicator */}
        <div className="break-phases">
          <div className={`break-phase-step ${phase === 'stretch_video' ? 'active' : ''} ${phase === 'eye_video' || phase === 'stretch' ? 'completed' : ''}`}>
            <div className="break-phase-dot" />
            <span>Full Stretch</span>
          </div>
          <div className={`break-phase-line ${phase === 'eye_video' || phase === 'stretch' ? 'active completed' : ''}`} />
          <div className={`break-phase-step ${phase === 'eye_video' ? 'active' : ''} ${phase === 'stretch' ? 'completed' : ''}`}>
            <div className="break-phase-dot" />
            <span>Eye Refresh</span>
          </div>
          <div className={`break-phase-line ${phase === 'stretch' ? 'active completed' : ''}`} />
          <div className={`break-phase-step ${phase === 'stretch' ? 'active' : ''}`}>
            <div className="break-phase-dot" />
            <span>Hydrate</span>
          </div>
        </div>

        <h1 className="break-h1">
          {phase === 'stretch_video' && <>Stretch your <em>body.</em></>}
          {phase === 'eye_video' && <>Refresh your <em>eyes.</em></>}
          {phase === 'stretch' && <>Step away. <em>Breathe.</em></>}
        </h1>

        <div className="break-clock">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

        {isVideo ? (
          <div className="break-video-card">
            <div className="break-video-wrapper">
              <video
                key={phase === 'stretch_video' ? 'stretch' : 'eye'}
                ref={videoRef}
                src={phase === 'stretch_video' ? '/stretch_video.mp4' : '/break_video.mp4'}
                className="break-video-element"
                autoPlay
                playsInline
                onTimeUpdate={() => {
                  if (videoRef.current) setVideoProgress(videoRef.current.currentTime)
                }}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setVideoDuration(videoRef.current.duration)
                    videoRef.current.playbackRate = playbackRate
                  }
                }}
                onEnded={() => setPhase(phase === 'stretch_video' ? 'eye_video' : 'stretch')}
              />
            </div>
            
            <div className="break-video-controls">
              {/* Scrubber slider row */}
              <div className="video-control-row">
                <div className="video-progress-bar-container">
                  <input
                    type="range"
                    min={0}
                    max={videoDuration || (phase === 'stretch_video' ? 300 : 307)}
                    step={0.1}
                    value={videoProgress}
                    onChange={handleScrub}
                    className="video-progress-slider"
                  />
                </div>
                <div className="video-time-display">
                  {formatTime(videoProgress)} / {formatTime(videoDuration || (phase === 'stretch_video' ? 300 : 307))}
                </div>
              </div>
              
              {/* Buttons control row */}
              <div className="video-control-row">
                <div className="video-control-left">
                  <button className="video-btn video-btn-primary" onClick={togglePlay}>
                    {isPlaying ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                        Pause
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                        Play
                      </>
                    )}
                  </button>
                  
                  <button className="video-btn" onClick={toggleMute}>
                    {isMuted ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6"/>
                        </svg>
                        Unmute
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                        </svg>
                        Mute
                      </>
                    )}
                  </button>
                </div>
                
                <div className="video-control-right">
                  <span style={{ fontSize: 12, color: 'oklch(0.65 0.02 50)', fontFamily: 'var(--sans)' }}>Speed:</span>
                  {[1.0, 1.25, 1.5, 1.75].map((speed) => (
                    <button
                      key={speed}
                      className={`video-speed-pill ${playbackRate === speed ? 'active' : ''}`}
                      onClick={() => handleSpeedChange(speed)}
                    >
                      {speed === 1.5 ? '1.5x Auto' : `${speed}x`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="break-card">
            <div className="break-figure" aria-hidden>
              <svg viewBox="0 0 200 200" width="180" height="180">
                {exercise.svg(frame)}
              </svg>
            </div>
            <div className="break-cue">
              <div className="break-cue-title">{exercise.title}</div>
              <div className="break-cue-body">{exercise.cue}</div>
            </div>
          </div>
        )}

        <div className="break-hydrate">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v6m0 0c-3 0-7 3-7 8a7 7 0 0014 0c0-5-4-8-7-8z" />
          </svg>
          <span>
            {phase === 'stretch_video' && "Loosen tight muscles in your back and hips. Focus on your breathing."}
            {phase === 'eye_video' && "Follow along with the eye movements to refresh your vision."}
            {phase === 'stretch' && "Sip water. Your brain is mostly water."}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {phase === 'stretch_video' && (
            <>
              <button className="break-skip" onClick={() => setPhase('eye_video')}>
                Skip Stretch Video →
              </button>
              <button className="break-skip" onClick={onSkip} style={{ opacity: 0.7 }}>
                Skip Break ✕
              </button>
            </>
          )}
          {phase === 'eye_video' && (
            <>
              <button className="break-skip" onClick={() => setPhase('stretch')}>
                Skip Eye Exercises →
              </button>
              <button className="break-skip" onClick={onSkip} style={{ opacity: 0.7 }}>
                Skip Break ✕
              </button>
            </>
          )}
          {phase === 'stretch' && (
            <button className="break-skip" onClick={onSkip}>
              Skip Hydration →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
