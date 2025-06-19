'use client'

import { useState, useEffect, useRef } from 'react'
import { useMiniApp } from '@neynar/react'
import { GameService, type GameSession, type GamePlayer } from '~/lib/game/gameService'
import { GameHub } from './GameHub'
import { GameLobby } from './GameLobby'
import { GameButton } from './GameButton'
import { PlayersList } from './PlayersList'
import { GameOver } from './GameOver'
import { Button } from '~/components/ui/Button'

export function FingerOnButton() {
  const miniApp = useMiniApp()
  const user = miniApp.context?.user
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [gameSession, setGameSession] = useState<GameSession | null>(null)
  const [players, setPlayers] = useState<GamePlayer[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const gameService = useRef(new GameService())

  // Check for game ID in URL params (for shared links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const gameId = params.get('game')
    if (gameId) {
      setSelectedGameId(gameId)
    }
  }, [])

  // Load game when selected
  useEffect(() => {
    if (!selectedGameId || !user) return

    async function loadGame() {
      try {
        setIsLoading(true)
        setError(null)
        
        // Get game details
        const { data: session } = await gameService.current['supabase']
          .from('game_sessions')
          .select('*')
          .eq('id', selectedGameId!)
          .single()
          
        if (!session) {
          setError('Game not found')
          return
        }
        
        setGameSession(session)
        
        // Join the game
        const player = await gameService.current.joinGame(selectedGameId!, {
          fid: user!.fid,
          username: user!.username || `user${user!.fid}`,
          display_name: user!.displayName || undefined,
          pfp_url: user!.pfpUrl || undefined
        })
        setCurrentPlayer(player)
        
        // Load initial players
        const allPlayers = await gameService.current.getAllPlayers(selectedGameId!)
        setPlayers(allPlayers)
        
        // Subscribe to realtime updates
        gameService.current.subscribeToGame(
          selectedGameId!,
          (updatedPlayers: GamePlayer[]) => {
            console.log('Players updated via subscription:', updatedPlayers.length, updatedPlayers.map(p => `${p.username}(${p.is_eliminated ? 'elim' : 'active'})`))
            setPlayers(updatedPlayers)
          },
          (updatedSession: GameSession) => {
            console.log('Session updated via subscription:', updatedSession.status)
            setGameSession(updatedSession)
            
            // Stop updates if game is completed
            if (updatedSession.status === 'completed') {
              console.log('Game completed, unsubscribing from updates')
              gameService.current.unsubscribeFromGame(selectedGameId!)
            }
          }
        )

        // Fallback: Periodically refresh both players and session status
        const refreshInterval = setInterval(async () => {
          // Only refresh if game is not completed
          const currentSession = gameSession || session
          if (currentSession?.status === 'completed') {
            console.log('Game completed, stopping refresh interval')
            clearInterval(refreshInterval)
            return
          }
          
          console.log('Refreshing game state (fallback)')
          
          // Always refresh players
          const freshPlayers = await gameService.current.getAllPlayers(selectedGameId!)
          console.log('Players refreshed via fallback:', freshPlayers.map(p => `${p.username}(${p.is_eliminated ? 'elim' : 'active'})`))
          setPlayers(freshPlayers)
          
          // Also refresh session status to catch state changes
          const { data: freshSession } = await gameService.current['supabase']
            .from('game_sessions')
            .select('*')
            .eq('id', selectedGameId!)
            .single()
          
          if (freshSession) {
            console.log('Session status refreshed:', freshSession.status)
            setGameSession(freshSession)
          }
        }, 2000) // Refresh every 2 seconds

        // Store cleanup function reference
        const cleanup = () => {
          clearInterval(refreshInterval)
          if (user && selectedGameId) {
            gameService.current.stopHeartbeat(selectedGameId, user.fid)
          }
          if (selectedGameId) {
            gameService.current.unsubscribeFromGame(selectedGameId)
          }
        }

        return cleanup
      } catch (err) {
        console.error('Error loading game:', err)
        setError('Failed to load game')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadGame()
  }, [selectedGameId, user])

  // Handle game state changes
  useEffect(() => {
    if (gameSession?.status === 'active' && currentPlayer && !currentPlayer.is_eliminated) {
      // Start periodic cleanup of stale players
      const cleanupInterval = setInterval(() => {
        if (selectedGameId) {
          gameService.current.cleanupStalePlayers(selectedGameId)
        }
      }, 1000) // Check every 1 second for more responsive cleanup
      
      return () => clearInterval(cleanupInterval)
    }
  }, [gameSession?.status, selectedGameId, currentPlayer])

  // Show game hub if no game selected
  if (!selectedGameId) {
    return <GameHub onSelectGame={setSelectedGameId} />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error || !gameSession) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-red-600">
          <p className="text-xl font-semibold mb-2">Error</p>
          <p className="mb-4">{error || 'Failed to load game'}</p>
          <Button onClick={() => setSelectedGameId(null)}>Back to Games</Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-xl font-semibold mb-2">Please sign in</p>
          <p className="text-gray-600 mb-4">You need to be signed in to play</p>
          <Button onClick={() => setSelectedGameId(null)}>Back to Games</Button>
        </div>
      </div>
    )
  }

  // Show game info header
  const gameHeader = (
    <div className="bg-gray-100 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {gameSession.game_type === 'daily' && '🏆 Daily Challenge'}
            {gameSession.game_type === 'private' && '🔒 Private Game'}
            {gameSession.game_type === 'public' && '🌐 Public Game'}
          </h2>
          {gameSession.share_code && (
            <p className="text-sm text-gray-600">
              Code: <span className="font-mono bg-white px-2 py-1 rounded">{gameSession.share_code}</span>
              <button
                onClick={() => {
                  const url = `${window.location.origin}?game=${gameSession.id}`
                  navigator.clipboard.writeText(url)
                  alert('Share link copied!')
                }}
                className="ml-2 text-blue-600 hover:underline"
              >
                Copy Link
              </button>
            </p>
          )}
        </div>
        <Button 
          onClick={() => setSelectedGameId(null)}
          className="text-sm"
        >
          Leave Game
        </Button>
      </div>
    </div>
  )

  // Show lobby if game hasn't started
  console.log('Current game session status:', gameSession.status)
  if (gameSession.status === 'waiting' || gameSession.status === 'scheduled') {
    return (
      <div className="max-w-4xl mx-auto p-4">
        {gameHeader}
        <GameLobby
          session={gameSession}
          players={players}
          currentPlayer={currentPlayer}
          onStartGame={async () => {
            console.log('Start game button clicked')
            try {
              const success = await gameService.current.startGame(gameSession.id)
              console.log('Start game result:', success)
              if (!success) {
                setError('Failed to start game')
              }
            } catch (err) {
              console.error('Error in onStartGame:', err)
              setError('Failed to start game')
            }
          }}
        />
      </div>
    )
  }

  // Show countdown screen when game is starting
  if (gameSession.status === 'starting') {
    return (
      <div className="max-w-4xl mx-auto p-4">
        {gameHeader}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Get Ready!</h1>
          <p className="text-gray-600">
            Hold the button when the countdown ends or you'll be eliminated!
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="flex items-center justify-center">
            <GameButton
              sessionId={gameSession.id}
              player={currentPlayer}
              gameService={gameService.current as any}
              disabled={currentPlayer?.is_eliminated || false}
              countdownEndsAt={gameSession.countdown_ends_at}
            />
          </div>

          <div>
            <PlayersList
              players={players}
              currentPlayerFid={currentPlayer?.fid}
              showEliminated={true}
            />
          </div>
        </div>
      </div>
    )
  }

  // Show game over screen if completed
  if (gameSession.status === 'completed') {
    return (
      <div className="max-w-4xl mx-auto p-4">
        {gameHeader}
        <GameOver
          session={gameSession}
          players={players}
          currentPlayer={currentPlayer}
          onNewGame={async () => {
            setSelectedGameId(null)
          }}
        />
      </div>
    )
  }

  // Active game
  return (
    <div className="max-w-4xl mx-auto p-4">
      {gameHeader}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Finger on the Button!</h1>
        <p className="text-gray-600">
          {currentPlayer?.is_eliminated 
            ? "You're out! Watch who wins..." 
            : "Keep your finger on the button to stay in the game!"}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="flex items-center justify-center">
          <GameButton
            sessionId={gameSession.id}
            player={currentPlayer}
            gameService={gameService.current as any}
            disabled={currentPlayer?.is_eliminated || false}
            countdownEndsAt={gameSession.countdown_ends_at}
          />
        </div>

        <div>
          <PlayersList
            players={players}
            currentPlayerFid={currentPlayer?.fid}
            showEliminated={true}
          />
        </div>
      </div>
    </div>
  )
} 