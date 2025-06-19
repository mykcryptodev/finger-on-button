'use client'

import { useEffect, useState } from 'react'
import { useMiniApp } from '@neynar/react'

export function MiniAppUserSync() {
  const { context } = useMiniApp()
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const syncUserToSupabase = async () => {
      if (!context?.user) return

      setSyncStatus('syncing')
      setErrorMessage('')

      try {
        const response = await fetch('/api/connect-farcaster', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fid: context.user.fid,
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to sync user')
        }

        setSyncStatus('synced')
        console.log('User synced to Supabase:', data)
      } catch (error) {
        console.error('Error syncing user:', error)
        setSyncStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    syncUserToSupabase()
  }, [context?.user])

  // This component can be invisible or show a small status indicator
  if (syncStatus === 'idle' || syncStatus === 'syncing') {
    return null // Silent sync
  }

  // Only show if there's an error (optional)
  if (syncStatus === 'error') {
    return (
      <div className="text-xs text-red-500 p-2">
        Failed to connect to database
      </div>
    )
  }

  // Successfully synced - you can show a small indicator or nothing
  return null
} 