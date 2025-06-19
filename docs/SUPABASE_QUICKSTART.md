# Quick Fix for Supabase Connection

## 1. Check Environment Variables

Make sure your `.env.local` file has these variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Get these from your Supabase dashboard:
1. Go to https://supabase.com/dashboard/project/finger-on-button/settings/api
2. Copy the Project URL and anon key

## 2. Create the Database Table

1. Go to your Supabase SQL editor: https://supabase.com/dashboard/project/finger-on-button/sql
2. Copy and paste the entire contents of `setup-supabase.sql`
3. Click "Run" to execute the SQL

## 3. Restart Your Dev Server

After setting up the environment variables:

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

## 4. Check the Browser Console

Open your browser's developer console (F12) and look for any error messages when the app loads.

## 5. Verify the Setup

You can test if the table was created by running this query in Supabase SQL editor:

```sql
SELECT * FROM farcaster_users;
```

It should return an empty table (no error).

## Troubleshooting

If you still see errors:

1. **Check the server logs** - Look at your terminal where `npm run dev` is running
2. **Check browser network tab** - See what the API is returning
3. **Verify Supabase connection** - Try this simple query in SQL editor:
   ```sql
   SELECT current_database();
   ```

Common issues:
- Wrong project URL or API key
- Table doesn't exist (run the SQL script)
- RLS policies blocking access (the script includes proper policies) 