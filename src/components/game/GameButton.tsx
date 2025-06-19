'use client'

import { useState, useEffect, useRef } from 'react'
import type { GamePlayer, GameService } from '~/lib/game/gameService'

interface GameButtonProps {
  sessionId: string
  player: GamePlayer | null
  gameService: GameService
  disabled: boolean
}

export function GameButton({ sessionId, player, gameService, disabled }: GameButtonProps) {
  const [isPressing, setIsPressing] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle button press
  const handlePressStart = async () => {
    if (disabled || !player) return
    
    setIsPressing(true)
    setTouchStart(Date.now())
    
    const success = await gameService.startPressing(sessionId, player.fid)
    if (success) {
      gameService.startHeartbeat(sessionId, player.fid, () => {
        // Handle heartbeat failure
        handlePressEnd()
      })
    } else {
      setIsPressing(false)
    }
  }

  // Handle button release
  const handlePressEnd = async () => {
    if (!player || !isPressing) return
    
    setIsPressing(false)
    setTouchStart(null)
    
    gameService.stopHeartbeat()
    await gameService.stopPressing(sessionId, player.fid)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isPressing) {
        gameService.stopHeartbeat()
      }
    }
  }, [isPressing, gameService])

  // Handle window blur/focus
  useEffect(() => {
    const handleBlur = () => {
      if (isPressing) {
        handlePressEnd()
      }
    }

    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [isPressing])

  const holdDuration = touchStart ? Math.floor((Date.now() - touchStart) / 1000) : 0

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        disabled={disabled}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        className={`
          relative w-64 h-64 rounded-full transition-all duration-200
          ${disabled 
            ? 'bg-gray-400 cursor-not-allowed' 
            : isPressing 
              ? 'bg-red-700 scale-95 shadow-inner' 
              : 'bg-red-600 hover:bg-red-700 shadow-2xl hover:shadow-3xl cursor-pointer'
          }
        `}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          {disabled ? (
            <>
              <span className="text-2xl font-bold">ELIMINATED</span>
              <span className="text-lg mt-2">Watch the game!</span>
            </>
          ) : isPressing ? (
            <>
              <span className="text-6xl font-bold">{holdDuration}s</span>
              <span className="text-lg mt-2">Keep holding!</span>
            </>
          ) : (
            <>
              <span className="text-2xl font-bold">PRESS & HOLD</span>
              <span className="text-lg mt-2">Don't let go!</span>
            </>
          )}
        </div>
        
        {/* Pulse animation when active */}
        {!disabled && isPressing && (
          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-25"></div>
        )}
      </button>
      
      {/* Instructions */}
      {!disabled && !isPressing && (
        <p className="text-center text-gray-600 mt-4">
          Click and hold the button to play. Last one holding wins!
        </p>
      )}
    </div>
  )
} 