const app = document.querySelector("#app");
const connectionPill = document.querySelector("#connectionPill");
const leaderboardDialog = document.querySelector("#leaderboardDialog");
const leaderboardContent = document.querySelector("#leaderboardContent");
const leaderboardButton = document.querySelector("#leaderboardButton");
const closeLeaderboardButton = document.querySelector("#closeLeaderboardButton");
const gameMenuDialog = document.querySelector("#gameMenuDialog");
const gameMenuContent = document.querySelector("#gameMenuContent");
const closeGameMenuButton = document.querySelector("#closeGameMenuButton");
const playerNameDialog = document.querySelector("#playerNameDialog");
const playerNameDialogContent = document.querySelector("#playerNameDialogContent");
const closePlayerNameDialogButton = document.querySelector("#closePlayerNameDialogButton");
const globalToastStack = document.querySelector("#globalToastStack");

const socket = io();
const query = new URLSearchParams(window.location.search);
const initialGameId = query.get("game")?.toUpperCase() || "";
const isAvatarReview = query.get("avatars") === "1";
const assetVersion = window.__CAPTURE_QUEST_ASSET_VERSION__ || "dev";
const sessionKey = "captureQuestSession";
const usernameKey = "captureQuestLastUsername";
const clientIdKey = "captureQuestClientId";
const bgmMutedKey = "captureQuestBgmMuted";
const gameCodeLength = 6;
const crockfordCharacters = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const challengeLanguageOptions = [
  ["ar", "Arabic"],
  ["zh-hans-yue", "Chinese simplified (cantonese)"],
  ["zh-hans-cmn", "Chinese simplified (mandarin)"],
  ["zh-hant-yue", "Chinese traditional (cantonese)"],
  ["zh-hant-cmn", "Chinese traditional (mandarin)"],
  ["en", "English"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["es", "Spanish"]
];
const funnyAnimalUsernames = [
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
,
  "Astronaut Alpaca",
  "Bouncing Anteater",
  "Cosmic Armadillo",
  "Dancing Baboon",
  "Electric Bat",
  "Flying Bison",
  "Grumpy Boar",
  "Happy Buffalo",
  "Invisible Butterfly",
  "Jumping Caterpillar",
  "Karate Bee",
  "Laser Chicken",
  "Magic Chinchilla",
  "Neon Chipmunk",
  "Orange Cow",
  "Pirate Coyote",
  "Queen Crocodile",
  "Robot Crow",
  "Singing Deer",
  "Time Dingo",
  "UFO Dog",
  "Viking Eagle",
  "Wobble Echidna",
  "Xray Emu",
  "Yawning Flamingo",
  "Zigzag Fox",
  "Alarm Gazelle",
  "Banana Giraffe",
  "Candy Gorilla",
  "Drum Hedgehog",
  "Echo Horse",
  "Fuzzy Hyena",
  "Giant Iguana",
  "Hover Kangaroo",
  "Ice Lemur",
  "Jazzy Leopard",
  "Kite Lynx",
  "Lemon Macaw",
  "Nacho Peacock",
  "Opal Pelican",
  "Piano Pig",
  "Quack Platypus",
  "Roller Porcupine",
  "Slinky Raccoon",
  "Taco Rat",
  "Umbrella Sheep",
  "Velvet Skunk",
  "Waffle Swan",
  "Xylophone Wolf",
  "Yeti Yak"
];
const animalAvatarProfiles = {
  ant: { label: "Ant", kind: "ant", bg: "#ffe6ef", face: "#e84d77", accent: "#172033" },
  badger: { label: "Badger", kind: "badger", bg: "#eef3ff", face: "#ffffff", accent: "#172033" },
  bear: { label: "Bear", kind: "bear", bg: "#ffe7bf", face: "#9a6b45", accent: "#f4c28a" },
  beaver: { label: "Beaver", kind: "beaver", bg: "#ffe7bf", face: "#9c623a", accent: "#ffffff" },
  camel: { label: "Camel", kind: "camel", bg: "#fff1bf", face: "#d79545", accent: "#8c552e" },
  capybara: { label: "Capybara", kind: "capybara", bg: "#ffe7bf", face: "#b77d45", accent: "#6b4427" },
  cheetah: { label: "Cheetah", kind: "cheetah", bg: "#fff1ad", face: "#f0b74d", accent: "#172033" },
  cobra: { label: "Cobra", kind: "cobra", bg: "#d9f8c4", face: "#52b56b", accent: "#172033" },
  crab: { label: "Crab", kind: "crab", bg: "#ffe4df", face: "#ff6f61", accent: "#172033" },
  dolphin: { label: "Dolphin", kind: "dolphin", bg: "#dcf8ff", face: "#4b9dff", accent: "#ffffff" },
  donkey: { label: "Donkey", kind: "donkey", bg: "#eef3ff", face: "#9f8d7a", accent: "#f0d7bc" },
  duck: { label: "Duck", kind: "duck", bg: "#fff4b8", face: "#ffd84f", accent: "#ff9f1c" },
  elephant: { label: "Elephant", kind: "elephant", bg: "#e8f0ff", face: "#95a9c8", accent: "#ffffff" },
  ferret: { label: "Ferret", kind: "ferret", bg: "#fff0cf", face: "#c79658", accent: "#ffffff" },
  frog: { label: "Frog", kind: "frog", bg: "#ddffd1", face: "#66c85f", accent: "#ffffff" },
  gecko: { label: "Gecko", kind: "gecko", bg: "#defbd4", face: "#70d36b", accent: "#ffe35e" },
  goat: { label: "Goat", kind: "goat", bg: "#f2f4ff", face: "#ffffff", accent: "#b98a52" },
  goose: { label: "Goose", kind: "goose", bg: "#eaf6ff", face: "#ffffff", accent: "#ff9f1c" },
  hamster: { label: "Hamster", kind: "hamster", bg: "#fff0cf", face: "#d69a58", accent: "#fff1d6" },
  hippo: { label: "Hippo", kind: "hippo", bg: "#ede6ff", face: "#9c8ccd", accent: "#ded4ff" },
  jaguar: { label: "Jaguar", kind: "jaguar", bg: "#fff1ad", face: "#d89432", accent: "#172033" },
  koala: { label: "Koala", kind: "koala", bg: "#edf2f7", face: "#9aa8b8", accent: "#ffffff" },
  lion: { label: "Lion", kind: "lion", bg: "#fff0b8", face: "#e69a31", accent: "#b66b23" },
  llama: { label: "Llama", kind: "llama", bg: "#fff3df", face: "#f2d0a7", accent: "#9d6b44" },
  meerkat: { label: "Meerkat", kind: "meerkat", bg: "#fff1bf", face: "#c48a4b", accent: "#6e472b" },
  mole: { label: "Mole", kind: "mole", bg: "#eadfd5", face: "#8b6a5a", accent: "#ffb8ca" },
  monkey: { label: "Monkey", kind: "monkey", bg: "#ffe2bf", face: "#9d6239", accent: "#f3bc84" },
  moose: { label: "Moose", kind: "moose", bg: "#fff0cf", face: "#a66b3f", accent: "#74411f" },
  narwhal: { label: "Narwhal", kind: "narwhal", bg: "#dcf8ff", face: "#76b9e8", accent: "#ffffff" },
  otter: { label: "Otter", kind: "otter", bg: "#e7f8ff", face: "#8f6745", accent: "#f0c28a" },
  owl: { label: "Owl", kind: "owl", bg: "#efe8ff", face: "#9b75d6", accent: "#ffe35e" },
  panda: { label: "Panda", kind: "panda", bg: "#f2f6ff", face: "#ffffff", accent: "#172033" },
  panther: { label: "Panther", kind: "panther", bg: "#dfe7ff", face: "#28324f", accent: "#7ad6ff" },
  parrot: { label: "Parrot", kind: "parrot", bg: "#e2ffe2", face: "#28b86f", accent: "#ff6f61" },
  penguin: { label: "Penguin", kind: "penguin", bg: "#e9f7ff", face: "#172033", accent: "#ffffff" },
  rabbit: { label: "Rabbit", kind: "rabbit", bg: "#fff0f8", face: "#ffffff", accent: "#ffb8d6" },
  rhino: { label: "Rhino", kind: "rhino", bg: "#eaf0f4", face: "#8ea2ad", accent: "#ffffff" },
  seal: { label: "Seal", kind: "seal", bg: "#e7f8ff", face: "#8eb0c5", accent: "#ffffff" },
  seahorse: { label: "Seahorse", kind: "seahorse", bg: "#ddfbff", face: "#f0aa54", accent: "#172033" },
  shark: { label: "Shark", kind: "shark", bg: "#dcf8ff", face: "#6e91ad", accent: "#ffffff" },
  sloth: { label: "Sloth", kind: "sloth", bg: "#fff2d9", face: "#a77c54", accent: "#f5d2a6" },
  snail: { label: "Snail", kind: "snail", bg: "#ecffd9", face: "#8fcf5f", accent: "#d6a052" },
  squirrel: { label: "Squirrel", kind: "squirrel", bg: "#fff0d8", face: "#c17335", accent: "#f0b978" },
  tiger: { label: "Tiger", kind: "tiger", bg: "#fff0bf", face: "#f08d32", accent: "#172033" },
  toucan: { label: "Toucan", kind: "toucan", bg: "#e2f8ff", face: "#172033", accent: "#ffba31" },
  turtle: { label: "Turtle", kind: "turtle", bg: "#dfffd2", face: "#65b46a", accent: "#3f8f4e" },
  walrus: { label: "Walrus", kind: "walrus", bg: "#e7f8ff", face: "#a56b4c", accent: "#ffffff" },
  wombat: { label: "Wombat", kind: "wombat", bg: "#fff0d8", face: "#9b7154", accent: "#e5b790" },
  zebra: { label: "Zebra", kind: "zebra", bg: "#f4f8ff", face: "#ffffff", accent: "#172033" }
,
  alpaca: { label: "Alpaca", kind: "alpaca", bg: "#fff3df", face: "#ffffff", accent: "#b98a52" },
  anteater: { label: "Anteater", kind: "anteater", bg: "#eadfd5", face: "#7a6354", accent: "#ffffff" },
  armadillo: { label: "Armadillo", kind: "armadillo", bg: "#eaf0f4", face: "#a89b93", accent: "#6d5c53" },
  baboon: { label: "Baboon", kind: "baboon", bg: "#ffe2bf", face: "#826a5c", accent: "#ff6f61" },
  bat: { label: "Bat", kind: "bat", bg: "#e5e3ff", face: "#45415e", accent: "#8f8aa8" },
  bison: { label: "Bison", kind: "bison", bg: "#fff0cf", face: "#5e4331", accent: "#a37f61" },
  boar: { label: "Boar", kind: "boar", bg: "#fff0cf", face: "#856551", accent: "#ffffff" },
  buffalo: { label: "Buffalo", kind: "buffalo", bg: "#eadfd5", face: "#4a423d", accent: "#172033" },
  butterfly: { label: "Butterfly", kind: "butterfly", bg: "#f9e5ff", face: "#d482ff", accent: "#ffb8d6" },
  caterpillar: { label: "Caterpillar", kind: "caterpillar", bg: "#ddffd1", face: "#65b46a", accent: "#3f8f4e" },
  bee: { label: "Bee", kind: "bee", bg: "#fff4b8", face: "#ffd54f", accent: "#5e4331" },
  chicken: { label: "Chicken", kind: "chicken", bg: "#fff4b8", face: "#ffffff", accent: "#ff6f61" },
  chinchilla: { label: "Chinchilla", kind: "chinchilla", bg: "#edf2f7", face: "#b2becd", accent: "#ffffff" },
  chipmunk: { label: "Chipmunk", kind: "chipmunk", bg: "#fff0d8", face: "#c17335", accent: "#f0b978" },
  cow: { label: "Cow", kind: "cow", bg: "#eef3ff", face: "#ffffff", accent: "#172033" },
  coyote: { label: "Coyote", kind: "coyote", bg: "#fff0d8", face: "#ad8350", accent: "#e0c4a3" },
  crocodile: { label: "Crocodile", kind: "crocodile", bg: "#dfffd2", face: "#4c8f53", accent: "#81c287" },
  crow: { label: "Crow", kind: "crow", bg: "#e5e3ff", face: "#172033", accent: "#4a5369" },
  deer: { label: "Deer", kind: "deer", bg: "#fff0d8", face: "#b8804f", accent: "#e8cba5" },
  dingo: { label: "Dingo", kind: "dingo", bg: "#fff3df", face: "#d6a15c", accent: "#ffffff" },
  dog: { label: "Dog", kind: "dog", bg: "#fff0cf", face: "#d19a58", accent: "#734e26" },
  eagle: { label: "Eagle", kind: "eagle", bg: "#eaf0f4", face: "#ffffff", accent: "#ffba31" },
  echidna: { label: "Echidna", kind: "echidna", bg: "#fff0cf", face: "#8c6b54", accent: "#e0c2ab" },
  emu: { label: "Emu", kind: "emu", bg: "#e5e3ff", face: "#7a7d8a", accent: "#454752" },
  flamingo: { label: "Flamingo", kind: "flamingo", bg: "#ffe6ef", face: "#ff8aa6", accent: "#ffffff" },
  fox: { label: "Fox", kind: "fox", bg: "#ffe6df", face: "#e86e3a", accent: "#ffffff" },
  gazelle: { label: "Gazelle", kind: "gazelle", bg: "#fff3df", face: "#c28e57", accent: "#ffffff" },
  giraffe: { label: "Giraffe", kind: "giraffe", bg: "#fff4b8", face: "#ffd54f", accent: "#a67138" },
  gorilla: { label: "Gorilla", kind: "gorilla", bg: "#dfe7ff", face: "#28324f", accent: "#172033" },
  hedgehog: { label: "Hedgehog", kind: "hedgehog", bg: "#fff0d8", face: "#b08d71", accent: "#d1bba8" },
  horse: { label: "Horse", kind: "horse", bg: "#fff3df", face: "#8a6042", accent: "#4a2d18" },
  hyena: { label: "Hyena", kind: "hyena", bg: "#fff0d8", face: "#b89e72", accent: "#5e4b31" },
  iguana: { label: "Iguana", kind: "iguana", bg: "#ddffd1", face: "#5aab5e", accent: "#a2db9e" },
  kangaroo: { label: "Kangaroo", kind: "kangaroo", bg: "#fff0cf", face: "#c28b51", accent: "#ffffff" },
  lemur: { label: "Lemur", kind: "lemur", bg: "#e5e3ff", face: "#929bb0", accent: "#172033" },
  leopard: { label: "Leopard", kind: "leopard", bg: "#fff1ad", face: "#e6a137", accent: "#172033" },
  lynx: { label: "Lynx", kind: "lynx", bg: "#fff0cf", face: "#cf9e67", accent: "#ffffff" },
  macaw: { label: "Macaw", kind: "macaw", bg: "#dcf8ff", face: "#4da6ff", accent: "#ffba31" },
  peacock: { label: "Peacock", kind: "peacock", bg: "#dcf8ff", face: "#2d7ab3", accent: "#5bd69c" },
  pelican: { label: "Pelican", kind: "pelican", bg: "#e7f8ff", face: "#ffffff", accent: "#ffba31" },
  pig: { label: "Pig", kind: "pig", bg: "#ffe6ef", face: "#ff9ebf", accent: "#e66a93" },
  platypus: { label: "Platypus", kind: "platypus", bg: "#eaf0f4", face: "#62554e", accent: "#483832" },
  porcupine: { label: "Porcupine", kind: "porcupine", bg: "#fff0d8", face: "#594a3d", accent: "#d1bda6" },
  raccoon: { label: "Raccoon", kind: "raccoon", bg: "#edf2f7", face: "#929bb0", accent: "#172033" },
  rat: { label: "Rat", kind: "rat", bg: "#edf2f7", face: "#c7cedb", accent: "#ffb8ca" },
  sheep: { label: "Sheep", kind: "sheep", bg: "#f4f8ff", face: "#ffffff", accent: "#c7cedb" },
  skunk: { label: "Skunk", kind: "skunk", bg: "#dfe7ff", face: "#172033", accent: "#ffffff" },
  swan: { label: "Swan", kind: "swan", bg: "#e7f8ff", face: "#ffffff", accent: "#ff9f1c" },
  wolf: { label: "Wolf", kind: "wolf", bg: "#edf2f7", face: "#748194", accent: "#ffffff" },
  yak: { label: "Yak", kind: "yak", bg: "#eadfd5", face: "#664d3f", accent: "#38251b" }
};
const cameraDebugEnabled =
  query.get("debugCamera") === "1" || localStorage.getItem("captureQuestDebugCamera") === "1";
const cameraDebugEvents = [];
const maxVisibleNotifications = 3;

const state = {
  view: isAvatarReview ? "avatars" : initialGameId ? "join" : "home",
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
  prefillGameId: initialGameId,
  ownerNamePlaceholder: "",
  joinNamePlaceholder: "",
  lobbyGuideOpen: false,
  lastRenderedView: ""
};

const nameShakeState = {
  listening: false,
  permissionGranted: false,
  lastMagnitude: 0,
  lastShakeAt: 0
};

const cameraState = {
  stream: null,
  startPromise: null,
  error: "",
  failed: false,
  failureReason: "",
  sending: false,
  torchSupported: false,
  torchOn: false,
  torchChanging: false,
  torchError: "",
  submitToken: 0,
  pendingSubmitToken: 0,
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
const captureMaxSide = 640;
const captureJpegQuality = 0.62;
const lobbyAttendantSpeedMin = 18;
const lobbyAttendantSpeedMax = 42;
const lobbyAttendantTeamPull = 9;
const lobbyAttendantTeamDividerGap = 8;
const lobbyAttendantTeamLabelOffset = 62;
const lobbyAttendantGridThreshold = 12;
const lobbyAttendantGridGap = 10;
const lobbyAttendantGridDrift = 7;
const lobbyAttendantGridEase = 10;
const lobbyAttendantTiltDegrees = 5.5;

const lobbyAttendantMotion = {
  rafId: 0,
  players: new Map(),
  lastAt: 0
};

function describeCameraError(error) {
  return error
    ? {
        name: error.name,
        message: error.message
      }
    : null;
}

function describeMediaTrack(track) {
  if (!track) return null;
  let settings = null;
  let capabilities = null;
  try {
    settings = track.getSettings?.() || null;
  } catch {
    settings = null;
  }
  try {
    capabilities = track.getCapabilities?.() || null;
  } catch {
    capabilities = null;
  }
  return {
    label: track.label,
    readyState: track.readyState,
    enabled: track.enabled,
    muted: track.muted,
    settings,
    capabilities
  };
}

function describeCameraVideo(video = document.querySelector("#cameraVideo")) {
  const track = video?.srcObject?.getVideoTracks?.()[0] || null;
  return {
    hasVideo: Boolean(video),
    connected: Boolean(video?.isConnected),
    readyState: video?.readyState ?? null,
    paused: video?.paused ?? null,
    currentTime: video ? Number(video.currentTime.toFixed(2)) : null,
    width: video?.videoWidth || 0,
    height: video?.videoHeight || 0,
    hasSrcObject: Boolean(video?.srcObject),
    track: describeMediaTrack(track)
  };
}

function cameraDebug(kind, message, data = null) {
  if (!cameraDebugEnabled) return;
  const event = {
    at: new Date().toISOString(),
    elapsedMs: Math.round(performance.now()),
    kind,
    message,
    data
  };
  cameraDebugEvents.push(event);
  if (cameraDebugEvents.length > 250) cameraDebugEvents.shift();
  window.__captureQuestCameraDebug = cameraDebugEvents;
  console.error("[CQDBG]", kind, message, data || "");
}

if (cameraDebugEnabled) {
  window.__captureQuestCameraDebug = cameraDebugEvents;
  window.__captureQuestCameraSnapshot = () => describeCameraVideo();
  cameraDebug("debug", "camera debug enabled", {
    href: window.location.href,
    assetVersion
  });
}

const soundState = {
  context: null,
  unlocked: false,
  bgmMuted: readBgmMuted(),
  countdownTickKey: "",
  lastEndSoundGameId: "",
  musicBuffers: {},
  musicLoading: {},
  musicSource: null,
  musicGain: null,
  musicMode: ""
};
let targetPronunciationAudio = null;

const backgroundMusicTracks = {
  lobby: {
    path: "/assets/audio/lobby-flowerbed-fields.mp3",
    volume: 0.18
  },
  game: {
    path: "/assets/audio/ingame-booxbep-chiptune.mp3",
    volume: 0.2
  },
  urgent: {
    path: "/assets/audio/countdown-fast-fight-looped.mp3",
    volume: 0.26
  }
};

function createAudioContext() {
  if (soundState.context) return soundState.context;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  soundState.context = new AudioContextClass();
  return soundState.context;
}

function readBgmMuted() {
  try {
    return localStorage.getItem(bgmMutedKey) === "1";
  } catch {
    return false;
  }
}

function saveBgmMuted(muted) {
  soundState.bgmMuted = Boolean(muted);
  try {
    localStorage.setItem(bgmMutedKey, soundState.bgmMuted ? "1" : "0");
  } catch {
    // Local storage can be unavailable in private or restricted browsing modes.
  }
}

function toggleBgmMuted() {
  saveBgmMuted(!soundState.bgmMuted);
  syncBackgroundMusic();
  renderGameMenu();
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

function loadBackgroundMusic(mode) {
  const track = backgroundMusicTracks[mode];
  const context = createAudioContext();
  if (!track || !context) return Promise.resolve(null);
  if (soundState.musicBuffers[mode]) return Promise.resolve(soundState.musicBuffers[mode]);
  if (soundState.musicLoading[mode]) return soundState.musicLoading[mode];

  soundState.musicLoading[mode] = fetch(assetUrl(track.path))
    .then((response) => {
      if (!response.ok) throw new Error(`Music failed to load: ${track.path}`);
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      soundState.musicBuffers[mode] = buffer;
      return buffer;
    })
    .catch(() => null)
    .finally(() => {
      delete soundState.musicLoading[mode];
    });

  return soundState.musicLoading[mode];
}

function preloadBackgroundMusic(exceptMode = "") {
  if (soundState.bgmMuted) return;
  window.setTimeout(() => {
    if (soundState.bgmMuted) return;
    for (const mode of Object.keys(backgroundMusicTracks)) {
      if (mode !== exceptMode) loadBackgroundMusic(mode);
    }
  }, 1200);
}

function stopBackgroundMusic() {
  if (soundState.musicSource) {
    try {
      soundState.musicSource.stop();
    } catch {
      // The source may already have stopped during a mode change.
    }
    soundState.musicSource.disconnect();
  }
  if (soundState.musicGain) {
    soundState.musicGain.disconnect();
  }
  soundState.musicSource = null;
  soundState.musicGain = null;
  soundState.musicMode = "";
}

function backgroundMusicMode() {
  const countdown = countdownState(state.game);
  if (state.view === "lobby") return "lobby";
  if (state.view === "game") {
    if (countdown?.mode === "round" && countdown.left > 0 && countdown.left <= 10000) return "urgent";
    return "game";
  }
  return "";
}

function startBackgroundMusic(mode) {
  if (soundState.bgmMuted) {
    stopBackgroundMusic();
    return;
  }
  if (!mode || !canPlaySound() || document.hidden) return;
  if (soundState.musicMode === mode && soundState.musicSource) return;
  if (soundState.musicMode && soundState.musicMode !== mode) stopBackgroundMusic();

  const buffer = soundState.musicBuffers[mode];
  if (!buffer) {
    loadBackgroundMusic(mode).then(() => {
      if (backgroundMusicMode() === mode) startBackgroundMusic(mode);
    });
    return;
  }

  stopBackgroundMusic();
  const context = soundState.context;
  const track = backgroundMusicTracks[mode];
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.setValueAtTime(track.volume, context.currentTime);
  source.connect(gain);
  gain.connect(context.destination);
  source.start();
  soundState.musicSource = source;
  soundState.musicGain = gain;
  soundState.musicMode = mode;
}

function syncBackgroundMusic() {
  const mode = backgroundMusicMode();
  if (soundState.bgmMuted || !mode || !soundState.unlocked || document.hidden) {
    stopBackgroundMusic();
    return;
  }
  startBackgroundMusic(mode);
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
      playerId: state.playerId,
      clientId: readClientId()
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

function randomFunnyAnimalUsername() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint32Array(1);
    browserCrypto.getRandomValues(bytes);
    return funnyAnimalUsernames[bytes[0] % funnyAnimalUsernames.length];
  }
  return funnyAnimalUsernames[Math.floor(Math.random() * funnyAnimalUsernames.length)];
}

function nextFunnyAnimalUsername(currentName = "") {
  const current = String(currentName || "").trim().toLowerCase();
  const choices = funnyAnimalUsernames.filter((username) => username.toLowerCase() !== current);
  if (!choices.length) return randomFunnyAnimalUsername();
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint32Array(1);
    browserCrypto.getRandomValues(bytes);
    return choices[bytes[0] % choices.length];
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

function ensureOwnerNamePlaceholder() {
  if (!state.ownerNamePlaceholder) {
    state.ownerNamePlaceholder = randomFunnyAnimalUsername();
  }
  return state.ownerNamePlaceholder;
}

function ensureJoinNamePlaceholder() {
  if (!state.joinNamePlaceholder) {
    state.joinNamePlaceholder = randomFunnyAnimalUsername();
  }
  return state.joinNamePlaceholder;
}

function hashString(value) {
  return Array.from(String(value || "")).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function animalKeyFromName(username = "") {
  const words = String(username || "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.reverse().find((word) => animalAvatarProfiles[word]) || "";
}

function fallbackAvatarProfile(username = "") {
  const palettes = [
    ["#e8f0ff", "#4b7dff", "#ffffff"],
    ["#e1fff0", "#39b979", "#ffffff"],
    ["#fff1bf", "#f0a533", "#ffffff"],
    ["#ffe4df", "#ff6f61", "#ffffff"],
    ["#efe8ff", "#8d69d8", "#ffffff"]
  ];
  const [bg, face, accent] = palettes[hashString(username) % palettes.length];
  return { label: "Player", kind: "mammal", bg, face, accent };
}

function animalAvatarProfile(username = "") {
  const animalKey = animalKeyFromName(username);
  return animalKey ? animalAvatarProfiles[animalKey] : fallbackAvatarProfile(username);
}

function animalEyesMarkup() {
  return `
    <circle cx="16" cy="19" r="1.7" fill="#172033"/>
    <circle cx="24" cy="19" r="1.7" fill="#172033"/>
  `;
}

function animalFaceMarkup(profile) {
  const face = escapeHtml(profile.face);
  const accent = escapeHtml(profile.accent);
  const extra =
    profile.kind === "spots"
      ? `<circle cx="13" cy="18" r="1.7" fill="${accent}"/><circle cx="26" cy="16" r="1.7" fill="${accent}"/><circle cx="24" cy="27" r="1.4" fill="${accent}"/>`
      : profile.kind === "stripe" || profile.kind === "cat"
        ? `<path d="M13 15l6 4m8-4-6 4M13 25l5-3m9 3-5-3" fill="none" stroke="${accent}" stroke-width="2" stroke-linecap="round"/>`
        : profile.kind === "teeth"
          ? `<rect x="17" y="25" width="3" height="5" rx=".8" fill="${accent}" stroke="#172033" stroke-width=".8"/><rect x="20" y="25" width="3" height="5" rx=".8" fill="${accent}" stroke="#172033" stroke-width=".8"/>`
          : profile.kind === "tusk"
            ? `<path d="M16 25c-2 5-5 5-6 2m14-2c2 5 5 5 6 2" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`
            : "";
  return `
    <circle cx="13" cy="15" r="5" fill="${face}"/>
    <circle cx="27" cy="15" r="5" fill="${face}"/>
    <circle cx="20" cy="22" r="11" fill="${face}"/>
    <ellipse cx="20" cy="25" rx="5" ry="3.8" fill="${accent}" opacity=".9"/>
    ${animalEyesMarkup()}
    <path d="M20 23l-2 2h4z" fill="#172033"/>
    ${extra}
  `;
}

function animalAvatarFeatureMarkup(profile) {
  const f = escapeHtml(profile.face);
  const a = escapeHtml(profile.accent);
  const d = "#172033";
  const w = "#ffffff";
  const p = "#ff99cc";
  const b = `opacity="0.5" fill="${p}"`;
  
  const eL = `<circle cx="15" cy="20" r="3.5" fill="${d}"/><circle cx="25" cy="20" r="3.5" fill="${d}"/><circle cx="14" cy="19" r="1.5" fill="${w}"/><circle cx="24" cy="19" r="1.5" fill="${w}"/><circle cx="16" cy="21.5" r="0.7" fill="${w}"/><circle cx="26" cy="21.5" r="0.7" fill="${w}"/><ellipse cx="11" cy="23" rx="3" ry="1.5" ${b}/><ellipse cx="29" cy="23" rx="3" ry="1.5" ${b}/>`;
  const eW = `<circle cx="12" cy="20" r="3.5" fill="${d}"/><circle cx="28" cy="20" r="3.5" fill="${d}"/><circle cx="11" cy="19" r="1.5" fill="${w}"/><circle cx="27" cy="19" r="1.5" fill="${w}"/><circle cx="13" cy="21.5" r="0.7" fill="${w}"/><circle cx="29" cy="21.5" r="0.7" fill="${w}"/><ellipse cx="8" cy="23" rx="3" ry="1.5" ${b}/><ellipse cx="32" cy="23" rx="3" ry="1.5" ${b}/>`;
  const eS = `<circle cx="15" cy="20" r="2.5" fill="${d}"/><circle cx="25" cy="20" r="2.5" fill="${d}"/><circle cx="14" cy="19" r="1" fill="${w}"/><circle cx="24" cy="19" r="1" fill="${w}"/><circle cx="16" cy="21" r="0.5" fill="${w}"/><circle cx="26" cy="21" r="0.5" fill="${w}"/><ellipse cx="11" cy="22" rx="2" ry="1.5" ${b}/><ellipse cx="29" cy="22" rx="2" ry="1.5" ${b}/>`;

  const nO = `<ellipse cx="20" cy="25" rx="1.5" ry="1" fill="${d}"/><path d="M18 27 Q20 29 22 27" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>`;
  const nT = `<path d="M19 24 L21 24 L20 26 Z" fill="${d}"/><path d="M17 27 Q20 29 23 27" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>`;

  switch (profile.kind) {
    case "ant":
      return `<path d="M15 8 Q20 2 25 8 L23 12 Q20 16 17 12 Z" fill="${a}"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/><path d="M12 20 Q5 20 5 25 M28 20 Q35 20 35 25 M12 25 Q5 25 5 30 M28 25 Q35 25 35 30" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>${eW}`;
    case "badger":
      return `<path d="M8 22 L20 10 L32 22 L28 34 L12 34 Z" fill="${f}"/><path d="M16 10 L20 28 L24 10 Z" fill="${w}"/><path d="M10 22 L16 10 L18 22 Z M30 22 L24 10 L22 22 Z" fill="${a}"/>${nT}${eW}`;
    case "bear":
      return `<circle cx="11" cy="13" r="6" fill="${a}"/><circle cx="29" cy="13" r="6" fill="${a}"/><circle cx="11" cy="13" r="3" fill="${f}"/><circle cx="29" cy="13" r="3" fill="${f}"/><rect x="9" y="14" width="22" height="20" rx="10" fill="${f}"/><ellipse cx="20" cy="26" rx="6" ry="4.5" fill="${a}"/>${nO}${eL}`;
    case "beaver":
      return `<circle cx="12" cy="15" r="3.5" fill="${a}"/><circle cx="28" cy="15" r="3.5" fill="${a}"/><rect x="10" y="15" width="20" height="18" rx="8" fill="${f}"/><ellipse cx="20" cy="26" rx="7" ry="5" fill="${a}"/><rect x="17" y="29" width="2.5" height="4" rx="1" fill="${w}"/><rect x="20.5" y="29" width="2.5" height="4" rx="1" fill="${w}"/>${nO}${eL}`;
    case "camel":
      return `<path d="M16 12 Q20 5 24 12 Z" fill="${f}"/><ellipse cx="12" cy="15" rx="2" ry="3" fill="${a}"/><ellipse cx="28" cy="15" rx="2" ry="3" fill="${a}"/><rect x="11" y="14" width="18" height="20" rx="9" fill="${f}"/><ellipse cx="20" cy="27" rx="6" ry="5" fill="${a}"/>${eW}`;
    case "capybara":
      return `<circle cx="12" cy="15" r="2.5" fill="${a}"/><circle cx="28" cy="15" r="2.5" fill="${a}"/><rect x="8" y="14" width="24" height="18" rx="8" fill="${f}"/><ellipse cx="20" cy="26" rx="7" ry="5" fill="${a}"/>${nO}${eW}`;
    case "cheetah":
      return `<circle cx="13" cy="13" r="4.5" fill="${f}"/><circle cx="27" cy="13" r="4.5" fill="${f}"/><circle cx="20" cy="22" r="12" fill="${f}"/><path d="M15 19 Q12 26 16 30 M25 19 Q28 26 24 30" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>${nT}${eW}`;
    case "cobra":
      return `<path d="M10 8 Q20 -2 30 8 L36 22 Q20 38 4 22 Z" fill="${a}" opacity="0.6"/><ellipse cx="20" cy="22" rx="11" ry="12" fill="${f}"/><path d="M20 25 L20 29 L18 31 M20 29 L22 31" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>${eW}`;
    case "crab":
      return `<ellipse cx="20" cy="24" rx="12" ry="8" fill="${f}"/><path d="M12 18 Q8 10 5 15 M28 18 Q32 10 35 15 M10 26 L4 30 M30 26 L36 30" fill="none" stroke="${f}" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="14" r="2.5" fill="${f}"/><circle cx="26" cy="14" r="2.5" fill="${f}"/>${eW}`;
    case "dolphin":
      return `<path d="M20 5 L24 15 L16 15 Z" fill="${f}"/><path d="M6 22 L2 28 L10 25 M34 22 L38 28 L30 25" fill="${a}"/><ellipse cx="20" cy="23" rx="14" ry="12" fill="${f}"/><ellipse cx="20" cy="26" rx="8" ry="5" fill="${w}" opacity="0.6"/><path d="M18 26 Q20 28 22 26" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>${eW}`;
    case "donkey":
      return `<path d="M10 16 L6 4 L14 12 M30 16 L34 4 L26 12" fill="${f}" stroke="${a}" stroke-width="1.5"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/><ellipse cx="20" cy="27" rx="6" ry="5" fill="${a}"/>${nO}${eW}`;
    case "duck":
      return `<circle cx="20" cy="20" r="11" fill="${f}"/><path d="M13 23 Q20 29 27 23 Q32 26 20 31 Q8 26 13 23 Z" fill="${a}"/>${eL}`;
    case "elephant":
      return `<path d="M14 16 Q4 10 4 24 Q4 32 14 26 M26 16 Q36 10 36 24 Q36 32 26 26" fill="${f}" opacity="0.8"/><circle cx="20" cy="20" r="11" fill="${f}"/><path d="M17 26 Q17 36 23 34 Q24 30 21 28 L23 26" fill="${a}" opacity="0.9"/>${eW}`;
    case "ferret":
      return `<rect x="12" y="12" width="16" height="22" rx="8" fill="${f}"/><path d="M12 17 Q20 22 28 17 L28 22 Q20 27 12 22 Z" fill="${d}" opacity="0.15"/>${nT}${eW}`;
    case "frog":
      return `<circle cx="13" cy="14" r="5" fill="${f}"/><circle cx="27" cy="14" r="5" fill="${f}"/><rect x="8" y="16" width="24" height="18" rx="9" fill="${f}"/><path d="M14 28 Q20 32 26 28" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/>${eW}`;
    case "gecko":
      return `<path d="M8 16 Q20 6 32 16 L30 26 Q20 34 10 26 Z" fill="${f}"/><path d="M12 28 L8 34 M28 28 L32 34" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>${eW}`;
    case "goat":
      return `<path d="M13 14 Q10 5 15 5 M27 14 Q30 5 25 5" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/><path d="M18 33 L22 33 L20 38 Z" fill="${a}"/>${nO}${eW}`;
    case "goose":
      return `<circle cx="20" cy="18" r="10" fill="${f}"/><path d="M16 23 L24 23 L20 31 Z" fill="${a}"/>${eL}`;
    case "hamster":
      return `<circle cx="14" cy="14" r="3.5" fill="${f}"/><circle cx="26" cy="14" r="3.5" fill="${f}"/><rect x="6" y="14" width="28" height="20" rx="10" fill="${f}"/><ellipse cx="20" cy="26" rx="5" ry="4" fill="${w}" opacity="0.5"/>${nT}${eW}`;
    case "hippo":
      return `<circle cx="14" cy="12" r="3" fill="${f}"/><circle cx="26" cy="12" r="3" fill="${f}"/><rect x="10" y="14" width="20" height="14" rx="7" fill="${f}"/><rect x="6" y="23" width="28" height="13" rx="6.5" fill="${a}"/>${nO}${eW}`;
    case "jaguar":
      return `<circle cx="12" cy="12" r="4.5" fill="${f}"/><circle cx="28" cy="12" r="4.5" fill="${f}"/><circle cx="20" cy="22" r="12" fill="${f}"/><circle cx="14" cy="28" r="2" fill="none" stroke="${a}" stroke-width="1.5"/><circle cx="26" cy="28" r="2" fill="none" stroke="${a}" stroke-width="1.5"/><circle cx="20" cy="14" r="2.5" fill="none" stroke="${a}" stroke-width="1.5"/>${nT}${eW}`;
    case "koala":
      return `<circle cx="8" cy="16" r="8" fill="${f}"/><circle cx="32" cy="16" r="8" fill="${f}"/><circle cx="8" cy="16" r="4" fill="${w}"/><circle cx="32" cy="16" r="4" fill="${w}"/><rect x="10" y="14" width="20" height="20" rx="10" fill="${f}"/><rect x="16" y="23" width="8" height="5" rx="2.5" fill="${d}"/>${eW}`;
    case "lion":
      return `<circle cx="20" cy="20" r="15" fill="${a}"/><path d="M20 5 L24 10 L28 6 M20 35 L16 30 L12 34" fill="none" stroke="${a}" stroke-width="2"/><circle cx="20" cy="22" r="10" fill="${f}"/>${nT}${eS}`;
    case "llama":
      return `<path d="M13 16 Q10 4 16 8 M27 16 Q30 4 24 8" fill="${f}" stroke="${a}" stroke-width="1.5"/><rect x="12" y="15" width="16" height="20" rx="8" fill="${f}"/><ellipse cx="20" cy="27" rx="5" ry="4" fill="${w}" opacity="0.6"/>${nT}${eW}`;
    case "meerkat":
      return `<ellipse cx="20" cy="22" rx="9" ry="14" fill="${f}"/><circle cx="14" cy="14" r="3" fill="${f}"/><circle cx="26" cy="14" r="3" fill="${f}"/><ellipse cx="15" cy="19" rx="3" ry="2" fill="${d}" opacity="0.2"/><ellipse cx="25" cy="19" rx="3" ry="2" fill="${d}" opacity="0.2"/>${nT}${eW}`;
    case "mole":
      return `<rect x="10" y="15" width="20" height="18" rx="9" fill="${f}"/><circle cx="14" cy="14" r="3" fill="${f}"/><circle cx="26" cy="14" r="3" fill="${f}"/><path d="M18 24 L20 22 L22 24 L24 25 L21 27 L20 29 L19 27 L16 25 Z" fill="${a}"/>${eS}`;
    case "monkey":
      return `<circle cx="8" cy="20" r="5" fill="${f}"/><circle cx="32" cy="20" r="5" fill="${f}"/><circle cx="8" cy="20" r="2.5" fill="${a}"/><circle cx="32" cy="20" r="2.5" fill="${a}"/><circle cx="20" cy="20" r="11" fill="${f}"/><path d="M12 18 Q20 12 28 18 Q30 28 20 28 Q10 28 12 18 Z" fill="${a}" opacity="0.9"/>${nO}${eW}`;
    case "moose":
      return `<path d="M10 14 Q5 10 8 5 M30 14 Q35 10 32 5 M12 12 Q8 6 14 4 M28 12 Q32 6 26 4" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><rect x="12" y="14" width="16" height="22" rx="8" fill="${f}"/><ellipse cx="20" cy="28" rx="6" ry="4" fill="${a}" opacity="0.8"/>${nO}${eW}`;
    case "narwhal":
      return `<path d="M20 2 L22 12 L18 12 Z" fill="${a}"/><path d="M6 22 L2 28 L10 25 M34 22 L38 28 L30 25" fill="${f}" opacity="0.7"/><ellipse cx="20" cy="23" rx="14" ry="12" fill="${f}"/><ellipse cx="20" cy="26" rx="8" ry="5" fill="${w}" opacity="0.6"/><path d="M18 26 Q20 28 22 26" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>${eW}`;
    case "otter":
      return `<circle cx="13" cy="15" r="3.5" fill="${f}"/><circle cx="27" cy="15" r="3.5" fill="${f}"/><rect x="9" y="15" width="22" height="18" rx="9" fill="${f}"/><ellipse cx="20" cy="26" rx="6" ry="4" fill="${a}" opacity="0.8"/><path d="M10 24 L14 25 M10 26 L14 26 M30 24 L26 25 M30 26 L26 26" fill="none" stroke="${w}" stroke-width="1.2" stroke-linecap="round"/>${nO}${eW}`;
    case "owl":
      return `<path d="M10 12 L14 16 L26 16 L30 12 L30 26 Q30 32 20 32 Q10 32 10 26 Z" fill="${f}"/><circle cx="15" cy="21" r="4.5" fill="${a}"/><circle cx="25" cy="21" r="4.5" fill="${a}"/><path d="M19 25 L21 25 L20 29 Z" fill="${w}"/>${eW}`;
    case "panda":
      return `<circle cx="12" cy="12" r="5" fill="${a}"/><circle cx="28" cy="12" r="5" fill="${a}"/><circle cx="20" cy="22" r="12" fill="${f}"/><ellipse cx="15" cy="21" rx="4" ry="3" transform="rotate(-15 15 21)" fill="${a}"/><ellipse cx="25" cy="21" rx="4" ry="3" transform="rotate(15 25 21)" fill="${a}"/>${nT}${eS}`;
    case "panther":
      return `<path d="M11 16 L14 8 L18 14 M29 16 L26 8 L22 14" fill="${f}"/><circle cx="20" cy="22" r="11" fill="${f}"/><path d="M16 26 Q20 29 24 26" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>${nT}<circle cx="15" cy="20" r="3.5" fill="${a}"/><circle cx="25" cy="20" r="3.5" fill="${a}"/><circle cx="15" cy="20" r="1.5" fill="${d}"/><circle cx="25" cy="20" r="1.5" fill="${d}"/>`;
    case "parrot":
      return `<circle cx="20" cy="21" r="11" fill="${f}"/><path d="M16 10 Q20 6 24 10 Z" fill="${a}"/><path d="M22 21 Q32 21 28 30 Q22 28 20 25 Z" fill="${a}"/>${eS}`;
    case "penguin":
      return `<path d="M12 12 Q20 4 28 12 L30 32 L10 32 Z" fill="${f}"/><path d="M14 14 Q20 18 26 14 L28 32 L12 32 Z" fill="${w}" opacity="0.9"/><path d="M18 22 L22 22 L20 28 Z" fill="${a}"/>${eW}`;
    case "rabbit":
      return `<path d="M14 16 Q10 2 16 6 M26 16 Q30 2 24 6" fill="${f}" stroke="${a}" stroke-width="2"/><circle cx="13" cy="15" r="4" fill="${f}"/><circle cx="27" cy="15" r="4" fill="${f}"/><rect x="10" y="16" width="20" height="18" rx="9" fill="${f}"/><ellipse cx="20" cy="27" rx="4" ry="3" fill="${w}" opacity="0.8"/>${nT}${eW}`;
    case "rhino":
      return `<circle cx="12" cy="15" r="4" fill="${f}"/><circle cx="28" cy="15" r="4" fill="${f}"/><rect x="10" y="15" width="20" height="18" rx="8" fill="${f}"/><ellipse cx="20" cy="27" rx="7" ry="5" fill="${a}" opacity="0.7"/><path d="M18 23 L22 23 L20 15 Z" fill="${w}" opacity="0.8"/>${eW}`;
    case "seal":
      return `<ellipse cx="20" cy="22" rx="12" ry="10" fill="${f}"/><ellipse cx="20" cy="27" rx="6" ry="4" fill="${a}" opacity="0.5"/><path d="M10 25 L14 26 M10 27 L14 27 M30 25 L26 26 M30 27 L26 27" fill="none" stroke="${w}" stroke-width="1" stroke-linecap="round"/>${nO}${eW}`;
    case "seahorse":
      return `<path d="M22 8 Q14 8 16 16 Q10 20 18 26 Q24 30 20 34 Q28 28 26 20 Z" fill="${f}"/><rect x="12" y="24" width="6" height="3" rx="1.5" fill="${a}" transform="rotate(15 12 24)"/>${eS}`;
    case "shark":
      return `<path d="M20 4 L25 16 L15 16 Z" fill="${f}"/><path d="M6 22 L2 28 L10 25 M34 22 L38 28 L30 25" fill="${a}"/><ellipse cx="20" cy="23" rx="14" ry="12" fill="${f}"/><ellipse cx="20" cy="26" rx="10" ry="6" fill="${w}" opacity="0.8"/><path d="M18 26 Q20 29 22 26 Z" fill="${d}"/><path d="M20 26 L21 28 L19 28 Z" fill="${w}"/>${eL}`;
    case "sloth":
      return `<circle cx="13" cy="14" r="3.5" fill="${f}"/><circle cx="27" cy="14" r="3.5" fill="${f}"/><rect x="8" y="14" width="24" height="20" rx="10" fill="${f}"/><ellipse cx="14" cy="21" rx="4" ry="3" fill="${a}" opacity="0.4"/><ellipse cx="26" cy="21" rx="4" ry="3" fill="${a}" opacity="0.4"/><path d="M16 28 Q20 31 24 28" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>${nO}${eW}`;
    case "snail":
      return `<rect x="8" y="26" width="24" height="6" rx="3" fill="${f}"/><circle cx="18" cy="20" r="9" fill="${a}"/><path d="M18 16 A 4 4 0 1 1 14 20 A 2 2 0 1 0 16 20" fill="none" stroke="${d}" stroke-width="1.5"/><circle cx="30" cy="22" r="1.5" fill="${d}"/><circle cx="34" cy="22" r="1.5" fill="${d}"/>`;
    case "squirrel":
      return `<path d="M28 10 Q36 10 32 22 Q28 30 22 22 Z" fill="${a}"/><path d="M14 16 L16 8 L18 14 M26 16 L24 8 L22 14" fill="${f}"/><rect x="12" y="15" width="16" height="18" rx="8" fill="${f}"/><ellipse cx="20" cy="27" rx="5" ry="4" fill="${w}" opacity="0.8"/>${nT}${eW}`;
    case "tiger":
      return `<path d="M11 16 L14 10 L18 14 M29 16 L26 10 L22 14" fill="${f}"/><circle cx="20" cy="22" r="12" fill="${f}"/><path d="M16 12 L24 12 M14 16 L26 16 M12 20 L16 20 M28 20 L24 20" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><ellipse cx="20" cy="27" rx="5" ry="4" fill="${w}" opacity="0.6"/>${nT}${eW}`;
    case "toucan":
      return `<circle cx="18" cy="18" r="9" fill="${f}"/><path d="M20 18 Q35 15 32 25 Q20 25 18 22 Z" fill="${a}"/><ellipse cx="15" cy="16" rx="3" ry="3" fill="${w}"/> <circle cx="15" cy="16" r="1.5" fill="${d}"/>`;
    case "turtle":
      return `<ellipse cx="20" cy="24" rx="14" ry="8" fill="${a}"/><path d="M10 24 Q20 18 30 24 M14 28 L14 32 M26 28 L26 32 M10 24 L6 28 M30 24 L34 28" fill="none" stroke="${d}" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="14" r="5" fill="${f}"/><circle cx="18" cy="13" r="1.5" fill="${d}"/><circle cx="22" cy="13" r="1.5" fill="${d}"/>`;
    case "walrus":
      return `<circle cx="12" cy="15" r="4" fill="${f}"/><circle cx="28" cy="15" r="4" fill="${f}"/><rect x="8" y="14" width="24" height="18" rx="9" fill="${f}"/><ellipse cx="20" cy="26" rx="7" ry="5" fill="${a}" opacity="0.6"/><path d="M16 27 L14 35 M24 27 L26 35" fill="none" stroke="${w}" stroke-width="2" stroke-linecap="round"/><path d="M12 24 L16 24 M11 26 L15 26 M28 24 L24 24 M29 26 L25 26" fill="none" stroke="${d}" stroke-width="1" stroke-linecap="round"/>${nO}${eW}`;
    case "wombat":
      return `<circle cx="12" cy="14" r="3.5" fill="${f}"/><circle cx="28" cy="14" r="3.5" fill="${f}"/><rect x="8" y="14" width="24" height="20" rx="10" fill="${f}"/><rect x="17" y="24" width="6" height="4" rx="2" fill="${d}"/>${eW}`;
    case "zebra":
      return `<path d="M11 16 L7 6 L15 13 M29 16 L33 6 L25 13" fill="${f}" stroke="${a}" stroke-width="1.5"/><rect x="12" y="15" width="16" height="20" rx="8" fill="${f}"/><path d="M14 16 L26 16 M14 20 L26 20 M14 24 L26 24" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><ellipse cx="20" cy="28" rx="5" ry="4" fill="${a}" opacity="0.3"/>${nO}${eW}`;

    case "alpaca":
      return `<path d="M12 16 Q8 4 16 8 M28 16 Q32 4 24 8" fill="${f}" stroke="${a}" stroke-width="1.5"/><rect x="12" y="14" width="16" height="22" rx="8" fill="${f}"/><path d="M12 14 Q20 8 28 14" fill="${f}" stroke="${f}" stroke-width="4" stroke-linecap="round"/>${nT}${eW}`;
    case "anteater":
      return `<path d="M8 18 Q20 12 32 18 L30 28 Q20 36 10 28 Z" fill="${f}"/><path d="M16 28 L14 36 M24 28 L26 36" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/>${nO}${eW}`;
    case "armadillo":
      return `<ellipse cx="20" cy="22" rx="14" ry="10" fill="${a}"/><path d="M12 12 Q20 4 28 12 L28 24 Q20 34 12 24 Z" fill="${f}"/><path d="M16 12 Q20 6 24 12" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>${nT}${eW}`;
    case "baboon":
      return `<rect x="10" y="14" width="20" height="20" rx="10" fill="${f}"/><circle cx="12" cy="26" r="4" fill="${a}" opacity="0.8"/><circle cx="28" cy="26" r="4" fill="${a}" opacity="0.8"/>${nO}${eW}`;
    case "bat":
      return `<path d="M12 14 L2 6 L6 18 M28 14 L38 6 L34 18" fill="${a}"/><circle cx="12" cy="14" r="4" fill="${f}"/><circle cx="28" cy="14" r="4" fill="${f}"/><rect x="10" y="14" width="20" height="18" rx="9" fill="${f}"/>${nT}${eW}`;
    case "bison":
      return `<path d="M10 14 Q6 8 10 4 M30 14 Q34 8 30 4" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="18" r="12" fill="${f}"/><path d="M14 26 L26 26 L20 32 Z" fill="${a}"/>${eW}`;
    case "boar":
      return `<rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/><path d="M14 26 L12 20 M26 26 L28 20" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><ellipse cx="20" cy="26" rx="6" ry="4" fill="${a}" opacity="0.4"/>${nO}${eW}`;
    case "buffalo":
      return `<path d="M12 16 Q4 10 10 4 M28 16 Q36 10 30 4" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><rect x="10" y="14" width="20" height="18" rx="9" fill="${f}"/>${nO}${eW}`;
    case "butterfly":
      return `<ellipse cx="10" cy="18" rx="8" ry="12" fill="${a}" opacity="0.8"/><ellipse cx="30" cy="18" rx="8" ry="12" fill="${a}" opacity="0.8"/><rect x="17" y="10" width="6" height="24" rx="3" fill="${f}"/><path d="M18 10 Q14 4 16 2 M22 10 Q26 4 24 2" fill="none" stroke="${f}" stroke-width="1.5" stroke-linecap="round"/><circle cx="18" cy="14" r="2.5" fill="${d}"/><circle cx="22" cy="14" r="2.5" fill="${d}"/><circle cx="17" cy="13" r="1" fill="${w}"/><circle cx="21" cy="13" r="1" fill="${w}"/><path d="M18 18 Q20 20 22 18" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/>`;
    case "caterpillar":
      return `<circle cx="10" cy="24" r="6" fill="${a}"/><circle cx="20" cy="22" r="8" fill="${a}"/><circle cx="30" cy="20" r="10" fill="${f}"/><path d="M28 12 Q26 6 28 4 M32 12 Q34 6 32 4" fill="none" stroke="${f}" stroke-width="1.5" stroke-linecap="round"/><circle cx="27" cy="20" r="2.5" fill="${d}"/><circle cx="33" cy="20" r="2.5" fill="${d}"/><path d="M28 24 Q30 26 32 24" fill="none" stroke="${d}" stroke-width="1.5" stroke-linecap="round"/><ellipse cx="25" cy="22" rx="2" ry="1.5" fill="${a}" opacity="0.4"/><ellipse cx="35" cy="22" rx="2" ry="1.5" fill="${a}" opacity="0.4"/>`;
    case "bee":
      return `<ellipse cx="14" cy="12" rx="6" ry="8" fill="${w}" opacity="0.8" transform="rotate(-30 14 12)"/><ellipse cx="26" cy="12" rx="6" ry="8" fill="${w}" opacity="0.8" transform="rotate(30 26 12)"/><rect x="8" y="14" width="24" height="20" rx="10" fill="${f}"/><rect x="8" y="18" width="24" height="4" fill="${a}"/><rect x="8" y="26" width="24" height="4" fill="${a}"/><rect x="6" y="14" width="28" height="4" rx="2" fill="#ff6f61"/><path d="M34 16 L38 12 M34 16 L38 20" fill="none" stroke="#ff6f61" stroke-width="2" stroke-linecap="round"/>${nO}${eW}`;
    case "chicken":
      return `<circle cx="20" cy="20" r="11" fill="${f}"/><path d="M16 9 Q20 4 24 9 Z" fill="${a}"/><path d="M18 24 L22 24 L20 28 Z" fill="${a}"/>${eL}`;
    case "chinchilla":
      return `<circle cx="10" cy="12" r="6" fill="${f}"/><circle cx="30" cy="12" r="6" fill="${f}"/><circle cx="10" cy="12" r="3" fill="${a}"/><circle cx="30" cy="12" r="3" fill="${a}"/><rect x="8" y="14" width="24" height="20" rx="10" fill="${f}"/>${nT}${eW}`;
    case "chipmunk":
      return `<rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/><path d="M14 14 L14 8 M20 14 L20 8 M26 14 L26 8" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/>${nT}${eW}`;
    case "cow":
      return `<path d="M12 14 L8 6 L14 12 M28 14 L32 6 L26 12" fill="${a}"/><rect x="10" y="14" width="20" height="20" rx="9" fill="${f}"/><path d="M12 16 Q16 10 20 16 M28 16 Q24 10 20 16" fill="${a}" opacity="0.6"/><ellipse cx="20" cy="27" rx="7" ry="5" fill="${a}" opacity="0.3"/>${nO}${eW}`;
    case "coyote":
      return `<path d="M12 16 L8 4 L16 12 M28 16 L32 4 L24 12" fill="${f}" stroke="${a}" stroke-width="2"/><rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/>${nT}${eW}`;
    case "crocodile":
      return `<rect x="8" y="16" width="24" height="16" rx="8" fill="${f}"/><path d="M10 16 L12 12 L14 16 M26 16 L28 12 L30 16" fill="${a}"/><rect x="14" y="24" width="12" height="6" rx="3" fill="${a}" opacity="0.8"/>${nO}${eW}`;
    case "crow":
      return `<path d="M10 14 L14 18 L26 18 L30 14 L30 26 Q30 32 20 32 Q10 32 10 26 Z" fill="${f}"/><path d="M18 24 L22 24 L20 30 Z" fill="${a}"/>${eW}`;
    case "deer":
      return `<path d="M12 12 Q8 4 14 2 M28 12 Q32 4 26 2" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/>${nO}${eW}`;
    case "dingo":
      return `<path d="M12 16 L6 6 L16 12 M28 16 L34 6 L24 12" fill="${f}"/><rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/>${nT}${eW}`;
    case "dog":
      return `<ellipse cx="10" cy="18" rx="4" ry="8" fill="${a}"/><ellipse cx="30" cy="18" rx="4" ry="8" fill="${a}"/><rect x="10" y="14" width="20" height="20" rx="9" fill="${f}"/>${nO}${eW}`;
    case "eagle":
      return `<circle cx="20" cy="20" r="11" fill="${f}"/><path d="M17 22 L23 22 L20 28 Z" fill="${a}"/>${eS}`;
    case "echidna":
      return `<path d="M8 20 L2 16 L10 18 M32 20 L38 16 L30 18 M16 14 L12 6 L18 12 M24 14 L28 6 L22 12" fill="${a}"/><rect x="10" y="16" width="20" height="16" rx="8" fill="${f}"/><path d="M18 26 L22 26 L20 32 Z" fill="${a}" opacity="0.8"/>${eW}`;
    case "emu":
      return `<rect x="14" y="14" width="12" height="20" rx="6" fill="${f}"/><path d="M14 14 Q10 10 16 8 M26 14 Q30 10 24 8" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><path d="M18 22 L22 22 L20 26 Z" fill="${a}"/>${eS}`;
    case "flamingo":
      return `<ellipse cx="20" cy="18" rx="8" ry="10" fill="${f}"/><path d="M18 24 Q24 24 24 28 Q24 32 20 32 L20 30 Q22 30 22 28 Q22 26 18 26 Z" fill="${a}"/>${eS}`;
    case "fox":
      return `<path d="M12 16 L6 4 L16 12 M28 16 L34 4 L24 12" fill="${f}" stroke="${a}" stroke-width="2"/><rect x="10" y="14" width="20" height="18" rx="9" fill="${f}"/><path d="M10 24 L20 32 L30 24 Z" fill="${w}" opacity="0.8"/>${nT}${eW}`;
    case "gazelle":
      return `<path d="M14 12 Q12 4 16 2 M26 12 Q28 4 24 2" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/>${nT}${eW}`;
    case "giraffe":
      return `<path d="M14 10 L14 4 M26 10 L26 4" fill="none" stroke="${a}" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="4" r="1.5" fill="${a}"/><circle cx="26" cy="4" r="1.5" fill="${a}"/><rect x="12" y="12" width="16" height="24" rx="8" fill="${f}"/><ellipse cx="20" cy="28" rx="5" ry="4" fill="${a}" opacity="0.6"/>${nT}${eW}`;
    case "gorilla":
      return `<rect x="8" y="12" width="24" height="22" rx="10" fill="${f}"/><path d="M10 14 Q20 20 30 14" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round"/><ellipse cx="20" cy="27" rx="8" ry="6" fill="${a}" opacity="0.8"/>${nO}${eW}`;
    case "hedgehog":
      return `<path d="M8 20 L2 14 L10 18 M32 20 L38 14 L30 18 M16 12 L14 4 L18 10 M24 12 L26 4 L22 10" fill="${a}"/><rect x="10" y="16" width="20" height="16" rx="8" fill="${f}"/>${nT}${eW}`;
    case "horse":
      return `<path d="M18 12 Q20 4 22 12" fill="${a}" stroke="${a}" stroke-width="4" stroke-linecap="round"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/><ellipse cx="20" cy="27" rx="6" ry="5" fill="${a}" opacity="0.6"/>${nO}${eW}`;
    case "hyena":
      return `<circle cx="12" cy="14" r="4" fill="${a}"/><circle cx="28" cy="14" r="4" fill="${a}"/><rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/><circle cx="16" cy="28" r="2" fill="${a}" opacity="0.5"/><circle cx="24" cy="28" r="2" fill="${a}" opacity="0.5"/>${nO}${eW}`;
    case "iguana":
      return `<path d="M16 14 L16 8 M20 14 L20 6 M24 14 L24 8" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/>${nO}${eW}`;
    case "kangaroo":
      return `<path d="M12 16 L6 4 L14 12 M28 16 L34 4 L26 12" fill="${f}"/><rect x="12" y="14" width="16" height="20" rx="8" fill="${f}"/><rect x="16" y="26" width="8" height="6" rx="3" fill="${a}" opacity="0.4"/>${nT}${eW}`;
    case "lemur":
      return `<circle cx="10" cy="14" r="3.5" fill="${f}"/><circle cx="30" cy="14" r="3.5" fill="${f}"/><rect x="10" y="14" width="20" height="18" rx="9" fill="${f}"/><circle cx="15" cy="20" r="4.5" fill="${a}" opacity="0.3"/><circle cx="25" cy="20" r="4.5" fill="${a}" opacity="0.3"/><path d="M30 32 Q36 26 34 20" fill="none" stroke="${a}" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 2"/>${nT}${eW}`;
    case "leopard":
      return `<circle cx="12" cy="12" r="4.5" fill="${f}"/><circle cx="28" cy="12" r="4.5" fill="${f}"/><circle cx="20" cy="22" r="12" fill="${f}"/><circle cx="15" cy="14" r="1.5" fill="${a}"/><circle cx="25" cy="14" r="1.5" fill="${a}"/><circle cx="12" cy="26" r="1.5" fill="${a}"/><circle cx="28" cy="26" r="1.5" fill="${a}"/>${nT}${eW}`;
    case "lynx":
      return `<path d="M12 16 L8 4 L16 12 M28 16 L32 4 L24 12" fill="${f}"/><path d="M8 4 L6 0 M32 4 L34 0" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/><circle cx="20" cy="22" r="11" fill="${f}"/>${nT}${eW}`;
    case "macaw":
      return `<circle cx="20" cy="18" r="10" fill="${f}"/><path d="M18 22 Q24 22 26 28 Q20 28 18 26 Z" fill="${a}"/>${eS}`;
    case "peacock":
      return `<path d="M10 14 Q20 2 30 14 Z" fill="${a}" opacity="0.8"/><circle cx="20" cy="22" r="9" fill="${f}"/><path d="M18 25 L22 25 L20 29 Z" fill="${a}"/><circle cx="20" cy="10" r="1.5" fill="${f}"/><circle cx="14" cy="14" r="1.5" fill="${f}"/><circle cx="26" cy="14" r="1.5" fill="${f}"/>${eS}`;
    case "pelican":
      return `<circle cx="20" cy="18" r="10" fill="${f}"/><path d="M16 24 Q20 36 24 24 Z" fill="${a}"/>${eL}`;
    case "pig":
      return `<circle cx="11" cy="14" r="4.5" fill="${f}"/><circle cx="29" cy="14" r="4.5" fill="${f}"/><path d="M7 14 Q11 8 15 14 Z M33 14 Q29 8 25 14 Z" fill="${a}" opacity="0.5"/><circle cx="20" cy="22" r="12" fill="${f}"/><ellipse cx="20" cy="26" rx="6" ry="4" fill="${a}" opacity="0.8"/><circle cx="18" cy="26" r="1" fill="${d}"/><circle cx="22" cy="26" r="1" fill="${d}"/>${eW}`;
    case "platypus":
      return `<rect x="10" y="14" width="20" height="16" rx="8" fill="${f}"/><rect x="14" y="24" width="12" height="6" rx="3" fill="${a}"/>${eW}`;
    case "porcupine":
      return `<path d="M6 22 L2 16 L8 18 M34 22 L38 16 L32 18 M12 14 L8 6 L14 10 M28 14 L32 6 L26 10" fill="${a}"/><rect x="10" y="16" width="20" height="18" rx="9" fill="${f}"/>${nT}${eW}`;
    case "raccoon":
      return `<path d="M12 16 L6 8 L14 12 M28 16 L34 8 L26 12" fill="${f}"/><rect x="10" y="14" width="20" height="18" rx="8" fill="${f}"/><rect x="8" y="18" width="24" height="6" rx="3" fill="${a}" opacity="0.6"/>${nT}${eW}`;
    case "rat":
      return `<circle cx="8" cy="12" r="6" fill="${f}"/><circle cx="32" cy="12" r="6" fill="${f}"/><circle cx="8" cy="12" r="3.5" fill="${a}"/><circle cx="32" cy="12" r="3.5" fill="${a}"/><path d="M25 30 Q38 30 36 20" fill="none" stroke="${a}" stroke-width="2.5" stroke-linecap="round"/><path d="M10 14 L20 28 L30 14 Z" fill="${f}"/><rect x="10" y="14" width="20" height="14" rx="7" fill="${f}"/><path d="M12 24 L4 25 M10 26 L4 27 M28 24 L36 25 M30 26 L36 27" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>${nT}${eS}`;
    case "sheep":
      return `<circle cx="12" cy="14" r="4" fill="${f}"/><circle cx="28" cy="14" r="4" fill="${f}"/><circle cx="20" cy="10" r="4" fill="${f}"/><circle cx="16" cy="12" r="4" fill="${f}"/><circle cx="24" cy="12" r="4" fill="${f}"/><rect x="12" y="14" width="16" height="18" rx="8" fill="${a}"/>${nO}${eW}`;
    case "skunk":
      return `<path d="M12 16 L8 8 L14 12 M28 16 L32 8 L26 12" fill="${f}"/><rect x="10" y="14" width="20" height="18" rx="9" fill="${f}"/><path d="M20 14 L20 8 M18 14 L18 8 M22 14 L22 8" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>${nT}${eW}`;
    case "swan":
      return `<ellipse cx="20" cy="20" rx="8" ry="10" fill="${f}"/><path d="M18 24 L24 24 L20 30 Z" fill="${a}"/>${eS}`;
    case "wolf":
      return `<path d="M10 40 Q20 28 30 40 Z" fill="${f}"/><path d="M14 16 L4 0 L18 10 Z" fill="${d}"/><path d="M13 13 L6 3 L16 9 Z" fill="${w}"/><path d="M26 16 L36 0 L22 10 Z" fill="${d}"/><path d="M27 13 L34 3 L24 9 Z" fill="${w}"/><ellipse cx="20" cy="18" rx="15" ry="14" fill="${f}"/><path d="M5 18 L35 18 L20 34 Z" fill="${f}"/><path d="M20 34 L10 32 L2 28 L8 24 L2 20 C 4 12 14 14 16 22 L20 34 Z" fill="${w}"/><path d="M20 34 L30 32 L38 28 L32 24 L38 20 C 36 12 26 14 24 22 L20 34 Z" fill="${w}"/><ellipse cx="20" cy="33" rx="3" ry="2" fill="${d}"/><path d="M19 32 Q20 33 21 32" fill="none" stroke="${w}" stroke-width="1" opacity="0.8"/>${eW}`;
    case "yak":
      return `<path d="M12 16 L4 10 L10 12 M28 16 L36 10 L30 12" fill="${a}"/><rect x="10" y="14" width="20" height="22" rx="8" fill="${f}"/><path d="M12 36 L12 28 M16 36 L16 28 M20 36 L20 28 M24 36 L24 28 M28 36 L28 28" fill="none" stroke="${a}" stroke-width="1.5" stroke-linecap="round"/>${nO}${eW}`;
    default:
      return animalFaceMarkup(profile);
  }
}

function animalAvatarMarkup(username, { compact = false, ring = true } = {}) {
  const profile = animalAvatarProfile(username);
  const ringClass = ring ? " animal-avatar-ring" : "";
  return `
    <span class="animal-avatar-wrap${ringClass}" title="${escapeHtml(profile.label)} avatar" aria-hidden="true">
      <span class="animal-avatar ${compact ? "is-compact" : ""}">
      <svg class="animal-avatar-icon" viewBox="0 0 40 40" focusable="false">
        <circle cx="20" cy="20" r="19" fill="${escapeHtml(profile.bg)}"/>
        ${animalAvatarFeatureMarkup(profile)}
      </svg>
      </span>
    </span>
  `;
}

function randomNameIconMarkup() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="4" y="4" width="16" height="16" rx="4"></rect>
      <circle cx="9" cy="9" r="1.2"></circle>
      <circle cx="15" cy="9" r="1.2"></circle>
      <circle cx="12" cy="12" r="1.2"></circle>
      <circle cx="9" cy="15" r="1.2"></circle>
      <circle cx="15" cy="15" r="1.2"></circle>
    </svg>
  `;
}

function randomNameButtonMarkup(targetName, { disabled = false } = {}) {
  return `
    <button
      class="name-random-button"
      type="button"
      data-random-name-button="${escapeHtml(targetName)}"
      aria-label="Choose random name"
      title="Choose random name"
      ${disabled ? "disabled" : ""}
    >${randomNameIconMarkup()}</button>
  `;
}

function currentRandomNameInput() {
  const dialogInput = playerNameDialog?.open
    ? playerNameDialog.querySelector("[data-random-name-target]")
    : null;
  if (dialogInput && !dialogInput.disabled) return dialogInput;
  if (state.view !== "create" && state.view !== "join" && state.view !== "lobby") return null;
  return document.querySelector("[data-random-name-target]");
}

function chooseRandomName(input = currentRandomNameInput()) {
  if (!input) return "";
  const nextName = nextFunnyAnimalUsername(input.value || input.placeholder);
  input.value = nextName;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.classList.remove("is-random-picked");
  void input.offsetWidth;
  input.classList.add("is-random-picked");
  window.setTimeout(() => input.classList.remove("is-random-picked"), 320);
  return nextName;
}

function focusNameInput(input) {
  if (!input || input.disabled) return;
  input.focus({ preventScroll: true });
  const caretPosition = input.value.length;
  try {
    input.setSelectionRange(caretPosition, caretPosition);
  } catch {
    // Some input types do not support selection ranges.
  }
}

function handleNameShake(event) {
  const input = currentRandomNameInput();
  if (!input) return;

  const acceleration = event.accelerationIncludingGravity || event.acceleration;
  if (!acceleration) return;
  const x = acceleration.x || 0;
  const y = acceleration.y || 0;
  const z = acceleration.z || 0;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const delta = Math.abs(magnitude - nameShakeState.lastMagnitude);
  nameShakeState.lastMagnitude = magnitude;

  const now = Date.now();
  if (delta < 14 || now - nameShakeState.lastShakeAt < 900) return;
  nameShakeState.lastShakeAt = now;
  chooseRandomName(input);
  playNotificationSound("info");
}

async function startNameShakeListener({ requestPermission = false } = {}) {
  const MotionEventClass = window.DeviceMotionEvent;
  if (!MotionEventClass || typeof window.addEventListener !== "function") return false;
  if (nameShakeState.listening) return true;

  if (typeof MotionEventClass.requestPermission === "function" && !nameShakeState.permissionGranted) {
    if (!requestPermission) return false;
    try {
      const permission = await MotionEventClass.requestPermission();
      nameShakeState.permissionGranted = permission === "granted";
      if (!nameShakeState.permissionGranted) return false;
    } catch {
      return false;
    }
  }

  window.addEventListener("devicemotion", handleNameShake);
  nameShakeState.listening = true;
  return true;
}

function setupRandomNamePicker(inputName) {
  const input = document.querySelector(`[name='${inputName}']`);
  const button = document.querySelector(`[data-random-name-button='${inputName}']`);
  if (!input || !button) return;

  const keepInputFocused = (event) => {
    if (input.disabled) return;
    event.preventDefault();
    focusNameInput(input);
  };
  button.addEventListener("pointerdown", keepInputFocused);
  button.addEventListener("mousedown", keepInputFocused);
  button.addEventListener("click", () => {
    chooseRandomName(input);
    focusNameInput(input);
    startNameShakeListener({ requestPermission: true });
  });
  startNameShakeListener({ requestPermission: false });
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function createClientId() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return browserCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (browserCrypto?.getRandomValues) {
    browserCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex
    .slice(8, 10)
    .join("")}-${hex.slice(10).join("")}`;
}

function readClientId() {
  try {
    const stored = localStorage.getItem(clientIdKey);
    if (isUuid(stored)) return stored.toLowerCase();
    const nextClientId = createClientId();
    localStorage.setItem(clientIdKey, nextClientId);
    return nextClientId;
  } catch {
    if (!readClientId.memory) readClientId.memory = createClientId();
    return readClientId.memory;
  }
}
readClientId.memory = "";

function imagePayloadInfo(imageDataUrl) {
  const separatorIndex = imageDataUrl.indexOf(",");
  const base64Length = separatorIndex >= 0 ? imageDataUrl.length - separatorIndex - 1 : imageDataUrl.length;
  const estimatedBytes = Math.ceil((base64Length * 3) / 4);
  return {
    dataUrlLength: imageDataUrl.length,
    estimatedBytes,
    estimatedKilobytes: Math.round(estimatedBytes / 1024)
  };
}

function emitAck(event, payload, { timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    socket.timeout(timeoutMs).emit(event, payload, (error, response) => {
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

function notificationType(status) {
  if (status === "found") return "success";
  if (status === "miss") return "danger";
  if (status === "expired") return "warning";
  if (status === "skip" || status === "skipped") return "warning";
  if (status === "target") return "target";
  return "info";
}

function createToastElement(notification) {
  const element = document.createElement("div");
  element.className = `game-toast is-${notification.type}`;
  element.dataset.id = String(notification.id);
  const content = document.createElement("div");
  content.className = "game-toast-content";
  content.textContent = notification.message;
  element.appendChild(content);
  return element;
}

function toastPositionMap() {
  return new Map(
    Array.from(globalToastStack?.querySelectorAll(".game-toast") || []).map((element) => [
      element.dataset.id || "",
      element.getBoundingClientRect().top
    ])
  );
}

function animateToastDisplacement(previousPositions) {
  if (!globalToastStack || !previousPositions.size) return;
  requestAnimationFrame(() => {
    for (const element of Array.from(globalToastStack.querySelectorAll(".game-toast"))) {
      const previousTop = previousPositions.get(element.dataset.id || "");
      if (previousTop === undefined) continue;
      const currentTop = element.getBoundingClientRect().top;
      const deltaY = previousTop - currentTop;
      if (Math.abs(deltaY) < 1) continue;
      const slideToken = `${Date.now()}-${element.dataset.id || "toast"}`;
      element.dataset.slideToken = slideToken;
      element.style.transition = "none";
      element.style.marginTop = `${deltaY}px`;
      element.offsetHeight;
      window.setTimeout(() => {
        if (element.dataset.slideToken !== slideToken) return;
        element.style.transition = "margin-top 220ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        element.style.marginTop = "0";
      }, 20);
      window.setTimeout(() => {
        if (element.dataset.slideToken === slideToken) {
          delete element.dataset.slideToken;
          element.style.transition = "";
          element.style.marginTop = "";
        }
      }, 320);
    }
  });
}

function renderGlobalNotifications() {
  if (!globalToastStack) return;
  const orderedNotifications = [...state.notifications].reverse();
  const activeIds = new Set(orderedNotifications.map((notification) => String(notification.id)));
  const previousPositions = toastPositionMap();
  let addedToast = false;

  for (const element of Array.from(globalToastStack.querySelectorAll(".game-toast"))) {
    if (!activeIds.has(element.dataset.id || "")) {
      element.remove();
    }
  }

  for (const notification of orderedNotifications) {
    const id = String(notification.id);
    if (globalToastStack.querySelector(`.game-toast[data-id="${id}"]`)) continue;
    const element = createToastElement(notification);
    const referenceElement = globalToastStack.children[orderedNotifications.indexOf(notification)] || null;
    globalToastStack.insertBefore(element, referenceElement);
    addedToast = true;
  }

  if (addedToast) animateToastDisplacement(previousPositions);
}

function pushNotification(message, status = "info") {
  if (!message) return;
  const id = (state.notificationId += 1);
  playNotificationSound(status);
  const retainedNotifications =
    state.notifications.length >= maxVisibleNotifications
      ? state.notifications.slice(-(maxVisibleNotifications - 1))
      : state.notifications;
  state.notifications = [
    ...retainedNotifications,
    {
      id,
      message,
      type: notificationType(status)
    }
  ];
  renderGlobalNotifications();
  setTimeout(() => {
    state.notifications = state.notifications.filter((notification) => notification.id !== id);
    renderGlobalNotifications();
  }, 3000);
}

function setNotice(message, status = "info") {
  state.notice = "";
  pushNotification(message, status);
}

function showMessage(message, status = "info") {
  setNotice(message, status);
}

function renderConnectionPill() {
  const playerName = state.game?.me?.username || "";
  const connectionText = state.online ? playerName || "online" : "offline";
  connectionPill.innerHTML =
    state.online && playerName
      ? `${animalAvatarMarkup(playerName, { compact: true })}<span class="connection-name">${escapeHtml(playerName)}</span>`
      : escapeHtml(connectionText);
  connectionPill.title = playerName ? "Change name" : connectionText;
  connectionPill.setAttribute(
    "aria-label",
    playerName ? `Change player name, current name ${playerName}` : connectionText
  );
  connectionPill.classList.toggle("is-online", state.online);
  connectionPill.classList.toggle("has-player-name", Boolean(playerName));
}

function updateConnection(online) {
  state.online = online;
  renderConnectionPill();
}

function activeViewFromGame(game) {
  if (!game) return null;
  if (game.status === "ended") return "lobby";
  if (game.status === "lobby") return "lobby";
  if (game.status === "loading") {
    return game.currentRound || game.roundNumber > 0 || game.nextRoundAt || game.lastResult ? "game" : "lobby";
  }
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

function clearStaleGameLink(message = "") {
  localStorage.removeItem(sessionKey);
  state.view = "home";
  state.game = null;
  state.gameUrl = "";
  state.qrCode = "";
  state.playerId = "";
  state.notifications = [];
  state.prefillGameId = "";
  updateGameQuery("");
  render();
  showMessage(message);
}

async function createGame(formData = new FormData()) {
  const ownerName = String(formData.get("ownerName") || "").trim();
  if (ownerName) saveLastUsername(ownerName);
  ensureCamera({ rerender: false });
  const response = await emitAck("create_game", {
    username: ownerName,
    clientId: readClientId(),
    challengeLanguage: formData.get("challengeLanguage") || "en",
    initialChallengeInput: String(formData.get("initialChallengeInput") || "").trim(),
    teamUpEnabled: formData.get("teamUpEnabled") === "on"
  });
  if (setJoinData(response)) {
    state.view = "lobby";
    render();
    showMessage("Game created.");
  }
}

async function joinGame(formData) {
  ensureCamera({ rerender: false });
  const response = await emitAck("join_game", {
    clientId: readClientId(),
    gameId: formData.get("gameId")
  });
  if (setJoinData(response)) {
    state.view = "lobby";
    render();
    showMessage("Joined game.");
  }
}

async function rejoinPreviousGame() {
  const stored = readSession();
  const urlGameId = normalizeGameIdInput(state.urlGameId);
  const storedGameId = normalizeGameIdInput(stored?.gameId);
  const targetGameId = urlGameId || storedGameId;
  const targetPlayerId = urlGameId && storedGameId !== urlGameId ? "" : stored?.playerId;
  const clientId = readClientId();
  const username = readLastUsername();

  if (urlGameId && !targetPlayerId) {
    ensureCamera({ rerender: false });
    const response = await emitAck("join_game", {
      gameId: urlGameId,
      clientId
    });
    if (setJoinData(response)) {
      state.view = "lobby";
      render();
      showMessage("Joined game.");
    } else if (response.error === "Game not found." || response.error === "This game has already started.") {
      clearStaleGameLink(response.error);
    } else {
      state.view = "join";
      state.prefillGameId = urlGameId;
      render();
      showMessage(response.error || "");
    }
    return;
  }

  if (!targetGameId || (!targetPlayerId && !username)) return;

  const response = await emitAck("rejoin_game", {
    gameId: targetGameId,
    playerId: targetPlayerId,
    clientId,
    username
  });
  if (setJoinData(response)) {
    setNotice("Rejoined game.");
  } else if (state.urlGameId) {
    clearStaleGameLink();
  } else {
    localStorage.removeItem(sessionKey);
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

async function updatePlayerName(formData) {
  const response = await emitAck("update_player_name", {
    gameId: state.game.id,
    username: String(formData.get("playerName") || "").trim()
  });
  if (response.ok) {
    setNotice("Name updated.");
    return true;
  } else {
    setNotice(response.error);
    return false;
  }
}

async function updateGameOptions(formData) {
  const response = await emitAck("update_game_options", {
    gameId: state.game.id,
    challengeLanguage: formData.get("challengeLanguage") || "en",
    initialChallengeInput: String(formData.get("initialChallengeInput") || "").trim(),
    teamUpEnabled: formData.get("teamUpEnabled") === "on"
  });
  if (response.ok) {
    setNotice("Game options saved.");
    return true;
  } else {
    setNotice(response.error);
    return false;
  }
}

function lobbyGameOptionsFormData(overrides = {}) {
  const formData = new FormData();
  const game = state.game || {};
  formData.set("challengeLanguage", overrides.challengeLanguage ?? game.challengeLanguage ?? "en");
  formData.set("initialChallengeInput", overrides.initialChallengeInput ?? game.initialChallengeInput ?? "");
  if (overrides.teamUpEnabled ?? game.teamUpEnabled) formData.set("teamUpEnabled", "on");
  return formData;
}

function updateLobbyGameOptions(overrides = {}) {
  return updateGameOptions(lobbyGameOptionsFormData(overrides));
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

function closeGameMenu() {
  if (gameMenuDialog.open) gameMenuDialog.close();
}

function renderGameMenu() {
  if (!state.game) {
    gameMenuContent.innerHTML = `<p class="empty-state">Join or create a game to use game options.</p>`;
    return;
  }

  const isOwner = state.game.me?.id === state.game.ownerPlayerId;
  const isPaused = state.game.status === "paused";
  const isEnded = state.game.status === "ended";
  const canPause = state.game.status === "running";
  const summary = isEnded
    ? "Exit this completed game and return to the start screen."
    : isOwner
    ? isPaused
      ? "The game is paused for everyone."
      : canPause
        ? "Pause the round or end the game for everyone."
        : "End this game for everyone."
    : "Exit this game and return to the start screen.";
  const ownerPauseControl = isPaused
    ? `<button class="primary-button" id="resumeGameButton" type="button">Resume game</button>`
    : canPause
      ? `<button class="secondary-button" id="pauseGameButton" type="button">Pause game</button>`
      : "";

  gameMenuContent.innerHTML = `
    <div class="game-menu-stack">
      <p class="game-menu-summary">${escapeHtml(summary)}</p>
      <button class="secondary-button" id="toggleBgmButton" type="button">
        ${soundState.bgmMuted ? "Unmute BGM" : "Mute BGM"}
      </button>
      ${
        isEnded
          ? `<button class="danger-button" id="confirmLeaveGameButton" type="button">Exit game</button>`
          : isOwner
          ? `
            ${ownerPauseControl}
            <button class="danger-button" id="confirmEndGameButton" type="button">End game</button>
          `
          : `<button class="danger-button" id="confirmLeaveGameButton" type="button">Exit game</button>`
      }
      <button class="secondary-button" id="cancelGameMenuButton" type="button">Cancel</button>
    </div>
  `;

  document.querySelector("#pauseGameButton")?.addEventListener("click", pauseGame);
  document.querySelector("#resumeGameButton")?.addEventListener("click", resumeGame);
  document.querySelector("#toggleBgmButton")?.addEventListener("click", toggleBgmMuted);
  document.querySelector("#confirmEndGameButton")?.addEventListener("click", endGame);
  document.querySelector("#confirmLeaveGameButton")?.addEventListener("click", leaveGame);
  document.querySelector("#cancelGameMenuButton")?.addEventListener("click", closeGameMenu);
}

function openGameMenu() {
  renderGameMenu();
  if (!gameMenuDialog.open) gameMenuDialog.showModal();
}

async function pauseGame() {
  if (!state.game) return;
  const response = await emitAck("pause_game", {
    gameId: state.game.id
  });
  if (!response.ok) {
    showMessage(response.error, "warning");
    return;
  }
  closeGameMenu();
}

async function resumeGame() {
  if (!state.game) return;
  const response = await emitAck("resume_game", {
    gameId: state.game.id
  });
  if (!response.ok) {
    showMessage(response.error, "warning");
    return;
  }
  closeGameMenu();
}

async function endGame() {
  if (!state.game) return;
  const response = await emitAck("end_game", {
    gameId: state.game.id
  });
  if (!response.ok) {
    showMessage(response.error, "warning");
    return;
  }
  closeGameMenu();
}

function resetLocalGame(message = "", { preserveSession = false } = {}) {
  stopCamera();
  if (!preserveSession) localStorage.removeItem(sessionKey);
  state.view = "home";
  state.game = null;
  state.gameUrl = "";
  state.qrCode = "";
  state.playerId = "";
  state.notifications = [];
  state.prefillGameId = "";
  if (!preserveSession) updateGameQuery("");
  render();
  showMessage(message);
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
    showMessage(response.error, "warning");
    return;
  }
  closeGameMenu();
  resetLocalGame("You left the game.");
}

function currentCameraVideo() {
  return document.querySelector("#cameraVideo");
}

function isCurrentCameraVideo(video) {
  return currentCameraVideo() === video;
}

function attachCameraStream() {
  const video = currentCameraVideo();
  if (!video || !cameraState.stream) return;
  if (video.srcObject !== cameraState.stream) {
    cameraDebug("video", "assign stream to video", describeCameraVideo(video));
    video.srcObject = cameraState.stream;
  }
  bindCameraVideo(video);
  watchCameraFrames(video);
  if (!video.paused && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  const playRequest = video.play();
  if (playRequest?.then) {
    playRequest
      .then(() => {
        cameraDebug("video.play", "resolved", describeCameraVideo(video));
      })
      .catch((error) => {
        cameraDebug("video.play", "rejected", {
          error: describeCameraError(error),
          video: describeCameraVideo(video)
        });
      });
  }
}

function isCameraExpected() {
  return Boolean(state.game && state.game.status !== "ended");
}

function stopMediaStream(stream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function activeCameraTrack() {
  return cameraState.stream?.getVideoTracks()[0] || null;
}

function refreshTorchSupport(track = activeCameraTrack()) {
  let supported = false;
  try {
    supported = Boolean(track?.getCapabilities?.().torch);
  } catch {
    supported = false;
  }

  cameraState.torchSupported = supported;
  if (!supported) {
    cameraState.torchOn = false;
    cameraState.torchChanging = false;
  }
  return supported;
}

async function setTorch(enabled) {
  const track = activeCameraTrack();
  if (!track || !refreshTorchSupport(track) || cameraState.torchChanging) return false;

  cameraState.torchChanging = true;
  cameraState.torchError = "";
  if (state.view === "game") render();

  try {
    await track.applyConstraints({ advanced: [{ torch: Boolean(enabled) }] });
    cameraState.torchOn = Boolean(enabled);
    cameraState.torchError = "";
    return true;
  } catch {
    cameraState.torchOn = false;
    cameraState.torchError = "Flashlight is not available on this camera.";
    return false;
  } finally {
    cameraState.torchChanging = false;
    if (state.view === "game") render();
  }
}

function toggleTorch() {
  setTorch(!cameraState.torchOn);
}

function clearPendingSubmit() {
  cameraState.sending = false;
  cameraState.pendingSubmitToken = 0;
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
    cameraDebug("stream", "discard stream because camera is not expected", {
      requestId,
      tracks: stream.getTracks().map(describeMediaTrack)
    });
    stopMediaStream(stream);
    return;
  }
  if (requestId !== cameraState.activeRequestId && cameraState.stream) {
    cameraDebug("stream", "discard stale stream", {
      requestId,
      activeRequestId: cameraState.activeRequestId,
      tracks: stream.getTracks().map(describeMediaTrack)
    });
    stopMediaStream(stream);
    return;
  }

  if (cameraState.stream && cameraState.stream !== stream) {
    cameraDebug("stream", "replace existing stream", {
      requestId,
      previous: cameraState.stream.getTracks().map(describeMediaTrack),
      next: stream.getTracks().map(describeMediaTrack)
    });
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
  cameraState.torchOn = false;
  cameraState.torchError = "";
  refreshTorchSupport(stream.getVideoTracks()[0]);
  cameraDebug("stream", "accepted", {
    requestId,
    tracks: stream.getTracks().map(describeMediaTrack),
    torchSupported: cameraState.torchSupported
  });
  for (const track of stream.getVideoTracks()) {
    track.addEventListener("ended", () => {
      refreshTorchSupport();
      cameraDebug("track", "ended", describeMediaTrack(track));
      if (!cameraState.intentionalStop && isCameraExpected()) {
        restartCamera("Camera disconnected. Reconnecting...");
      }
    });
    track.addEventListener("mute", () => {
      cameraState.mutedSince = Date.now();
      cameraDebug("track", "mute", describeMediaTrack(track));
    });
    track.addEventListener("unmute", () => {
      cameraState.mutedSince = 0;
      resetCameraHealth();
      cameraDebug("track", "unmute", describeMediaTrack(track));
    });
  }
  resetCameraHealth();
  attachCameraStream();
  if (state.view === "game" || state.view === "lobby") render();
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
  cameraDebug("gum", "failed", {
    requestId,
    error: describeCameraError(error),
    permissionState,
    failureReason,
    retryAt: cameraState.retryAt
  });
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
  cameraDebug("gum", "timed out", {
    activeRequestId: cameraState.activeRequestId,
    retryAt: cameraState.retryAt
  });
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
    cameraDebug("stream", "release", cameraState.stream.getTracks().map(describeMediaTrack));
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
  cameraState.torchSupported = false;
  cameraState.torchOn = false;
  cameraState.torchChanging = false;
  cameraState.torchError = "";
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
  cameraDebug("camera", "restart", {
    message,
    video: describeCameraVideo()
  });
  releaseCameraStream();
  cameraState.lastRestartAt = Date.now();
  cameraState.failed = false;
  cameraState.failureReason = "";
  cameraState.retryAt = 0;
  cameraState.error = message;
  ensureCamera({ rerender: state.view === "game" });
}

function softRecoverCamera(video) {
  if (
    !cameraState.stream ||
    !isCurrentCameraVideo(video) ||
    video.srcObject !== cameraState.stream ||
    Date.now() - cameraState.lastRecoveryAt < 10000
  ) {
    return;
  }
  cameraState.lastRecoveryAt = Date.now();
  cameraDebug("video", "soft recover", {
    isCurrentVideo: isCurrentCameraVideo(video),
    video: describeCameraVideo(video)
  });
  video.play().catch(() => {});
}

function bindCameraVideo(video) {
  if (video.dataset.cameraBound === "true") return;
  video.dataset.cameraBound = "true";
  for (const eventName of ["pause", "stalled", "waiting", "emptied"]) {
    video.addEventListener(eventName, () => {
      const isCurrentVideo = isCurrentCameraVideo(video);
      cameraDebug("video.event", eventName, {
        isCurrentVideo,
        video: describeCameraVideo(video)
      });
      if (!isCurrentVideo || !isCameraExpected() || !cameraState.stream) return;
      if (eventName === "stalled" || eventName === "emptied") {
        if (!cameraState.stalledSince) cameraState.stalledSince = Date.now();
      }
    });
  }
  video.addEventListener("playing", () => {
    if (!isCurrentCameraVideo(video) || video.srcObject !== cameraState.stream) return;
    cameraDebug("video.event", "playing", describeCameraVideo(video));
    resetCameraHealth();
  });
}

function watchCameraFrames(video) {
  if (!video.requestVideoFrameCallback || video.dataset.cameraFrameWatch === "true") return;
  video.dataset.cameraFrameWatch = "true";
  const watchFrame = () => {
    if (!isCurrentCameraVideo(video) || video.srcObject !== cameraState.stream) {
      cameraDebug("video.frames", "watch stopped", {
        currentVideoMatches: isCurrentCameraVideo(video),
        streamMatches: video.srcObject === cameraState.stream
      });
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
    refreshTorchSupport();
    cameraDebug("health", "missing video track", describeCameraVideo());
    ensureCamera({ rerender: state.view === "game" });
    return;
  }
  refreshTorchSupport(track);
  if (track.readyState === "ended") {
    cameraDebug("health", "track ended", describeMediaTrack(track));
    restartCamera("Camera disconnected. Reconnecting...");
    return;
  }
  if (track.muted) {
    if (!cameraState.mutedSince) cameraState.mutedSince = Date.now();
  } else {
    cameraState.mutedSince = 0;
  }

  const video = currentCameraVideo();
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
  if (!cameraState.stalledSince) {
    cameraState.stalledSince = now;
    cameraDebug("health", "video appears stalled", describeCameraVideo(video));
  }
  if (now - cameraState.stalledSince > 10000) {
    softRecoverCamera(video);
  }
  if (
    now - cameraState.stalledSince > 45000 &&
    now - cameraState.lastRestartAt > 120000 &&
    (!cameraState.mutedSince || now - cameraState.mutedSince > 30000)
  ) {
    cameraDebug("health", "restart after long stall", describeCameraVideo(video));
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
  cameraDebug("gum", "start", {
    requestId,
    constraints: {
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    }
  });
  cameraState.startPromise = navigator.mediaDevices
    .getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" }
      }
    })
    .then((stream) => {
      cameraDebug("gum", "resolved", {
        requestId,
        tracks: stream.getTracks().map(describeMediaTrack)
      });
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
  const video = currentCameraVideo();
  if (!cameraState.stream || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    cameraDebug("capture", "camera not ready", describeCameraVideo(video));
    setNotice("Camera is not ready yet.");
    return "";
  }

  const sourceWidth = video.videoWidth || 1280;
  const sourceHeight = video.videoHeight || 720;
  const ratio = Math.min(1, captureMaxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
  const context = canvas.getContext("2d");
  cameraDebug("capture", "draw frame", {
    sourceWidth,
    sourceHeight,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    video: describeCameraVideo(video)
  });
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imageDataUrl = canvas.toDataURL("image/jpeg", captureJpegQuality);
  cameraDebug("capture", "encoded frame", {
    ...imagePayloadInfo(imageDataUrl),
    maxSide: captureMaxSide,
    quality: captureJpegQuality,
    video: describeCameraVideo(video)
  });
  return imageDataUrl;
}

function formatSeconds(ms) {
  const seconds = Math.max(0, Math.ceil(ms / 10) / 100);
  return `${seconds.toFixed(2)}s`;
}

function willEndAfterCountdown(game) {
  return game.roundsAwarded >= game.normalRounds && game.leaders?.length === 1;
}

function countdownState(game) {
  if (game?.status === "paused") return null;

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
  if (game?.status === "paused") return "Paused";
  if (countdown?.mode === "break") return willEndAfterCountdown(game) ? "Final scores soon" : "Next object soon";
  if (game?.status === "loading" && game.roundNumber > 0 && game.currentRound?.status !== "active") return "Next object loading";
  return game?.currentRound?.item || "Get ready";
}

function countdownLabel(game, countdown) {
  if (game?.status === "paused") return "Game paused";
  if (game?.status === "loading" && game.roundNumber > 0 && game.currentRound?.status !== "active") return "Preparing";
  if (countdown?.mode === "break") return willEndAfterCountdown(game) ? "Final scores in" : "Next object in";
  return `Round ${game.roundsAwarded + 1} of ${game.normalRounds}${game.roundsAwarded >= game.normalRounds ? " - tie breaker" : ""}`;
}

function skipButtonLabel(game) {
  const skip = game?.currentRound?.skip;
  if (!skip) return "Skip";
  const progress = skip.eligible > 1 ? ` ${skip.votes}/${skip.threshold}` : "";
  return `${skip.voted ? "Skipped" : "Skip"}${progress}`;
}

function skipButtonTitle(game) {
  const skip = game?.currentRound?.skip;
  if (!skip) return "Vote to skip this object";
  const unit = skip.mode === "team" ? "teams" : "players";
  return `${skip.votes}/${skip.threshold} ${unit} voted to skip.`;
}

function speakerIconMarkup() {
  return `
    <svg class="target-audio-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z"></path>
      <path d="M16 8 C17.5 9.5 17.5 14.5 16 16"></path>
      <path d="M18.5 5.5 C21.5 8.8 21.5 15.2 18.5 18.5"></path>
    </svg>
  `;
}

function speechSynthesisLanguage(languageCode = "") {
  const languageCodes = new Map([
    ["AR", "ar-SA"],
    ["ZH-HANS-YUE", "zh-HK"],
    ["ZH-HANS-CMN", "zh-CN"],
    ["ZH-HANT-YUE", "zh-HK"],
    ["ZH-HANT-CMN", "zh-TW"],
    ["EN", "en-US"],
    ["FR", "fr-FR"],
    ["DE", "de-DE"],
    ["HI", "hi-IN"],
    ["IT", "it-IT"],
    ["JA", "ja-JP"],
    ["KO", "ko-KR"],
    ["PT", "pt-BR"],
    ["RU", "ru-RU"],
    ["ES", "es-ES"],
    ["ZH", "zh-CN"],
    ["ZH-HANT", "zh-TW"],
    ["ZH-HANS-CN-CMN", "zh-CN"],
    ["ZH-HANS-CN-YUE", "zh-HK"],
    ["ZH-HANT-TW-CMN", "zh-TW"],
    ["ZH-HANT-HK-YUE", "zh-HK"]
  ]);
  return languageCodes.get(String(languageCode || "").trim().toUpperCase()) || "en-US";
}

function playFallbackPronunciation(round) {
  const speechSynthesis = window.speechSynthesis;
  const SpeechSynthesisUtteranceClass = window.SpeechSynthesisUtterance;
  if (!speechSynthesis || !SpeechSynthesisUtteranceClass) {
    showMessage("Pronunciation audio is not ready yet.", "warning");
    return;
  }

  const utterance = new SpeechSynthesisUtteranceClass(round.item);
  utterance.lang = speechSynthesisLanguage(round.languageCode);
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  const voices = speechSynthesis.getVoices?.() || [];
  const matchingVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith(utterance.lang.toLowerCase()));
  if (matchingVoice) utterance.voice = matchingVoice;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

function targetWordMarkup(game, countdown) {
  const round = game?.currentRound;
  if (
    game?.status === "paused" ||
    countdown?.mode === "break" ||
    (game?.status === "loading" && round?.status !== "active") ||
    !round?.item
  ) {
    return escapeHtml(countdownTitle(game, countdown));
  }

  const languageCode = String(round.languageCode || "").trim().toUpperCase();
  const languageLabel = languageCode ? `<span class="target-language-code">[${escapeHtml(languageCode)}]</span>` : "";
  const audioButton = `
    <button
      class="target-audio-button ${round.audioUrl ? "" : "is-fallback"}"
      id="playTargetAudioButton"
      type="button"
      aria-label="Play pronunciation"
      title="${round.audioUrl ? "Play pronunciation" : "Play pronunciation with device voice"}"
    >${speakerIconMarkup()}</button>
  `;

  return `
    <span class="target-word-row">
      ${languageLabel}
      <span class="target-object-text">${escapeHtml(round.item)}</span>
      ${audioButton}
    </span>
  `;
}

function playTargetAudio() {
  const round = state.game?.currentRound;
  const audioUrl = round?.audioUrl;
  if (!audioUrl) {
    if (round?.item) playFallbackPronunciation(round);
    return;
  }

  try {
    if (targetPronunciationAudio) {
      targetPronunciationAudio.pause();
      targetPronunciationAudio = null;
    }
    targetPronunciationAudio = new Audio(audioUrl);
    targetPronunciationAudio.preload = "auto";
    targetPronunciationAudio.play().catch((error) => {
      showMessage(`Pronunciation audio could not play: ${error.message}`, "warning");
    });
  } catch (error) {
    showMessage(`Pronunciation audio could not play: ${error.message}`, "warning");
  }
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
  syncBackgroundMusic();
}

function playerStatusText(player) {
  const team = player.teamName ? player.teamName.toLowerCase() : "";
  return [
    player.isOwner ? "owner" : "player",
    player.isWinner ? "winner" : "",
    team,
    player.ready ? "ready" : "not ready",
    player.connected ? "online" : "offline",
    `${player.score} points`
  ]
    .filter(Boolean)
    .join(" · ");
}

function readyStatusIconMarkup(ready) {
  return ready
    ? `
      <svg class="lobby-ready-icon is-ready" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M7.8 12.2l2.6 2.7 5.8-6"></path>
      </svg>
    `
    : `
      <svg class="lobby-ready-icon is-not-ready" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M8 12h8"></path>
      </svg>
    `;
}

function crownMarkup() {
  return `
    <svg class="lobby-owner-crown" viewBox="0 0 32 24" aria-hidden="true" focusable="false">
      <path d="M3 8l7 5 6-10 6 10 7-5-3 13H6L3 8z"></path>
      <path d="M7 21h18"></path>
    </svg>
  `;
}

function trophyMarkup() {
  return `
    <svg class="lobby-winner-trophy" viewBox="0 0 32 30" aria-hidden="true" focusable="false">
      <path d="M10 5h12v7.5c0 4-2.5 7.5-6 7.5s-6-3.5-6-7.5V5z"></path>
      <path d="M10 8H5.5v2.2c0 3.7 2.3 5.8 6.1 6.1"></path>
      <path d="M22 8h4.5v2.2c0 3.7-2.3 5.8-6.1 6.1"></path>
      <path d="M16 20v4"></path>
      <path d="M11 26h10"></path>
    </svg>
  `;
}

function lobbyAttendantTeamLabels(teams = []) {
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.id === "red") return -1;
    if (b.id === "red") return 1;
    return a.name.localeCompare(b.name);
  });
  const left = sortedTeams[0];
  const right = sortedTeams[1];
  if (!left || !right) return "";
  return `
    <div class="lobby-team-labels" aria-hidden="true">
      <span class="lobby-team-label ${teamClass(left.id)}" style="--team-color:${escapeHtml(left.color || "#ff4f5e")}">${escapeHtml(left.name)}</span>
      <span class="lobby-team-label ${teamClass(right.id)}" style="--team-color:${escapeHtml(right.color || "#4b7dff")}">${escapeHtml(right.name)}</span>
    </div>
  `;
}

function lobbyAttendantTokens(players = [], viewerPlayerId = "", { readyToggleEnabled = true } = {}) {
  const sortedPlayers = [...players].sort(
    (a, b) => Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username)
  );
  const teamCounts = sortedPlayers.reduce((counts, player) => {
    const key = player.teamId || "all";
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map());
  const teamIndexes = new Map();
  return sortedPlayers
    .map((player) => {
      const statusText = playerStatusText(player);
      const teamId = player.teamId || "";
      const teamKey = teamId || "all";
      const teamIndex = teamIndexes.get(teamKey) || 0;
      teamIndexes.set(teamKey, teamIndex + 1);
      const side = teamId === "blue" ? "right" : "left";
      const isMe = player.id === viewerPlayerId;
      const canToggleReady = isMe && readyToggleEnabled;
      return `
        <div
          class="lobby-attendant-token ${player.connected ? "is-online" : "is-offline"} ${player.ready ? "is-ready" : "is-not-ready"} ${player.isOwner ? "is-owner" : ""} ${player.isWinner ? "is-winner" : ""} ${isMe ? "is-me" : ""} ${teamId ? teamClass(teamId) : ""}"
          aria-label="${escapeHtml(`${player.username} · ${statusText}${canToggleReady ? " · tap to toggle ready" : ""}`)}"
          data-player-id="${escapeHtml(player.id)}"
          data-is-me="${isMe ? "true" : "false"}"
          data-team-id="${escapeHtml(teamId)}"
          data-team-index="${teamIndex}"
          data-team-count="${teamCounts.get(teamKey) || 1}"
          data-team-side="${side}"
          ${canToggleReady ? 'role="button" tabindex="0"' : ""}
          style="${teamId ? `--team-color:${escapeHtml(player.teamColor || "#4b7dff")}` : ""}"
        >
          <span class="lobby-attendant-avatar">
            ${player.isOwner ? crownMarkup() : ""}
            ${player.isWinner ? trophyMarkup() : ""}
            ${animalAvatarMarkup(player.username, { ring: false })}
            <span class="lobby-ready-state" aria-label="${player.ready ? "Ready" : "Not ready"}">${readyStatusIconMarkup(player.ready)}</span>
            <span class="lobby-attendant-score" aria-label="${escapeHtml(`${signedScore(player.score)} points`)}">${escapeHtml(signedScore(player.score))}</span>
          </span>
          <span class="lobby-attendant-name">${escapeHtml(player.username)}</span>
        </div>
      `;
    })
    .join("");
}

function stopLobbyAttendantMotion() {
  if (lobbyAttendantMotion.rafId) {
    cancelAnimationFrame(lobbyAttendantMotion.rafId);
    lobbyAttendantMotion.rafId = 0;
  }
  lobbyAttendantMotion.lastAt = 0;
}

function attendantInitialMotion(playerId, index, bounds, width, height) {
  const seed = hashString(`${playerId}:${index}`);
  const minX = bounds.x || 0;
  const minY = bounds.y || 0;
  const maxX = Math.max(0, bounds.width - width);
  const maxY = Math.max(0, bounds.height - height);
  const angle = (((seed % 360) + 27) * Math.PI) / 180;
  const speed = lobbyAttendantSpeedMin + (seed % (lobbyAttendantSpeedMax - lobbyAttendantSpeedMin));
  return {
    x: minX + (maxX ? (seed * 37) % maxX : 0),
    y: minY + (maxY ? (seed * 53) % maxY : 0),
    vx: Math.cos(angle) * speed || speed,
    vy: Math.sin(angle) * speed || speed * 0.72,
    width,
    height,
    radius: Math.max(width, height) / 2,
    seed,
    gridSlotKey: "",
    tiltDirection: seed % 2 === 0 ? 1 : -1,
    tiltPhase: ((seed >> 2) % 628) / 100,
    tiltSpeed: 0.72 + ((seed >> 4) % 72) / 100,
    targetXRatio: 0.18 + ((seed >> 3) % 64) / 100,
    targetYRatio: 0.16 + ((seed >> 5) % 68) / 100,
    zoneKey: bounds.key || "all"
  };
}

function shouldUseLobbyAttendantGrid(count) {
  return count >= lobbyAttendantGridThreshold;
}

function attendantRotationDegrees(item, now) {
  const time = now / 1000;
  return Math.sin(time * item.tiltSpeed + item.tiltPhase) * lobbyAttendantTiltDegrees * item.tiltDirection;
}

function keepAttendantInBounds(item, bounds) {
  const minX = bounds.x || 0;
  const minY = bounds.y || 0;
  const maxX = minX + Math.max(0, bounds.width - item.width);
  const maxY = minY + Math.max(0, bounds.height - item.height);
  if (item.x <= minX) {
    item.x = minX;
    item.vx = Math.abs(item.vx);
  } else if (item.x >= maxX) {
    item.x = maxX;
    item.vx = -Math.abs(item.vx);
  }
  if (item.y <= minY) {
    item.y = minY;
    item.vy = Math.abs(item.vy);
  } else if (item.y >= maxY) {
    item.y = maxY;
    item.vy = -Math.abs(item.vy);
  }
}

function attendantZoneForNode(node, bounds, teamUpEnabled) {
  const baseZone = { ...bounds, key: "all", x: 0, y: 0 };
  if (!teamUpEnabled) return baseZone;

  const half = bounds.width / 2;
  const side = node.dataset.teamSide === "right" ? "right" : "left";
  const zoneY = lobbyAttendantTeamLabelOffset;
  const zoneHeight = Math.max(0, bounds.height - lobbyAttendantTeamLabelOffset);
  if (side === "right") {
    const x = half + lobbyAttendantTeamDividerGap / 2;
    return {
      key: "right",
      x,
      y: zoneY,
      width: Math.max(0, bounds.width - x),
      height: zoneHeight
    };
  }

  return {
    key: "left",
    x: 0,
    y: zoneY,
    width: Math.max(0, half - lobbyAttendantTeamDividerGap / 2),
    height: zoneHeight
  };
}

function attendantIsInsideZone(item, zone) {
  return (
    item.x >= zone.x &&
    item.y >= zone.y &&
    item.x + item.width <= zone.x + zone.width &&
    item.y + item.height <= zone.y + zone.height
  );
}

function guideAttendantTowardZone(item, zone, dt) {
  if (zone.key === "all") return;

  const insideZone = attendantIsInsideZone(item, zone);
  const availableX = Math.max(0, zone.width - item.width);
  const availableY = Math.max(0, zone.height - item.height);
  const targetX = zone.x + availableX * item.targetXRatio;
  const targetY = zone.y + availableY * item.targetYRatio;
  item.vx += (targetX - item.x) * lobbyAttendantTeamPull * dt;
  item.vy += (targetY - item.y) * lobbyAttendantTeamPull * dt;

  if (!insideZone) {
    if (item.x < zone.x) item.vx = Math.max(item.vx, lobbyAttendantSpeedMax * 3.4);
    if (item.x + item.width > zone.x + zone.width) item.vx = Math.min(item.vx, -lobbyAttendantSpeedMax * 3.4);
  }

  const maxSpeed = insideZone ? lobbyAttendantSpeedMax * 1.8 : lobbyAttendantSpeedMax * 5.2;
  const speed = Math.hypot(item.vx, item.vy);
  if (speed > maxSpeed) {
    item.vx = (item.vx / speed) * maxSpeed;
    item.vy = (item.vy / speed) * maxSpeed;
  }
}

function bounceAttendants(first, second) {
  const firstCenterX = first.x + first.width / 2;
  const firstCenterY = first.y + first.height / 2;
  const secondCenterX = second.x + second.width / 2;
  const secondCenterY = second.y + second.height / 2;
  const dx = secondCenterX - firstCenterX;
  const dy = secondCenterY - firstCenterY;
  const distance = Math.max(0.01, Math.hypot(dx, dy));
  const minDistance = Math.max(86, (first.radius + second.radius) * 1.18);
  if (distance >= minDistance) return;

  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = (minDistance - distance) / 2;
  first.x -= nx * overlap;
  first.y -= ny * overlap;
  second.x += nx * overlap;
  second.y += ny * overlap;

  const tangentX = -ny;
  const tangentY = nx;
  const firstNormal = first.vx * nx + first.vy * ny;
  const secondNormal = second.vx * nx + second.vy * ny;
  const firstTangent = first.vx * tangentX + first.vy * tangentY;
  const secondTangent = second.vx * tangentX + second.vy * tangentY;

  first.vx = secondNormal * nx + firstTangent * tangentX;
  first.vy = secondNormal * ny + firstTangent * tangentY;
  second.vx = firstNormal * nx + secondTangent * tangentX;
  second.vy = firstNormal * ny + secondTangent * tangentY;
}

function attendantGridColumnCount(count, zone, maxWidth) {
  const targetCellWidth = Math.max(maxWidth + lobbyAttendantGridGap, 68);
  return Math.max(1, Math.min(count, Math.floor(zone.width / targetCellWidth) || 1));
}

function attendantGridSlot(zone, count, slotIndex, maxWidth) {
  const columns = attendantGridColumnCount(count, zone, maxWidth);
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = slotIndex % columns;
  const row = Math.floor(slotIndex / columns);
  const cellWidth = zone.width / columns;
  const cellHeight = zone.height / rows;
  return {
    key: `${zone.key}:${slotIndex}:${columns}:${rows}`,
    x: zone.x + column * cellWidth,
    y: zone.y + row * cellHeight,
    width: cellWidth,
    height: cellHeight
  };
}

function guideAttendantTowardGridSlot(item, slot, now, dt) {
  const time = now / 1000;
  const phase = ((item.seed || 1) % 628) / 100;
  const slackX = Math.max(0, slot.width - item.width - lobbyAttendantGridGap);
  const slackY = Math.max(0, slot.height - item.height - lobbyAttendantGridGap);
  const driftX = Math.min(lobbyAttendantGridDrift, slackX / 2);
  const driftY = Math.min(lobbyAttendantGridDrift, slackY / 2);
  const targetX = slot.x + (slot.width - item.width) / 2 + Math.cos(time * 0.9 + phase) * driftX;
  const targetY = slot.y + (slot.height - item.height) / 2 + Math.sin(time * 1.1 + phase * 0.7) * driftY;

  if (!item.gridSlotKey || item.gridSlotKey !== slot.key) {
    item.x = targetX;
    item.y = targetY;
  } else {
    const ease = Math.min(1, Math.max(0.18, dt * lobbyAttendantGridEase));
    item.x += (targetX - item.x) * ease;
    item.y += (targetY - item.y) * ease;
  }
  item.gridSlotKey = slot.key;
  item.vx = 0;
  item.vy = 0;
}

function positionAttendantsInGrid(items, now, dt) {
  const groups = new Map();
  for (const entry of items) {
    const key = entry.zone.key || "all";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }

  for (const group of groups.values()) {
    const count = group.length;
    const maxWidth = Math.max(...group.map(({ item }) => item.width));
    group.forEach((entry, slotIndex) => {
      const slot = attendantGridSlot(entry.zone, count, slotIndex, maxWidth);
      guideAttendantTowardGridSlot(entry.item, slot, now, dt);
    });
  }
}

function startLobbyAttendantMotion() {
  const arena = document.querySelector("#lobbyAttendantArena");
  if (!arena) {
    stopLobbyAttendantMotion();
    return;
  }

  stopLobbyAttendantMotion();
  const nodes = Array.from(arena.querySelectorAll(".lobby-attendant-token"));
  const teamUpEnabled = arena.dataset.teamUp === "true";
  const gridLayoutEnabled = arena.dataset.gridLayout === "true";
  const activeIds = new Set(nodes.map((node) => node.dataset.playerId || ""));
  for (const playerId of Array.from(lobbyAttendantMotion.players.keys())) {
    if (!activeIds.has(playerId)) lobbyAttendantMotion.players.delete(playerId);
  }

  const animate = (now) => {
    const bounds = {
      key: "all",
      x: 0,
      y: 0,
      width: arena.clientWidth,
      height: Math.max(120, arena.clientHeight)
    };
    if (!bounds.width || !bounds.height) {
      lobbyAttendantMotion.rafId = requestAnimationFrame(animate);
      return;
    }
    const dt = lobbyAttendantMotion.lastAt ? Math.min(0.04, (now - lobbyAttendantMotion.lastAt) / 1000) : 0;
    lobbyAttendantMotion.lastAt = now;

    const items = nodes.map((node, index) => {
      const playerId = node.dataset.playerId || `player-${index}`;
      const width = node.offsetWidth || 72;
      const height = node.offsetHeight || 76;
      const zone = attendantZoneForNode(node, bounds, teamUpEnabled);
      let item = lobbyAttendantMotion.players.get(playerId);
      if (!item) {
        item = attendantInitialMotion(playerId, index, zone, width, height);
        lobbyAttendantMotion.players.set(playerId, item);
      }
      item.width = width;
      item.height = height;
      item.radius = Math.max(width, height) / 2;
      if (teamUpEnabled && zone.key !== "all") {
        const teamIndex = Number(node.dataset.teamIndex || 0);
        const teamCount = Math.max(1, Number(node.dataset.teamCount || 1));
        item.targetYRatio = Math.min(0.94, Math.max(0.06, (teamIndex + 0.5) / teamCount));
        item.targetXRatio = teamIndex % 2 === 0 ? 0.18 : 0.78;
      }
      if (!gridLayoutEnabled) {
        item.gridSlotKey = "";
        guideAttendantTowardZone(item, zone, dt);
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        keepAttendantInBounds(item, zone.key === "all" || attendantIsInsideZone(item, zone) ? zone : bounds);
      }
      return { node, item, zone };
    });

    if (gridLayoutEnabled) {
      positionAttendantsInGrid(items, now, dt);
    } else {
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          if (teamUpEnabled && items[i].zone.key !== items[j].zone.key) continue;
          if (
            teamUpEnabled &&
            (!attendantIsInsideZone(items[i].item, items[i].zone) ||
              !attendantIsInsideZone(items[j].item, items[j].zone))
          ) {
            continue;
          }
          bounceAttendants(items[i].item, items[j].item);
          keepAttendantInBounds(
            items[i].item,
            items[i].zone.key === "all" || attendantIsInsideZone(items[i].item, items[i].zone) ? items[i].zone : bounds
          );
          keepAttendantInBounds(
            items[j].item,
            items[j].zone.key === "all" || attendantIsInsideZone(items[j].item, items[j].zone) ? items[j].zone : bounds
          );
        }
      }
    }

    for (const { node, item, zone } of items) {
      keepAttendantInBounds(item, zone.key === "all" || attendantIsInsideZone(item, zone) ? zone : bounds);
      const rotation = attendantRotationDegrees(item, now).toFixed(2);
      node.style.transform = `translate3d(${item.x}px, ${item.y}px, 0) rotate(${rotation}deg)`;
    }

    lobbyAttendantMotion.rafId = requestAnimationFrame(animate);
  };

  lobbyAttendantMotion.rafId = requestAnimationFrame(animate);
}

function playerRows(players) {
  return [...players]
    .sort((a, b) => b.score - a.score || Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username))
    .map((player, index) => {
      const stateText = [
        player.isOwner ? "owner" : "player",
        player.teamName ? player.teamName.toLowerCase() : "",
        player.ready ? "ready" : "not ready",
        player.connected ? "online" : "offline"
      ]
        .filter(Boolean)
        .join(" · ");
      return `
        <li class="player-row">
          <span class="player-avatar">${animalAvatarMarkup(player.username)}</span>
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
  return "";
}

function challengeLanguageOptionMarkup(selectedValue = "en") {
  const selected = String(selectedValue || "en").toLowerCase();
  return challengeLanguageOptions
    .map(
      ([value, label]) =>
        `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
    )
    .join("");
}

function challengeLanguageLabel(value = "en") {
  const normalized = String(value || "en").toLowerCase();
  return challengeLanguageOptions.find(([optionValue]) => optionValue === normalized)?.[1] || "English";
}

function challengeLanguageCodeLabel(value = "en") {
  const normalized = String(value || "en").toLowerCase();
  if (normalized === "zh-hans-yue") return "ZH-S-YUE";
  if (normalized === "zh-hans-cmn") return "ZH-S-MAN";
  if (normalized === "zh-hant-yue") return "ZH-T-YUE";
  if (normalized === "zh-hant-cmn") return "ZH-T-MAN";
  return normalized.toUpperCase();
}

function teamClass(teamId = "") {
  return `is-team-${String(teamId || "").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;
}

function teamBadge(team, { compact = false } = {}) {
  if (!team?.id) return "";
  const letter = team.name?.trim()?.[0] || "?";
  return `
    <span class="team-badge ${teamClass(team.id)} ${compact ? "is-compact" : ""}" style="--team-color:${escapeHtml(team.color || "#4b7dff")}">
      <span class="team-badge-icon">${escapeHtml(letter)}</span>
      <span>${escapeHtml(team.name || "Team")}</span>
    </span>
  `;
}

function teamScoreRows(teams = []) {
  return [...teams]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map(
      (team, index) => `
        <li class="score-row team-score-row ${teamClass(team.id)}" style="--team-color:${escapeHtml(team.color || "#4b7dff")}">
          <span class="score-rank">${index + 1}</span>
          <span class="score-name">
            <span class="team-score-name">${escapeHtml(team.name)}</span>
            <span class="team-score-meta">${team.players} player${team.players === 1 ? "" : "s"}</span>
          </span>
          <span class="score-value">${team.score}</span>
        </li>
      `
    )
    .join("");
}

function signedScore(value) {
  const number = Number(value || 0);
  return number > 0 ? `+${number}` : String(number);
}

function contributionSummary(contributor) {
  const parts = [];
  if (contributor.pointsFound) parts.push(`${contributor.pointsFound} found`);
  if (contributor.penalties) parts.push(`${contributor.penalties} miss${contributor.penalties === 1 ? "" : "es"}`);
  return parts.join(" · ") || "contributed";
}

function finalTeamScoreRows(teams = []) {
  return [...teams]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((team, index) => {
      const contributors = [...(team.contributors || [])].filter(
        (contributor) => contributor.pointsFound || contributor.penalties || contributor.score !== 0
      );
      const contributorRows = contributors
        .map(
          (contributor) => `
            <li class="team-contributor-row">
              ${animalAvatarMarkup(contributor.username, { compact: true })}
              <span class="team-contributor-name">${escapeHtml(contributor.username)}</span>
              <span class="team-contributor-detail">${escapeHtml(contributionSummary(contributor))}</span>
              <span class="team-contributor-score">${escapeHtml(signedScore(contributor.score))}</span>
            </li>
          `
        )
        .join("");

      return `
        <li class="score-row team-score-row final-team-score-row ${teamClass(team.id)}" style="--team-color:${escapeHtml(team.color || "#4b7dff")}">
          <div class="final-team-main">
            <span class="score-rank">${index + 1}</span>
            <span class="score-name">
              <span class="team-score-name">${escapeHtml(team.name)}</span>
              <span class="team-score-meta">${team.players} player${team.players === 1 ? "" : "s"}</span>
            </span>
            <span class="score-value">${team.score}</span>
          </div>
          ${contributorRows ? `<ul class="team-contributor-list">${contributorRows}</ul>` : ""}
        </li>
      `;
    })
    .join("");
}

function playerScoreRows(players) {
  return [...players]
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .map(
      (player, index) => `
        <li class="score-row player-score-row">
          <span class="score-rank">${index + 1}</span>
          ${animalAvatarMarkup(player.username)}
          <span class="score-name">${escapeHtml(player.username)}</span>
          <span class="score-value">${player.score}</span>
        </li>
      `
    )
    .join("");
}

function leaderboardRows(game) {
  if (game.teamUpEnabled) return finalTeamScoreRows(game.teamScores || []);
  return playerScoreRows(game.players || []);
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

function gameScorePills(game) {
  if (game.teamUpEnabled) {
    const myTeamId = game.me?.teamId || "";
    return [...(game.teamScores || [])]
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .map(
        (team) => `
          <li class="game-score-pill team-score-pill ${team.id === myTeamId ? "is-me" : ""} ${teamClass(team.id)}" style="--team-color:${escapeHtml(team.color || "#4b7dff")}">
            <span class="team-badge-icon">${escapeHtml(team.name?.[0] || "?")}</span>
            <span class="game-score-name">${escapeHtml(team.name)}</span>
            <span class="game-score-value">${team.score}</span>
          </li>
        `
      )
      .join("");
  }

  return [...game.players]
    .sort((a, b) => b.score - a.score || Number(b.isOwner) - Number(a.isOwner) || a.username.localeCompare(b.username))
    .map(
      (player) => `
        <li class="game-score-pill ${player.id === state.playerId ? "is-me" : ""}">
          ${animalAvatarMarkup(player.username, { compact: true })}
          <span class="game-score-name">${escapeHtml(player.username)}</span>
          <span class="game-score-value">${player.score}</span>
        </li>
      `
    )
    .join("");
}

function renderAvatarReview() {
  const avatarCards = funnyAnimalUsernames
    .map((username) => {
      const profile = animalAvatarProfile(username);
      return `
        <li class="avatar-review-card">
          <div class="avatar-review-icon">${animalAvatarMarkup(username)}</div>
          <div class="avatar-review-meta">
            <span class="avatar-review-name">${escapeHtml(username)}</span>
            <span class="avatar-review-animal">${escapeHtml(profile.label)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="screen avatar-review-screen">
      <div class="avatar-review-head">
        <div>
          <h1>Animal Avatars</h1>
          <p>${funnyAnimalUsernames.length} preset player names using the same avatar renderer as the game.</p>
        </div>
        <a class="secondary-button avatar-review-back" href="/">Back to game</a>
      </div>
      <ul class="avatar-review-grid">${avatarCards}</ul>
    </section>
  `;
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
      <div class="form-side home-form-side">
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
        <p class="copyright-line">
          <a href="https://bubbleh.com" target="_blank" rel="noopener noreferrer">© 2026 bubbleh.com</a>
          <span aria-hidden="true">|</span>
          <a class="github-link" href="https://github.com/BubbleWong/Capture-Quest" target="_blank" rel="noopener noreferrer" aria-label="Capture Quest on GitHub">
            <svg class="github-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path fill="currentColor" d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.63 5.47 7.71.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.5-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.16-.28-.15-.68-.53-.01-.54.63-.01 1.08.59 1.23.83.72 1.23 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.21-3.64-.9-3.64-4 0-.88.31-1.61.82-2.18-.08-.2-.36-1.03.08-2.15 0 0 .67-.22 2.2.83A7.42 7.42 0 0 1 8 3.94c.68 0 1.36.09 2 .27 1.53-1.05 2.2-.83 2.2-.83.44 1.12.16 1.95.08 2.15.51.57.82 1.29.82 2.18 0 3.11-1.87 3.79-3.65 4 .29.25.54.74.54 1.5 0 1.08-.01 1.95-.01 2.22 0 .22.15.47.55.39A8.05 8.05 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z"></path>
            </svg>
          </a>
        </p>
      </div>
    </section>
  `;

  document.querySelector("#showCreateButton").addEventListener("click", () => {
    showMessage("Creating game...");
    createGame();
  });
  document.querySelector("#showJoinButton").addEventListener("click", () => {
    state.view = "join";
    state.joinNamePlaceholder = randomFunnyAnimalUsername();
    render();
  });
}

function renderCreate() {
  const ownerNamePlaceholder = escapeHtml(ensureOwnerNamePlaceholder());
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
            <span>Your name (optional)</span>
            <div class="name-picker">
              <input class="text-input" name="ownerName" data-random-name-target="ownerName" autocomplete="nickname" maxlength="24" placeholder="${ownerNamePlaceholder}" value="" autofocus>
              ${randomNameButtonMarkup("ownerName")}
            </div>
          </label>
          <label class="field">
            <span>Language</span>
            <select class="text-input" name="challengeLanguage">
              ${challengeLanguageOptionMarkup()}
            </select>
          </label>
          <label class="field">
            <span>Objects or AI guide</span>
            <textarea class="text-input word-list-input" name="initialChallengeInput" autocomplete="off" autocapitalize="sentences" spellcheck="true" rows="5" placeholder="pencil, backpack&#10;blue shoes; notebook&#10;&#10;or: soft colorful things safe for young kids"></textarea>
            <small class="field-note">Enter a list or describe what AI should generate. AI will refine it for safety and camera recognition. Leave blank for random AI picks.</small>
          </label>
          <label class="toggle-field">
            <input name="teamUpEnabled" type="checkbox">
            <span class="toggle-control" aria-hidden="true"></span>
            <span>
              <strong>Team-up mode</strong>
              <small>Randomly balance players into red and blue teams.</small>
            </span>
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
  setupRandomNamePicker("ownerName");
  document.querySelector("#backToChoiceButton").addEventListener("click", () => {
    state.view = "home";
    state.notice = "";
    render();
  });
}

function renderJoin() {
  const prefill = normalizeGameIdInput(state.prefillGameId);
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
          <p class="field-note">You will get a random player name now and can change it in the lobby. Tap your avatar there to switch ready status.</p>
          <button class="primary-button" type="submit">Join game</button>
          <button class="secondary-button" id="backToChoiceButton" type="button">Back</button>
        </form>
      </div>
    </section>
  `;

  setupGameCodeInput();
  if (prefill.length !== gameCodeLength) {
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
  const isEnded = game.status === "ended";
  const cameraReady = Boolean(cameraState.stream);
  const cameraMessage = cameraState.error || (cameraReady ? "Camera ready" : "Camera permission needed");
  const gameOptionsDisabled = !isOwner || game.status !== "lobby";
  const readyToggleEnabled = game.status === "lobby";
  const gridLayoutEnabled = shouldUseLobbyAttendantGrid(game.players.length);
  const redTeam = (game.teams || []).find((team) => team.id === "red") || game.teams?.[0];
  const blueTeam = (game.teams || []).find((team) => team.id === "blue") || game.teams?.[1];
  const attendantArenaStyle = [
    `--attendant-count:${game.players.length}`,
    game.teamUpEnabled && redTeam ? `--left-team-color:${escapeHtml(redTeam.color || "#ff4f5e")}` : "",
    game.teamUpEnabled && blueTeam ? `--right-team-color:${escapeHtml(blueTeam.color || "#4b7dff")}` : ""
  ]
    .filter(Boolean)
    .join(";");
  const languageLabel = challengeLanguageLabel(game.challengeLanguage);
  const languageCode = challengeLanguageCodeLabel(game.challengeLanguage);
  const winnerName = game.winner?.username || game.winner?.name || "";
  const lobbyStatusRow = game.status === "loading"
    ? `<div class="lobby-status-row"><span class="status-chip">loading objects</span></div>`
    : isEnded
      ? `<div class="lobby-status-row"><span class="status-chip">game complete</span>${winnerName ? `<span>${escapeHtml(`${winnerName} wins.`)}</span>` : ""}</div>`
      : "";
  const languageControl = isOwner
    ? `
      <label class="lobby-language-control" title="Change game language">
        <span class="lobby-control-label">Language</span>
        <select class="lobby-language-select" id="lobbyLanguageSelect" aria-label="Game language" ${gameOptionsDisabled ? "disabled" : ""}>
          ${challengeLanguageOptionMarkup(game.challengeLanguage)}
        </select>
      </label>
    `
    : `
      <span class="lobby-chip-button is-static" title="${escapeHtml(languageLabel)}">
        <span class="lobby-control-label">Language</span>
        <strong>${escapeHtml(languageCode)}</strong>
      </span>
    `;
  const guidePanel = isOwner && state.lobbyGuideOpen
    ? `
      <dialog class="lobby-guide-dialog" id="lobbyGuideDialog" aria-labelledby="lobbyGuideTitle">
        <div class="lobby-guide-head">
          <div>
            <h3 id="lobbyGuideTitle">Objects or AI guide</h3>
            <p>Enter a list or describe what AI should generate.</p>
          </div>
          <button class="icon-button lobby-guide-close" id="closeLobbyGuideButton" type="button" aria-label="Hide object guide" title="Hide">×</button>
        </div>
        <form class="lobby-guide-form stack" id="lobbyGuideForm">
          <textarea class="text-input word-list-input" name="initialChallengeInput" autocomplete="off" autocapitalize="sentences" spellcheck="true" rows="4" placeholder="pencil, backpack&#10;blue shoes; notebook&#10;&#10;or: soft colorful things safe for young kids" ${gameOptionsDisabled ? "disabled" : ""}>${escapeHtml(game.initialChallengeInput || "")}</textarea>
          <small class="field-note">AI refines lists and prompts for safety and camera recognition. Leave blank for random AI picks.</small>
          <button class="secondary-button" type="submit" ${gameOptionsDisabled ? "disabled" : ""}>Save object guide</button>
        </form>
      </dialog>
    `
    : "";
  app.innerHTML = `
    <section class="screen lobby-layout">
      <div class="panel-title">
        <div class="lobby-top-row">
          <div class="lobby-heading">
            <div>
              <h1>Lobby</h1>
              <p>Share this card with players nearby.</p>
            </div>
            ${lobbyStatusRow}
          </div>
          <section class="join-reference-card" aria-label="Game joining information">
            <div class="join-reference-body">
              ${
                state.qrCode
                  ? `
                    <div class="join-reference-qr">
                      <div class="qr-wrap join-qr-wrap"><img src="${state.qrCode}" alt="QR code for game ${escapeHtml(game.id)}"></div>
                    </div>
                  `
                  : ""
              }
              <div class="join-reference-details">
                <div class="join-reference-section">
                  <span class="reference-label">Game ID</span>
                  <div class="game-code">${escapeHtml(game.id)}</div>
                </div>
                <div class="join-reference-section join-share-section">
                  <button class="secondary-button copy-url-button" id="copyUrlButton" type="button" aria-label="Copy URL to share" title="Copy URL to share">Copy URL to share</button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div class="lobby-attendant-section">
          <div class="lobby-attendant-head">
            <span class="reference-label">Attendants</span>
            <div class="lobby-setup-controls" aria-label="Lobby controls">
              <span class="lobby-attendant-count" aria-label="${game.players.length} of ${game.maxPlayers} players">${game.players.length}/${game.maxPlayers}</span>
              ${languageControl}
              <button
                class="lobby-chip-button ${game.teamUpEnabled ? "is-active" : ""}"
                id="lobbyTeamToggleButton"
                type="button"
                ${gameOptionsDisabled ? "disabled" : ""}
                aria-pressed="${game.teamUpEnabled ? "true" : "false"}"
                title="${isOwner ? "Toggle team-up mode" : "Only the owner can change team-up mode"}"
              >
                <span class="lobby-control-label">Teams</span>
                <strong>${game.teamUpEnabled ? "On" : "Off"}</strong>
              </button>
              ${
                isOwner
                  ? `
                    <button class="lobby-chip-button" id="lobbyGuideButton" type="button" aria-expanded="${state.lobbyGuideOpen ? "true" : "false"}">
                      <span class="lobby-control-label">Objects</span>
                      <strong>Guide</strong>
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
          <div
            class="lobby-attendant-arena ${game.teamUpEnabled ? "is-team-up" : ""} ${gridLayoutEnabled ? "is-grid-layout" : ""}"
            id="lobbyAttendantArena"
            data-team-up="${game.teamUpEnabled ? "true" : "false"}"
            data-grid-layout="${gridLayoutEnabled ? "true" : "false"}"
            style="${attendantArenaStyle}"
            aria-label="Game attendants"
          >
            ${game.teamUpEnabled ? lobbyAttendantTeamLabels(game.teams || []) : ""}
            ${lobbyAttendantTokens(game.players, me?.id, { readyToggleEnabled })}
          </div>
          <div class="lobby-arena-action-bar">
            <div class="lobby-ready-copy">
              ${
                isEnded
                  ? `
                    <strong>Game complete</strong>
                    <span>${winnerName ? escapeHtml(`${winnerName} won. `) : ""}Points are shown on avatars.</span>
                  `
                  : `
                    <strong>${me?.ready ? "You are ready" : "You are not ready"}</strong>
                    <span>Tap your avatar to switch.</span>
                  `
              }
            </div>
            <div class="lobby-arena-actions">
              ${
                isEnded
                  ? `
                    <span class="lobby-camera-chip is-ready">Final scores</span>
                    ${isOwner ? `<button class="primary-button lobby-small-action" id="restartButton" type="button">New game with group</button>` : ""}
                    <button class="secondary-button lobby-small-action" id="leaveGameButton" type="button">Leave game</button>
                  `
                  : `
                    <span class="lobby-camera-chip ${cameraReady ? "is-ready" : "is-needed"}">${escapeHtml(cameraMessage)}</span>
                    ${cameraReady ? "" : `<button class="secondary-button lobby-small-action" id="enableCameraButton" type="button">Enable camera</button>`}
                    ${
                      isOwner
                        ? `<button class="primary-button lobby-small-action" id="startButton" type="button" ${!game.allReady || game.status === "loading" ? "disabled" : ""}>Start game</button>`
                        : ""
                    }
                    ${
                      isOwner
                        ? `<button class="danger-button lobby-small-action" id="endGameButton" type="button">End game</button>`
                        : `<button class="secondary-button lobby-small-action" id="leaveGameButton" type="button">Leave game</button>`
                    }
                  `
              }
            </div>
          </div>
        </div>
      </div>
      ${guidePanel}
    </section>
  `;

  document.querySelector("#lobbyLanguageSelect")?.addEventListener("change", (event) => {
    updateLobbyGameOptions({ challengeLanguage: event.currentTarget.value });
  });
  document.querySelector("#lobbyTeamToggleButton")?.addEventListener("click", () => {
    updateLobbyGameOptions({ teamUpEnabled: !game.teamUpEnabled });
  });
  document.querySelector("#lobbyGuideButton")?.addEventListener("click", () => {
    state.lobbyGuideOpen = true;
    render();
  });
  const lobbyGuideDialog = document.querySelector("#lobbyGuideDialog");
  const closeLobbyGuide = () => {
    state.lobbyGuideOpen = false;
    render();
  };
  document.querySelector("#closeLobbyGuideButton")?.addEventListener("click", closeLobbyGuide);
  lobbyGuideDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeLobbyGuide();
  });
  lobbyGuideDialog?.addEventListener("click", (event) => {
    if (event.target !== lobbyGuideDialog) return;
    const bounds = lobbyGuideDialog.getBoundingClientRect();
    const clickedInside =
      event.clientX >= bounds.left &&
      event.clientX <= bounds.right &&
      event.clientY >= bounds.top &&
      event.clientY <= bounds.bottom;
    if (!clickedInside) closeLobbyGuide();
  });
  document.querySelector("#lobbyGuideForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const saved = await updateLobbyGameOptions({
      initialChallengeInput: String(new FormData(event.currentTarget).get("initialChallengeInput") || "").trim()
    });
    if (saved) closeLobbyGuide();
  });
  if (lobbyGuideDialog && !lobbyGuideDialog.open) lobbyGuideDialog.showModal();
  const meToken = document.querySelector(".lobby-attendant-token.is-me");
  if (readyToggleEnabled) {
    meToken?.addEventListener("click", () => setReady(!me.ready));
    meToken?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      setReady(!me.ready);
    });
  }
  document.querySelector("#enableCameraButton")?.addEventListener("click", enableCamera);
  document.querySelector("#copyUrlButton").addEventListener("click", async () => {
    try {
      await navigator.clipboard?.writeText(state.gameUrl);
      showMessage("Game URL copied.", "success");
    } catch {
      showMessage("Copy failed. Use the QR code or game ID to join.", "warning");
    }
  });
  document.querySelector("#startButton")?.addEventListener("click", startGame);
  document.querySelector("#endGameButton")?.addEventListener("click", openGameMenu);
  document.querySelector("#leaveGameButton")?.addEventListener("click", openGameMenu);
  document.querySelector("#restartButton")?.addEventListener("click", restartGame);
}

function ensureGameShell() {
  const screen = app.firstElementChild;
  if (screen?.classList.contains("game-screen")) return screen;

  app.innerHTML = `
    <section class="screen game-screen">
      <video id="cameraVideo" class="game-camera-video" autoplay playsinline muted></video>
      <div class="game-camera-shade"></div>
      <div id="urgencyAlert" class="urgency-alert" aria-hidden="true"></div>
      <div class="game-overlay" id="gameOverlay"></div>
    </section>
  `;

  return app.firstElementChild;
}

function renderGame() {
  const game = state.game;
  const countdown = countdownState(game);
  const countdownLeft = countdown?.left || 0;
  const isPaused = game.status === "paused";
  const isRoundActive = !isPaused && countdown?.mode === "round";
  const isUrgent = isRoundActive && countdownLeft > 0 && countdownLeft <= 10000;
  const alertDuration = `${alertFlashDuration(countdownLeft)}s`;
  const countdownText = countdown ? formatSeconds(countdownLeft) : isPaused ? "Paused" : "0.00s";
  const cameraMessage = isPaused
    ? "Game paused"
    : cameraState.error || (cameraState.stream ? "Camera ready" : "Starting camera");
  const cameraDisabled = !isRoundActive || !cameraState.stream || Boolean(cameraState.error) || cameraState.sending;
  const torchDisabled = !cameraState.stream || !cameraState.torchSupported || cameraState.torchChanging;
  const skip = game.currentRound?.skip || null;
  const skipDisabled = !isRoundActive || Boolean(skip?.voted);
  const torchTitle = !cameraState.stream
    ? "Camera is starting"
    : cameraState.torchSupported
      ? cameraState.torchOn
        ? "Turn flashlight off"
        : "Turn flashlight on"
      : "Flashlight is not available on this camera";
  const myTeam = game.teamUpEnabled
    ? (game.teamScores || []).find((team) => team.id === game.me?.teamId) || {
        id: game.me?.teamId,
        name: game.me?.teamName,
        color: game.me?.teamColor
      }
    : null;
  cameraDebug("render", "game", {
    roundStatus: game.currentRound?.status || null,
    countdownMode: countdown?.mode || null,
    sending: cameraState.sending,
    camera: describeCameraVideo(),
    stableShell: app.firstElementChild?.classList.contains("game-screen") || false,
    notifications: state.notifications.length
  });
  const gameScreen = ensureGameShell();
  const urgencyAlert = gameScreen.querySelector("#urgencyAlert");
  urgencyAlert.className = `urgency-alert ${isUrgent ? "is-visible" : ""}`;
  urgencyAlert.style.setProperty("--alert-duration", alertDuration);

  gameScreen.querySelector("#gameOverlay").innerHTML = `
    <button class="game-exit-button" id="gameMenuButton" type="button" aria-label="Game options" title="Game options">&#9881;</button>
    <header class="game-hud">
      <div class="game-hud-top">
        <span class="game-round-label">${escapeHtml(countdownLabel(game, countdown))}</span>
        <span class="round-time">${escapeHtml(countdownText)}</span>
        ${teamBadge(myTeam, { compact: true })}
      </div>
      <h1 class="game-target-word">${targetWordMarkup(game, countdown)}</h1>
      ${timerMarkup(countdown, { showChip: false })}
      <div class="last-chance-warning ${isUrgent ? "is-visible" : ""}" style="--alert-duration:${alertDuration}" aria-live="polite">
        <span>Last chance</span>
        <strong class="last-chance-time">${formatSeconds(countdownLeft)}</strong>
      </div>
      <div class="game-info-strip">
        ${isPaused ? `<span>Paused by owner</span>` : ""}
        ${countdown?.mode === "break" && game.lastResult?.message ? `<span>${escapeHtml(game.lastResult.message)}</span>` : ""}
        <span>${escapeHtml(cameraMessage)}</span>
        ${cameraState.torchError ? `<span>${escapeHtml(cameraState.torchError)}</span>` : ""}
        <span>${game.players.length}/${game.maxPlayers} players</span>
        <span>${game.itemQueueCount} backups</span>
      </div>
    </header>

    <footer class="game-bottom-bar">
      <ul class="game-score-strip" aria-label="Scores">
        ${gameScorePills(game)}
      </ul>
      <div class="game-action-row">
        <button
          class="secondary-button game-flash-button ${cameraState.torchOn ? "is-on" : ""}"
          id="toggleTorchButton"
          type="button"
          aria-pressed="${cameraState.torchOn ? "true" : "false"}"
          aria-label="${escapeHtml(torchTitle)}"
          title="${escapeHtml(torchTitle)}"
          ${torchDisabled ? "disabled" : ""}
        >
          <svg class="flashlight-icon" viewBox="0 0 256 256" aria-hidden="true" focusable="false">
            <path d="M184 16H72a16 16 0 0 0-16 16v45.33a16.12 16.12 0 0 0 3.2 9.6L80 114.67V224a16 16 0 0 0 16 16h64a16 16 0 0 0 16-16V114.67l20.8-27.74a16.12 16.12 0 0 0 3.2-9.6V32a16 16 0 0 0-16-16M72 32h112v24H72zm91.2 73.07a16.12 16.12 0 0 0-3.2 9.6V224H96V114.67a16.12 16.12 0 0 0-3.2-9.6L72 77.33V72h112v5.33ZM136 120v32a8 8 0 0 1-16 0v-32a8 8 0 0 1 16 0"></path>
          </svg>
        </button>
        <button
          class="secondary-button game-skip-button ${skip?.voted ? "is-voted" : ""}"
          id="skipRoundButton"
          type="button"
          title="${escapeHtml(skipButtonTitle(game))}"
          ${skipDisabled ? "disabled" : ""}
        >
          ${escapeHtml(skipButtonLabel(game))}
        </button>
        <button class="primary-button game-shutter-button" id="submitPhotoButton" type="button" ${cameraDisabled ? "disabled" : ""}>
          ${cameraState.sending ? "Checking..." : "Snap and verify"}
        </button>
      </div>
    </footer>
  `;

  document.querySelector("#submitPhotoButton").addEventListener("click", submitPhoto);
  document.querySelector("#skipRoundButton")?.addEventListener("click", voteSkipRound);
  document.querySelector("#toggleTorchButton")?.addEventListener("click", toggleTorch);
  document.querySelector("#gameMenuButton")?.addEventListener("click", openGameMenu);
  document.querySelector("#playTargetAudioButton")?.addEventListener("click", playTargetAudio);
  attachCameraStream();
}

function renderEnd() {
  const game = state.game;
  const isOwner = game.me?.id === game.ownerPlayerId;
  const winnerName = game.winner?.username || game.winner?.name || "Game complete";
  const finalRows = game.teamUpEnabled ? finalTeamScoreRows(game.teamScores || []) : playerRows(game.players);
  app.innerHTML = `
    <section class="screen end-layout">
      <div class="stack">
        ${renderNotice()}
        <div class="winner-banner">
          <span class="status-chip">${game.winner ? "winner" : "ended"}</span>
          <h1>${escapeHtml(winnerName)}</h1>
        </div>
        ${isOwner ? `<button class="primary-button" id="restartButton" type="button">New game with group</button>` : ""}
        <button class="secondary-button" id="leaveGameButton" type="button">Leave game</button>
      </div>
      <aside class="compact-panel stack">
        <h2>${game.teamUpEnabled ? "Final Team Leaderboard" : "Final Scores"}</h2>
        <ul class="score-list">${finalRows}</ul>
      </aside>
    </section>
  `;

  document.querySelector("#restartButton")?.addEventListener("click", restartGame);
  document.querySelector("#leaveGameButton").addEventListener("click", openGameMenu);
}

function render() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  const previousView = state.lastRenderedView;
  state.view = activeViewFromGame(state.game) || state.view;
  renderConnectionPill();
  document.body.classList.toggle("is-game-active", state.view === "game");
  if (state.view === "home") renderHome();
  if (state.view === "avatars") renderAvatarReview();
  if (state.view === "create") renderCreate();
  if (state.view === "join") renderJoin();
  if (state.view === "lobby") renderLobby();
  if (state.view === "game") renderGame();
  if (state.view === "end") renderEnd();
  if (state.view === "lobby") {
    startLobbyAttendantMotion();
  } else {
    stopLobbyAttendantMotion();
  }
  renderGlobalNotifications();
  if (previousView && previousView !== state.view) {
    window.scrollTo({ top: 0, left: 0 });
  }
  state.lastRenderedView = state.view;

  if (countdownState(state.game)) {
    updateCountdownDisplays();
    state.timerInterval = setInterval(updateCountdownDisplays, 25);
  }

  syncCameraWithView();
  syncBackgroundMusic();
}

async function submitPhoto() {
  cameraDebug("submit", "start", describeCameraVideo());
  if (cameraState.sending) return;
  const challengeId = state.game?.currentRound?.id || "";
  if (!challengeId) {
    showMessage("That challenge has already moved on.", "warning");
    return;
  }
  const imageDataUrl = captureVideoFrame();
  if (!imageDataUrl) return;
  const imageSize = imagePayloadInfo(imageDataUrl);

  cameraState.sending = true;
  const submitToken = cameraState.submitToken + 1;
  cameraState.submitToken = submitToken;
  cameraState.pendingSubmitToken = submitToken;
  state.notice = "";
  pushNotification("Photo sent. Checking...", "info");

  const response = await emitAck("submit_capture", {
    gameId: state.game.id,
    challengeId,
    imageDataUrl
  }, {
    timeoutMs: 45000
  });
  cameraDebug("submit", "ack", {
    ok: response.ok,
    ignored: response.ignored || false,
    error: response.error || "",
    submitToken,
    challengeId,
    imageSize,
    pendingSubmitToken: cameraState.pendingSubmitToken,
    sending: cameraState.sending,
    camera: describeCameraVideo()
  });
  if (response.ignored) {
    clearPendingSubmit();
    render();
    return;
  }
  if (!response.ok) {
    if (!cameraState.sending || cameraState.pendingSubmitToken !== submitToken) {
      cameraDebug("submit", "ignore stale ack error", {
        error: response.error || "",
        submitToken,
        pendingSubmitToken: cameraState.pendingSubmitToken
      });
      return;
    }
    clearPendingSubmit();
    showMessage(response.error, "danger");
    return;
  }
  render();
}

async function voteSkipRound() {
  const challengeId = state.game?.currentRound?.id || "";
  if (!challengeId) {
    showMessage("That challenge has already moved on.", "warning");
    return;
  }

  const response = await emitAck("skip_round", {
    gameId: state.game.id,
    challengeId
  });
  if (response.ignored) {
    render();
    return;
  }
  if (!response.ok) {
    showMessage(response.error || "Could not vote to skip.", "danger");
  }
}

function closePlayerNameDialog() {
  playerNameDialog.close();
}

function openPlayerNameDialog() {
  if (!state.online) {
    showMessage("You are offline.", "warning");
    return;
  }
  if (!state.game?.me) {
    showMessage("Join or create a game to change your name.", "warning");
    return;
  }

  const canEditName = state.game.status === "lobby";
  const placeholder = escapeHtml(ensureJoinNamePlaceholder());
  const currentName = escapeHtml(state.game.me.username || "");
  playerNameDialogContent.innerHTML = `
    <form class="game-menu-stack" id="playerNameDialogForm">
      <label class="field">
        <span>Player name</span>
        <div class="name-picker">
          <input class="text-input" name="playerName" data-random-name-target="playerName" autocomplete="nickname" maxlength="24" placeholder="${placeholder}" value="${currentName}" ${canEditName ? "autofocus" : "disabled"}>
          ${randomNameButtonMarkup("playerName", { disabled: !canEditName })}
        </div>
        <small class="field-note">${
          canEditName
            ? "Leave blank or tap the dice for a random name."
            : "Names can only be changed in the lobby."
        }</small>
      </label>
      <button class="secondary-button" type="submit" ${canEditName ? "" : "disabled"}>Save name</button>
    </form>
  `;

  playerNameDialog.showModal();
  setupRandomNamePicker("playerName");
  const input = playerNameDialog.querySelector("[name='playerName']");
  if (canEditName) input?.focus();
  playerNameDialog.querySelector("#playerNameDialogForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (await updatePlayerName(new FormData(event.currentTarget))) closePlayerNameDialog();
  });
}

async function openLeaderboard() {
  leaderboardDialog.showModal();
  if (!state.game) {
    leaderboardContent.innerHTML = `<p class="empty-state">Join or create a game to see the leaderboard.</p>`;
    return;
  }

  const rows = leaderboardRows(state.game);
  const gameIdMarkup = `
    <div class="leaderboard-game-id">
      <span>Game ID</span>
      <strong>${escapeHtml(state.game.id)}</strong>
    </div>
  `;
  leaderboardContent.innerHTML = rows
    ? `${gameIdMarkup}<ol class="score-list ${state.game.teamUpEnabled ? "team-leaderboard-list" : ""}">${rows}</ol>`
    : `${gameIdMarkup}<p class="empty-state">No players in this group yet.</p>`;
}

socket.on("connect", () => {
  updateConnection(true);
  if (!isAvatarReview) rejoinPreviousGame();
});

socket.on("disconnect", () => {
  updateConnection(false);
});

socket.on("game_state", (game) => {
  cameraDebug("socket", "game_state", {
    status: game.status,
    roundStatus: game.currentRound?.status || null,
    lastResult: game.lastResult?.status || null,
    camera: describeCameraVideo()
  });
  state.game = game;
  state.playerId = game.me?.id || state.playerId;
  if (game.me?.username) saveLastUsername(game.me.username);
  saveSession();
  render();
});

socket.on("round_started", ({ item, challengeId, languageCode, audioUrl }) => {
  cameraDebug("socket", "round_started", {
    challengeId,
    item,
    languageCode,
    hasAudio: Boolean(audioUrl),
    camera: describeCameraVideo()
  });
  clearPendingSubmit();
  state.notice = "";
  pushNotification(`Find ${languageCode ? `[${languageCode}] ` : ""}${item}.`, "target");
});

socket.on("round_result", (result) => {
  cameraDebug("socket", "round_result", {
    result,
    camera: describeCameraVideo()
  });
  clearPendingSubmit();
  state.notice = "";
  pushNotification(result.message, result.status);
});

socket.on("submission_result", (result) => {
  cameraDebug("socket", "submission_result", {
    result,
    camera: describeCameraVideo()
  });
  if (result.status !== "checking") {
    clearPendingSubmit();
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
  cameraDebug("socket", "capture_notice", {
    result,
    camera: describeCameraVideo()
  });
  if (result.playerId === state.playerId) {
    clearPendingSubmit();
  }
  state.notice = "";
  pushNotification(result.message, result.status);
});

socket.on("game_ended", ({ winner, message }) => {
  clearPendingSubmit();
  const gameEndedMessage = message || (winner ? `${winner.username || winner.name} wins.` : "Game ended.");
  playGameEndedSound(state.game?.id || "");
  render();
  showMessage(gameEndedMessage, "success");
});

socket.on("notice", ({ message }) => {
  showMessage(message);
});

socket.on("left_game", ({ message, preserveSession = false }) => {
  resetLocalGame(message || "You left the game.", { preserveSession });
});

leaderboardButton.addEventListener("click", openLeaderboard);
closeLeaderboardButton.addEventListener("click", () => leaderboardDialog.close());
closeGameMenuButton.addEventListener("click", closeGameMenu);
gameMenuDialog.addEventListener("cancel", closeGameMenu);
connectionPill.addEventListener("click", openPlayerNameDialog);
closePlayerNameDialogButton.addEventListener("click", closePlayerNameDialog);
playerNameDialog.addEventListener("cancel", closePlayerNameDialog);

document.addEventListener(
  "pointerdown",
  () => {
    unlockAudio().then((unlocked) => {
      if (!unlocked) return;
      syncBackgroundMusic();
      preloadBackgroundMusic(backgroundMusicMode());
    });
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
  syncBackgroundMusic();
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
