# Relic Ring Protocol — Agent Guide

Launch 26 hackathon: interplanetary network routing simulator.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind) in `src/`
- Supabase clients in `src/lib/supabase/` (browser, server, middleware)
- Deploy target: Vercel
- Full spec: [problem.md](./problem.md)

## Conventions

- Put simulator logic in `src/lib/` (physics, codec, routing, geometry)
- Put UI and milestones in `src/app/` and `src/components/`
- Use `@/` import alias
- Keep `.env` secrets out of commits; use `.env.local.example` as the template
- Minimize scope — one focused change per task

## Agent skills

Invoke with `/skill-name` or `@skill-name` in chat:

| Skill | Use when |
|-------|----------|
| `relic-ring-protocol` | Building physics, codec, routing, towers, or packet logic |
| `nextjs-supabase-stack` | Pages, API routes, Supabase auth/data, Vercel deploy |
| `build-milestone` | Implementing M1–M4 demo milestones |
| `ui-ux-design` | Designing or building UI — layout, accessibility, responsive, feedback |

Skills live in `.cursor/skills/<name>/SKILL.md`.

## Milestones

1. **M1** — Load `universe-config.json`, render star map with planets + towers
2. **M2** — Send a message, show encoding change at each hop
3. **M3** — Per-hop latency breakdown (fiber / towers / atmosphere / void)
4. **M4** — Kill a planet live, reroute the next message

## Critical gotchas

See [problem.md](./problem.md). Top five:

1. Scale x/y coordinates by 100,000 km; `radius_km` is already in km
2. Tower delay = 7 ms × towers hit (dedupe if same tower sends and receives)
3. Pre-filter graph edges by Lmax (50,000,000 km) before routing
4. ASCII only inside a planet between towers; convert at the sending tower
5. Void distance uses planet centers minus radii minus atmosphere — not tower positions
