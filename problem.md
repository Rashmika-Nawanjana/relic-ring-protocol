# The Relic Ring Protocol — Hackathon Overview

## What's the Challenge?

You're building a **network routing simulator** set in a sci-fi universe. Think of it as implementing a custom internet protocol, but instead of Earth's internet, it's an interplanetary laser/fiber network with physics-based latency calculations, alien number systems, and fault tolerance.

---

## The Universe at a Glance

You're given a `universe-config.json` with **6 planets**:

| Planet | Codex (Base) | Notable Trait |
|--------|-------------|---------------|
| Aegis | Base 8 | Origin-ish, Earth-sized |
| Boreas | Base 5 | Small, thick atmosphere |
| Dawn | Base 6 | Tiny planet |
| Elysium | Base 10 | Large, very thick atmosphere |
| Fenix | Base 16 | Tiny, near-vacuum atmo |
| Caelum | Base 14 | Massive (gas giant scale) |

Each planet sits at `(x, y)` coordinates (scaled by 100,000 km/unit), has towers around its equator, and its own "dialect" (numerical base).

---

## The Four Core Systems You Must Build

### 1. 🔭 Physics Engine — Latency Calculation
Every packet hop has **4 latency components**:

```
T_total = T_fiber + T_towers + T_atmosphere + T_void
```

- **T_fiber** — arc distance between towers on a planet's surface, at 0.67c
- **T_towers** — 7ms × number of towers hit
- **T_atmosphere** — signal slows through atmosphere: `h / (c / n)` for each planet crossed
- **T_void** — laser across vacuum: `L / c`
  where `L = center_distance × scale − (R₁ + h₁) − (R₂ + h₂)`

**Lmax constraint:** No single void hop > 50,000,000 km → must route through intermediate planets or declare undeliverable.

---

### 2. 🔤 Codec Engine — Data Translation
Every planet speaks a different number base. As a packet travels:

```
ASCII inside planet → convert to NEXT planet's base → serialize to binary → void → receive as that base → decode back to ASCII → repeat
```

Example: `'H'` (ASCII 72):
- Leaving for Base-5 planet → `242` (base 5)
- Leaving for Base-14 planet → `52` (base 14)

---

### 3. 🗺️ Routing Engine — Shortest Path + Fault Tolerance
- Implement **Dijkstra's algorithm** (or similar) on the planet graph, using latency as the edge weight
- Respect the **Lmax** constraint (edges > 50M km don't exist)
- Support **dynamic node/link killing** — when a planet goes down, reroute instantly without crashing

---

### 4. 🗼 Tower Placement — Geometry
Towers are placed **clockwise starting from top (12 o'clock)**:
```
angle_i = i × (360° / active_towers)   [starting from +y axis, clockwise]
```
For a void transmission, pick the **tower pair** (one per planet) with the **minimum straight-line distance** between them — that's your send/receive tower. Then the fiber arc inside each planet routes from your logical entry tower to that optimal tower.

---

## The Packet Schema

```json
{
  "origin_id": "Aegis",
  "destination_id": "Caelum",
  "current_id": "Boreas",
  "payload": "[242, 401, 413...]",  // in current hop's encoding
  "hop_log": [
    { "planet": "Aegis", "tower": "T_3", "action": "send", "latency_ms": 42.3 },
    ...
  ]
}
```

---

## What the Demo Must Show (Your 4 Milestones)

| Milestone | What to prove |
|-----------|--------------|
| **M1** Universe Init | Load config, render the star map with all planets + towers |
| **M2** Multi-hop trace | Send a message, show encoding changing at each hop |
| **M3** Latency breakdown | Per-component breakdown (fiber/tower/atmo/void) for the route |
| **M4** Chaos test | Kill a planet live, show next message reroutes around it |

---


---

## Biggest Gotchas to Watch

1. **Coordinate scaling** — multiply x/y by 100,000 km. `radius_km` is already in km, don't scale it.
2. **Tower delay is per tower hit, not per hop** — count them carefully (sending tower + receiving tower, but if same tower does both, count once)
3. **Lmax check before building the graph** — pre-filter edges, don't check during routing
4. **ASCII internal transit** — inside a planet between towers, always ASCII. Only convert to next-hop's base at the sending tower.
5. **Void distance formula** uses planet centers minus radii minus atmosphere thickness — not tower positions

Want me to start scaffolding the actual code for any of these components?