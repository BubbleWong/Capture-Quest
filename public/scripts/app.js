const app = document.querySelector("#app");
const connectionPill = document.querySelector("#connectionPill");
const leaderboardDialog = document.querySelector("#leaderboardDialog");
const leaderboardContent = document.querySelector("#leaderboardContent");
const leaderboardButton = document.querySelector("#leaderboardButton");
const closeLeaderboardButton = document.querySelector("#closeLeaderboardButton");

const socket = io();
const query = new URLSearchParams(window.location.search);
const initialGameId = query.get("game")?.toUpperCase() || "";
const sessionKey = "captureQuestSession";

const state = {
  view: initialGameId ? "join" : "home",
  game: null,
  gameUrl: "",
  qrCode: "",
  playerId: "",
  notice: "",
  timerInterval: null,
  prefillGameId: initialGameId
};

const cameraState = {
  stream: null,
  startPromise: null,
  error: "",
  failed: false,
  sending: false,
  healthTimer: null,
  intentionalStop: false,
  stalledSince: 0,
  lastVideoTime: 0,
  lastVideoCheckAt: 0
};

function saveSession() {
  if (!state.game?.id || !state.playerId) return;
  localStorage.setItem(
    sessionKey,
    JSON.stringify({
      gameId: state.game.id,
      playerId: state.playerId
    })
  );
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || "null");
  } catch {
    return null;
  }
}

function emitAck(event, payload) {
  return new Promise((resolve) => {
    socket.timeout(20000).emit(event, payload, (error, response) => {
      if (error) {
        resolve({ ok: false, error: "The server did not answer in time." });
      } else {
        resolve(response || { ok: true });
      }
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setNotice(message) {
  state.notice = message || "";
  render();
}

function updateConnection(online) {
  connectionPill.textContent = online ? "online" : "offline";
  connectionPill.classList.toggle("is-online", online);
}

function activeViewFromGame(game) {
  if (!game) return null;
  if (game.status === "ended") return "end";
  if (game.status === "lobby" || game.status === "loading") return "lobby";
  return "game";
}

function setJoinData(response) {
  if (!response.ok) {
    setNotice(response.error || "Something went wrong.");
    return false;
  }
  state.playerId = response.playerId;
  state.gameUrl = response.gameUrl;
  state.qrCode = response.qrCode;
  saveSession();
  return true;
}

async function createGame(formData) {
  ensureCamera({ rerender: false });
  const response = await emitAck("create_game", {
    username: formData.get("ownerName")
  });
  if (setJoinData(response)) {
    state.view = "lobby";
    setNotice("Game created.");
  }
}

async function joinGame(formData) {
  ensureCamera({ rerender: false });
  const response = await emitAck("join_game", {
    username: formData.get("playerName"),
    gameId: formData.get("gameId")
  });
  if (setJoinData(response)) {
    state.view = "lobby";
    setNotice("Joined game.");
  }
}

async function rejoinPreviousGame() {
  const stored = readSession();
  const targetGameId = initialGameId || stored?.gameId;
  const targetPlayerId = stored?.playerId;
  if (!targetGameId || !targetPlayerId) return;

  const response = await emitAck("rejoin_game", {
    gameId: targetGameId,
    playerId: targetPlayerId
  });
  if (setJoinData(response)) {
    setNotice("Rejoined game.");
  } else if (initialGameId) {
    localStorage.removeItem(sessionKey);
    state.prefillGameId = initialGameId;
    render();
  } else {
    localStorage.removeItem(sessionKey);
    state.notice = "";
    render();
  }
}

async function setReady(ready) {
  const response = await emitAck("set_ready", {
    gameId: state.game.id,
    ready
  });
  if (!response.ok) setNotice(response.error);
}

async function startGame() {
  ensureCamera({ rerender: false });
  const response = await emitAck("start_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
}

function enableCamera() {
  cameraState.failed = false;
  cameraState.error = "";
  ensureCamera();
}

async function restartGame() {
  const response = await emitAck("restart_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
}

async function endGame() {
  const response = await emitAck("end_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
}

function resetLocalGame(message = "") {
  stopCamera();
  localStorage.removeItem(sessionKey);
  state.view = "home";
  state.game = null;
  state.gameUrl = "";
  state.qrCode = "";
  state.playerId = "";
  state.notice = message;
  render();
}

async function leaveGame() {
  if (!state.game) {
    resetLocalGame("You left the game.");
    return;
  }

  const response = await emitAck("leave_game", {
    gameId: state.game.id
  });
  if (!response.ok) {
    setNotice(response.error);
    return;
  }
  resetLocalGame("You left the game.");
}

function attachCameraStream() {
  const video = document.querySelector("#cameraVideo");
  if (!video || !cameraState.stream) return;
  if (video.srcObject !== cameraState.stream) {
    video.srcObject = cameraState.stream;
  }
  bindCameraVideo(video);
  video.play().catch(() => {});
}

function isCameraExpected() {
  return Boolean(state.game && state.game.status !== "ended");
}

function resetCameraHealth() {
  cameraState.stalledSince = 0;
  cameraState.lastVideoTime = 0;
  cameraState.lastVideoCheckAt = 0;
}

function releaseCameraStream() {
  if (cameraState.stream) {
    cameraState.intentionalStop = true;
    for (const track of cameraState.stream.getTracks()) {
      track.stop();
    }
    setTimeout(() => {
      cameraState.intentionalStop = false;
    }, 0);
  }
  cameraState.stream = null;
  cameraState.startPromise = null;
  resetCameraHealth();
}

function stopCamera() {
  releaseCameraStream();
  cameraState.error = "";
  cameraState.failed = false;
  cameraState.sending = false;
  stopCameraHealthMonitor();
}

function restartCamera(message = "Camera stalled. Reconnecting...") {
  if (!isCameraExpected() || cameraState.startPromise) return;
  releaseCameraStream();
  cameraState.failed = false;
  cameraState.error = message;
  ensureCamera({ rerender: state.view === "game" });
}

function bindCameraVideo(video) {
  if (video.dataset.cameraBound === "true") return;
  video.dataset.cameraBound = "true";
  for (const eventName of ["pause", "stalled", "waiting", "emptied"]) {
    video.addEventListener(eventName, () => {
      if (isCameraExpected() && cameraState.stream) {
        attachCameraStream();
      }
    });
  }
  video.addEventListener("playing", resetCameraHealth);
}

function startCameraHealthMonitor() {
  if (cameraState.healthTimer) return;
  cameraState.healthTimer = setInterval(checkCameraHealth, 2000);
}

function stopCameraHealthMonitor() {
  clearInterval(cameraState.healthTimer);
  cameraState.healthTimer = null;
}

function checkCameraHealth() {
  if (!isCameraExpected()) {
    stopCameraHealthMonitor();
    return;
  }
  if (document.hidden || cameraState.failed || cameraState.startPromise) return;

  const track = cameraState.stream?.getVideoTracks()[0];
  if (!track) {
    ensureCamera({ rerender: state.view === "game" });
    return;
  }
  if (track.readyState === "ended") {
    restartCamera("Camera disconnected. Reconnecting...");
    return;
  }

  const video = document.querySelector("#cameraVideo");
  if (!video) return;
  attachCameraStream();

  const now = Date.now();
  const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !video.paused;
  const videoTimeChanged = video.currentTime !== cameraState.lastVideoTime;
  if (hasFrame && videoTimeChanged) {
    cameraState.lastVideoTime = video.currentTime;
    cameraState.lastVideoCheckAt = now;
    cameraState.stalledSince = 0;
    return;
  }

  if (!cameraState.stalledSince) cameraState.stalledSince = now;
  if (now - cameraState.stalledSince > 7000 && now - cameraState.lastVideoCheckAt > 7000) {
    restartCamera();
  }
}

function ensureCamera({ rerender = true } = {}) {
  if (cameraState.stream || cameraState.startPromise || cameraState.failed) {
    attachCameraStream();
    return cameraState.startPromise;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraState.error = "Camera is not available in this browser.";
    cameraState.failed = true;
    if (rerender) render();
    return null;
  }

  cameraState.error = "";
  cameraState.startPromise = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    })
    .then((stream) => {
      cameraState.stream = stream;
      cameraState.failed = false;
      cameraState.error = "";
      for (const track of stream.getVideoTracks()) {
        track.addEventListener("ended", () => {
          if (!cameraState.intentionalStop && isCameraExpected()) {
            restartCamera("Camera disconnected. Reconnecting...");
          }
        });
        track.addEventListener("mute", () => {
          if (!cameraState.intentionalStop && isCameraExpected()) {
            restartCamera("Camera paused. Reconnecting...");
          }
        });
      }
      attachCameraStream();
    })
    .catch(() => {
      cameraState.stream = null;
      cameraState.error = "Allow camera access to snap photos during the game.";
      cameraState.failed = true;
    })
    .finally(() => {
      cameraState.startPromise = null;
      if (rerender) render();
    });

  return cameraState.startPromise;
}

function syncCameraWithView() {
  if (state.game && state.game.status !== "ended") {
    startCameraHealthMonitor();
    attachCameraStream();
    ensureCamera({ rerender: state.view === "game" });
  } else {
    stopCamera();
  }
}

function captureVideoFrame() {
  const video = document.querySelector("#cameraVideo");
  if (!cameraState.stream || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    setNotice("Camera is not ready yet.");
    return "";
  }

  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const maxSide = 1280;
  const ratio = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function formatSeconds(ms) {
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function timerMarkup(round) {
  if (!round) return "";
  const total = Math.max(1, round.expiresAt - round.startedAt);
  const left = Math.max(0, round.expiresAt - Date.now());
  const width = Math.round((left / total) * 100);
  return `
    <div class="stack">
      <div class="timer-bar" aria-label="Round timer">
        <div class="timer-fill" style="width:${width}%"></div>
      </div>
      <span class="status-chip">${formatSeconds(left)}</span>
    </div>
  `;
}

function playerRows(players) {
  return [...players]
    .sort((a, b) => b.score - a.score || Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username))
    .map((player, index) => {
      const stateText = [
        player.isOwner ? "owner" : "player",
        player.ready ? "ready" : "not ready",
        player.connected ? "online" : "offline"
      ].join(" · ");
      return `
        <li class="player-row">
          <span class="player-avatar">${index + 1}</span>
          <span class="player-meta">
            <span class="player-name">${escapeHtml(player.username)}</span>
            <span class="player-state">${escapeHtml(stateText)}</span>
          </span>
          <span class="score-value">${player.score}</span>
        </li>
      `;
    })
    .join("");
}

function renderNotice() {
  return state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : "";
}

function groupScoreRows(players) {
  return [...players]
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .map(
      (player, index) => `
        <li class="score-row">
          <span class="score-rank">${index + 1}</span>
          <span class="score-name">${escapeHtml(player.username)}</span>
          <span class="score-value">${player.score}</span>
        </li>
      `
    )
    .join("");
}

function renderHome() {
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="/assets/quest-camera.svg" alt="">
          <h1>Capture Quest</h1>
          <p>Fast photo rounds for classrooms, living rooms, and rainy afternoons.</p>
        </div>
      </div>
      <div class="form-side">
        ${renderNotice()}
        <div class="choice-grid">
          <button class="action-panel choice-card" id="showCreateButton" type="button">
            <span class="choice-icon">+</span>
            <span class="choice-title">Create Game</span>
          </button>
          <button class="action-panel choice-card" id="showJoinButton" type="button">
            <span class="choice-icon">#</span>
            <span class="choice-title">Join Game</span>
          </button>
        </div>
      </div>
    </section>
  `;

  document.querySelector("#showCreateButton").addEventListener("click", () => {
    state.view = "create";
    state.notice = "";
    render();
  });
  document.querySelector("#showJoinButton").addEventListener("click", () => {
    state.view = "join";
    state.notice = "";
    render();
  });
}

function renderCreate() {
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="/assets/quest-camera.svg" alt="">
          <h1>Create Game</h1>
          <p>Start a room and share the code when players are ready.</p>
        </div>
      </div>
      <div class="form-side single-form-side">
        ${renderNotice()}
        <form class="action-panel stack" id="createForm">
          <h2>Create Game</h2>
          <label class="field">
            <span>Your name</span>
            <input class="text-input" name="ownerName" autocomplete="nickname" maxlength="24" required placeholder="Game owner" autofocus>
          </label>
          <button class="primary-button" type="submit">Create game</button>
          <button class="secondary-button" id="backToChoiceButton" type="button">Back</button>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#createForm").addEventListener("submit", (event) => {
    event.preventDefault();
    createGame(new FormData(event.currentTarget));
  });
  document.querySelector("#backToChoiceButton").addEventListener("click", () => {
    state.view = "home";
    state.notice = "";
    render();
  });
}

function renderJoin() {
  const prefill = escapeHtml(state.prefillGameId);
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="/assets/quest-camera.svg" alt="">
          <h1>Join Game</h1>
          <p>Use the game ID from the host to jump into the lobby.</p>
        </div>
      </div>
      <div class="form-side single-form-side">
        ${renderNotice()}
        <form class="action-panel stack" id="joinForm">
          <h2>Join Game</h2>
          <label class="field">
            <span>Game ID</span>
            <input class="text-input" name="gameId" inputmode="latin" autocomplete="off" maxlength="8" required value="${prefill}" placeholder="ABC123" autofocus>
          </label>
          <label class="field">
            <span>Your name</span>
            <input class="text-input" name="playerName" autocomplete="nickname" maxlength="24" required placeholder="Player">
          </label>
          <button class="primary-button" type="submit">Join game</button>
          <button class="secondary-button" id="backToChoiceButton" type="button">Back</button>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    joinGame(new FormData(event.currentTarget));
  });
  document.querySelector("#backToChoiceButton").addEventListener("click", () => {
    state.view = "home";
    state.notice = "";
    render();
  });
}

function renderLobby() {
  const game = state.game;
  const me = game.me;
  const isOwner = me?.id === game.ownerPlayerId;
  const cameraReady = Boolean(cameraState.stream);
  const cameraMessage = cameraState.error || (cameraReady ? "Camera ready" : "Camera permission needed");
  app.innerHTML = `
    <section class="screen lobby-layout">
      <div class="panel-title">
        ${renderNotice()}
        <span class="status-chip">${game.status === "loading" ? "loading objects" : "lobby"}</span>
        <h1>Game ID</h1>
        <div class="game-code">${escapeHtml(game.id)}</div>
        <div class="copy-row">
          <input class="text-input" id="gameUrlInput" value="${escapeHtml(state.gameUrl)}" readonly>
          <button class="secondary-button" id="copyUrlButton" type="button">Copy URL</button>
        </div>
        ${state.qrCode ? `<div class="qr-wrap"><img src="${state.qrCode}" alt="QR code for game ${escapeHtml(game.id)}"></div>` : ""}
      </div>
      <aside class="compact-panel stack">
        <h2>Players ${game.players.length}/${game.maxPlayers}</h2>
        <ul class="player-list">${playerRows(game.players)}</ul>
        <div class="camera-lobby-status">
          <p class="camera-message">${escapeHtml(cameraMessage)}</p>
          ${cameraReady ? "" : `<button class="secondary-button" id="enableCameraButton" type="button">Enable camera</button>`}
        </div>
        <button class="${me?.ready ? "secondary-button" : "primary-button"}" id="readyButton" type="button">
          ${me?.ready ? "Set not ready" : "Ready"}
        </button>
        ${
          isOwner
            ? `<button class="primary-button" id="startButton" type="button" ${!game.allReady || game.status === "loading" ? "disabled" : ""}>Start game</button>`
            : ""
        }
        ${
          isOwner
            ? `<button class="danger-button" id="endGameButton" type="button">End game</button>`
            : `<button class="secondary-button" id="leaveGameButton" type="button">Leave game</button>`
        }
      </aside>
    </section>
  `;

  document.querySelector("#readyButton").addEventListener("click", () => setReady(!me.ready));
  document.querySelector("#enableCameraButton")?.addEventListener("click", enableCamera);
  document.querySelector("#copyUrlButton").addEventListener("click", async () => {
    await navigator.clipboard?.writeText(state.gameUrl);
    setNotice("Game URL copied.");
  });
  document.querySelector("#startButton")?.addEventListener("click", startGame);
  document.querySelector("#endGameButton")?.addEventListener("click", endGame);
  document.querySelector("#leaveGameButton")?.addEventListener("click", leaveGame);
}

function renderGame() {
  const game = state.game;
  const round = game.currentRound;
  const cameraMessage = cameraState.error || (cameraState.stream ? "Camera ready" : "Starting camera...");
  const cameraDisabled = !cameraState.stream || Boolean(cameraState.error) || cameraState.sending;
  app.innerHTML = `
    <section class="screen game-layout">
      <div class="stack">
        ${renderNotice()}
        <div class="target-panel">
          <span class="target-kicker">Round ${game.roundsAwarded + 1} of ${game.normalRounds}${game.roundsAwarded >= game.normalRounds ? " · tie breaker" : ""}</span>
          <h1 class="target-word">${escapeHtml(round?.item || "Get ready")}</h1>
          ${timerMarkup(round)}
        </div>
        <div class="compact-panel capture-box">
          <div class="camera-feed">
            <video id="cameraVideo" class="camera-video" autoplay playsinline muted></video>
            <button class="primary-button camera-shutter" id="submitPhotoButton" type="button" ${cameraDisabled ? "disabled" : ""}>
              ${cameraState.sending ? "Checking..." : "Snap and verify"}
            </button>
          </div>
          <p class="camera-message">${escapeHtml(cameraMessage)}</p>
        </div>
      </div>
      <aside class="compact-panel stack">
        <h2>Scores</h2>
        <ul class="score-list">${playerRows(game.players)}</ul>
        ${
          game.me?.id === game.ownerPlayerId
            ? `<button class="danger-button" id="endGameButton" type="button">End game</button>`
            : `<button class="secondary-button" id="leaveGameButton" type="button">Leave game</button>`
        }
      </aside>
    </section>
  `;

  document.querySelector("#submitPhotoButton").addEventListener("click", submitPhoto);
  document.querySelector("#endGameButton")?.addEventListener("click", endGame);
  document.querySelector("#leaveGameButton")?.addEventListener("click", leaveGame);
  attachCameraStream();
}

function renderEnd() {
  const game = state.game;
  const isOwner = game.me?.id === game.ownerPlayerId;
  app.innerHTML = `
    <section class="screen end-layout">
      <div class="stack">
        ${renderNotice()}
        <div class="winner-banner">
          <span class="status-chip">${game.winner ? "winner" : "ended"}</span>
          <h1>${escapeHtml(game.winner?.username || "Game complete")}</h1>
        </div>
        ${isOwner ? `<button class="primary-button" id="restartButton" type="button">New game with group</button>` : ""}
        <button class="secondary-button" id="leaveGameButton" type="button">Leave game</button>
      </div>
      <aside class="compact-panel stack">
        <h2>Final Scores</h2>
        <ul class="score-list">${playerRows(game.players)}</ul>
      </aside>
    </section>
  `;

  document.querySelector("#restartButton")?.addEventListener("click", restartGame);
  document.querySelector("#leaveGameButton").addEventListener("click", leaveGame);
}

function render() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  state.view = activeViewFromGame(state.game) || state.view;
  if (state.view === "home") renderHome();
  if (state.view === "create") renderCreate();
  if (state.view === "join") renderJoin();
  if (state.view === "lobby") renderLobby();
  if (state.view === "game") renderGame();
  if (state.view === "end") renderEnd();

  if (state.game?.currentRound?.status === "active") {
    state.timerInterval = setInterval(() => {
      const fill = document.querySelector(".timer-fill");
      const chip = document.querySelector(".target-panel .status-chip");
      const round = state.game.currentRound;
      if (!fill || !chip || !round) return;
      const total = Math.max(1, round.expiresAt - round.startedAt);
      const left = Math.max(0, round.expiresAt - Date.now());
      fill.style.width = `${Math.round((left / total) * 100)}%`;
      chip.textContent = formatSeconds(left);
    }, 500);
  }

  syncCameraWithView();
}

async function submitPhoto() {
  const imageDataUrl = captureVideoFrame();
  if (!imageDataUrl || cameraState.sending) return;

  cameraState.sending = true;
  state.notice = "Photo sent. Checking...";
  render();

  const response = await emitAck("submit_capture", {
    gameId: state.game.id,
    imageDataUrl
  });
  if (!response.ok) {
    cameraState.sending = false;
    setNotice(response.error);
    return;
  }
  render();
}

async function openLeaderboard() {
  leaderboardDialog.showModal();
  if (!state.game) {
    leaderboardContent.innerHTML = `<p class="empty-state">Join or create a game to see the leaderboard.</p>`;
    return;
  }

  leaderboardContent.innerHTML = state.game.players.length
    ? `<ol class="score-list">${groupScoreRows(state.game.players)}</ol>`
    : `<p class="empty-state">No players in this group yet.</p>`;
}

socket.on("connect", () => {
  updateConnection(true);
  rejoinPreviousGame();
});

socket.on("disconnect", () => {
  updateConnection(false);
});

socket.on("game_state", (game) => {
  state.game = game;
  state.playerId = game.me?.id || state.playerId;
  saveSession();
  render();
});

socket.on("round_started", ({ item }) => {
  cameraState.sending = false;
  state.notice = `Find ${item}.`;
  render();
});

socket.on("round_result", (result) => {
  cameraState.sending = false;
  state.notice = result.message;
  render();
});

socket.on("submission_result", (result) => {
  if (result.status !== "checking") {
    cameraState.sending = false;
  }
  setNotice(result.message);
});

socket.on("game_ended", ({ winner, message }) => {
  cameraState.sending = false;
  state.notice = message || (winner ? `${winner.username} wins.` : "Game ended.");
  render();
});

socket.on("notice", ({ message }) => {
  setNotice(message);
});

socket.on("left_game", ({ message }) => {
  resetLocalGame(message || "You left the game.");
});

leaderboardButton.addEventListener("click", openLeaderboard);
closeLeaderboardButton.addEventListener("click", () => leaderboardDialog.close());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isCameraExpected()) {
    resetCameraHealth();
    attachCameraStream();
    if (!cameraState.stream && !cameraState.failed) {
      ensureCamera({ rerender: state.view === "game" });
    }
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

render();
