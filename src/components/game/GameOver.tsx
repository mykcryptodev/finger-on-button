'use client'

import type { GameSession, GamePlayer } from '~/lib/game/gameService'
import { PlayersList } from './PlayersList'

interface GameOverProps {
  session: GameSession
  players: GamePlayer[]
  currentPlayer: GamePlayer | null
  onNewGame: () => Promise<void>
}

export function GameOver({ session, players, currentPlayer, onNewGame }: GameOverProps) {
  const winner = players.find(p => p.fid === session.winner_fid)
  const isWinner = currentPlayer?.fid === session.winner_fid
  const sortedPlayers = [...players].sort((a, b) => {
    // Winner first
    if (a.placement === 1) return -1
    if (b.placement === 1) return 1
    // Then by elimination time (most recent first)
    if (!a.eliminated_at && b.eliminated_at) return -1
    if (a.eliminated_at && !b.eliminated_at) return 1
    if (a.eliminated_at && b.eliminated_at) {
      return new Date(b.eliminated_at).getTime() - new Date(a.eliminated_at).getTime()
    }
    return 0
  })

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Game Over!</h1>
        
        {winner && (
          <div className="mb-6">
            <div className="inline-block relative">
              {winner.pfp_url ? (
                <img 
                  src={winner.pfp_url} 
                  alt={winner.display_name || winner.username}
                  className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-yellow-400"
                />
              ) : (
                <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-yellow-400 bg-gray-300 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-600">
                    {(winner.display_name || winner.username).charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="absolute -top-2 -right-2 text-4xl">🏆</div>
            </div>
            
            <h2 className="text-2xl font-semibold mb-1">
              {winner.display_name || winner.username} wins!
            </h2>
            <p className="text-gray-600">@{winner.username}</p>
            
            {isWinner && (
              <p className="text-green-600 font-semibold mt-2">
                Congratulations! You won! 🎉
              </p>
            )}
          </div>
        )}

        {/* Game Stats */}
        {session.started_at && session.ended_at && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6 inline-block">
            <p className="text-gray-600">
              Game Duration: {formatDuration(session.started_at, session.ended_at)}
            </p>
            <p className="text-gray-600">
              Total Players: {session.total_players}
            </p>
          </div>
        )}
      </div>

      {/* Final Rankings */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Final Rankings</h3>
        <PlayersList 
          players={sortedPlayers} 
          currentPlayerFid={currentPlayer?.fid}
          showEliminated={true}
        />
      </div>

      {/* New Game Button */}
      <div className="text-center">
        <button
          onClick={onNewGame}
          className="px-8 py-4 bg-red-600 text-white font-bold text-xl rounded-lg hover:bg-red-700 transition-colors shadow-lg"
        >
          Start New Game
        </button>
      </div>
    </div>
  )
}

function formatDuration(start: string, end: string): string {
  const startTime = new Date(start).getTime()
  const endTime = new Date(end).getTime()
  const duration = Math.floor((endTime - startTime) / 1000)
  
  const minutes = Math.floor(duration / 60)
  const seconds = duration % 60
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
} 