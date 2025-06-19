import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '~/utils/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Connect Farcaster Request:', body)
    
    const { fid, username, displayName, pfpUrl } = body

    if (!fid) {
      console.error('FID is missing from request')
      return NextResponse.json({ error: 'FID is required' }, { status: 400 })
    }

    console.log('Creating Supabase client...')
    const supabase = await createClient()

    console.log('Attempting to upsert user with FID:', fid)
    
    // Upsert the Farcaster user to your Supabase database
    const { data, error } = await supabase
      .from('farcaster_users')
      .upsert({
        fid,
        username,
        display_name: displayName,
        pfp_url: pfpUrl,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'fid',
        ignoreDuplicates: false
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      return NextResponse.json({ 
        error: 'Failed to connect user',
        details: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      user: data,
      message: 'User connected to Supabase' 
    })
  } catch (error) {
    console.error('Error in connect-farcaster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 