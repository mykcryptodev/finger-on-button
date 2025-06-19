'use client'

import { useState, useEffect, useRef } from 'react'
import { useMiniApp } from '@neynar/react'
import { sdk } from '@farcaster/frame-sdk'
import { formatEther } from 'viem'
import { GameService, type GameSession, type GamePlayer } from '~/lib/game/gameService'
import { ThirdwebDepositService } from '~/lib/game/thirdwebDepositService'
import { useFingerOnTheButtonContract } from '~/lib/contracts/fingerOnTheButton'
import { GameHub } from './GameHub'
import { GameLobby } from './GameLobby'
import { GameButton } from './GameButton'
import { PlayersList } from './PlayersList'
import { GameOver } from './GameOver'
import { DepositInterface } from './DepositInterface'
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
  const [hasDeposited, setHasDeposited] = useState(false)
  const [entryFee, setEntryFee] = useState<bigint>(0n)
  
  const gameService = useRef(new GameService())
  const depositService = useRef(new ThirdwebDepositService())
  const contract = useFingerOnTheButtonContract()

  // Helper function to go back to game hub
  const goBackToHub = () => {
    // Remove game ID from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('game')
    window.history.pushState({}, '', url.toString())
    setSelectedGameId(null)
  }

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
        
        // Get entry fee from contract
        if (contract) {
          try {
            const fee = await contract.read.ENTRY_FEE() as bigint
            setEntryFee(fee)
          } catch (err) {
            console.error('Error getting entry fee:', err)
          }
        }
        
        // Check if player has already deposited
        console.log('Checking deposit for game:', selectedGameId, 'user:', user!.fid)
        console.log('Session requires_deposit:', session.requires_deposit)
        
        const deposited = await depositService.current.hasPlayerDeposited(selectedGameId!, user!.fid)
        console.log('Has deposited:', deposited)
        setHasDeposited(deposited)
        
        // Default to requiring deposit if the field doesn't exist (migration not applied)
        const requiresDeposit = session.requires_deposit ?? true
        console.log('Requires deposit (with default):', requiresDeposit)
        
        // Only join if player has deposited or game doesn't require deposit
        if (deposited || !requiresDeposit) {
          // Join the game
          const player = await gameService.current.joinGame(selectedGameId!, {
            fid: user!.fid,
            username: user!.username || `user${user!.fid}`,
            display_name: user!.displayName || undefined,
            pfp_url: user!.pfpUrl || undefined
          })
          setCurrentPlayer(player)
        }
        
        // Load initial players
        const allPlayers = await gameService.current.getAllPlayers(selectedGameId!)
        setPlayers(allPlayers)
        
        // Subscribe to realtime updates
        gameService.current.subscribeToGame(
          selectedGameId!,
          async (updatedPlayers: GamePlayer[]) => {
            console.log('Players updated via subscription:', updatedPlayers.length, updatedPlayers.map(p => `${p.username}(${p.is_eliminated ? 'elim' : 'active'})`))
            
            // Check for eliminations and trigger haptic feedback
            await checkForEliminations(updatedPlayers, players)
            
            // Update players state
            setPlayers(updatedPlayers)
          },
          (updatedSession: GameSession) => {
            console.log('Session updated via subscription:', updatedSession.status)
            
            // Check for victory when game completes
            checkForVictory(updatedSession)
            
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
          
          // Check for eliminations and trigger haptic feedback
          await checkForEliminations(freshPlayers, players)
          
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

  // Function to detect eliminations and trigger haptic feedback
  const checkForEliminations = async (newPlayers: GamePlayer[], oldPlayers: GamePlayer[]) => {
    // Only check for eliminations during active gameplay
    if (!gameSession || (gameSession.status !== 'active' && gameSession.status !== 'starting')) {
      return
    }

    // Find players who were just eliminated (not eliminated before, but eliminated now)
    const newlyEliminated = newPlayers.filter(newPlayer => {
      const oldPlayer = oldPlayers.find(old => old.fid === newPlayer.fid)
      return newPlayer.is_eliminated && oldPlayer && !oldPlayer.is_eliminated
    })

    // Check if we just became the winner (only 1 active player left and it's us)
    const activePlayers = newPlayers.filter(p => !p.is_eliminated)
    const weAreWinner = activePlayers.length === 1 && activePlayers[0]?.fid === user?.fid

    // Trigger haptic feedback for eliminations
    if (newlyEliminated.length > 0) {
      // Special case: if we just won, trigger success haptic
      if (weAreWinner) {
        try {
          const capabilities = await sdk.getCapabilities()
          
          if (capabilities.includes('haptics.notificationOccurred')) {
            await sdk.haptics.notificationOccurred('success')
          }
        } catch (error) {
          // Haptics not supported or failed, continue silently
        }
      } else {
        // Regular elimination haptics for other players
        for (const eliminatedPlayer of newlyEliminated) {
          // Don't trigger haptic for our own elimination
          if (eliminatedPlayer.fid !== user?.fid) {
            try {
              const capabilities = await sdk.getCapabilities()
              
              if (capabilities.includes('haptics.notificationOccurred')) {
                await sdk.haptics.notificationOccurred('warning')
              }
            } catch (error) {
              // Haptics not supported or failed, continue silently
            }
          }
        }
      }
    }
  }

  // Function to check for victory when game status changes
  const checkForVictory = async (session: GameSession) => {
    if (session.status === 'completed' && session.winner_fid === user?.fid) {
      try {
        const capabilities = await sdk.getCapabilities()
        
        if (capabilities.includes('haptics.notificationOccurred')) {
          await sdk.haptics.notificationOccurred('success')
        }
      } catch (error) {
        // Haptics not supported or failed, continue silently
      }
    }
  }

  // Show game hub if no game selected
  if (!selectedGameId) {
    return <GameHub onSelectGame={(gameId) => {
      // Update URL to include game ID
      const url = new URL(window.location.href)
      url.searchParams.set('game', gameId)
      window.history.pushState({}, '', url.toString())
      setSelectedGameId(gameId)
    }} />
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
          <Button onClick={goBackToHub}>Back to Games</Button>
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
          <Button onClick={goBackToHub}>Back to Games</Button>
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
          onClick={goBackToHub}
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
        
        {/* Show deposit interface if player hasn't deposited */}
        {!hasDeposited && gameSession.requires_deposit !== false && (
          <DepositInterface
            gameId={selectedGameId}
            sessionId={selectedGameId}
            fid={user.fid}
            entryFee={entryFee}
            onDepositComplete={() => {
              setHasDeposited(true)
              // Ensure game ID is in URL before reloading
              const url = new URL(window.location.href)
              url.searchParams.set('game', selectedGameId)
              window.history.replaceState({}, '', url.toString())
              window.location.reload()
            }}
          />
        )}
        
        <GameLobby
          session={gameSession}
          players={players}
          currentPlayer={currentPlayer}
          onStartGame={async () => {
            if (!hasDeposited && gameSession.requires_deposit !== false) {
              alert('Please deposit first to join the game!')
              return
            }
            
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
          onNewGame={async () => goBackToHub()}
        />
      </div>
    )
  }

  // Active game
  return (
    <>
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
    </>
  )
} 