# Relic Ring Protocol

**Zeta-26 interplanetary routing simulator**. A 3D visualization and protocol engine that reads `universe-config.json`, computes lowest-latency routes under physical constraints, translates payloads across planetary codexes, and reroutes around failed nodes or severed void links.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional Supabase auth (not required for the simulator):

```bash
cp .env.local.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Production build:

```bash
npm run build
npm start
```

Deploy to [Vercel](https://vercel.com/new) — import the repo and deploy. Supabase env vars are optional; middleware skips auth when they are unset.

---

## What this implements

| System | Description |
|--------|-------------|
| **Physics engine** | Fiber (`Tp`), tower delay, atmospheric refraction, void laser (`Tv`) — all constants from `universe_metadata` |
| **Codec** | ASCII internal transit; encode to next-hop codex at send/receive towers |
| **Routing** | Dijkstra with `(planet, previous)` state for path-dependent fiber costs; **Lmax** enforced on graph edges |
| **Resilience** | Kill planets or sever void links; next packet reroutes without crashing |
| **Visualization** | React Three Fiber solar-system view, packet animation, live transit bar |

See [problem.md](./problem.md) for the full spec and [Equations.md](./Equations.md) for formulas.

---

## Configuration

All planetary values come from **`universe-config.json`** at the repo root — nothing is hardcoded per planet.

| Field | Source | Role |
|-------|--------|------|
| `speed_of_light_kms` | metadata | 300,000 km/s default |
| `fiber_speed_fraction` | metadata | 0.67c on equatorial fiber |
| `tower_processing_delay_ms` | metadata | 7 ms per tower hit |
| `max_void_hop_distance_km` | metadata | Lmax = 50,000,000 km |
| `coordinate_scale_unit_km` | metadata | Scales x/y grid to km |
| `nodes[].codex` | per planet | Receive base for encoding |
| `nodes[].active_towers` | per planet | Tower count (≥ 4) |

**Assumptions** (aligned with spec §6):

- Planets are 2D circles; towers are evenly spaced clockwise from 12 o'clock.
- Void distance `L` uses center-to-center distance minus radii and atmosphere thickness (tower angle does not alter `L`).
- Atmospheric transit uses thickness `h` straight through the shell.
- One `Tp` per planet visit; one `Tv` per void hop; atmosphere is counted inside `Tv`, not duplicated in `Tp`.

---

## API

### `GET /api/universe`

Returns the parsed `universe-config.json`.

### `POST /api/route`

```json
{
  "origin": "Aegis",
  "destination": "Caelum",
  "message": "Hello world",
  "killed": ["Dawn"],
  "killed_links": ["Aegis-Dawn"]
}
```

Response on success includes:

- `route` — planet id path
- `total_latency_ms`
- `hops` — full tower-level hop log
- `per_hop_latency` — labeled fiber/tower/atmo/void breakdown
- `packet` — `{ origin_id, destination_id, current_id, payload, hop_log, route, total_latency_ms }`

---

## Project structure

```
universe-config.json          # Dynamic universe definition
src/lib/universe/
  load.ts                     # Config loader
  geometry.ts                 # Positions, towers, void distance L
  physics.ts                  # Tp, Tv, latency components
  codec.ts                    # ASCII ↔ codex encoding
  router.ts                   # Dijkstra + hop log + packet builder
  packet-path.ts              # 3D animation path
src/components/
  SimulatorApp.tsx            # Main layout
  ControlPanel.tsx            # Send, kill node, sever link
  PacketTrace.tsx             # Encoding + hop log + packet schema
  LatencyBreakdown.tsx        # Route totals + per-hop table
  PacketLiveFeed.tsx          # Live transit bar on canvas
  solar-system/               # R3F 3D scene
src/app/api/                  # REST endpoints
```
---

## Controls

| Input | Action |
|-------|--------|
| Left-drag | Pan |
| Right-drag | Orbit |
| Scroll | Zoom |
| Click planet | Select (fly-to) |
| Reset camera | View panel (top-left) |

---

## Evaluation checklist

| Criterion | Status |
|-----------|--------|
| End-to-end delivery + codex + hop logs | ✅ |
| Latency: fiber, tower, refraction, void | ✅ (see Equations.md) |
| Resilience: dead nodes + severed links | ✅ |
| Lmax + shortest-latency routing | ✅ |
| Dynamic config parsing | ✅ |
| README + demo script | ✅ |

---

## License

Hackathon submission — University of Kelaniya Launch 26 / IEEE Computer Society.
