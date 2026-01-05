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
