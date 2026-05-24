export default {
  port: 3000,
  publicBaseUrl: "http://localhost:3000",
  game: {
    maxPlayers: 20,
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
    baseUrl: "https://openrouter.ai/api/v1",
    appTitle: "Capture Quest",
    referer: "http://localhost:3000",
    mockWhenMissingKey: true
  }
};
