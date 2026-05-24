import { Pool } from "pg";

function parseNode(nodes) {
  const [firstNode = ""] = String(nodes || "").split(",").map((node) => node.trim()).filter(Boolean);
  const [host, portText] = firstNode.split(":");
  return {
    host,
    port: portText ? Number(portText) : 5432
  };
}

function createMemoryDatabase() {
  const completedGames = [];

  return {
    enabled: false,
    async saveGameResult(result) {
      completedGames.push({
        ...result,
        endedAt: new Date().toISOString()
      });
    }
  };
}

async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      rounds_played INTEGER NOT NULL DEFAULT 0,
      winner_id TEXT,
      winner_name TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_scores (
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (game_id, player_id)
    );
  `);
}

export async function createDatabase(config, logger = console) {
  const postgres = config.postgres || {};
  const { host, port } = parseNode(postgres.nodes);

  if (!host || !postgres.user) {
    logger.warn("Postgres is not configured. Completed games will be stored in memory for this run.");
    return createMemoryDatabase();
  }

  const pool = new Pool({
    host,
    port,
    user: postgres.user,
    password: postgres.password,
    database: postgres.database || postgres.user,
    ssl: postgres.ssl ? { rejectUnauthorized: false } : false,
    max: 8,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000
  });

  try {
    await pool.query("SELECT 1");
    await ensureSchema(pool);
  } catch (error) {
    logger.warn(`Postgres connection failed (${error.message}). Using in-memory score storage for this run.`);
    await pool.end().catch(() => {});
    return createMemoryDatabase();
  }

  return {
    enabled: true,
    async saveGameResult(result) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `
            INSERT INTO games (id, ended_at, rounds_played, winner_id, winner_name)
            VALUES ($1, NOW(), $2, $3, $4)
            ON CONFLICT (id)
            DO UPDATE SET
              ended_at = EXCLUDED.ended_at,
              rounds_played = EXCLUDED.rounds_played,
              winner_id = EXCLUDED.winner_id,
              winner_name = EXCLUDED.winner_name;
          `,
          [result.gameId, result.roundsPlayed, result.winner?.id || null, result.winner?.username || null]
        );

        for (const player of result.players) {
          await client.query(
            `
              INSERT INTO game_scores (game_id, player_id, player_name, score, is_owner)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (game_id, player_id)
              DO UPDATE SET
                player_name = EXCLUDED.player_name,
                score = EXCLUDED.score,
                is_owner = EXCLUDED.is_owner;
            `,
            [result.gameId, player.id, player.username, player.score, player.isOwner]
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };
}
