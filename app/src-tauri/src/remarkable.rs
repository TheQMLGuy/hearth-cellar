//! reMarkable cloud integration.
//!
//! Unofficial community-documented endpoints. Pairing exchanges an 8-character
//! one-time code from `my.remarkable.com/device/desktop/connect` for a
//! long-lived **device token** (JWT). The device token is exchanged for a
//! short-lived **user token** (~1h TTL) which is used for document API calls.
//!
//! The device token is persisted to a small JSON file in the Tauri app config
//! directory. The user token lives in process memory only and is refreshed
//! lazily.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::Manager;

const PAIR_URL: &str =
    "https://webapp-prod.cloud.remarkable.engineering/token/json/2/device/new";
const USER_TOKEN_URL: &str =
    "https://webapp-prod.cloud.remarkable.engineering/token/json/2/user/new";
// The current listing protocol (verified against rmapi-js canonical client):
//   1. GET <RAW_HOST>/sync/v4/root  →  JSON {hash, generation, schemaVersion}
//   2. GET <RAW_HOST>/sync/v3/files/<root_hash>
//        Header: rm-filename: root.docSchema
//        →  text manifest, one document entry per line
//   3. For each top-level document, GET /sync/v3/files/<item_hash>
//        Header: rm-filename: <docId>.docSchema
//        →  text manifest of subfiles
//   4. Find the .metadata subfile, GET /sync/v3/files/<meta_hash>
//        Header: rm-filename: <docId>.metadata
//        →  JSON {visibleName, type, parent, lastModified, ...}
//
// The `rm-filename` header is MANDATORY on every /sync/v3/files/* fetch —
// the backend uses it for filename validation and 400s any request without it.
// `/doc/v2/files` is a write/single-doc API on tectonic, NOT a listing
// endpoint — every method we probed there 4xx'd because we were on the
// wrong URL family entirely.
const SYNC_ROOT_URL_EU: &str = "https://eu.tectonic.remarkable.com/sync/v4/root";
const SYNC_ROOT_URL_US: &str = "https://tectonic.remarkable.com/sync/v4/root";
const SYNC_FILES_BASE_EU: &str = "https://eu.tectonic.remarkable.com/sync/v3/files/";
const SYNC_FILES_BASE_US: &str = "https://tectonic.remarkable.com/sync/v3/files/";
// Legacy endpoints kept as last-ditch fallbacks for very old accounts.
const DOCS_URL_V2: &str =
    "https://document-storage-production-dot-remarkable-production.appspot.com/document-storage/json/2/docs";
const DISCOVERY_URL_BASE: &str =
    "https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1/document-storage?environment=production&apiVer=2";
const BROWSER_UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RmDoc {
    pub uuid: String,
    pub name: String,
    pub parent: Option<String>,
    #[serde(rename = "type")]
    pub doc_type: String,
    #[serde(rename = "lastModified")]
    pub last_modified: String,
}

#[derive(Debug, Serialize, Default)]
pub struct RmStatus {
    pub paired: bool,
    #[serde(rename = "lastSync")]
    pub last_sync: Option<String>,
    #[serde(rename = "docCount")]
    pub doc_count: u32,
}

#[derive(Debug, Deserialize)]
struct RmListItem {
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "VissibleName", alias = "VisibleName")]
    visible_name: String,
    #[serde(rename = "Type")]
    item_type: String,
    #[serde(rename = "Parent")]
    parent: Option<String>,
    #[serde(rename = "ModifiedClient")]
    modified_client: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct PersistedAuth {
    #[serde(default)]
    device_token: String,
    #[serde(default)]
    device_id: String,
}

struct UserTokenCache {
    token: String,
    fetched_at: std::time::Instant,
}

static USER_TOKEN: Mutex<Option<UserTokenCache>> = Mutex::new(None);
static AUTH_PATH: Mutex<Option<std::path::PathBuf>> = Mutex::new(None);

/// Called from the Tauri setup hook so we know where the app's config dir is.
pub fn init_storage(app: &tauri::AppHandle) {
    if let Ok(mut path) = AUTH_PATH.lock() {
        if let Ok(dir) = app.path().app_config_dir() {
            let _ = std::fs::create_dir_all(&dir);
            *path = Some(dir.join("remarkable.json"));
        }
    }
}

fn auth_path() -> Option<std::path::PathBuf> {
    AUTH_PATH.lock().ok().and_then(|p| p.clone())
}

fn load_auth() -> PersistedAuth {
    let Some(path) = auth_path() else { return PersistedAuth::default() };
    let Ok(bytes) = std::fs::read(&path) else { return PersistedAuth::default() };
    serde_json::from_slice(&bytes).unwrap_or_default()
}

fn save_auth(a: &PersistedAuth) -> Result<(), String> {
    let path = auth_path().ok_or_else(|| "config dir not initialised".to_string())?;
    let bytes = serde_json::to_vec(a).map_err(|e| format!("serialize: {}", e))?;
    std::fs::write(&path, bytes).map_err(|e| format!("write: {}", e))
}

/// Ad-hoc unique device id. reMarkable's pairing endpoint accepts any
/// non-empty string here; we just need stability across pair calls on the
/// same install. Built from process pid + system nanos + a 16-byte
/// std-random sample, formatted as a uuid-like hex string.
fn make_device_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let pid = std::process::id() as u128;
    let mix = nanos ^ (pid << 64);
    format!(
        "{:08x}-{:04x}-{:04x}-{:04x}-{:012x}",
        (mix as u32),
        ((mix >> 32) & 0xffff) as u32,
        (((mix >> 48) & 0x0fff) | 0x4000) as u32, // version 4 nibble
        (((mix >> 64) & 0x3fff) | 0x8000) as u32, // variant nibble
        ((mix >> 80) & 0xffff_ffff_ffff)
    )
}

fn get_or_create_device_id() -> String {
    let mut a = load_auth();
    if !a.device_id.is_empty() {
        return a.device_id;
    }
    a.device_id = make_device_id();
    let _ = save_auth(&a);
    a.device_id
}

fn save_device_token(token: &str) -> Result<(), String> {
    let mut a = load_auth();
    a.device_token = token.to_string();
    if a.device_id.is_empty() {
        a.device_id = make_device_id();
    }
    save_auth(&a)
}

fn load_device_token() -> Option<String> {
    let a = load_auth();
    if a.device_token.is_empty() { None } else { Some(a.device_token) }
}

fn clear_device_token() {
    let mut a = load_auth();
    a.device_token.clear();
    let _ = save_auth(&a);
    if let Ok(mut cache) = USER_TOKEN.lock() {
        *cache = None;
    }
}

/// Extract a JWT from a possibly-wrapped response body. Mirrors ember's
/// `RemarkableBridge.extractJwt`. The /user/new endpoint historically
/// returned a bare JWT but newer variants wrap it in JSON like
/// `{"access_token":"..."}` or `{"token":"..."}` or a JSON-quoted bare string.
/// If we pass the wrapped JSON verbatim as a Bearer token, tectonic 405s
/// because the credential is malformed.
fn extract_jwt(raw: &str) -> String {
    let trimmed = raw.trim();
    // JSON-wrapped: {"access_token":"eyJ..."} or {"token":"..."}
    if trimmed.starts_with('{') {
        if let Ok(j) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Some(s) = j.get("access_token").and_then(|v| v.as_str()) {
                if !s.trim().is_empty() {
                    return s.trim().to_string();
                }
            }
            if let Some(s) = j.get("token").and_then(|v| v.as_str()) {
                if !s.trim().is_empty() {
                    return s.trim().to_string();
                }
            }
        }
    }
    // JSON-quoted bare string: "eyJ..."
    if trimmed.len() >= 2 && trimmed.starts_with('"') && trimmed.ends_with('"') {
        return trimmed[1..trimmed.len() - 1].to_string();
    }
    // Raw JWT.
    trimmed.to_string()
}

fn fetch_user_token(device_token: &str) -> Result<String, String> {
    let resp = ureq::post(USER_TOKEN_URL)
        .set("Authorization", &format!("Bearer {}", device_token))
        .set("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(15))
        .send_string("{}");
    let raw = match resp {
        Ok(r) => r.into_string().map_err(|e| format!("user token body: {}", e))?,
        Err(e) => return Err(format!("user token req: {}", e)),
    };
    let token = extract_jwt(&raw);
    if !token.starts_with("eyJ") {
        return Err(format!(
            "user token doesn't look like a JWT (first 60 chars: {})",
            token.chars().take(60).collect::<String>()
        ));
    }
    Ok(token)
}

fn current_user_token() -> Result<String, String> {
    let device = load_device_token().ok_or_else(|| "not paired".to_string())?;
    let mut cache = USER_TOKEN.lock().map_err(|e| format!("lock: {}", e))?;
    let fresh = match cache.as_ref() {
        Some(c) if c.fetched_at.elapsed() < std::time::Duration::from_secs(50 * 60) => true,
        _ => false,
    };
    if fresh {
        return Ok(cache.as_ref().unwrap().token.clone());
    }
    let token = fetch_user_token(&device)?;
    *cache = Some(UserTokenCache {
        token: token.clone(),
        fetched_at: std::time::Instant::now(),
    });
    Ok(token)
}

#[tauri::command]
pub fn rm_pair(code: String) -> Result<(), String> {
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err("Empty pairing code.".into());
    }
    let device_id = get_or_create_device_id();
    let body = serde_json::json!({
        "code": code,
        "deviceDesc": "desktop-windows",
        "deviceID": device_id,
    });
    let resp = ureq::post(PAIR_URL)
        .set("Content-Type", "application/json")
        .timeout(std::time::Duration::from_secs(15))
        .send_string(&body.to_string())
        .map_err(|e| format!(
            "Pair request failed — code may be invalid or expired ({}).",
            e
        ))?;
    let raw = resp.into_string().map_err(|e| format!("pair body: {}", e))?;
    let token = extract_jwt(&raw);
    if token.is_empty() || !token.starts_with("eyJ") {
        return Err(format!(
            "Pair response wasn't a JWT (got: {})",
            raw.chars().take(120).collect::<String>()
        ));
    }
    save_device_token(&token)?;
    // Wipe any cached user token so the next call mints a fresh one against
    // the (possibly new) device token, even within the same process.
    if let Ok(mut cache) = USER_TOKEN.lock() {
        *cache = None;
    }
    let _ = fetch_user_token(&token);
    Ok(())
}

#[tauri::command]
pub fn rm_unpair() -> Result<(), String> {
    clear_device_token();
    Ok(())
}

#[tauri::command]
pub fn rm_status() -> RmStatus {
    let paired = load_device_token().is_some();
    RmStatus { paired, last_sync: None, doc_count: 0 }
}

/// Decode the user-id segment from a JWT payload. Doesn't verify the signature
/// — we just need the `auth0-userid` (or fallback `userid`) claim for the
/// discovery URL.
fn jwt_user_id(jwt: &str) -> Option<String> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() < 2 { return None; }
    // base64url decode without padding
    fn b64url_decode(s: &str) -> Option<Vec<u8>> {
        // pad to multiple of 4
        let mut padded = s.replace('-', "+").replace('_', "/");
        while padded.len() % 4 != 0 { padded.push('='); }
        // tiny self-contained base64 decode (avoid pulling in a crate)
        let chars: Vec<u8> = padded.into_bytes();
        let mut out: Vec<u8> = Vec::with_capacity(chars.len() * 3 / 4);
        let mut buf: u32 = 0;
        let mut bits: u32 = 0;
        for &c in chars.iter() {
            if c == b'=' { break; }
            let v: u32 = match c {
                b'A'..=b'Z' => (c - b'A') as u32,
                b'a'..=b'z' => (c - b'a') as u32 + 26,
                b'0'..=b'9' => (c - b'0') as u32 + 52,
                b'+' => 62,
                b'/' => 63,
                _ => return None,
            };
            buf = (buf << 6) | v;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push(((buf >> bits) & 0xff) as u8);
            }
        }
        Some(out)
    }
    let payload_bytes = b64url_decode(parts[1])?;
    let payload: serde_json::Value = serde_json::from_slice(&payload_bytes).ok()?;
    // Try a couple of common claim names.
    if let Some(s) = payload.get("auth0-userid").and_then(|v| v.as_str()) {
        return Some(s.strip_prefix("auth0|").unwrap_or(s).to_string());
    }
    if let Some(s) = payload.get("userid").and_then(|v| v.as_str()) {
        return Some(s.strip_prefix("auth0|").unwrap_or(s).to_string());
    }
    None
}

fn try_v2_docs(token: &str) -> Result<Vec<RmListItem>, String> {
    let resp = ureq::get(DOCS_URL_V2)
        .set("Authorization", &format!("Bearer {}", token))
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|e| format!("v2 docs req failed: {}", e))?;
    resp.into_json::<Vec<RmListItem>>()
        .map_err(|e| format!("v2 docs body: {}", e))
}

fn try_discovery_docs(token: &str) -> Result<Vec<RmListItem>, String> {
    let user_id = jwt_user_id(token).ok_or_else(|| "no user id in token".to_string())?;
    let discovery = format!(
        "{}&group=auth0%7C{}",
        DISCOVERY_URL_BASE,
        user_id
    );
    #[derive(Deserialize)]
    struct DiscoveryResp { #[serde(rename = "Host")] host: Option<String> }
    let dresp = ureq::get(&discovery)
        .set("Authorization", &format!("Bearer {}", token))
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| format!("discovery req: {}", e))?;
    let d: DiscoveryResp = dresp
        .into_json()
        .map_err(|e| format!("discovery body: {}", e))?;
    let host = d.host.ok_or_else(|| "discovery returned no host".to_string())?;
    let docs_url = format!("https://{}/document-storage/json/2/docs", host);
    let resp = ureq::get(&docs_url)
        .set("Authorization", &format!("Bearer {}", token))
        .timeout(std::time::Duration::from_secs(20))
        .call()
        .map_err(|e| format!("discovered docs req: {}", e))?;
    resp.into_json::<Vec<RmListItem>>()
        .map_err(|e| format!("discovered docs body: {}", e))
}

// ============== tectonic backend listing ==============
//
// As of mid-2023 reMarkable migrated the document API away from the
// `document-storage-production-...appspot.com` GAE host (and the v3 sync
// blob-store that we'd misread as the listing API) to a single endpoint
// on the "tectonic" backend:
//
//   GET https://eu.tectonic.remarkable.com/doc/v2/files
//     Authorization: Bearer <user_token>
//     rm-source:     RoR-Browser
//
// Returns a flat JSON array of all the user's docs/collections. The
// `rm-source` header is allowlisted on the backend — anything else
// (including a missing header) is silently rejected. EU host first; US
// users hit `tectonic.remarkable.com`.
//
// Source: rmapi-js (Erik Brinkman, active 2024-25 client) + this repo's
// sibling Ember app, which uses this exact endpoint successfully.

fn parse_tectonic_response(body: &str) -> Result<Vec<RmListItem>, String> {
    let arr: serde_json::Value = serde_json::from_str(body)
        .map_err(|e| format!("tectonic body not JSON: {} (first 120 chars: {})", e, body.chars().take(120).collect::<String>()))?;
    let items = arr.as_array().ok_or_else(|| format!("tectonic body wasn't an array: {}", body.chars().take(120).collect::<String>()))?;

    let mut out = Vec::with_capacity(items.len());
    for o in items {
        // Be tolerant of both new lowercase (id, name, type, parent,
        // lastModified) and legacy uppercase (ID, VissibleName, Type, Parent,
        // ModifiedClient) field names — the tectonic backend has been seen
        // shipping both shapes on different routes.
        let id = o.get("id").or_else(|| o.get("ID"))
            .and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let name = o.get("name").or_else(|| o.get("VissibleName")).or_else(|| o.get("visibleName"))
            .and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let item_type = o.get("type").or_else(|| o.get("Type"))
            .and_then(|v| v.as_str()).unwrap_or_default().to_string();
        let parent = o.get("parent").or_else(|| o.get("Parent"))
            .and_then(|v| v.as_str()).map(|s| s.to_string());
        let last_modified = o.get("lastModified").or_else(|| o.get("ModifiedClient"))
            .and_then(|v| v.as_str()).map(|s| s.to_string());

        if id.is_empty() { continue; }
        // Filter out folders/collections — the UI is picking a single document
        // to attach, not a folder.
        if !item_type.is_empty() && item_type != "DocumentType" && item_type != "document" {
            continue;
        }

        out.push(RmListItem {
            id,
            visible_name: name,
            item_type: if item_type.is_empty() { "DocumentType".into() } else { item_type },
            parent,
            modified_client: last_modified,
        });
    }
    Ok(out)
}

// ============== Sync v4/v3 listing (canonical, per rmapi-js) ==============

#[derive(Deserialize)]
struct SyncRoot {
    hash: String,
    #[allow(dead_code)]
    generation: u64,
    #[serde(rename = "schemaVersion")]
    #[allow(dead_code)]
    schema_version: Option<u8>,
}

#[derive(Deserialize)]
struct V3Metadata {
    #[serde(rename = "visibleName")]
    visible_name: Option<String>,
    #[serde(rename = "type")]
    doc_type: Option<String>,
    parent: Option<String>,
    #[serde(rename = "lastModified")]
    last_modified: Option<String>,
}

/// One line of a sync-v3 manifest text.
///
/// Schema 3 lines: `<hash>:<flags>:<id>:<subfiles>:<size>`
/// Schema 4 lines: `<hash>:<flags>:<id>:<subfiles>:<size>` (after a leading
/// `0:<name>:<entry_count>:<total_size>` header on line 2 of the schema-4
/// stream — we just skip header-shaped lines).
struct ManifestEntry {
    hash: String,
    id: String,
}

fn parse_manifest(text: &str) -> Vec<ManifestEntry> {
    let mut out = Vec::new();
    let mut lines = text.lines();
    let _version = lines.next(); // "3" or "4"
    for line in lines {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() < 5 { continue; }
        let hash = parts[0];
        let id = parts[2];
        // Skip schema-4 header lines (hash="0", different structure).
        if hash == "0" || hash.len() < 32 || id.is_empty() {
            continue;
        }
        out.push(ManifestEntry { hash: hash.to_string(), id: id.to_string() });
    }
    out
}

fn fetch_root_hash(host_root_url: &str, token: &str) -> Result<String, String> {
    let resp = ureq::get(host_root_url)
        .set("Authorization", &format!("Bearer {}", token))
        .set("User-Agent", BROWSER_UA)
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| format!("GET {}: {}", host_root_url, e))?;
    let root: SyncRoot = resp
        .into_json()
        .map_err(|e| format!("parse /sync/v4/root JSON: {}", e))?;
    Ok(root.hash)
}

/// Fetch a blob from /sync/v3/files/<hash> with the mandatory rm-filename
/// header. Returns the body as text (manifests) or bytes-as-string (metadata).
fn fetch_sync_file(files_base: &str, token: &str, hash: &str, filename: &str) -> Result<String, String> {
    let url = format!("{}{}", files_base, hash);
    let resp = ureq::get(&url)
        .set("Authorization", &format!("Bearer {}", token))
        .set("User-Agent", BROWSER_UA)
        .set("rm-filename", filename)
        .timeout(std::time::Duration::from_secs(15))
        .call()
        .map_err(|e| format!("GET sync/v3/files/{}: {}", &hash[..hash.len().min(8)], e))?;
    resp.into_string().map_err(|e| format!("read body: {}", e))
}

/// Fully implement the rmapi-js listing flow against a single region's host.
fn fetch_documents_from(host_root_url: &str, files_base: &str, token: &str) -> Result<Vec<RmListItem>, String> {
    let root_hash = fetch_root_hash(host_root_url, token)?;
    let root_manifest = fetch_sync_file(files_base, token, &root_hash, "root.docSchema")?;
    let entries = parse_manifest(&root_manifest);
    if entries.is_empty() {
        return Err(format!("root manifest had 0 entries (body: {})",
            root_manifest.chars().take(120).collect::<String>()));
    }

    use std::sync::{Arc, Mutex};
    use std::thread;

    let files_base_owned = files_base.to_string();
    let token_owned = token.to_string();
    let queue: Arc<Mutex<Vec<ManifestEntry>>> = Arc::new(Mutex::new(entries));
    let results: Arc<Mutex<Vec<RmListItem>>> = Arc::new(Mutex::new(Vec::new()));

    let mut handles = Vec::new();
    for _ in 0..8 {
        let files_base = files_base_owned.clone();
        let token = token_owned.clone();
        let queue = queue.clone();
        let results = results.clone();
        handles.push(thread::spawn(move || loop {
            let task = { let mut q = queue.lock().expect("queue lock"); q.pop() };
            let entry = match task { Some(e) => e, None => break };

            // Step 3: fetch the doc's inner manifest.
            let inner_filename = format!("{}.docSchema", entry.id);
            let inner_text = match fetch_sync_file(&files_base, &token, &entry.hash, &inner_filename) {
                Ok(t) => t,
                Err(_) => continue,
            };
            // Step 4: walk to find <id>.metadata blob hash.
            let target_meta_name = format!("{}.metadata", entry.id);
            let mut meta_hash: Option<String> = None;
            for line in inner_text.lines().skip(1) {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() < 3 { continue; }
                if parts[2] == target_meta_name {
                    meta_hash = Some(parts[0].to_string());
                    break;
                }
            }
            let meta_hash = match meta_hash { Some(h) => h, None => continue };
            let meta_text = match fetch_sync_file(&files_base, &token, &meta_hash, &target_meta_name) {
                Ok(t) => t,
                Err(_) => continue,
            };
            let meta: V3Metadata = match serde_json::from_str(&meta_text) {
                Ok(m) => m,
                Err(_) => continue,
            };
            results.lock().expect("results lock").push(RmListItem {
                id: entry.id,
                visible_name: meta.visible_name.unwrap_or_default(),
                item_type: meta.doc_type.unwrap_or_default(),
                parent: meta.parent,
                modified_client: meta.last_modified,
            });
        }));
    }
    for h in handles { let _ = h.join(); }
    let r = Arc::try_unwrap(results)
        .map_err(|_| "results Arc still has refs".to_string())?
        .into_inner()
        .map_err(|_| "results lock poisoned".to_string())?;
    Ok(r)
}

/// Wrapper that pushes the sync ureq work to tokio's blocking thread pool
/// so the renderer's invoke promise yields back immediately while the
/// network I/O actually runs. Without this, six 8s probes (worst case) keep
/// a Tauri command-pool worker busy and the UI feels frozen.
#[tauri::command]
pub async fn rm_list_docs() -> Result<Vec<RmDoc>, String> {
    tauri::async_runtime::spawn_blocking(rm_list_docs_sync)
        .await
        .map_err(|e| format!("join: {}", e))?
}

fn rm_list_docs_sync() -> Result<Vec<RmDoc>, String> {
    let token = current_user_token()?;
    // Sync v4 root → v3 files walk (rmapi-js canonical flow). Try EU host
    // first, US fallback. Legacy v2/discovery only as a last-ditch attempt
    // for accounts that never migrated.
    let items = match fetch_documents_from(SYNC_ROOT_URL_EU, SYNC_FILES_BASE_EU, &token) {
        Ok(v) if !v.is_empty() => v,
        eu_result => {
            let eu_err = match eu_result {
                Ok(_) => "EU sync returned 0 docs".to_string(),
                Err(e) => e,
            };
            match fetch_documents_from(SYNC_ROOT_URL_US, SYNC_FILES_BASE_US, &token) {
                Ok(v) if !v.is_empty() => v,
                us_result => {
                    let us_err = match us_result {
                        Ok(_) => "US sync returned 0 docs".to_string(),
                        Err(e) => e,
                    };
                    match try_v2_docs(&token) {
                        Ok(v) => v,
                        Err(v2err) => match try_discovery_docs(&token) {
                            Ok(v) => v,
                            Err(discerr) => {
                                return Err(format!(
                                    "All reMarkable sync endpoints failed:\n\nEU sync (v4 root + v3 files): {}\nUS sync: {}\nLegacy v2 docs: {}\nDiscovery: {}\n\nThe Local file tab still works.",
                                    eu_err, us_err, v2err, discerr
                                ));
                            }
                        },
                    }
                }
            }
        }
    };
    Ok(items
        .into_iter()
        .map(|it| RmDoc {
            uuid: it.id,
            name: it.visible_name,
            parent: it.parent,
            doc_type: it.item_type,
            last_modified: it.modified_client.unwrap_or_default(),
        })
        .collect())
}

#[tauri::command]
pub async fn rm_doc_meta(uuid: String) -> Result<Option<RmDoc>, String> {
    let docs = tauri::async_runtime::spawn_blocking(rm_list_docs_sync)
        .await
        .map_err(|e| format!("join: {}", e))??;
    Ok(docs.into_iter().find(|d| d.uuid == uuid))
}

/// Walks the auth + listing flow step-by-step and reports what each
/// returns. Lets us see exactly where reMarkable is rejecting, instead of
/// guessing at the modal's generic error. Output is plain text, designed
/// to be copy-pasteable.
#[tauri::command]
pub async fn rm_diagnose() -> String {
    tauri::async_runtime::spawn_blocking(rm_diagnose_sync)
        .await
        .unwrap_or_else(|e| format!("(diagnose join error: {})", e))
}

fn rm_diagnose_sync() -> String {
    let mut out = String::new();
    out.push_str("=== reMarkable diagnostic ===\n\n");

    // 1. Device token state
    let device = load_device_token();
    match &device {
        None => {
            out.push_str("[1] device token: NOT PAIRED\n");
            out.push_str("→ Open Settings → reMarkable and pair first.\n");
            return out;
        }
        Some(t) => {
            let looks_jwt = t.starts_with("eyJ");
            out.push_str(&format!(
                "[1] device token: present, {} chars, JWT-shape={}, head={}\n",
                t.len(),
                looks_jwt,
                t.chars().take(20).collect::<String>()
            ));
            if !looks_jwt {
                out.push_str("→ Saved device token isn't a JWT. Unpair and re-pair to fix.\n");
                return out;
            }
        }
    }
    let device_token = device.unwrap();

    // 2. Mint user token (skipping cache to force a fresh round-trip)
    if let Ok(mut cache) = USER_TOKEN.lock() { *cache = None; }
    let user_token = match fetch_user_token(&device_token) {
        Ok(t) => {
            out.push_str(&format!(
                "[2] user token mint: OK, {} chars, head={}\n",
                t.len(),
                t.chars().take(20).collect::<String>()
            ));
            t
        }
        Err(e) => {
            out.push_str(&format!("[2] user token mint: FAILED\n     {}\n", e));
            return out;
        }
    };

    // 3. Decode JWT payload claims so we can see what tectonic might want
    if let Some(claims) = jwt_payload(&user_token) {
        let iss = claims.get("iss").and_then(|v| v.as_str()).unwrap_or("?");
        let aud = claims.get("aud").map(|v| v.to_string()).unwrap_or_else(|| "?".into());
        let sub = claims.get("sub").and_then(|v| v.as_str()).unwrap_or("?");
        let auth0 = claims.get("auth0-userid").and_then(|v| v.as_str()).unwrap_or("?");
        out.push_str(&format!(
            "[3] JWT claims: iss={} aud={} sub={} auth0-userid={}\n",
            iss,
            aud.chars().take(40).collect::<String>(),
            sub,
            auth0
        ));
    } else {
        out.push_str("[3] JWT claims: could not decode payload\n");
    }

    // 4. Test each step of the rmapi-js canonical listing flow individually
    //    so we can see which step actually breaks for this account.
    //    Step A: GET /sync/v4/root
    let root_hash = match (|| -> Result<String, String> {
        let resp = ureq::get(SYNC_ROOT_URL_EU)
            .set("Authorization", &format!("Bearer {}", user_token))
            .set("User-Agent", BROWSER_UA)
            .timeout(std::time::Duration::from_secs(15))
            .call()
            .map_err(|e| format!("transport: {}", e))?;
        let status = resp.status();
        let body = resp.into_string().unwrap_or_default();
        out.push_str(&format!("[4A GET /sync/v4/root] status={} body[0..200]={}\n", status, body.chars().take(200).collect::<String>()));
        let root: SyncRoot = serde_json::from_str(&body).map_err(|e| format!("parse: {}", e))?;
        Ok(root.hash)
    })() {
        Ok(h) => h,
        Err(e) => { out.push_str(&format!("    → step A failed: {}\n", e)); return out; }
    };

    //    Step B: GET /sync/v3/files/<root_hash> with rm-filename: root.docSchema
    let manifest = match (|| -> Result<String, String> {
        let url = format!("{}{}", SYNC_FILES_BASE_EU, root_hash);
        let resp = ureq::get(&url)
            .set("Authorization", &format!("Bearer {}", user_token))
            .set("User-Agent", BROWSER_UA)
            .set("rm-filename", "root.docSchema")
            .timeout(std::time::Duration::from_secs(15))
            .call()
            .map_err(|e| format!("transport: {}", e))?;
        let status = resp.status();
        let body = resp.into_string().unwrap_or_default();
        out.push_str(&format!("[4B GET /sync/v3/files/<root_hash>] status={} body[0..300]={}\n", status, body.chars().take(300).collect::<String>()));
        if status / 100 != 2 { return Err(format!("HTTP {}", status)); }
        Ok(body)
    })() {
        Ok(b) => b,
        Err(e) => { out.push_str(&format!("    → step B failed: {}\n", e)); return out; }
    };

    //    Step C: parse manifest entries
    let entries = parse_manifest(&manifest);
    out.push_str(&format!("[4C parse] root manifest yielded {} document entries\n", entries.len()));
    if !entries.is_empty() {
        let preview: Vec<String> = entries.iter().take(3).map(|e| e.id.clone()).collect();
        out.push_str(&format!("    first ids: {:?}\n", preview));
    }
    out
}

/// Decode a JWT payload to its JSON claims for inspection. Doesn't verify
/// the signature — diagnostic only.
fn jwt_payload(jwt: &str) -> Option<serde_json::Value> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() < 2 { return None; }
    let mut padded = parts[1].replace('-', "+").replace('_', "/");
    while padded.len() % 4 != 0 { padded.push('='); }
    // tiny inline base64 decode (mirrors jwt_user_id's helper)
    let chars: Vec<u8> = padded.into_bytes();
    let mut bytes: Vec<u8> = Vec::with_capacity(chars.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &c in chars.iter() {
        if c == b'=' { break; }
        let v: u32 = match c {
            b'A'..=b'Z' => (c - b'A') as u32,
            b'a'..=b'z' => (c - b'a') as u32 + 26,
            b'0'..=b'9' => (c - b'0') as u32 + 52,
            b'+' => 62,
            b'/' => 63,
            _ => return None,
        };
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push(((buf >> bits) & 0xff) as u8);
        }
    }
    serde_json::from_slice(&bytes).ok()
}
