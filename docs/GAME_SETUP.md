# Finger on the Button Game Setup

## Overview

"Finger on the Button" is a multiplayer game built as a Farcaster Mini App using Supabase's realtime database. Players must hold down a big red button, and the last player to let go wins!

## Game Architecture

### Components

1. **FingerOnButton** (`src/components/game/FingerOnButton.tsx`)
   - Main game component that manages game state
   - Handles session creation and player joining
   - Subscribes to realtime updates

2. **GameButton** (`src/components/game/GameButton.tsx`)
   - The big red button component
   - Handles touch/mouse events
   - Sends heartbeats while pressed
   - Shows hold duration

3. **GameLobby** (`src/components/game/GameLobby.tsx`)
   - Pre-game waiting room
   - Shows game rules
   - Lists players waiting to start
   - Start button (requires 2+ players)

4. **PlayersList** (`src/components/game/PlayersList.tsx`)
   - Displays all players in the game
   - Shows active/eliminated status
   - Real-time updates via Supabase

5. **GameOver** (`src/components/game/GameOver.tsx`)
   - Shows winner and final rankings
   - Game statistics
   - New game button

### Services

**GameService** (`src/lib/game/gameService.ts`)
- Handles all Supabase interactions
- Manages realtime subscriptions
- Heartbeat system for detecting disconnections
- Game state management

## Database Schema

### Tables

1. **game_sessions**
   - `id`: UUID (primary key)
   - `status`: waiting | active | completed
   - `started_at`: timestamp
   - `ended_at`: timestamp
   - `winner_fid`: reference to farcaster_users
   - `total_players`: integer
   - `created_at`: timestamp
   - `updated_at`: timestamp

2. **game_players**
   - `id`: UUID (primary key)
   - `session_id`: reference to game_sessions
   - `fid`: reference to farcaster_users
   - `username`: text
   - `display_name`: text
   - `pfp_url`: text
   - `joined_at`: timestamp
   - `last_heartbeat`: timestamp
   - `is_pressing`: boolean
   - `is_eliminated`: boolean
   - `eliminated_at`: timestamp
   - `placement`: integer (1st, 2nd, etc.)

### Database Functions

1. **get_active_game_session()**
   - Returns the current active or waiting game session

2. **cleanup_stale_players()**
   - Marks players as eliminated if heartbeat > 5 seconds old

## Game Mechanics

### Heartbeat System
- Players send heartbeats every 2 seconds while holding the button
- If heartbeat stops for 5+ seconds, player is eliminated
- Prevents cheating and handles disconnections

### Game Flow
1. **Lobby Phase** (`status: waiting`)
   - Players join the lobby
   - Need minimum 2 players to start
   - Any player can start the game

2. **Active Game** (`status: active`)
   - Players press and hold the button
   - Release = elimination
   - Real-time updates show who's still holding
   - Last player holding wins

3. **Game Over** (`status: completed`)
   - Winner is crowned
   - Shows final rankings
   - Players can start a new game

## Setup Instructions

### 1. Database Setup

Run the migrations in order:

```bash
# Create user tables
supabase db push supabase/migrations/create_farcaster_users.sql

# Create game tables
supabase db push supabase/migrations/create_game_tables.sql

# Update RLS policies
supabase db push supabase/migrations/update_game_rls_policies.sql
```

### 2. Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_MINI_APP_NAME="Finger on the Button"
NEXT_PUBLIC_MINI_APP_DESCRIPTION="Hold the button longer than everyone else to win!"
NEXT_PUBLIC_MINI_APP_PRIMARY_CATEGORY="game"
NEXT_PUBLIC_MINI_APP_TAGS="game,multiplayer,realtime"
```

### 3. Enable Realtime

In Supabase Dashboard:
1. Go to Database → Replication
2. Enable replication for:
   - `game_sessions` table
   - `game_players` table

### 4. Test the Game

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open multiple browser windows/tabs
3. Each tab represents a different player
4. Join the game and test multiplayer functionality

## Troubleshooting

### Players not updating in real-time
- Check if realtime is enabled for the tables
- Verify RLS policies allow read access
- Check browser console for WebSocket errors

### Heartbeat failures
- Ensure RLS policies allow updates
- Check network stability
- Verify Supabase connection

### Game won't start
- Need at least 2 players in lobby
- Check if previous game session is stuck
- May need to manually update session status in database

## Future Enhancements

- Tournament mode with brackets
- Leaderboards and statistics
- Power-ups or special events
- Custom game settings (min players, time limits)
- Achievement system
- Social sharing of wins 