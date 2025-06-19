import { createClient } from '~/utils/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type GameType = 'public' | 'daily' | 'private'
export type GameStatus = 'scheduled' | 'waiting' | 'starting' | 'active' | 'completed'

export interface GameSession {
  id: string
  status: GameStatus
  game_type: GameType
  share_code: string | null
  scheduled_start_time: string | null
  started_at: string | null
  countdown_ends_at: string | null
  ended_at: string | null
  winner_fid: number | null
  total_players: number
  max_players: number
  created_by_fid: number | null
  is_featured: boolean
}

export interface GamePlayer {
  id: string
  session_id: string
  fid: number
  username: string
  display_name: string | null
  pfp_url: string | null
  joined_at: string
  last_heartbeat: string
  is_pressing: boolean
  is_eliminated: boolean
  eliminated_at: string | null
  placement: number | null
}

export class GameService {
  private supabase = createClient()
  private channels: Map<string, RealtimeChannel> = new Map()
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map()

  // Get today's daily game
  async getTodaysDailyGame(): Promise<GameSession | null> {
    const { data, error } = await this.supabase
      .rpc('get_todays_daily_game')
      .single()

    if (error || !data) return null
    return data as GameSession
  }

  // Create today's daily game if it doesn't exist
  async createTodaysDailyGame(): Promise<GameSession | null> {
    const { data, error } = await this.supabase
      .rpc('create_todays_daily_game')
      .single()

    if (error || !data) return null
    return data as GameSession
  }

  // Get active games by type
  async getActiveGames(gameType?: GameType, includeScheduled = false): Promise<GameSession[]> {
    const { data, error } = await this.supabase
      .rpc('get_active_games', { 
        game_type_filter: gameType,
        include_scheduled: includeScheduled
      })

    if (error) {
      console.error('Error fetching active games:', error)
      return []
    }

    return data || []
  }

  // Get game by share code
  async getGameByShareCode(shareCode: string): Promise<GameSession | null> {
    const { data, error } = await this.supabase
      .from('game_sessions')
      .select('*')
      .eq('share_code', shareCode)
      .single()

    if (error || !data) return null
    return data
  }

  // Create a private game
  async createPrivateGame(creatorFid: number): Promise<GameSession | null> {
    const { data, error } = await this.supabase
      .rpc('create_private_game', { creator_fid: creatorFid })
      .single()

    if (error) {
      console.error('Error creating private game:', error)
      return null
    }

    return data as GameSession
  }

  // Create a public game
  async createPublicGame(): Promise<GameSession | null> {
    const { data, error } = await this.supabase
      .from('game_sessions')
      .insert({ 
        status: 'waiting',
        game_type: 'public'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating public game:', error)
      return null
    }

    return data
  }

  async joinGame(sessionId: string, player: {
    fid: number
    username: string
    display_name?: string
    pfp_url?: string
  }): Promise<GamePlayer | null> {
    // Check if game is full
    const { data: session } = await this.supabase
      .from('game_sessions')
      .select('total_players, max_players')
      .eq('id', sessionId)
      .single()

    if (session && session.total_players >= session.max_players) {
      console.error('Game is full')
      return null
    }

    // First check if player already exists in this game
    const { data: existingPlayer } = await this.supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('fid', player.fid)
      .single()

    if (existingPlayer) {
      // Player already exists, update their heartbeat and return them
      await this.supabase
        .from('game_players')
        .update({ 
          last_heartbeat: new Date().toISOString(),
          // Reset elimination status if they're rejoining
          is_eliminated: existingPlayer.is_eliminated && existingPlayer.eliminated_at ? existingPlayer.is_eliminated : false
        })
        .eq('id', existingPlayer.id)
      
      return existingPlayer
    }

    // Insert new player
    const { data, error } = await this.supabase
      .from('game_players')
      .insert({
        session_id: sessionId,
        fid: player.fid,
        username: player.username,
        display_name: player.display_name,
        pfp_url: player.pfp_url,
        is_pressing: false,
        is_eliminated: false,
        last_heartbeat: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error joining game:', error)
      return null
    }

    // Update player count - this should trigger the real-time subscription
    await this.updatePlayerCount(sessionId)

    return data
  }

  async startPressing(sessionId: string, fid: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('game_players')
      .update({ 
        is_pressing: true,
        last_heartbeat: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('fid', fid)
      .eq('is_eliminated', false)

    return !error
  }

  async stopPressing(sessionId: string, fid: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('game_players')
      .update({ 
        is_pressing: false,
        is_eliminated: true,
        eliminated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('fid', fid)

    if (!error) {
      await this.checkForWinner(sessionId)
    }

    return !error
  }

  async sendHeartbeat(sessionId: string, fid: number): Promise<boolean> {
    const { error } = await this.supabase
      .from('game_players')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('session_id', sessionId)
      .eq('fid', fid)
      .eq('is_pressing', true)
      .eq('is_eliminated', false)

    return !error
  }

  startHeartbeat(sessionId: string, fid: number, onFailure?: () => void) {
    const key = `${sessionId}-${fid}`
    
    // Clear any existing heartbeat
    this.stopHeartbeat(sessionId, fid)
    
    // Send heartbeat every 2 seconds
    const interval = setInterval(async () => {
      const success = await this.sendHeartbeat(sessionId, fid)
      if (!success && onFailure) {
        this.stopHeartbeat(sessionId, fid)
        onFailure()
      }
    }, 2000)
    
    this.heartbeatIntervals.set(key, interval)
  }

  stopHeartbeat(sessionId: string, fid: number) {
    const key = `${sessionId}-${fid}`
    const interval = this.heartbeatIntervals.get(key)
    
    if (interval) {
      clearInterval(interval)
      this.heartbeatIntervals.delete(key)
    }
  }

  async getActivePlayers(sessionId: string): Promise<GamePlayer[]> {
    const { data, error } = await this.supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .eq('is_eliminated', false)
      .order('joined_at', { ascending: true })

    if (error) {
      console.error('Error fetching players:', error)
      return []
    }

    return data || []
  }

  async getAllPlayers(sessionId: string): Promise<GamePlayer[]> {
    const { data, error } = await this.supabase
      .from('game_players')
      .select('*')
      .eq('session_id', sessionId)
      .order('joined_at', { ascending: true }) // Primary sort by join order for stability

    if (error) {
      console.error('Error fetching all players:', error)
      return []
    }

    if (!data) return []

    // Sort players with stable ordering:
    // 1. Active players first (not eliminated)
    // 2. Then eliminated players by elimination order
    // 3. Within each group, maintain join order for stability
    const sortedPlayers = data.sort((a, b) => {
      // If one is eliminated and other is not, active player comes first
      if (a.is_eliminated !== b.is_eliminated) {
        return a.is_eliminated ? 1 : -1
      }
      
      // If both are eliminated, sort by placement (winner first) then elimination time
      if (a.is_eliminated && b.is_eliminated) {
        // If one has placement and other doesn't, placed player comes first
        if (a.placement !== null && b.placement === null) return -1
        if (a.placement === null && b.placement !== null) return 1
        
        // If both have placements, sort by placement (1st place first)
        if (a.placement !== null && b.placement !== null) {
          return a.placement - b.placement
        }
        
        // If neither has placement, sort by elimination time (most recent first)
        if (a.eliminated_at && b.eliminated_at) {
          return new Date(b.eliminated_at).getTime() - new Date(a.eliminated_at).getTime()
        }
      }
      
      // For active players or as fallback, maintain join order
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    })

    console.log('Players sorted:', sortedPlayers.map(p => `${p.username}(${p.is_eliminated ? 'eliminated' : 'active'})`))
    return sortedPlayers
  }

  subscribeToGame(
    sessionId: string,
    onPlayersUpdate: (players: GamePlayer[]) => void,
    onSessionUpdate: (session: GameSession) => void
  ) {
    // Unsubscribe from any existing channel for this session
    this.unsubscribeFromGame(sessionId)

    console.log(`Setting up real-time subscription for game: ${sessionId}`)

    const channel = this.supabase
      .channel(`game:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_players',
          filter: `session_id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('Players table change detected:', payload.eventType, (payload.new as any)?.username || (payload.old as any)?.username)
          const players = await this.getAllPlayers(sessionId)
          onPlayersUpdate(players)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`
        },
        async (payload) => {
          console.log('Game session change detected:', payload.eventType, payload.new)
          if (payload.new) {
            onSessionUpdate(payload.new as GameSession)
          }
        }
      )
      .subscribe((status) => {
        console.log(`Subscription status for game ${sessionId}:`, status)
      })

    this.channels.set(sessionId, channel)
  }

  unsubscribeFromGame(sessionId: string) {
    const channel = this.channels.get(sessionId)
    if (channel) {
      this.supabase.removeChannel(channel)
      this.channels.delete(sessionId)
    }
  }

  private async updatePlayerCount(sessionId: string) {
    const { data: count } = await this.supabase
      .from('game_players')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)

    if (count !== null) {
      await this.supabase
        .from('game_sessions')
        .update({ total_players: count })
        .eq('id', sessionId)
    }
  }

  private async checkForWinner(sessionId: string) {
    // First check if the game is actually active or starting
    const { data: session } = await this.supabase
      .from('game_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    if (!session || (session.status !== 'active' && session.status !== 'starting')) {
      console.log(`Skipping winner check - game status is: ${session?.status || 'unknown'}`)
      return
    }

    // Use a transaction-like approach to prevent race conditions
    const activePlayers = await this.getActivePlayers(sessionId)
    
    console.log(`Checking for winner: ${activePlayers.length} active players`)
    
    if (activePlayers.length === 1) {
      // We have a winner!
      const winner = activePlayers[0]
      
      console.log(`Winner found: ${winner.username}`)
      
      // Update the session to completed first
      const { error: sessionError } = await this.supabase
        .from('game_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_fid: winner.fid
        })
        .eq('id', sessionId)
        .in('status', ['active', 'starting']) // Can complete from either active or starting

      if (sessionError) {
        console.error('Error updating session:', sessionError)
        return
      }

      // Update winner's placement
      await this.supabase
        .from('game_players')
        .update({ placement: 1 })
        .eq('id', winner.id)

      // Update placements for all eliminated players
      await this.supabase.rpc('update_player_placements', { 
        session_id: sessionId 
      })
    } else if (activePlayers.length === 0) {
      // No active players - this shouldn't happen but let's handle it
      console.log('No active players found - checking if game should end')
      
      // Check if there are any non-eliminated players at all
      const allPlayers = await this.getAllPlayers(sessionId)
      const nonEliminatedPlayers = allPlayers.filter(p => !p.is_eliminated)
      
      if (nonEliminatedPlayers.length === 0) {
        console.log('All players eliminated - ending game without winner')
        
        // End the game without a winner
        await this.supabase
          .from('game_sessions')
          .update({
            status: 'completed',
            ended_at: new Date().toISOString(),
            winner_fid: null
          })
          .eq('id', sessionId)
          .in('status', ['active', 'starting'])
      }
    }
  }

  async startGame(sessionId: string): Promise<boolean> {
    console.log(`Starting game countdown: ${sessionId}`)
    
    const countdownEndsAt = new Date(Date.now() + 5000) // 5 seconds from now
    
    const { data, error } = await this.supabase
      .from('game_sessions')
      .update({ 
        status: 'starting',
        started_at: new Date().toISOString(),
        countdown_ends_at: countdownEndsAt.toISOString()
      })
      .eq('id', sessionId)
      .eq('status', 'waiting')
      .select()

    if (error) {
      console.error('Error starting game countdown:', error)
      return false
    }

    console.log('Game countdown started successfully:', data)
    
    // Schedule the countdown completion
    setTimeout(() => {
      this.completeCountdown(sessionId)
    }, 5000)
    
    return true
  }

  // Complete the countdown and eliminate players not holding the button
  async completeCountdown(sessionId: string): Promise<void> {
    console.log(`Completing countdown for game: ${sessionId}`)
    
    // First check if the game is still in starting status
    const { data: session } = await this.supabase
      .from('game_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    if (!session || session.status !== 'starting') {
      console.log(`Countdown completion cancelled - game status is: ${session?.status || 'unknown'}`)
      return
    }

    // Eliminate all players who are not pressing the button
    const { error: eliminateError } = await this.supabase
      .from('game_players')
      .update({
        is_eliminated: true,
        eliminated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId)
      .eq('is_pressing', false)
      .eq('is_eliminated', false)

    if (eliminateError) {
      console.error('Error eliminating players after countdown:', eliminateError)
      return
    }

    // Update game status to active
    const { error: statusError } = await this.supabase
      .from('game_sessions')
      .update({ 
        status: 'active',
        countdown_ends_at: null
      })
      .eq('id', sessionId)
      .eq('status', 'starting')

    if (statusError) {
      console.error('Error updating game to active status:', statusError)
      return
    }

    console.log('Countdown completed and game is now active')
    
    // Check for winner after eliminations
    await this.checkForWinner(sessionId)
  }

  // Clean up stale players
  async cleanupStalePlayers(sessionId: string) {
    await this.supabase.rpc('cleanup_stale_players', {
      session_id: sessionId
    })
    await this.checkForWinner(sessionId)
  }

  // Check and start scheduled daily games
  async checkAndStartScheduledGames() {
    await this.supabase.rpc('start_scheduled_games')
  }

  // Get featured games
  async getFeaturedGames(): Promise<GameSession[]> {
    const { data, error } = await this.supabase
      .from('game_sessions')
      .select('*')
      .eq('is_featured', true)
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.error('Error fetching featured games:', error)
      return []
    }

    return data || []
  }

  // Get user's game history
  async getUserGameHistory(fid: number): Promise<GamePlayer[]> {
    const { data, error } = await this.supabase
      .from('game_players')
      .select(`
        *,
        game_sessions!inner(*)
      `)
      .eq('fid', fid)
      .order('joined_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Error fetching user game history:', error)
      return []
    }

    return data || []
  }
} 