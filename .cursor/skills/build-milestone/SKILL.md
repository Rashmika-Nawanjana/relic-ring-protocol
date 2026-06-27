---
name: build-milestone
description: >-
  Implements Relic Ring Protocol demo milestones M1–M4 — star map, multi-hop
  trace, latency breakdown, and live planet kill/reroute. Use when the user
  asks to build, demo, or ship a milestone.
---

# Build Milestone

Check [problem.md](../../../problem.md) and [AGENTS.md](../../../AGENTS.md) first.

## M1 — Universe init

- [ ] Load `universe-config.json` into typed models
- [ ] Render star map: planets at scaled coordinates, towers on equators
- [ ] Show planet labels and tower markers (clockwise from 12 o'clock)

**Suggested files:** `src/lib/universe/`, `src/components/StarMap.tsx`

## M2 — Multi-hop trace

- [ ] UI to send a message (origin → destination)
- [ ] Walk route hop-by-hop; show payload encoding at each planet
- [ ] Display hop log entries (planet, tower, action, latency)

**Depends on:** codec + routing engines

## M3 — Latency breakdown

- [ ] For each hop, show T_fiber, T_towers, T_atmosphere, T_void separately
- [ ] Show route total and per-hop subtotals

**Depends on:** physics engine

## M4 — Chaos test

- [ ] Toggle to mark a planet offline
- [ ] Next send recomputes route excluding dead nodes
- [ ] UI shows old vs new path; no crash on kill

**Depends on:** fault-tolerant routing

## Workflow

1. Confirm which milestone (M1–M4)
2. Implement lib layer first, then wire UI
3. Run `npm run build` before marking done
4. Keep demo data driven from `universe-config.json`
