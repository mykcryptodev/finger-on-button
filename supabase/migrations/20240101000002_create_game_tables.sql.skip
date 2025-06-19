-- Create game_sessions table
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'waiting', -- waiting, active, completed
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  winner_fid BIGINT REFERENCES public.farcaster_users(fid),
  total_players INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create game_players table for tracking who's in the game
CREATE TABLE IF NOT EXISTS public.game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  fid BIGINT NOT NULL REFERENCES public.farcaster_users(fid),
  username TEXT NOT NULL,
  display_name TEXT,
  pfp_url TEXT,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_heartbeat TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_pressing BOOLEAN DEFAULT false,
  is_eliminated BOOLEAN DEFAULT false,
  eliminated_at TIMESTAMP WITH TIME ZONE,
  placement INTEGER, -- 1st, 2nd, 3rd, etc.
  UNIQUE(session_id, fid)
);

-- Create indexes for performance
CREATE INDEX idx_game_players_session_id ON public.game_players(session_id);
CREATE INDEX idx_game_players_fid ON public.game_players(fid);
CREATE INDEX idx_game_players_heartbeat ON public.game_players(last_heartbeat);
CREATE INDEX idx_game_sessions_status ON public.game_sessions(status);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

-- Policies for game_sessions
CREATE POLICY "Anyone can read game sessions" ON public.game_sessions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage game sessions" ON public.game_sessions
  FOR ALL TO service_role
  USING (true);

-- Policies for game_players
CREATE POLICY "Anyone can read game players" ON public.game_players
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage game players" ON public.game_players
  FOR ALL TO service_role
  USING (true);

-- Function to get active game session
CREATE OR REPLACE FUNCTION get_active_game_session()
RETURNS TABLE (
  id UUID,
  status TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  total_players INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT gs.id, gs.status, gs.started_at, gs.total_players
  FROM game_sessions gs
  WHERE gs.status IN ('waiting', 'active')
  ORDER BY gs.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up stale players (heartbeat > 5 seconds old)
CREATE OR REPLACE FUNCTION cleanup_stale_players()
RETURNS void AS $$
BEGIN
  UPDATE game_players
  SET is_pressing = false,
      is_eliminated = true,
      eliminated_at = NOW()
  WHERE is_pressing = true
    AND is_eliminated = false
    AND last_heartbeat < NOW() - INTERVAL '5 seconds';
END;
$$ LANGUAGE plpgsql; 