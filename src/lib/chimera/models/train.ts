/**
 * Offline training entry point (Person 1).
 *
 * Regenerates `params.ts` from challenge CSVs via Python trainer.
 * Run: npm run train:models
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const script = path.join(root, "scripts", "train_models.py");

const result = spawnSync("python", [script], {
  cwd: root,
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Model params regenerated at src/lib/chimera/models/params.ts");
