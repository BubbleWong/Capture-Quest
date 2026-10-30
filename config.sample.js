export default {
  mode: "development",
  postgres: {
    nodes: "127.0.0.1:5432",
    user: "capture_quest",
    password: "replace-me",
    database: "capture_quest",
    ssl: false,
    sslCa: "",
    sslServerName: "",
    migrateOnStart: false
  },
  openRouter: {
    apiKey: "",
    model: "openai/gpt-5.4-mini",
    visionModel: "google/gemini-3.5-flash-lite",
    ttsModel: "google/gemini-3.1-flash-tts-preview",
    ttsVoice: "Kore",
    ttsResponseFormat: "pcm",
    baseUrl: "https://openrouter.ai/api/v1",
    appTitle: "Capture Quest",
    referer: "https://cq.bubbleh.com",
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
  localWorker: {
    baseUrl: "https://cq.bubbleh.com",
    token: "",
    workerId: "rio",
    spoolDirectory: "/var/lib/capture-quest/results",
    concurrency: 2,
    pollIntervalMs: 3000,
    requestTimeoutMs: 15000
  },
};
