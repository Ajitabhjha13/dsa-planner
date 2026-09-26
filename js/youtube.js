// =========================================================
// YOUTUBE: playlist import (YouTube Data API v3)
// API key sirf is browser ke localStorage mein alag se save hoti hai.
// Woh backup file mein nahi jaati aur code/GitHub mein bhi nahi.
// =========================================================
const YT_KEY_STORAGE = "dsaPlanner.ytKey";
const DEFAULT_PLAYLIST = "https://www.youtube.com/playlist?list=PLDzeHZWIZsTqNW1gvXXAicBgku9uPZeOC";

const YouTube = {
  getKey() { return localStorage.getItem(YT_KEY_STORAGE) || ""; },
  setKey(k) { k ? localStorage.setItem(YT_KEY_STORAGE, k.trim()) : localStorage.removeItem(YT_KEY_STORAGE); },

  watchUrl(videoId, startSec = 0) {
    const list = Store.state.videos?.playlistId;
    return `https://www.youtube.com/watch?v=${videoId}${list ? `&list=${list}` : ""}${startSec ? `&t=${startSec}s` : ""}`;
  },

  // Link se "list=PL..." nikaalo
  playlistIdFrom(input) {
    const m = String(input).match(/[?&]list=([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{12,}$/.test(input.trim()) ? input.trim() : null;
  },

  // "PT1H2M30S" -> 3750 seconds
  parseDuration(iso) {
    const m = iso?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const [, d, h, mi, s] = m.map(x => Number(x) || 0);
    return d * 86400 + h * 3600 + mi * 60 + s;
  },

  async api(path, params) {
    const url = `https://www.googleapis.com/youtube/v3/${path}?` + new URLSearchParams({ ...params, key: this.getKey() });
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason || "";
      const msg = data?.error?.message || res.statusText;
      if (reason === "API_KEY_HTTP_REFERRER_BLOCKED" || /referer/i.test(msg))
        throw new Error("This website address is not allowed for your key. Open the site at http://127.0.0.1:5500 or http://localhost:5500, or add this address to the key's website restrictions. New restrictions can take up to 5 minutes.");
      if (reason === "keyInvalid" || /API key not valid/i.test(msg)) throw new Error("The API key is not valid. Please check it and paste it again.");
      if (reason === "playlistNotFound") throw new Error("Playlist not found. Is the link correct and is the playlist public?");
      if (reason === "quotaExceeded") throw new Error("Today's free YouTube quota is used up. Try again tomorrow.");
      if (/has not been used|disabled/i.test(msg)) throw new Error("YouTube Data API v3 is not enabled for this project yet. Enable it in Google Cloud and try again.");
      throw new Error(msg);
    }
    return data;
  },

  // Poori playlist: 50-50 ke pages mein items, phir unki duration
  async importPlaylist(playlistId, onProgress = () => {}) {
    const items = [];
    let pageToken = "";
    do {
      const data = await this.api("playlistItems", { part: "snippet,contentDetails,status", maxResults: 50, playlistId, pageToken });
      data.items.forEach(it => {
        const title = it.snippet?.title || "";
        if (title === "Private video" || title === "Deleted video") return; // inhe skip karo
        items.push({ videoId: it.contentDetails.videoId, title, position: it.snippet.position });
      });
      pageToken = data.nextPageToken || "";
      onProgress(`Found ${items.length} videos...`);
    } while (pageToken);

    // Duration: ek request mein 50 video IDs
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50);
      const data = await this.api("videos", { part: "contentDetails", id: batch.map(b => b.videoId).join(",") });
      const dur = Object.fromEntries(data.items.map(v => [v.id, this.parseDuration(v.contentDetails.duration)]));
      batch.forEach(b => { b.durationSec = dur[b.videoId] || 0; });
      onProgress(`Reading durations ${Math.min(i + 50, items.length)} / ${items.length}...`);
    }

    let title = "";
    try {
      const pl = await this.api("playlists", { part: "snippet", id: playlistId });
      title = pl.items?.[0]?.snippet?.title || "";
    } catch { /* naam na mile toh koi baat nahi */ }

    // Purana tier (core/advanced) yaad rakho agar dobara import ho
    const old = Store.state.videos;
    const oldTier = Object.fromEntries((old?.items || []).map(v => [v.videoId, v.tier]));
    const samePlaylist = old?.playlistId === playlistId;
    const added = samePlaylist ? items.filter(v => !(v.videoId in oldTier)).length : items.length;
    const removed = samePlaylist ? old.items.filter(v => !items.some(n => n.videoId === v.videoId)).length : 0;

    items.sort((a, b) => a.position - b.position);
    Store.state.videos = {
      playlistId, title, importedAt: new Date().toISOString(), lastChecked: new Date().toISOString(),
      notice: added && samePlaylist ? { added, removed, on: todayStr() } : old?.notice || null,
      sprintSize: samePlaylist ? old?.sprintSize : undefined,   // minutes of video per sprint
      sprintStart: samePlaylist ? old?.sprintStart : undefined,
      items: items.map((v, i) => ({
        id: `V:${v.videoId}`, videoId: v.videoId, title: v.title, durationSec: v.durationSec,
        position: i + 1, tier: oldTier[v.videoId] || "core",
      })),
    };
    Store.save();
    return { videos: Store.state.videos, added, removed, first: !old?.items?.length };
  },

  // AUTO-CHECK: pichhle check ko 7 din ho gaye? Chupchaap naye lectures dhoondo.
  // Koi bhi error (internet nahi, key nahi) ho toh bas skip, user ko pareshan nahi karna.
  CHECK_EVERY_DAYS: 7,
  checking: false,

  isCheckDue() {
    const v = Store.state.videos;
    if (!v?.items?.length || !this.getKey() || this.checking) return false;
    const last = new Date(v.lastChecked || v.importedAt).getTime();
    return Date.now() - last > this.CHECK_EVERY_DAYS * 86400000;
  },

  async checkForNew() {
    this.checking = true;
    try {
      return await this.importPlaylist(Store.state.videos.playlistId);
    } finally {
      this.checking = false;
    }
  },
};
