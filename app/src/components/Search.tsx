import React, { useState, useMemo } from 'react'
import type { PersistedStore, LoopItem, FeedRating } from '../types'
import { newId } from '../lib/ids'

interface Props {
  store: PersistedStore
  onUpdateStore: (next: PersistedStore) => void
  onOpenVideo: (item: LoopItem) => void
  onBack: () => void
}

interface CandidateVideo {
  videoId: string
  title: string
  creator: string
  publishedAt: string
  liked?: boolean
  reason?: string
  transcriptSnippet?: string
  rating?: 'love' | 'hate' // temporary local rating
}

type Step = 'idle' | 'searching' | 'filtering' | 'transcripts' | 'personalizing' | 'done' | 'error'

export function Search({ store, onUpdateStore, onOpenVideo, onBack }: Props) {
  const [topic, setTopic] = useState('')
  const [preferenceText, setPreferenceText] = useState('')
  const [preferenceUpdating, setPreferenceUpdating] = useState(false)
  const [preferenceDone, setPreferenceDone] = useState(false)

  const [step, setStep] = useState<Step>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [results, setResults] = useState<CandidateVideo[]>([])

  const hasKeys = !!store.youtubeApiKey && !!store.geminiApiKey

  const handleUpdatePreference = async () => {
    const text = preferenceText.trim()
    if (!text) return
    const ollamaUrl = store.ollamaUrl
    const ollamaModel = store.ollamaModel
    if (!ollamaUrl || !ollamaModel) {
      alert('Please configure Ollama Endpoint and Model in Settings → AI first.')
      return
    }

    setPreferenceUpdating(true)
    setPreferenceDone(false)

    try {
      const prompt = `You are the Memory Module for a personalized recommendation system.
Current Taste Profile:
"${store.feedMemoryProfile || 'The user\'s preferences are not yet known.'}"

Explicit User Input:
The user explicitly stated: "${text}"

Update the Taste Profile to integrate this new preference direction. Refine the specific topics, presentation style, depth, or creators the user appreciates or dislikes. Keep the profile concise (under 400 words) and structured. Output ONLY the updated profile text.`

      const updatedProfile = await window.hearth.callOllamaApi(
        ollamaUrl,
        ollamaModel,
        prompt,
        false
      )

      if (updatedProfile && updatedProfile.trim()) {
        onUpdateStore({
          ...store,
          feedMemoryProfile: updatedProfile.trim()
        })
        setPreferenceText('')
        setPreferenceDone(true)
        setTimeout(() => setPreferenceDone(false), 2500)
      }
    } catch (e) {
      console.error(e)
      alert(`Ollama Taste Update failed: ${e}`)
    } finally {
      setPreferenceUpdating(false)
    }
  }

  const cleanJson = (str: string): string => {
    let clean = str.trim()
    if (clean.startsWith('```')) {
      // Remove starting ```json or ```
      clean = clean.replace(/^```[a-zA-Z]*/, '')
      // Remove ending ```
      clean = clean.replace(/```$/, '')
    }
    return clean.trim()
  }

  const handleSearch = async () => {
    const query = topic.trim()
    if (!query) return

    if (!store.youtubeApiKey) {
      setStep('error')
      setStatusMsg('Missing YouTube API Key. Add it in Settings → General.')
      return
    }
    if (!store.geminiApiKey) {
      setStep('error')
      setStatusMsg('Missing Gemini API Key. Add it in Settings → AI.')
      return
    }
    if (!store.ollamaUrl || !store.ollamaModel) {
      setStep('error')
      setStatusMsg('Missing Ollama config. Check Settings → AI.')
      return
    }

    setStep('searching')
    setStatusMsg(`Searching YouTube for "${query}"...`)
    setResults([])

    try {
      // Step 1: Search YouTube for 15 candidates
      const searchResults = await window.hearth.searchYoutubeVideos(query)
      if (!searchResults || searchResults.length === 0) {
        setStep('error')
        setStatusMsg('No videos found on YouTube for this topic.')
        return
      }

      // Step 2: Gemini Filter down to 5
      setStep('filtering')
      setStatusMsg('Gemini is selecting the top 5 most relevant videos...')

      const geminiPrompt = `The user wants to explore the topic: "${query}".
Here is a list of candidate YouTube videos found for this topic:
${searchResults.map((c, i) => `${i + 1}. Title: "${c.title}" | Video ID: "${c.videoId}" | Published At: "${c.publishedAt}"`).join('\n')}

Select exactly 5 videos from this list that are the most high-quality, educational, and relevant for this topic.
Return the selection as a JSON array of objects with the exact format:
[
  {
    "videoId": "the exact videoId from the list",
    "title": "the exact title from the list",
    "creator": "the channel/creator name (guess or extract from description if available, or just use 'YouTube')",
    "publishedAt": "the exact publishedAt from the list"
  }
]
Respond ONLY with this JSON array. Do not include markdown formatting, backticks, or any conversational text.`

      const geminiResponseText = await window.hearth.callGeminiApi(
        store.geminiApiKey,
        '',
        geminiPrompt
      )

      let curatedList: CandidateVideo[] = []
      try {
        const cleanedJsonText = cleanJson(geminiResponseText)
        curatedList = JSON.parse(cleanedJsonText)
      } catch (err) {
        console.error('Failed to parse Gemini JSON response:', geminiResponseText, err)
        // Fallback to top 5 search results
        curatedList = searchResults.slice(0, 5).map(v => ({
          videoId: v.videoId,
          title: v.title,
          creator: 'YouTube',
          publishedAt: v.publishedAt
        }))
      }

      // Step 3: Fetch Transcripts for the 5 videos
      setStep('transcripts')
      setStatusMsg('Fetching video transcripts for personalization...')
      
      const enrichedList: CandidateVideo[] = []
      for (let i = 0; i < curatedList.length; i++) {
        const item = curatedList[i]
        setStatusMsg(`Fetching transcript for video ${i + 1} of ${curatedList.length}...`)
        
        let transcriptSnippet = 'No transcript available.'
        try {
          const cues = await window.hearth.fetchVideoTranscript(item.videoId)
          if (cues && cues.length > 0) {
            // Take first 35 cues (approx 300-500 words)
            transcriptSnippet = cues.slice(0, 35).map(c => c.text).join(' ')
          }
        } catch (e) {
          console.warn(`No transcript for ${item.videoId}:`, e)
        }

        enrichedList.push({
          ...item,
          transcriptSnippet
        })
      }

      // Step 4: Ollama personalization prediction
      setStep('personalizing')
      setStatusMsg('Ollama is evaluating videos against your Taste Memory Profile...')

      const finalResults: CandidateVideo[] = []
      for (let i = 0; i < enrichedList.length; i++) {
        const video = enrichedList[i]
        setStatusMsg(`Ollama is analyzing video ${i + 1} of ${enrichedList.length}...`)

        const ollamaPrompt = `You are a personalized recommendation assistant.
User Taste Profile:
"${store.feedMemoryProfile || 'The user\'s preferences are not yet known.'}"

Evaluate this candidate video:
Title: "${video.title}"
Creator: "${video.creator}"
Transcript Snippet:
"${video.transcriptSnippet}"

Based on the User Taste Profile, will the user like this candidate video?
Analyze the topic, style, tone, and depth.
Respond with a JSON object:
{
  "liked": boolean,
  "reason": "A 1-2 sentence explanation of why they will or will not like it."
}
Do not include markdown or backticks in your output.`

        let liked = true
        let reason = 'Unable to personalize at this time.'

        try {
          const ollamaResponseText = await window.hearth.callOllamaApi(
            store.ollamaUrl,
            store.ollamaModel,
            ollamaPrompt,
            true
          )
          const parsed = JSON.parse(cleanJson(ollamaResponseText))
          if (typeof parsed.liked === 'boolean') liked = parsed.liked
          if (parsed.reason) reason = parsed.reason
        } catch (e) {
          console.error(`Ollama personalization failed for ${video.videoId}:`, e)
        }

        finalResults.push({
          ...video,
          liked,
          reason
        })
      }

      setResults(finalResults)
      setStep('done')
      setStatusMsg('')
    } catch (e) {
      console.error(e)
      setStep('error')
      setStatusMsg(`Discovery failed: ${e}`)
    }
  }

  // Rate a video and trigger background Titans Memory Update
  const handleRateVideo = async (video: CandidateVideo, isLove: boolean) => {
    // Update local state
    setResults(prev => prev.map(r => r.videoId === video.videoId ? { ...r, rating: isLove ? 'love' : 'hate' } : r))

    const ollamaUrl = store.ollamaUrl
    const ollamaModel = store.ollamaModel

    // Save to Ratings History list
    const ratingItem: FeedRating = {
      videoId: video.videoId,
      title: video.title,
      creator: video.creator,
      rating: isLove ? 'love' : 'hate',
      transcriptSnippet: video.transcriptSnippet ?? '',
      timestamp: new Date().toISOString()
    }
    const feedRatings = [ratingItem, ...(store.feedRatings ?? [])]
    onUpdateStore({ ...store, feedRatings })

    if (!ollamaUrl || !ollamaModel) {
      console.warn('Ollama configuration is missing. Skipping taste memory reflection update.')
      return
    }

    // Trigger background Titans Memory update
    try {
      const memoryUpdatePrompt = `You are the Memory Module for a personalized recommendation system.
Current Taste Profile:
"${store.feedMemoryProfile || 'The user\'s preferences are not yet known.'}"

New Interaction Event:
Video Title: "${video.title}"
Creator/Channel: "${video.creator}"
Rating: "${isLove ? 'LOVED/INTERESTED' : 'DISLIKED/BORED'}"
Transcript Snippet:
"${video.transcriptSnippet || 'No transcript available.'}"

Update the Taste Profile to integrate this new event. Refine the specific topics, presentation style, depth, or creators the user appreciates or dislikes. Keep the profile concise (under 400 words) and structured. Output ONLY the updated profile text.`

      const updatedProfile = await window.hearth.callOllamaApi(
        ollamaUrl,
        ollamaModel,
        memoryUpdatePrompt,
        false
      )

      if (updatedProfile && updatedProfile.trim()) {
        onUpdateStore({
          ...store,
          feedMemoryProfile: updatedProfile.trim(),
          feedRatings
        })
      }
    } catch (err) {
      console.error('Titans background memory update failed:', err)
    }
  }

  // Ingest Actions
  const handleAddToLoop = (video: CandidateVideo) => {
    const loopItem: LoopItem = {
      id: newId('itm_'),
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoId: video.videoId,
      title: video.title,
      creator: video.creator,
      duration: '',
      category: store.categories[0]?.id ?? 'curiosity',
      bucket: 'WKDY',
      addedAt: new Date().toISOString(),
      paras: [],
      lastWatchedAt: null,
      partsConsumed: 0
    }
    onUpdateStore({ ...store, loop: [loopItem, ...store.loop] })
  }

  const handleAddToWishlist = (video: CandidateVideo) => {
    const loopItem: LoopItem = {
      id: newId('wsh_'),
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoId: video.videoId,
      title: video.title,
      creator: video.creator,
      duration: '',
      category: store.categories[0]?.id ?? 'curiosity',
      bucket: 'WKDY',
      addedAt: new Date().toISOString(),
      paras: [],
      lastWatchedAt: null,
      partsConsumed: 0
    }
    onUpdateStore({ ...store, wishlist: [loopItem, ...store.wishlist] })
  }

  const handleWatchNow = (video: CandidateVideo) => {
    const loopItem: LoopItem = {
      id: newId('itm_'),
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoId: video.videoId,
      title: video.title,
      creator: video.creator,
      duration: '',
      category: store.categories[0]?.id ?? 'curiosity',
      bucket: 'WKDY',
      addedAt: new Date().toISOString(),
      paras: [],
      lastWatchedAt: null,
      partsConsumed: 0
    }
    onOpenVideo(loopItem)
  }

  return (
    <div className="screen scroll-pad">
      <div className="page-narrow">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Discover</div>
            <h2 className="page-h2">AI Topic Search</h2>
          </div>
          <button className="set-active-btn" onClick={onBack}>Back</button>
        </div>

        <p className="page-lede" style={{ marginBottom: 20 }}>
          Enter a topic to generate a personalized curation. Gemini will fetch candidates and Ollama will evaluate them against your active Taste Profile.
        </p>

        {/* Direct Taste Injection Note */}
        <div className="card" style={{ padding: 18, marginBottom: 24, border: '1px dashed var(--border-soft)' }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-soft)', marginBottom: 6 }}>
            Add Taste Preference Note
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="ingest-input text"
              placeholder="e.g. I prefer physics videos under 20 mins, hate history summaries..."
              value={preferenceText}
              onChange={(e) => setPreferenceText(e.target.value)}
              style={{ flex: 1, fontSize: 12.5 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdatePreference() }}
            />
            <button
              className="ingest-save"
              onClick={handleUpdatePreference}
              disabled={preferenceUpdating || !preferenceText.trim()}
              style={{ fontSize: 12 }}
            >
              {preferenceUpdating ? 'Updating...' : preferenceDone ? '✓ Trained' : 'Inject Taste'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
            Directly trains your Titans taste model weights using Ollama's associative reflection.
          </div>
        </div>

        {/* AI Search Bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <input
            className="ingest-input text"
            placeholder={hasKeys ? "Type any topic (e.g. quantum computing, mechanical engineering history)..." : "Keys required to search..."}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            style={{ flex: 1, fontSize: 14.5 }}
            disabled={step !== 'idle' && step !== 'done' && step !== 'error'}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
          />
          <button
            className="ingest-save"
            onClick={handleSearch}
            disabled={!topic.trim() || (step !== 'idle' && step !== 'done' && step !== 'error')}
            style={{ padding: '0 24px', fontSize: 14 }}
          >
            Search
          </button>
        </div>

        {/* Keys warnings */}
        {!hasKeys && (
          <div style={{ padding: '16px', background: 'rgba(255, 59, 48, 0.08)', border: '1px solid rgba(255, 59, 48, 0.2)', borderRadius: 8, color: 'var(--ink)', fontSize: 12.5, lineHeight: 1.5, marginBottom: 20 }}>
            ⚠️ <strong>API Keys Required:</strong> Please configure a <strong>YouTube API Key</strong> and a <strong>Gemini API Key</strong> in the <strong>Settings → AI</strong> tab to run topic searches.
          </div>
        )}

        {/* Loading Stages */}
        {(step !== 'idle' && step !== 'done') && (
          <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--hairline-soft)', marginBottom: 20 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <h4 style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{statusMsg}</h4>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: step === 'searching' ? 'var(--ember-tint)' : 'var(--bg-card)', color: step === 'searching' ? 'var(--ember-ink)' : 'var(--ink-faint)' }}>1. YouTube</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: step === 'filtering' ? 'var(--ember-tint)' : 'var(--bg-card)', color: step === 'filtering' ? 'var(--ember-ink)' : 'var(--ink-faint)' }}>2. Gemini</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: step === 'transcripts' ? 'var(--ember-tint)' : 'var(--bg-card)', color: step === 'transcripts' ? 'var(--ember-ink)' : 'var(--ink-faint)' }}>3. Transcripts</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: step === 'personalizing' ? 'var(--ember-tint)' : 'var(--bg-card)', color: step === 'personalizing' ? 'var(--ember-ink)' : 'var(--ink-faint)' }}>4. Ollama</span>
            </div>
          </div>
        )}

        {/* Error message */}
        {step === 'error' && (
          <div style={{ padding: 16, background: 'rgba(255, 59, 48, 0.08)', color: 'var(--ink)', borderRadius: 12, border: '1px solid rgba(255, 59, 48, 0.2)', marginBottom: 20, fontSize: 13 }}>
            ✕ {statusMsg}
          </div>
        )}

        {/* Results */}
        {step === 'done' && results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Personalized Results
            </div>
            {results.map((video) => (
              <div
                key={video.videoId}
                className="card"
                style={{
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  borderColor: video.liked ? 'rgba(52, 199, 89, 0.25)' : 'var(--hairline-soft)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--ink-faint)' }}>
                      {video.creator}
                    </div>
                    <h4
                      style={{ fontSize: 15, fontWeight: 500, margin: '4px 0 0 0', color: 'var(--ink)', cursor: 'pointer', lineHeight: 1.45 }}
                      onClick={() => handleWatchNow(video)}
                    >
                      {video.title}
                    </h4>
                  </div>

                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      padding: '4px 8px',
                      borderRadius: 4,
                      background: video.liked ? 'rgba(52, 199, 89, 0.12)' : 'rgba(142, 142, 147, 0.12)',
                      color: video.liked ? '#34c759' : 'var(--ink-faint)',
                      border: `1px solid ${video.liked ? 'rgba(52, 199, 89, 0.25)' : 'var(--hairline-soft)'}`,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {video.liked ? 'Highly Recommended' : 'Low Relevance'}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12.5,
                    color: 'var(--ink-soft)',
                    background: 'var(--bg-card)',
                    padding: '10px 12px',
                    borderRadius: 8,
                    borderLeft: `3px solid ${video.liked ? '#34c759' : 'var(--border-soft)'}`,
                    lineHeight: 1.55
                  }}
                >
                  💡 <strong>Personalization Analysis:</strong> {video.reason}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  {/* Rating Feedback Loop */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className={`ccat-pill ${video.rating === 'love' ? 'active' : ''}`}
                      onClick={() => handleRateVideo(video, true)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        background: video.rating === 'love' ? 'rgba(52, 199, 89, 0.15)' : '',
                        borderColor: video.rating === 'love' ? '#34c759' : '',
                        color: video.rating === 'love' ? '#34c759' : ''
                      }}
                      title="Rate Love (trains AI weights)"
                    >
                      👍 Love it
                    </button>
                    <button
                      className={`ccat-pill ${video.rating === 'hate' ? 'active' : ''}`}
                      onClick={() => handleRateVideo(video, false)}
                      style={{
                        padding: '6px 12px',
                        fontSize: 12,
                        background: video.rating === 'hate' ? 'rgba(255, 59, 48, 0.15)' : '',
                        borderColor: video.rating === 'hate' ? '#ff3b30' : '',
                        color: video.rating === 'hate' ? '#ff3b30' : ''
                      }}
                      title="Rate Hate (trains AI weights)"
                    >
                      👎 Hate it
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="ccat-pill"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleWatchNow(video)}
                    >
                      ▶ Play
                    </button>
                    <button
                      className="ccat-pill"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleAddToLoop(video)}
                    >
                      ＋ Add to Loop
                    </button>
                    <button
                      className="ccat-pill"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => handleAddToWishlist(video)}
                    >
                      ❤️ Wishlist
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
