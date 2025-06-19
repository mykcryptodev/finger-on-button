-- Create farcaster_users table
CREATE TABLE IF NOT EXISTS public.farcaster_users (
  fid BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_farcaster_users_username ON public.farcaster_users(username);

-- Enable Row Level Security
ALTER TABLE public.farcaster_users ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows authenticated users to read all farcaster users
CREATE POLICY "Allow authenticated users to read farcaster users" ON public.farcaster_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a policy that allows the service role to insert/update
CREATE POLICY "Allow service role to manage farcaster users" ON public.farcaster_users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_farcaster_users_updated_at
  BEFORE UPDATE ON public.farcaster_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at(); 