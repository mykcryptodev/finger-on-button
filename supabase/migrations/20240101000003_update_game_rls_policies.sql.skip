-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Service role can manage game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Anyone can read game players" ON public.game_players;
DROP POLICY IF EXISTS "Service role can manage game players" ON public.game_players;

-- Create new policies for game_sessions
CREATE POLICY "Anyone can read game sessions" ON public.game_sessions
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can create game sessions" ON public.game_sessions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update game sessions" ON public.game_sessions
  FOR UPDATE TO anon
  USING (true);

-- Create new policies for game_players
CREATE POLICY "Anyone can read game players" ON public.game_players
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Anon can insert game players" ON public.game_players
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can update game players" ON public.game_players
  FOR UPDATE TO anon
  USING (true); 