# Chimera Intelligence Findings (Person 1)

Walkthrough for judges — Intelligence trial and Decision Audit.

## Data sources

| CSV | Rows | Purpose |
|-----|------|---------|
| `link_traffic_history.csv` | 6,000 (500 ticks × 12 links) | Congestion penalty vs `load_ratio` |
| `link_telemetry.csv` | 6,000 | Self vs measured latency (trust) |
| `link_incident_history.csv` | 6,000 | `traffic_share` → `jammed_flag` (targeting) |

Training uses ticks **0–399**; validation uses ticks **400–499** (held out).  
**Never trained on live `/state`** (competition rule).

---

## 1. Congestion model (hybrid per-link)

**Saturation:** `load_ratio ≥ 0.9136` or `status: "saturated"` → link unavailable.

**Per-link hybrid formula** (explainable):

```
t = (load_ratio − 0.35) / (0.9136 − 0.35)
power_penalty = scale_link × t^exponent_link
bin_penalty   = median historical penalty at this load bin (10 bins)
penalty_ms    = 0.5 × power_penalty + 0.5 × bin_penalty
```

Each link has its own `baseline_ms`, `scale_ms`, `exponent`, and `load_bin_penalty_ms[]`.

**Hold-out accuracy:** Pearson r ≈ **0.96**, MAPE ≈ **72%** (down from 81% with global curve).

---

## 2. Trust model (per-link profiles)

**Systematic spoofers** (self-reported ≈30–70% below measured):

| Link | Under-report rate | Prior trust |
|------|-------------------|-------------|
| **Aegis-Elysium** | 71.8% | 0.05 |
| **Boreas-Fenix** | 69.2% | 0.05 |

**Honest links:** per-link `p95_gap` ≈ 4.5–4.8%. Live lie detection only penalizes gaps above `p95_gap + 3%`.

**Hold-out accuracy:**
- Spoofed avg trust: **0.09**
- Honest avg trust: **0.85**
- Honest false-flag rate: **0%**

---

## 3. Targeting model (calibrated share bins)

Chimera jams links with higher network `traffic_share`. We use **Laplace-smoothed jam rates** per share bin:

| Share range | Training jam rate |
|-------------|-------------------|
| 0–3% | ~5.5% |
| 5–7% | ~7.3% |
| 13–16% | ~17.6% |
| 30%+ | ~17.9% |

**Route entropy:** +25% risk boost when our router over-uses a link recently.

**Hold-out accuracy:** AUC ≈ **0.69** (up from 0.59 with single logistic on share).

---

## 4. Model I/O contracts (Person 2)

```typescript
import { predictCongestion, scoreTrust, targetingRisk } from "@/lib/chimera/models";

congestion.predict(link_id, live_state) → { penalty_ms, saturated }
trust.score(link_id, live_state) → { trust_score: 0–1 }
targeting.risk(link_id, live_state, our_traffic_history?) → { risk_score: 0–1 }
```

---

## 5. Validation

```bash
npm run train:models   # Regenerate params.ts from CSVs
npm run test:models    # Held-out ticks 400–499
```

| Model | Metric | Result |
|-------|--------|--------|
| Congestion | Pearson r | **0.96** |
| Congestion | MAPE | **72%** |
| Trust | Spoof detection | **100%** flagged |
| Trust | Honest false flags | **0%** |
| Targeting | AUC | **0.69** |

---

## 6. Decision Audit cheat sheet

**Congestion:** "At load 0.72 on Aegis-Boreas, bin 7 median penalty is ~354s; power-law gives ~400s; blend ≈ 377s."

**Trust:** "Aegis-Elysium has 72% under-report history; self-reported 40% below load-implied latency → trust 0.05."

**Targeting:** "traffic_share 14% falls in 13–16% bin with 17.6% historical jam rate → risk_score 0.176."
