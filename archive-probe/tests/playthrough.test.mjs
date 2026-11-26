// Automated end-to-end playthrough & softlock/economy verification against archive_core.wasm.
// Proves that a legitimate player (using only step_move, trigger_recall, trigger_scan, buy_upgrade)
// can start from zero, mine each layer, buy all required upgrades, breach the Gateway Seal,
// and reach CATHEDRAL_GATEWAY without any softlocks or resource starvation.
//
// Run: node --test archive-probe/tests/playthrough.test.mjs

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
  STATE,
  DIR,
  TILE,
  EVENT,
  UPGRADE,
} from "../src/constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wasmBytes = fs.readFileSync(path.resolve(__dirname, "../src/archive_core.wasm"));

const DIRS = [
  { dir: DIR.UP, dx: 0, dy: -1 },
  { dir: DIR.RIGHT, dx: 1, dy: 0 },
  { dir: DIR.DOWN, dx: 0, dy: 1 },
  { dir: DIR.LEFT, dx: -1, dy: 0 },
];

function reqDrillForTile(t) {
  if (t === TILE.CIPHER_BLOCK || t === TILE.CIPHER_NODE) return 2;
  if (t === TILE.FIREWALL_BLOCK || t === TILE.CORE_FRAGMENT) return 3;
  if (t === TILE.GATEWAY_SEAL) return 4;
  return 1;
}

function tileVal(t) {
  if (t === TILE.DATA_SHARD) return 10;
  if (t === TILE.CIPHER_NODE) return 25;
  if (t === TILE.CORE_FRAGMENT) return 60;
  return 0;
}

// Dijkstra pathfinder that finds lowest-energy path to any target matching predicate
function findBestPath(tiles, startX, startY, drillLv, targetPred) {
  const dist = new Int32Array(GRID_SIZE).fill(1e9);
  const parent = new Int32Array(GRID_SIZE).fill(-1);
  const parentDir = new Int8Array(GRID_SIZE).fill(-1);
  const startIdx = startY * GRID_W + startX;
  dist[startIdx] = 0;

  const queue = [{ idx: startIdx, cost: 0 }];
  let bestTarget = -1;
  let bestCost = 1e9;

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { idx, cost } = queue.shift();
    if (cost > dist[idx]) continue;

    const x = idx % GRID_W;
    const y = Math.floor(idx / GRID_W);
    if (idx !== startIdx && targetPred(x, y, tiles[idx])) {
      bestTarget = idx;
      bestCost = cost;
      break;
    }

    for (const { dir, dx, dy } of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const nIdx = ny * GRID_W + nx;
      const t = tiles[nIdx];
      if (t === TILE.HARD_WALL) continue;
      if (t !== TILE.EMPTY && t !== TILE.CATHEDRAL_GATEWAY && reqDrillForTile(t) > drillLv) continue;

      let stepCost = 1;
      if (t === TILE.CORRUPT_HAZARD) stepCost = 28; // strongly prefer routing around hazards
      else if (t !== TILE.EMPTY && t !== TILE.CATHEDRAL_GATEWAY) stepCost = 4;

      const nextCost = cost + stepCost;
      if (nextCost < dist[nIdx]) {
        dist[nIdx] = nextCost;
        parent[nIdx] = idx;
        parentDir[nIdx] = dir;
        queue.push({ idx: nIdx, cost: nextCost });
      }
    }
  }

  if (bestTarget === -1) return null;
  const dirs = [];
  let cur = bestTarget;
  while (cur !== startIdx) {
    dirs.push(parentDir[cur]);
    cur = parent[cur];
  }
  dirs.reverse();
  return { dirs, cost: bestCost, targetIdx: bestTarget };
}

test("Map economy audit: each layer contains generous fragment reserves with zero starvation", async () => {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const wasm = instance.exports;
  wasm.init_world(DEFAULT_SEED);
  const tiles = new Uint8Array(wasm.memory.buffer, MEM_TILES_OFFSET, GRID_SIZE);

  let l1Val = 0, l2Val = 0, l3Val = 0;
  let relays = 0, hazards = 0;
  for (let y = 1; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y * GRID_W + x];
      const v = tileVal(t);
      if (y <= 14) l1Val += v;
      else if (y <= 29) l2Val += v;
      else if (y <= 43) l3Val += v;
      if (t === TILE.RELAY_NODE) relays++;
      if (t === TILE.CORRUPT_HAZARD) hazards++;
    }
  }

  // Layer 1 needs at least 155 FRAG for Drill 2 (60) + Battery 2 (50) + Scanner 2 (45)
  assert.ok(l1Val >= 250, `Layer 1 value (${l1Val}) too low`);
  // Layer 2 needs at least 560 FRAG for Drill 3 (220) + Battery 3 (180) + Scanner 3 (160)
  assert.ok(l2Val >= 800, `Layer 2 value (${l2Val}) too low`);
  // Layer 3 needs at least 1300 FRAG for Drill 4 (520) + Battery 4 (420) + Scanner 4 (360)
  assert.ok(l3Val >= 1600, `Layer 3 value (${l3Val}) too low`);
  assert.ok(relays >= 12, `Too few energy relays (${relays})`);
  assert.ok(hazards >= 20, `Too few hazards (${hazards})`);

  console.log(
    `[ECONOMY] L1=${l1Val} FRAG | L2=${l2Val} FRAG | L3=${l3Val} FRAG | Total=${l1Val + l2Val + l3Val} FRAG | Relays=${relays} | Hazards=${hazards}`
  );
});

test("Automated full-game bot completes the entire game end-to-end with zero cheats", async () => {
  const { instance } = await WebAssembly.instantiate(wasmBytes);
  const wasm = instance.exports;
  wasm.init_world(DEFAULT_SEED);
  const tiles = new Uint8Array(wasm.memory.buffer, MEM_TILES_OFFSET, GRID_SIZE);

  // Upgrade priority order mimicking a real player (including Cargo Capacity upgrades)
  const upgradePlan = [
    UPGRADE.CARGO,   // Lv 2 (50 -> 150 cap)
    UPGRADE.DRILL,   // Lv 2 (80)
    UPGRADE.BATTERY, // Lv 2 (70)
    UPGRADE.SCANNER, // Lv 2 (60)
    UPGRADE.CARGO,   // Lv 3 (170 -> 300 cap)
    UPGRADE.BATTERY, // Lv 3 (240)
    UPGRADE.DRILL,   // Lv 3 (280)
    UPGRADE.SCANNER, // Lv 3 (210)
    UPGRADE.BATTERY, // Lv 4 (540)
    UPGRADE.DRILL,   // Lv 4 (680)
  ];
  let planIdx = 0;

  let safetySteps = 0;
  const MAX_STEPS = 5000;

  while (wasm.get_state(STATE.COMPLETED) === 0 && safetySteps < MAX_STEPS) {
    safetySteps++;

    // On surface: buy next planned upgrade(s) if affordable
    if (wasm.get_state(STATE.PY) === 0) {
      while (planIdx < upgradePlan.length) {
        const uid = upgradePlan[planIdx];
        const ev = wasm.buy_upgrade(uid);
        if (ev === EVENT.UPGRADE_BOUGHT) {
          planIdx++;
        } else {
          break;
        }
      }
    }

    const px = wasm.get_state(STATE.PX);
    const py = wasm.get_state(STATE.PY);
    const energy = wasm.get_state(STATE.ENERGY);
    const recallCost = wasm.get_recall_cost();
    const drillLv = wasm.get_state(STATE.DRILL_LV);
    const carried = wasm.get_state(STATE.CARRIED);
    const maxCargo = wasm.get_state(STATE.MAX_CARGO);
    const minTargetVal = drillLv >= 3 ? 60 : drillLv >= 2 ? 25 : 10;

    // Return to surface via Tether Recall when energy is low OR cargo hold cannot fit next fragment
    if (py > 0 && (energy <= recallCost + 8 || (drillLv < 4 && carried + minTargetVal > maxCargo))) {
      const rec = wasm.trigger_recall();
      if (rec === EVENT.TETHER_RECALL) continue;
    }

    // Choose goal: once Drill Lv 4 is owned, head straight to CATHEDRAL_GATEWAY!
    let path = null;
    if (drillLv >= 4) {
      path = findBestPath(tiles, px, py, drillLv, (_x, _y, t) => t === TILE.CATHEDRAL_GATEWAY);
    }
    // Otherwise mine the nearest highest-tier accessible fragment node that fits in Cargo
    if (!path) {
      path = findBestPath(
        tiles,
        px,
        py,
        drillLv,
        (_x, _y, t) => tileVal(t) >= minTargetVal && carried + tileVal(t) <= maxCargo
      );
    }
    if (!path) {
      path = findBestPath(
        tiles,
        px,
        py,
        drillLv,
        (_x, _y, t) => tileVal(t) > 0 && carried + tileVal(t) <= maxCargo
      );
    }
    if (!path && py > 0) {
      // Cargo cannot fit any more fragments; climb back to surface Row 0
      path = findBestPath(tiles, px, py, drillLv, (_x, y) => y === 0);
    }

    assert.ok(path && path.dirs.length > 0, `Bot stuck/softlocked at (${px},${py}) with Drill Lv ${drillLv}`);
    wasm.step_move(path.dirs[0]);
  }

  assert.equal(wasm.get_state(STATE.COMPLETED), 1, "Bot failed to reach Cathedral Gateway within step budget");
  const totalMoves = wasm.get_state(STATE.TOTAL_MOVES);
  const expeditions = wasm.get_state(STATE.EXPEDITIONS);
  const tilesDug = wasm.get_state(STATE.TILES_DUG);
  const extractions = wasm.get_state(STATE.EXTRACTIONS);

  // Estimate real human playtime:
  // Bot executes ~100% optimal paths at 0ms decision latency.
  // A human averages ~0.45-0.65s per action including reading, scanning, planning, and surface upgrades.
  const estHumanMinLow = ((totalMoves * 0.45) / 60).toFixed(1);
  const estHumanMinHigh = ((totalMoves * 0.65) / 60).toFixed(1);

  console.log(
    `[PLAYTHROUGH COMPLETE] Moves=${totalMoves} | Expeditions=${expeditions} | BlocksDug=${tilesDug} | Extractions=${extractions} | EstHumanTime=${estHumanMinLow}-${estHumanMinHigh} min`
  );
  assert.ok(expeditions >= 5, `Game finished too abruptly (${expeditions} expeditions)`);
});
