'use client'

import { useEffect, useState } from 'react'
import { createClient } from '~/utils/supabase/client'

export default function SupabaseExample() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Supabase Integration</h2>
      {user ? (
        <div>
          <p>Logged in as: {user.email}</p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="mt-2 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </div>
      ) : (
        <p>Not logged in</p>
      )}
    </div>
  )
} 