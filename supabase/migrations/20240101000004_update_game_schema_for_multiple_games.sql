-- Add new columns to game_sessions for multiple game support
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'public', -- 'public', 'daily', 'private'
ADD COLUMN IF NOT EXISTS created_by_fid BIGINT REFERENCES public.farcaster_users(fid),
ADD COLUMN IF NOT EXISTS share_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS max_players INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Create index for game lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_type ON public.game_sessions(game_type);
CREATE INDEX IF NOT EXISTS idx_game_sessions_share_code ON public.game_sessions(share_code);
CREATE INDEX IF NOT EXISTS idx_game_sessions_scheduled_start ON public.game_sessions(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_by ON public.game_sessions(created_by_fid);

-- Function to generate unique share codes
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create daily game
CREATE OR REPLACE FUNCTION get_or_create_daily_game(scheduled_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
  id UUID,
  status TEXT,
  game_type TEXT,
  scheduled_start_time TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  total_players INTEGER
) AS $$
DECLARE
  game_id UUID;
BEGIN
  -- Check if daily game exists for this date
  SELECT gs.id INTO game_id
  FROM game_sessions gs
  WHERE gs.game_type = 'daily'
    AND DATE(gs.scheduled_start_time AT TIME ZONE 'America/New_York') = DATE(scheduled_date AT TIME ZONE 'America/New_York')
  LIMIT 1;

  -- If not found, create it
  IF game_id IS NULL THEN
    INSERT INTO game_sessions (
      game_type,
      scheduled_start_time,
      is_featured,
      status
    ) VALUES (
      'daily',
      scheduled_date,
      true,
      CASE 
        WHEN scheduled_date <= NOW() THEN 'waiting'
        ELSE 'scheduled'
      END
    )
    RETURNING game_sessions.id INTO game_id;
  END IF;

  -- Return the game
  RETURN QUERY
  SELECT 
    gs.id,
    gs.status,
    gs.game_type,
    gs.scheduled_start_time,
    gs.started_at,
    gs.total_players
  FROM game_sessions gs
  WHERE gs.id = game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create private game
CREATE OR REPLACE FUNCTION create_private_game(creator_fid BIGINT, max_players_count INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  share_code TEXT,
  status TEXT,
  game_type TEXT,
  created_by_fid BIGINT,
  max_players INTEGER
) AS $$
DECLARE
  new_share_code TEXT;
  attempts INTEGER := 0;
  game_id UUID;
BEGIN
  -- Generate unique share code
  LOOP
    new_share_code := generate_share_code();
    attempts := attempts + 1;
    
    -- Try to insert with this code
    BEGIN
      INSERT INTO game_sessions (
        game_type,
        created_by_fid,
        share_code,
        max_players,
        status
      ) VALUES (
        'private',
        creator_fid,
        new_share_code,
        max_players_count,
        'waiting'
      )
      RETURNING game_sessions.id INTO game_id;
      
      EXIT; -- Success, exit loop
    EXCEPTION
      WHEN unique_violation THEN
        IF attempts > 10 THEN
          RAISE EXCEPTION 'Could not generate unique share code';
        END IF;
        -- Continue loop to try again
    END;
  END LOOP;

  -- Return the created game
  RETURN QUERY
  SELECT 
    gs.id,
    gs.share_code,
    gs.status,
    gs.game_type,
    gs.created_by_fid,
    gs.max_players
  FROM game_sessions gs
  WHERE gs.id = game_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get active games by type
CREATE OR REPLACE FUNCTION get_active_games(
  game_type_filter TEXT DEFAULT NULL,
  include_scheduled BOOLEAN DEFAULT false
)
RETURNS TABLE (
  id UUID,
  status TEXT,
  game_type TEXT,
  share_code TEXT,
  scheduled_start_time TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  total_players INTEGER,
  max_players INTEGER,
  created_by_fid BIGINT,
  is_featured BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gs.id,
    gs.status,
    gs.game_type,
    gs.share_code,
    gs.scheduled_start_time,
    gs.started_at,
    gs.total_players,
    gs.max_players,
    gs.created_by_fid,
    gs.is_featured
  FROM game_sessions gs
  WHERE (game_type_filter IS NULL OR gs.game_type = game_type_filter)
    AND (
      gs.status IN ('waiting', 'active')
      OR (include_scheduled AND gs.status = 'scheduled')
    )
  ORDER BY 
    gs.is_featured DESC,
    gs.scheduled_start_time DESC NULLS LAST,
    gs.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies for new game types
CREATE POLICY "Users can create private games" ON public.game_sessions
  FOR INSERT TO anon
  WITH CHECK (game_type = 'private');

CREATE POLICY "Users can join games by share code" ON public.game_sessions
  FOR SELECT TO anon
  USING (
    status IN ('waiting', 'active', 'completed')
    AND (
      game_type IN ('public', 'daily')
      OR (game_type = 'private' AND share_code IS NOT NULL)
    )
  ); 