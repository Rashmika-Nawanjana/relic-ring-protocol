"use client";

import type { PlanetNode } from "@/lib/universe/types";

type PlanetDetailCardProps = {
  node: PlanetNode;
  color: string;
  expanded: boolean;
  onRoute: boolean;
  routeIndex: number;
  isKilled: boolean;
  towerLabels: string[];
};

export function PlanetDetailCard({
  node,
  color,
  expanded,
  onRoute,
  routeIndex,
  isKilled,
  towerLabels,
}: PlanetDetailCardProps) {
  return (
    <div
      className="pointer-events-none select-none"
      style={{ minWidth: expanded ? 220 : 160 }}
    >
      <div
        className="overflow-hidden rounded-xl border shadow-2xl backdrop-blur-xl"
        style={{
          borderColor: `${color}66`,
          background: "linear-gradient(145deg, rgba(8,12,24,0.92) 0%, rgba(15,23,42,0.88) 100%)",
          boxShadow: `0 0 32px ${color}33, 0 8px 32px rgba(0,0,0,0.5)`,
        }}
      >
        <div
          className="px-3 py-2"
          style={{
            background: `linear-gradient(90deg, ${color}44 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold tracking-wide text-white">
              {node.id}
            </span>
            {isKilled ? (
              <span className="rounded-full bg-red-950/80 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-300">
                Offline
              </span>
            ) : onRoute ? (
              <span className="rounded-full bg-indigo-950/80 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
                Hop {routeIndex + 1}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Online
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-zinc-400">
            Codex Base-{node.codex}
          </p>
        </div>

        <div className="space-y-1.5 px-3 py-2.5 text-[11px]">
          <Row label="Radius" value={`${node.radius_km.toLocaleString()} km`} />
          <Row
            label="Atmosphere"
            value={`${node.atmosphere_thickness_km} km · n=${node.refraction_index}`}
          />
          <Row label="Towers" value={`${node.active_towers} relay nodes`} />

          {expanded && (
            <>
              <div className="my-2 border-t border-white/10" />
              <Row label="Grid" value={`(${node.x}, ${node.y})`} />
              <div className="mt-2">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Equatorial towers
                </p>
                <div className="flex flex-wrap gap-1">
                  {towerLabels.map((label) => (
                    <span
                      key={label}
                      className="rounded-md border border-indigo-500/30 bg-indigo-950/50 px-1.5 py-0.5 font-mono text-[10px] text-indigo-200"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                Click again to deselect · Use Kill in panel for M4 test
              </p>
            </>
          )}

          {!expanded && (
            <p className="pt-1 text-[10px] text-zinc-500">
              Click for tower map & full specs
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-zinc-500">{label}</span>
      <span className="text-right font-medium text-zinc-200">{value}</span>
    </div>
  );
}
