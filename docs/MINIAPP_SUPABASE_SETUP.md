# Mini App Supabase Integration

## Overview
Since your app runs exclusively as a Farcaster mini app, you already have user context. This setup automatically syncs the Farcaster user to your Supabase database.

## How It Works

1. **Automatic User Sync**: When the mini app loads, it automatically sends the user data to Supabase
2. **No Sign-in Required**: Users are already authenticated via Farcaster
3. **Simple Database Storage**: User profiles are stored in Supabase for your app's use

## What's Been Added

### 1. **Components**
- `src/components/MiniAppUserSync.tsx` - Automatically syncs mini app user to Supabase

### 2. **API Routes**
- `/api/connect-farcaster` - Handles the user sync to Supabase

### 3. **Database Migration**
- `supabase/migrations/create_farcaster_users.sql` - Creates the farcaster_users table

## Setup Steps

### 1. Run the Database Migration

Execute the SQL migration in your Supabase project:

```sql
-- This creates the farcaster_users table with:
-- fid (Farcaster ID)
-- username
-- display_name
-- pfp_url (profile picture)
-- last_seen
-- created_at
-- updated_at
```

You can run this in the Supabase SQL editor or using the Supabase CLI.

### 2. That's It!

The integration is automatic. When users open your mini app:
1. Their Farcaster profile is automatically synced to Supabase
2. The sync happens silently in the background
3. User data is available for your app to use

## Using the Data

You can query user data from Supabase:

```typescript
// Get a user by FID
const { data: user } = await supabase
  .from('farcaster_users')
  .select('*')
  .eq('fid', fid)
  .single()

// Get all users who have used your app
const { data: users } = await supabase
  .from('farcaster_users')
  .select('*')
  .order('last_seen', { ascending: false })
```

## Benefits

- **Zero Friction**: No sign-in process needed
- **Automatic Updates**: User data syncs every time they open the app
- **Simple Integration**: Just add the component and it works
- **Privacy Focused**: Only stores public Farcaster data

## Customization

You can modify the `MiniAppUserSync` component to:
- Show a welcome message on first visit
- Display sync status
- Add additional user data
- Trigger other actions after sync

## Security

- The API route uses server-side Supabase client
- RLS policies ensure data security
- Only public Farcaster data is stored 