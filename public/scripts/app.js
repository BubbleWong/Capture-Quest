const app = document.querySelector("#app");
const connectionPill = document.querySelector("#connectionPill");
const leaderboardDialog = document.querySelector("#leaderboardDialog");
const leaderboardContent = document.querySelector("#leaderboardContent");
const leaderboardButton = document.querySelector("#leaderboardButton");
const closeLeaderboardButton = document.querySelector("#closeLeaderboardButton");

const socket = io();
const query = new URLSearchParams(window.location.search);
const initialGameId = query.get("game")?.toUpperCase() || "";
const assetVersion = window.__CAPTURE_QUEST_ASSET_VERSION__ || "dev";
const sessionKey = "captureQuestSession";
const usernameKey = "captureQuestLastUsername";
const gameCodeLength = 6;
const crockfordCharacters = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const state = {
  view: initialGameId ? "join" : "home",
  game: null,
  gameUrl: "",
  qrCode: "",
  playerId: "",
  notice: "",
  online: socket.connected,
  notifications: [],
  notificationId: 0,
  timerInterval: null,
  urlGameId: initialGameId,
  prefillGameId: initialGameId
};

const cameraState = {
  stream: null,
  startPromise: null,
  error: "",
  failed: false,
  failureReason: "",
  sending: false,
  healthTimer: null,
  intentionalStop: false,
  activeRequestId: 0,
  requestStartedAt: 0,
  retryAt: 0,
  permissionState: "",
  permissionStatus: null,
  permissionWatchStarted: false,
  lastPermissionCheckAt: 0,
  stalledSince: 0,
  mutedSince: 0,
  streamStartedAt: 0,
  lastRecoveryAt: 0,
  lastRestartAt: 0,
  frameCount: 0,
  lastFrameCount: 0,
  lastVideoTime: 0,
  lastVideoCheckAt: 0
};

const cameraRequestTimeoutMs = 12000;
const cameraRetryDelayMs = 3000;
const cameraPermissionCheckMs = 5000;

const soundState = {
  context: null,
  unlocked: false,
  countdownTickKey: "",
  lastEndSoundGameId: ""
};

function createAudioContext() {
  if (soundState.context) return soundState.context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  soundState.context = new AudioContextClass();
  return soundState.context;
}

async function unlockAudio() {
  const context = createAudioContext();
  if (!context) return false;
  try {
    if (context.state === "suspended") await context.resume();
    soundState.unlocked = context.state === "running";
    return soundState.unlocked;
  } catch {
    return false;
  }
}

function canPlaySound() {
  return Boolean(soundState.unlocked && soundState.context?.state === "running");
}

function playTone(frequency, duration = 0.08, options = {}) {
  if (!canPlaySound() || document.hidden) return;
  const context = soundState.context;
  const start = context.currentTime + (options.delay || 0);
  const end = start + duration;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = options.type || "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(options.gain || 0.045, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.03);
}

function playSequence(notes) {
  for (const note of notes) {
    playTone(note.frequency, note.duration, note);
  }
}

function playButtonSound() {
  unlockAudio().then((unlocked) => {
    if (!unlocked) return;
    playSequence([
      { frequency: 620, duration: 0.035, type: "triangle", gain: 0.035 },
      { frequency: 920, duration: 0.04, type: "sine", gain: 0.025, delay: 0.035 }
    ]);
  });
}

function playCountdownTick(countdown, left, isUrgent) {
  if (!canPlaySound() || left <= 0) return;
  const bucketSize = isUrgent && left <= 3000 ? 500 : 1000;
  const bucket = Math.ceil(left / bucketSize);
  const key = `${countdown.mode}:${countdown.targetAt}:${bucketSize}:${bucket}`;
  if (soundState.countdownTickKey === key) return;
  soundState.countdownTickKey = key;

  if (countdown.mode === "break") {
    playTone(760 + bucket * 18, 0.045, { type: "square", gain: 0.028 });
    return;
  }

  const urgencyBoost = isUrgent ? Math.round((10000 - left) / 35) : 0;
  playTone(520 + urgencyBoost, isUrgent ? 0.055 : 0.035, {
    type: isUrgent ? "sawtooth" : "triangle",
    gain: isUrgent ? 0.035 : 0.018
  });
}

function playNotificationSound(status = "info") {
  if (!canPlaySound()) {
    unlockAudio().then((unlocked) => {
      if (unlocked) playNotificationSound(status);
    });
    return;
  }
  if (status === "found" || status === "success") {
    playSequence([
      { frequency: 660, duration: 0.07, type: "triangle", gain: 0.035 },
      { frequency: 880, duration: 0.08, type: "triangle", gain: 0.035, delay: 0.08 },
      { frequency: 1175, duration: 0.12, type: "triangle", gain: 0.032, delay: 0.17 }
    ]);
    return;
  }
  if (status === "miss" || status === "danger") {
    playSequence([
      { frequency: 220, duration: 0.1, type: "sawtooth", gain: 0.035 },
      { frequency: 165, duration: 0.12, type: "sawtooth", gain: 0.03, delay: 0.1 }
    ]);
    return;
  }
  if (status === "expired" || status === "warning") {
    playSequence([
      { frequency: 330, duration: 0.08, type: "square", gain: 0.026 },
      { frequency: 330, duration: 0.08, type: "square", gain: 0.026, delay: 0.14 }
    ]);
    return;
  }
  if (status === "target") {
    playSequence([
      { frequency: 523, duration: 0.055, type: "triangle", gain: 0.026 },
      { frequency: 784, duration: 0.09, type: "triangle", gain: 0.026, delay: 0.08 }
    ]);
    return;
  }
  playTone(700, 0.055, { type: "sine", gain: 0.022 });
}

function playGameEndedSound(gameId = "") {
  if (soundState.lastEndSoundGameId === gameId) return;
  if (!canPlaySound()) {
    unlockAudio().then((unlocked) => {
      if (unlocked) playGameEndedSound(gameId);
    });
    return;
  }
  soundState.lastEndSoundGameId = gameId;
  playSequence([
    { frequency: 523, duration: 0.11, type: "triangle", gain: 0.04 },
    { frequency: 659, duration: 0.11, type: "triangle", gain: 0.04, delay: 0.12 },
    { frequency: 784, duration: 0.12, type: "triangle", gain: 0.04, delay: 0.24 },
    { frequency: 1047, duration: 0.22, type: "triangle", gain: 0.038, delay: 0.38 }
  ]);
}

function preventZoomGesture(event) {
  event.preventDefault();
}

function preventZoomShortcut(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (["+", "-", "=", "_", "0"].includes(event.key)) {
    event.preventDefault();
  }
}

function preventDoubleTapZoom(event) {
  const now = Date.now();
  if (now - preventDoubleTapZoom.lastTouchEnd < 300) {
    event.preventDefault();
  }
  preventDoubleTapZoom.lastTouchEnd = now;
}
preventDoubleTapZoom.lastTouchEnd = 0;

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

function readLastUsername() {
  try {
    return localStorage.getItem(usernameKey) || "";
  } catch {
    return "";
  }
}

function saveLastUsername(username) {
  const cleaned = String(username || "").trim().replace(/\s+/g, " ").slice(0, 24);
  if (!cleaned) return;
  try {
    localStorage.setItem(usernameKey, cleaned);
  } catch {
    // Local storage can be unavailable in private or restricted browsing modes.
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

function assetUrl(path) {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("v", assetVersion);
  return `${url.pathname}${url.search}`;
}

function normalizeGameIdInput(value) {
  let normalized = "";
  for (const char of String(value || "").toUpperCase()) {
    if (char === "-" || /\s/.test(char)) continue;
    if (char === "O") {
      normalized += "0";
    } else if (char === "I" || char === "L") {
      normalized += "1";
    } else if (crockfordCharacters.includes(char)) {
      normalized += char;
    }
    if (normalized.length >= gameCodeLength) break;
  }
  return normalized;
}

function updateGameQuery(gameId = "") {
  const normalizedGameId = normalizeGameIdInput(gameId);
  const url = new URL(window.location.href);
  if (normalizedGameId) {
    url.searchParams.set("game", normalizedGameId);
  } else {
    url.searchParams.delete("game");
  }
  state.urlGameId = normalizedGameId;
  window.history.replaceState({}, "", url);
}

function setNotice(message) {
  state.notice = message || "";
  render();
}

function notificationType(status) {
  if (status === "found") return "success";
  if (status === "miss") return "danger";
  if (status === "expired") return "warning";
  if (status === "target") return "target";
  return "info";
}

function pushNotification(message, status = "info") {
  if (!message) return;
  const id = (state.notificationId += 1);
  playNotificationSound(status);
  state.notifications = [
    ...state.notifications.slice(-3),
    {
      id,
      message,
      type: notificationType(status)
    }
  ];
  render();
  setTimeout(() => {
    state.notifications = state.notifications.filter((notification) => notification.id !== id);
    if (state.view === "game") render();
  }, 3000);
}

function showMessage(message, status = "info") {
  if (state.view === "game") {
    state.notice = "";
    pushNotification(message, status);
  } else {
    setNotice(message);
  }
}

function activeGameCode() {
  return normalizeGameIdInput(state.game?.id || state.urlGameId || "");
}

function renderConnectionPill() {
  const connectionText = state.online ? "online" : "offline";
  const gameCode = activeGameCode();
  connectionPill.textContent = gameCode ? `${connectionText} - ${gameCode}` : connectionText;
  connectionPill.classList.toggle("is-online", state.online);
  connectionPill.classList.toggle("has-game-code", Boolean(gameCode));
}

function updateConnection(online) {
  state.online = online;
  renderConnectionPill();
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
  state.prefillGameId = response.gameId || state.prefillGameId;
  updateGameQuery(response.gameId);
  saveSession();
  return true;
}

async function createGame(formData) {
  saveLastUsername(formData.get("ownerName"));
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
  saveLastUsername(formData.get("playerName"));
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
  const targetGameId = state.urlGameId || stored?.gameId;
  const targetPlayerId = stored?.playerId;
  if (!targetGameId || !targetPlayerId) return;

  const response = await emitAck("rejoin_game", {
    gameId: targetGameId,
    playerId: targetPlayerId
  });
  if (setJoinData(response)) {
    setNotice("Rejoined game.");
  } else if (state.urlGameId) {
    localStorage.removeItem(sessionKey);
    state.prefillGameId = state.urlGameId;
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
  cameraState.failureReason = "";
  cameraState.retryAt = 0;
  cameraState.error = "";
  if (
    cameraState.startPromise &&
    cameraState.requestStartedAt &&
    Date.now() - cameraState.requestStartedAt > cameraRequestTimeoutMs
  ) {
    cameraState.startPromise = null;
    cameraState.requestStartedAt = 0;
  }
  ensureCamera();
}

async function restartGame() {
  const response = await emitAck("restart_game", {
    gameId: state.game.id
  });
  if (!response.ok) setNotice(response.error);
}

function confirmGameExit(message) {
  return window.confirm(message);
}

async function endGame() {
  if (!state.game) return;
  if (!confirmGameExit("End this game for everyone?")) return;
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
  state.notifications = [];
  state.prefillGameId = "";
  updateGameQuery("");
  state.notice = message;
  render();
}

async function leaveGame() {
  if (!state.game) {
    resetLocalGame("You left the game.");
    return;
  }
  if (!confirmGameExit("Leave this game?")) return;

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
  watchCameraFrames(video);
  video.play().catch(() => {});
}

function isCameraExpected() {
  return Boolean(state.game && state.game.status !== "ended");
}

function stopMediaStream(stream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function cameraFailureMessage(error, failureReason = "") {
  if (failureReason === "denied") {
    return "Allow camera access in browser site settings, then tap Enable camera.";
  }
  if (failureReason === "unavailable") {
    return "No camera was found on this device.";
  }

  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Allow camera access to snap photos during the game.";
    case "NotReadableError":
    case "AbortError":
      return "Camera is busy. Retrying...";
    case "OverconstrainedError":
      return "This camera mode is not available.";
    default:
      return "Camera permission is taking too long. Retrying...";
  }
}

function permanentCameraFailureReason(error, permissionState) {
  if (error?.name === "NotFoundError" || error?.name === "OverconstrainedError") {
    return "unavailable";
  }
  if (error?.name === "SecurityError" || (error?.name === "NotAllowedError" && permissionState === "denied")) {
    return "denied";
  }
  return "";
}

async function refreshCameraPermissionState(force = false) {
  const now = Date.now();
  if (!force && now - cameraState.lastPermissionCheckAt < cameraPermissionCheckMs) {
    return cameraState.permissionState;
  }
  if (!navigator.permissions?.query) return cameraState.permissionState;

  cameraState.lastPermissionCheckAt = now;
  try {
    const status = await navigator.permissions.query({ name: "camera" });
    cameraState.permissionStatus = status;
    cameraState.permissionState = status.state || "";
    if (!cameraState.permissionWatchStarted) {
      const handlePermissionChange = () => {
        cameraState.permissionState = status.state || "";
        if (cameraState.permissionState !== "denied") {
          cameraState.failed = false;
          cameraState.failureReason = "";
          cameraState.retryAt = 0;
          if (isCameraExpected()) {
            ensureCamera({ rerender: state.view === "game" });
          }
        } else if (!cameraState.stream) {
          cameraState.failed = true;
          cameraState.failureReason = "denied";
          cameraState.error = cameraFailureMessage(null, "denied");
          if (state.view === "game" || state.view === "lobby") render();
        }
      };
      if (status.addEventListener) {
        status.addEventListener("change", handlePermissionChange);
      } else {
        status.onchange = handlePermissionChange;
      }
      cameraState.permissionWatchStarted = true;
    }
    return cameraState.permissionState;
  } catch {
    return cameraState.permissionState;
  }
}

function acceptCameraStream(stream, requestId = cameraState.activeRequestId) {
  if (!isCameraExpected()) {
    stopMediaStream(stream);
    return;
  }
  if (requestId !== cameraState.activeRequestId && cameraState.stream) {
    stopMediaStream(stream);
    return;
  }

  if (cameraState.stream && cameraState.stream !== stream) {
    cameraState.intentionalStop = true;
    stopMediaStream(cameraState.stream);
    setTimeout(() => {
      cameraState.intentionalStop = false;
    }, 0);
  }

  cameraState.stream = stream;
  cameraState.streamStartedAt = Date.now();
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.retryAt = 0;
  cameraState.requestStartedAt = 0;
  cameraState.error = "";
  for (const track of stream.getVideoTracks()) {
    track.addEventListener("ended", () => {
      if (!cameraState.intentionalStop && isCameraExpected()) {
        restartCamera("Camera disconnected. Reconnecting...");
      }
    });
    track.addEventListener("mute", () => {
      cameraState.mutedSince = Date.now();
    });
    track.addEventListener("unmute", () => {
      cameraState.mutedSince = 0;
      resetCameraHealth();
    });
  }
  resetCameraHealth();
  attachCameraStream();
}

async function handleCameraStartFailure(error, requestId) {
  if (requestId !== cameraState.activeRequestId || cameraState.stream) return;

  const permissionState = await refreshCameraPermissionState(true);
  const failureReason = permanentCameraFailureReason(error, permissionState);
  cameraState.stream = null;
  cameraState.error = cameraFailureMessage(error, failureReason);
  cameraState.failed = Boolean(failureReason);
  cameraState.failureReason = failureReason;
  cameraState.retryAt = failureReason ? 0 : Date.now() + cameraRetryDelayMs;
}

function markCameraRequestTimedOut({ rerender = false } = {}) {
  if (!cameraState.startPromise || cameraState.stream || !cameraState.requestStartedAt) return false;
  if (Date.now() - cameraState.requestStartedAt <= cameraRequestTimeoutMs) return false;

  cameraState.startPromise = null;
  cameraState.requestStartedAt = 0;
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.retryAt = Date.now() + cameraRetryDelayMs;
  cameraState.error = cameraFailureMessage();
  if (rerender) render();
  return true;
}

function resetCameraHealth() {
  cameraState.stalledSince = 0;
  cameraState.mutedSince = 0;
  cameraState.lastFrameCount = cameraState.frameCount;
  cameraState.lastVideoTime = 0;
  cameraState.lastVideoCheckAt = Date.now();
}

function releaseCameraStream() {
  if (cameraState.stream) {
    cameraState.intentionalStop = true;
    stopMediaStream(cameraState.stream);
    setTimeout(() => {
      cameraState.intentionalStop = false;
    }, 0);
  }
  cameraState.activeRequestId += 1;
  cameraState.stream = null;
  cameraState.startPromise = null;
  cameraState.streamStartedAt = 0;
  cameraState.requestStartedAt = 0;
  cameraState.retryAt = 0;
  resetCameraHealth();
}

function stopCamera() {
  releaseCameraStream();
  cameraState.error = "";
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.sending = false;
  stopCameraHealthMonitor();
}

function restartCamera(message = "Camera stalled. Reconnecting...") {
  if (!isCameraExpected() || cameraState.startPromise) return;
  releaseCameraStream();
  cameraState.lastRestartAt = Date.now();
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.retryAt = 0;
  cameraState.error = message;
  ensureCamera({ rerender: state.view === "game" });
}

function softRecoverCamera(video) {
  if (!cameraState.stream || Date.now() - cameraState.lastRecoveryAt < 10000) return;
  cameraState.lastRecoveryAt = Date.now();
  video.srcObject = null;
  video.load();
  video.srcObject = cameraState.stream;
  video.play().catch(() => {});
}

function bindCameraVideo(video) {
  if (video.dataset.cameraBound === "true") return;
  video.dataset.cameraBound = "true";
  for (const eventName of ["pause", "stalled", "waiting", "emptied"]) {
    video.addEventListener(eventName, () => {
      if (isCameraExpected() && cameraState.stream) {
        softRecoverCamera(video);
      }
    });
  }
  video.addEventListener("playing", resetCameraHealth);
}

function watchCameraFrames(video) {
  if (!video.requestVideoFrameCallback || video.dataset.cameraFrameWatch === "true") return;
  video.dataset.cameraFrameWatch = "true";
  const watchFrame = () => {
    if (document.querySelector("#cameraVideo") !== video || video.srcObject !== cameraState.stream) {
      video.dataset.cameraFrameWatch = "false";
      return;
    }
    cameraState.frameCount += 1;
    cameraState.lastVideoCheckAt = Date.now();
    if (video.dataset.cameraFrameWatch === "true") {
      video.requestVideoFrameCallback(watchFrame);
    }
  };
  video.requestVideoFrameCallback(watchFrame);
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
  if (document.hidden) return;

  if (cameraState.startPromise && !cameraState.stream) {
    markCameraRequestTimedOut({ rerender: state.view === "game" });
    return;
  }

  if (cameraState.failed) {
    if (cameraState.failureReason === "denied") {
      refreshCameraPermissionState().then((permissionState) => {
        if (!isCameraExpected() || permissionState === "denied") return;
        cameraState.failed = false;
        cameraState.failureReason = "";
        cameraState.retryAt = 0;
        ensureCamera({ rerender: state.view === "game" });
      });
    }
    return;
  }

  if (cameraState.retryAt && Date.now() < cameraState.retryAt) return;

  const track = cameraState.stream?.getVideoTracks()[0];
  if (!track) {
    ensureCamera({ rerender: state.view === "game" });
    return;
  }
  if (track.readyState === "ended") {
    restartCamera("Camera disconnected. Reconnecting...");
    return;
  }
  if (track.muted) {
    if (!cameraState.mutedSince) cameraState.mutedSince = Date.now();
  } else {
    cameraState.mutedSince = 0;
  }

  const video = document.querySelector("#cameraVideo");
  if (!video) return;
  attachCameraStream();

  const now = Date.now();
  const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0;
  const frameCountChanged = cameraState.frameCount !== cameraState.lastFrameCount;
  const videoTimeChanged = video.currentTime !== cameraState.lastVideoTime;
  if (hasFrame && (frameCountChanged || videoTimeChanged || !video.requestVideoFrameCallback)) {
    cameraState.lastFrameCount = cameraState.frameCount;
    cameraState.lastVideoTime = video.currentTime;
    cameraState.lastVideoCheckAt = now;
    cameraState.stalledSince = 0;
    return;
  }

  if (now - cameraState.streamStartedAt < 15000) return;
  if (!cameraState.stalledSince) cameraState.stalledSince = now;
  if (now - cameraState.stalledSince > 10000) {
    softRecoverCamera(video);
  }
  if (
    now - cameraState.stalledSince > 45000 &&
    now - cameraState.lastRestartAt > 120000 &&
    (!cameraState.mutedSince || now - cameraState.mutedSince > 30000)
  ) {
    restartCamera();
  }
}

function ensureCamera({ rerender = true } = {}) {
  refreshCameraPermissionState();

  if (cameraState.stream) {
    attachCameraStream();
    return null;
  }

  if (cameraState.startPromise) {
    markCameraRequestTimedOut({ rerender });
    if (cameraState.startPromise) {
      attachCameraStream();
      return cameraState.startPromise;
    }
  }

  if (cameraState.failed || (cameraState.retryAt && Date.now() < cameraState.retryAt)) {
    attachCameraStream();
    return null;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    cameraState.error = "Camera is not available in this browser.";
    cameraState.failed = true;
    cameraState.failureReason = "unsupported";
    if (rerender) render();
    return null;
  }

  cameraState.error = "";
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.retryAt = 0;
  const requestId = cameraState.activeRequestId + 1;
  cameraState.activeRequestId = requestId;
  cameraState.requestStartedAt = Date.now();
  cameraState.startPromise = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    })
    .then((stream) => {
      acceptCameraStream(stream, requestId);
    })
    .catch((error) => handleCameraStartFailure(error, requestId))
    .finally(() => {
      if (cameraState.activeRequestId === requestId) {
        cameraState.startPromise = null;
        cameraState.requestStartedAt = 0;
        if (rerender && !cameraState.stream) render();
      }
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
  const seconds = Math.max(0, Math.ceil(ms / 10) / 100);
  return `${seconds.toFixed(2)}s`;
}

function willEndAfterCountdown(game) {
  return game.roundsAwarded >= game.normalRounds && game.leaders?.length === 1;
}

function countdownState(game) {
  const round = game?.currentRound;
  const now = Date.now();
  if (round?.status === "active") {
    const total = Math.max(1, round.expiresAt - round.startedAt);
    return {
      mode: "round",
      label: "Round timer",
      startedAt: round.startedAt,
      targetAt: round.expiresAt,
      left: Math.max(0, round.expiresAt - now),
      total
    };
  }

  if (game?.nextRoundAt) {
    const startedAt = game.nextRoundStartedAt || now;
    const total = Math.max(1, game.nextRoundAt - startedAt);
    return {
      mode: "break",
      label: willEndAfterCountdown(game) ? "Final scores timer" : "Next object timer",
      startedAt,
      targetAt: game.nextRoundAt,
      left: Math.max(0, game.nextRoundAt - now),
      total
    };
  }

  return null;
}

function countdownTitle(game, countdown) {
  if (countdown?.mode === "break") return willEndAfterCountdown(game) ? "Final scores soon" : "Next object soon";
  return game?.currentRound?.item || "Get ready";
}

function countdownLabel(game, countdown) {
  if (countdown?.mode === "break") return willEndAfterCountdown(game) ? "Final scores in" : "Next object in";
  return `Round ${game.roundsAwarded + 1} of ${game.normalRounds}${game.roundsAwarded >= game.normalRounds ? " - tie breaker" : ""}`;
}

function alertFlashDuration(left) {
  const ratio = Math.max(0, Math.min(1, left / 10000));
  return (0.12 + ratio * 0.78).toFixed(2);
}

function timerMarkup(countdown, { showChip = true } = {}) {
  if (!countdown) return "";
  const left = Math.max(0, countdown.targetAt - Date.now());
  const width = Math.max(0, Math.min(100, Math.round((left / countdown.total) * 100)));
  return `
    <div class="stack">
      <div class="timer-bar" aria-label="${escapeHtml(countdown.label)}">
        <div class="timer-fill" style="width:${width}%"></div>
      </div>
      ${showChip ? `<span class="status-chip">${formatSeconds(left)}</span>` : ""}
    </div>
  `;
}

function updateCountdownDisplays() {
  const countdown = countdownState(state.game);
  if (!countdown) return;

  const left = Math.max(0, countdown.targetAt - Date.now());
  const fill = document.querySelector(".timer-fill");
  const chip = document.querySelector(".round-time");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, Math.round((left / countdown.total) * 100)))}%`;
  if (chip) chip.textContent = formatSeconds(left);

  const isUrgent = countdown.mode === "round" && left > 0 && left <= 10000;
  const duration = `${alertFlashDuration(left)}s`;
  const alert = document.querySelector(".urgency-alert");
  if (alert) {
    alert.classList.toggle("is-visible", isUrgent);
    alert.style.setProperty("--alert-duration", duration);
  }

  const warning = document.querySelector(".last-chance-warning");
  if (warning) {
    warning.classList.toggle("is-visible", isUrgent);
    warning.style.setProperty("--alert-duration", duration);
    const time = warning.querySelector(".last-chance-time");
    if (time) time.textContent = formatSeconds(left);
  }
  playCountdownTick(countdown, left, isUrgent);
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

function gameCodeCells(value) {
  const code = normalizeGameIdInput(value);
  return Array.from({ length: gameCodeLength }, (_, index) => {
    const separator = index === 3 ? `<span class="passcode-separator" aria-hidden="true">-</span>` : "";
    const isActive = index === Math.min(code.length, gameCodeLength - 1);
    const classes = ["passcode-cell", code[index] ? "is-filled" : "", isActive ? "is-active" : ""]
      .filter(Boolean)
      .join(" ");
    return `
      ${separator}
      <span
        class="${classes}"
        data-code-index="${index}"
        aria-hidden="true"
      >${escapeHtml(code[index] || "")}</span>
    `;
  }).join("");
}

function syncGameCodeInput() {
  const source = document.querySelector("#gameIdHidden");
  const cells = [...document.querySelectorAll(".passcode-cell")];
  if (!source) return "";
  const code = normalizeGameIdInput(source.value).slice(0, gameCodeLength);
  source.value = code;
  state.prefillGameId = code;
  cells.forEach((cell, index) => {
    cell.textContent = code[index] || "";
    cell.classList.toggle("is-filled", Boolean(code[index]));
    cell.classList.toggle("is-active", index === Math.min(code.length, gameCodeLength - 1));
  });
  return code;
}

function setGameCodeError(message = "") {
  const error = document.querySelector("#gameCodeError");
  if (!error) return;
  error.textContent = message;
  error.classList.toggle("is-visible", Boolean(message));
}

function setupGameCodeInput() {
  const source = document.querySelector("#gameIdHidden");
  if (!source) return;
  let isComposingCode = false;

  function focusCodeInput() {
    source.focus();
    const end = source.value.length;
    source.setSelectionRange?.(end, end);
  }

  function updateCodeInput() {
    syncGameCodeInput();
    setGameCodeError("");
    if (source.value.length === gameCodeLength) {
      document.querySelector("[name='playerName']")?.focus();
    }
  }

  function finishComposition() {
    isComposingCode = false;
    updateCodeInput();
  }

  source.addEventListener("focus", focusCodeInput);
  source.addEventListener("click", focusCodeInput);
  source.addEventListener("compositionstart", () => {
    isComposingCode = true;
  });
  source.addEventListener("compositionend", finishComposition);
  source.addEventListener("input", (event) => {
    if (isComposingCode || event.isComposing || event.inputType === "insertCompositionText") return;
    updateCodeInput();
  });
  source.addEventListener("paste", () => {
    setTimeout(updateCodeInput, 0);
  });
  syncGameCodeInput();
}

function gameScorePills(players) {
  return [...players]
    .sort((a, b) => b.score - a.score || Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username))
    .map(
      (player) => `
        <li class="game-score-pill ${player.id === state.playerId ? "is-me" : ""}">
          <span class="game-score-name">${escapeHtml(player.username)}</span>
          <span class="game-score-value">${player.score}</span>
        </li>
      `
    )
    .join("");
}

function renderGameNotifications() {
  return state.notifications
    .map(
      (notification) => `
        <div class="game-toast is-${notification.type}" data-id="${notification.id}">
          ${escapeHtml(notification.message)}
        </div>
      `
    )
    .join("");
}

function renderHome() {
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="${assetUrl("/assets/quest-camera.svg")}" alt="">
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
  const username = escapeHtml(readLastUsername());
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="${assetUrl("/assets/quest-camera.svg")}" alt="">
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
            <input class="text-input" name="ownerName" autocomplete="nickname" maxlength="24" required placeholder="Game owner" value="${username}" autofocus>
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
  const prefill = normalizeGameIdInput(state.prefillGameId);
  const username = escapeHtml(readLastUsername());
  app.innerHTML = `
    <section class="screen screen-grid">
      <div class="hero-side">
        <div class="hero-art">
          <img src="${assetUrl("/assets/quest-camera.svg")}" alt="">
          <h1>Join Game</h1>
          <p>Use the game ID from the host to jump into the lobby.</p>
        </div>
      </div>
      <div class="form-side single-form-side">
        ${renderNotice()}
        <form class="action-panel stack" id="joinForm">
          <h2>Join Game</h2>
          <div class="field game-id-field">
            <span id="gameCodeLabel">Game ID</span>
            <div class="passcode-input" role="group" aria-labelledby="gameCodeLabel">
              <input
                class="passcode-source"
                id="gameIdHidden"
                name="gameId"
                type="text"
                inputmode="text"
                lang="en"
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
                maxlength="${gameCodeLength}"
                pattern="[A-Za-z0-9]*"
                enterkeyhint="next"
                aria-label="Game ID"
                value="${escapeHtml(prefill)}"
              >
              ${gameCodeCells(prefill)}
            </div>
            <span class="field-hint" id="gameCodeError" aria-live="polite"></span>
          </div>
          <label class="field">
            <span>Your name</span>
            <input class="text-input" name="playerName" autocomplete="nickname" maxlength="24" required placeholder="Player" value="${username}">
          </label>
          <button class="primary-button" type="submit">Join game</button>
          <button class="secondary-button" id="backToChoiceButton" type="button">Back</button>
        </form>
      </div>
    </section>
  `;

  setupGameCodeInput();
  if (prefill.length === gameCodeLength) {
    document.querySelector("[name='playerName']")?.focus();
  } else {
    document.querySelector("#gameIdHidden")?.focus();
  }
  document.querySelector("#joinForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (syncGameCodeInput().length !== gameCodeLength) {
      setGameCodeError("Enter the 6-character Game ID.");
      document.querySelector("#gameIdHidden")?.focus();
      return;
    }
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
  const countdown = countdownState(game);
  const countdownLeft = countdown?.left || 0;
  const isRoundActive = countdown?.mode === "round";
  const isUrgent = isRoundActive && countdownLeft > 0 && countdownLeft <= 10000;
  const alertDuration = `${alertFlashDuration(countdownLeft)}s`;
  const cameraMessage = cameraState.error || (cameraState.stream ? "Camera ready" : "Starting camera");
  const cameraDisabled = !isRoundActive || !cameraState.stream || Boolean(cameraState.error) || cameraState.sending;
  const isOwner = game.me?.id === game.ownerPlayerId;
  const exitButtonId = isOwner ? "endGameButton" : "leaveGameButton";
  const exitLabel = isOwner ? "End game" : "Leave game";
  app.innerHTML = `
    <section class="screen game-screen">
      <video id="cameraVideo" class="game-camera-video" autoplay playsinline muted></video>
      <div class="game-camera-shade"></div>
      <div class="urgency-alert ${isUrgent ? "is-visible" : ""}" style="--alert-duration:${alertDuration}" aria-hidden="true"></div>
      <div class="game-overlay">
        <button class="game-exit-button" id="${exitButtonId}" type="button" aria-label="${exitLabel}" title="${exitLabel}">x</button>
        <header class="game-hud">
          <div class="game-hud-top">
            <span class="game-round-label">${escapeHtml(countdownLabel(game, countdown))}</span>
            <span class="round-time">${formatSeconds(countdownLeft)}</span>
          </div>
          <h1 class="game-target-word">${escapeHtml(countdownTitle(game, countdown))}</h1>
          ${timerMarkup(countdown, { showChip: false })}
          <div class="last-chance-warning ${isUrgent ? "is-visible" : ""}" style="--alert-duration:${alertDuration}" aria-live="polite">
            <span>Last chance</span>
            <strong class="last-chance-time">${formatSeconds(countdownLeft)}</strong>
          </div>
          <div class="game-info-strip">
            ${countdown?.mode === "break" && game.lastResult?.message ? `<span>${escapeHtml(game.lastResult.message)}</span>` : ""}
            <span>${escapeHtml(cameraMessage)}</span>
            <span>${game.players.length}/${game.maxPlayers} players</span>
            <span>${game.itemQueueCount} backups</span>
          </div>
        </header>

        <div class="game-toast-stack" aria-live="polite">
          ${renderGameNotifications()}
        </div>

        <footer class="game-bottom-bar">
          <ul class="game-score-strip" aria-label="Scores">
            ${gameScorePills(game.players)}
          </ul>
          <div class="game-action-row">
            <button class="primary-button game-shutter-button" id="submitPhotoButton" type="button" ${cameraDisabled ? "disabled" : ""}>
              ${cameraState.sending ? "Checking..." : "Snap and verify"}
            </button>
          </div>
        </footer>
      </div>
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
  renderConnectionPill();
  document.body.classList.toggle("is-game-active", state.view === "game");
  if (state.view === "home") renderHome();
  if (state.view === "create") renderCreate();
  if (state.view === "join") renderJoin();
  if (state.view === "lobby") renderLobby();
  if (state.view === "game") renderGame();
  if (state.view === "end") renderEnd();

  if (countdownState(state.game)) {
    updateCountdownDisplays();
    state.timerInterval = setInterval(updateCountdownDisplays, 25);
  }

  syncCameraWithView();
}

async function submitPhoto() {
  const imageDataUrl = captureVideoFrame();
  if (!imageDataUrl || cameraState.sending) return;

  cameraState.sending = true;
  state.notice = "";
  pushNotification("Photo sent. Checking...", "info");

  const response = await emitAck("submit_capture", {
    gameId: state.game.id,
    imageDataUrl
  });
  if (!response.ok) {
    cameraState.sending = false;
    showMessage(response.error, "danger");
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
  state.notice = "";
  pushNotification(`Find ${item}.`, "target");
});

socket.on("round_result", (result) => {
  cameraState.sending = false;
  state.notice = "";
  pushNotification(result.message, result.status);
});

socket.on("submission_result", (result) => {
  if (result.status !== "checking") {
    cameraState.sending = false;
  }
  if (result.status === "checking") {
    pushNotification(result.message, "info");
  } else if (result.status !== "miss") {
    showMessage(result.message, result.status);
  } else {
    render();
  }
});

socket.on("capture_notice", (result) => {
  if (result.playerId === state.playerId) {
    cameraState.sending = false;
  }
  state.notice = "";
  pushNotification(result.message, result.status);
});

socket.on("game_ended", ({ winner, message }) => {
  cameraState.sending = false;
  state.notice = message || (winner ? `${winner.username} wins.` : "Game ended.");
  playGameEndedSound(state.game?.id || "");
  render();
});

socket.on("notice", ({ message }) => {
  showMessage(message);
});

socket.on("left_game", ({ message }) => {
  resetLocalGame(message || "You left the game.");
});

leaderboardButton.addEventListener("click", openLeaderboard);
closeLeaderboardButton.addEventListener("click", () => leaderboardDialog.close());

document.addEventListener(
  "pointerdown",
  () => {
    unlockAudio();
  },
  { once: true, capture: true }
);

document.addEventListener(
  "click",
  (event) => {
    if (event.target instanceof Element && event.target.closest("button")) playButtonSound();
  },
  true
);

document.addEventListener("gesturestart", preventZoomGesture, { passive: false });
document.addEventListener("gesturechange", preventZoomGesture, { passive: false });
document.addEventListener("gestureend", preventZoomGesture, { passive: false });
document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) preventZoomGesture(event);
  },
  { passive: false }
);
document.addEventListener("keydown", preventZoomShortcut);
document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && isCameraExpected()) {
    resetCameraHealth();
    attachCameraStream();
    if (!cameraState.stream) ensureCamera({ rerender: state.view === "game" });
  }
});

if ("serviceWorker" in navigator) {
  const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);
  let reloadingForServiceWorkerUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadServiceWorkerController || reloadingForServiceWorkerUpdate) return;
    reloadingForServiceWorkerUpdate = true;
    window.location.reload();
  });
  navigator.serviceWorker
    .register(assetUrl("/service-worker.js"))
    .then((registration) => registration.update())
    .catch(() => {});
}

render();
