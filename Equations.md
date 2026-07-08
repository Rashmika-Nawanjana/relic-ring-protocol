# Universe Routing & Latency Mathematical Reference

## 1. Void Distance (L)

### Formula

```text
L = √((x₂ - x₁)² + (y₂ - y₁)²) × S
    - (R₁ + h₁)
    - (R₂ + h₂)
```

### Symbol Definitions

| Symbol   | Description                                         |
| -------- | --------------------------------------------------- |
| (x₁, y₁) | Coordinates of the origin planet center             |
| (x₂, y₂) | Coordinates of the destination planet center        |
| S        | `coordinate_scale_unit_km` from `universe_metadata` |
| R₁       | `radius_km` of the origin planet                    |
| R₂       | `radius_km` of the destination planet               |
| h₁       | `atmosphere_thickness_km` of the origin planet      |
| h₂       | `atmosphere_thickness_km` of the destination planet |

---

## 2. Void Travel Time (Tv)

### Formula

```text
Tv = ((h₁ × n₁) + (h₂ × n₂) + L) / C
```

### Symbol Definitions

| Symbol | Description                                  |
| ------ | -------------------------------------------- |
| h₁     | Atmosphere thickness of origin planet        |
| h₂     | Atmosphere thickness of destination planet   |
| n₁     | Refraction index of origin planet            |
| n₂     | Refraction index of destination planet       |
| L      | Void distance from Formula 1                 |
| C      | `speed_of_light_kms` (default: 300,000 km/s) |

---

## 3. Internal Crust Transit Time (Tp)

### Formula

```text
Tp = (2πr × s) / (N × f × C) + (m × Δt)
```

### Symbol Definitions

| Symbol | Description                                      |
| ------ | ------------------------------------------------ |
| r      | `radius_km` of the current planet                |
| N      | `active_towers` of the current planet            |
| s      | Number of tower segments traveled along the ring |
| m      | Number of distinct towers hit                    |
| f      | `fiber_speed_fraction` (default: 0.67)           |
| C      | `speed_of_light_kms`                             |
| Δt     | `tower_processing_delay_ms` (default: 7 ms)      |

### Notes

* `s` represents the angular distance between the entry and exit towers.
* If the entry tower equals the exit tower, then:

```text
s = 0
m = 1
```

* In general:

```text
m = s + 1
```

---

# End-to-End Route Composition

## Core Rules

1. One `Tp` calculation per planet visited (handles internal routing and tower processing delay).
2. One `Tv` calculation per void hop between consecutive planets.
3. No double-counting.
4. `Δt` only contributes through the `(m × Δt)` term inside `Tp`.

---

## Total Latency

For a route containing `k` planets:

```text
Total Latency =
Σ(i=1→k) Tp(Pi)
+
Σ(i=1→k−1) Tv(Pi, Pi+1)
```

Where:

* `Tp(Pi)` = Internal crust transit time on planet `Pi`
* `Tv(Pi, Pi+1)` = Void travel time between consecutive planets

