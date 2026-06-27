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
import { findRoute, buildVoidEdges } from "@/lib/universe/router";
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
  setSceneSettings: (patch: Partial<SceneSettings>) => void;
  resetView: () => void;
  resetViewTick: number;
  setSelectedId: (id: string | null) => void;
  setHoveredId: (id: string | null) => void;
  toggleKill: (id: string) => void;
  toggleKillLink: (key: string) => void;
  sendPacket: (origin: string, destination: string, message: string) => Promise<void>;
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
    },
    [clearRoute],
  );

  const sendPacket = useCallback(
    async (origin: string, destination: string, message: string) => {
      setIsSending(true);
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
        setSceneSettings,
        resetView,
        resetViewTick,
        setSelectedId,
        setHoveredId,
        toggleKill,
        toggleKillLink,
        sendPacket,
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
