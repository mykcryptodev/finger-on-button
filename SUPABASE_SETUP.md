# Supabase Setup Guide for Finger on the Button

## Overview
This guide will help you complete the Supabase integration for your Next.js app.

## Prerequisites
- Supabase project created (you mentioned you already have one called "finger-on-button")
- Node.js and npm installed

## Setup Steps

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/finger-on-button
2. Navigate to Settings > API
3. Copy the following values:
   - **Project URL**: This will look like `https://xxxxx.supabase.co`
   - **Anon Key**: This is the public anonymous key

### 2. Configure Environment Variables

Create a `.env.local` file in the root of your project with the following content:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace `your_project_url_here` and `your_anon_key_here` with the actual values from your Supabase dashboard.

### 3. File Structure Created

The following files have been created for your Supabase integration:

- `src/utils/supabase/client.ts` - Client-side Supabase client
- `src/utils/supabase/server.ts` - Server-side Supabase client
- `src/utils/supabase/middleware.ts` - Middleware for session management
- `src/middleware.ts` - Next.js middleware configuration
- `src/types/supabase.ts` - Placeholder for database types
- `src/components/SupabaseExample.tsx` - Example component showing Supabase usage

### 4. Using Supabase in Your App

#### Client Components (Browser)
```typescript
import { createClient } from '~/utils/supabase/client'

const supabase = createClient()
```

#### Server Components/Actions
```typescript
import { createClient } from '~/utils/supabase/server'

const supabase = await createClient()
```

### 5. Generate TypeScript Types (Optional but Recommended)

To get TypeScript types for your database:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
```

### 6. Authentication Features

The middleware is already configured to:
- Refresh auth tokens automatically
- Redirect unauthenticated users to `/login` (except for `/login` and `/auth` paths)
- Manage sessions with cookies

### 7. Example Usage

The `SupabaseExample` component demonstrates:
- Getting the current user session
- Listening for auth state changes
- Sign out functionality

You can import and use it in any page:

```typescript
import SupabaseExample from '~/components/SupabaseExample'

export default function Page() {
  return <SupabaseExample />
}
```

### 8. Next Steps

1. Set up your database tables in Supabase
2. Configure Row Level Security (RLS) policies
3. Implement authentication flows (sign up, sign in)
4. Start building your app features with Supabase!

### Common Supabase Operations

#### Querying Data
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
```

#### Inserting Data
```typescript
const { data, error } = await supabase
  .from('table_name')
  .insert({ column: 'value' })
```

#### Real-time Subscriptions
```typescript
const subscription = supabase
  .channel('custom-channel')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'table_name' },
    (payload) => console.log(payload)
  )
  .subscribe()
```

### Troubleshooting

- Make sure your environment variables are correctly set
- Check that your Supabase project is active
- Verify RLS policies if you're having permission issues
- Check the browser console and network tab for errors

For more information, visit the [Supabase documentation](https://supabase.com/docs). 