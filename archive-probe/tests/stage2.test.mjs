// Stage 2 unit tests: settings persistence, OS reduced-motion detection,
// Stage 1 save backward compatibility, Registrar milestone ordering & non-repetition,
// and narrative identity constraints.
// Run: node --test archive-probe/tests/stage2.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SEED, UPGRADE, UPGRADE_INFO, LAYERS } from "../src/constants.js";
import { serializeWasmState, validateSavePayload } from "../src/storage.js";
import { loadSettings, saveSettings } from "../src/settings.js";
import {
  TOOL_IDENTITY,
  DEFAULT_MILESTONES,
  REGISTRAR_MILESTONES,
  ENDING_TRANSCRIPT,
  evaluateNextMilestone,
  getAlertBadgeForMilestones,
} from "../src/narrative.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmBytes = fs.readFileSync(path.resolve(__dirname, "../src/archive_core.wasm"));

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("Product identity matches approved Stage 2 specification", () => {
  assert.equal(TOOL_IDENTITY.title, "DAJ_CATHEDRAL_BREACH_TOOL");
  assert.equal(TOOL_IDENTITY.file, "DAJ_CATHEDRAL_BREACH_TOOL.wasm");
  assert.equal(TOOL_IDENTITY.author, "Dan Almer Jensen");
});

test("Settings respect OS prefers-reduced-motion, migrate legacy mute, and persist cleanly", () => {
  const storage = createMemoryStorage();

  // Default with OS prefers-reduced-motion = true
  const reduced = loadSettings(storage, () => ({ matches: true }));
  assert.equal(reduced.reducedMotion, true);
  assert.equal(reduced.screenShake, false);
  assert.equal(reduced.audio, true);
  assert.equal(reduced.skipBoot, false);

  // Legacy Stage 1 mute flag migration
  storage.setItem("tc_archive_probe_muted_v1", "1");
  const migrated = loadSettings(storage, () => ({ matches: false }));
  assert.equal(migrated.audio, false);
  assert.equal(migrated.reducedMotion, false);

  // Save & reload custom preferences
  saveSettings({ audio: true, screenShake: false, reducedMotion: true, skipBoot: true }, storage);
  const reloaded = loadSettings(storage, () => ({ matches: false }));
  assert.deepEqual(reloaded, { audio: true, screenShake: false, reducedMotion: true, skipBoot: true });
});

test("Legacy 23-slot save payload (without milestones or cargo slots) migrates cleanly without data loss", async () => {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  instance.exports.init_world(DEFAULT_SEED);

  const payload = serializeWasmState(instance.exports.memory, { playTimeSec: 120 });
  // Simulate a Stage 1/2 legacy save (23 state slots, no milestones)
  payload.state = payload.state.slice(0, 23);
  delete payload.milestones;

  const validated = validateSavePayload(payload);
  assert.ok(validated, "Legacy 23-slot save should migrate cleanly");
  assert.equal(validated.state.length, 25);
  assert.equal(validated.state[23], 1);  // CARGO_LV default
  assert.equal(validated.state[24], 60); // MAX_CARGO default
  assert.deepEqual(validated.milestones, DEFAULT_MILESTONES);
  assert.equal(validated.playTimeSec, 120);
});

test("Registrar milestones trigger in strict ascending order and never repeat", () => {
  const triggered = { ...DEFAULT_MILESTONES };

  // Start of run: undetected
  assert.equal(evaluateNextMilestone({ py: 1, maxDepth: 1, tilesDug: 2 }, triggered), null);
  assert.equal(getAlertBadgeForMilestones(triggered).level, 0);

  // L1 triggers after meaningful excavation
  const m1 = evaluateNextMilestone({ py: 4, maxDepth: 4, tilesDug: 6 }, triggered);
  assert.equal(m1?.id, "l1");
  triggered.l1 = true;
  // Does not repeat
  assert.equal(evaluateNextMilestone({ py: 10, maxDepth: 10, tilesDug: 20 }, triggered), null);

  // L2 triggers on entering Layer 2 (Y >= 15)
  const m2 = evaluateNextMilestone({ py: 15, maxDepth: 15, tilesDug: 25 }, triggered);
  assert.equal(m2?.id, "l2");
  triggered.l2 = true;
  assert.equal(evaluateNextMilestone({ py: 22, maxDepth: 22, tilesDug: 40 }, triggered), null);

  // L3 triggers on entering Layer 3 (Y >= 30)
  const m3 = evaluateNextMilestone({ py: 30, maxDepth: 30, tilesDug: 60 }, triggered);
  assert.equal(m3?.id, "l3");
  triggered.l3 = true;

  // Gateway approach triggers at Y >= 40
  const m4 = evaluateNextMilestone({ py: 40, maxDepth: 40, tilesDug: 90 }, triggered);
  assert.equal(m4?.id, "gateway");
  triggered.gateway = true;
  assert.equal(evaluateNextMilestone({ py: 44, maxDepth: 44, tilesDug: 110 }, triggered), null);
});

test("Registrar never identifies or addresses the operator before the Final Gateway", () => {
  for (const m of REGISTRAR_MILESTONES) {
    const combined = `${m.header}\n${m.lines.join("\n")}`.toUpperCase();
    assert.equal(combined.includes("HUMAN"), false, `Pre-gateway milestone ${m.id} must not identify HUMAN`);
    assert.equal(combined.includes("DAN"), false, `Pre-gateway milestone ${m.id} must not assume DAN`);
    assert.equal(combined.includes("OPERATOR"), false, `Pre-gateway milestone ${m.id} must not address OPERATOR`);
    assert.equal(combined.includes("YOU"), false, `Pre-gateway milestone ${m.id} must not address YOU`);
  }
});

test("Player-facing upgrade & layer terminology matches approved hacking economy addendum", () => {
  assert.equal(UPGRADE_INFO[UPGRADE.DRILL].name, "BREACH ENGINE");
  assert.equal(UPGRADE_INFO[UPGRADE.BATTERY].name, "POWER CELL");
  assert.equal(UPGRADE_INFO[UPGRADE.SCANNER].name, "RECON MODULE");
  assert.equal(UPGRADE_INFO[UPGRADE.CARGO].name, "EXPLOIT BUFFER");
  assert.equal(LAYERS[0].name, "LOCAL NODE");
  const allDesc = Object.values(UPGRADE_INFO)
    .flatMap((u) => [u.name, ...u.descriptions])
    .join(" ")
    .toUpperCase();
  assert.equal(allDesc.includes("FRAG"), false);
  assert.equal(allDesc.includes("CARGO"), false);
  assert.equal(allDesc.includes("ORE"), false);
});

test("Final Gateway transcript preserves approved Registrar resolution with zero Forbidden Record references", () => {
  const full = ENDING_TRANSCRIPT.map((e) => e.text).join("\n");
  assert.ok(full.includes("OPERATOR CLASSIFICATION: HUMAN"));
  assert.ok(full.includes("AUTHORIZATION STATUS: NONE"));
  assert.ok(full.includes("AI-MADPAKKEN"));
  assert.ok(full.includes("ALBUM ZERO"));
  assert.ok(full.includes("ALBUM ONE"));
  assert.ok(full.includes("SECURITY REPORT: ACCEPTED."));
  assert.ok(full.includes("OPERATOR: REJECTED."));
  assert.ok(full.includes("SESSION TERMINATED."));
  assert.equal(full.toUpperCase().includes("FORBIDDEN"), false, "Forbidden Record must be completely removed");
});
