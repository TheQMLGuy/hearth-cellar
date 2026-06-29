import { useEffect, useState } from 'react'

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
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds)
  const [frame, setFrame] = useState(0)
  const [exerciseIdx, setExerciseIdx] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id)
          onComplete()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [onComplete])

  useEffect(() => {
    const id = window.setInterval(() => setFrame((f) => f + 1), 50)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    // Rotate exercise every ~90 sec (or every total/4 if break is short)
    const slot = Math.max(60, Math.floor(totalSeconds / EXERCISES.length))
    const elapsed = totalSeconds - secondsLeft
    const next = Math.min(EXERCISES.length - 1, Math.floor(elapsed / slot))
    setExerciseIdx(next)
  }, [secondsLeft, totalSeconds])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const exercise = EXERCISES[exerciseIdx]

  return (
    <div className="break-overlay">
      <div className="break-inner">
        <div className="break-eyebrow">Focus session complete</div>
        <h1 className="break-h1">
          Step away. <em>Breathe.</em>
        </h1>
        <div className="break-clock">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>

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

        <div className="break-hydrate">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v6m0 0c-3 0-7 3-7 8a7 7 0 0014 0c0-5-4-8-7-8z" />
          </svg>
          <span>Sip water. Your brain is mostly water.</span>
        </div>

        <button className="break-skip" onClick={onSkip}>
          Skip break →
        </button>
      </div>
    </div>
  )
}
