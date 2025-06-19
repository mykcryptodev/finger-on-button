'use client'

import { useState, useEffect } from 'react'
import { useMiniApp } from '@neynar/react'
import { GameService, type GameSession, type GameType } from '~/lib/game/gameService'
import { Button } from '~/components/ui/Button'

interface GameHubProps {
  onSelectGame: (gameId: string) => void
}

export function GameHub({ onSelectGame }: GameHubProps) {
  const miniApp = useMiniApp()
  const user = miniApp.context?.user
  const [dailyGame, setDailyGame] = useState<GameSession | null>(null)
  const [publicGames, setPublicGames] = useState<GameSession[]>([])
  const [privateGames, setPrivateGames] = useState<GameSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [creatingPrivateGame, setCreatingPrivateGame] = useState(false)
  const gameService = new GameService()

  useEffect(() => {
    loadGames()
  }, [])

  async function loadGames() {
    setIsLoading(true)
    try {
      // Load daily game
      const daily = await gameService.getTodaysDailyGame()
      if (!daily) {
        // Create today's daily game if it doesn't exist
        await gameService.createTodaysDailyGame()
        const newDaily = await gameService.getTodaysDailyGame()
        setDailyGame(newDaily)
      } else {
        setDailyGame(daily)
      }

      // Load all active games
      const [publicList, privateList] = await Promise.all([
        gameService.getActiveGames('public'),
        gameService.getActiveGames('private')
      ])
      
      setPublicGames(publicList)
      setPrivateGames(privateList)
    } catch (error) {
      console.error('Error loading games:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function createPrivateGame() {
    if (!user) return
    
    setCreatingPrivateGame(true)
    try {
      const game = await gameService.createPrivateGame(user.fid)
      if (game) {
        onSelectGame(game.id)
      }
    } catch (error) {
      console.error('Error creating private game:', error)
    } finally {
      setCreatingPrivateGame(false)
    }
  }

  async function joinGameByCode() {
    const code = prompt('Enter game code:')?.toUpperCase()
    if (!code) return

    const game = await gameService.getGameByShareCode(code)
    if (game) {
      onSelectGame(game.id)
    } else {
      alert('Invalid game code')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading games...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Finger on the Button</h1>
        <p className="text-gray-600">Choose a game to join</p>
      </div>

      <div className="space-y-6">
        {/* Daily Game */}
        {dailyGame && (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-6 border-2 border-orange-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>🏆</span> Daily Challenge
                </h2>
                <p className="text-gray-700 mt-1">
                  {dailyGame.status === 'scheduled' 
                    ? `Starts at 12:00 PM ET`
                    : `${dailyGame.total_players} players ${dailyGame.status === 'active' ? 'playing' : 'waiting'}`
                  }
                </p>
              </div>
              <Button
                onClick={() => onSelectGame(dailyGame.id)}
                disabled={dailyGame.status === 'scheduled'}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {dailyGame.status === 'scheduled' ? 'Coming Soon' : 'Join Daily'}
              </Button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={createPrivateGame}
            disabled={!user || creatingPrivateGame}
            className="p-6 bg-blue-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors text-left"
          >
            <h3 className="text-xl font-semibold mb-2">Create Private Game</h3>
            <p className="text-gray-600">Start your own game and invite friends</p>
          </button>

          <button
            onClick={joinGameByCode}
            className="p-6 bg-green-50 rounded-lg border-2 border-green-200 hover:border-green-400 transition-colors text-left"
          >
            <h3 className="text-xl font-semibold mb-2">Join with Code</h3>
            <p className="text-gray-600">Enter a game code to join a private game</p>
          </button>
        </div>

        {/* Public Games */}
        {publicGames.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Public Games</h2>
            <div className="space-y-2">
              {publicGames.map((game) => (
                <GameCard key={game.id} game={game} onJoin={() => onSelectGame(game.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Private Games (if any visible) */}
        {privateGames.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3">Open Private Games</h2>
            <div className="space-y-2">
              {privateGames.map((game) => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  onJoin={() => onSelectGame(game.id)}
                  showCode={true}
                />
              ))}
            </div>
          </div>
        )}

        {/* No games message */}
        {publicGames.length === 0 && privateGames.length === 0 && !dailyGame && (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-4">No active games right now</p>
            <Button onClick={() => loadGames()}>Refresh</Button>
          </div>
        )}
      </div>
    </div>
  )
}

function GameCard({ 
  game, 
  onJoin,
  showCode = false 
}: { 
  game: GameSession
  onJoin: () => void
  showCode?: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">
            {game.game_type === 'private' ? '🔒 Private Game' : '🌐 Public Game'}
          </h3>
          {showCode && game.share_code && (
            <span className="text-sm bg-gray-100 px-2 py-1 rounded font-mono">
              {game.share_code}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {game.total_players}/{game.max_players} players • {game.status}
        </p>
      </div>
      <Button
        onClick={onJoin}
        disabled={game.total_players >= game.max_players}
        className="text-sm px-3 py-1"
      >
        {game.total_players >= game.max_players ? 'Full' : 'Join'}
      </Button>
    </div>
  )
} 