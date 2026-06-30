import { useEffect, useRef, useState } from 'react'
import type { Bucket, Category, CategoryId, Channel, GoogleAuth, GoogleDeviceCode, YouTubeSubscription } from '../types'
import { newId } from '../lib/ids'

interface Props {
  googleAuth: GoogleAuth
  existingChannelIds: Set<string>
  cachedSubs: YouTubeSubscription[] | null
  cachedSubsFetchedAt: string | null
  categories: Category[]
  onUpdateGoogleAuth: (next: GoogleAuth) => void
  onImportChannels: (channels: Channel[]) => void
  onSubsFetched: (subs: YouTubeSubscription[]) => void
}

type Flow = 'idle' | 'awaiting' | 'authed' | 'fetching' | 'picking'

interface Selected {
  category: CategoryId
  bucket: Bucket
}

export function GoogleTab({
  googleAuth,
  existingChannelIds,
  cachedSubs,
  cachedSubsFetchedAt,
  categories,
  onUpdateGoogleAuth,
  onImportChannels,
  onSubsFetched
}: Props) {
  const defaultCatId = categories[0]?.id ?? 'curiosity'
  const [clientId, setClientId] = useState(googleAuth.clientId)
  const [clientSecret, setClientSecret] = useState(googleAuth.clientSecret)
  // If we have cached subscriptions and we're signed in, jump straight into picking.
  const initialFlow: Flow =
    googleAuth.refreshToken && cachedSubs && cachedSubs.length > 0
      ? 'picking'
      : googleAuth.refreshToken
      ? 'authed'
      : 'idle'
  const [flow, setFlow] = useState<Flow>(initialFlow)
  const [device, setDevice] = useState<GoogleDeviceCode | null>(null)
  const [pollError, setPollError] = useState('')
  const [subs, setSubs] = useState<YouTubeSubscription[]>(cachedSubs ?? [])
  const [selected, setSelected] = useState<Record<string, Selected | null>>({})
  const pollRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current)
    }
  }, [])

  function saveCredentials() {
    onUpdateGoogleAuth({ ...googleAuth, clientId: clientId.trim(), clientSecret: clientSecret.trim() })
  }

  async function startSignIn() {
    setPollError('')
    if (!clientId.trim() || !clientSecret.trim()) {
      setPollError('Save your client ID and client secret first.')
      return
    }
    const code = await window.hearth.googleStartDeviceFlow(clientId.trim())
    if (!code) {
      setPollError("Couldn't start sign-in. Check the client ID and your network.")
      return
    }
    setDevice(code)
    setFlow('awaiting')

    if (pollRef.current) window.clearInterval(pollRef.current)
    pollRef.current = window.setInterval(async () => {
      const result = await window.hearth.googlePollToken(
        clientId.trim(),
        clientSecret.trim(),
        code.deviceCode
      )
      if (result.status === 'ok') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        const expiresAt = new Date(Date.now() + result.tokens.expiresIn * 1000).toISOString()
        onUpdateGoogleAuth({
          ...googleAuth,
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresAt
        })
        setDevice(null)
        setFlow('authed')
      } else if (result.status === 'pending' || result.status === 'slow_down') {
        // keep polling
      } else if (result.status === 'expired') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        setPollError('The sign-in code expired. Try again.')
        setFlow('idle')
        setDevice(null)
      } else if (result.status === 'denied') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        setPollError('You denied the request.')
        setFlow('idle')
        setDevice(null)
      } else if (result.status === 'error') {
        if (pollRef.current) window.clearInterval(pollRef.current)
        setPollError(result.message || 'Sign-in failed.')
        setFlow('idle')
        setDevice(null)
      }
    }, Math.max(2, code.interval) * 1000)
  }

  function signOut() {
    if (pollRef.current) window.clearInterval(pollRef.current)
    onUpdateGoogleAuth({ ...googleAuth, accessToken: null, refreshToken: null, expiresAt: null })
    onSubsFetched([])
    setFlow('idle')
    setSubs([])
    setSelected({})
  }

  async function ensureFreshToken(): Promise<string | null> {
    if (!googleAuth.refreshToken) return null
    const exp = googleAuth.expiresAt ? Date.parse(googleAuth.expiresAt) : 0
    if (googleAuth.accessToken && exp > Date.now() + 30000) {
      return googleAuth.accessToken
    }
    const refreshed = await window.hearth.googleRefreshToken(
      googleAuth.clientId,
      googleAuth.clientSecret,
      googleAuth.refreshToken
    )
    if (!refreshed) return null
    const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString()
    onUpdateGoogleAuth({
      ...googleAuth,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      expiresAt
    })
    return refreshed.accessToken
  }

  async function fetchSubs() {
    setFlow('fetching')
    const token = await ensureFreshToken()
    if (!token) {
      setPollError("Couldn't refresh your Google token. Sign in again.")
      setFlow('authed')
      return
    }
    const list = await window.hearth.youtubeListSubscriptions(token)
    setSubs(list)
    onSubsFetched(list)
    // Default: no channels selected. User opts in per channel.
    setSelected({})
    setFlow('picking')
  }

  function toggleSelect(channelId: string) {
    setSelected((prev) => {
      const cur = prev[channelId]
      return { ...prev, [channelId]: cur ? null : { category: defaultCatId, bucket: 'WKDY' } }
    })
  }

  function updateSelect(channelId: string, patch: Partial<Selected>) {
    setSelected((prev) => {
      const cur = prev[channelId]
      if (!cur) return prev
      return { ...prev, [channelId]: { ...cur, ...patch } }
    })
  }

  function importPicked() {
    const channels: Channel[] = []
    for (const sub of subs) {
      const sel = selected[sub.channelId]
      if (!sel) continue
      if (existingChannelIds.has(sub.channelId)) continue
      channels.push({
        id: newId('chn_'),
        handle: '',
        channelId: sub.channelId,
        name: sub.name,
        bucket: sel.bucket,
        category: sel.category,
        addedAt: new Date().toISOString()
      })
    }
    onImportChannels(channels)
    // Stay on the picker — the imported ones now show "already added" and
    // the user can keep nitpicking more. They can hit Cancel to leave.
    setSelected({})
  }

  const pickedCount = Object.values(selected).filter(Boolean).length

  return (
    <div className="settings-pane">
      <p className="page-lede" style={{ margin: '0 0 16px' }}>
        Sign in once with your YouTube account, then import your subscriptions as channels — pick a category and bucket for each.
      </p>

      <div className="google-creds">
        <div className="cred-row">
          <label>Client ID</label>
          <input
            type="text"
            className="ingest-input text"
            placeholder="123456789-abc.apps.googleusercontent.com"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />
        </div>
        <div className="cred-row">
          <label>Client Secret</label>
          <input
            type="password"
            className="ingest-input text"
            placeholder="GOCSPX-..."
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="set-active-btn" onClick={saveCredentials}>Save credentials</button>
        </div>
        <p className="page-lede" style={{ fontSize: 12, marginTop: 8 }}>
          Get these from <span className="mono-soft">console.cloud.google.com</span> → APIs &amp; Services → Credentials → Create OAuth client (type: <em>TVs and Limited Input devices</em>). Enable the YouTube Data API v3 in the same project.
        </p>
      </div>

      <hr className="hr-soft" />

      {flow === 'idle' && (
        <div style={{ marginTop: 12 }}>
          <button
            className="ingest-save"
            disabled={!googleAuth.clientId || !googleAuth.clientSecret}
            onClick={startSignIn}
          >
            Sign in with Google
          </button>
          {pollError && <div className="ingest-hint" style={{ color: 'oklch(0.55 0.15 25)', marginTop: 8 }}>{pollError}</div>}
        </div>
      )}

      {flow === 'awaiting' && device && (
        <div className="device-card">
          <div className="device-eyebrow">Almost there</div>
          <p>Open this URL in your browser:</p>
          <a className="device-link" href={device.verificationUrl} target="_blank" rel="noreferrer">
            {device.verificationUrl}
          </a>
          <p style={{ marginTop: 14 }}>and enter this code:</p>
          <div className="device-code">{device.userCode}</div>
          <p className="device-fineprint">Waiting for you to finish… we'll detect it automatically.</p>
        </div>
      )}

      {flow === 'authed' && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="signed-in-pill">✓ Signed in</span>
          <button className="ingest-save" onClick={fetchSubs}>Import subscriptions</button>
          <button className="set-active-btn" onClick={signOut}>Sign out</button>
        </div>
      )}

      {flow === 'fetching' && (
        <div style={{ marginTop: 16, fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-faint)' }}>
          Fetching your subscriptions…
        </div>
      )}

      {flow === 'picking' && (
        <div className="subs-picker">
          <div className="subs-head">
            <h3>Pick channels to import</h3>
            <span>{pickedCount} of {subs.length} selected</span>
          </div>
          {cachedSubsFetchedAt && (
            <div className="subs-cache-note">
              <span>Cached from {new Date(cachedSubsFetchedAt).toLocaleString()}</span>
              <button className="set-active-btn" onClick={fetchSubs}>Refresh</button>
            </div>
          )}
          {!cachedSubsFetchedAt && subs.length > 0 && (
            <div className="subs-cache-note">
              <span>Just fetched</span>
              <button className="set-active-btn" onClick={fetchSubs}>Refresh</button>
            </div>
          )}
          <div className="subs-list">
            {subs.map((sub) => {
              const sel = selected[sub.channelId]
              const already = existingChannelIds.has(sub.channelId)
              return (
                <div key={sub.channelId} className={`sub-row${already ? ' disabled' : ''}`}>
                  <input
                    type="checkbox"
                    checked={!!sel}
                    disabled={already}
                    onChange={() => toggleSelect(sub.channelId)}
                  />
                  {sub.thumbnailUrl && <img src={sub.thumbnailUrl} alt="" className="sub-thumb" />}
                  <div className="sub-body">
                    <div className="sub-name">{sub.name}</div>
                    {already && <div className="sub-note">already added</div>}
                  </div>
                  {sel && (
                    <>
                      <select
                        className="cat-select"
                        value={sel.category}
                        onChange={(e) => updateSelect(sub.channelId, { category: e.target.value as CategoryId })}
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <div className="bucket-pill small">
                        <button className={sel.bucket === 'WKDY' ? 'active' : ''} onClick={() => updateSelect(sub.channelId, { bucket: 'WKDY' })} title="Spark — main Today plan">SPARK</button>
                        <button className={sel.bucket === 'SUN' ? 'active' : ''} onClick={() => updateSelect(sub.channelId, { bucket: 'SUN' })} title="Entertainment — daily 60m strip">ENT</button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="subs-actions">
            <button className="set-active-btn" onClick={() => setFlow('authed')}>Cancel</button>
            <button className="ingest-save" disabled={pickedCount === 0} onClick={importPicked}>
              Import {pickedCount} {pickedCount === 1 ? 'channel' : 'channels'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
