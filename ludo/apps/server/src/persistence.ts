import { Pool } from 'pg';
import type { GameState, Player } from '@ludo/game-engine';

export type PersistedRoom = { code: string; host: string; players: Player[]; state: GameState };
export type PersistedSession = { id: string; name: string; tokenHash: string };

export interface Persistence {
  init(): Promise<void>;
  saveRoom(room: PersistedRoom): Promise<void>;
  loadRooms(): Promise<PersistedRoom[]>;
  deleteRoom(code: string): Promise<void>;
  saveSession(session: PersistedSession): Promise<void>;
  loadSession(tokenHash: string): Promise<PersistedSession | null>;
  loadSessions?(): Promise<PersistedSession[]>;
  touchSession(id: string, name?: string): Promise<void>;
  close?(): Promise<void>;
}

export class MemoryPersistence implements Persistence {
  private rooms = new Map<string, PersistedRoom>();
  private sessionsByHash = new Map<string, PersistedSession>();
  private sessionsById = new Map<string, PersistedSession>();

  async init() { }
  async saveRoom(room: PersistedRoom) { this.rooms.set(room.code, structuredClone(room)); }
  async loadRooms() { return [...this.rooms.values()].map((room) => structuredClone(room)); }
  async deleteRoom(code: string) { this.rooms.delete(code); }

  async saveSession(session: PersistedSession) {
    const copy = structuredClone(session);
    this.sessionsByHash.set(session.tokenHash, copy);
    this.sessionsById.set(session.id, copy);
  }
  async loadSession(tokenHash: string) {
    const s = this.sessionsByHash.get(tokenHash);
    return s ? structuredClone(s) : null;
  }
  async loadSessions(): Promise<PersistedSession[]> {
    return [...this.sessionsByHash.values()].map((s) => structuredClone(s));
  }
  async touchSession(id: string, name?: string) {
    const s = this.sessionsById.get(id);
    if (s && name) {
      s.name = name;
    }
  }
}

export class PostgresPersistence implements Persistence {
  constructor(private readonly pool: Pool) { }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS player_sessions (
        id TEXT PRIMARY KEY,
        session_token_hash TEXT UNIQUE NOT NULL,
        username VARCHAR(16) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS game_rooms (
        id BIGSERIAL PRIMARY KEY,
        room_code VARCHAR(6) UNIQUE NOT NULL,
        host_player_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('lobby','playing','finished')),
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms(updated_at);`);
    await this.pool.query(`CREATE INDEX IF NOT EXISTS player_sessions_token_hash_idx ON player_sessions(session_token_hash);`);
  }

  async saveRoom(room: PersistedRoom) {
    await this.pool.query(
      `INSERT INTO game_rooms (room_code, host_player_id, status, snapshot)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (room_code) DO UPDATE
       SET host_player_id = EXCLUDED.host_player_id,
           status = EXCLUDED.status,
           snapshot = EXCLUDED.snapshot,
           updated_at = now()`,
      [room.code, room.host, room.state.status, JSON.stringify(room)]
    );
  }

  async loadRooms() {
    const result = await this.pool.query(
      `SELECT snapshot FROM game_rooms WHERE updated_at > now() - interval '24 hours'`
    );
    return result.rows.map((row) => row.snapshot as PersistedRoom);
  }

  async deleteRoom(code: string) {
    await this.pool.query(`DELETE FROM game_rooms WHERE room_code = $1`, [code]);
  }

  async saveSession(session: PersistedSession) {
    await this.pool.query(
      `INSERT INTO player_sessions (id, session_token_hash, username, last_seen_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE
       SET session_token_hash = EXCLUDED.session_token_hash,
           username = EXCLUDED.username,
           last_seen_at = now()`,
      [session.id, session.tokenHash, session.name]
    );
  }

  async loadSession(tokenHash: string) {
    const result = await this.pool.query(
      `SELECT id, username, session_token_hash FROM player_sessions WHERE session_token_hash = $1`,
      [tokenHash]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { id: row.id, name: row.username, tokenHash: row.session_token_hash };
  }

  async loadSessions(): Promise<PersistedSession[]> {
    const result = await this.pool.query(
      `SELECT id, username, session_token_hash FROM player_sessions WHERE last_seen_at > now() - interval '30 days'`
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.username,
      tokenHash: row.session_token_hash,
    }));
  }

  async touchSession(id: string, name?: string) {
    if (name) {
      await this.pool.query(
        `UPDATE player_sessions SET username = $2, last_seen_at = now() WHERE id = $1`,
        [id, name]
      );
    } else {
      await this.pool.query(
        `UPDATE player_sessions SET last_seen_at = now() WHERE id = $1`,
        [id]
      );
    }
  }

  async close() {
    await this.pool.end();
  }
}

export function createPersistence(databaseUrl = process.env.DATABASE_URL): Persistence {
  if (!databaseUrl) return new MemoryPersistence();
  const requiresSsl =
    databaseUrl.includes('supabase.co') ||
    databaseUrl.includes('pooler.supabase.com') ||
    databaseUrl.includes('render.com') ||
    databaseUrl.includes('sslmode=require') ||
    process.env.NODE_ENV === 'production';

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 5,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return new PostgresPersistence(pool);
}
