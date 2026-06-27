import type { UniverseConfig } from "./types";
import config from "../../../universe-config.json";

export function loadUniverseConfig(): UniverseConfig {
  return config as UniverseConfig;
}
