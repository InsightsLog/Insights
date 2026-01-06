# Supabase Clients

## Usage

### Server Components / Server Actions / Route Handlers
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function MyServerComponent() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('indicators').select('*');
  return <div>{/* render data */}</div>;
}
```

### Client Components
```typescript
'use client';
import { createSupabaseClient } from '@/lib/supabase/client';

export function MyClientComponent() {
  const supabase = createSupabaseClient();
  // use supabase client
}
```

### Auth Helpers (Server-side)
```typescript
import { getCurrentUser } from '@/lib/supabase/auth';

export async function MyAuthenticatedComponent() {
  const user = await getCurrentUser();
  
  if (!user) {
    // User is not logged in
    return <div>Please sign in</div>;
  }
  
  // User is logged in
  return <div>Welcome, {user.display_name || user.email}</div>;
}
```
