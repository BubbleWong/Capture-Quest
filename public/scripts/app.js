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
  view: "home",
  game: null,
  gameUrl: "",
  qrCode: "",
  playerId: "",
  notice: "",
  selectedPhoto: "",
  selectedPhotoName: "",
  timerInterval: null,
  prefillGameId: initialGameId
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
  if (!game) return "home";
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
  const response = await emitAck("create_game", {
    username: formData.get("ownerName")
  });
  if (setJoinData(response)) {
    state.view = "lobby";
    setNotice("Game created.");
  }
}

async function joinGame(formData) {
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
  const response = await emitAck("start_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
}

async function restartGame() {
  const response = await emitAck("restart_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
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

function renderHome() {
  const prefill = escapeHtml(state.prefillGameId);
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
        <form class="action-panel stack" id="createForm">
          <h2>Create Game</h2>
          <label class="field">
            <span>Your name</span>
            <input class="text-input" name="ownerName" autocomplete="nickname" maxlength="24" required placeholder="Game owner">
          </label>
          <button class="primary-button" type="submit">Create game</button>
        </form>
        <form class="action-panel stack" id="joinForm">
          <h2>Join Game</h2>
          <label class="field">
            <span>Game ID</span>
            <input class="text-input" name="gameId" inputmode="latin" autocomplete="off" maxlength="8" required value="${prefill}" placeholder="ABC123">
          </label>
          <label class="field">
            <span>Your name</span>
            <input class="text-input" name="playerName" autocomplete="nickname" maxlength="24" required placeholder="Player">
          </label>
          <button class="secondary-button" type="submit">Join game</button>
        </form>
      </div>
    </section>
  `;

  document.querySelector("#createForm").addEventListener("submit", (event) => {
    event.preventDefault();
    createGame(new FormData(event.currentTarget));
  });
  document.querySelector("#joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    joinGame(new FormData(event.currentTarget));
  });
}

function renderLobby() {
  const game = state.game;
  const me = game.me;
  const isOwner = me?.id === game.ownerPlayerId;
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
        <button class="${me?.ready ? "secondary-button" : "primary-button"}" id="readyButton" type="button">
          ${me?.ready ? "Set not ready" : "Ready"}
        </button>
        ${
          isOwner
            ? `<button class="primary-button" id="startButton" type="button" ${!game.allReady || game.status === "loading" ? "disabled" : ""}>Start game</button>`
            : ""
        }
      </aside>
    </section>
  `;

  document.querySelector("#readyButton").addEventListener("click", () => setReady(!me.ready));
  document.querySelector("#copyUrlButton").addEventListener("click", async () => {
    await navigator.clipboard?.writeText(state.gameUrl);
    setNotice("Game URL copied.");
  });
  document.querySelector("#startButton")?.addEventListener("click", startGame);
}

function renderGame() {
  const game = state.game;
  const round = game.currentRound;
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
          <input class="camera-input" id="photoInput" type="file" accept="image/*" capture="environment">
          <button class="primary-button" id="takePhotoButton" type="button">Take photo</button>
          <div class="preview" id="previewBox">
            ${
              state.selectedPhoto
                ? `<img src="${state.selectedPhoto}" alt="Selected capture preview">`
                : `<span class="empty-state">No photo selected</span>`
            }
          </div>
          <button class="secondary-button" id="submitPhotoButton" type="button" ${state.selectedPhoto ? "" : "disabled"}>Send photo</button>
        </div>
      </div>
      <aside class="compact-panel stack">
        <h2>Scores</h2>
        <ul class="score-list">${playerRows(game.players)}</ul>
      </aside>
    </section>
  `;

  document.querySelector("#takePhotoButton").addEventListener("click", () => {
    document.querySelector("#photoInput").click();
  });
  document.querySelector("#photoInput").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.selectedPhoto = await resizeImage(file);
    state.selectedPhotoName = file.name;
    render();
  });
  document.querySelector("#submitPhotoButton").addEventListener("click", submitPhoto);
}

function renderEnd() {
  const game = state.game;
  const isOwner = game.me?.id === game.ownerPlayerId;
  app.innerHTML = `
    <section class="screen end-layout">
      <div class="stack">
        ${renderNotice()}
        <div class="winner-banner">
          <span class="status-chip">winner</span>
          <h1>${escapeHtml(game.winner?.username || "Game complete")}</h1>
        </div>
        ${isOwner ? `<button class="primary-button" id="restartButton" type="button">New game with group</button>` : ""}
      </div>
      <aside class="compact-panel stack">
        <h2>Final Scores</h2>
        <ul class="score-list">${playerRows(game.players)}</ul>
      </aside>
    </section>
  `;

  document.querySelector("#restartButton")?.addEventListener("click", restartGame);
}

function render() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  state.view = activeViewFromGame(state.game) || state.view;
  if (state.view === "home") renderHome();
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
}

async function resizeImage(file) {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(imageUrl);
    const maxSide = 1280;
    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
}

async function submitPhoto() {
  if (!state.selectedPhoto) return;
  const response = await emitAck("submit_capture", {
    gameId: state.game.id,
    imageDataUrl: state.selectedPhoto
  });
  if (!response.ok) {
    setNotice(response.error);
    return;
  }
  state.selectedPhoto = "";
  setNotice("Photo sent.");
}

async function openLeaderboard() {
  leaderboardContent.innerHTML = `<p class="empty-state">Loading...</p>`;
  leaderboardDialog.showModal();
  const response = await fetch("/api/leaderboard");
  const data = await response.json();
  const rows = data.rows || [];
  leaderboardContent.innerHTML = rows.length
    ? `<ol class="score-list">${rows
        .map(
          (row, index) => `
            <li class="score-row">
              <span class="score-rank">${index + 1}</span>
              <span class="score-name">${escapeHtml(row.player_name)}</span>
              <span class="score-value">${row.total_score}</span>
            </li>
          `
        )
        .join("")}</ol>`
    : `<p class="empty-state">No completed games yet.</p>`;
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
  state.selectedPhoto = "";
  state.notice = `Find ${item}.`;
  render();
});

socket.on("round_result", (result) => {
  state.selectedPhoto = "";
  state.notice = result.message;
  render();
});

socket.on("submission_result", (result) => {
  setNotice(result.message);
});

socket.on("game_ended", ({ winner }) => {
  state.notice = winner ? `${winner.username} wins.` : "Game ended.";
  render();
});

socket.on("notice", ({ message }) => {
  setNotice(message);
});

leaderboardButton.addEventListener("click", openLeaderboard);
closeLeaderboardButton.addEventListener("click", () => leaderboardDialog.close());

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch(() => {});
}

render();
