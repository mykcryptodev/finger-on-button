# Multiple Games Setup

## Overview

The updated architecture supports three types of games:

1. **Daily Games** - Automatically created at 12pm ET each day
2. **Public Games** - Open games anyone can join
3. **Private Games** - Games with share codes that users create

## Architecture Changes

### Database Schema Updates

The `game_sessions` table now includes:
- `game_type`: 'public', 'daily', or 'private'
- `share_code`: Unique 6-character code for private games
- `scheduled_start_time`: For daily games
- `created_by_fid`: User who created the game
- `max_players`: Player limit (default 100)
- `is_featured`: For highlighting special games

### New Features

1. **Game Hub** - Browse and select games
2. **Share Links** - Direct links to specific games
3. **Game Codes** - 6-character codes for private games
4. **Player Limits** - Configurable max players per game
5. **Multiple Realtime Channels** - Separate channels per game

## Implementation Details

### GameServiceV2

The updated service manages multiple games:

```typescript
// Get today's daily game
const dailyGame = await gameService.getDailyGame()

// Create a private game
const privateGame = await gameService.createPrivateGame(userFid, maxPlayers)

// Join by share code
const game = await gameService.getGameByShareCode('ABC123')

// Get active games by type
const publicGames = await gameService.getActiveGames('public')
```

### Realtime Subscriptions

Each game has its own realtime channel:
- Channel name: `game:{gameId}`
- Separate subscriptions per game
- Automatic cleanup when switching games

### URL Structure

Games can be shared via URL:
```
https://yourapp.com?game={gameId}
```

Or joined by code in the UI.

## Scalability Considerations

### 1. **Connection Management**
- Each client only subscribes to one game at a time
- Channels are properly cleaned up when switching games
- Heartbeats are managed per game/player combination

### 2. **Database Indexes**
Created indexes for:
- `game_type` - Fast filtering by type
- `share_code` - Quick lookups for private games
- `scheduled_start_time` - Efficient daily game queries
- `created_by_fid` - User's created games

### 3. **Row Level Security**
- Users can create private games
- Anyone can read public/daily games
- Private games readable with share code

### 4. **Performance Tips**
- Consider archiving completed games after X days
- Implement pagination for game lists
- Add caching for frequently accessed games
- Monitor concurrent player limits

## Daily Game Automation

To automatically start daily games at 12pm ET:

### Option 1: Supabase Edge Function
```typescript
// Run every minute
Deno.serve(async () => {
  await gameService.checkDailyGameStart()
  return new Response('OK')
})
```

### Option 2: External Cron Job
Set up a cron job to call:
```
POST /api/check-daily-game
```

### Option 3: Client-Side Check
The game hub automatically creates today's daily game when accessed.

## Migration Steps

1. **Run the migration**:
   ```sql
   -- Apply: update_game_schema_for_multiple_games.sql
   ```

2. **Update your code**:
   - Replace `GameService` with `GameServiceV2`
   - Replace `FingerOnButton` with `FingerOnButtonV2`

3. **Enable new features**:
   - Daily games start automatically
   - Users can create private games
   - Share links work immediately

## Future Enhancements

- **Tournaments**: Multi-round bracket system
- **Scheduled Games**: Plan games in advance
- **Game Templates**: Different game modes/rules
- **Spectator Mode**: Watch without playing
- **Game History**: Track past games and stats
- **Leaderboards**: Global and friend rankings 