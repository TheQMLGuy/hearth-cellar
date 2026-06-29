interface Props {
  area: 'Courses' | 'Vault' | 'Settings'
  onBack: () => void
}

const COPY: Record<Props['area'], { eyebrow: string; title: string; body: string }> = {
  Courses: {
    eyebrow: 'Learning',
    title: 'Your Courses arrive in v2',
    body:
      'Paste a YouTube playlist URL and we will queue it for focused study. v1 keeps you on the daily ritual; v2 layers structured paths on top.'
  },
  Vault: {
    eyebrow: 'Keepsake',
    title: 'The Vault arrives in v2',
    body:
      'A quiet shelf for the videos that change you. v1 keeps every ingest in the loop; v2 adds the favorites you want to find again.'
  },
  Settings: {
    eyebrow: 'Configure',
    title: 'Settings arrive in v2',
    body:
      'Categories, daily quotas, channel whitelists. v1 ships with thoughtful defaults so you can begin the ritual today.'
  }
}

export function ComingSoon({ area, onBack }: Props) {
  const c = COPY[area]
  return (
    <div className="coming-soon">
      <div className="coming-soon-card">
        <div className="eyebrow">{c.eyebrow}</div>
        <h2>{c.title}</h2>
        <p>{c.body}</p>
        <button onClick={onBack}>← Back to Today</button>
      </div>
    </div>
  )
}
