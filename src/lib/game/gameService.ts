import { createClient } from '~/utils/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type GameType = 'public' | 'daily' | 'private'
export type GameStatus = 'scheduled' | 'waiting' | 'active' | 'completed'

export interface GameSession {
  id: string
  status: GameStatus
  game_type: GameType
  share_code: string | null
  scheduled_start_time: string | null
  started_at: string | null
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

    const { data, error } = await this.supabase
      .from('game_players')
      .upsert({
        session_id: sessionId,
        fid: player.fid,
        username: player.username,
        display_name: player.display_name,
        pfp_url: player.pfp_url,
        is_pressing: false,
        is_eliminated: false
      })
      .select()
      .single()

    if (error) {
      console.error('Error joining game:', error)
      return null
    }

    // Update player count
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
      .order('placement', { ascending: true, nullsFirst: false })
      .order('eliminated_at', { ascending: false, nullsFirst: true })

    if (error) {
      console.error('Error fetching all players:', error)
      return []
    }

    return data || []
  }

  subscribeToGame(
    sessionId: string,
    onPlayersUpdate: (players: GamePlayer[]) => void,
    onSessionUpdate: (session: GameSession) => void
  ) {
    // Unsubscribe from any existing channel for this session
    this.unsubscribeFromGame(sessionId)

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
        async () => {
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
          if (payload.new) {
            onSessionUpdate(payload.new as GameSession)
          }
        }
      )
      .subscribe()

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
    const activePlayers = await this.getActivePlayers(sessionId)
    
    if (activePlayers.length === 1) {
      // We have a winner!
      const winner = activePlayers[0]
      
      // Update the session
      await this.supabase
        .from('game_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_fid: winner.fid
        })
        .eq('id', sessionId)

      // Update winner's placement
      await this.supabase
        .from('game_players')
        .update({ placement: 1 })
        .eq('id', winner.id)

      // Update placements for all eliminated players
      await this.supabase.rpc('update_player_placements', { 
        session_id: sessionId 
      })
    }
  }

  async startGame(sessionId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('game_sessions')
      .update({ 
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('status', 'waiting')

    return !error
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