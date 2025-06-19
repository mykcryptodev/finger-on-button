-- Add countdown_ends_at column to game_sessions table for countdown feature
ALTER TABLE public.game_sessions 
ADD COLUMN IF NOT EXISTS countdown_ends_at TIMESTAMP WITH TIME ZONE;

-- Create index for countdown queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_countdown ON public.game_sessions(countdown_ends_at);

-- Update the game status type to include 'starting' status
-- Note: PostgreSQL doesn't have enum modification, so we'll handle this at the application level 