'use client'

import { useState, useEffect, useRef } from 'react'
import { sdk } from '@farcaster/frame-sdk'
import type { GamePlayer, GameService } from '~/lib/game/gameService'

interface GameButtonProps {
  sessionId: string
  player: GamePlayer | null
  gameService: GameService
  disabled: boolean
  countdownEndsAt?: string | null
}

export function GameButton({ sessionId, player, gameService, disabled, countdownEndsAt }: GameButtonProps) {
  const [isPressing, setIsPressing] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [countdownTime, setCountdownTime] = useState<number>(0)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Handle countdown timer
  useEffect(() => {
    if (!countdownEndsAt) {
      setCountdownTime(0)
      return
    }

    const countdownEnd = new Date(countdownEndsAt).getTime()
    let lastHapticSecond = -1
    
    const updateCountdown = async () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((countdownEnd - now) / 1000))
      setCountdownTime(remaining)
      
      // Trigger haptic feedback for each new second
      if (remaining > 0 && remaining !== lastHapticSecond) {
        lastHapticSecond = remaining
        
        try {
          // Check if haptics are supported
          const capabilities = await sdk.getCapabilities()
          
          if (capabilities.includes('haptics.impactOccurred')) {
            // Different haptic intensities based on countdown
            if (remaining <= 3) {
              // Heavy haptic for final 3 seconds
              await sdk.haptics.impactOccurred('heavy')
            } else if (remaining <= 5) {
              // Medium haptic for 4-5 seconds
              await sdk.haptics.impactOccurred('medium')
            } else {
              // Light haptic for 6-10 seconds
              await sdk.haptics.impactOccurred('light')
            }
          }
        } catch (error) {
          // Haptics not supported or failed, continue silently
          console.log('Haptic feedback not available:', error)
        }
      }
    }

    // Update immediately
    updateCountdown()

    // Update every 100ms for smooth countdown
    const interval = setInterval(updateCountdown, 100)

    return () => clearInterval(interval)
  }, [countdownEndsAt])

  // Handle button press
  const handlePressStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
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
    
    gameService.stopHeartbeat(sessionId, player.fid)
    await gameService.stopPressing(sessionId, player.fid)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isPressing) {
        gameService.stopHeartbeat(sessionId, player!.fid)
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

  // Prevent context menu on long press
  useEffect(() => {
    const button = buttonRef.current
    if (!button) return

    const preventContextMenu = (e: Event) => {
      e.preventDefault()
      return false
    }

    button.addEventListener('contextmenu', preventContextMenu)
    return () => button.removeEventListener('contextmenu', preventContextMenu)
  }, [])

  const holdDuration = touchStart ? Math.floor((Date.now() - touchStart) / 1000) : 0

  return (
    <div className="relative select-none">
      <button
        ref={buttonRef}
        disabled={disabled}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
        style={{
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          WebkitTapHighlightColor: 'transparent',
          userSelect: 'none'
        }}
        className={`
          relative w-64 h-64 rounded-full transition-all duration-150 ease-out
          select-none touch-none outline-none focus:outline-none
          ${disabled 
            ? 'bg-gray-400 cursor-not-allowed shadow-lg' 
            : isPressing 
              ? 'bg-red-800 scale-90 shadow-inner transform translate-y-1' 
              : 'bg-red-600 hover:bg-red-700 shadow-2xl hover:shadow-3xl cursor-pointer active:scale-95'
          }
          border-4 border-red-900
        `}
      >
        {/* Inner circle for depth effect */}
        <div className={`
          absolute inset-2 rounded-full transition-all duration-150
          ${disabled 
            ? 'bg-gray-300' 
            : isPressing 
              ? 'bg-red-700 shadow-inner' 
              : 'bg-red-500 shadow-lg'
          }
        `}>
          {/* Center dot/indicator */}
          <div className={`
            absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2
            w-8 h-8 rounded-full transition-all duration-150
            ${disabled 
              ? 'bg-gray-500' 
              : isPressing 
                ? 'bg-red-900 scale-75' 
                : 'bg-red-800'
            }
          `} />
          
          {/* Timer display when pressing */}
          {isPressing && !disabled && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-white drop-shadow-lg">
                {holdDuration}s
              </span>
            </div>
          )}
        </div>
        
        {/* Pulse animation when active */}
        {!disabled && isPressing && (
          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30"></div>
        )}
      </button>
      
      {/* Status text below button */}
      <div className="text-center mt-6">
        {countdownTime > 0 ? (
          <div>
            <p className={`text-lg font-semibold transition-colors duration-300 ${
              countdownTime <= 1 ? 'text-red-600' : 
              countdownTime <= 2 ? 'text-orange-500' : 
              'text-blue-600'
            }`}>
              Game starts in {countdownTime}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              {isPressing ? 'Great! Keep holding!' : 'Hold the button now or be eliminated!'}
            </p>
          </div>
        ) : disabled ? (
          <div>
            <p className="text-xl font-bold text-gray-600">ELIMINATED</p>
            <p className="text-sm text-gray-500 mt-1">Watch the game!</p>
          </div>
        ) : isPressing ? (
          <div>
            <p className="text-lg font-semibold text-green-600">Keep holding!</p>
            <p className="text-sm text-gray-600 mt-1">Don't let go to stay in the game</p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-semibold text-red-600">Press & Hold</p>
            <p className="text-sm text-gray-600 mt-1">Touch and hold the button to play</p>
          </div>
        )}
      </div>
    </div>
  )
} 