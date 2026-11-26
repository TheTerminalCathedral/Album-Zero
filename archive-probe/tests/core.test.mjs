// Automated unit & integration tests for archive_core.wasm and storage.js
// Run: node --test archive-probe/tests/core.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SEED,
  GRID_W,
  GRID_H,
  GRID_SIZE,
  MEM_TILES_OFFSET,
  MEM_HP_OFFSET,
  MEM_FLAGS_OFFSET,
  STATE,
  DIR,
  TILE,
  FLAG,
  EVENT,
  UPGRADE,
} from "../src/constants.js";
import { saveGame, loadGame, restoreWasmState, clearSave, SAVE_KEY } from "../src/storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WASM_PATH = path.resolve(__dirname, "../src/archive_core.wasm");
const wasmBytes = fs.readFileSync(WASM_PATH);

async function createCore(seed = DEFAULT_SEED) {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const wasm = instance.exports;
  wasm.init_world(seed);
  return {
    wasm,
    memory: wasm.memory,
    tiles: () => new Uint8Array(wasm.memory.buffer, MEM_TILES_OFFSET, GRID_SIZE),
    hp: () => new Uint8Array(wasm.memory.buffer, MEM_HP_OFFSET, GRID_SIZE),
    flags: () => new Uint8Array(wasm.memory.buffer, MEM_FLAGS_OFFSET, GRID_SIZE),
  };
}

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("WASM binary is valid and initializes expected starting state", async () => {
  assert.equal(WebAssembly.validate(wasmBytes), true);
  const { wasm, tiles } = await createCore();
  assert.equal(wasm.get_state(STATE.PX), 11);
  assert.equal(wasm.get_state(STATE.PY), 0);
  assert.equal(wasm.get_state(STATE.ENERGY), 70);
  assert.equal(wasm.get_state(STATE.MAX_ENERGY), 70);
  assert.equal(wasm.get_state(STATE.DRILL_LV), 1);
  assert.equal(wasm.get_state(STATE.BATTERY_LV), 1);
  assert.equal(wasm.get_state(STATE.SCANNER_LV), 1);
  assert.equal(wasm.get_state(STATE.CARGO_LV), 1);
  assert.equal(wasm.get_state(STATE.MAX_CARGO), 60);
  assert.equal(wasm.get_state(STATE.COMPLETED), 0);

  // Gateway chamber exists at row 44-45
  const grid = tiles();
  assert.equal(grid[44 * GRID_W + 11], TILE.GATEWAY_SEAL);
  assert.equal(grid[45 * GRID_W + 11], TILE.CATHEDRAL_GATEWAY);
  assert.equal(grid[45 * GRID_W + 12], TILE.CATHEDRAL_GATEWAY);
});

test("Movement, collision bounds, and drilling into Cache Block & Data Shard", async () => {
  const { wasm, tiles } = await createCore();

  // Moving up from Row 0 hits bounds -> BLOCKED_HARD
  assert.equal(wasm.step_move(DIR.UP), EVENT.BLOCKED_HARD);
  assert.equal(wasm.get_state(STATE.PY), 0);

  // Tile (11,1) is guaranteed CACHE_BLOCK (HP 3). Drill Lv 1 deals 1 dmg/hit.
  assert.equal(tiles()[1 * GRID_W + 11], TILE.CACHE_BLOCK);
  const hit1 = wasm.step_move(DIR.DOWN);
  assert.equal(hit1, EVENT.DRILLED_HIT);
  assert.equal(wasm.get_state(STATE.PY), 0); // still on surface until broken
  assert.equal(wasm.get_state(STATE.ENERGY), 69); // surface strike costs 1 E

  assert.equal(wasm.step_move(DIR.DOWN), EVENT.DRILLED_HIT);
  const hit3 = wasm.step_move(DIR.DOWN);
  assert.equal(hit3, EVENT.BLOCK_BROKEN);
  assert.equal(wasm.get_state(STATE.PY), 1);
  assert.equal(tiles()[1 * GRID_W + 11], TILE.EMPTY);
  assert.equal(wasm.get_state(STATE.TILES_DUG), 1);
  assert.equal(wasm.get_state(STATE.EXPEDITIONS), 1);

  // Returning to surface recharges energy to 100%
  const up = wasm.step_move(DIR.UP);
  assert.equal(up, EVENT.MOVED);
  assert.equal(wasm.get_state(STATE.PY), 0);
  assert.equal(wasm.get_state(STATE.ENERGY), 70);
});

test("Collecting shards, banking on surface, and buying upgrades", async () => {
  const { wasm, tiles } = await createCore();

  // Dig down to (11,1) -> (11,2) -> left to (10,2) which is guaranteed DATA_SHARD (+10)
  // First clear (11,1)
  wasm.step_move(DIR.DOWN);
  wasm.step_move(DIR.DOWN);
  // Clear (11,2)
  while (wasm.get_state(STATE.PY) < 2) wasm.step_move(DIR.DOWN);
  assert.equal(tiles()[2 * GRID_W + 10], TILE.DATA_SHARD);

  // Drill left into DATA_SHARD at (10,2)
  let ev = 0;
  while (wasm.get_state(STATE.PX) > 10) {
    ev = wasm.step_move(DIR.LEFT);
  }
  assert.equal(ev, EVENT.FRAGMENT_COLLECTED);
  assert.equal(wasm.get_state(STATE.CARRIED), 10);
  assert.equal(wasm.get_state(STATE.BANKED), 0);

  // Upgrade while underground must fail
  assert.equal(wasm.buy_upgrade(UPGRADE.SCANNER), EVENT.UPGRADE_FAILED);

  // Use Tether Recall to return to surface & bank 100%
  const rec = wasm.trigger_recall();
  assert.equal(rec, EVENT.TETHER_RECALL);
  assert.equal(wasm.get_state(STATE.PY), 0);
  assert.equal(wasm.get_state(STATE.CARRIED), 0);
  assert.equal(wasm.get_state(STATE.BANKED), 10);
  assert.equal(wasm.get_state(STATE.ENERGY), 70);

  // Give enough banked fragments via memory to verify upgrade transactions
  const stateView = new Int32Array(wasm.memory.buffer, 0, 23);
  stateView[STATE.BANKED] = 250;

  // Buy Drill Lv 2 (80), Battery Lv 2 (70), Scanner Lv 2 (60) -> total 210, leaving 40
  assert.equal(wasm.buy_upgrade(UPGRADE.DRILL), EVENT.UPGRADE_BOUGHT);
  assert.equal(wasm.get_state(STATE.DRILL_LV), 2);
  assert.equal(wasm.get_state(STATE.BANKED), 170);

  assert.equal(wasm.buy_upgrade(UPGRADE.BATTERY), EVENT.UPGRADE_BOUGHT);
  assert.equal(wasm.get_state(STATE.BATTERY_LV), 2);
  assert.equal(wasm.get_state(STATE.MAX_ENERGY), 120);
  assert.equal(wasm.get_state(STATE.ENERGY), 120);
  assert.equal(wasm.get_state(STATE.BANKED), 100);

  assert.equal(wasm.buy_upgrade(UPGRADE.SCANNER), EVENT.UPGRADE_BOUGHT);
  assert.equal(wasm.get_state(STATE.SCANNER_LV), 2);
  assert.equal(wasm.get_state(STATE.BANKED), 40);
});

test("Drill level gating blocks Layer 2 cipher blocks until Drill Lv 2", async () => {
  const { wasm, tiles } = await createCore();
  const stateView = new Int32Array(wasm.memory.buffer, 0, 23);
  // Place probe right above row 15 (CIPHER_BLOCK) with Drill Lv 1
  tiles()[14 * GRID_W + 11] = TILE.EMPTY;
  stateView[STATE.PX] = 11;
  stateView[STATE.PY] = 14;
  stateView[STATE.DRILL_LV] = 1;

  assert.equal(tiles()[15 * GRID_W + 11], TILE.CIPHER_BLOCK);
  const ev = wasm.step_move(DIR.DOWN);
  assert.equal(ev, EVENT.BLOCKED_DRILL_LV);
  assert.equal(wasm.get_state(STATE.EVENT_ARG), 2);

  // Upgrade drill to Lv 2 -> can now drill CIPHER_BLOCK
  stateView[STATE.DRILL_LV] = 2;
  const hit = wasm.step_move(DIR.DOWN);
  assert.equal(hit, EVENT.DRILLED_HIT);
});

test("Energy depletion triggers Emergency Extraction salvaging 65% cargo and preserving tunnels & upgrades", async () => {
  const { wasm, tiles } = await createCore();
  const stateView = new Int32Array(wasm.memory.buffer, 0, 23);

  // Carve a tunnel at (11,1) and move underground with 100 carried & 1 energy left
  while (wasm.get_state(STATE.PY) < 1) wasm.step_move(DIR.DOWN);
  assert.equal(tiles()[1 * GRID_W + 11], TILE.EMPTY);

  stateView[STATE.DRILL_LV] = 2;
  stateView[STATE.BANKED] = 50;
  stateView[STATE.CARRIED] = 100;
  stateView[STATE.ENERGY] = 1;

  // Move into empty tile or drill -> energy hits 0 -> EMERGENCY_EXTRACT
  tiles()[2 * GRID_W + 11] = TILE.EMPTY;
  const ev = wasm.step_move(DIR.DOWN);
  assert.equal(ev, EVENT.EMERGENCY_EXTRACT);
  assert.equal(wasm.get_state(STATE.PY), 0);
  assert.equal(wasm.get_state(STATE.ENERGY), 70);
  assert.equal(wasm.get_state(STATE.CARRIED), 0);
  assert.equal(wasm.get_state(STATE.BANKED), 115); // 50 + 65% of 100
  assert.equal(wasm.get_state(STATE.LAST_LOST), 35);
  assert.equal(wasm.get_state(STATE.DRILL_LV), 2); // upgrade preserved
  assert.equal(tiles()[1 * GRID_W + 11], TILE.EMPTY); // excavated tunnel preserved
});

test("Active Scanner Pulse requires Scanner Lv 2 and marks tiles SCANNED", async () => {
  const { wasm, flags } = await createCore();
  assert.equal(wasm.trigger_scan(), EVENT.SCAN_FAILED);

  const stateView = new Int32Array(wasm.memory.buffer, 0, 23);
  stateView[STATE.SCANNER_LV] = 2;
  const ev = wasm.trigger_scan();
  assert.equal(ev, EVENT.SCAN_PULSE);
  assert.ok(wasm.get_state(STATE.EVENT_ARG) > 0);
  assert.ok((flags()[5 * GRID_W + 11] & FLAG.SCANNED) !== 0);
});

test("Save, load, corrupt-save recovery, and reset work reliably", async () => {
  const storage = createMemoryStorage();
  const { wasm, memory, tiles } = await createCore();

  // Mutate world: dig (11,1), set completed = 1, banked = 345
  while (wasm.get_state(STATE.PY) < 1) wasm.step_move(DIR.DOWN);
  const stateView = new Int32Array(memory.buffer, 0, 23);
  stateView[STATE.BANKED] = 345;
  stateView[STATE.COMPLETED] = 1;

  assert.equal(saveGame(memory, { playTimeSec: 420, completedAt: "2026-11-26T15:00:00Z" }, storage), true);

  // Restore into a brand new WASM instance
  const fresh = await createCore();
  const loaded = loadGame(storage);
  assert.equal(loaded.ok, true);
  restoreWasmState(fresh.memory, loaded.data);
  assert.equal(fresh.wasm.get_state(STATE.BANKED), 345);
  assert.equal(fresh.wasm.get_state(STATE.COMPLETED), 1);
  assert.equal(fresh.tiles()[1 * GRID_W + 11], TILE.EMPTY);
  assert.equal(loaded.data.playTimeSec, 420);

  // Corrupt JSON handling
  storage.setItem(SAVE_KEY, "{not valid json");
  const bad1 = loadGame(storage);
  assert.equal(bad1.ok, false);
  assert.equal(bad1.reason, "corrupt");

  // Outdated schema version handling
  storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, state: [] }));
  const bad2 = loadGame(storage);
  assert.equal(bad2.ok, false);
  assert.equal(bad2.reason, "corrupt");

  // Reset
  clearSave(storage);
  const empty = loadGame(storage);
  assert.equal(empty.ok, false);
  assert.equal(empty.reason, "empty");
});

test("Relay nodes restore energy clamped to max, and Corrupt Hazards shock energy", async () => {
  const { wasm, memory, tiles, hp } = await createCore();
  const stateView = new Int32Array(memory.buffer, 0, 23);

  // Place RELAY_NODE at (11,1) with HP 1 and probe at (11,2) with low energy
  tiles()[2 * GRID_W + 11] = TILE.EMPTY;
  tiles()[1 * GRID_W + 11] = TILE.RELAY_NODE;
  hp()[1 * GRID_W + 11] = 1;
  stateView[STATE.PX] = 11;
  stateView[STATE.PY] = 2;
  stateView[STATE.ENERGY] = 30;

  assert.equal(wasm.step_move(DIR.UP), EVENT.RELAY_COLLECTED);
  assert.equal(wasm.get_state(STATE.ENERGY), 46); // 30 - 2 drill + 18 relay = 46

  // Place CORRUPT_HAZARD at (12,1) with HP 1 -> triggers -12 E shock
  tiles()[1 * GRID_W + 12] = TILE.CORRUPT_HAZARD;
  hp()[1 * GRID_W + 12] = 1;
  assert.equal(wasm.step_move(DIR.RIGHT), EVENT.HAZARD_TRIGGERED);
  assert.equal(wasm.get_state(STATE.ENERGY), 32); // 46 - 2 drill - 12 hazard = 32
});

test("Recall failure paths, Scan energy boundary, Scanner Lv 4 Gateway Lock, and return_to_surface", async () => {
  const { wasm, memory, flags } = await createCore();
  const stateView = new Int32Array(memory.buffer, 0, 23);

  // Recall on surface fails
  assert.equal(wasm.trigger_recall(), EVENT.RECALL_FAILED_SURFACE);

  // Recall underground with insufficient energy (< 10 E) fails
  stateView[STATE.PY] = 5;
  stateView[STATE.ENERGY] = 5;
  assert.equal(wasm.trigger_recall(), EVENT.RECALL_FAILED_ENERGY);

  // Scan underground with <= 5 E fails
  stateView[STATE.SCANNER_LV] = 2;
  assert.equal(wasm.trigger_scan(), EVENT.SCAN_FAILED);

  // Scan underground with 6 E succeeds and leaves 1 E
  stateView[STATE.ENERGY] = 6;
  assert.equal(wasm.trigger_scan(), EVENT.SCAN_PULSE);
  assert.equal(wasm.get_state(STATE.ENERGY), 1);

  // return_to_surface restores probe to (11,0), banks cargo, refills energy
  stateView[STATE.CARRIED] = 40;
  wasm.return_to_surface();
  assert.equal(wasm.get_state(STATE.PX), 11);
  assert.equal(wasm.get_state(STATE.PY), 0);
  assert.equal(wasm.get_state(STATE.BANKED), 40);
  assert.equal(wasm.get_state(STATE.ENERGY), 70);

  // Scanner Lv 4 purchase auto-marks Gateway Chamber as SCANNED
  stateView[STATE.SCANNER_LV] = 3;
  stateView[STATE.BANKED] = 500;
  assert.equal(wasm.buy_upgrade(UPGRADE.SCANNER), EVENT.UPGRADE_BOUGHT);
  assert.equal(wasm.get_state(STATE.SCANNER_LV), 4);
  assert.ok((flags()[45 * GRID_W + 11] & FLAG.SCANNED) !== 0);
});

test("Cargo capacity blocks full-cargo fragment mining without destroying resources and supports Cargo upgrades", async () => {
  const { wasm, memory, tiles, hp } = await createCore();
  const stateView = new Int32Array(memory.buffer, 0, 25);

  // Position probe at (11,2) next to DATA_SHARD at (10,2) with Cargo nearly full (55/60)
  tiles()[2 * GRID_W + 11] = TILE.EMPTY;
  stateView[STATE.PX] = 11;
  stateView[STATE.PY] = 2;
  stateView[STATE.CARRIED] = 55;
  stateView[STATE.ENERGY] = 50;
  assert.equal(tiles()[2 * GRID_W + 10], TILE.DATA_SHARD);
  const shardHpBefore = hp()[2 * GRID_W + 10];

  // Attempting to mine DATA_SHARD (+10) exceeds 60 cap -> BLOCKED_CARGO_FULL, resource & energy preserved!
  const blocked = wasm.step_move(DIR.LEFT);
  assert.equal(blocked, EVENT.BLOCKED_CARGO_FULL);
  assert.equal(tiles()[2 * GRID_W + 10], TILE.DATA_SHARD);
  assert.equal(hp()[2 * GRID_W + 10], shardHpBefore);
  assert.equal(wasm.get_state(STATE.ENERGY), 50);

  // Non-fragment blocks can still be drilled even when cargo is full (prevents any deadlock)
  tiles()[1 * GRID_W + 11] = TILE.CACHE_BLOCK;
  hp()[1 * GRID_W + 11] = 1;
  assert.equal(wasm.step_move(DIR.UP), EVENT.BLOCK_BROKEN);

  // Cargo upgrade fails underground
  assert.equal(wasm.buy_upgrade(UPGRADE.CARGO), EVENT.UPGRADE_FAILED);

  // Return to surface -> banks 55 FRAG, resets carried to 0, then buy Cargo Lv 2 (50 FRAG) -> cap 150
  assert.equal(wasm.step_move(DIR.UP), EVENT.DOCKED_BANKED);
  assert.equal(wasm.get_state(STATE.CARRIED), 0);
  assert.equal(wasm.get_state(STATE.BANKED), 55);
  assert.equal(wasm.buy_upgrade(UPGRADE.CARGO), EVENT.UPGRADE_BOUGHT);
  assert.equal(wasm.get_state(STATE.CARGO_LV), 2);
  assert.equal(wasm.get_state(STATE.MAX_CARGO), 150);
  assert.equal(wasm.get_state(STATE.BANKED), 5);
});
