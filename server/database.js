import { Pool } from 'pg';

function parseNode(nodes) {
  const [firstNode = ''] = String(nodes || '').split(',')
    .map((node) => node.trim()).filter(Boolean);
  const match = /^(?:\[([^\]]+)\]|([^:]+))(?::(\d+))?$/.exec(firstNode);
  if (!match) return { host: '', port: 5432 };
  return { host: match[1] || match[2], port: Number(match[3] || 5432) };
}

function createMemoryDatabase() {
  return {
    enabled: false,
    async saveGameResult() {},
    async close() {}
  };
}

/** Run explicitly with the migration credential before starting the worker. */
export async function ensureSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      rounds_played INTEGER NOT NULL DEFAULT 0,
      winner_id TEXT,
      winner_name TEXT
    );
    CREATE TABLE IF NOT EXISTS game_scores (
      game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      team_id TEXT,
      team_name TEXT,
      is_owner BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (game_id, player_id)
    );
    ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS team_id TEXT;
    ALTER TABLE game_scores ADD COLUMN IF NOT EXISTS team_name TEXT;
  `);
}

export async function createDatabase(config, logger = console, {
  poolFactory = (options) => new Pool(options),
  migrate = false
} = {}) {
  const postgres = config.postgres || {};
  const { host, port } = parseNode(postgres.nodes);
  const production = config.mode === 'production';
  if (!host || !postgres.user) {
    if (production) throw new Error('PostgreSQL is required in production.');
    logger.warn('Development result persistence is disabled.');
    return createMemoryDatabase();
  }
  const pool = poolFactory({
    host, port,
    user: postgres.user,
    password: postgres.password,
    database: postgres.database || postgres.user,
    ssl: postgres.ssl ? {
      rejectUnauthorized: true,
      ...(postgres.sslCa ? { ca: postgres.sslCa } : {})
    } : false,
    max: 4,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 10000,
    query_timeout: 12000,
    application_name: 'capture-quest-local-worker'
  });
  try {
    await pool.query('SELECT 1');
    if (migrate || postgres.migrateOnStart || !production) {
      await ensureSchema(pool);
    } else {
      // A worker credential only needs SELECT/INSERT/UPDATE on these tables.
      await pool.query('SELECT id FROM games LIMIT 0');
      await pool.query('SELECT player_id, team_id FROM game_scores LIMIT 0');
    }
  } catch (error) {
    await pool.end().catch(() => {});
    if (production || migrate) {
      throw new Error('PostgreSQL persistence is unavailable.', { cause: error });
    }
    logger.warn('Development PostgreSQL persistence is unavailable.');
    return createMemoryDatabase();
  }
  return {
    enabled: true,
    async saveGameResult(result) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // The cloud supplies a stable resultId for each run. Replays must not
        // change ended_at, overwrite scores, or duplicate a completed run.
        const recordId = result.resultId || result.gameId;
        const inserted = await client.query(`
          INSERT INTO games
            (id, ended_at, rounds_played, winner_id, winner_name)
          VALUES ($1, $2::timestamptz, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
          RETURNING id;
        `, [
          recordId,
          result.endedAt || new Date().toISOString(),
          result.roundsPlayed,
          result.winner?.id || null,
          result.winner?.username || result.winner?.name || null
        ]);
        if (inserted.rowCount > 0) {
          await client.query(`
            INSERT INTO game_scores
              (game_id, player_id, player_name, score,
               team_id, team_name, is_owner)
            SELECT $1, * FROM UNNEST(
              $2::text[], $3::text[], $4::integer[],
              $5::text[], $6::text[], $7::boolean[]
            );
          `, [
            recordId,
            result.players.map((player) => player.id),
            result.players.map((player) => player.username),
            result.players.map((player) => player.score),
            result.players.map((player) => player.teamId || null),
            result.players.map((player) => player.teamName || null),
            result.players.map((player) => Boolean(player.isOwner))
          ]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error('Result persistence failed.', { cause: error });
      } finally {
        client.release();
      }
    },
    async close() { await pool.end(); }
  };
}
