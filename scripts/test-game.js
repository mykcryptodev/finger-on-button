#!/usr/bin/env node

console.log('🎮 Finger on the Button - Local Test Mode');
console.log('=========================================');
console.log('');
console.log('To test the game locally:');
console.log('');
console.log('1. Make sure you have set up your .env.local file with:');
console.log('   - NEXT_PUBLIC_SUPABASE_URL');
console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
console.log('   - NEYNAR_API_KEY');
console.log('   - NEYNAR_CLIENT_ID');
console.log('');
console.log('2. Run the database migrations in your Supabase project:');
console.log('   - supabase/migrations/create_farcaster_users.sql');
console.log('   - supabase/migrations/create_game_tables.sql');
console.log('   - supabase/migrations/update_game_rls_policies.sql');
console.log('');
console.log('3. Enable realtime for the game tables in Supabase Dashboard:');
console.log('   - game_sessions');
console.log('   - game_players');
console.log('');
console.log('4. Start the development server:');
console.log('   npm run dev');
console.log('');
console.log('5. Open multiple browser windows to simulate multiple players');
console.log('');
console.log('Happy gaming! 🎮'); 