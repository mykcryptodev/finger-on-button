'use client'

import type { GamePlayer } from '~/lib/game/gameService'

interface PlayersListProps {
  players: GamePlayer[]
  currentPlayerFid?: number
  showEliminated?: boolean
}

export function PlayersList({ players, currentPlayerFid, showEliminated = false }: PlayersListProps) {
  const activePlayers = players.filter(p => !p.is_eliminated)
  const eliminatedPlayers = players.filter(p => p.is_eliminated).reverse()

  return (
    <div className="space-y-4">
      {/* Active Players */}
      <div>
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
          Active Players ({activePlayers.length})
        </h3>
        <div className="space-y-2">
          {activePlayers.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrentPlayer={player.fid === currentPlayerFid}
              isActive={true}
            />
          ))}
        </div>
      </div>

      {/* Eliminated Players */}
      {showEliminated && eliminatedPlayers.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2 text-gray-600">
            Eliminated ({eliminatedPlayers.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {eliminatedPlayers.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                isCurrentPlayer={player.fid === currentPlayerFid}
                isActive={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerCard({ 
  player, 
  isCurrentPlayer, 
  isActive 
}: { 
  player: GamePlayer
  isCurrentPlayer: boolean
  isActive: boolean
}) {
  return (
    <div 
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all
        ${isCurrentPlayer 
          ? 'border-blue-500 bg-blue-50' 
          : 'border-gray-200 bg-white'
        }
        ${!isActive ? 'opacity-60' : ''}
      `}
    >
      {/* Profile Picture */}
      {player.pfp_url ? (
        <img 
          src={player.pfp_url} 
          alt={player.display_name || player.username}
          className="w-10 h-10 rounded-full"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
          <span className="text-gray-600 font-semibold">
            {(player.display_name || player.username).charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Player Info */}
      <div className="flex-1">
        <div className="font-medium">
          {player.display_name || player.username}
          {isCurrentPlayer && <span className="text-blue-600 text-sm ml-2">(You)</span>}
        </div>
        <div className="text-sm text-gray-500">@{player.username}</div>
      </div>

      {/* Status */}
      <div className="text-right">
        {player.placement === 1 && (
          <div className="text-yellow-500 font-bold">🏆 Winner!</div>
        )}
        {isActive && player.is_pressing && (
          <div className="flex items-center gap-1 text-green-600">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span className="text-sm">Holding</span>
          </div>
        )}
        {!isActive && player.eliminated_at && (
          <div className="text-sm text-gray-500">
            {player.placement && player.placement > 1 && (
              <span className="font-medium">#{player.placement} • </span>
            )}
            Out
          </div>
        )}
      </div>
    </div>
  )
} 