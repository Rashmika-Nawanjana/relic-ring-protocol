---
name: nextjs-supabase-stack
description: >-
  Next.js 16 App Router, Vercel deployment, and Supabase integration for this
  project. Use when creating pages, components, API routes, auth, database calls,
  middleware, or environment configuration.
paths: src/**/*
---

# Next.js + Supabase Stack

## Layout

```
src/
  app/              # Routes, layouts, pages
  components/       # React UI
  lib/              # Simulator + shared utilities
  lib/supabase/
    client.ts       # Browser client (Client Components)
    server.ts       # Server Components / Route Handlers
    middleware.ts   # Session refresh helper
  middleware.ts     # Supabase auth session middleware
```

## Supabase usage

**Client Component:**

```typescript
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();
```

**Server Component / Route Handler:**

```typescript
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.

## Environment

Copy `.env.local.example` → `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Mirror these in Vercel project settings for production.

## Commands

```bash
npm run dev      # local dev (Turbopack)
npm run build    # production build
npm run lint     # ESLint
```

## UI notes

- Tailwind CSS v4; globals in `src/app/globals.css`
- Dark sci-fi aesthetic fits the hackathon theme
- Prefer Server Components; add `"use client"` only when needed (canvas, interactivity, Supabase browser client)
