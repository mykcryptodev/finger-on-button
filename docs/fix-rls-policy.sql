-- Run this in your Supabase SQL editor to fix the RLS policy issue

-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Allow service role to manage farcaster users" ON public.farcaster_users;

-- Create a new policy that allows anon users to insert/update their own records
CREATE POLICY "Allow anon to upsert farcaster users" ON public.farcaster_users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon to update as well
CREATE POLICY "Allow anon to update farcaster users" ON public.farcaster_users
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Verify the policies
SELECT * FROM pg_policies WHERE tablename = 'farcaster_users'; 