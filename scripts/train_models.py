"""
Offline training for Person 1 Chimera models.
Writes src/lib/chimera/models/params.ts from challenge CSVs only.

Competition rules:
- Train on CSVs, never on live /state
- Models must stay explainable for Decision Audit
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
SATURATION_DEFAULT = 0.90
CONGESTION_ONSET = 0.35
POWER_LAW_WEIGHT = 0.5
LOAD_BIN_COUNT = 10
SHARE_BINS = [0, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.16, 0.20, 0.30, 1.0]
ROUTE_ENTROPY_WEIGHT = 0.25


def load_csv(name: str) -> list[dict[str, str]]:
    with open(CHALLENGE / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 2:
        return 0.0
    mx, my = statistics.mean(xs), statistics.mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs)
    dy = sum((y - my) ** 2 for y in ys)
    return num / math.sqrt(dx * dy) if dx and dy else 0.0


def fit_link_congestion(
    rows: list[dict[str, str]],
    saturation: float,
) -> dict[str, float | list[float]]:
    """Per-link hybrid: power-law + load-bin median penalties."""
    lows = [
        float(r["observed_latency_ms"])
        for r in rows
        if r["observed_latency_ms"]
        and r["status"] != "saturated"
        and float(r["load_ratio"]) < 0.25
    ]
    baseline = sorted(lows)[max(0, len(lows) // 10)] if lows else 50_000.0

    span = saturation - CONGESTION_ONSET
    points: list[tuple[float, float]] = []
    bin_penalties: dict[int, list[float]] = defaultdict(list)

    for r in rows:
        if not r["observed_latency_ms"] or r["status"] == "saturated":
            continue
        lr = float(r["load_ratio"])
        pen = float(r["observed_latency_ms"]) - baseline
        if pen < 0:
            continue
        b = min(LOAD_BIN_COUNT - 1, int(lr * LOAD_BIN_COUNT))
        bin_penalties[b].append(pen)
        if lr >= CONGESTION_ONSET:
            t = clamp((lr - CONGESTION_ONSET) / span, 0, 1)
            points.append((t, pen))

    best_scale, best_exp, best_rmse = 500_000.0, 1.5, float("inf")
    for exp_int in range(8, 45):
        exp = exp_int / 10.0
        ratios = [pen / (t**exp + 1e-9) for t, pen in points if t > 0.01]
        if not ratios:
            continue
        scale = statistics.median(ratios)
        errs = [(scale * (t**exp) - pen) ** 2 for t, pen in points]
        rmse = math.sqrt(statistics.mean(errs))
        if rmse < best_rmse:
            best_rmse, best_scale, best_exp = rmse, scale, exp

    # Fill 10 bins; fall back to power-law prediction at bin centre
    load_bin_penalty_ms: list[float] = []
    for b in range(LOAD_BIN_COUNT):
        centre_lr = (b + 0.5) / LOAD_BIN_COUNT
        t = clamp((centre_lr - CONGESTION_ONSET) / span, 0, 1) if centre_lr >= CONGESTION_ONSET else 0
        fallback = best_scale * (t**best_exp)
        if b in bin_penalties and bin_penalties[b]:
            load_bin_penalty_ms.append(round(statistics.median(bin_penalties[b]), 1))
        else:
            load_bin_penalty_ms.append(round(fallback, 1))

    return {
        "baseline_ms": round(baseline, 2),
        "scale_ms": round(best_scale, 1),
        "exponent": round(best_exp, 2),
        "load_bin_penalty_ms": load_bin_penalty_ms,
    }


def fit_trust_profile(telemetry_rows: list[dict[str, str]]) -> dict[str, float]:
    deltas: list[float] = []
    under = 0
    total = 0
    self_measured_ratios: list[float] = []

    for r in telemetry_rows:
        if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
            continue
        self_r = float(r["self_reported_latency_ms"])
        meas = float(r["measured_latency_ms"])
        deltas.append(abs(self_r - meas) / max(meas, 1))
        self_measured_ratios.append(meas / max(self_r, 1))
        total += 1
        if self_r < meas * 0.80:
            under += 1

    deltas.sort()
    p95_gap = deltas[int(len(deltas) * 0.95)] if deltas else 0.05
    under_rate = under / total if total else 0.0
    is_spoofed = under_rate >= 0.25

    if is_spoofed:
        prior = 0.05
    else:
        prior = 0.97 - max(0, p95_gap - 0.04) * 3 - under_rate * 0.5
        prior = clamp(prior, 0.75, 0.99)

    return {
        "prior": round(prior, 4),
        "p95_gap": round(p95_gap, 4),
        "under_report_rate": round(under_rate, 4),
    }


def fit_targeting_bins(incidents: list[dict[str, str]]) -> dict[str, list[float]]:
    """Calibrated jam rate per traffic_share bin (Laplace-smoothed)."""
    rates: list[float] = []
    for i in range(len(SHARE_BINS) - 1):
        rows = [
            r
            for r in incidents
            if r["traffic_share"]
            and SHARE_BINS[i] <= float(r["traffic_share"]) < SHARE_BINS[i + 1]
        ]
        jams = sum(1 for r in rows if r["jammed_flag"] == "True")
        rate = (jams + 1) / (len(rows) + 12) if rows else 0.08
        rates.append(round(rate, 4))
    return {
        "share_bins": SHARE_BINS,
        "share_jam_rates": rates,
    }


def predict_congestion_penalty(
    curve: dict,
    lr: float,
    saturation: float,
) -> float:
    if lr >= saturation:
        return float("inf")
    if lr < CONGESTION_ONSET:
        return 0.0
    span = saturation - CONGESTION_ONSET
    t = clamp((lr - CONGESTION_ONSET) / span, 0, 1)
    power = curve["scale_ms"] * (t ** curve["exponent"])
    b = min(LOAD_BIN_COUNT - 1, int(lr * LOAD_BIN_COUNT))
    binned = curve["load_bin_penalty_ms"][b]
    return POWER_LAW_WEIGHT * power + (1 - POWER_LAW_WEIGHT) * binned


def predict_trust_score(
    lid: str,
    lr: float,
    self_ms: float,
    curve: dict,
    prof: dict,
    saturation: float,
    spoofed: set[str],
) -> float:
    pen = predict_congestion_penalty(curve, lr, saturation)
    if pen == float("inf"):
        return 0.0
    expected = curve["baseline_ms"] + pen

    if lid in spoofed:
        gap = (expected - self_ms) / max(expected, 1)
        return clamp(0.05 + 0.1 * sigmoid(-gap * 10))

    gap = (expected - self_ms) / max(expected, 1)
    threshold = prof["p95_gap"] + 0.03
    trust = prof["prior"]
    if gap > threshold:
        trust *= 1 - min(0.4, (gap - threshold) * 1.5)
    return clamp(trust)


def predict_targeting_risk(share: float, targeting: dict) -> float:
    bins = targeting["share_bins"]
    rates = targeting["share_jam_rates"]
    for i in range(len(bins) - 1):
        if bins[i] <= share < bins[i + 1]:
            return rates[i]
    return rates[-1]


def _auc(scores: list[float], labels: list[int]) -> float:
    pairs = sorted(zip(scores, labels), reverse=True)
    tp = fp = 0
    tps = sum(labels)
    fps = len(labels) - tps
    if tps == 0 or fps == 0:
        return 0.5
    auc = prev_fpr = prev_tpr = 0.0
    for _, lab in pairs:
        if lab:
            tp += 1
        else:
            fp += 1
        tpr = tp / tps
        fpr = fp / fps
        auc += (fpr - prev_fpr) * (tpr + prev_tpr) / 2
        prev_fpr, prev_tpr = fpr, tpr
    return auc


def evaluate_holdout(params: dict) -> dict[str, float]:
    traffic = load_csv("link_traffic_history.csv")
    telemetry = load_csv("link_telemetry.csv")
    incidents = load_csv("link_incident_history.csv")
    traffic_by_key = {(r["link_id"], r["tick"]): r for r in traffic}

    sat = params["saturation_load_ratio"]
    curves = params["link_congestion"]
    trust_prof = params["link_trust"]
    spoofed = set(params["spoofed_links"])
    targeting = params["targeting"]

    pred_p, act_p = [], []
    for r in traffic:
        if int(r["tick"]) < HOLD_OUT_FROM_TICK:
            continue
        if not r["observed_latency_ms"] or r["status"] == "saturated":
            continue
        lid = r["link_id"]
        lr = float(r["load_ratio"])
        c = curves[lid]
        pr = predict_congestion_penalty(c, lr, sat)
        act = float(r["observed_latency_ms"]) - c["baseline_ms"]
        if act >= 0 and pr < float("inf"):
            pred_p.append(pr)
            act_p.append(act)

    spoof_scores, honest_scores = [], []
    for r in telemetry:
        if int(r["tick"]) < HOLD_OUT_FROM_TICK:
            continue
        if not r["self_reported_latency_ms"] or not r["measured_latency_ms"]:
            continue
        lid = r["link_id"]
        tr = traffic_by_key.get((lid, r["tick"]))
        if not tr or tr["status"] == "saturated":
            continue
        ts = predict_trust_score(
            lid,
            float(tr["load_ratio"]),
            float(r["self_reported_latency_ms"]),
            curves[lid],
            trust_prof[lid],
            sat,
            spoofed,
        )
        if lid in spoofed:
            spoof_scores.append(ts)
        else:
            honest_scores.append(ts)

    risks, labels = [], []
    for r in incidents:
        if int(r["tick"]) < HOLD_OUT_FROM_TICK or not r["traffic_share"]:
            continue
        tr = traffic_by_key.get((r["link_id"], r["tick"]))
        if not tr or tr["status"] == "saturated":
            continue
        risks.append(predict_targeting_risk(float(r["traffic_share"]), targeting))
        labels.append(1 if r["jammed_flag"] == "True" else 0)

    mape = statistics.mean(abs(p - a) / max(a, 1) for p, a in zip(pred_p, act_p)) if pred_p else 1

    return {
        "congestion_pearson": round(pearson(pred_p, act_p), 4),
        "congestion_mape": round(mape, 4),
        "trust_spoof_avg": round(statistics.mean(spoof_scores), 4) if spoof_scores else 0,
        "trust_honest_avg": round(statistics.mean(honest_scores), 4) if honest_scores else 0,
        "trust_honest_false_flag": round(
            sum(1 for s in honest_scores if s < 0.5) / len(honest_scores), 4
        )
        if honest_scores
        else 0,
        "targeting_auc": round(_auc(risks, labels), 4),
    }


def main() -> None:
    traffic = load_csv("link_traffic_history.csv")
    telemetry = load_csv("link_telemetry.csv")
    incidents = load_csv("link_incident_history.csv")

    links = sorted({r["link_id"] for r in traffic})
    train_traffic = [r for r in traffic if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    train_telemetry = [r for r in telemetry if int(r["tick"]) < HOLD_OUT_FROM_TICK]
    train_incidents = [r for r in incidents if int(r["tick"]) < HOLD_OUT_FROM_TICK]

    sat_ratios = [float(r["load_ratio"]) for r in train_traffic if r["status"] == "saturated"]
    saturation_threshold = min(sat_ratios) if sat_ratios else SATURATION_DEFAULT

    link_congestion: dict[str, dict] = {}
    for lid in links:
        rows = [r for r in train_traffic if r["link_id"] == lid]
        link_congestion[lid] = fit_link_congestion(rows, saturation_threshold)

    link_trust: dict[str, dict] = {}
    spoofed: list[str] = []
    for lid in links:
        rows = [r for r in train_telemetry if r["link_id"] == lid]
        prof = fit_trust_profile(rows)
        link_trust[lid] = prof
        if prof["under_report_rate"] >= 0.25:
            spoofed.append(lid)

    link_jam_priors: dict[str, float] = {}
    for lid in links:
        rows = [r for r in train_incidents if r["link_id"] == lid and r["traffic_share"]]
        jams = sum(1 for r in rows if r["jammed_flag"] == "True")
        link_jam_priors[lid] = round((jams + 1) / (len(rows) + 12), 4) if rows else 0.08

    targeting = fit_targeting_bins(train_incidents)

    params: dict = {
        "saturation_load_ratio": round(saturation_threshold, 4),
        "congestion_onset_ratio": CONGESTION_ONSET,
        "power_law_weight": POWER_LAW_WEIGHT,
        "load_bin_count": LOAD_BIN_COUNT,
        "link_congestion": link_congestion,
        "link_trust": link_trust,
        "spoofed_links": sorted(spoofed),
        "link_jam_priors": link_jam_priors,
        "targeting": targeting,
        "route_entropy_weight": ROUTE_ENTROPY_WEIGHT,
        "hold_out_from_tick": HOLD_OUT_FROM_TICK,
    }

    metrics = evaluate_holdout(params)
    params["validation_metrics"] = metrics

    ts = (
        "/** Auto-generated by scripts/train_models.py — do not edit by hand. */\n"
        f"export const TRAINED_PARAMS = {json.dumps(params, indent=2)} as const;\n\n"
        "export type TrainedParams = typeof TRAINED_PARAMS;\n"
    )
    OUT.write_text(ts, encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"Spoofed links: {spoofed}")
    print(f"Saturation threshold: {saturation_threshold:.4f}")
    print("Hold-out metrics:")
    for k, v in metrics.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
