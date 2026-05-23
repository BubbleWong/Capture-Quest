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
    },
    async getLeaderboard(limit = 25) {
      const rows = new Map();
      for (const game of completedGames) {
        for (const player of game.players) {
          const current = rows.get(player.username) || {
            player_name: player.username,
            total_score: 0,
            games_played: 0,
            wins: 0
          };
          current.total_score += player.score;
          current.games_played += 1;
          if (game.winner?.id === player.id) current.wins += 1;
          rows.set(player.username, current);
        }
      }
      return [...rows.values()]
        .sort((a, b) => b.total_score - a.total_score || b.wins - a.wins || a.player_name.localeCompare(b.player_name))
        .slice(0, limit);
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
    async getLeaderboard(limit = 25) {
      const { rows } = await pool.query(
        `
          SELECT
            gs.player_name,
            SUM(gs.score)::INTEGER AS total_score,
            COUNT(*)::INTEGER AS games_played,
            SUM(CASE WHEN gs.player_id = g.winner_id THEN 1 ELSE 0 END)::INTEGER AS wins
          FROM game_scores gs
          JOIN games g ON g.id = gs.game_id
          GROUP BY gs.player_name
          ORDER BY total_score DESC, wins DESC, player_name ASC
          LIMIT $1;
        `,
        [limit]
      );
      return rows;
    },
    async close() {
      await pool.end();
    }
  };
}
