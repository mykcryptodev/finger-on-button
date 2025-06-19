# Mini App Farcaster User Setup Guide

## Overview
This guide explains how to automatically connect Farcaster users from your mini app to Supabase.

## What's Been Added

### 1. **Components**
- `src/components/NeynarSignIn.tsx` - Main component for Neynar authentication and profile display
- `src/components/providers/NeynarProvider.tsx` - Context provider for Neynar (if you need standalone setup)

### 2. **API Routes**
- `/api/farcaster/profile` - Fetch Farcaster profile by Ethereum address
- `/api/farcaster/social-graph` - Fetch user's followers/following

### 3. **Features**
- **Automatic Profile Enrichment**: When users connect their wallet, automatically fetch their Farcaster profile
- **Sign In with Neynar**: Allow users to connect their Farcaster account directly
- **Social Graph Integration**: Access user's followers and following data
- **Multi-chain Support**: Works with both Ethereum and Solana addresses

## Setup Steps

### 1. Get Neynar API Credentials

1. Go to [Neynar Dashboard](https://dev.neynar.com/app)
2. Create a new app or use an existing one
3. Copy your API Key and Client ID

### 2. Configure Environment Variables

Add these to your `.env.local` file:

```bash
# Neynar Configuration
NEYNAR_API_KEY=your_neynar_api_key_here
NEXT_PUBLIC_NEYNAR_CLIENT_ID=your_neynar_client_id_here
```

### 3. Add Authorized Origins (Important!)

In your Neynar app settings, add your app's URLs to the authorized origins:
- `http://localhost:3000` (for development)
- Your production URL

## How It Works

### Profile Enrichment Flow

1. **User connects wallet** → App checks if they have a Farcaster profile
2. **Profile found** → Display their Farcaster data (name, bio, pfp, followers)
3. **No profile** → Show option to connect with Farcaster

### Benefits

- **Instant User Profiles**: No need to build profiles from scratch
- **Social Graph**: Access to existing social connections
- **Verified Addresses**: See all verified ETH/SOL addresses
- **Rich User Data**: Bio, profile picture, follower counts

## Usage Example

To use the Neynar sign-in component in your app:

```tsx
import { NeynarSignIn } from '~/components/NeynarSignIn'

export default function ProfilePage() {
  return (
    <div>
      <h1>Your Profile</h1>
      <NeynarSignIn />
    </div>
  )
}
```

## API Usage

### Fetch Profile by Address
```typescript
const response = await fetch(`/api/farcaster/profile?address=${ethAddress}`)
const profile = await response.json()
```

### Fetch Social Graph
```typescript
// Get followers
const followers = await fetch(`/api/farcaster/social-graph?fid=${fid}&type=followers`)

// Get following
const following = await fetch(`/api/farcaster/social-graph?fid=${fid}&type=following`)
```

## Storing Farcaster Data in Supabase

If you want to store Farcaster user data in Supabase, create this table:

```sql
CREATE TABLE farcaster_users (
  fid BIGINT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  pfp_url TEXT,
  bio TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  verified_addresses JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on verified addresses for faster lookups
CREATE INDEX idx_farcaster_users_eth_addresses ON farcaster_users 
USING GIN ((verified_addresses->'eth_addresses'));
```

## Advanced Features

### 1. Personalized Content
Use the social graph to show content from users they follow:
```typescript
// Fetch content from followed users
const following = await fetchUserFollowing(userFid)
const followedFids = following.map(u => u.fid)
// Use these FIDs to filter content
```

### 2. Social Proof
Show mutual connections or common followers:
```typescript
// Check if users follow each other
const mutualFollows = await checkMutualFollows(fid1, fid2)
```

### 3. Multi-Wallet Support
Users can have multiple verified addresses:
```typescript
// Check all verified addresses
const verifiedAddresses = [
  ...profile.verified_addresses.eth_addresses,
  ...profile.verified_addresses.sol_addresses
]
```

## Best Practices

1. **Cache Profile Data**: Store fetched profiles to reduce API calls
2. **Handle Missing Profiles**: Not all addresses have Farcaster profiles
3. **Respect Rate Limits**: Neynar has API rate limits
4. **Update Profiles**: Periodically refresh cached profile data

## Troubleshooting

- **"No profile found"**: The address might not be verified on Farcaster
- **API errors**: Check your API key and rate limits
- **CORS issues**: Make sure to add your domain to Neynar's authorized origins

## Resources

- [Neynar Documentation](https://docs.neynar.com/)
- [Farcaster Protocol](https://docs.farcaster.xyz/)
- [Sign In With Neynar Guide](https://docs.neynar.com/docs/how-to-let-users-connect-farcaster-accounts-with-write-access-for-free-using-sign-in-with-neynar-siwn) 