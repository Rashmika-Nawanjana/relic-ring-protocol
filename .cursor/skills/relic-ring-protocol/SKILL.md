---
name: relic-ring-protocol
description: >-
  Implements the Relic Ring Protocol hackathon simulator — physics latency,
  base-N codec, Dijkstra routing with Lmax, tower geometry, and packet hops.
  Use when building universe-config loading, latency math, encoding translation,
  routing, tower placement, or packet trace logic.
---

# Relic Ring Protocol

Read [problem.md](../../../problem.md) for the full spec. Implement core logic under `src/lib/`.

## Four systems

### 1. Physics engine

```
T_total = T_fiber + T_towers + T_atmosphere + T_void
```

- **T_fiber**: arc distance between towers on surface at 0.67c
- **T_towers**: 7 ms × number of towers hit (dedupe same tower)
- **T_atmosphere**: `h / (c / n)` per planet crossed
- **T_void**: `L / c` where `L = center_distance × scale − (R₁ + h₁) − (R₂ + h₂)`
- **Lmax**: void hop > 50,000,000 km → no direct edge; route via intermediates or undeliverable

### 2. Codec engine

Inside a planet between towers: always ASCII.

At sending tower only: convert ASCII → next hop planet's base → serialize for void.

Example: `'H'` (72) → base 5: `242`, base 14: `52`.

### 3. Routing engine

- Build planet graph; pre-filter edges where void distance > Lmax
- Dijkstra (or equivalent) with latency as edge weight
- Support killing nodes/links at runtime; reroute without crashing

### 4. Tower placement

Clockwise from 12 o'clock (+y): `angle_i = i × (360° / active_towers)`.

For void hops: pick tower pair (one per planet) with minimum straight-line distance.

## Packet shape

```json
{
  "origin_id": "Aegis",
  "destination_id": "Caelum",
  "current_id": "Boreas",
  "payload": "[242, 401, 413...]",
  "hop_log": [
    { "planet": "Aegis", "tower": "T_3", "action": "send", "latency_ms": 42.3 }
  ]
}
```

## Planets (bases)

| Planet | Base |
|--------|------|
| Aegis | 8 |
| Boreas | 5 |
| Dawn | 6 |
| Elysium | 10 |
| Fenix | 16 |
| Caelum | 14 |

## Implementation order

1. Types + load `universe-config.json`
2. Tower geometry helpers
3. Latency components (unit-test each)
4. Codec (base conversion + ASCII round-trip)
5. Graph build + Dijkstra + fault tolerance
6. Packet orchestration + hop log
