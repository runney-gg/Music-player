// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let isPlaying      = false;
let isYouTube      = false;
let isPlaylist     = false;
let isShuffle      = false;
let ytPlayer       = null;
let ytReady        = false;
let ytInterval     = null;
let volumeVal      = 0.7;
let isMuted        = false;
let pendingLoad    = null;

// ─────────────────────────────────────────────────────────────────────────────
// DOM refs
// ─────────────────────────────────────────────────────────────────────────────
const audio           = document.getElementById("audio");
const playPauseBtn    = document.getElementById("playPauseBtn");
const playIcon        = document.getElementById("playIcon");
const pauseIcon       = document.getElementById("pauseIcon");
const muteBtn         = document.getElementById("muteBtn");
const progressBar     = document.getElementById("progressBar");
const progressFill    = document.getElementById("progressFill");
const currentTimeEl   = document.getElementById("currentTime");
const durationEl      = document.getElementById("duration");
const songTitleEl     = document.getElementById("song-title");
const songSubtitle    = document.getElementById("song-subtitle");
const thumbnail       = document.getElementById("thumbnail");
const spinningOverlay = document.getElementById("spinningOverlay");
const statusPill      = document.getElementById("statusPill");
const loadBtn         = document.getElementById("loadBtn");
const playlistBar     = document.getElementById("playlistBar");
const trackCounter    = document.getElementById("trackCounter");
const shuffleBtn      = document.getElementById("shuffleBtn");
const prevBtn         = document.getElementById("prevBtn");
const nextBtn         = document.getElementById("nextBtn");

// ─────────────────────────────────────────────────────────────────────────────
// Copyright year + ripple
// ─────────────────────────────────────────────────────────────────────────────
document.getElementById("copy-year").textContent = new Date().getFullYear();

document.addEventListener("click", function(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const ripple = document.createElement("span");
    const rect   = btn.getBoundingClientRect();
    const size   = Math.max(rect.width, rect.height);
    ripple.classList.add("ripple-effect");
    ripple.style.width  = size + "px";
    ripple.style.height = size + "px";
    ripple.style.left   = (e.clientX - rect.left - size / 2) + "px";
    ripple.style.top    = (e.clientY - rect.top  - size / 2) + "px";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
});

// ─────────────────────────────────────────────────────────────────────────────
// YouTube IFrame API — called automatically by YouTube script when ready
// ─────────────────────────────────────────────────────────────────────────────
function onYouTubeIframeAPIReady() {
    ytReady = true;
    hideStatus();
    if (pendingLoad) {
        const p = pendingLoad;
        pendingLoad = null;
        p.type === "playlist" ? createYTPlaylist(p.id) : createYTVideo(p.id);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Wait for API helper — polls until ready then runs callback
// ─────────────────────────────────────────────────────────────────────────────
function waitForYTReady(callback) {
    if (ytReady) {
        callback();
    } else {
        showStatus("Loading YouTube API...", "info");
        const poll = setInterval(() => {
            if (ytReady) {
                clearInterval(poll);
                hideStatus();
                callback();
            }
        }, 100);
        // Timeout after 10 seconds
        setTimeout(() => {
            clearInterval(poll);
            if (!ytReady) showStatus("❌ YouTube API failed to load. Try refreshing the page.", "error");
        }, 10000);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create YT player — single video
// ─────────────────────────────────────────────────────────────────────────────
function createYTVideo(videoId) {
    destroyYT();
    isPlaylist = false;
    showPlaylistBar(false);

    // yt-player must be visible for YT API to work
    const ytDiv = document.getElementById("yt-player");
    ytDiv.style.display = "block";
    ytDiv.style.position = "absolute";
    ytDiv.style.opacity = "0";
    ytDiv.style.pointerEvents = "none";
    ytDiv.style.width = "1px";
    ytDiv.style.height = "1px";

    ytPlayer = new YT.Player("yt-player", {
        height: "1", width: "1", videoId,
        playerVars: { autoplay: 1, controls: 0, rel: 0 },
        events: { onReady: onYTReady, onStateChange: onYTStateChange, onError: onYTError }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create YT player — playlist
// ─────────────────────────────────────────────────────────────────────────────
function createYTPlaylist(playlistId) {
    destroyYT();
    isPlaylist = true;
    showPlaylistBar(true);

    const ytDiv = document.getElementById("yt-player");
    ytDiv.style.display = "block";
    ytDiv.style.position = "absolute";
    ytDiv.style.opacity = "0";
    ytDiv.style.pointerEvents = "none";
    ytDiv.style.width = "1px";
    ytDiv.style.height = "1px";

    ytPlayer = new YT.Player("yt-player", {
        height: "1", width: "1",
        playerVars: {
            autoplay: 1, controls: 0, rel: 0,
            listType: "playlist",
            list: playlistId,
        },
        events: { onReady: onYTReady, onStateChange: onYTStateChange, onError: onYTError }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// YT player event handlers
// ─────────────────────────────────────────────────────────────────────────────
function onYTReady(e) {
    e.target.setVolume(volumeVal * 100);
    if (isMuted) e.target.mute();
    if (isShuffle && isPlaylist) e.target.setShuffle(true);
    e.target.playVideo();
}

function onYTStateChange(e) {
    if (e.data === YT.PlayerState.PLAYING) {
        setPlayingState(true);
        startYTProgressLoop();
        if (isPlaylist) updatePlaylistInfo();
    } else if (e.data === YT.PlayerState.PAUSED) {
        setPlayingState(false);
    } else if (e.data === YT.PlayerState.ENDED) {
        if (!isPlaylist) {
            setPlayingState(false);
            clearInterval(ytInterval);
        }
    }
}

function onYTError(e) {
    if (isPlaylist && (e.data === 150 || e.data === 101)) {
        showStatus("Skipping blocked video...", "info");
        setTimeout(() => { ytPlayer.nextVideo(); hideStatus(); }, 1200);
    } else {
        showStatus("⚠️ YouTube blocked this video for embedding.", "error");
        setPlayingState(false);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress loop
// ─────────────────────────────────────────────────────────────────────────────
function startYTProgressLoop() {
    clearInterval(ytInterval);
    ytInterval = setInterval(() => {
        if (!ytPlayer || typeof ytPlayer.getCurrentTime !== "function") return;
        const cur = ytPlayer.getCurrentTime() || 0;
        const tot = ytPlayer.getDuration()    || 0;
        updateProgress(tot > 0 ? (cur / tot) * 100 : 0, cur, tot);
    }, 500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update playlist track info + thumbnail
// ─────────────────────────────────────────────────────────────────────────────
function updatePlaylistInfo() {
    try {
        const idx       = ytPlayer.getPlaylistIndex();
        const list      = ytPlayer.getPlaylist();
        const total     = list ? list.length : "?";
        const currentId = list ? list[idx] : null;
        trackCounter.textContent = `${idx + 1} / ${total}`;
        if (currentId) {
            thumbnail.src = `https://img.youtube.com/vi/${currentId}/maxresdefault.jpg`;
            thumbnail.onerror = () => {
                thumbnail.src = `https://img.youtube.com/vi/${currentId}/hqdefault.jpg`;
            };
            fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${currentId}&format=json`)
                .then(r => r.json())
                .then(d => {
                    songTitleEl.textContent  = d.title       || "YouTube Track";
                    songSubtitle.textContent = d.author_name || "YouTube Playlist";
                })
                .catch(() => {
                    songTitleEl.textContent  = "YouTube Track";
                    songSubtitle.textContent = "YouTube Playlist";
                });
        }
    } catch (_) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Load & Play
// ─────────────────────────────────────────────────────────────────────────────
async function loadAndPlay() {
    const url = document.getElementById("songURL").value.trim();
    if (!url) return;

    resetPlayer();
    showStatus("Loading...", "info");
    setLoadBtnState(true);

    // ── YouTube playlist? ──
    const playlistId = extractYouTubePlaylistId(url);
    if (playlistId) {
        isYouTube = true;
        songTitleEl.textContent  = "Loading playlist...";
        songSubtitle.textContent = "YouTube Playlist";
        thumbnail.src = "https://placehold.co/220x220/0f0f0f/333?text=%F0%9F%8E%B5";
        setLoadBtnState(false);
        waitForYTReady(() => createYTPlaylist(playlistId));
        return;
    }

    // ── YouTube single video? ──
    const videoId = extractYouTubeVideoId(url);
    if (videoId) {
        isYouTube = true;
        thumbnail.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        thumbnail.onerror = () => {
            thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        };

        try {
            const res  = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
            const data = await res.json();
            songTitleEl.textContent  = data.title       || "YouTube Video";
            songSubtitle.textContent = data.author_name || "YouTube";
        } catch {
            songTitleEl.textContent  = "YouTube Video";
            songSubtitle.textContent = "YouTube";
        }

        setLoadBtnState(false);
        waitForYTReady(() => createYTVideo(videoId));
        return;
    }

    // ── Direct audio (MP3 etc.) ──
    isYouTube = false;
    audio.src = url;
    songTitleEl.textContent  = extractTitle(url);
    songSubtitle.textContent = "Direct Audio";
    thumbnail.src = "https://placehold.co/220x220/0f0f0f/333?text=%E2%99%AA";

    audio.load();
    audio.play()
        .then(() => { hideStatus(); setPlayingState(true); })
        .catch(() => showStatus("❌ Can't play this URL. Use a direct .mp3 link.", "error"))
        .finally(() => setLoadBtnState(false));
}

// ─────────────────────────────────────────────────────────────────────────────
// Controls
// ─────────────────────────────────────────────────────────────────────────────
function togglePlayPause() {
    if (isYouTube) {
        if (!ytPlayer) return;
        isPlaying ? ytPlayer.pauseVideo() : ytPlayer.playVideo();
    } else {
        if (!audio.src) return;
        isPlaying ? audio.pause() : audio.play();
    }
}

function prevTrack() {
    if (isPlaylist && ytPlayer) {
        ytPlayer.previousVideo();
        setTimeout(updatePlaylistInfo, 800);
    } else {
        seekBy(-10);
    }
}

function nextTrack() {
    if (isPlaylist && ytPlayer) {
        ytPlayer.nextVideo();
        setTimeout(updatePlaylistInfo, 800);
    } else {
        seekBy(10);
    }
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle("active", isShuffle);
    if (ytPlayer && isPlaylist) ytPlayer.setShuffle(isShuffle);
    showStatus(isShuffle ? "🔀 Shuffle on" : "Shuffle off", "info");
    setTimeout(hideStatus, 1500);
}

function toggleMute() {
    isMuted = !isMuted;
    audio.muted = isMuted;
    if (ytPlayer) isMuted ? ytPlayer.mute() : ytPlayer.unMute();
    muteBtn.style.opacity = isMuted ? "0.4" : "1";
}

function setVolume(val) {
    volumeVal = parseFloat(val);
    audio.volume = volumeVal;
    if (ytPlayer) ytPlayer.setVolume(volumeVal * 100);
}

function seekTo(val) {
    const pct = parseFloat(val);
    if (isYouTube && ytPlayer) {
        ytPlayer.seekTo((pct / 100) * (ytPlayer.getDuration() || 0));
    } else if (audio.duration) {
        audio.currentTime = (pct / 100) * audio.duration;
    }
}

function seekBy(seconds) {
    if (isYouTube && ytPlayer) {
        ytPlayer.seekTo(Math.max(0, ytPlayer.getCurrentTime() + seconds));
    } else if (audio.src) {
        audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
    }
}

function restartSong() {
    if (isYouTube && ytPlayer) { ytPlayer.seekTo(0); }
    else { audio.currentTime = 0; if (!isPlaying && audio.src) audio.play(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio element events (MP3 mode)
// ─────────────────────────────────────────────────────────────────────────────
audio.addEventListener("timeupdate", () => {
    if (isYouTube || !audio.duration) return;
    updateProgress((audio.currentTime / audio.duration) * 100, audio.currentTime, audio.duration);
});
audio.addEventListener("play",  () => { if (!isYouTube) setPlayingState(true);  });
audio.addEventListener("pause", () => { if (!isYouTube) setPlayingState(false); });
audio.addEventListener("ended", () => { setPlayingState(false); updateProgress(0, 0, audio.duration); });
audio.addEventListener("loadedmetadata", () => { durationEl.textContent = fmt(audio.duration); });

// ─────────────────────────────────────────────────────────────────────────────
// UI helpers
// ─────────────────────────────────────────────────────────────────────────────
function setPlayingState(playing) {
    isPlaying = playing;
    playIcon.style.display  = playing ? "none"  : "block";
    pauseIcon.style.display = playing ? "block" : "none";
    if (playing) {
        spinningOverlay.classList.add("spinning");
        thumbnail.style.boxShadow = "0 0 50px rgba(20,200,160,0.4), 0 0 80px rgba(124,92,252,0.25)";
    } else {
        spinningOverlay.classList.remove("spinning");
        thumbnail.style.boxShadow = "";
    }
}

function updateProgress(pct, current, total) {
    progressBar.value         = pct;
    progressFill.style.width  = pct + "%";
    currentTimeEl.textContent = fmt(current);
    durationEl.textContent    = fmt(total);
}

function showPlaylistBar(show) {
    playlistBar.classList.toggle("visible", show);
    const prevSvg = prevBtn.querySelector("svg");
    const nextSvg = nextBtn.querySelector("svg");
    if (show) {
        prevSvg.innerHTML = '<polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>';
        nextSvg.innerHTML = '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>';
        prevBtn.title = "Previous track";
        nextBtn.title = "Next track";
    } else {
        prevSvg.innerHTML = '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/><text x="7" y="16" font-size="6" fill="currentColor" stroke="none">10</text>';
        nextSvg.innerHTML = '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-3.51"/><text x="7" y="16" font-size="6" fill="currentColor" stroke="none">10</text>';
        prevBtn.title = "Rewind 10s";
        nextBtn.title = "Forward 10s";
    }
}

function resetPlayer() {
    audio.pause(); audio.src = "";
    clearInterval(ytInterval);
    destroyYT();
    isYouTube = false; isPlaylist = false;
    setPlayingState(false);
    updateProgress(0, 0, 0);
    showPlaylistBar(false);
    trackCounter.textContent = "— / —";
}

function destroyYT() {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch(_) {}
        ytPlayer = null;
    }
    clearInterval(ytInterval);
    // Reset yt-player div
    const ytDiv = document.getElementById("yt-player");
    if (ytDiv) {
        ytDiv.style.display = "none";
        ytDiv.innerHTML = "";
    }
}

function setLoadBtnState(loading) {
    loadBtn.disabled      = loading;
    loadBtn.style.opacity = loading ? "0.5" : "1";
}

function showStatus(msg, type) {
    statusPill.textContent = msg;
    statusPill.className   = `status-pill ${type}`;
}

function hideStatus() { statusPill.className = "status-pill hidden"; }

// ─────────────────────────────────────────────────────────────────────────────
// URL parsers
// ─────────────────────────────────────────────────────────────────────────────
function extractYouTubePlaylistId(url) {
    try {
        const u  = new URL(url);
        const pl = u.searchParams.get("list");
        if (pl && (u.pathname === "/playlist" || !u.searchParams.get("v"))) {
            return pl;
        }
    } catch {}
    return null;
}

function extractYouTubeVideoId(url) {
    try {
        const u = new URL(url);
        if (u.hostname.includes("youtube.com")) return u.searchParams.get("v");
        if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    } catch {}
    return null;
}

function extractTitle(url) {
    try {
        const p = new URL(url).pathname.split("/").pop();
        return decodeURIComponent(p.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")) || "Unknown";
    } catch { return "Unknown"; }
}

function fmt(s = 0) {
    const m   = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
}

document.getElementById("songURL").addEventListener("keydown", e => {
    if (e.key === "Enter") loadAndPlay();
});