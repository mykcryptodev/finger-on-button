'use client'

import { useState, useEffect } from 'react'
import type { GameSession } from '~/lib/game/gameService'

interface GameCountdownProps {
  session: GameSession
}

export function GameCountdown({ session }: GameCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    if (!session.countdown_ends_at) return

    const countdownEnd = new Date(session.countdown_ends_at).getTime()
    
    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((countdownEnd - now) / 1000))
      setTimeLeft(remaining)
    }

    // Update immediately
    updateTimer()

    // Update every 100ms for smooth countdown
    const interval = setInterval(updateTimer, 100)

    return () => clearInterval(interval)
  }, [session.countdown_ends_at])

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Get Ready!</h1>
        <p className="text-xl text-gray-600 mb-8">
          Game starts in {timeLeft} second{timeLeft !== 1 ? 's' : ''}...
        </p>
        
        <div className="mb-8">
          <div className={`text-8xl font-bold transition-all duration-300 ${
            timeLeft <= 1 ? 'text-red-600 scale-110' : 
            timeLeft <= 2 ? 'text-orange-500' : 
            'text-blue-600'
          }`}>
            {timeLeft}
          </div>
        </div>

        <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-3 text-yellow-800">
            🚨 Get Your Finger Ready!
          </h2>
          <p className="text-yellow-700">
            When the countdown reaches zero, you must be holding the button or you'll be eliminated immediately!
          </p>
        </div>
      </div>
    </div>
  )
} 