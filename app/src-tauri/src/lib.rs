use regex::Regex;
use serde::{Deserialize, Serialize};

mod remarkable;

/// Open a native file-picker dialog and return the chosen absolute path (or
/// `None` if the user cancelled). Used by AttachNoteModal to attach a local
/// PDF / .rmdoc to a video without typing the path.
#[tauri::command]
fn pick_note_file() -> Option<String> {
    let dialog = rfd::FileDialog::new()
        .add_filter("Notes (PDF / reMarkable / EPUB)", &["pdf", "rmdoc", "epub"])
        .add_filter("All files", &["*"])
        .set_title("Pick the notes file");
    dialog.pick_file().and_then(|p| p.to_str().map(|s| s.to_string()))
}

#[derive(Debug, Deserialize)]
struct OEmbedRaw {
    title: Option<String>,
    author_name: Option<String>,
    thumbnail_url: Option<String>,
}

// YouTube Data API v3 response types
#[derive(Debug, Deserialize)]
struct YtApiResponse<T> {
    items: Option<Vec<T>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtPlaylistItem {
    snippet: Option<YtPlaylistItemSnippet>,
}

#[derive(Debug, Deserialize)]
struct YtPlaylistItemSnippet {
    title: Option<String>,
    #[serde(rename = "resourceId")]
    resource_id: Option<YtPlaylistResourceId>,
}

#[derive(Debug, Deserialize)]
struct YtPlaylistResourceId {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtVideoItem {
    snippet: Option<YtVideoSnippet>,
    #[serde(rename = "contentDetails")]
    content_details: Option<YtVideoContentDetails>,
}

#[derive(Debug, Deserialize)]
struct YtVideoSnippet {
    title: Option<String>,
    description: Option<String>,
    #[serde(rename = "channelTitle")]
    channel_title: Option<String>,
    thumbnails: Option<YtApiThumbnails>,
    #[serde(rename = "publishedAt")]
    published_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtVideoContentDetails {
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtApiThumbnails {
    high: Option<YtApiThumb>,
    medium: Option<YtApiThumb>,
    default: Option<YtApiThumb>,
}

#[derive(Debug, Deserialize)]
struct YtApiThumb {
    url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtPlaylistSnippetItem {
    snippet: Option<YtPlaylistSnippet>,
}

#[derive(Debug, Deserialize)]
struct YtPlaylistSnippet {
    title: Option<String>,
    #[serde(rename = "channelTitle")]
    channel_title: Option<String>,
    thumbnails: Option<YtApiThumbnails>,
}

#[derive(Debug, Serialize)]
pub struct Chapter {
    title: String,
    #[serde(rename = "startSec")]
    start_sec: u64,
}

#[derive(Debug, Serialize)]
pub struct FetchedMeta {
    title: String,
    author: String,
    thumbnail: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    duration: String,
    #[serde(rename = "durationSec", skip_serializing_if = "is_zero_u64")]
    duration_sec: u64,
    #[serde(skip_serializing_if = "String::is_empty")]
    description: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    chapters: Vec<Chapter>,
}

fn is_zero_u64(n: &u64) -> bool { *n == 0 }

/// Convert ISO 8601 duration (e.g. "PT1H30M15S") to total seconds.
fn iso_duration_to_seconds(iso: &str) -> u64 {
    if !iso.starts_with("PT") { return 0; }
    let body = &iso[2..];
    let mut h: u64 = 0;
    let mut m: u64 = 0;
    let mut s: u64 = 0;
    let mut num = String::new();
    for c in body.chars() {
        if c.is_ascii_digit() {
            num.push(c);
        } else {
            let n: u64 = num.parse().unwrap_or(0);
            num.clear();
            match c {
                'H' => h = n,
                'M' => m = n,
                'S' => s = n,
                _ => {}
            }
        }
    }
    h * 3600 + m * 60 + s
}

/// Parse YouTube chapters from a video description. Returns chapters only when
/// at least 3 timestamp lines are found AND the first is 0:00 (YouTube's own
/// rule for auto-detecting chapters).
fn parse_chapters_from_description(desc: &str) -> Vec<Chapter> {
    let line_re = Regex::new(r"(?m)^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+(.+?)\s*$").unwrap();
    let mut out: Vec<Chapter> = Vec::new();
    for cap in line_re.captures_iter(desc) {
        let ts = &cap[1];
        let title = cap[2].trim().to_string();
        if title.is_empty() { continue; }
        let secs = parse_timestamp(ts);
        out.push(Chapter { title, start_sec: secs });
    }
    if out.len() < 3 { return Vec::new(); }
    if out[0].start_sec != 0 { return Vec::new(); }
    // Strictly increasing.
    for w in out.windows(2) {
        if w[1].start_sec <= w[0].start_sec { return Vec::new(); }
    }
    out
}

fn parse_timestamp(s: &str) -> u64 {
    let parts: Vec<&str> = s.split(':').collect();
    let nums: Vec<u64> = parts.iter().map(|p| p.parse::<u64>().unwrap_or(0)).collect();
    match nums.len() {
        1 => nums[0],
        2 => nums[0] * 60 + nums[1],
        3 => nums[0] * 3600 + nums[1] * 60 + nums[2],
        _ => 0,
    }
}

#[derive(Debug, Serialize)]
pub struct PlaylistVideo {
    #[serde(rename = "videoId")]
    video_id: String,
    title: String,
    #[serde(skip_serializing_if = "String::is_empty")]
    duration: String,
}

/// Parse ISO 8601 duration (e.g. "PT1H30M15S") → "1:30:15"; "PT5M12S" → "5:12".
fn iso_duration_to_label(iso: &str) -> String {
    if !iso.starts_with("PT") {
        return String::new();
    }
    let body = &iso[2..];
    let mut h: u64 = 0;
    let mut m: u64 = 0;
    let mut s: u64 = 0;
    let mut num = String::new();
    for c in body.chars() {
        if c.is_ascii_digit() {
            num.push(c);
        } else {
            let n: u64 = num.parse().unwrap_or(0);
            num.clear();
            match c {
                'H' => h = n,
                'M' => m = n,
                'S' => s = n,
                _ => {}
            }
        }
    }
    if h > 0 {
        format!("{}:{:02}:{:02}", h, m, s)
    } else {
        format!("{}:{:02}", m, s)
    }
}

#[derive(Debug, Serialize)]
pub struct ChannelLookup {
    #[serde(rename = "channelId")]
    channel_id: String,
    name: String,
}

#[derive(Debug, Serialize)]
pub struct ChannelLatest {
    #[serde(rename = "channelId")]
    channel_id: String,
    #[serde(rename = "videoId")]
    video_id: String,
    title: String,
    #[serde(rename = "publishedAt")]
    published_at: String,
}

fn url_encode_simple(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for b in s.as_bytes() {
        let c = *b as char;
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => out.push(c),
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn ua() -> &'static str {
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36"
}

fn fetch_oembed(target_url: &str) -> Option<FetchedMeta> {
    let url = format!(
        "https://www.youtube.com/oembed?url={}&format=json",
        url_encode_simple(target_url)
    );
    let res = ureq::get(&url)
        .set("User-Agent", ua())
        .timeout(std::time::Duration::from_secs(8))
        .call()
        .ok()?;
    let raw: OEmbedRaw = res.into_json().ok()?;
    Some(FetchedMeta {
        title: raw.title.unwrap_or_default(),
        author: raw.author_name.unwrap_or_default(),
        thumbnail: raw.thumbnail_url.unwrap_or_default(),
        duration: String::new(),
        duration_sec: 0,
        description: String::new(),
        chapters: Vec::new(),
    })
}

fn unescape_json_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => out.push('\n'),
                Some('t') => out.push('\t'),
                Some('r') => out.push('\r'),
                Some('"') => out.push('"'),
                Some('\\') => out.push('\\'),
                Some('/') => out.push('/'),
                Some('u') => {
                    let hex: String = (0..4).filter_map(|_| chars.next()).collect();
                    if let Ok(n) = u32::from_str_radix(&hex, 16) {
                        if let Some(c) = char::from_u32(n) {
                            out.push(c);
                        }
                    }
                }
                Some(other) => {
                    out.push('\\');
                    out.push(other);
                }
                None => out.push('\\'),
            }
        } else {
            out.push(c);
        }
    }
    out
}

fn fetch_playlist_videos_impl(playlist_id: &str) -> Vec<PlaylistVideo> {
    let url = format!(
        "https://www.youtube.com/playlist?list={}",
        url_encode_simple(playlist_id)
    );
    let body = match ureq::get(&url)
        .set("User-Agent", ua())
        .set("Accept-Language", "en-US,en;q=0.9")
        .timeout(std::time::Duration::from_secs(12))
        .call()
    {
        Ok(r) => r.into_string().unwrap_or_default(),
        Err(_) => return Vec::new(),
    };

    let re = Regex::new(
        r#""playlistVideoRenderer":\{[^}]*?"videoId":"([A-Za-z0-9_-]{11})"[^}]*?"title":\{(?:"runs":\[\{"text":"((?:\\.|[^"\\])*)"|"simpleText":"((?:\\.|[^"\\])*)")"#,
    )
    .unwrap();

    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for caps in re.captures_iter(&body) {
        let id = caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default();
        let title = caps
            .get(2)
            .or_else(|| caps.get(3))
            .map(|m| unescape_json_text(m.as_str()))
            .unwrap_or_default();
        if id.is_empty() || !seen.insert(id.clone()) {
            continue;
        }
        out.push(PlaylistVideo { video_id: id, title, duration: String::new() });
    }
    out
}

fn normalize_handle(input: &str) -> String {
    let trimmed = input.trim();
    let stripped = trimmed.trim_start_matches('@');
    stripped.to_string()
}

fn extract_channel_id(body: &str) -> Option<String> {
    // Try several patterns YouTube uses across page variants.
    let patterns = [
        r#"<meta\s+itemprop="(?:identifier|channelId)"\s+content="(UC[A-Za-z0-9_-]{22})""#,
        r#"<link\s+rel="canonical"\s+href="https?://www\.youtube\.com/channel/(UC[A-Za-z0-9_-]{22})""#,
        r#"feeds/videos\.xml\?channel_id=(UC[A-Za-z0-9_-]{22})"#,
        r#""channelId":"(UC[A-Za-z0-9_-]{22})""#,
        r#""externalId":"(UC[A-Za-z0-9_-]{22})""#,
        r#""browseId":"(UC[A-Za-z0-9_-]{22})""#,
        r#"/channel/(UC[A-Za-z0-9_-]{22})"#,
    ];
    for p in patterns {
        if let Ok(re) = Regex::new(p) {
            if let Some(c) = re.captures(body) {
                if let Some(m) = c.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }
    }
    None
}

fn extract_channel_name(body: &str) -> Option<String> {
    let patterns = [
        (r#"<meta\s+property="og:title"\s+content="([^"]+)""#, false),
        (r#"<meta\s+name="title"\s+content="([^"]+)""#, false),
        (r#""title":"([^"]+)","navigationEndpoint""#, true),
        (r#""channelMetadataRenderer":\{"title":"([^"]+)""#, true),
        (r#""ownerChannelName":"([^"]+)""#, true),
        (r#"<title>([^<]+?)\s*-\s*YouTube</title>"#, false),
    ];
    for (p, json_escape) in patterns {
        if let Ok(re) = Regex::new(p) {
            if let Some(c) = re.captures(body) {
                if let Some(m) = c.get(1) {
                    let s = m.as_str();
                    if s.is_empty() {
                        continue;
                    }
                    return Some(if json_escape { unescape_json_text(s) } else { s.to_string() });
                }
            }
        }
    }
    None
}

fn fetch_channel_html(url: &str) -> Option<String> {
    let res = ureq::get(url)
        .set("User-Agent", ua())
        .set("Accept-Language", "en-US,en;q=0.9")
        .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .set("Cookie", "CONSENT=YES+cb; SOCS=CAESHAgBEhJnd3NfMjAyMjA3MjctMF9SQzIaAmVuIAEaBgiAhKuYBg")
        .timeout(std::time::Duration::from_secs(12))
        .call()
        .ok()?;
    res.into_string().ok()
}

fn resolve_channel_impl(handle: &str) -> Option<ChannelLookup> {
    let handle = normalize_handle(handle);
    if handle.is_empty() {
        return None;
    }

    // If user pasted a channel ID directly, verify by hitting the channel page
    if handle.starts_with("UC") && handle.len() >= 22 {
        let url = format!("https://www.youtube.com/channel/{}", handle);
        if let Some(body) = fetch_channel_html(&url) {
            let name = extract_channel_name(&body).unwrap_or_else(|| format!("{}", &handle));
            return Some(ChannelLookup { channel_id: handle, name });
        }
        // Even if HTML scrape failed, we can still validate via RSS — if that returns
        // valid XML the ID is real. Fall back to just trusting the ID + using it as name.
        let rss_url = format!(
            "https://www.youtube.com/feeds/videos.xml?channel_id={}",
            url_encode_simple(&handle)
        );
        if ureq::get(&rss_url).timeout(std::time::Duration::from_secs(8)).call().is_ok() {
            return Some(ChannelLookup { channel_id: handle.clone(), name: handle });
        }
        return None;
    }

    // Try the @handle URL
    let url = format!("https://www.youtube.com/@{}", url_encode_simple(&handle));
    if let Some(body) = fetch_channel_html(&url) {
        if let Some(channel_id) = extract_channel_id(&body) {
            let name = extract_channel_name(&body).unwrap_or_else(|| format!("@{}", handle));
            return Some(ChannelLookup { channel_id, name });
        }
    }

    // Last resort: /c/handle (legacy custom URLs)
    let url2 = format!("https://www.youtube.com/c/{}", url_encode_simple(&handle));
    if let Some(body) = fetch_channel_html(&url2) {
        if let Some(channel_id) = extract_channel_id(&body) {
            let name = extract_channel_name(&body).unwrap_or_else(|| format!("@{}", handle));
            return Some(ChannelLookup { channel_id, name });
        }
    }

    None
}

fn fetch_channel_latest_impl(channel_id: &str) -> Option<ChannelLatest> {
    if !channel_id.starts_with("UC") {
        return None;
    }
    let url = format!(
        "https://www.youtube.com/feeds/videos.xml?channel_id={}",
        url_encode_simple(channel_id)
    );
    let body = ureq::get(&url)
        .set("User-Agent", ua())
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .ok()?
        .into_string()
        .ok()?;

    // RSS XML: <entry><yt:videoId>ID</yt:videoId><title>Title</title><published>ISO</published>
    let entry_re = Regex::new(
        r#"<entry>[\s\S]*?<yt:videoId>([A-Za-z0-9_-]{11})</yt:videoId>[\s\S]*?<title>([^<]+)</title>[\s\S]*?<published>([^<]+)</published>"#,
    )
    .ok()?;
    // Walk entries in order (newest first per RSS spec) and skip Shorts by
    // title hashtag. RSS has no duration to check against.
    for caps in entry_re.captures_iter(&body) {
        let title = caps.get(2)?.as_str().to_string();
        if title_is_short(&title) { continue; }
        return Some(ChannelLatest {
            channel_id: channel_id.to_string(),
            video_id: caps.get(1)?.as_str().to_string(),
            title,
            published_at: caps.get(3)?.as_str().to_string(),
        });
    }
    None
}

fn store_file_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("config.json"))
}

#[tauri::command]
fn read_store(app: tauri::AppHandle) -> String {
    let path = match store_file_path(&app) {
        Some(p) => p,
        None => return String::new(),
    };
    std::fs::read_to_string(&path).unwrap_or_default()
}

#[tauri::command]
fn write_store(app: tauri::AppHandle, json: String) -> bool {
    let path = match store_file_path(&app) {
        Some(p) => p,
        None => return false,
    };
    // Atomic write: temp file + rename
    let tmp = path.with_extension("json.tmp");
    if std::fs::write(&tmp, &json).is_err() {
        return false;
    }
    std::fs::rename(&tmp, &path).is_ok()
}

fn fetch_playlist_videos_api(playlist_id: &str, api_key: &str) -> Option<Vec<PlaylistVideo>> {
    let mut out: Vec<PlaylistVideo> = Vec::new();
    let mut page_token: Option<String> = None;
    for _ in 0..20 {
        let mut url = format!(
            "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId={}&maxResults=50&key={}",
            url_encode_simple(playlist_id),
            url_encode_simple(api_key)
        );
        if let Some(t) = &page_token {
            url.push_str(&format!("&pageToken={}", url_encode_simple(t)));
        }
        let resp = ureq::get(&url)
            .timeout(std::time::Duration::from_secs(15))
            .call()
            .ok()?;
        let parsed: YtApiResponse<YtPlaylistItem> = resp.into_json().ok()?;
        if let Some(items) = parsed.items {
            for item in items {
                let snip = match item.snippet {
                    Some(s) => s,
                    None => continue,
                };
                let vid = snip.resource_id
                    .and_then(|r| r.video_id)
                    .unwrap_or_default();
                let title = snip.title.unwrap_or_default();
                if vid.is_empty() || title == "Private video" || title == "Deleted video" {
                    continue;
                }
                out.push(PlaylistVideo { video_id: vid, title, duration: String::new() });
            }
        }
        page_token = parsed.next_page_token;
        if page_token.is_none() {
            break;
        }
    }
    if out.is_empty() {
        return None;
    }
    // Enrich with durations — batched videos.list, up to 50 ids per call
    let ids: Vec<String> = out.iter().map(|v| v.video_id.clone()).collect();
    let mut dur_map: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    for chunk in ids.chunks(50) {
        let joined = chunk.join(",");
        let url = format!(
            "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={}&key={}",
            url_encode_simple(&joined),
            url_encode_simple(api_key)
        );
        if let Ok(resp) = ureq::get(&url).timeout(std::time::Duration::from_secs(15)).call() {
            if let Ok(parsed) = resp.into_json::<YtApiResponse<YtVideoIdDuration>>() {
                if let Some(items) = parsed.items {
                    for it in items {
                        let id = match it.id { Some(s) => s, None => continue };
                        let dur = it.content_details
                            .and_then(|cd| cd.duration)
                            .map(|s| iso_duration_to_label(&s))
                            .unwrap_or_default();
                        if !dur.is_empty() {
                            dur_map.insert(id, dur);
                        }
                    }
                }
            }
        }
    }
    for v in out.iter_mut() {
        if let Some(d) = dur_map.remove(&v.video_id) {
            v.duration = d;
        }
    }
    Some(out)
}

#[derive(Debug, Deserialize)]
struct YtVideoIdDuration {
    id: Option<String>,
    #[serde(rename = "contentDetails")]
    content_details: Option<YtVideoContentDetails>,
}

fn fetch_video_meta_api(video_id: &str, api_key: &str) -> Option<FetchedMeta> {
    let url = format!(
        "https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={}&key={}",
        url_encode_simple(video_id),
        url_encode_simple(api_key)
    );
    let resp = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .ok()?;
    let parsed: YtApiResponse<YtVideoItem> = resp.into_json().ok()?;
    let item = parsed.items?.into_iter().next()?;
    let iso = item.content_details
        .as_ref()
        .and_then(|cd| cd.duration.clone())
        .unwrap_or_default();
    let duration = if iso.is_empty() { String::new() } else { iso_duration_to_label(&iso) };
    let duration_sec = iso_duration_to_seconds(&iso);
    let snip = item.snippet?;
    let description = snip.description.clone().unwrap_or_default();
    let chapters = if description.is_empty() {
        Vec::new()
    } else {
        parse_chapters_from_description(&description)
    };
    let thumb = snip.thumbnails
        .as_ref()
        .and_then(|t| t.high.as_ref().or(t.medium.as_ref()).or(t.default.as_ref()))
        .and_then(|t| t.url.clone())
        .unwrap_or_default();
    Some(FetchedMeta {
        title: snip.title.unwrap_or_default(),
        author: snip.channel_title.unwrap_or_default(),
        thumbnail: thumb,
        duration,
        duration_sec,
        description,
        chapters,
    })
}

fn fetch_playlist_meta_api(playlist_id: &str, api_key: &str) -> Option<FetchedMeta> {
    let url = format!(
        "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id={}&key={}",
        url_encode_simple(playlist_id),
        url_encode_simple(api_key)
    );
    let resp = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .call()
        .ok()?;
    let parsed: YtApiResponse<YtPlaylistSnippetItem> = resp.into_json().ok()?;
    let item = parsed.items?.into_iter().next()?;
    let snip = item.snippet?;
    let thumb = snip.thumbnails
        .as_ref()
        .and_then(|t| t.high.as_ref().or(t.medium.as_ref()).or(t.default.as_ref()))
        .and_then(|t| t.url.clone())
        .unwrap_or_default();
    Some(FetchedMeta {
        title: snip.title.unwrap_or_default(),
        author: snip.channel_title.unwrap_or_default(),
        thumbnail: thumb,
        duration: String::new(),
        duration_sec: 0,
        description: String::new(),
        chapters: Vec::new(),
    })
}

/// Last-ditch duration source. Fetches the watch page and tries several
/// regex patterns over the embedded player config. The `CONSENT=YES+1`
/// cookie + `hl=en&gl=US` query params dodge YouTube's consent gate which
/// otherwise serves a stub page with no `lengthSeconds`.
fn scrape_watch_page_length_secs(video_id: &str) -> Option<u64> {
    let url = format!("https://www.youtube.com/watch?v={}&hl=en&gl=US", video_id);
    let resp = ureq::get(&url)
        .set("User-Agent", ua())
        .set("Accept-Language", "en-US,en;q=0.9")
        .set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .set("Cookie", "CONSENT=YES+1; SOCS=CAI")
        .timeout(std::time::Duration::from_secs(5))
        .call()
        .ok()?;
    let body = resp.into_string().ok()?;
    // Pattern attempts, in order of YouTube's recent format rotation history.
    let patterns: &[&str] = &[
        r#""lengthSeconds"\s*:\s*"(\d+)""#,
        r#""lengthSeconds"\s*:\s*(\d+)"#,
        r#"\\"lengthSeconds\\"\s*:\s*\\"(\d+)\\""#,
    ];
    for pat in patterns {
        if let Ok(re) = Regex::new(pat) {
            if let Some(cap) = re.captures(&body) {
                if let Some(m) = cap.get(1) {
                    if let Ok(n) = m.as_str().parse::<u64>() {
                        if n > 0 { return Some(n); }
                    }
                }
            }
        }
    }
    // Last-ditch: approxDurationMs (in milliseconds). Lives in streamingData.
    if let Ok(re) = Regex::new(r#""approxDurationMs"\s*:\s*"(\d+)""#) {
        if let Some(cap) = re.captures(&body) {
            if let Some(m) = cap.get(1) {
                if let Ok(ms) = m.as_str().parse::<u64>() {
                    if ms >= 1000 { return Some(ms / 1000); }
                }
            }
        }
    }
    None
}

fn secs_to_label(secs: u64) -> String {
    if secs == 0 { return String::new(); }
    if secs >= 3600 {
        format!("{}:{:02}:{:02}", secs / 3600, (secs % 3600) / 60, secs % 60)
    } else {
        format!("{}:{:02}", secs / 60, secs % 60)
    }
}

#[tauri::command]
fn fetch_youtube_meta(video_id: String, api_key: Option<String>) -> Option<FetchedMeta> {
    if !is_video_id(&video_id) {
        return None;
    }
    // Try the Data API first (gets title + author + duration + chapters). Even
    // when the API succeeds it can come back with duration_sec=0 — e.g. when
    // the user's key has no quota left for contentDetails, or the video is in
    // a state where YouTube returns snippet but not duration. So we hold any
    // API result aside and only return early if duration is already filled.
    let from_api = api_key
        .as_ref()
        .filter(|k| !k.is_empty())
        .and_then(|k| fetch_video_meta_api(&video_id, k));

    let mut meta = match from_api {
        Some(m) => m,
        None => fetch_oembed(&format!("https://www.youtube.com/watch?v={}", video_id))?,
    };

    // Always backfill duration via scrape if it's still missing — regardless
    // of whether API or oEmbed was the source.
    if meta.duration_sec == 0 {
        if let Some(secs) = scrape_watch_page_length_secs(&video_id) {
            meta.duration_sec = secs;
            meta.duration = secs_to_label(secs);
        }
    }
    Some(meta)
}

#[derive(Debug, Serialize)]
pub struct TranscriptCue {
    #[serde(rename = "startSec")]
    start_sec: f64,
    text: String,
}

/// Fetch a YouTube video's transcript via the public timedtext API. Tries
/// English manual captions first, falls back to ASR (auto-generated) captions.
/// Returns an empty vec when no transcript is available — the caller should
/// fall back to "Part N" titles.
#[tauri::command]
fn fetch_youtube_transcript(video_id: String) -> Vec<TranscriptCue> {
    if !is_video_id(&video_id) {
        return Vec::new();
    }
    let attempts = &[
        format!("https://www.youtube.com/api/timedtext?lang=en&v={}", video_id),
        format!("https://www.youtube.com/api/timedtext?lang=en&kind=asr&v={}", video_id),
        format!("https://www.youtube.com/api/timedtext?lang=en-US&v={}", video_id),
        format!("https://www.youtube.com/api/timedtext?lang=en-US&kind=asr&v={}", video_id),
    ];
    for url in attempts {
        let resp = match ureq::get(url)
            .set("User-Agent", ua())
            .set("Accept-Language", "en-US,en;q=0.9")
            .timeout(std::time::Duration::from_secs(6))
            .call()
        {
            Ok(r) => r,
            Err(_) => continue,
        };
        let body = match resp.into_string() {
            Ok(b) => b,
            Err(_) => continue,
        };
        let cues = parse_timedtext_xml(&body);
        if !cues.is_empty() {
            return cues;
        }
    }
    Vec::new()
}

/// Parse a YouTube timedtext XML transcript. Cue lines look like:
///   <text start="3.5" dur="2.0">Hello world</text>
/// We only need start + inner text. Robust to whitespace and missing dur.
fn parse_timedtext_xml(body: &str) -> Vec<TranscriptCue> {
    let mut cues = Vec::new();
    // Match each <text ...>...</text> with start attr and inner content.
    let re = match Regex::new(r#"(?s)<text[^>]*\bstart="([0-9.]+)"[^>]*>(.*?)</text>"#) {
        Ok(r) => r,
        Err(_) => return cues,
    };
    for cap in re.captures_iter(body) {
        let start: f64 = cap.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(-1.0);
        if start < 0.0 { continue; }
        let raw_text = cap.get(2).map(|m| m.as_str()).unwrap_or("");
        // Unescape XML entities + the JSON-style \n that YouTube uses.
        let text = raw_text
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&apos;", "'")
            .replace("\n", " ")
            .trim()
            .to_string();
        if text.is_empty() { continue; }
        cues.push(TranscriptCue { start_sec: start, text });
    }
    cues
}

#[tauri::command]
fn fetch_youtube_playlist_meta(playlist_id: String, api_key: Option<String>) -> Option<FetchedMeta> {
    if !is_playlist_id(&playlist_id) {
        return None;
    }
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            if let Some(meta) = fetch_playlist_meta_api(&playlist_id, key) {
                return Some(meta);
            }
        }
    }
    fetch_oembed(&format!(
        "https://www.youtube.com/playlist?list={}",
        playlist_id
    ))
}

#[tauri::command]
fn fetch_youtube_playlist_videos(playlist_id: String, api_key: Option<String>) -> Vec<PlaylistVideo> {
    if !is_playlist_id(&playlist_id) {
        return Vec::new();
    }
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            if let Some(videos) = fetch_playlist_videos_api(&playlist_id, key) {
                return videos;
            }
        }
    }
    fetch_playlist_videos_impl(&playlist_id)
}

fn resolve_channel_api(handle: &str, api_key: &str) -> Option<ChannelLookup> {
    let h = normalize_handle(handle);
    if h.is_empty() { return None; }

    // Direct channel-ID lookup via channels.list?id=
    if h.starts_with("UC") && h.len() >= 22 {
        let url = format!(
            "https://www.googleapis.com/youtube/v3/channels?part=snippet&id={}&key={}",
            url_encode_simple(&h),
            url_encode_simple(api_key)
        );
        let resp = ureq::get(&url).timeout(std::time::Duration::from_secs(10)).call().ok()?;
        let parsed: YtApiResponse<YtChannelItem> = resp.into_json().ok()?;
        let item = parsed.items?.into_iter().next()?;
        return Some(ChannelLookup {
            channel_id: item.id?,
            name: item.snippet.and_then(|s| s.title).unwrap_or_else(|| h.clone()),
        });
    }

    // Handle lookup via channels.list?forHandle=@xyz
    let with_at = if h.starts_with('@') { h.clone() } else { format!("@{}", h) };
    let url = format!(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle={}&key={}",
        url_encode_simple(&with_at),
        url_encode_simple(api_key)
    );
    let resp = ureq::get(&url).timeout(std::time::Duration::from_secs(10)).call().ok()?;
    let parsed: YtApiResponse<YtChannelItem> = resp.into_json().ok()?;
    let item = parsed.items?.into_iter().next()?;
    Some(ChannelLookup {
        channel_id: item.id?,
        name: item.snippet.and_then(|s| s.title).unwrap_or(with_at),
    })
}

#[derive(Debug, Deserialize)]
struct YtChannelItem {
    id: Option<String>,
    snippet: Option<YtChannelSnippetMini>,
}

#[derive(Debug, Deserialize)]
struct YtChannelSnippetMini {
    title: Option<String>,
}

fn fetch_channel_latest_api(channel_id: &str, api_key: &str) -> Option<ChannelLatest> {
    // search.list with order=date returns recent items. We ask for 8 instead of
    // 1 so we can skip past any Shorts at the top of the channel's feed.
    let url = format!(
        "https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={}&order=date&maxResults=8&type=video&key={}",
        url_encode_simple(channel_id),
        url_encode_simple(api_key)
    );
    let resp = ureq::get(&url).timeout(std::time::Duration::from_secs(10)).call().ok()?;
    let parsed: YtApiResponse<YtSearchItem> = resp.into_json().ok()?;
    let items = parsed.items?;
    // First pass: title-based filter
    let mut candidates: Vec<(String, String, String)> = Vec::new(); // (id, title, publishedAt)
    for item in items {
        let snip = match item.snippet { Some(s) => s, None => continue };
        let video_id = match item.id.and_then(|i| i.video_id) {
            Some(v) => v, None => continue,
        };
        let title = snip.title.unwrap_or_default();
        if title_is_short(&title) { continue; }
        candidates.push((video_id, title, snip.published_at.unwrap_or_default()));
    }
    if candidates.is_empty() {
        return None;
    }
    // Duration check: drop anything ≤ 65s
    let ids: Vec<String> = candidates.iter().map(|c| c.0.clone()).collect();
    let mut shorts: std::collections::HashSet<String> = std::collections::HashSet::new();
    let joined = ids.join(",");
    let dur_url = format!(
        "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={}&key={}",
        url_encode_simple(&joined),
        url_encode_simple(api_key)
    );
    if let Ok(resp) = ureq::get(&dur_url).timeout(std::time::Duration::from_secs(10)).call() {
        if let Ok(parsed) = resp.into_json::<YtApiResponse<YtVideoIdDuration>>() {
            if let Some(items) = parsed.items {
                for it in items {
                    let id = match it.id { Some(s) => s, None => continue };
                    let secs = it.content_details
                        .and_then(|cd| cd.duration)
                        .and_then(|d| iso_duration_seconds(&d))
                        .unwrap_or(u64::MAX);
                    if secs <= 65 { shorts.insert(id); }
                }
            }
        }
    }
    let first = candidates.into_iter().find(|c| !shorts.contains(&c.0))?;
    Some(ChannelLatest {
        channel_id: channel_id.to_string(),
        video_id: first.0,
        title: first.1,
        published_at: first.2,
    })
}

#[derive(Debug, Deserialize)]
struct YtSearchItem {
    id: Option<YtSearchId>,
    snippet: Option<YtVideoSnippet>,
}

#[derive(Debug, Deserialize)]
struct YtSearchId {
    #[serde(rename = "videoId")]
    video_id: Option<String>,
}

#[tauri::command]
fn resolve_channel(handle: String, api_key: Option<String>) -> Option<ChannelLookup> {
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            if let Some(lookup) = resolve_channel_api(&handle, key) {
                return Some(lookup);
            }
        }
    }
    resolve_channel_impl(&handle)
}

#[derive(Debug, Serialize)]
pub struct ChannelRecentVideo {
    #[serde(rename = "videoId")]
    video_id: String,
    title: String,
    #[serde(rename = "publishedAt")]
    published_at: String,
}

/// A YouTube video is treated as a "Short" if:
///   - its title contains the #shorts hashtag (case-insensitive), OR
///   - its duration is ≤ 65 seconds (covers classic 60s shorts).
fn title_is_short(title: &str) -> bool {
    let lower = title.to_lowercase();
    lower.contains("#shorts") || lower.contains("#short ") || lower.ends_with("#short")
}

fn iso_duration_seconds(iso: &str) -> Option<u64> {
    if !iso.starts_with("PT") {
        return None;
    }
    let mut h: u64 = 0;
    let mut m: u64 = 0;
    let mut s: u64 = 0;
    let mut num = String::new();
    for c in iso[2..].chars() {
        if c.is_ascii_digit() {
            num.push(c);
        } else {
            let n: u64 = num.parse().unwrap_or(0);
            num.clear();
            match c {
                'H' => h = n,
                'M' => m = n,
                'S' => s = n,
                _ => {}
            }
        }
    }
    Some(h * 3600 + m * 60 + s)
}

fn fetch_channel_recent_api(channel_id: &str, since_iso: &str, api_key: &str) -> Option<Vec<ChannelRecentVideo>> {
    let url = format!(
        "https://www.googleapis.com/youtube/v3/search?part=snippet&channelId={}&order=date&publishedAfter={}&maxResults=50&type=video&key={}",
        url_encode_simple(channel_id),
        url_encode_simple(since_iso),
        url_encode_simple(api_key)
    );
    let resp = ureq::get(&url).timeout(std::time::Duration::from_secs(12)).call().ok()?;
    let parsed: YtApiResponse<YtSearchItem> = resp.into_json().ok()?;
    let items = parsed.items?;
    let mut candidates: Vec<ChannelRecentVideo> = Vec::new();
    for item in items {
        let snip = match item.snippet { Some(s) => s, None => continue };
        let video_id = match item.id.and_then(|i| i.video_id) {
            Some(v) => v,
            None => continue,
        };
        let title = snip.title.unwrap_or_default();
        // Fast reject: title-based shorts detection before we burn a quota point
        // on a contentDetails batch call.
        if title_is_short(&title) {
            continue;
        }
        candidates.push(ChannelRecentVideo {
            video_id,
            title,
            published_at: snip.published_at.unwrap_or_default(),
        });
    }
    if candidates.is_empty() {
        return Some(Vec::new());
    }
    // Duration-based shorts filter via a single batched videos.list call.
    let ids: Vec<String> = candidates.iter().map(|c| c.video_id.clone()).collect();
    let mut shorts: std::collections::HashSet<String> = std::collections::HashSet::new();
    for chunk in ids.chunks(50) {
        let joined = chunk.join(",");
        let dur_url = format!(
            "https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id={}&key={}",
            url_encode_simple(&joined),
            url_encode_simple(api_key)
        );
        if let Ok(dur_resp) = ureq::get(&dur_url).timeout(std::time::Duration::from_secs(12)).call() {
            if let Ok(parsed) = dur_resp.into_json::<YtApiResponse<YtVideoIdDuration>>() {
                if let Some(items) = parsed.items {
                    for it in items {
                        let id = match it.id { Some(s) => s, None => continue };
                        let secs = it.content_details
                            .and_then(|cd| cd.duration)
                            .and_then(|d| iso_duration_seconds(&d))
                            .unwrap_or(u64::MAX);
                        if secs <= 65 {
                            shorts.insert(id);
                        }
                    }
                }
            }
        }
    }
    let filtered = candidates.into_iter().filter(|c| !shorts.contains(&c.video_id)).collect();
    Some(filtered)
}

fn fetch_channel_recent_rss(channel_id: &str, since_iso: &str) -> Vec<ChannelRecentVideo> {
    let url = format!(
        "https://www.youtube.com/feeds/videos.xml?channel_id={}",
        url_encode_simple(channel_id)
    );
    let body = match ureq::get(&url)
        .set("User-Agent", ua())
        .timeout(std::time::Duration::from_secs(10))
        .call()
    {
        Ok(r) => match r.into_string() { Ok(s) => s, Err(_) => return Vec::new() },
        Err(_) => return Vec::new(),
    };
    let re = Regex::new(
        r#"<entry>[\s\S]*?<yt:videoId>([A-Za-z0-9_-]{11})</yt:videoId>[\s\S]*?<title>([^<]+)</title>[\s\S]*?<published>([^<]+)</published>"#,
    )
    .ok();
    let re = match re { Some(r) => r, None => return Vec::new() };
    let mut out = Vec::new();
    let since_ts = parse_iso_ts(since_iso);
    for caps in re.captures_iter(&body) {
        let pub_at = caps.get(3).map(|m| m.as_str().to_string()).unwrap_or_default();
        if let Some(since) = since_ts {
            if let Some(pub_ts) = parse_iso_ts(&pub_at) {
                if pub_ts < since {
                    continue;
                }
            }
        }
        let title = caps.get(2).map(|m| m.as_str().to_string()).unwrap_or_default();
        // RSS has no duration; the title-hashtag heuristic is all we have here.
        if title_is_short(&title) {
            continue;
        }
        out.push(ChannelRecentVideo {
            video_id: caps.get(1).map(|m| m.as_str().to_string()).unwrap_or_default(),
            title,
            published_at: pub_at,
        });
    }
    out
}

/// Parse ISO 8601 to seconds since epoch (best-effort; supports "2026-06-25T12:34:56Z" and "...+00:00").
fn parse_iso_ts(s: &str) -> Option<i64> {
    // Very small parser: YYYY-MM-DDTHH:MM:SS
    if s.len() < 19 { return None; }
    let y: i64 = s.get(0..4)?.parse().ok()?;
    let mo: i64 = s.get(5..7)?.parse().ok()?;
    let d: i64 = s.get(8..10)?.parse().ok()?;
    let h: i64 = s.get(11..13)?.parse().ok()?;
    let mi: i64 = s.get(14..16)?.parse().ok()?;
    let se: i64 = s.get(17..19)?.parse().ok()?;
    // Days from epoch via a simple algorithm
    let mut days: i64 = 0;
    for yr in 1970..y {
        days += if (yr % 4 == 0 && yr % 100 != 0) || yr % 400 == 0 { 366 } else { 365 };
    }
    let month_days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    for m in 1..mo {
        days += month_days[(m - 1) as usize] as i64;
        if m == 2 && leap { days += 1; }
    }
    days += d - 1;
    Some(days * 86400 + h * 3600 + mi * 60 + se)
}

#[tauri::command]
fn fetch_channel_recent(channel_id: String, since_iso: String, api_key: Option<String>) -> Vec<ChannelRecentVideo> {
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            if let Some(list) = fetch_channel_recent_api(&channel_id, &since_iso, key) {
                return list;
            }
        }
    }
    fetch_channel_recent_rss(&channel_id, &since_iso)
}

#[tauri::command]
fn fetch_channel_latest(channel_id: String, api_key: Option<String>) -> Option<ChannelLatest> {
    if let Some(ref key) = api_key {
        if !key.is_empty() {
            if let Some(latest) = fetch_channel_latest_api(&channel_id, key) {
                return Some(latest);
            }
        }
    }
    fetch_channel_latest_impl(&channel_id)
}

// ============ Google OAuth (device-code flow) + YouTube subscriptions ============

#[derive(Debug, Serialize)]
pub struct GoogleDeviceCode {
    #[serde(rename = "deviceCode")]
    device_code: String,
    #[serde(rename = "userCode")]
    user_code: String,
    #[serde(rename = "verificationUrl")]
    verification_url: String,
    interval: u64,
    #[serde(rename = "expiresIn")]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct GoogleDeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_url: Option<String>,
    verification_uri: Option<String>,
    expires_in: Option<u64>,
    interval: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleTokenResponse {
    #[serde(rename = "accessToken")]
    access_token: String,
    #[serde(rename = "refreshToken")]
    refresh_token: String,
    #[serde(rename = "expiresIn")]
    expires_in: u64,
}

#[derive(Debug, Deserialize)]
struct GoogleTokenRaw {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum GooglePollResult {
    Ok { tokens: GoogleTokenResponse },
    Pending,
    SlowDown,
    Expired,
    Denied,
    Error { message: String },
}

#[derive(Debug, Serialize)]
pub struct YouTubeSubscription {
    #[serde(rename = "channelId")]
    channel_id: String,
    name: String,
    description: String,
    #[serde(rename = "thumbnailUrl")]
    thumbnail_url: String,
}

const YOUTUBE_SCOPE: &str = "https://www.googleapis.com/auth/youtube.readonly";

#[tauri::command]
fn google_start_device_flow(client_id: String) -> Option<GoogleDeviceCode> {
    let res = ureq::post("https://oauth2.googleapis.com/device/code")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .timeout(std::time::Duration::from_secs(10))
        .send_string(&format!(
            "client_id={}&scope={}",
            url_encode_simple(&client_id),
            url_encode_simple(YOUTUBE_SCOPE)
        ))
        .ok()?;
    let raw: GoogleDeviceCodeResponse = res.into_json().ok()?;
    Some(GoogleDeviceCode {
        device_code: raw.device_code,
        user_code: raw.user_code,
        verification_url: raw
            .verification_url
            .or(raw.verification_uri)
            .unwrap_or_else(|| "https://www.google.com/device".to_string()),
        interval: raw.interval.unwrap_or(5),
        expires_in: raw.expires_in.unwrap_or(600),
    })
}

#[tauri::command]
fn google_poll_token(
    client_id: String,
    client_secret: String,
    device_code: String,
) -> GooglePollResult {
    let body = format!(
        "client_id={}&client_secret={}&device_code={}&grant_type={}",
        url_encode_simple(&client_id),
        url_encode_simple(&client_secret),
        url_encode_simple(&device_code),
        url_encode_simple("urn:ietf:params:oauth:grant-type:device_code")
    );
    let resp = ureq::post("https://oauth2.googleapis.com/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .timeout(std::time::Duration::from_secs(10))
        .send_string(&body);

    let raw: GoogleTokenRaw = match resp {
        Ok(r) => match r.into_json() {
            Ok(j) => j,
            Err(e) => return GooglePollResult::Error { message: e.to_string() },
        },
        Err(ureq::Error::Status(_code, r)) => match r.into_json() {
            Ok(j) => j,
            Err(e) => return GooglePollResult::Error { message: e.to_string() },
        },
        Err(e) => return GooglePollResult::Error { message: e.to_string() },
    };

    if let (Some(access), Some(refresh), Some(exp)) =
        (raw.access_token.as_ref(), raw.refresh_token.as_ref(), raw.expires_in)
    {
        return GooglePollResult::Ok {
            tokens: GoogleTokenResponse {
                access_token: access.clone(),
                refresh_token: refresh.clone(),
                expires_in: exp,
            },
        };
    }
    match raw.error.as_deref() {
        Some("authorization_pending") => GooglePollResult::Pending,
        Some("slow_down") => GooglePollResult::SlowDown,
        Some("expired_token") => GooglePollResult::Expired,
        Some("access_denied") => GooglePollResult::Denied,
        Some(other) => GooglePollResult::Error { message: other.to_string() },
        None => GooglePollResult::Error { message: "Unknown response".to_string() },
    }
}

#[tauri::command]
fn google_refresh_token(
    client_id: String,
    client_secret: String,
    refresh_token: String,
) -> Option<GoogleTokenResponse> {
    let body = format!(
        "client_id={}&client_secret={}&refresh_token={}&grant_type=refresh_token",
        url_encode_simple(&client_id),
        url_encode_simple(&client_secret),
        url_encode_simple(&refresh_token)
    );
    let res = ureq::post("https://oauth2.googleapis.com/token")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .timeout(std::time::Duration::from_secs(10))
        .send_string(&body)
        .ok()?;
    let raw: GoogleTokenRaw = res.into_json().ok()?;
    Some(GoogleTokenResponse {
        access_token: raw.access_token?,
        // Refresh token is not always returned on refresh; reuse old one
        refresh_token: raw.refresh_token.unwrap_or(refresh_token),
        expires_in: raw.expires_in.unwrap_or(3600),
    })
}

#[derive(Debug, Deserialize)]
struct YtSubsResponse {
    items: Option<Vec<YtSubItem>>,
    #[serde(rename = "nextPageToken")]
    next_page_token: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtSubItem {
    snippet: Option<YtSubSnippet>,
}

#[derive(Debug, Deserialize)]
struct YtSubSnippet {
    title: Option<String>,
    description: Option<String>,
    #[serde(rename = "resourceId")]
    resource_id: Option<YtResourceId>,
    thumbnails: Option<YtThumbnails>,
}

#[derive(Debug, Deserialize)]
struct YtResourceId {
    #[serde(rename = "channelId")]
    channel_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct YtThumbnails {
    default: Option<YtThumbnail>,
    medium: Option<YtThumbnail>,
}

#[derive(Debug, Deserialize)]
struct YtThumbnail {
    url: Option<String>,
}

#[tauri::command]
fn youtube_list_subscriptions(access_token: String) -> Vec<YouTubeSubscription> {
    let mut out: Vec<YouTubeSubscription> = Vec::new();
    let mut page_token: Option<String> = None;
    for _ in 0..40 {
        let mut url = String::from(
            "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50",
        );
        if let Some(t) = &page_token {
            url.push_str(&format!("&pageToken={}", url_encode_simple(t)));
        }
        let resp = match ureq::get(&url)
            .set("Authorization", &format!("Bearer {}", access_token))
            .timeout(std::time::Duration::from_secs(15))
            .call()
        {
            Ok(r) => r,
            Err(_) => break,
        };
        let parsed: YtSubsResponse = match resp.into_json() {
            Ok(j) => j,
            Err(_) => break,
        };
        if let Some(items) = parsed.items {
            for it in items {
                let snip = match it.snippet {
                    Some(s) => s,
                    None => continue,
                };
                let cid = snip
                    .resource_id
                    .and_then(|r| r.channel_id)
                    .unwrap_or_default();
                if cid.is_empty() {
                    continue;
                }
                let thumb = snip
                    .thumbnails
                    .as_ref()
                    .and_then(|t| t.medium.as_ref().or(t.default.as_ref()))
                    .and_then(|t| t.url.clone())
                    .unwrap_or_default();
                out.push(YouTubeSubscription {
                    channel_id: cid,
                    name: snip.title.unwrap_or_default(),
                    description: snip.description.unwrap_or_default(),
                    thumbnail_url: thumb,
                });
            }
        }
        page_token = parsed.next_page_token;
        if page_token.is_none() {
            break;
        }
    }
    out
}

fn is_video_id(s: &str) -> bool {
    s.len() == 11 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

fn is_playlist_id(s: &str) -> bool {
    s.len() >= 13 && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            remarkable::init_storage(app.handle());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_store,
            write_store,
            fetch_youtube_meta,
            fetch_youtube_transcript,
            fetch_youtube_playlist_meta,
            fetch_youtube_playlist_videos,
            resolve_channel,
            fetch_channel_latest,
            fetch_channel_recent,
            google_start_device_flow,
            google_poll_token,
            google_refresh_token,
            youtube_list_subscriptions,
            pick_note_file,
            remarkable::rm_pair,
            remarkable::rm_unpair,
            remarkable::rm_status,
            remarkable::rm_list_docs,
            remarkable::rm_doc_meta,
            remarkable::rm_diagnose
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
