export default {
  mode: "development",
  port: 3000,
  publicBaseUrl: "",
  game: {
    maxPlayers: 50,
    normalRounds: 5,
    objectTimeoutMs: 120000,
    nextRoundDelayMs: 5000,
    itemBatchSize: 20,
    refillThreshold: 5
  },
  postgres: {
    nodes: "127.0.0.1:5432",
    user: "capture_quest",
    password: "replace-me",
    database: "capture_quest",
    ssl: false
  },
  openRouter: {
    apiKey: "",
    model: "openai/gpt-5.4-mini",
    visionModel: "google/gemini-3.1-flash-lite-preview",
    ttsModel: "google/gemini-3.1-flash-tts-preview",
    ttsVoice: "Kore",
    ttsResponseFormat: "pcm",
    baseUrl: "https://openrouter.ai/api/v1",
    appTitle: "Capture Quest",
    referer: "http://localhost:3000",
    mockWhenMissingKey: true
  },
  s3: {
    enabled: false,
    endpointUrl: "https://s3.example.com",
    region: "us-east-1",
    accessKeyId: "fake-s3-access-key",
    secretAccessKey: "fake-s3-secret-key",
    bucket: "capture-quest-tts",
    publicBaseUrl: "",
    forcePathStyle: true
  },
  cloudflare: {
    enabled: false,
    token: "fake-cloudflare-tunnel-token",
    domain: "cq-dev.example.com",
    command: "cloudflared",
    url: "http://127.0.0.1:3000"
  },
  logging: {
    gameEvents: false
  }
};
