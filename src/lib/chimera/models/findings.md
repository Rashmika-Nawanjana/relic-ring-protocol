# Chimera Intelligence Findings (Person 1)

Walkthrough for judges — Intelligence trial and Decision Audit.

## Data sources

| CSV | Rows | Purpose |
|-----|------|---------|
| `link_traffic_history.csv` | 6,000 (500 ticks × 12 links) | Congestion penalty vs `load_ratio` |
| `link_telemetry.csv` | 6,000 | Self vs measured latency (trust) |
| `link_incident_history.csv` | 6,000 | `traffic_share` → `jammed_flag` (targeting) |

Training uses ticks **0–399**; validation uses ticks **400–499** (held out).

---

## 1. Congestion tactics

**Saturation threshold:** `load_ratio ≥ 0.9136` → `status: "saturated"`. Below that, links remain `"ok"` even under heavy load.

**Penalty curve:** Chimera adds artificial delay above ~35% load. Fitted explainable formula:

```
t = (load_ratio - 0.35) / (0.9136 - 0.35)
penalty_ms = 1,024,350 × t^1.5
```

| Load ratio | Mean observed penalty (training) |
|------------|----------------------------------|
| 0.1 | ~4.6 s |
| 0.3 | ~41 s |
| 0.5 | ~167 s |
| 0.7 | ~519 s |
| 0.8 | ~1,005 s |

**Decision Audit example:** A link at `load_ratio = 0.72` has `t ≈ 0.66`, so predicted penalty ≈ `1,024,350 × 0.66^1.5 ≈ 548,000 ms`. We mark `saturated: true` only when `load_ratio ≥ 0.9136` or API reports `status: "saturated"`.

---

## 2. Spoofed telemetry (trust)

**Systematic liars** (self-reported latency consistently ~20–70% below measured):

| Link | Under-report rate | Median relative delta | Prior trust |
|------|-------------------|----------------------|-------------|
| **Aegis-Elysium** | 71.8% | 36.9% | 0.05 |
| **Boreas-Fenix** | 69.2% | 35.1% | 0.05 |

**Honest links** (e.g. Aegis-Boreas, Dawn-Elysium): median relative delta ~2.5%, p95 noise ~5%. Priors stay **0.93–0.95**.

**Live lie detection:** At runtime we compare `self_reported_latency_ms` to load-implied expected latency (`baseline + congestion penalty`). If self-reported is >15% faster than expected, trust is discounted multiplicatively — catches spoofing even before historical prior is applied.

---

## 3. Predictable-route targeting

Chimera jams links carrying a larger slice of network traffic.

| Traffic share | Jam rate (training) |
|---------------|---------------------|
| &lt; 8% | ~6.0% |
| ≥ 10% | ~13.3% |
| ≥ 12% | ~14.9% |

**Targeting model:** Logistic on `traffic_share`, centered at **8.68%** (median jammed share × 0.85), steepness 30. Optional route-history boost (+35% max) when we over-use a link (entropy penalty).

---

## 4. Model I/O contracts (for Person 2)

```typescript
congestion.predict(link_id, live_state) → { penalty_ms, saturated: boolean }
trust.score(link_id, live_state) → { trust_score: 0–1 }
targeting.risk(link_id, live_state, our_traffic_history?) → { risk_score: 0–1 }
```

Import from `@/lib/chimera/models`.

---

## 5. Validation (ticks 400–499)

Run: `npm run test:models`

| Model | Metric | Result |
|-------|--------|--------|
| Congestion | Pearson r (predicted vs actual penalty) | > 0.85 |
| Trust | Spoofed links avg trust &lt; 0.15; honest avg &gt; 0.85 | Pass |
| Targeting | Jam rate above onset &gt; below onset | Pass |

---

## 6. Rules reminder

- Do **not** train on live `/state` during build days (scrambled values).
- Treat `saturated` + `null` self-reported as **unavailable**, not zero latency.
- `link_id` always alphabetical: `Aegis-Elysium`, never `Elysium-Aegis`.
