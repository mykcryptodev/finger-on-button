-- Add contract deposit tracking columns to game_players
ALTER TABLE public.game_players
ADD COLUMN IF NOT EXISTS deposit_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(78, 0), -- Store as wei
ADD COLUMN IF NOT EXISTS deposit_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deposit_block_number BIGINT;

-- Create index for deposit lookups
CREATE INDEX IF NOT EXISTS idx_game_players_deposit_tx ON public.game_players(deposit_tx_hash);

-- Add deposit requirement info to game_sessions
ALTER TABLE public.game_sessions
ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS entry_fee_wei NUMERIC(78, 0); -- Store as wei

-- Function to verify player has deposited to contract for game
CREATE OR REPLACE FUNCTION verify_player_deposit(
  p_session_id UUID,
  p_fid BIGINT,
  p_tx_hash TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_verified BOOLEAN;
BEGIN
  -- Check if player already has verified deposit for this game
  SELECT deposit_verified_at IS NOT NULL INTO v_verified
  FROM game_players
  WHERE session_id = p_session_id 
    AND fid = p_fid 
    AND deposit_tx_hash = p_tx_hash;
    
  RETURN COALESCE(v_verified, false);
END;
$$ LANGUAGE plpgsql;

-- Function to record player deposit
CREATE OR REPLACE FUNCTION record_player_deposit(
  p_session_id UUID,
  p_fid BIGINT,
  p_tx_hash TEXT,
  p_amount NUMERIC,
  p_block_number BIGINT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update the player's deposit info
  UPDATE game_players
  SET 
    deposit_tx_hash = p_tx_hash,
    deposit_amount = p_amount,
    deposit_verified_at = NOW(),
    deposit_block_number = p_block_number
  WHERE session_id = p_session_id AND fid = p_fid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to check if player can join game (has deposited)
CREATE OR REPLACE FUNCTION can_player_join_game(
  p_session_id UUID,
  p_fid BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_requires_deposit BOOLEAN;
  v_has_deposit BOOLEAN;
BEGIN
  -- Check if game requires deposit
  SELECT requires_deposit INTO v_requires_deposit
  FROM game_sessions
  WHERE id = p_session_id;
  
  -- If no deposit required, player can join
  IF NOT v_requires_deposit OR v_requires_deposit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if player has verified deposit
  SELECT deposit_verified_at IS NOT NULL INTO v_has_deposit
  FROM game_players
  WHERE session_id = p_session_id AND fid = p_fid;
  
  RETURN COALESCE(v_has_deposit, false);
END;
$$ LANGUAGE plpgsql;

-- Update RLS policies to check deposit status
CREATE POLICY "Players must have deposit to update game state" ON public.game_players
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 
      FROM game_sessions gs
      WHERE gs.id = game_players.session_id
      AND (
        NOT gs.requires_deposit 
        OR game_players.deposit_verified_at IS NOT NULL
      )
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.game_players.deposit_tx_hash IS 'Transaction hash of the player''s deposit to the smart contract';
COMMENT ON COLUMN public.game_players.deposit_amount IS 'Amount deposited in wei';
COMMENT ON COLUMN public.game_players.deposit_verified_at IS 'Timestamp when deposit was verified on-chain';
COMMENT ON COLUMN public.game_sessions.requires_deposit IS 'Whether players must deposit to the contract to join this game';
COMMENT ON COLUMN public.game_sessions.entry_fee_wei IS 'Required entry fee in wei for this game'; 