# Relic Ring Protocol

Launch 26 hackathon — interplanetary network routing simulator.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Vercel** — deployment
- **Supabase** — database & auth

## Getting started

```bash
npm install
cp .env.local.example .env.local
# Add your Supabase URL and anon key from the Supabase dashboard
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

Set the same variables in your [Vercel project settings](https://vercel.com/docs/projects/environment-variables) when deploying.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Add the Supabase environment variables.
4. Deploy.

## Project structure

```
src/
  app/              # Next.js App Router pages
  lib/supabase/     # Supabase browser, server, and middleware clients
  middleware.ts     # Refreshes Supabase auth sessions
```

See [problem.md](./problem.md) for the full hackathon spec.
