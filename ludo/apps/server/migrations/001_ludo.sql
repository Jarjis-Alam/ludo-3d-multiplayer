CREATE TABLE IF NOT EXISTS player_sessions (
  id TEXT PRIMARY KEY,
  session_token_hash TEXT UNIQUE NOT NULL,
  username VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_rooms (
  id BIGSERIAL PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,
  host_player_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('lobby','playing','finished')),
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_rooms_updated_at_idx ON game_rooms(updated_at);
CREATE INDEX IF NOT EXISTS player_sessions_token_hash_idx ON player_sessions(session_token_hash);
