# Mini App Farcaster Integration

## Overview

This integration automatically syncs Farcaster users to Supabase when they use your mini app.

## What Was Added

### 1. Components
- `src/components/MiniAppUserSync.tsx` - Automatically syncs mini app users to Supabase

### 2. API Routes  
- `src/app/api/connect-farcaster/route.ts` - Handles syncing user data to Supabase

### 3. Database
- `farcaster_users` table in Supabase stores user profiles

### 4. Layout Integration
- `MiniAppUserSync` component added to `src/app/layout.tsx`

## How It Works

1. User opens the mini app in Farcaster
2. `MiniAppUserSync` component detects the user context
3. Sends user data (fid, username, display name, profile picture) to API
4. API upserts the data to Supabase `farcaster_users` table
5. User is now tracked in your database

## Database Schema

```sql
CREATE TABLE public.farcaster_users (
  fid BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT, 
  pfp_url TEXT,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## No Configuration Required

The integration works automatically - no sign-in UI or user action needed! 