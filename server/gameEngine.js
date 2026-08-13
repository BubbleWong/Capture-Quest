import crypto from "node:crypto";

export const crockfordBase32Alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const gameCodeLength = 6;
const challengeLanguages = new Map([
  ["ar", "Arabic"],
  ["zh-hans-yue", "Chinese simplified (Cantonese)"],
  ["zh-hans-cmn", "Chinese simplified (Mandarin)"],
  ["zh-hant-yue", "Chinese traditional (Cantonese)"],
  ["zh-hant-cmn", "Chinese traditional (Mandarin)"],
  ["en", "English"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["es", "Spanish"],
  ["zh", "Chinese simplified (Mandarin)"],
  ["zh-hant", "Chinese traditional (Mandarin)"],
  ["zh-hans-cn-cmn", "Chinese simplified (Mandarin)"],
  ["zh-hans-cn-yue", "Chinese simplified (Cantonese)"],
  ["zh-hant-tw-cmn", "Chinese traditional (Mandarin)"],
  ["zh-hant-hk-yue", "Chinese traditional (Cantonese)"]
]);
export const funnyAnimalUsernames = [
  "Red Monkey",
  "Speedy Snail",
  "Giant Ant",
  "Herbivore Lion",
  "Turbo Sloth",
  "Tiny Elephant",
  "Sleepy Cheetah",
  "Polite Shark",
  "Disco Owl",
  "Noodle Panda",
  "Pocket Rhino",
  "Fancy Frog",
  "Wobbly Walrus",
  "Royal Duck",
  "Cosmic Hamster",
  "Detective Otter",
  "Spicy Koala",
  "Sneaky Turtle",
  "Moon Moose",
  "Bouncy Beaver",
  "Professor Goose",
  "Velvet Crab",
  "Lucky Gecko",
  "Dizzy Dolphin",
  "Captain Capybara",
  "Pickle Penguin",
  "Rocket Rabbit",
  "Waffle Wombat",
  "Marshmallow Bear",
  "Bubble Tiger",
  "Pancake Parrot",
  "Wizard Llama",
  "Ninja Narwhal",
  "Cheddar Cheetah",
  "Jellybean Jaguar",
  "Mango Meerkat",
  "Glitter Goat",
  "Thunder Ferret",
  "Banana Badger",
  "Sassy Seahorse",
  "Clever Camel",
  "Hiccup Hippo",
  "Tofu Toucan",
  "Sunny Seal",
  "Pepper Panther",
  "Doodle Donkey",
  "Cupcake Cobra",
  "Zippy Zebra",
  "Muffin Mole",
  "Skater Squirrel"
];
const teamDefinitions = [
  { id: "red", name: "Red Team", color: "#ff4f5e" },
  { id: "blue", name: "Blue Team", color: "#4b7dff" }
];

export function encodeCrockfordBase32(value, minLength = 1) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Crockford Base32 values must be non-negative safe integers.");
  }

  let encoded = "";
  let remaining = value;
  do {
    encoded = crockfordBase32Alphabet[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  } while (remaining > 0);

  return encoded.padStart(minLength, "0");
}

export function normalizeGameCode(value) {
  const text = String(value || "").trim();
  if (!text) return null;

  let normalized = "";
  for (const char of text.toUpperCase()) {
    if (char === "-" || /\s/.test(char)) continue;
    if (char === "O") {
      normalized += "0";
    } else if (char === "I" || char === "L") {
      normalized += "1";
    } else if (crockfordBase32Alphabet.includes(char)) {
      normalized += char;
    } else {
      return null;
    }
  }

  return normalized.length === gameCodeLength ? normalized : null;
}

function createGameId(existingIds) {
  for (;;) {
    const id = encodeCrockfordBase32(crypto.randomInt(0, 32 ** gameCodeLength), gameCodeLength);
    if (!existingIds.has(id)) return id;
  }
}

function cleanUsername(username, fallback = "Player") {
  const cleaned = String(username || "").trim().replace(/\s+/g, " ").slice(0, 24);
  return cleaned || fallback;
}

function randomFunnyAnimalUsername() {
  return funnyAnimalUsernames[crypto.randomInt(funnyAnimalUsernames.length)];
}

function usernameExists(game, username, excludedPlayerId = "") {
  return [...game.players.values()].some(
    (player) => player.id !== excludedPlayerId && usernamesMatch(player.username, username)
  );
}

function randomAvailableFunnyAnimalUsername(game, excludedPlayerId = "") {
  const availableNames = funnyAnimalUsernames.filter((username) => !usernameExists(game, username, excludedPlayerId));
  if (availableNames.length) return availableNames[crypto.randomInt(availableNames.length)];

  for (;;) {
    const username = `${randomFunnyAnimalUsername()} ${crypto.randomInt(10, 100)}`;
    if (!usernameExists(game, username, excludedPlayerId)) return username;
  }
}

function usernamesMatch(first, second) {
  return first.localeCompare(second, undefined, { sensitivity: "accent" }) === 0;
}

function cleanClientId(clientId) {
  const cleaned = String(clientId || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(cleaned)
    ? cleaned
    : "";
}

function cleanBoolean(value) {
  return value === true || value === "true" || value === "on" || value === "1";
}

function cleanChallengeLanguage(value) {
  const code = String(value || "en").trim().toLowerCase();
  return challengeLanguages.has(code) ? code : "en";
}

function challengeLanguageName(code) {
  return challengeLanguages.get(cleanChallengeLanguage(code)) || "English";
}

function challengeLanguageDisplayCode(code) {
  return cleanChallengeLanguage(code).toUpperCase();
}

function cleanChallengeItem(item) {
  return String(item || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\p{M} -]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 48);
}

function parseChallengeList(value) {
  const entries = Array.isArray(value)
    ? value.flatMap((item) => String(item || "").split(/[\r\n,;]+/))
    : String(value || "").split(/[\r\n,;]+/);
  const seen = new Set();

  return entries
    .map(cleanChallengeItem)
    .filter((item) => item.length > 1)
    .filter((item) => {
      const key = challengeKey(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 100);
}

function cleanInitialChallengeInput(value) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, 1600);
}

function normalizeChallengeWord(word) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ches|shes|sses|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function challengeKey(item) {
  return cleanChallengeItem(item).split(" ").map(normalizeChallengeWord).join(" ");
}

function publicPlayer(player, game = null) {
  const team = teamForPlayer(game, player);
  const winner = game?.winner || null;
  const isWinner =
    game?.lastResult?.status === "ended" &&
    Boolean(winner) &&
    (game.teamUpEnabled ? winner.id === team?.id : winner.id === player.id);
  return {
    id: player.id,
    username: player.username,
    score: player.score,
    pointsFound: player.pointsFound || 0,
    penalties: player.penalties || 0,
    ready: player.ready,
    isOwner: player.isOwner,
    isWinner,
    connected: player.connected,
    teamId: team?.id || null,
    teamName: team?.name || "",
    teamColor: team?.color || ""
  };
}

function topPlayers(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  const topScore = sorted[0]?.score ?? 0;
  return sorted.filter((player) => player.score === topScore);
}

function createTeams(enabled) {
  return enabled ? teamDefinitions.map((team) => ({ ...team })) : [];
}

function teamForPlayer(game, player) {
  if (!game || !player?.teamId) return null;
  return game.teams.find((team) => team.id === player.teamId) || teamDefinitions.find((team) => team.id === player.teamId);
}

function teamScores(game) {
  if (!game?.teamUpEnabled) return [];
  const scores = new Map(
    game.teams.map((team) => [
      team.id,
      {
        ...team,
        score: 0,
        players: 0,
        connectedPlayers: 0,
        contributors: []
      }
    ])
  );

  for (const player of game.players.values()) {
    const score = scores.get(player.teamId);
    if (!score) continue;
    score.score += player.score;
    score.players += 1;
    if (player.connected) score.connectedPlayers += 1;
    if ((player.pointsFound || 0) > 0 || (player.penalties || 0) > 0 || player.score !== 0) {
      score.contributors.push({
        id: player.id,
        username: player.username,
        score: player.score,
        pointsFound: player.pointsFound || 0,
        penalties: player.penalties || 0,
        connected: player.connected,
        isOwner: player.isOwner
      });
    }
  }

  return [...scores.values()].map((score) => ({
    ...score,
    contributors: score.contributors.sort(
      (a, b) =>
        b.score - a.score ||
        b.pointsFound - a.pointsFound ||
        a.penalties - b.penalties ||
        a.username.localeCompare(b.username)
    )
  }));
}

function activeTeamScores(game) {
  return teamScores(game).filter((team) => team.players > 0);
}

function topTeams(game) {
  const sorted = activeTeamScores(game).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const topScore = sorted[0]?.score ?? 0;
  return sorted.filter((team) => team.score === topScore);
}

function hasCompletedResult(game) {
  return game?.lastResult?.status === "ended";
}

function winnerDisplayName(winner) {
  return winner?.username || winner?.name || "";
}

function currentPlayers(game) {
  return [...(game?.players?.values?.() || [])];
}

function skipVoteSummary(game, round) {
  const votes = round?.skipVotes || new Set();
  if (!game || !round) {
    return {
      mode: "player",
      votes: 0,
      eligible: 0,
      threshold: 1,
      passed: false,
      votedPlayerIds: []
    };
  }

  if (!game.teamUpEnabled) {
    const eligiblePlayers = currentPlayers(game);
    const voteCount = eligiblePlayers.filter((player) => votes.has(player.id)).length;
    const threshold = Math.floor(eligiblePlayers.length / 2) + 1;
    return {
      mode: "player",
      votes: voteCount,
      eligible: eligiblePlayers.length,
      threshold,
      passed: voteCount >= threshold,
      votedPlayerIds: [...votes]
    };
  }

  const eligibleByTeam = new Map();
  for (const player of currentPlayers(game)) {
    if (!player.teamId) continue;
    if (!eligibleByTeam.has(player.teamId)) eligibleByTeam.set(player.teamId, []);
    eligibleByTeam.get(player.teamId).push(player);
  }

  const eligibleTeams = [...eligibleByTeam.entries()];
  const completedTeamIds = eligibleTeams
    .filter(([, players]) => players.length > 0 && players.every((player) => votes.has(player.id)))
    .map(([teamId]) => teamId);
  const threshold = Math.floor(eligibleTeams.length / 2) + 1;
  return {
    mode: "team",
    votes: completedTeamIds.length,
    eligible: eligibleTeams.length,
    threshold,
    passed: completedTeamIds.length >= threshold,
    completedTeamIds,
    votedPlayerIds: [...votes]
  };
}

export class GameEngine {
  constructor({ io, config, llm, database, audioCache = null, logger = console }) {
    this.io = io;
    this.config = config;
    this.llm = llm;
    this.database = database;
    this.audioCache = audioCache;
    this.logger = logger;
    this.games = new Map();
    this.socketSessions = new Map();
  }

  createGame(socket, payload = {}) {
    this.detachSocket(socket);
    const gameId = createGameId(this.games);
    const player = this.createPlayer(socket, payload.username, true, payload.clientId);
    const initialChallengeInput = cleanInitialChallengeInput(
      payload.initialChallengeInput || payload.initialPrompt || payload.initialWordList || payload.initialItems
    );
    const challengeLanguage = cleanChallengeLanguage(payload.challengeLanguage);
    const teamUpEnabled = cleanBoolean(payload.teamUpEnabled);
    const game = {
      id: gameId,
      status: "lobby",
      ownerPlayerId: player.id,
      players: new Map([[player.id, player]]),
      teamUpEnabled,
      teams: createTeams(teamUpEnabled),
      itemQueue: [],
      initialChallengeInput,
      challengeLanguage,
      initialChallengePrepared: false,
      usedItems: [],
      roundNumber: 0,
      roundsAwarded: 0,
      currentRound: null,
      submissionQueue: [],
      submissionQueueEpoch: 0,
      verificationProcessing: false,
      lastResult: null,
      winner: null,
      createdAt: Date.now(),
      startedAt: null,
      endedAt: null,
      roundTimer: null,
      nextRoundTimer: null,
      nextRoundAt: null,
      nextRoundStartedAt: null,
      pauseState: null,
      loadingItems: null
    };
    if (game.teamUpEnabled) this.assignBalancedTeams(game);
    this.games.set(gameId, game);
    socket.join(gameId);
    this.socketSessions.set(socket.id, { gameId, playerId: player.id });
    this.emitState(game);
    return { game, player };
  }

  joinGame(socket, payload = {}) {
    const gameId = normalizeGameCode(payload.gameId);
    if (!gameId) return { error: "Game code is not valid." };
    const game = this.games.get(gameId);
    if (!game) return { error: "Game not found." };

    const clientId = cleanClientId(payload.clientId);
    const requestedUsername = cleanUsername(payload.username, "");
    const existingPlayer = this.findPlayerByIdentity(game, requestedUsername, clientId);
    if (existingPlayer) {
      this.attachPlayerToSocket(game, existingPlayer, socket);
      return { game, player: existingPlayer };
    }
    const username = requestedUsername || randomAvailableFunnyAnimalUsername(game);

    if (game.status !== "lobby") return { error: "This game has already started." };
    if (game.players.size >= this.config.game.maxPlayers) return { error: "This game is full." };

    if (usernameExists(game, username)) {
      return { error: "That name is already used in this game. Try another name." };
    }

    this.detachSocket(socket);
    const player = this.createPlayer(socket, username, false, clientId);
    game.players.set(player.id, player);
    if (game.teamUpEnabled) this.assignPlayerToBalancedTeam(game, player);
    socket.join(gameId);
    this.socketSessions.set(socket.id, { gameId, playerId: player.id });
    this.emitNotice(game, `${player.username} joined the quest.`);
    this.emitState(game);
    return { game, player };
  }

  rejoinGame(socket, payload = {}) {
    const gameId = normalizeGameCode(payload.gameId);
    if (!gameId) return { error: "Session not found." };
    const game = this.games.get(gameId);
    const username = cleanUsername(payload.username, "");
    const clientId = cleanClientId(payload.clientId);
    const player = game?.players.get(payload.playerId) || this.findPlayerByIdentity(game, username, clientId);
    if (!game || !player) return { error: "Session not found." };

    this.attachPlayerToSocket(game, player, socket);
    return { game, player };
  }

  setReady(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.status !== "lobby") return { error: "Ready can only be changed in the lobby." };
    player.ready = Boolean(payload.ready);
    this.emitState(game);
    return { game, player };
  }

  updatePlayerName(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.status !== "lobby") return { error: "Names can only be changed in the lobby." };

    const username = cleanUsername(payload.username, "") || randomAvailableFunnyAnimalUsername(game, player.id);
    if (usernameExists(game, username, player.id)) {
      return { error: "That name is already used in this game. Try another name." };
    }

    const previousUsername = player.username;
    player.username = username;
    if (!usernamesMatch(previousUsername, username)) {
      this.emitNotice(game, `${previousUsername} is now ${username}.`);
    }
    this.emitState(game);
    return { game, player };
  }

  updateGameOptions(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can change game options." };
    if (game.status !== "lobby") return { error: "Game options can only be changed in the lobby." };

    const nextInitialChallengeInput = cleanInitialChallengeInput(
      payload.initialChallengeInput || payload.initialPrompt || payload.initialWordList || payload.initialItems
    );
    const nextChallengeLanguage = cleanChallengeLanguage(payload.challengeLanguage);
    const nextTeamUpEnabled = cleanBoolean(payload.teamUpEnabled);
    const teamModeChanged = game.teamUpEnabled !== nextTeamUpEnabled;
    const challengeSettingsChanged =
      game.initialChallengeInput !== nextInitialChallengeInput ||
      game.challengeLanguage !== nextChallengeLanguage;

    game.initialChallengeInput = nextInitialChallengeInput;
    game.challengeLanguage = nextChallengeLanguage;
    game.teamUpEnabled = nextTeamUpEnabled;
    if (challengeSettingsChanged) {
      game.initialChallengePrepared = false;
      game.itemQueue = [];
    }
    if (teamModeChanged) {
      game.teams = createTeams(nextTeamUpEnabled);
      if (!nextTeamUpEnabled) {
        for (const currentPlayer of game.players.values()) {
          currentPlayer.teamId = null;
        }
      } else {
        this.assignBalancedTeams(game);
      }
    } else if (nextTeamUpEnabled && [...game.players.values()].some((currentPlayer) => !currentPlayer.teamId)) {
      this.assignBalancedTeams(game);
    }
    if (hasCompletedResult(game) && teamModeChanged) {
      this.refreshCompletedLobbyWinner(game);
    }
    if (challengeSettingsChanged) {
      this.emitNotice(game, "Game options updated.");
    } else if (teamModeChanged) {
      this.emitNotice(game, `Team-up mode turned ${nextTeamUpEnabled ? "on" : "off"}.`);
    }
    this.emitState(game);
    return { game, player };
  }

  resetCompletedLobbyForStart(game) {
    if (!hasCompletedResult(game)) return;
    this.clearTimers(game);
    for (const currentPlayer of game.players.values()) {
      currentPlayer.score = 0;
      currentPlayer.pointsFound = 0;
      currentPlayer.penalties = 0;
    }
    game.roundNumber = 0;
    game.roundsAwarded = 0;
    game.currentRound = null;
    game.submissionQueue = [];
    game.submissionQueueEpoch += 1;
    game.lastResult = null;
    game.winner = null;
    game.nextRoundAt = null;
    game.nextRoundStartedAt = null;
    game.pauseState = null;
    game.endedAt = null;
    game.startedAt = null;
    game.itemQueue = [];
    game.initialChallengePrepared = false;
  }

  refreshCompletedLobbyWinner(game) {
    if (!hasCompletedResult(game)) return;
    const leaders = game.teamUpEnabled ? topTeams(game) : topPlayers([...game.players.values()]);
    game.winner = leaders.length === 1 ? leaders[0] : null;
    const winnerName = winnerDisplayName(game.winner);
    game.lastResult = {
      ...game.lastResult,
      status: "ended",
      item: null,
      username: winnerName,
      message: winnerName ? `${winnerName} wins.` : "Game ended without a winner."
    };
  }

  async startGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can start." };
    if (game.status !== "lobby") return { error: "The game is not in the lobby." };
    if (!this.allPlayersReady(game)) return { error: "Every player must be ready before the game can start." };

    this.resetCompletedLobbyForStart(game);
    if (!game.teamUpEnabled || [...game.players.values()].some((currentPlayer) => !currentPlayer.teamId)) {
      this.assignBalancedTeams(game);
    }
    game.status = "loading";
    game.startedAt = Date.now();
    game.endedAt = null;
    game.winner = null;
    this.emitState(game);
    await this.prepareInitialChallengeQueue(game);
    await this.ensureItemBuffer(game, this.config.game.itemBatchSize);
    this.startRound(game);
    return { game, player };
  }

  async restartGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can start a new game." };
    if (!hasCompletedResult(game) && game.status !== "ended") return { error: "The current game has not ended yet." };

    this.resetCompletedLobbyForStart(game);
    game.status = "lobby";
    if (game.teamUpEnabled) {
      this.assignBalancedTeams(game);
    } else {
      for (const currentPlayer of game.players.values()) {
        currentPlayer.teamId = null;
      }
    }
    this.emitState(game);
    return { game, player };
  }

  pauseGameByOwner(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can pause the game." };
    if (game.status === "paused") return { game, player };
    if (game.status !== "running") return { error: "Only a running game can be paused." };

    const now = Date.now();
    const pauseState = {
      mode: "idle",
      pausedAt: now,
      remainingMs: 0
    };

    if (game.currentRound?.status === "active") {
      pauseState.mode = "round";
      pauseState.remainingMs = Math.max(1, game.currentRound.expiresAt - now);
      this.clearRoundTimer(game);
    } else if (game.nextRoundAt) {
      pauseState.mode = "break";
      pauseState.remainingMs = Math.max(1, game.nextRoundAt - now);
      this.clearNextRoundTimer(game);
    }

    game.status = "paused";
    game.pauseState = pauseState;
    this.emitNotice(game, "Game paused.");
    this.emitState(game);
    return { game, player };
  }

  resumeGameByOwner(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can resume the game." };
    if (game.status !== "paused") return { error: "The game is not paused." };

    const pauseState = game.pauseState || {};
    const now = Date.now();
    game.status = "running";
    game.pauseState = null;

    if (pauseState.mode === "round" && game.currentRound?.status === "active") {
      const remainingMs = Math.max(1000, pauseState.remainingMs || this.config.game.objectTimeoutMs);
      const elapsedMs = Math.max(0, this.config.game.objectTimeoutMs - remainingMs);
      game.currentRound.startedAt = now - elapsedMs;
      game.currentRound.expiresAt = now + remainingMs;
      this.clearRoundTimer(game);
      game.roundTimer = setTimeout(() => {
        this.expireRound(game.id, game.currentRound?.id).catch((error) => {
          this.logger.warn(`Round timeout failed: ${error.message}`);
        });
      }, remainingMs);
    } else if (pauseState.mode === "break") {
      const remainingMs = Math.max(1000, pauseState.remainingMs || this.config.game.nextRoundDelayMs);
      this.clearNextRoundTimer(game);
      game.nextRoundStartedAt = now;
      game.nextRoundAt = now + remainingMs;
      game.nextRoundTimer = setTimeout(() => {
        game.nextRoundTimer = null;
        game.nextRoundAt = null;
        game.nextRoundStartedAt = null;
        this.startRound(game).catch((error) => {
          this.logger.warn(`Next round failed: ${error.message}`);
        });
      }, remainingMs);
    }

    this.emitNotice(game, "Game resumed.");
    this.emitState(game);
    return { game, player };
  }

  async endGameByOwner(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    if (game.ownerPlayerId !== player.id) return { error: "Only the game owner can end the game." };
    if (game.status === "ended") return { error: "The game has already ended." };

    await this.endGame(game, {
      forced: true,
      message: "Game ended by owner."
    });
    return { game, player };
  }

  leaveGame(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    const ownerLeaving = game.ownerPlayerId === player.id;
    if (ownerLeaving && game.status !== "lobby" && game.status !== "ended") {
      return { error: "The owner must end the game instead." };
    }

    game.players.delete(player.id);
    player.isOwner = false;
    this.socketSessions.delete(socket.id);
    socket.leave(game.id);

    this.io.to(socket.id).emit("left_game", {
      gameId: game.id,
      message: "You left the game."
    });

    if (game.players.size === 0) {
      this.clearTimers(game);
      this.games.delete(game.id);
    } else {
      if (ownerLeaving) {
        const nextOwner =
          [...game.players.values()].find((candidate) => candidate.connected) || [...game.players.values()][0];
        game.ownerPlayerId = nextOwner.id;
        for (const currentPlayer of game.players.values()) {
          currentPlayer.isOwner = currentPlayer.id === nextOwner.id;
        }
      }
      this.emitNotice(game, `${player.username} left the game.`);
      this.emitState(game);
    }

    return { left: true };
  }

  submitCapture(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    const round = game.currentRound;
    const challengeId = String(payload.challengeId || "").trim();
    if (game.status !== "running" || !round || round.status !== "active" || round.id !== challengeId) {
      return { ok: true, ignored: true };
    }
    if (!payload.imageDataUrl || !String(payload.imageDataUrl).startsWith("data:image/")) {
      return { error: "Photo data was not received." };
    }

    game.submissionQueue.push({
      challengeId,
      playerId: player.id,
      imageDataUrl: payload.imageDataUrl,
      receivedAt: Date.now()
    });
    this.io.to(player.socketId).emit("submission_result", {
      status: "checking",
      message: `Checking ${round.item}...`
    });
    this.processSubmissionQueue(game).catch((error) => {
      this.logger.warn(`Submission queue failed: ${error.message}`);
    });
    return { ok: true };
  }

  voteSkipRound(socket, payload = {}) {
    const session = this.getSession(socket, payload.gameId);
    if (!session) return { error: "You are not in this game." };
    const { game, player } = session;
    const round = game.currentRound;
    const challengeId = String(payload.challengeId || "").trim();
    if (game.status !== "running" || !round || round.status !== "active" || round.id !== challengeId) {
      return { ok: true, ignored: true };
    }

    if (!round.skipVotes) round.skipVotes = new Set();
    if (round.skipVotes.has(player.id)) {
      return { ok: true, skip: skipVoteSummary(game, round) };
    }
    round.skipVotes.add(player.id);
    const summary = skipVoteSummary(game, round);
    const team = teamForPlayer(game, player);
    const unit = summary.mode === "team" ? "team" : "vote";
    const unitSuffix = summary.votes === 1 ? "" : "s";
    this.io.to(game.id).emit("capture_notice", {
      status: "skip",
      playerId: player.id,
      username: player.username,
      teamId: team?.id || null,
      teamName: team?.name || "",
      item: round.item,
      skip: summary,
      message: team
        ? `${player.username} from ${team.name.toLowerCase()} voted to skip ${round.item}. ${summary.votes}/${summary.threshold} ${unit}${unitSuffix}.`
        : `${player.username} voted to skip ${round.item}. ${summary.votes}/${summary.threshold} ${unit}${unitSuffix}.`
    });

    if (summary.passed) {
      this.skipCurrentRound(game, summary);
    } else {
      this.emitState(game);
    }
    return { ok: true, skip: summary };
  }

  handleDisconnect(socket) {
    const session = this.socketSessions.get(socket.id);
    if (!session) return;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (player) {
      player.connected = false;
      this.emitState(game);
    }
    this.socketSessions.delete(socket.id);
  }

  getSnapshot(game, viewerPlayerId) {
    const players = [...game.players.values()].map((player) => publicPlayer(player, game));
    const currentTeamScores = teamScores(game);
    const leaders = game.teamUpEnabled
      ? topTeams(game).map((team) => team.id)
      : topPlayers([...game.players.values()]).map((player) => player.id);
    const allReady = players.length > 0 && players.every((player) => player.ready);
    const viewer = game.players.get(viewerPlayerId);

    return {
      id: game.id,
      status: game.status,
      ownerPlayerId: game.ownerPlayerId,
      players,
      teamUpEnabled: game.teamUpEnabled,
      teams: game.teams,
      teamScores: currentTeamScores,
      challengeLanguage: game.challengeLanguage,
      challengeLanguageName: challengeLanguageName(game.challengeLanguage),
      ...(viewerPlayerId === game.ownerPlayerId ? { initialChallengeInput: game.initialChallengeInput } : {}),
      maxPlayers: this.config.game.maxPlayers,
      roundNumber: game.roundNumber,
      roundsAwarded: game.roundsAwarded,
      normalRounds: this.config.game.normalRounds,
      leaders,
      allReady,
      itemQueueCount: game.itemQueue.length,
      nextRoundAt: game.nextRoundAt,
      nextRoundStartedAt: game.nextRoundStartedAt,
      pauseState: game.pauseState
        ? {
            mode: game.pauseState.mode,
            pausedAt: game.pauseState.pausedAt
          }
        : null,
      currentRound: game.currentRound
        ? {
            id: game.currentRound.id,
            item: game.currentRound.item,
            languageCode: game.currentRound.languageCode,
            languageName: game.currentRound.languageName,
            audioUrl: game.currentRound.audioUrl,
            status: game.currentRound.status,
            startedAt: game.currentRound.startedAt,
            expiresAt: game.currentRound.expiresAt,
            skip: {
              ...skipVoteSummary(game, game.currentRound),
              voted: Boolean(game.currentRound.skipVotes?.has(viewerPlayerId))
            }
          }
        : null,
      lastResult: game.lastResult,
      winner: game.winner ? (game.teamUpEnabled ? game.winner : publicPlayer(game.winner, game)) : null,
      me: viewer ? publicPlayer(viewer, game) : null
    };
  }

  createPlayer(socket, username, isOwner, clientId = "") {
    return {
      id: crypto.randomUUID(),
      clientId: cleanClientId(clientId),
      socketId: socket.id,
      username: cleanUsername(username, randomFunnyAnimalUsername()),
      score: 0,
      pointsFound: 0,
      penalties: 0,
      teamId: null,
      ready: true,
      isOwner,
      connected: true,
      joinedAt: Date.now()
    };
  }

  findPlayerByIdentity(game, username, clientId) {
    if (!game || !clientId) return null;
    return (
      [...game.players.values()].find(
        (player) => player.clientId === clientId && (!username || usernamesMatch(player.username, username))
      ) || null
    );
  }

  attachPlayerToSocket(game, player, socket) {
    this.detachSocket(socket);
    if (player.socketId && player.socketId !== socket.id) {
      const previousSocket = this.io.sockets?.sockets?.get(player.socketId);
      previousSocket?.emit?.("left_game", {
        gameId: game.id,
        message: "You joined this game from another tab or device.",
        preserveSession: true
      });
      previousSocket?.leave?.(game.id);
      setTimeout(() => previousSocket?.disconnect?.(true), 50).unref();
      this.socketSessions.delete(player.socketId);
    }
    player.socketId = socket.id;
    player.connected = true;
    socket.join(game.id);
    this.socketSessions.set(socket.id, { gameId: game.id, playerId: player.id });
    this.emitState(game);
  }

  getSession(socket, gameId) {
    const session = this.socketSessions.get(socket.id);
    const normalizedGameId = gameId ? normalizeGameCode(gameId) : null;
    if (!session || (gameId && session.gameId !== normalizedGameId)) return null;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (!game || !player) return null;
    return { game, player };
  }

  detachSocket(socket) {
    const session = this.socketSessions.get(socket.id);
    if (!session) return;
    const game = this.games.get(session.gameId);
    const player = game?.players.get(session.playerId);
    if (player) player.connected = false;
    socket.leave(session.gameId);
    this.socketSessions.delete(socket.id);
    if (game) this.emitState(game);
  }

  emitState(game) {
    for (const player of game.players.values()) {
      if (player.connected && player.socketId) {
        this.io.to(player.socketId).emit("game_state", this.getSnapshot(game, player.id));
      }
    }
  }

  emitNotice(game, message) {
    this.io.to(game.id).emit("notice", { message });
  }

  allPlayersReady(game) {
    const players = [...game.players.values()];
    return players.length > 0 && players.every((player) => player.ready);
  }

  assignBalancedTeams(game) {
    if (!game.teamUpEnabled) {
      for (const player of game.players.values()) {
        player.teamId = null;
      }
      return;
    }

    const teams = [...game.teams];
    const players = [...game.players.values()];
    for (let index = teams.length - 1; index > 0; index -= 1) {
      const nextIndex = crypto.randomInt(index + 1);
      [teams[index], teams[nextIndex]] = [teams[nextIndex], teams[index]];
    }
    for (let index = players.length - 1; index > 0; index -= 1) {
      const nextIndex = crypto.randomInt(index + 1);
      [players[index], players[nextIndex]] = [players[nextIndex], players[index]];
    }
    players.forEach((player, index) => {
      player.teamId = teams[index % teams.length]?.id || null;
    });
  }

  assignPlayerToBalancedTeam(game, player) {
    if (!game.teamUpEnabled) {
      player.teamId = null;
      return;
    }

    const teams = [...game.teams];
    if (!teams.length) {
      player.teamId = null;
      return;
    }

    const counts = new Map(teams.map((team) => [team.id, 0]));
    for (const currentPlayer of game.players.values()) {
      if (currentPlayer.id !== player.id && counts.has(currentPlayer.teamId)) {
        counts.set(currentPlayer.teamId, counts.get(currentPlayer.teamId) + 1);
      }
    }
    const lowestCount = Math.min(...counts.values());
    const candidates = teams.filter((team) => counts.get(team.id) === lowestCount);
    player.teamId = candidates[crypto.randomInt(candidates.length)]?.id || null;
  }

  async prepareInitialChallengeQueue(game) {
    if (game.initialChallengePrepared) return;
    game.initialChallengePrepared = true;
    const input = cleanInitialChallengeInput(game.initialChallengeInput);
    if (!input) return;

    try {
      const items = await this.llm.prepareInitialItems({
        input,
        count: this.config.game.itemBatchSize,
        language: challengeLanguageName(game.challengeLanguage),
        previousItems: [...game.usedItems],
        queuedItems: [...game.itemQueue]
      });
      const nextItems = this.filterNewChallengeItems(game, items);
      if (nextItems.length > 0) {
        game.itemQueue.push(...nextItems);
        return;
      }
    } catch (error) {
      this.logger.warn(`Initial challenge preparation failed: ${error.message}`);
    }

    const fallbackItems = this.filterNewChallengeItems(game, parseChallengeList(input));
    game.itemQueue.push(...fallbackItems);
  }

  async ensureItemBuffer(game, minimumCount) {
    for (;;) {
      this.removeQueuedRepeats(game);
      if (game.itemQueue.length >= minimumCount) return;

      if (game.loadingItems) {
        await game.loadingItems;
        continue;
      }

      const previousQueueCount = game.itemQueue.length;
      game.loadingItems = this.fillItemBuffer(game, minimumCount).finally(() => {
        game.loadingItems = null;
      });
      await game.loadingItems;
      this.removeQueuedRepeats(game);
      if (game.itemQueue.length <= previousQueueCount) return;
    }
  }

  async fillItemBuffer(game, minimumCount) {
    for (let attempt = 0; game.itemQueue.length < minimumCount && attempt < 4; attempt += 1) {
      const items = await this.llm.generateItems({
        count: this.config.game.itemBatchSize,
        language: challengeLanguageName(game.challengeLanguage),
        previousItems: [...game.usedItems],
        queuedItems: [...game.itemQueue]
      });
      const nextItems = this.filterNewChallengeItems(game, items);
      game.itemQueue.push(...nextItems);
    }
  }

  presentedChallengeKeys(game) {
    return new Set(game.usedItems.map(challengeKey));
  }

  queuedChallengeKeys(game) {
    return new Set(game.itemQueue.map(challengeKey));
  }

  removeQueuedRepeats(game) {
    const presented = this.presentedChallengeKeys(game);
    const seen = new Set();
    game.itemQueue = game.itemQueue.filter((item) => {
      const key = challengeKey(item);
      if (!key || presented.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  filterNewChallengeItems(game, items) {
    const seen = new Set([...this.presentedChallengeKeys(game), ...this.queuedChallengeKeys(game)]);
    return (items || [])
      .map(cleanChallengeItem)
      .filter((item) => item.length > 1)
      .filter((item) => {
        const key = challengeKey(item);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  takeNextChallengeItem(game) {
    this.removeQueuedRepeats(game);
    while (game.itemQueue.length > 0) {
      const item = game.itemQueue.shift();
      if (!this.presentedChallengeKeys(game).has(challengeKey(item))) return item;
    }
    return "";
  }

  rememberPresentedChallenge(game, item) {
    const key = challengeKey(item);
    if (!key || this.presentedChallengeKeys(game).has(key)) return;
    game.usedItems.push(cleanChallengeItem(item));
  }

  async startRound(game) {
    this.clearRoundTimer(game);
    game.nextRoundAt = null;
    game.nextRoundStartedAt = null;
    if (this.shouldEndGame(game)) {
      await this.endGame(game);
      return;
    }

    this.removeQueuedRepeats(game);
    if (game.itemQueue.length < 1) {
      game.status = "loading";
      this.emitState(game);
      await this.ensureItemBuffer(game, 1);
    }

    let item = this.takeNextChallengeItem(game);
    if (!item) {
      game.status = "loading";
      this.emitState(game);
      await this.ensureItemBuffer(game, 1);
      item = this.takeNextChallengeItem(game);
    }
    if (!item) {
      await this.endGame(game);
      return;
    }

    const languageCode = challengeLanguageDisplayCode(game.challengeLanguage);
    const languageName = challengeLanguageName(game.challengeLanguage);
    let audioUrl = "";
    if (this.audioCache?.enabled) {
      game.status = "loading";
      this.emitState(game);
      try {
        audioUrl = await this.audioCache.prepareAudio({
          item,
          languageCode: cleanChallengeLanguage(game.challengeLanguage),
          languageName
        });
      } catch (error) {
        this.logger.warn(`Challenge audio preparation failed: ${error.message}`);
      }
    }

    this.rememberPresentedChallenge(game, item);
    game.status = "running";
    game.roundNumber += 1;
    game.currentRound = {
      id: crypto.randomUUID(),
      item,
      languageCode,
      languageName,
      audioUrl,
      status: "active",
      startedAt: Date.now(),
      expiresAt: Date.now() + this.config.game.objectTimeoutMs,
      skipVotes: new Set()
    };
    game.lastResult = null;

    this.io.to(game.id).emit("round_started", {
      challengeId: game.currentRound.id,
      item,
      languageCode,
      languageName,
      audioUrl,
      roundNumber: game.roundNumber,
      expiresAt: game.currentRound.expiresAt
    });
    this.emitState(game);

    game.roundTimer = setTimeout(() => {
      this.expireRound(game.id, game.currentRound?.id).catch((error) => {
        this.logger.warn(`Round timeout failed: ${error.message}`);
      });
    }, this.config.game.objectTimeoutMs);

    if (game.itemQueue.length < this.config.game.refillThreshold) {
      this.ensureItemBuffer(game, this.config.game.refillThreshold).catch((error) => {
        this.logger.warn(`Item refill failed: ${error.message}`);
      });
    }
  }

  async processSubmissionQueue(game) {
    if (game.verificationProcessing) return;
    game.verificationProcessing = true;
    const queueEpoch = game.submissionQueueEpoch;

    try {
      while (game.submissionQueueEpoch === queueEpoch && game.submissionQueue.length > 0) {
        const submission = game.submissionQueue.shift();
        const round = game.currentRound;
        if (game.status !== "running" || !round || round.status !== "active") {
          this.dropQueuedSubmissionsForChallenge(game, submission.challengeId);
          continue;
        }
        if (submission.challengeId !== round.id) continue;

        const player = game.players.get(submission.playerId);
        if (!player || !player.connected) continue;

        let result;
        try {
          result = await this.llm.verifyPhoto({
            item: round.item,
            language: challengeLanguageName(game.challengeLanguage),
            imageDataUrl: submission.imageDataUrl
          });
        } catch (error) {
          this.logger.warn(`Photo verification failed: ${error.message}`);
          if (game.submissionQueueEpoch !== queueEpoch) return;
          this.io.to(player.socketId).emit("submission_result", {
            status: "error",
            message: "This photo could not be verified. Try again."
          });
          continue;
        }
        if (game.submissionQueueEpoch !== queueEpoch) return;

        const currentRound = game.currentRound;
        if (
          game.status !== "running" ||
          !currentRound ||
          currentRound.id !== submission.challengeId ||
          currentRound.status !== "active"
        ) {
          this.dropQueuedSubmissionsForChallenge(game, submission.challengeId);
          continue;
        }

        if (result.match) {
          this.dropQueuedSubmissionsForChallenge(game, submission.challengeId);
          await this.awardPoint(game, player, result);
          continue;
        }

        this.penalizeMiss(game, player, result);
      }
    } finally {
      game.verificationProcessing = false;
      if (game.submissionQueue.length > 0) {
        this.processSubmissionQueue(game).catch((error) => {
          this.logger.warn(`Submission queue failed: ${error.message}`);
        });
      }
    }
  }

  dropQueuedSubmissionsForChallenge(game, challengeId) {
    game.submissionQueue = game.submissionQueue.filter((submission) => submission.challengeId !== challengeId);
  }

  penalizeMiss(game, player, result) {
    const round = game.currentRound;
    const team = teamForPlayer(game, player);
    const message = team
      ? `${player.username} from ${team.name.toLowerCase()} did not match ${round?.item || "the target"}. ${result.reason || "Not a match yet."} -1 point.`
      : `${player.username} did not match ${round?.item || "the target"}. ${result.reason || "Not a match yet."} -1 point.`;
    player.score -= 1;
    player.penalties = (player.penalties || 0) + 1;
    const currentTeamScore = teamScores(game).find((score) => score.id === team?.id)?.score ?? null;
    this.io.to(player.socketId).emit("submission_result", {
      status: "miss",
      penalty: -1,
      score: player.score,
      teamId: team?.id || null,
      teamName: team?.name || "",
      teamScore: currentTeamScore,
      message
    });
    this.io.to(game.id).emit("capture_notice", {
      status: "miss",
      playerId: player.id,
      username: player.username,
      teamId: team?.id || null,
      teamName: team?.name || "",
      item: round?.item || "",
      penalty: -1,
      score: player.score,
      teamScore: currentTeamScore,
      message
    });
    this.emitState(game);
  }

  async awardPoint(game, player, result) {
    const round = game.currentRound;
    if (!round || round.status !== "active") return;

    this.clearRoundTimer(game);
    round.status = "found";
    this.dropQueuedSubmissionsForChallenge(game, round.id);
    player.score += 1;
    player.pointsFound = (player.pointsFound || 0) + 1;
    game.roundsAwarded += 1;
    const team = teamForPlayer(game, player);
    const currentTeamScore = teamScores(game).find((score) => score.id === team?.id)?.score ?? null;
    game.lastResult = {
      status: "found",
      item: round.item,
      playerId: player.id,
      username: player.username,
      teamId: team?.id || null,
      teamName: team?.name || "",
      teamScore: currentTeamScore,
      confidence: result.confidence,
      message: team ? `${player.username} from ${team.name.toLowerCase()} found ${round.item}.` : `${player.username} found ${round.item}.`
    };

    this.io.to(game.id).emit("round_result", game.lastResult);
    this.scheduleNextStep(game);
  }

  skipCurrentRound(game, summary = null) {
    const round = game.currentRound;
    if (!round || round.status !== "active") return;

    this.clearRoundTimer(game);
    round.status = "skipped";
    this.dropQueuedSubmissionsForChallenge(game, round.id);
    game.submissionQueueEpoch += 1;
    const skip = summary || skipVoteSummary(game, round);
    game.lastResult = {
      status: "skipped",
      item: round.item,
      skip,
      message: `Skipped ${round.item}.`
    };
    this.io.to(game.id).emit("round_result", game.lastResult);
    this.scheduleNextStep(game);
  }

  async expireRound(gameId, roundId) {
    const game = this.games.get(gameId);
    const round = game?.currentRound;
    if (!game || !round || round.id !== roundId || round.status !== "active") return;

    this.clearRoundTimer(game);
    round.status = "expired";
    this.dropQueuedSubmissionsForChallenge(game, round.id);
    game.lastResult = {
      status: "expired",
      item: round.item,
      message: `No one found ${round.item}.`
    };
    this.io.to(game.id).emit("round_result", game.lastResult);
    this.scheduleNextStep(game);
  }

  scheduleNextStep(game) {
    this.clearNextRoundTimer(game);
    game.nextRoundStartedAt = Date.now();
    game.nextRoundAt = game.nextRoundStartedAt + this.config.game.nextRoundDelayMs;
    this.emitState(game);
    game.nextRoundTimer = setTimeout(() => {
      game.nextRoundTimer = null;
      game.nextRoundAt = null;
      game.nextRoundStartedAt = null;
      this.startRound(game).catch((error) => {
        this.logger.warn(`Next round failed: ${error.message}`);
      });
    }, this.config.game.nextRoundDelayMs);
  }

  shouldEndGame(game) {
    if (game.roundsAwarded < this.config.game.normalRounds) return false;
    if (game.teamUpEnabled) return topTeams(game).length === 1;
    return topPlayers([...game.players.values()]).length === 1;
  }

  async endGame(game, options = {}) {
    this.clearTimers(game);
    game.status = "lobby";
    game.endedAt = Date.now();
    game.currentRound = null;
    game.submissionQueue = [];
    game.submissionQueueEpoch += 1;
    game.pauseState = null;
    const leaders = game.teamUpEnabled ? topTeams(game) : topPlayers([...game.players.values()]);
    game.winner = options.forced ? null : leaders[0] || null;
    game.lastResult = {
      status: "ended",
      item: null,
      username: game.winner?.username || game.winner?.name || "",
      message: options.message || (game.winner ? `${game.winner.username || game.winner.name} wins.` : "Game ended.")
    };

    const players = [...game.players.values()].map((player) => publicPlayer(player, game));
    const teams = teamScores(game);
    try {
      await this.database.saveGameResult({
        gameId: game.id,
        roundsPlayed: game.roundsAwarded,
        winner: game.winner ? (game.teamUpEnabled ? game.winner : publicPlayer(game.winner, game)) : null,
        players,
        teams
      });
    } catch (error) {
      this.logger.warn(`Saving game result failed: ${error.message}`);
    }

    this.io.to(game.id).emit("game_ended", {
      winner: game.winner ? (game.teamUpEnabled ? game.winner : publicPlayer(game.winner, game)) : null,
      players,
      teams,
      message: game.lastResult.message
    });
    this.emitState(game);
  }

  clearRoundTimer(game) {
    if (game.roundTimer) clearTimeout(game.roundTimer);
    game.roundTimer = null;
  }

  clearNextRoundTimer(game) {
    if (game.nextRoundTimer) clearTimeout(game.nextRoundTimer);
    game.nextRoundTimer = null;
    game.nextRoundAt = null;
    game.nextRoundStartedAt = null;
  }

  clearTimers(game) {
    this.clearRoundTimer(game);
    this.clearNextRoundTimer(game);
  }
}
