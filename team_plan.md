# Team Task Breakdown

## Person A — Core Engine (Physics + Routing)

### Files to own:
- `lib/physics.ts`
- `lib/router.ts`
- `lib/universe.ts`
- `app/api/route/route.ts`
- `app/api/kill/route.ts`

### Tasks in order:
1. Write config loader — parse `universe-config.json`, return typed `Planet[]`
2. Build edge graph — compute all planet pairs, filter by Lmax, store latency as weight
3. Implement Dijkstra on the graph
4. Write all 4 latency functions (fiber, tower, atmosphere, void)
5. API route `POST /api/route` — accepts origin + destination, returns full path + total latency
6. API route `POST /api/kill` — accepts planet/link id, marks it dead, invalidates graph
7. Handle undeliverable route (no path found → return error clearly)

---

## Person B — Codec + Packet Engine

### Files to own:
- `lib/codec.ts`
- `lib/towers.ts`
- `lib/packet.ts`
- `app/api/send/route.ts`

### Tasks in order:
1. Write `toBase()` and `fromBase()` — test against the Hello World example in the doc
2. Write `encodePayload()` and `decodePayload()`
3. Build tower geometry — given a planet, return all tower positions (clockwise from top)
4. Write tower pair selector — given two planets, find the pair with minimum void distance
5. Build fiber arc calculator — given two towers on same planet, compute arc length
6. Build the full Packet engine — takes a route from Person A, walks hop by hop, builds complete `hop_log` with encoding at each step
7. API route `POST /api/send` — accepts origin, destination, message → returns full packet with hop_log

---

## Person C — UI + Visualizer + Deployment

### Files to own:
- `app/page.tsx`
- `components/StarMap.tsx`
- `components/PacketTrace.tsx`
- `components/LatencyBreakdown.tsx`
- `components/ControlPanel.tsx`

### Tasks in order:
1. Set up Next.js project, push to GitHub, connect Vercel — get a live URL early
2. Build `StarMap.tsx` — render all planets as circles on SVG canvas, correct relative positions
3. Add tower markers on each planet (clockwise from top, correct count)
4. Add `ControlPanel.tsx` — origin dropdown, destination dropdown, message input, Send button, Kill Node button
5. Wire Send button to `POST /api/send` — show loading state
6. Animate the packet path on the star map — highlight planets in route order with a delay
7. Build `PacketTrace.tsx` — show hop log table with encoding at each planet
8. Build `LatencyBreakdown.tsx` — show fiber/tower/atmosphere/void per hop as a bar or table
9. Add kill node UI — click a planet on the map to kill it, show it greyed out, re-send to prove rerouting

---

## Sync Points (do these together)

| Time | Sync |
|------|------|
| Hour 1 end | All agree on types, repo structure, config loader works |
| Hour 3 end | A + B can do a terminal test end-to-end (no UI yet) |
| Hour 4 end | C can call the APIs and show a working trace on screen |
| Hour 5 end | Kill node demo works, record the video |
| Hour 6 | README, cleanup, final Vercel deploy |

---

## Shared Rule
> Person A's API must return data. Person B's packet engine feeds it. Person C just calls the API and displays what comes back. **No one waits for anyone else after Hour 1.**