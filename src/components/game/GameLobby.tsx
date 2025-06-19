'use client'

import type { GameSession, GamePlayer } from '~/lib/game/gameService'
import { PlayersList } from './PlayersList'

interface GameLobbyProps {
  session: GameSession
  players: GamePlayer[]
  currentPlayer: GamePlayer | null
  onStartGame: () => Promise<void>
}

export function GameLobby({ session, players, currentPlayer, onStartGame }: GameLobbyProps) {
  const canStart = players.length >= 2 // Need at least 2 players

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">Finger on the Button</h1>
        <p className="text-xl text-gray-600 mb-2">Waiting for players...</p>
        <p className="text-gray-500">
          {players.length} player{players.length !== 1 ? 's' : ''} in lobby
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {/* Game Rules */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">How to Play</h2>
          <ol className="space-y-3 text-gray-700">
            <li className="flex gap-3">
              <span className="font-bold text-red-600">1.</span>
              <span>When the game starts, press and hold the big red button</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-red-600">2.</span>
              <span>Keep your finger on the button - don't let go!</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-red-600">3.</span>
              <span>If you release the button, you're eliminated</span>
            </li>
            <li className="flex gap-3">
              <span className="font-bold text-red-600">4.</span>
              <span>Last player holding the button wins! 🏆</span>
            </li>
          </ol>
        </div>

        {/* Players List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Players Ready</h2>
          <PlayersList 
            players={players} 
            currentPlayerFid={currentPlayer?.fid}
            showEliminated={false}
          />
        </div>
      </div>

      {/* Start Game Button */}
      <div className="text-center">
        {canStart ? (
          <button
            onClick={onStartGame}
            className="px-8 py-4 bg-red-600 text-white font-bold text-xl rounded-lg hover:bg-red-700 transition-colors shadow-lg"
          >
            Start Game!
          </button>
        ) : (
          <div className="text-gray-500">
            <p className="text-lg mb-2">Need at least 2 players to start</p>
            <p>Share this mini app with friends to play!</p>
          </div>
        )}
      </div>
    </div>
  )
} 