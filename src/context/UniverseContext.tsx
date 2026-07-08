"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loadUniverseConfig } from "@/lib/universe/load";
import { buildScenePlanets } from "@/lib/universe/geometry";
import { findRoute, buildVoidEdges, traceFixedRoute } from "@/lib/universe/router";
import type { CopilotReport } from "@/lib/copilot/schema";
import type { LinkHealthStatus } from "@/lib/chimera/panel-data";
import type {
  RouteResult,
  ScenePlanet,
  UniverseConfig,
} from "@/lib/universe/types";

export type SceneSettings = {
  sunIntensity: number;
  orbitSpeed: number;
  rotationSpeed: number;
  showOrbits: boolean;
  showTowers: boolean;
  showTowerPaths: boolean;
};

export type CopilotSendInput = {
  text?: string;
  origin?: string;
  destination?: string;
  message?: string;
};

type UniverseContextValue = {
  config: UniverseConfig;
  planets: ScenePlanet[];
  edges: ReturnType<typeof buildVoidEdges>;
  killed: Set<string>;
  killedLinks: Set<string>;
  selectedId: string | null;
  hoveredId: string | null;
  route: string[];
  routeResult: RouteResult | null;
  isSending: boolean;
  packetTransmitKey: number;
  sceneSettings: SceneSettings;
  copilotReport: CopilotReport | null;
  copilotError: string | null;
  isCopilotSending: boolean;
  linkHealthMap: Map<string, LinkHealthStatus>;
  chimeraTick: number | null;
  trafficHistory: string[];
  setSceneSettings: (patch: Partial<SceneSettings>) => void;
  setLinkHealthMap: (map: Map<string, LinkHealthStatus>) => void;
  setChimeraTick: (tick: number) => void;
  resetView: () => void;
  resetViewTick: number;
  setSelectedId: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  toggleKill: (id: string) => void;
  toggleKillLink: (key: string) => void;
  sendPacket: (origin: string, destination: string, message: string) => Promise<void>;
  sendCopilot: (input: CopilotSendInput) => Promise<void>;
};

const UniverseContext = createContext<UniverseContextValue | null>(null);

const DEFAULT_SCENE: SceneSettings = {
  sunIntensity: 1.9,
  orbitSpeed: 1,
  rotationSpeed: 1,
  showOrbits: true,
  showTowers: true,
  showTowerPaths: true,
};

export function UniverseProvider({ children }: { children: ReactNode }) {
  const config = useMemo(() => loadUniverseConfig(), []);
  const planets = useMemo(() => buildScenePlanets(config), [config]);
  const [killed, setKilled] = useState<Set<string>>(new Set());
  const [killedLinks, setKilledLinks] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [route, setRoute] = useState<string[]>([]);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [packetTransmitKey, setPacketTransmitKey] = useState(0);
  const [sceneSettings, setSceneSettingsState] = useState<SceneSettings>(DEFAULT_SCENE);
  const [resetViewTick, setResetViewTick] = useState(0);
  const [copilotReport, setCopilotReport] = useState<CopilotReport | null>(null);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [isCopilotSending, setIsCopilotSending] = useState(false);
  const [linkHealthMap, setLinkHealthMap] = useState<Map<string, LinkHealthStatus>>(
    new Map(),
  );
  const [chimeraTick, setChimeraTick] = useState<number | null>(null);
  const [trafficHistory, setTrafficHistory] = useState<string[]>([]);

  const edges = useMemo(
    () => buildVoidEdges(config, killed, killedLinks),
    [config, killed, killedLinks],
  );

  const setSceneSettings = useCallback((patch: Partial<SceneSettings>) => {
    setSceneSettingsState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetView = useCallback(() => {
    setSelectedId(null);
    setResetViewTick((n) => n + 1);
  }, []);

  const clearRoute = useCallback(() => {
    setRoute([]);
    setRouteResult(null);
  }, []);

  const toggleKill = useCallback(
    (id: string) => {
      setKilled((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      clearRoute();
      setCopilotReport(null);
    },
    [clearRoute],
  );

  const toggleKillLink = useCallback(
    (key: string) => {
      setKilledLinks((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      clearRoute();
      setCopilotReport(null);
    },
    [clearRoute],
  );

  const sendPacket = useCallback(
    async (origin: string, destination: string, message: string) => {
      setIsSending(true);
      setCopilotReport(null);
      setCopilotError(null);
      await new Promise((r) => setTimeout(r, 400));
      const result = findRoute(
        config,
        origin,
        destination,
        killed,
        message,
        killedLinks,
      );
      setRouteResult(result);
      setRoute(result.ok ? result.route : []);
      if (result.ok) setPacketTransmitKey((k) => k + 1);
      setIsSending(false);
    },
    [config, killed, killedLinks],
  );

  const sendCopilot = useCallback(
    async (input: CopilotSendInput) => {
      setIsCopilotSending(true);
      setCopilotError(null);
      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            killed: [...killed],
            killed_links: [...killedLinks],
            traffic_history: trafficHistory,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "CoPilot routing failed");
        }

        const report: CopilotReport = {
          origin_id: data.origin_id,
          destination_id: data.destination_id,
          chosen_path: data.chosen_path,
          link_evaluations: data.link_evaluations,
          final_latency_estimate_ms: data.final_latency_estimate_ms,
          explanation: data.explanation,
        };

        setCopilotReport(report);
        setRoute(report.chosen_path);

        const message =
          input.message ??
          (input.text?.match(/:\s*(.+)$/)?.[1]?.trim() || "Hello world");

        const trace = traceFixedRoute(
          config,
          report.chosen_path,
          message,
          killed,
          killedLinks,
        );
        setRouteResult(trace);
        if (trace.ok) setPacketTransmitKey((k) => k + 1);

        setTrafficHistory((prev) => [
          ...prev,
          ...report.link_evaluations.map((e) => e.link_id),
        ].slice(-24));
      } catch (e) {
        setCopilotError(e instanceof Error ? e.message : "CoPilot failed");
        setCopilotReport(null);
      } finally {
        setIsCopilotSending(false);
      }
    },
    [config, killed, killedLinks, trafficHistory],
  );

  return (
    <UniverseContext.Provider
      value={{
        config,
        planets,
        edges,
        killed,
        killedLinks,
        selectedId,
        hoveredId,
        route,
        routeResult,
        isSending,
        packetTransmitKey,
        sceneSettings,
        copilotReport,
        copilotError,
        isCopilotSending,
        linkHealthMap,
        chimeraTick,
        trafficHistory,
        setSceneSettings,
        setLinkHealthMap,
        setChimeraTick,
        resetView,
        resetViewTick,
        setSelectedId,
        setHoveredId,
        toggleKill,
        toggleKillLink,
        sendPacket,
        sendCopilot,
      }}
    >
      {children}
    </UniverseContext.Provider>
  );
}

export function useUniverse() {
  const ctx = useContext(UniverseContext);
  if (!ctx) throw new Error("useUniverse must be used within UniverseProvider");
  return ctx;
}
