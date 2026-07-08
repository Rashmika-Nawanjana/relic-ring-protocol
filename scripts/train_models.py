"""Offline training for Person 1 models. Writes src/lib/chimera/models/params.ts.

Improvements over v1:
- Congestion: least-squares fit of onset + exponent on binned medians
- Trust: grid-search live_lie_gap_threshold on held-out ticks
- Targeting: maximum-likelihood logistic regression for steepness + onset
- Reports validation metrics inline
"""
from __future__ import annotations

import csv
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHALLENGE = ROOT / "challenge"
OUT = ROOT / "src" / "lib" / "chimera" / "models" / "params.ts"

HOLD_OUT_FROM_TICK = 400


def load_csv(name: str) -> list[dict[str, str]]:
    with open(CHALLENGE / name, newline="") as f:
        return list(csv.DictReader(f))


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    denom = math.sqrt(dx * dy)
    return num / denom if denom > 0 else 0.0


def mae(xs: list[float], ys: list[float]) -> float:
    return sum(abs(x - y) for x, y in zip(xs, ys)) / max(len(xs), 1)


def main() -> None:
    traffic = load_csv("link_traffic_history.csv")
    telemetry = load_csv("link_telemetry.csv")
    incidents = load_csv("link_incident_history.csv")

    links = sorted({r["link_id"] for r in traffic})
    train_traffic = [r for r in traffic if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    val_traffic = [r for r in traffic if int(r["tick"]) >= HOLD_OUT_FROM_TICK]
    train_telemetry = [r for r in telemetry if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    val_telemetry = [r for r in telemetry if int(r["tick"]) >= HOLD_OUT_FROM_TICK]
    train_incidents = [r for r in incidents if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    val_incidents = [r for r in incidents if int(r["tick"]) >= HOLD_OUT_FROM_TICK]

    # ═══════════════════════════════════════════════════════════════════
    # 1. SATURATION THRESHOLD
    # ═══════════════════════════════════════════════════════════════════
    sat_ratios = [float(r["load_ratio"]) for r in train_traffic if r["status"] == "saturated"]
    saturation_threshold = min(sat_ratios) if sat_ratios else 0.90

    # ═══════════════════════════════════════════════════════════════════
    # 2. PER-LINK PHYSICS BASELINES (p5 at low load — tighter than p10)
    # ═══════════════════════════════════════════════════════════════════
    baselines: dict[str, float] = {}
    for lid in links:
        lows = sorted([
            float(r["observed_latency_ms"])
            for r in train_traffic
            if r["link_id"] == lid
            and r["observed_latency_ms"]
            and float(r["load_ratio"]) < 0.25
        ])
        baselines[lid] = lows[max(0, len(lows) // 20)] if lows else 50_000.0

    # ═══════════════════════════════════════════════════════════════════
    # 3. CONGESTION: fit onset + exponent via grid search on train data
    # ═══════════════════════════════════════════════════════════════════
    def congestion_pearson_on(
        rows: list[dict[str, str]],
        onset_: float,
        exp_: float,
        scale_: float,
    ) -> tuple[float, float]:
        """Returns (pearson_r, mae) on given rows."""
        pred, act = [], []
        span_ = saturation_threshold - onset_
        if span_ <= 0:
            return 0.0, float("inf")
        for r in rows:
            if not r["observed_latency_ms"] or r["status"] == "saturated":
                continue
            lr = float(r["load_ratio"])
            if lr >= saturation_threshold:
                continue
            baseline = baselines.get(r["link_id"], 50_000.0)
            actual_pen = float(r["observed_latency_ms"]) - baseline
            if actual_pen < 0:
                actual_pen = 0.0
            if lr < onset_:
                pred_pen = 0.0
            else:
                t = clamp((lr - onset_) / span_)
                pred_pen = scale_ * t ** exp_
            pred.append(pred_pen)
            act.append(actual_pen)
        if len(pred) < 10:
            return 0.0, float("inf")
        return pearson(pred, act), mae(pred, act)

    best_onset = 0.35
    best_exp = 1.5
    best_r = -1.0

    for onset_try in [x / 100 for x in range(15, 50, 5)]:
        span_try = saturation_threshold - onset_try
        if span_try <= 0:
            continue

        raw_pairs: list[tuple[float, float]] = []
        for r in train_traffic:
            if not r["observed_latency_ms"] or r["status"] == "saturated":
                continue
            lr = float(r["load_ratio"])
            if lr < onset_try or lr >= saturation_threshold:
                continue
            pen = float(r["observed_latency_ms"]) - baselines.get(r["link_id"], 50_000.0)
            if pen > 0:
                t = clamp((lr - onset_try) / span_try)
                if t > 0.01:
                    raw_pairs.append((t, pen))

        if len(raw_pairs) < 20:
            continue

        for exp_try in [x / 10 for x in range(10, 35, 1)]:
            # Derive scale from median ratio of actual / t^exp
            ratios = [pen / (t ** exp_try) for t, pen in raw_pairs if t ** exp_try > 0.001]
            if not ratios:
                continue
            scale_try = statistics.median(ratios)

            r_val, _ = congestion_pearson_on(train_traffic, onset_try, exp_try, scale_try)
            if r_val > best_r:
                best_r = r_val
                best_onset = onset_try
                best_exp = exp_try

    # Recompute best scale with final onset/exp
    span_final = saturation_threshold - best_onset
    final_pairs = []
    for r in train_traffic:
        if not r["observed_latency_ms"] or r["status"] == "saturated":
            continue
        lr = float(r["load_ratio"])
        if lr < best_onset or lr >= saturation_threshold:
            continue
        pen = float(r["observed_latency_ms"]) - baselines.get(r["link_id"], 50_000.0)
        if pen > 0:
            t = clamp((lr - best_onset) / span_final)
            if t > 0.01:
                final_pairs.append((t, pen))

    best_scale = statistics.median([p / (t ** best_exp) for t, p in final_pairs if t ** best_exp > 0.001]) if final_pairs else 1_000_000.0

    val_r, val_mae = congestion_pearson_on(val_traffic, best_onset, best_exp, best_scale)
    print(f"Congestion: onset={best_onset:.2f} exp={best_exp:.1f} scale={best_scale:.0f}")
    print(f"  Train Pearson r: {best_r:.4f}")
    print(f"  Val   Pearson r: {val_r:.4f}  MAE: {val_mae:.0f} ms")

    # ═══════════════════════════════════════════════════════════════════
    # 4. TRUST: per-link priors + grid-search lie gap threshold
    # ═══════════════════════════════════════════════════════════════════
    link_priors: dict[str, float] = {}
    spoofed: list[str] = []

    for lid in links:
        deltas: list[float] = []
        signed_deltas: list[float] = []
        under = 0
        total = 0
        for r in train_telemetry:
            if r["link_id"] != lid:
                continue
            if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
                continue
            self_r = float(r["self_reported_latency_ms"])
            meas = float(r["measured_latency_ms"])
            deltas.append(abs(self_r - meas) / max(meas, 1))
            signed_deltas.append((meas - self_r) / max(meas, 1))
            total += 1
            if self_r < meas * 0.80:
                under += 1

        median_delta = statistics.median(deltas) if deltas else 0.03
        median_signed = statistics.median(signed_deltas) if signed_deltas else 0.0
        under_rate = under / total if total else 0

        # Improved prior: weight under-report rate and signed median gap
        prior = 0.96 - under_rate * 0.80 - max(0, median_signed - 0.03) * 2.5
        prior = clamp(prior, 0.05, 0.99)
        link_priors[lid] = round(prior, 4)
        if under_rate >= 0.25:
            spoofed.append(lid)

    # Grid-search lie gap threshold and penalty multiplier on validation
    traffic_by_key = {f"{r['link_id']}:{r['tick']}": r for r in traffic}

    def eval_trust_params(
        gap_thresh: float, lie_mult: float, noise_p95: float
    ) -> tuple[float, float]:
        """Returns (spoof_avg, honest_avg) on validation ticks."""
        spoof_scores: list[float] = []
        honest_scores: list[float] = []

        for r in val_telemetry:
            if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
                continue
            lid = r["link_id"]
            t_row = traffic_by_key.get(f"{lid}:{r['tick']}")
            if not t_row or t_row["status"] == "saturated":
                continue

            lr = float(t_row["load_ratio"])
            self_rep = float(r["self_reported_latency_ms"])

            baseline = baselines.get(lid, 50_000.0)
            if lr < best_onset:
                expected = baseline
            elif lr >= saturation_threshold:
                continue
            else:
                t = clamp((lr - best_onset) / span_final)
                expected = baseline + best_scale * t ** best_exp

            if expected <= 0:
                continue

            prior = link_priors.get(lid, 0.9)
            rel_gap = (expected - self_rep) / expected
            trust = prior

            if rel_gap > gap_thresh:
                lie_pen = min(0.90, (rel_gap - gap_thresh) * lie_mult)
                trust *= 1 - lie_pen
            if rel_gap < -noise_p95:
                trust = min(1, trust * 1.02)

            trust = clamp(trust)
            if lid in spoofed:
                spoof_scores.append(trust)
            else:
                honest_scores.append(trust)

        s_avg = sum(spoof_scores) / max(len(spoof_scores), 1)
        h_avg = sum(honest_scores) / max(len(honest_scores), 1)
        return s_avg, h_avg

    best_gap = 0.15
    best_lie_mult = 2.5
    best_noise = 0.05
    best_trust_sep = 0.0

    for gap in [x / 100 for x in range(5, 30, 2)]:
        for mult in [x / 10 for x in range(15, 45, 5)]:
            for noise in [0.03, 0.05, 0.07]:
                s, h = eval_trust_params(gap, mult, noise)
                sep = h - s
                # Want: spoof < 0.15 AND honest > 0.80 AND max separation
                if s < 0.15 and h > 0.80 and sep > best_trust_sep:
                    best_trust_sep = sep
                    best_gap = gap
                    best_lie_mult = mult
                    best_noise = noise

    s_final, h_final = eval_trust_params(best_gap, best_lie_mult, best_noise)
    print(f"\nTrust: gap_thresh={best_gap:.2f} lie_mult={best_lie_mult:.1f} noise_p95={best_noise:.2f}")
    print(f"  Val spoof avg:  {s_final:.4f}")
    print(f"  Val honest avg: {h_final:.4f}")
    print(f"  Separation:     {h_final - s_final:.4f}")
    print(f"  Spoofed links:  {spoofed}")

    # ═══════════════════════════════════════════════════════════════════
    # 5. TARGETING: per-link intercept logistic + rolling share features
    # ═══════════════════════════════════════════════════════════════════
    def logistic(x: float) -> float:
        return 1 / (1 + math.exp(-x)) if x > -700 else 0.0

    # Per-link jam base rate from training data
    link_jam_counts: dict[str, int] = defaultdict(int)
    link_total_counts: dict[str, int] = defaultdict(int)
    for r in train_incidents:
        lid = r["link_id"]
        link_total_counts[lid] += 1
        if r["jammed_flag"] == "True":
            link_jam_counts[lid] += 1

    link_jam_rates: dict[str, float] = {}
    global_jam_rate = sum(link_jam_counts.values()) / max(sum(link_total_counts.values()), 1)
    for lid in links:
        if link_total_counts[lid] >= 10:
            link_jam_rates[lid] = round(link_jam_counts[lid] / link_total_counts[lid], 4)
        else:
            link_jam_rates[lid] = round(global_jam_rate, 4)

    # Build rolling 5-tick average share + prev-tick jam flag
    incidents_by_link_tick: dict[str, dict[int, dict[str, str]]] = defaultdict(dict)
    for r in incidents:
        incidents_by_link_tick[r["link_id"]][int(r["tick"])] = r

    def get_rolling_share(lid: str, tick: int, window: int = 5) -> float:
        shares = []
        for dt in range(1, window + 1):
            prev = incidents_by_link_tick.get(lid, {}).get(tick - dt)
            if prev and prev["traffic_share"]:
                shares.append(float(prev["traffic_share"]))
        return sum(shares) / len(shares) if shares else 0.0833  # uniform 1/12

    def was_jammed_prev(lid: str, tick: int) -> float:
        prev = incidents_by_link_tick.get(lid, {}).get(tick - 1)
        return 1.0 if prev and prev["jammed_flag"] == "True" else 0.0

    # MLE logistic regression: steep * (share - center) + bias_w * link_bias
    #   + rolling_w * rolling_avg + prev_w * was_jammed_prev
    def neg_log_likelihood(steep: float, center: float, bias_w: float,
                           rolling_w: float, prev_w: float) -> float:
        nll = 0.0
        for r in train_incidents:
            if not r["traffic_share"]:
                continue
            share = float(r["traffic_share"])
            lid = r["link_id"]
            tick = int(r["tick"])
            bias = link_jam_rates.get(lid, global_jam_rate) - global_jam_rate
            roll_s = get_rolling_share(lid, tick)
            was_j = was_jammed_prev(lid, tick)
            z = (steep * (share - center) + bias_w * bias
                 + rolling_w * (roll_s - 0.0833) + prev_w * was_j)
            p = logistic(z)
            p = clamp(p, 1e-7, 1 - 1e-7)
            if r["jammed_flag"] == "True":
                nll -= math.log(p)
            else:
                nll -= math.log(1 - p)
        return nll

    best_nll = float("inf")
    best_steep = 30.0
    best_center = 0.0868
    best_bias_w = 0.0
    best_rolling_w = 0.0
    best_prev_w = 0.0

    print("\nTargeting: stage 1 — steep × center...")
    for steep_try in [x / 10 for x in range(50, 800, 25)]:
        for center_try in [x / 1000 for x in range(40, 200, 5)]:
            nll = neg_log_likelihood(steep_try, center_try, 0.0, 0.0, 0.0)
            if nll < best_nll:
                best_nll = nll
                best_steep = steep_try
                best_center = center_try

    print(f"  Best: steep={best_steep:.1f} center={best_center:.4f} NLL={best_nll:.2f}")

    print("Targeting: stage 2 — bias_w + rolling_w...")
    for bias_w_try in [x / 10 for x in range(0, 120, 5)]:
        for rolling_w_try in [x / 10 for x in range(0, 120, 5)]:
            nll = neg_log_likelihood(best_steep, best_center, bias_w_try,
                                     rolling_w_try, 0.0)
            if nll < best_nll:
                best_nll = nll
                best_bias_w = bias_w_try
                best_rolling_w = rolling_w_try

    print(f"  Best: bias_w={best_bias_w:.1f} rolling_w={best_rolling_w:.1f} NLL={best_nll:.2f}")

    print("Targeting: stage 3 — prev_w + fine-tune steep/center...")
    for prev_w_try in [x / 10 for x in range(0, 30, 2)]:
        for steep_adj in [-5.0, -2.5, 0.0, 2.5, 5.0]:
            for center_adj in [-0.010, -0.005, 0.0, 0.005, 0.010]:
                s_ = best_steep + steep_adj
                c_ = best_center + center_adj
                if s_ < 1 or c_ < 0.01:
                    continue
                nll = neg_log_likelihood(s_, c_, best_bias_w,
                                         best_rolling_w, prev_w_try)
                if nll < best_nll:
                    best_nll = nll
                    best_steep = s_
                    best_center = c_
                    best_prev_w = prev_w_try

    print(f"  Final: steep={best_steep:.1f} center={best_center:.4f} prev_w={best_prev_w:.1f} NLL={best_nll:.2f}")

    def eval_targeting(steep: float, center: float, bias_w: float,
                       rolling_w: float, prev_w: float,
                       rows: list[dict[str, str]]) -> tuple[float, float, float]:
        jam_scores: list[float] = []
        safe_scores: list[float] = []
        for r in rows:
            if not r["traffic_share"]:
                continue
            share = float(r["traffic_share"])
            lid = r["link_id"]
            tick = int(r["tick"])
            bias = link_jam_rates.get(lid, global_jam_rate) - global_jam_rate
            roll_s = get_rolling_share(lid, tick)
            was_j = was_jammed_prev(lid, tick)
            z = (steep * (share - center) + bias_w * bias
                 + rolling_w * (roll_s - 0.0833) + prev_w * was_j)
            risk = logistic(z)
            if r["jammed_flag"] == "True":
                jam_scores.append(risk)
            else:
                safe_scores.append(risk)
        j = sum(jam_scores) / max(len(jam_scores), 1)
        s = sum(safe_scores) / max(len(safe_scores), 1)
        correct = 0
        total = 0
        for js in jam_scores:
            for ss in safe_scores[:200]:
                total += 1
                if js > ss:
                    correct += 1
                elif js == ss:
                    correct += 0.5
        auc = correct / max(total, 1)
        return j, s, auc

    tj, ts_, t_auc = eval_targeting(best_steep, best_center, best_bias_w,
                                     best_rolling_w, best_prev_w, val_incidents)
    print(f"Targeting: steep={best_steep:.1f} center={best_center:.4f} bias_w={best_bias_w:.1f} "
          f"rolling_w={best_rolling_w:.1f} prev_w={best_prev_w:.1f}")
    print(f"  Per-link jam rates: {dict(sorted(link_jam_rates.items(), key=lambda x: -x[1])[:5])} ...")
    print(f"  Global jam rate:    {global_jam_rate:.4f}")
    print(f"  Val jam avg risk:   {tj:.4f}")
    print(f"  Val safe avg risk:  {ts_:.4f}")
    print(f"  Separation:         {tj - ts_:.4f}")
    print(f"  AUC (approx):       {t_auc:.4f}")

    # ═══════════════════════════════════════════════════════════════════
    # 6. COST WEIGHT OPTIMIZATION
    # ═══════════════════════════════════════════════════════════════════
    # The combined cost formula:
    #   cost = physics + congestion + (1-trust)×physics×trust_scale + risk×physics×risk_scale
    # We want: routes through spoofed/jammed links to have higher combined cost.
    # Grid-search trust_scale and risk_scale to maximize the "bad link" vs "good link"
    # cost ratio on validation data.

    def eval_cost_weights(t_scale: float, r_scale: float) -> float:
        """Returns average cost ratio: bad_links / good_links on val ticks."""
        bad_costs: list[float] = []
        good_costs: list[float] = []
        traffic_by_tick: dict[str, dict[str, str]] = {}
        for r in val_traffic:
            traffic_by_tick[f"{r['link_id']}:{r['tick']}"] = r

        for r in val_telemetry:
            lid = r["link_id"]
            t_row = traffic_by_tick.get(f"{lid}:{r['tick']}")
            if not t_row or t_row["status"] == "saturated":
                continue
            if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
                continue

            lr = float(t_row["load_ratio"])
            baseline = baselines.get(lid, 50_000.0)

            # Congestion penalty
            if lr < best_onset:
                cong_pen = 0.0
            elif lr >= saturation_threshold:
                continue
            else:
                t = clamp((lr - best_onset) / span_final)
                cong_pen = best_scale * t ** best_exp

            # Trust score
            self_rep = float(r["self_reported_latency_ms"])
            expected = baseline + cong_pen
            prior = link_priors.get(lid, 0.9)
            rel_gap = (expected - self_rep) / max(expected, 1)
            trust = prior
            if rel_gap > best_gap:
                trust *= 1 - min(0.90, (rel_gap - best_gap) * best_lie_mult)
            trust = clamp(trust)

            # Targeting risk (simplified: just logistic on traffic_share)
            share = float(t_row.get("load_ratio", "0.0833"))  # approximate
            # Use incident data if available
            inc_key = f"{lid}:{r['tick']}"
            risk_val = 0.1  # default
            for inc in val_incidents:
                if inc["link_id"] == lid and inc["tick"] == r["tick"]:
                    if inc["traffic_share"]:
                        s = float(inc["traffic_share"])
                        bias = (link_jam_rates.get(lid, global_jam_rate) - global_jam_rate)
                        risk_val = logistic(best_steep * (s - best_center) + best_bias_w * bias)
                    break

            trust_adj = (1 - trust) * baseline * t_scale
            risk_adj = risk_val * baseline * r_scale
            combined = baseline + cong_pen + trust_adj + risk_adj

            is_bad = lid in spoofed
            if is_bad:
                bad_costs.append(combined)
            else:
                good_costs.append(combined)

        if not bad_costs or not good_costs:
            return 0.0
        return (sum(bad_costs) / len(bad_costs)) / max(sum(good_costs) / len(good_costs), 1)

    best_cost_ratio = 0.0
    best_trust_scale = 0.5
    best_risk_scale = 0.3

    for ts_try in [x / 10 for x in range(1, 20, 1)]:
        for rs_try in [x / 10 for x in range(1, 15, 1)]:
            ratio = eval_cost_weights(ts_try, rs_try)
            if ratio > best_cost_ratio:
                best_cost_ratio = ratio
                best_trust_scale = ts_try
                best_risk_scale = rs_try

    print(f"\nCost weights: trust_scale={best_trust_scale:.1f} risk_scale={best_risk_scale:.1f}")
    print(f"  Bad/good cost ratio: {best_cost_ratio:.3f}")

    # ═══════════════════════════════════════════════════════════════════
    # 7. WRITE PARAMS
    # ═══════════════════════════════════════════════════════════════════
    params = {
        "saturation_load_ratio": round(saturation_threshold, 4),
        "congestion_onset_ratio": round(best_onset, 4),
        "congestion_exponent": round(best_exp, 1),
        "congestion_scale_ms": round(best_scale, 1),
        "link_baselines_ms": {k: round(v, 2) for k, v in baselines.items()},
        "link_trust_priors": link_priors,
        "spoofed_links": sorted(spoofed),
        "honest_noise_p95": best_noise,
        "live_lie_gap_threshold": best_gap,
        "live_lie_penalty_mult": best_lie_mult,
        "targeting_jam_onset_share": round(best_center, 4),
        "targeting_steepness": round(best_steep, 1),
        "targeting_bias_weight": round(best_bias_w, 1),
        "targeting_rolling_weight": round(best_rolling_w, 1),
        "targeting_prev_jam_weight": round(best_prev_w, 1),
        "link_jam_rates": link_jam_rates,
        "global_jam_rate": round(global_jam_rate, 4),
        "cost_trust_scale": round(best_trust_scale, 1),
        "cost_risk_scale": round(best_risk_scale, 1),
        "hold_out_from_tick": HOLD_OUT_FROM_TICK,
    }

    ts_code = (
        "/** Auto-generated by scripts/train_models.py — do not edit by hand. */\n"
        f"export const TRAINED_PARAMS = {json.dumps(params, indent=2)} as const;\n\n"
        "export type TrainedParams = typeof TRAINED_PARAMS;\n"
    )
    OUT.write_text(ts_code, encoding="utf-8")
    print(f"\nWrote {OUT}")


if __name__ == "__main__":
    main()
