const registrationEvents = new Set([
  "create_game", "join_game", "rejoin_game"
]);
const maxServerMessageLength = 256 * 1024;

/** Native transport for the existing event/ack game interface. */
export function createGameTransport(options = {}) {
  const origin = options.origin || globalThis.location.origin;
  const fetchRequest = options.fetch || globalThis.fetch.bind(globalThis);
  const Socket = options.WebSocket || globalThis.WebSocket;
  const schedule = options.setTimeout || globalThis.setTimeout;
  const unschedule = options.clearTimeout || globalThis.clearTimeout;
  const random = options.random || Math.random;
  const listeners = new Map();
  const pending = new Map();
  let connection = null;
  let session = null;
  let generation = 0;
  let sequence = 0;
  let retryTimer = null;
  let retryCount = 0;
  let reconnecting = false;
  let registering = false;
  let disposed = false;

  function notify(event, payload) {
    for (const listener of [...(listeners.get(event) || [])]) {
      listener(payload);
    }
  }

  function setOnline(online, context = {}) {
    const changed = transport.connected !== online;
    transport.connected = online;
    if (changed || online && context.roomConnected) {
      notify(online ? "connect" : "disconnect", context);
    }
  }

  function finish(id, error, response) {
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    unschedule(request.timer);
    request.callback?.(error, response);
  }

  function failPending(message) {
    for (const id of [...pending.keys()]) {
      finish(id, new Error(message));
    }
  }

  function cancelRetry() {
    if (retryTimer !== null) unschedule(retryTimer);
    retryTimer = null;
  }

  function detach() {
    generation += 1;
    cancelRetry();
    const previous = connection;
    connection = null;
    if (previous) previous.close(1000, "Session changed");
    failPending("Connection changed. Please try again.");
  }

  function forgetSession() {
    session = null;
    retryCount = 0;
    detach();
  }

  async function requestJson(path, payload, timeoutMs) {
    const controller = new AbortController();
    const timer = schedule(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchRequest(new URL(path, origin), {
        method: payload === undefined ? "GET" : "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: payload === undefined
          ? { Accept: "application/json" }
          : { Accept: "application/json", "Content-Type": "application/json" },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: controller.signal
      });
      const text = await response.text();
      if (text.length > maxServerMessageLength) {
        throw new Error("The server response was too large.");
      }
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error("The server is temporarily unavailable.");
      }
      if (!result || typeof result !== "object" || Array.isArray(result)) {
        throw new Error("The server response was invalid.");
      }
      if (!response.ok && !result.error) {
        result.error = "The server is temporarily unavailable.";
      }
      if (!response.ok) result.ok = false;
      if (response.status === 429 || response.status >= 500) {
        result.retryable = true;
      }
      return result;
    } finally {
      unschedule(timer);
    }
  }

  function scheduleReconnect() {
    if (disposed || !session || retryTimer !== null || reconnecting) return;
    const delay = Math.min(15000, 500 * 2 ** Math.min(retryCount, 5));
    retryCount += 1;
    retryTimer = schedule(() => {
      retryTimer = null;
      reconnect();
    }, Math.round(delay * (0.75 + random() * 0.5)));
  }

  function connectRoom(timeoutMs) {
    detach();
    setOnline(false);
    const active = generation;
    const credentials = { ...session };
    const url = new URL(
      `/api/games/${encodeURIComponent(credentials.gameId)}/ws`, origin
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const socket = new Socket(url.toString());
    connection = socket;

    return new Promise((resolve, reject) => {
      let authenticated = false;
      let settled = false;
      const timer = schedule(() => {
        if (settled) return;
        settled = true;
        reject(new Error("The game connection did not answer in time."));
        socket.close(1000, "Authentication timed out");
      }, timeoutMs);

      function rejectAuthentication(message) {
        if (settled) return;
        settled = true;
        unschedule(timer);
        reject(new Error(message));
      }

      socket.addEventListener("open", () => {
        if (active !== generation || !session) return;
        socket.send(JSON.stringify({
          event: "authenticate",
          payload: {
            playerId: credentials.playerId,
            resumeToken: credentials.resumeToken
          }
        }));
      });

      socket.addEventListener("message", ({ data }) => {
        if (active !== generation || typeof data !== "string") return;
        if (data.length > maxServerMessageLength) {
          socket.close(1009, "Response too large");
          return;
        }
        let message;
        try { message = JSON.parse(data); } catch { return; }
        if (!message || typeof message !== "object") return;
        if (!authenticated) {
          if (message.event !== "authenticated") return;
          if (!message.payload?.ok) {
            rejectAuthentication(message.payload?.error || "Session expired.");
            forgetSession();
            notify("session_lost", message.payload || {});
            return;
          }
          authenticated = true;
          settled = true;
          unschedule(timer);
          retryCount = 0;
          setOnline(true, { roomConnected: true });
          resolve();
          return;
        }
        if (message.id !== undefined && "ack" in message) {
          finish(String(message.id), null, message.ack);
          return;
        }
        if (typeof message.event !== "string") return;
        if (message.event === "left_game") {
          // The engine broadcasts departure before its acknowledgement.
          for (const [id, request] of pending) {
            if (request.event === "leave_game") {
              finish(id, null, { ok: true });
            }
          }
          forgetSession();
        }
        notify(message.event, message.payload);
      });

      socket.addEventListener("close", () => {
        if (active !== generation) return;
        connection = null;
        setOnline(false);
        failPending("Connection lost. Please try again.");
        rejectAuthentication("The game connection was interrupted.");
        scheduleReconnect();
      });

      socket.addEventListener("error", () => {
        if (active !== generation) return;
        rejectAuthentication("The game connection is unavailable.");
      });
    });
  }

  async function register(event, payload, timeoutMs) {
    const gameId = String(payload.gameId || "").trim().toUpperCase();
    const path = event === "create_game"
      ? "/api/games"
      : `/api/games/${encodeURIComponent(gameId)}/${
          event === "join_game" ? "join" : "rejoin"
        }`;
    const result = await requestJson(path, payload, timeoutMs);
    if (!result.ok) return result;
    if (!result.gameId || !result.playerId || !result.resumeToken) {
      throw new Error("The server did not provide a secure game session.");
    }
    session = {
      gameId: result.gameId,
      playerId: result.playerId,
      resumeToken: result.resumeToken
    };
    notify("session", result);
    await connectRoom(Math.min(timeoutMs, 10000));
    return result;
  }

  async function reconnect() {
    if (disposed || reconnecting || !session) return;
    reconnecting = true;
    try {
      const result = await register("rejoin_game", session, 10000);
      if (!result.ok) {
        if (result.retryable || result.error === "Too many requests.") {
          throw new Error("The game server is busy.");
        }
        forgetSession();
        notify("session_lost", result);
      }
    } catch {
      // Reconnection never repeats a gameplay mutation or a create/join request.
    } finally {
      reconnecting = false;
      if (!transport.connected) scheduleReconnect();
    }
  }

  function emit(event, payload, callback, timeoutMs) {
    if (disposed) {
      callback?.(new Error("The game connection was closed."));
      return;
    }
    if (registrationEvents.has(event)) {
      if (registering) {
        callback?.(null, { ok: false, error: "A game connection is in progress." });
        return;
      }
      registering = true;
      register(event, payload || {}, timeoutMs)
        .then((result) => callback?.(null, result))
        .catch((error) => callback?.(error))
        .finally(() => { registering = false; });
      return;
    }
    if (!session || !connection || connection.readyState !== 1 ||
        !transport.connected) {
      callback?.(new Error("The game is reconnecting. Please try again."));
      return;
    }
    const id = String(++sequence);
    const timer = schedule(() => {
      finish(id, new Error("The server did not answer in time."));
    }, timeoutMs);
    pending.set(id, { callback, timer, event });
    try {
      connection.send(JSON.stringify({ id, event, payload: payload || {} }));
    } catch {
      finish(id, new Error("The game connection was interrupted."));
    }
  }

  const transport = {
    connected: false,
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return transport;
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
      return transport;
    },
    timeout(timeoutMs) {
      return {
        emit(event, payload, callback) {
          emit(event, payload, callback, timeoutMs);
        }
      };
    },
    forgetSession,
    close() {
      disposed = true;
      forgetSession();
      setOnline(false);
    }
  };

  async function initialize() {
    if (disposed) return;
    try {
      const health = await requestJson("/api/health", undefined, 8000);
      if (!health.ok) throw new Error("The game server is unavailable.");
      setOnline(true, { roomConnected: false });
    } catch {
      if (!disposed) retryTimer = schedule(initialize, 5000);
    }
  }
  if (options.autoStart !== false) queueMicrotask(initialize);
  return transport;
}
