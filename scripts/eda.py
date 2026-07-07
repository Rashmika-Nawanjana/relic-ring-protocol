import csv
import statistics
from collections import defaultdict

traffic = list(csv.DictReader(open("challenge/link_traffic_history.csv")))
telemetry = list(csv.DictReader(open("challenge/link_telemetry.csv")))
incidents = list(csv.DictReader(open("challenge/link_incident_history.csv")))

baselines = {}
for lid in {r["link_id"] for r in traffic}:
    lows = [
        float(r["observed_latency_ms"])
        for r in traffic
        if r["link_id"] == lid
        and r["observed_latency_ms"]
        and float(r["load_ratio"]) < 0.3
    ]
    baselines[lid] = sorted(lows)[len(lows) // 10] if lows else 0

points = []
for r in traffic:
    if not r["observed_latency_ms"] or r["status"] == "saturated":
        continue
    lid = r["link_id"]
    lr = float(r["load_ratio"])
    penalty = float(r["observed_latency_ms"]) - baselines[lid]
    if penalty >= 0:
        points.append((lr, penalty))

bins = defaultdict(list)
for lr, pen in points:
    bins[round(lr, 1)].append(pen)

print("Load ratio bin -> mean penalty:")
for b in sorted(bins.keys()):
    if len(bins[b]) > 5:
        print(f"  {b:.1f}: mean_pen={statistics.mean(bins[b]):.0f} n={len(bins[b])}")

print("\nTargeting jam rate by share threshold:")
for thresh in [0.05, 0.08, 0.10, 0.12, 0.15, 0.20]:
    above = [r for r in incidents if r["traffic_share"] and float(r["traffic_share"]) >= thresh]
    below = [r for r in incidents if r["traffic_share"] and float(r["traffic_share"]) < thresh]
    ja = sum(1 for r in above if r["jammed_flag"] == "True") / len(above) if above else 0
    jb = sum(1 for r in below if r["jammed_flag"] == "True") / len(below) if below else 0
    print(f"  share>={thresh}: jam={ja:.3f} (n={len(above)}), below={jb:.3f} (n={len(below)})")

ticks = sorted({int(r["tick"]) for r in traffic})
print(f"\nTicks: {ticks[0]}-{ticks[-1]}, count={len(ticks)}")

# Fit power law above knee
knee = 0.5
above_knee = [(lr, pen) for lr, pen in points if lr >= knee]
if above_knee:
  # log-log slope
  import math
  xs = [math.log(lr - knee + 0.01) for lr, _ in above_knee if lr > knee]
  ys = [math.log(p + 1) for lr, p in above_knee if lr > knee]
  if xs:
    mean_x = statistics.mean(xs)
    mean_y = statistics.mean(ys)
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den = sum((x - mean_x) ** 2 for x in xs)
    slope = num / den if den else 0
    intercept = mean_y - slope * mean_x
    print(f"Power law above knee {knee}: penalty ~ exp({intercept:.2f}) * (load-{knee})^{slope:.2f}")
