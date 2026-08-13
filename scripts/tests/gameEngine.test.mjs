import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { speechLanguageCode, speechRequestBody } from "../../server/challengeAudio.js";
import { funnyAnimalUsernames, GameEngine, normalizeGameCode } from "../../server/gameEngine.js";
import { createLlm } from "../../server/llm.js";

const tinyImage = "data:image/jpeg;base64,AAAA";
const clientIds = {
  owner: "10000000-0000-4000-8000-000000000001",
  playerA: "20000000-0000-4000-8000-000000000002",
  playerB: "30000000-0000-4000-8000-000000000003",
  playerC: "40000000-0000-4000-8000-000000000004"
};

const engines = new Set();

afterEach(() => {
  for (const engine of engines) {
    for (const game of engine.games.values()) {
      engine.clearTimers(game);
    }
  }
  engines.clear();
});

function gameConfig(overrides = {}) {
  return {
    game: {
      maxPlayers: 50,
      normalRounds: 3,
      objectTimeoutMs: 5000,
      nextRoundDelayMs: 25,
      itemBatchSize: 6,
      refillThreshold: 2,
      submissionLimitBytes: 2_000_000,
      ...overrides
    }
  };
}

function createIo() {
  const sockets = new Map();

  const io = {
    sockets: { sockets },
    createSocket(id = `socket-${sockets.size + 1}`) {
      const socket = {
        id,
        connected: true,
        rooms: new Set(),
        events: [],
        join(room) {
          this.rooms.add(room);
        },
        leave(room) {
          this.rooms.delete(room);
        },
        emit(event, payload) {
          this.events.push({ event, payload });
        },
        disconnect() {
          this.connected = false;
          this.events.push({ event: "disconnect", payload: "io server disconnect" });
        },
        last(event) {
          return [...this.events].reverse().find((entry) => entry.event === event)?.payload;
        },
        all(event) {
          return this.events.filter((entry) => entry.event === event).map((entry) => entry.payload);
        }
      };
      sockets.set(id, socket);
      return socket;
    },
    to(target) {
      return {
        emit(event, payload) {
          const socket = sockets.get(target);
          if (socket) {
            socket.emit(event, payload);
            return;
          }

          for (const roomSocket of sockets.values()) {
            if (roomSocket.rooms.has(target)) {
              roomSocket.emit(event, payload);
            }
          }
        }
      };
    }
  };

  return io;
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createDatabase() {
  const results = [];
  return {
    enabled: false,
    results,
    async saveGameResult(result) {
      results.push(result);
    }
  };
}

function createEngine({
  items = ["shoe", "book", "pencil", "mug", "chair", "hat"],
  preparedItems = [],
  verifyPhoto = async () => ({ match: true, confidence: 0.9, reason: "matched" }),
  audioUrl = "",
  config = gameConfig(),
  logger = null
} = {}) {
  const io = createIo();
  const database = createDatabase();
  const llmCalls = {
    generateItems: [],
    prepareInitialItems: [],
    verifyPhoto: []
  };
  const llm = {
    async generateItems(args = {}) {
      llmCalls.generateItems.push(args);
      return [...items];
    },
    async prepareInitialItems(args = {}) {
      llmCalls.prepareInitialItems.push(args);
      return preparedItems.length ? [...preparedItems] : [];
    },
    async verifyPhoto(args = {}) {
      llmCalls.verifyPhoto.push(args);
      return verifyPhoto(args, llmCalls.verifyPhoto.length);
    }
  };
  const audioCache = {
    enabled: Boolean(audioUrl),
    async prepareAudio({ item, languageCode }) {
      return audioUrl ? `${audioUrl}/${languageCode}/${encodeURIComponent(item)}.wav` : "";
    }
  };
  const engine = new GameEngine({
    io,
    config,
    llm,
    database,
    audioCache,
    logger: logger || { warn() {}, info() {}, error() {} }
  });
  engines.add(engine);
  return { engine, io, database, llmCalls };
}

function playerByName(game, username) {
  return [...game.players.values()].find((player) => player.username === username);
}

async function waitFor(predicate, message = "condition", timeoutMs = 1000) {
  const startedAt = Date.now();
  for (;;) {
    if (predicate()) return;
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out waiting for ${message}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function startReadyGame(engine, ownerSocket, game, playerSockets = []) {
  for (const player of game.players.values()) {
    player.ready = true;
  }
  const started = await engine.startGame(ownerSocket, { gameId: game.id });
  assert.equal(started.error, undefined);
  await waitFor(() => game.currentRound?.status === "active", "active round");
  for (const socket of [ownerSocket, ...playerSockets]) {
    assert.equal(socket.last("game_state")?.status, "running");
  }
}

test("normalizes Crockford Base32 game codes", () => {
  assert.equal(normalizeGameCode("ab c-123"), "ABC123");
  assert.equal(normalizeGameCode("ol-i234"), "011234");
  assert.equal(normalizeGameCode("ABC12"), null);
  assert.equal(normalizeGameCode("ABC12U"), null);
});

test("allows up to fifty players in a game", () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const { game } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner
  });

  for (let index = 1; index < 50; index += 1) {
    const socket = io.createSocket(`player-${index}`);
    const joined = engine.joinGame(socket, {
      gameId: game.id,
      username: `Player ${index}`,
      clientId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    });
    assert.equal(joined.error, undefined);
  }

  const tooMany = engine.joinGame(io.createSocket("player-50"), {
    gameId: game.id,
    username: "Player 50",
    clientId: "20000000-0000-4000-8000-000000000050"
  });
  assert.equal(game.players.size, 50);
  assert.match(tooMany.error, /full/);
});

test("maps Chinese script and dialect language choices to TTS speech hints", () => {
  assert.equal(speechLanguageCode("zh-hans-yue"), "yue-HK");
  assert.equal(speechLanguageCode("zh-hant-yue"), "yue-HK");
  assert.equal(speechLanguageCode("zh-hans-cmn"), "cmn-CN");
  assert.equal(speechLanguageCode("zh-hant-cmn"), "cmn-TW");
  assert.equal(speechLanguageCode("zh"), "cmn-CN");
  assert.equal(speechLanguageCode("zh-hant"), "cmn-TW");
});

test("puts TTS language guidance in the prompt without provider options", () => {
  const body = speechRequestBody({
    openRouter: {
      ttsModel: "google/gemini-3.1-flash-tts-preview",
      ttsVoice: "Kore"
    },
    item: "鉛筆",
    languageCode: "zh-hant-yue",
    languageName: "Chinese traditional (Cantonese)",
    responseFormat: "mp3"
  });

  assert.equal(body.model, "google/gemini-3.1-flash-tts-preview");
  assert.equal(body.voice, "Kore");
  assert.equal(body.response_format, "mp3");
  assert.equal("provider" in body, false);
  assert.match(body.input, /Chinese traditional \(Cantonese\)/);
  assert.match(body.input, /鉛筆/);
  assert.match(body.input, /Say only the object phrase/);
});

test("vision verifier prompt accepts drawings and photos of the target object", async () => {
  const previousFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options = {}) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  match: true,
                  confidence: 0.93,
                  reason: "The drawing clearly depicts the target."
                })
              }
            }
          ]
        };
      },
      async text() {
        return "";
      }
    };
  };

  try {
    const llm = createLlm(
      {
        publicBaseUrl: "http://localhost",
        openRouter: {
          apiKey: "test-key",
          model: "default-model",
          visionModel: "vision-model",
          baseUrl: "http://openrouter.test",
          mockWhenMissingKey: false
        }
      },
      { warn() {}, info() {}, error() {} }
    );

    const result = await llm.verifyPhoto({
      item: "shoe",
      language: "French",
      imageDataUrl: tinyImage
    });

    const textPart = requestBody.messages[1].content.find((part) => part.type === "text").text;
    const imagePart = requestBody.messages[1].content.find((part) => part.type === "image_url");

    assert.equal(requestBody.model, "vision-model");
    assert.equal(result.match, true);
    assert.equal(result.confidence, 0.93);
    assert.match(textPart, /clear visual representation/);
    assert.match(textPart, /drawing, printed picture, photo, sticker, icon/);
    assert.match(textPart, /text-only label/);
    assert.match(textPart, /French/);
    assert.equal(imagePart.image_url.url, tinyImage);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("uses a funny animal owner name when create-game username is blank", () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const { player } = engine.createGame(owner, {
    username: "   ",
    clientId: clientIds.owner
  });

  assert.ok(funnyAnimalUsernames.includes(player.username));
});

test("keeps a broad funny animal username pool", () => {
  assert.equal(funnyAnimalUsernames.length, 50);
});

test("uses an available funny animal player name when join-game username is blank", () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerB = io.createSocket("player-b");
  const { game } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner
  });

  const joinedA = engine.joinGame(playerA, {
    gameId: game.id,
    username: "   ",
    clientId: clientIds.playerA
  });
  const joinedB = engine.joinGame(playerB, {
    gameId: game.id,
    username: "",
    clientId: clientIds.playerB
  });

  assert.ok(funnyAnimalUsernames.includes(joinedA.player.username));
  assert.ok(funnyAnimalUsernames.includes(joinedB.player.username));
  assert.notEqual(joinedA.player.username, joinedB.player.username);
});

test("blank-name joins reattach the same local client before start", async () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerAReconnect = io.createSocket("player-a-reconnect");
  const { game } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner
  });

  const joined = engine.joinGame(playerA, {
    gameId: game.id,
    clientId: clientIds.playerA
  });
  const rejoined = engine.joinGame(playerAReconnect, {
    gameId: game.id,
    clientId: clientIds.playerA
  });

  assert.equal(rejoined.error, undefined);
  assert.equal(rejoined.player.id, joined.player.id);
  assert.equal(playerA.last("left_game").preserveSession, true);
  await waitFor(() => !playerA.connected, "previous blank-name session disconnect");
});

test("edits lobby names and game options before the game starts", async () => {
  const { engine, io, llmCalls } = createEngine({
    preparedItems: ["chaussure", "sac"],
    items: ["livre", "stylo", "chaise"]
  });
  const owner = io.createSocket("owner");
  const playerSocket = io.createSocket("player");
  const { game, player: ownerPlayer } = engine.createGame(owner, {
    clientId: clientIds.owner
  });
  const joined = engine.joinGame(playerSocket, {
    gameId: game.id,
    clientId: clientIds.playerA
  });

  assert.ok(funnyAnimalUsernames.includes(ownerPlayer.username));
  assert.ok(funnyAnimalUsernames.includes(joined.player.username));
  assert.notEqual(ownerPlayer.username, joined.player.username);

  const duplicateName = engine.updatePlayerName(playerSocket, {
    gameId: game.id,
    username: ownerPlayer.username
  });
  assert.match(duplicateName.error, /already used/);

  joined.player.ready = true;
  const renamed = engine.updatePlayerName(playerSocket, {
    gameId: game.id,
    username: "Scout"
  });
  assert.equal(renamed.error, undefined);
  assert.equal(joined.player.username, "Scout");
  assert.equal(joined.player.ready, true);

  ownerPlayer.ready = true;
  joined.player.ready = true;
  const options = engine.updateGameOptions(owner, {
    gameId: game.id,
    challengeLanguage: "fr",
    initialChallengeInput: "shoe, bag",
    teamUpEnabled: true
  });
  assert.equal(options.error, undefined);
  assert.equal(game.challengeLanguage, "fr");
  assert.equal(game.initialChallengeInput, "shoe, bag");
  assert.equal(game.teamUpEnabled, true);
  assert.equal(game.teams.length, 2);
  assert.match(ownerPlayer.teamId, /^(red|blue)$/);
  assert.match(joined.player.teamId, /^(red|blue)$/);
  assert.equal(ownerPlayer.ready, true);
  assert.equal(joined.player.ready, true);
  assert.equal(owner.last("game_state").challengeLanguage, "fr");
  assert.equal(owner.last("game_state").initialChallengeInput, "shoe, bag");
  assert.equal(playerSocket.last("game_state").initialChallengeInput, undefined);

  const explicitlyUnready = engine.setReady(playerSocket, { gameId: game.id, ready: false });
  assert.equal(explicitlyUnready.error, undefined);
  assert.equal(joined.player.ready, false);
  const blockedStart = await engine.startGame(owner, { gameId: game.id });
  assert.match(blockedStart.error, /Every player must be ready/);
  engine.setReady(playerSocket, { gameId: game.id, ready: true });

  const teamOff = engine.updateGameOptions(owner, {
    gameId: game.id,
    challengeLanguage: "fr",
    initialChallengeInput: "shoe, bag",
    teamUpEnabled: false
  });
  assert.equal(teamOff.error, undefined);
  assert.equal(ownerPlayer.ready, true);
  assert.equal(joined.player.ready, true);
  assert.equal(ownerPlayer.teamId, null);
  assert.equal(joined.player.teamId, null);

  const teamOn = engine.updateGameOptions(owner, {
    gameId: game.id,
    challengeLanguage: "fr",
    initialChallengeInput: "shoe, bag",
    teamUpEnabled: true
  });
  assert.equal(teamOn.error, undefined);
  assert.equal(ownerPlayer.ready, true);
  assert.equal(joined.player.ready, true);
  assert.match(ownerPlayer.teamId, /^(red|blue)$/);
  assert.match(joined.player.teamId, /^(red|blue)$/);

  await startReadyGame(engine, owner, game, [playerSocket]);
  assert.equal(llmCalls.prepareInitialItems[0].language, "French");
});

test("local AI fallback respects Chinese script and dialect selections", async () => {
  const llm = createLlm(
    {
      publicBaseUrl: "",
      openRouter: {
        apiKey: "",
        model: "mock",
        visionModel: "mock",
        baseUrl: "http://localhost",
        mockWhenMissingKey: true
      }
    },
    { warn() {}, info() {}, error() {} }
  );

  const simplifiedMandarinSeed = await llm.prepareInitialItems({
    input: "water bottle, pencil, blue shoe",
    count: 3,
    language: "Chinese simplified (Mandarin)"
  });
  assert.deepEqual(simplifiedMandarinSeed, ["水瓶", "铅笔", "蓝色鞋子"]);

  const traditionalCantoneseSeed = await llm.prepareInitialItems({
    input: "water bottle, pencil",
    count: 2,
    language: "Chinese traditional (Cantonese)"
  });
  assert.deepEqual(traditionalCantoneseSeed, ["水樽", "鉛筆"]);

  const generatedCantonese = await llm.generateItems({
    count: 12,
    language: "Chinese simplified (Cantonese)"
  });
  assert.equal(generatedCantonese.length, 12);
  assert.equal(generatedCantonese.every((item) => !/[a-z]/i.test(item)), true);
});

test("announces Chinese script and dialect variants with distinct language metadata", async () => {
  const { engine, io, llmCalls } = createEngine({
    items: ["铅笔", "书包"],
    audioUrl: "https://cdn.example.test/tts"
  });
  const owner = io.createSocket("owner");
  const { game } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner,
    challengeLanguage: "zh-hans-yue"
  });

  await startReadyGame(engine, owner, game);

  assert.equal(llmCalls.generateItems[0].language, "Chinese simplified (Cantonese)");
  assert.equal(game.currentRound.item, "铅笔");
  assert.equal(game.currentRound.languageCode, "ZH-HANS-YUE");
  assert.equal(game.currentRound.languageName, "Chinese simplified (Cantonese)");
  assert.match(game.currentRound.audioUrl, /\/zh-hans-yue\/%E9%93%85%E7%AC%94\.wav$/);
});

test("creates, joins, rejoins, gates readiness, and starts localized rounds", async () => {
  const { engine, io, llmCalls } = createEngine({
    preparedItems: ["chaussure", "chaussure", "sac"],
    items: ["livre", "stylo", "chaise"],
    audioUrl: "https://cdn.example.test/tts"
  });
  const owner = io.createSocket("owner");
  const firstPlayerSocket = io.createSocket("first-player");
  const secondPlayerSocket = io.createSocket("second-player");

  const { game, player: ownerPlayer } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner,
    challengeLanguage: "fr",
    initialChallengeInput: "shoe, bag"
  });
  assert.match(game.id, /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(ownerPlayer.isOwner, true);

  const joined = engine.joinGame(firstPlayerSocket, {
    gameId: game.id.toLowerCase(),
    username: "Scout",
    clientId: clientIds.playerA
  });
  assert.equal(joined.error, undefined);
  assert.equal(ownerPlayer.ready, true);
  assert.equal(joined.player.ready, true);

  const duplicateName = engine.joinGame(io.createSocket("duplicate-name"), {
    gameId: game.id,
    username: "Scout",
    clientId: clientIds.playerB
  });
  assert.match(duplicateName.error, /already used/);

  joined.player.ready = false;
  const blockedStart = await engine.startGame(owner, { gameId: game.id });
  assert.match(blockedStart.error, /Every player must be ready/);

  const rejoined = engine.joinGame(secondPlayerSocket, {
    gameId: game.id,
    username: "Scout",
    clientId: clientIds.playerA
  });
  assert.equal(rejoined.error, undefined);
  assert.equal(rejoined.player.id, joined.player.id);
  assert.equal(firstPlayerSocket.last("left_game").preserveSession, true);
  await waitFor(() => !firstPlayerSocket.connected, "previous session disconnect");

  await startReadyGame(engine, owner, game, [secondPlayerSocket]);

  assert.equal(llmCalls.prepareInitialItems[0].language, "French");
  assert.equal(game.currentRound.item, "chaussure");
  assert.equal(game.currentRound.languageCode, "FR");
  assert.equal(game.currentRound.languageName, "French");
  assert.match(game.currentRound.audioUrl, /\/fr\/chaussure\.wav$/);
});

test("verifies captures in a per-game queue, penalizes misses, and drops later answers after a match", async () => {
  const firstVerification = createDeferred();
  let verificationCount = 0;
  const { engine, io, llmCalls } = createEngine({
    items: ["shoe", "book", "pencil"],
    verifyPhoto: async () => {
      verificationCount += 1;
      if (verificationCount === 1) {
        return { match: false, confidence: 0.2, reason: "wrong object" };
      }
      await firstVerification.promise;
      return { match: true, confidence: 0.98, reason: "shoe found" };
    }
  });
  const owner = io.createSocket("owner");
  const playerSocket = io.createSocket("player");
  const { game, player: ownerPlayer } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner,
    challengeLanguage: "es"
  });
  const joined = engine.joinGame(playerSocket, {
    gameId: game.id,
    username: "Player",
    clientId: clientIds.playerA
  });
  await startReadyGame(engine, owner, game, [playerSocket]);

  const staleSubmission = engine.submitCapture(owner, {
    gameId: game.id,
    challengeId: "wrong-challenge",
    imageDataUrl: tinyImage
  });
  assert.equal(staleSubmission.ignored, true);

  const firstRoundId = game.currentRound.id;
  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: firstRoundId, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => llmCalls.verifyPhoto.length === 1, "first verification starts");
  assert.equal(llmCalls.verifyPhoto[0].item, "shoe");
  assert.equal(llmCalls.verifyPhoto[0].language, "Spanish");
  await waitFor(() => ownerPlayer.score === -1, "miss penalty");
  assert.equal(ownerPlayer.score, -1);
  assert.equal(owner.last("submission_result").status, "miss");
  assert.equal(game.currentRound.status, "active");

  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: firstRoundId, imageDataUrl: tinyImage }).ok, true);
  assert.equal(engine.submitCapture(playerSocket, { gameId: game.id, challengeId: firstRoundId, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => llmCalls.verifyPhoto.length === 2, "second verification starts");
  firstVerification.resolve();
  await waitFor(() => game.lastResult?.status === "found", "round found");

  assert.equal(ownerPlayer.score, 0);
  assert.equal(joined.player.score, 0);
  assert.equal(game.roundsAwarded, 1);
  assert.equal(game.submissionQueue.length, 0);
  assert.equal(llmCalls.verifyPhoto.length, 2);
  assert.equal(game.lastResult.username, "Host");
});

test("keeps loading transitions in-game between rounds and does not repeat presented challenges", async () => {
  const seenPreviousItems = [];
  const { engine, io, llmCalls } = createEngine({
    items: ["shoe", "shoe", "book", "books", "pencil"],
    verifyPhoto: async () => ({ match: true, confidence: 0.9, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const { game } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  await startReadyGame(engine, owner, game);

  assert.equal(game.currentRound.item, "shoe");
  const firstRoundId = game.currentRound.id;
  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: firstRoundId, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => game.lastResult?.status === "found", "first round found");
  assert.equal(game.nextRoundAt > Date.now(), true);

  await waitFor(() => game.currentRound?.status === "active" && game.roundNumber === 2, "second active round");
  for (const call of llmCalls.generateItems) {
    seenPreviousItems.push(...(call.previousItems || []));
  }
  assert.equal(game.currentRound.item, "book");
  assert.deepEqual(game.usedItems, ["shoe", "book"]);
  assert.ok(seenPreviousItems.includes("shoe"));
});

test("skips the current object when more than half of players vote skip", async () => {
  const { engine, io, llmCalls } = createEngine({
    config: gameConfig({ nextRoundDelayMs: 10 }),
    items: ["shoe", "book", "pencil"],
    verifyPhoto: async () => ({ match: true, confidence: 0.9, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerB = io.createSocket("player-b");
  const { game, player: ownerPlayer } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  engine.joinGame(playerA, { gameId: game.id, username: "Player A", clientId: clientIds.playerA });
  engine.joinGame(playerB, { gameId: game.id, username: "Player B", clientId: clientIds.playerB });
  await startReadyGame(engine, owner, game, [playerA, playerB]);

  const firstRoundId = game.currentRound.id;
  const firstSkip = engine.voteSkipRound(owner, { gameId: game.id, challengeId: firstRoundId });
  assert.equal(firstSkip.error, undefined);
  assert.equal(firstSkip.skip.votes, 1);
  assert.equal(firstSkip.skip.threshold, 2);
  assert.equal(game.currentRound.status, "active");
  assert.equal(engine.getSnapshot(game, ownerPlayer.id).currentRound.skip.voted, true);

  const secondSkip = engine.voteSkipRound(playerA, { gameId: game.id, challengeId: firstRoundId });
  assert.equal(secondSkip.error, undefined);
  assert.equal(secondSkip.skip.passed, true);
  assert.equal(game.currentRound.status, "skipped");
  assert.equal(game.lastResult.status, "skipped");
  assert.equal(game.roundsAwarded, 0);
  assert.equal(llmCalls.verifyPhoto.length, 0);
  assert.equal(ownerPlayer.score, 0);
  assert.equal(game.nextRoundAt > Date.now(), true);

  await waitFor(() => game.currentRound?.status === "active" && game.roundNumber === 2, "next round after skip");
  assert.equal(game.currentRound.item, "book");
});

test("does not lower skip threshold when a player is reconnecting", async () => {
  const { engine, io } = createEngine({
    config: gameConfig({ nextRoundDelayMs: 10 }),
    items: ["shoe", "book"],
    verifyPhoto: async () => ({ match: true, confidence: 0.9, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const player = io.createSocket("player");
  const rejoinedPlayer = io.createSocket("player-rejoined");
  const { game } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  engine.joinGame(player, { gameId: game.id, username: "Player", clientId: clientIds.playerA });
  await startReadyGame(engine, owner, game, [player]);

  const firstRoundId = game.currentRound.id;
  engine.handleDisconnect(player);
  const firstSkip = engine.voteSkipRound(owner, { gameId: game.id, challengeId: firstRoundId });
  assert.equal(firstSkip.error, undefined);
  assert.equal(firstSkip.skip.votes, 1);
  assert.equal(firstSkip.skip.threshold, 2);
  assert.equal(firstSkip.skip.passed, false);
  assert.equal(game.currentRound.status, "active");

  const rejoin = engine.rejoinGame(rejoinedPlayer, {
    gameId: game.id,
    username: "Player",
    clientId: clientIds.playerA
  });
  assert.equal(rejoin.error, undefined);
  const secondSkip = engine.voteSkipRound(rejoinedPlayer, { gameId: game.id, challengeId: firstRoundId });
  assert.equal(secondSkip.skip.passed, true);
  assert.equal(game.currentRound.status, "skipped");
});

test("team-up skip votes count only after every player on a team votes", async () => {
  const { engine, io } = createEngine({
    config: gameConfig({ nextRoundDelayMs: 10 }),
    items: ["shoe", "book", "pencil"],
    verifyPhoto: async () => ({ match: true, confidence: 0.9, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerB = io.createSocket("player-b");
  const playerC = io.createSocket("player-c");
  const { game, player: ownerPlayer } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner,
    teamUpEnabled: true
  });
  const joinedA = engine.joinGame(playerA, { gameId: game.id, username: "Player A", clientId: clientIds.playerA });
  const joinedB = engine.joinGame(playerB, { gameId: game.id, username: "Player B", clientId: clientIds.playerB });
  const joinedC = engine.joinGame(playerC, { gameId: game.id, username: "Player C", clientId: clientIds.playerC });
  await startReadyGame(engine, owner, game, [playerA, playerB, playerC]);

  const byTeam = new Map();
  for (const entry of [
    { socket: owner, player: ownerPlayer },
    { socket: playerA, player: joinedA.player },
    { socket: playerB, player: joinedB.player },
    { socket: playerC, player: joinedC.player }
  ]) {
    if (!byTeam.has(entry.player.teamId)) byTeam.set(entry.player.teamId, []);
    byTeam.get(entry.player.teamId).push(entry);
  }
  const teamEntries = [...byTeam.values()];
  assert.equal(teamEntries.length, 2);
  assert.deepEqual(teamEntries.map((team) => team.length).sort(), [2, 2]);

  const firstRoundId = game.currentRound.id;
  const firstTeamFirstVote = engine.voteSkipRound(teamEntries[0][0].socket, {
    gameId: game.id,
    challengeId: firstRoundId
  });
  const secondTeamFirstVote = engine.voteSkipRound(teamEntries[1][0].socket, {
    gameId: game.id,
    challengeId: firstRoundId
  });
  assert.equal(firstTeamFirstVote.skip.votes, 0);
  assert.equal(secondTeamFirstVote.skip.votes, 0);
  assert.equal(game.currentRound.status, "active");

  const firstCompletedTeam = engine.voteSkipRound(teamEntries[0][1].socket, {
    gameId: game.id,
    challengeId: firstRoundId
  });
  assert.equal(firstCompletedTeam.skip.votes, 1);
  assert.equal(firstCompletedTeam.skip.threshold, 2);
  assert.equal(game.currentRound.status, "active");

  const secondCompletedTeam = engine.voteSkipRound(teamEntries[1][1].socket, {
    gameId: game.id,
    challengeId: firstRoundId
  });
  assert.equal(secondCompletedTeam.skip.passed, true);
  assert.equal(game.currentRound.status, "skipped");
  assert.equal(game.lastResult.status, "skipped");
});

test("marks the individual winner in ended game snapshots", async () => {
  const { engine, io } = createEngine({
    config: gameConfig({ normalRounds: 1, nextRoundDelayMs: 10 }),
    items: ["shoe", "book"],
    verifyPhoto: async () => ({ match: true, confidence: 0.95, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const player = io.createSocket("player");
  const { game } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  const joined = engine.joinGame(player, { gameId: game.id, username: "Runner", clientId: clientIds.playerA });

  await startReadyGame(engine, owner, game, [player]);
  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: game.currentRound.id, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => game.status === "lobby" && game.lastResult?.status === "ended", "individual game completion lobby");

  const finalState = engine.getSnapshot(game, game.ownerPlayerId);
  assert.equal(finalState.status, "lobby");
  assert.equal(finalState.winner.id, game.ownerPlayerId);
  assert.equal(finalState.players.find((snapshotPlayer) => snapshotPlayer.id === game.ownerPlayerId).isWinner, true);
  assert.equal(finalState.players.find((snapshotPlayer) => snapshotPlayer.id === joined.player.id).isWinner, false);
  assert.equal(finalState.players.find((snapshotPlayer) => snapshotPlayer.id === game.ownerPlayerId).score, 1);

  const restarted = await engine.restartGame(owner, { gameId: game.id });
  assert.equal(restarted.error, undefined);
  assert.equal(game.status, "lobby");
  assert.equal(game.lastResult, null);
  assert.equal(game.winner, null);
  assert.equal(game.players.get(game.ownerPlayerId).score, 0);
  assert.equal(joined.player.score, 0);

  const startedAgain = await engine.startGame(owner, { gameId: game.id });
  assert.equal(startedAgain.error, undefined);
  await waitFor(() => game.status === "running" && game.currentRound?.status === "active", "second game active round");
  assert.equal(game.winner, null);
  assert.equal(game.lastResult, null);
  assert.equal(game.roundsAwarded, 0);
  assert.equal(game.players.get(game.ownerPlayerId).score, 0);
  assert.equal(joined.player.score, 0);
});

test("recalculates completed lobby trophies when team-up mode changes", () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerB = io.createSocket("player-b");
  const { game } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  engine.joinGame(playerA, { gameId: game.id, username: "Runner", clientId: clientIds.playerA });
  engine.joinGame(playerB, { gameId: game.id, username: "Buddy", clientId: clientIds.playerB });

  const host = playerByName(game, "Host");
  playerByName(game, "Runner").score = 1;
  playerByName(game, "Buddy").score = -2;
  host.score = 5;
  game.winner = host;
  game.lastResult = {
    status: "ended",
    item: null,
    username: "Host",
    message: "Host wins."
  };

  const teamOn = engine.updateGameOptions(owner, {
    gameId: game.id,
    challengeLanguage: game.challengeLanguage,
    initialChallengeInput: game.initialChallengeInput,
    teamUpEnabled: true
  });
  assert.equal(teamOn.error, undefined);
  assert.equal(game.winner.id, host.teamId);
  assert.equal(game.lastResult.username, game.winner.name);

  const teamSnapshot = engine.getSnapshot(game, game.ownerPlayerId);
  assert.equal(teamSnapshot.winner.id, host.teamId);
  for (const player of teamSnapshot.players) {
    assert.equal(player.isWinner, player.teamId === host.teamId);
  }

  const teamOff = engine.updateGameOptions(owner, {
    gameId: game.id,
    challengeLanguage: game.challengeLanguage,
    initialChallengeInput: game.initialChallengeInput,
    teamUpEnabled: false
  });
  assert.equal(teamOff.error, undefined);
  assert.equal(game.winner.id, host.id);
  assert.equal(game.lastResult.username, "Host");

  const individualSnapshot = engine.getSnapshot(game, game.ownerPlayerId);
  assert.equal(individualSnapshot.winner.id, host.id);
  assert.deepEqual(
    individualSnapshot.players.map((player) => [player.username, player.isWinner]).sort(),
    [
      ["Buddy", false],
      ["Host", true],
      ["Runner", false]
    ]
  );
});

test("balances team-up mode and ends with team leaderboard data", async () => {
  let verificationCalls = 0;
  const { engine, io, database } = createEngine({
    config: gameConfig({ normalRounds: 1, nextRoundDelayMs: 10 }),
    items: ["shoe", "book"],
    verifyPhoto: async () => {
      verificationCalls += 1;
      return verificationCalls === 1
        ? { match: false, confidence: 0.3, reason: "not the object" }
        : { match: true, confidence: 0.95, reason: "matched" };
    }
  });
  const owner = io.createSocket("owner");
  const playerA = io.createSocket("player-a");
  const playerB = io.createSocket("player-b");
  const { game } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner,
    teamUpEnabled: true
  });
  const joinedA = engine.joinGame(playerA, { gameId: game.id, username: "Runner", clientId: clientIds.playerA });
  const joinedB = engine.joinGame(playerB, { gameId: game.id, username: "Cheer Buddy", clientId: clientIds.playerB });

  await startReadyGame(engine, owner, game, [playerA, playerB]);
  game.players.get(game.ownerPlayerId).teamId = "red";
  joinedB.player.teamId = "red";
  joinedA.player.teamId = "blue";

  const winningTeamId = game.players.get(game.ownerPlayerId).teamId;
  assert.notEqual(joinedA.player.teamId, winningTeamId);
  assert.equal(engine.submitCapture(playerA, { gameId: game.id, challengeId: game.currentRound.id, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => joinedA.player.penalties === 1, "team miss contributor");
  assert.equal(joinedA.player.score, -1);

  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: game.currentRound.id, imageDataUrl: tinyImage }).ok, true);
  await waitFor(() => game.status === "lobby" && game.lastResult?.status === "ended", "team game completion lobby");

  assert.equal(game.winner.id, winningTeamId);
  const finalState = engine.getSnapshot(game, game.ownerPlayerId);
  assert.equal(finalState.status, "lobby");
  assert.deepEqual(
    finalState.players
      .filter((player) => player.teamId === winningTeamId)
      .map((player) => [player.username, player.isWinner])
      .sort(),
    [
      ["Cheer Buddy", true],
      ["Host", true]
    ]
  );
  assert.equal(finalState.players.find((player) => player.teamId !== winningTeamId).isWinner, false);
  assert.equal(database.results.length, 1);
  assert.equal(database.results[0].teams.length, 2);
  assert.equal(database.results[0].winner.id, winningTeamId);
  const winningTeam = database.results[0].teams.find((team) => team.id === winningTeamId);
  const losingTeam = database.results[0].teams.find((team) => team.id === joinedA.player.teamId);
  assert.equal(winningTeam.score, 1);
  assert.deepEqual(winningTeam.contributors.map((player) => [player.username, player.score, player.pointsFound, player.penalties]), [
    ["Host", 1, 1, 0]
  ]);
  assert.equal(winningTeam.players, 2);
  assert.equal(losingTeam.score, -1);
  assert.deepEqual(losingTeam.contributors.map((player) => [player.username, player.score, player.pointsFound, player.penalties]), [
    ["Runner", -1, 0, 1]
  ]);
});

test("allows the owner to leave a lobby and transfers ownership", () => {
  const { engine, io } = createEngine();
  const owner = io.createSocket("owner");
  const player = io.createSocket("player");
  const soloOwner = io.createSocket("solo-owner");
  const { game, player: ownerPlayer } = engine.createGame(owner, {
    username: "Host",
    clientId: clientIds.owner
  });
  const joined = engine.joinGame(player, { gameId: game.id, username: "Player", clientId: clientIds.playerA });

  const ownerLeave = engine.leaveGame(owner, { gameId: game.id });
  const playerState = player.last("game_state");

  assert.equal(ownerLeave.left, true);
  assert.equal(game.players.has(ownerPlayer.id), false);
  assert.equal(game.ownerPlayerId, joined.player.id);
  assert.equal(joined.player.isOwner, true);
  assert.equal(playerState.ownerPlayerId, joined.player.id);
  assert.equal(playerState.me.isOwner, true);

  const { game: soloGame } = engine.createGame(soloOwner, { username: "Solo", clientId: clientIds.playerB });
  const soloLeave = engine.leaveGame(soloOwner, { gameId: soloGame.id });
  assert.equal(soloLeave.left, true);
  assert.equal(engine.games.has(soloGame.id), false);
});

test("supports owner pause/resume/end and restart with the same group", async () => {
  const { engine, io } = createEngine({
    items: ["shoe", "book"],
    verifyPhoto: async () => ({ match: true, confidence: 0.9, reason: "matched" })
  });
  const owner = io.createSocket("owner");
  const player = io.createSocket("player");
  const { game } = engine.createGame(owner, { username: "Host", clientId: clientIds.owner });
  const joined = engine.joinGame(player, { gameId: game.id, username: "Player", clientId: clientIds.playerA });
  await startReadyGame(engine, owner, game, [player]);

  const pauseByPlayer = engine.pauseGameByOwner(player, { gameId: game.id });
  assert.match(pauseByPlayer.error, /Only the game owner/);

  const paused = engine.pauseGameByOwner(owner, { gameId: game.id });
  assert.equal(paused.error, undefined);
  assert.equal(game.status, "paused");
  assert.equal(engine.submitCapture(owner, { gameId: game.id, challengeId: game.currentRound.id, imageDataUrl: tinyImage }).ignored, true);

  const resumed = engine.resumeGameByOwner(owner, { gameId: game.id });
  assert.equal(resumed.error, undefined);
  assert.equal(game.status, "running");

  const ownerLeave = engine.leaveGame(owner, { gameId: game.id });
  assert.match(ownerLeave.error, /owner must end/);

  await engine.endGameByOwner(owner, { gameId: game.id });
  assert.equal(game.status, "lobby");
  assert.equal(game.winner, null);
  assert.deepEqual(engine.getSnapshot(game, game.ownerPlayerId).players.map((player) => player.isWinner), [false, false]);

  const startedAgain = await engine.startGame(owner, { gameId: game.id });
  assert.equal(startedAgain.error, undefined);
  await waitFor(() => game.status === "running" && game.currentRound?.status === "active", "new game after owner end");
  assert.equal(game.roundNumber, 1);
  assert.equal(game.roundsAwarded, 0);
  assert.equal(game.players.size, 2);
  assert.equal(playerByName(game, "Host").score, 0);
  assert.equal(playerByName(game, "Host").ready, true);
  assert.equal(playerByName(game, "Player").score, 0);
  assert.equal(game.lastResult, null);
  assert.equal(game.winner, null);

  const playerLeave = engine.leaveGame(player, { gameId: game.id });
  assert.equal(playerLeave.left, true);
  assert.equal(game.players.has(joined.player.id), false);
});
