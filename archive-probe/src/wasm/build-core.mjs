// Builds the standalone bare-metal WebAssembly simulation core (archive_core.wasm)
// and a base64 fallback module (archive_core_b64.js) for file:// compatibility.
//
// Run: node archive-probe/src/wasm/build-core.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  MEM_STATE_OFFSET,
  MEM_TILES_OFFSET,
  MEM_HP_OFFSET,
  MEM_FLAGS_OFFSET,
  STATE,
  DIR,
  TILE,
  FLAG,
  EVENT,
  UPGRADE,
} from "../constants.js";
import { WasmModuleBuilder, VALTYPE, i32, local, ctrl } from "./wasm-emitter.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_WASM = path.resolve(__dirname, "../archive_core.wasm");
const OUT_B64 = path.resolve(__dirname, "../archive_core_b64.js");

// Helpers for reading/writing WASM linear memory state slots
const getState = (slot) => [i32.const(MEM_STATE_OFFSET + slot * 4), i32.load()];
const setState = (slot, valExpr) => [i32.const(MEM_STATE_OFFSET + slot * 4), valExpr, i32.store()];

// Tile index = y * GRID_W + x
const tileIdxExpr = (xExpr, yExpr) => [yExpr, i32.const(GRID_W), i32.mul(), xExpr, i32.add()];
const loadTile = (idxExpr) => [idxExpr, i32.load8_u(MEM_TILES_OFFSET)];
const storeTile = (idxExpr, valExpr) => [idxExpr, valExpr, i32.store8(MEM_TILES_OFFSET)];
const loadHp = (idxExpr) => [idxExpr, i32.load8_u(MEM_HP_OFFSET)];
const storeHp = (idxExpr, valExpr) => [idxExpr, valExpr, i32.store8(MEM_HP_OFFSET)];
const loadFlag = (idxExpr) => [idxExpr, i32.load8_u(MEM_FLAGS_OFFSET)];
const storeFlag = (idxExpr, valExpr) => [idxExpr, valExpr, i32.store8(MEM_FLAGS_OFFSET)];

export function compileArchiveCoreWasm() {
  const m = new WasmModuleBuilder(1); // 1 page = 64 KB linear memory
  const I = VALTYPE.i32;

  // Declare all internal & exported functions
  m.declareFunction("rng_next", [], [I]);
  m.declareFunction("tile_base_hp", [I], [I]);
  m.declareFunction("tile_req_drill", [I], [I]);
  m.declareFunction("tile_value", [I], [I]);
  m.declareFunction("drill_power", [I], [I]);
  m.declareFunction("battery_cap", [I], [I]);
  m.declareFunction("cargo_cap", [I], [I]);
  m.declareFunction("sight_radius", [I], [I]);
  m.declareFunction("pulse_radius", [I], [I]);
  m.declareFunction("upgrade_cost", [I, I], [I], "get_upgrade_cost");
  m.declareFunction("recall_cost", [], [I], "get_recall_cost");
  m.declareFunction("update_visibility", [], [], "update_visibility");
  m.declareFunction("set_tile", [I, I, I], []);
  m.declareFunction("init_world", [I], [], "init_world");
  m.declareFunction("trigger_extract", [], []);
  m.declareFunction("step_move", [I], [I], "step_move");
  m.declareFunction("trigger_scan", [], [I], "trigger_scan");
  m.declareFunction("trigger_recall", [], [I], "trigger_recall");
  m.declareFunction("buy_upgrade", [I], [I], "buy_upgrade");
  m.declareFunction("return_to_surface", [], [], "return_to_surface");
  m.declareFunction("get_state", [I], [I], "get_state");

  // -------------------------------------------------------------------------
  // 1. rng_next() -> i32  (xorshift32 PRNG)
  // -------------------------------------------------------------------------
  m.defineFunction("rng_next", 1, () => {
    const x = 0;
    return [
      getState(STATE.RNG),
      local.set(x),
      // If 0, reseed to non-zero
      ctrl.if([local.get(x), i32.eqz()], [i32.const(0x24635342), local.set(x)]),
      // x ^= x << 13
      local.get(x), local.get(x), i32.const(13), i32.shl(), i32.xor(), local.set(x),
      // x ^= x >>> 17
      local.get(x), local.get(x), i32.const(17), i32.shr_u(), i32.xor(), local.set(x),
      // x ^= x << 5
      local.get(x), local.get(x), i32.const(5), i32.shl(), i32.xor(), local.set(x),
      setState(STATE.RNG, local.get(x)),
      local.get(x),
    ];
  });

  // -------------------------------------------------------------------------
  // 2. Tile property lookup functions
  // -------------------------------------------------------------------------
  m.defineFunction("tile_base_hp", 0, () => {
    const t = 0;
    const retIf = (tileType, val) =>
      ctrl.if([local.get(t), i32.const(tileType), i32.eq()], [i32.const(val), ctrl.return()]);
    return [
      retIf(TILE.CACHE_BLOCK, 3),
      retIf(TILE.DATA_SHARD, 3),
      retIf(TILE.DENSE_INDEX, 5),
      retIf(TILE.CIPHER_BLOCK, 6),
      retIf(TILE.CIPHER_NODE, 6),
      retIf(TILE.CORRUPT_HAZARD, 4),
      retIf(TILE.FIREWALL_BLOCK, 10),
      retIf(TILE.CORE_FRAGMENT, 10),
      retIf(TILE.RELAY_NODE, 3),
      retIf(TILE.GATEWAY_SEAL, 16),
      i32.const(0),
    ];
  });

  m.defineFunction("tile_req_drill", 0, () => {
    const t = 0;
    const retIf = (tileType, val) =>
      ctrl.if([local.get(t), i32.const(tileType), i32.eq()], [i32.const(val), ctrl.return()]);
    return [
      retIf(TILE.CIPHER_BLOCK, 2),
      retIf(TILE.CIPHER_NODE, 2),
      retIf(TILE.FIREWALL_BLOCK, 3),
      retIf(TILE.CORE_FRAGMENT, 3),
      retIf(TILE.GATEWAY_SEAL, 4),
      i32.const(1),
    ];
  });

  m.defineFunction("tile_value", 0, () => {
    const t = 0;
    const retIf = (tileType, val) =>
      ctrl.if([local.get(t), i32.const(tileType), i32.eq()], [i32.const(val), ctrl.return()]);
    return [
      retIf(TILE.DATA_SHARD, 10),
      retIf(TILE.CIPHER_NODE, 25),
      retIf(TILE.CORE_FRAGMENT, 60),
      i32.const(0),
    ];
  });

  // -------------------------------------------------------------------------
  // 3. Upgrade stat tables
  // -------------------------------------------------------------------------
  m.defineFunction("drill_power", 0, () => {
    const lv = 0;
    return [
      ctrl.if([local.get(lv), i32.const(1), i32.le_s()], [i32.const(1), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(2), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(3), i32.eq()], [i32.const(4), ctrl.return()]),
      i32.const(6),
    ];
  });

  m.defineFunction("battery_cap", 0, () => {
    const lv = 0;
    return [
      ctrl.if([local.get(lv), i32.const(1), i32.le_s()], [i32.const(70), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(120), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(3), i32.eq()], [i32.const(190), ctrl.return()]),
      i32.const(280),
    ];
  });

  m.defineFunction("cargo_cap", 0, () => {
    const lv = 0;
    return [
      ctrl.if([local.get(lv), i32.const(1), i32.le_s()], [i32.const(60), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(150), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(3), i32.eq()], [i32.const(300), ctrl.return()]),
      i32.const(540),
    ];
  });

  m.defineFunction("sight_radius", 0, () => {
    const lv = 0;
    return [
      ctrl.if([local.get(lv), i32.const(1), i32.le_s()], [i32.const(3), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(5), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(3), i32.eq()], [i32.const(7), ctrl.return()]),
      i32.const(9),
    ];
  });

  m.defineFunction("pulse_radius", 0, () => {
    const lv = 0;
    return [
      ctrl.if([local.get(lv), i32.const(1), i32.le_s()], [i32.const(0), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(7), ctrl.return()]),
      ctrl.if([local.get(lv), i32.const(3), i32.eq()], [i32.const(10), ctrl.return()]),
      i32.const(14),
    ];
  });

  // upgrade_cost(upgradeId, currentLevel) -> cost (-1 if max)
  m.defineFunction("upgrade_cost", 0, () => {
    const uid = 0;
    const lv = 1;
    return [
      ctrl.if([local.get(lv), i32.const(4), i32.ge_s()], [i32.const(-1), ctrl.return()]),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.DRILL), i32.eq()],
        [
          ctrl.if([local.get(lv), i32.const(1), i32.eq()], [i32.const(80), ctrl.return()]),
          ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(280), ctrl.return()]),
          i32.const(680), ctrl.return(),
        ]
      ),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.BATTERY), i32.eq()],
        [
          ctrl.if([local.get(lv), i32.const(1), i32.eq()], [i32.const(70), ctrl.return()]),
          ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(240), ctrl.return()]),
          i32.const(540), ctrl.return(),
        ]
      ),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.SCANNER), i32.eq()],
        [
          ctrl.if([local.get(lv), i32.const(1), i32.eq()], [i32.const(60), ctrl.return()]),
          ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(210), ctrl.return()]),
          i32.const(460), ctrl.return(),
        ]
      ),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.CARGO), i32.eq()],
        [
          ctrl.if([local.get(lv), i32.const(1), i32.eq()], [i32.const(50), ctrl.return()]),
          ctrl.if([local.get(lv), i32.const(2), i32.eq()], [i32.const(170), ctrl.return()]),
          i32.const(380), ctrl.return(),
        ]
      ),
      i32.const(-1),
    ];
  });

  // recall_cost() -> max(10, floor(maxEnergy * 15 / 100))
  m.defineFunction("recall_cost", 1, () => {
    const c = 0;
    return [
      getState(STATE.MAX_ENERGY),
      i32.const(15),
      i32.mul(),
      i32.const(100),
      i32.div_s(),
      local.tee(c),
      i32.const(10),
      i32.lt_s(),
      ctrl.if([], [i32.const(10), local.set(c)]),
      local.get(c),
    ];
  });

  // -------------------------------------------------------------------------
  // 4. update_visibility() - sets VISIBLE + EXPLORED within sight_radius
  // -------------------------------------------------------------------------
  m.defineFunction("update_visibility", 8, (fns) => {
    const px = 0, py = 1, r = 2, r2 = 3, x = 4, y = 5, dx = 6, idx = 7;
    return [
      getState(STATE.PX), local.set(px),
      getState(STATE.PY), local.set(py),
      getState(STATE.SCANNER_LV), ctrl.call(fns.get("sight_radius")), local.tee(r),
      local.get(r), i32.mul(), local.set(r2),

      i32.const(0), local.set(y),
      ctrl.block([
        ctrl.loop([
          local.get(y), i32.const(GRID_H), i32.ge_s(), ctrl.br_if(1),
          i32.const(0), local.set(x),
          ctrl.block([
            ctrl.loop([
              local.get(x), i32.const(GRID_W), i32.ge_s(), ctrl.br_if(1),
              tileIdxExpr(local.get(x), local.get(y)), local.set(idx),
              // Always clear VISIBLE bit first
              storeFlag(local.get(idx), [loadFlag(local.get(idx)), i32.const(~FLAG.VISIBLE & 0xff), i32.and()]),
              // Surface row (y <= 1) is always visible & explored
              ctrl.if(
                [local.get(y), i32.const(1), i32.le_s()],
                [
                  storeFlag(local.get(idx), [loadFlag(local.get(idx)), i32.const(FLAG.VISIBLE | FLAG.EXPLORED), i32.or()]),
                ],
                [
                  // dx*dx + dy*dy <= r2
                  local.get(x), local.get(px), i32.sub(), local.set(dx),
                  local.get(dx), local.get(dx), i32.mul(),
                  local.get(y), local.get(py), i32.sub(),
                  local.get(y), local.get(py), i32.sub(), i32.mul(),
                  i32.add(),
                  local.get(r2), i32.le_s(),
                  ctrl.if([], [
                    storeFlag(local.get(idx), [loadFlag(local.get(idx)), i32.const(FLAG.VISIBLE | FLAG.EXPLORED), i32.or()]),
                  ]),
                ]
              ),
              local.get(x), i32.const(1), i32.add(), local.set(x),
              ctrl.br(0),
            ]),
          ]),
          local.get(y), i32.const(1), i32.add(), local.set(y),
          ctrl.br(0),
        ]),
      ]),
    ];
  });

  // -------------------------------------------------------------------------
  // 5. set_tile(x, y, type) - sets tile type and resets its HP
  // -------------------------------------------------------------------------
  m.defineFunction("set_tile", 1, (fns) => {
    const x = 0, y = 1, t = 2, idx = 3;
    return [
      tileIdxExpr(local.get(x), local.get(y)), local.set(idx),
      storeTile(local.get(idx), local.get(t)),
      storeHp(local.get(idx), [local.get(t), ctrl.call(fns.get("tile_base_hp"))]),
    ];
  });

  // -------------------------------------------------------------------------
  // 6. init_world(seed) - deterministic 3-layer hybrid map generation
  // -------------------------------------------------------------------------
  m.defineFunction("init_world", 5, (fns) => {
    const seed = 0, x = 1, y = 2, r = 3, idx = 4, t = 5;
    const put = (xE, yE, tVal) => [xE, yE, i32.const(tVal), ctrl.call(fns.get("set_tile"))];
    return [
      // Initialize state header
      setState(STATE.SEED, local.get(seed)),
      setState(STATE.RNG, local.get(seed)),
      setState(STATE.PX, i32.const(11)),
      setState(STATE.PY, i32.const(0)),
      setState(STATE.FACING, i32.const(DIR.DOWN)),
      setState(STATE.DRILL_LV, i32.const(1)),
      setState(STATE.BATTERY_LV, i32.const(1)),
      setState(STATE.SCANNER_LV, i32.const(1)),
      setState(STATE.MAX_ENERGY, i32.const(70)),
      setState(STATE.ENERGY, i32.const(70)),
      setState(STATE.CARRIED, i32.const(0)),
      setState(STATE.BANKED, i32.const(0)),
      setState(STATE.COMPLETED, i32.const(0)),
      setState(STATE.EXPEDITIONS, i32.const(0)),
      setState(STATE.TILES_DUG, i32.const(0)),
      setState(STATE.EXTRACTIONS, i32.const(0)),
      setState(STATE.MAX_DEPTH, i32.const(0)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.NONE)),
      setState(STATE.EVENT_ARG, i32.const(0)),
      setState(STATE.EVENT_X, i32.const(11)),
      setState(STATE.EVENT_Y, i32.const(0)),
      setState(STATE.LAST_LOST, i32.const(0)),
      setState(STATE.TOTAL_MOVES, i32.const(0)),
      setState(STATE.CARGO_LV, i32.const(1)),
      setState(STATE.MAX_CARGO, i32.const(60)),

      // Clear flags grid
      i32.const(0), local.set(idx),
      ctrl.block([
        ctrl.loop([
          local.get(idx), i32.const(GRID_SIZE), i32.ge_s(), ctrl.br_if(1),
          storeFlag(local.get(idx), i32.const(0)),
          local.get(idx), i32.const(1), i32.add(), local.set(idx),
          ctrl.br(0),
        ]),
      ]),

      // Fill map row by row
      i32.const(0), local.set(y),
      ctrl.block([
        ctrl.loop([
          local.get(y), i32.const(GRID_H), i32.ge_s(), ctrl.br_if(1),
          i32.const(0), local.set(x),
          ctrl.block([
            ctrl.loop([
              local.get(x), i32.const(GRID_W), i32.ge_s(), ctrl.br_if(1),

              // Roll 0..99
              ctrl.call(fns.get("rng_next")), i32.const(100), i32.rem_u(), local.set(r),

              // Row 0: Surface dock (all EMPTY)
              ctrl.if(
                [local.get(y), i32.const(0), i32.eq()],
                [i32.const(TILE.EMPTY), local.set(t)],
                [
                  // Outer side borders (x == 0 || x == GRID_W - 1) -> HARD_WALL
                  ctrl.if(
                    [
                      local.get(x), i32.const(0), i32.eq(),
                      local.get(x), i32.const(GRID_W - 1), i32.eq(),
                      i32.or(),
                    ],
                    [i32.const(TILE.HARD_WALL), local.set(t)],
                    [
                      // Layer 1: Rows 1..14 (Perimeter Cache)
                      ctrl.if(
                        [local.get(y), i32.const(14), i32.le_s()],
                        [
                          // 16% DATA_SHARD, 10% DENSE_INDEX, 4% RELAY_NODE (y>=6), 3% EMPTY pocket, rest CACHE_BLOCK
                          i32.const(TILE.CACHE_BLOCK), local.set(t),
                          ctrl.if([local.get(r), i32.const(16), i32.lt_s()], [i32.const(TILE.DATA_SHARD), local.set(t)]),
                          ctrl.if(
                            [local.get(r), i32.const(16), i32.ge_s(), local.get(r), i32.const(26), i32.lt_s(), i32.and()],
                            [i32.const(TILE.DENSE_INDEX), local.set(t)]
                          ),
                          ctrl.if(
                            [local.get(r), i32.const(26), i32.ge_s(), local.get(r), i32.const(30), i32.lt_s(), local.get(y), i32.const(6), i32.ge_s(), i32.and(), i32.and()],
                            [i32.const(TILE.RELAY_NODE), local.set(t)]
                          ),
                          ctrl.if(
                            [local.get(r), i32.const(96), i32.ge_s(), local.get(y), i32.const(3), i32.ge_s(), i32.and()],
                            [i32.const(TILE.EMPTY), local.set(t)]
                          ),
                        ],
                        [
                          // Layer 2: Rows 15..29 (Encrypted Vault)
                          ctrl.if(
                            [local.get(y), i32.const(29), i32.le_s()],
                            [
                              // Row 15 is a solid CIPHER_BLOCK security gate (requires Drill Lv 2)
                              ctrl.if(
                                [local.get(y), i32.const(15), i32.eq()],
                                [i32.const(TILE.CIPHER_BLOCK), local.set(t)],
                                [
                                  i32.const(TILE.CIPHER_BLOCK), local.set(t),
                                  // 16% CIPHER_NODE, 9% CORRUPT_HAZARD, 5% RELAY_NODE, 6% HARD_WALL rib, 4% EMPTY pocket
                                  ctrl.if([local.get(r), i32.const(16), i32.lt_s()], [i32.const(TILE.CIPHER_NODE), local.set(t)]),
                                  ctrl.if(
                                    [local.get(r), i32.const(16), i32.ge_s(), local.get(r), i32.const(25), i32.lt_s(), i32.and()],
                                    [i32.const(TILE.CORRUPT_HAZARD), local.set(t)]
                                  ),
                                  ctrl.if(
                                    [local.get(r), i32.const(25), i32.ge_s(), local.get(r), i32.const(30), i32.lt_s(), i32.and()],
                                    [i32.const(TILE.RELAY_NODE), local.set(t)]
                                  ),
                                  ctrl.if(
                                    [local.get(r), i32.const(30), i32.ge_s(), local.get(r), i32.const(36), i32.lt_s(), local.get(x), i32.const(11), i32.ne(), local.get(x), i32.const(12), i32.ne(), i32.and(), i32.and(), i32.and()],
                                    [i32.const(TILE.HARD_WALL), local.set(t)]
                                  ),
                                  ctrl.if(
                                    [local.get(r), i32.const(96), i32.ge_s()],
                                    [i32.const(TILE.EMPTY), local.set(t)]
                                  ),
                                ]
                              ),
                            ],
                            [
                              // Layer 3: Rows 30..43 (Core Sanctum)
                              ctrl.if(
                                [local.get(y), i32.const(43), i32.le_s()],
                                [
                                  // Row 30 is a solid FIREWALL_BLOCK security gate (requires Drill Lv 3)
                                  ctrl.if(
                                    [local.get(y), i32.const(30), i32.eq()],
                                    [i32.const(TILE.FIREWALL_BLOCK), local.set(t)],
                                    [
                                      i32.const(TILE.FIREWALL_BLOCK), local.set(t),
                                      // 15% CORE_FRAGMENT, 13% CORRUPT_HAZARD, 6% RELAY_NODE, 7% HARD_WALL rib
                                      ctrl.if([local.get(r), i32.const(15), i32.lt_s()], [i32.const(TILE.CORE_FRAGMENT), local.set(t)]),
                                      ctrl.if(
                                        [local.get(r), i32.const(15), i32.ge_s(), local.get(r), i32.const(28), i32.lt_s(), i32.and()],
                                        [i32.const(TILE.CORRUPT_HAZARD), local.set(t)]
                                      ),
                                      ctrl.if(
                                        [local.get(r), i32.const(28), i32.ge_s(), local.get(r), i32.const(34), i32.lt_s(), i32.and()],
                                        [i32.const(TILE.RELAY_NODE), local.set(t)]
                                      ),
                                      ctrl.if(
                                        [local.get(r), i32.const(34), i32.ge_s(), local.get(r), i32.const(41), i32.lt_s(), local.get(x), i32.const(11), i32.ne(), local.get(x), i32.const(12), i32.ne(), i32.and(), i32.and(), i32.and()],
                                        [i32.const(TILE.HARD_WALL), local.set(t)]
                                      ),
                                    ]
                                  ),
                                ],
                                [
                                  // Rows 44..45: Gateway Chamber
                                  i32.const(TILE.HARD_WALL), local.set(t),
                                ]
                              ),
                            ]
                          ),
                        ]
                      ),
                    ]
                  ),
                ]
              ),

              local.get(x), local.get(y), local.get(t), ctrl.call(fns.get("set_tile")),
              local.get(x), i32.const(1), i32.add(), local.set(x),
              ctrl.br(0),
            ]),
          ]),
          local.get(y), i32.const(1), i32.add(), local.set(y),
          ctrl.br(0),
        ]),
      ]),

      // Hand-authored landmarks & anti-softlock guarantees:
      // 1. Entry shaft starter pocket at (11,1) and onboarding shards nearby
      put(i32.const(11), i32.const(1), TILE.CACHE_BLOCK),
      put(i32.const(10), i32.const(2), TILE.DATA_SHARD),
      put(i32.const(12), i32.const(2), TILE.DATA_SHARD),
      put(i32.const(11), i32.const(4), TILE.DATA_SHARD),
      put(i32.const(9), i32.const(5), TILE.DATA_SHARD),
      put(i32.const(13), i32.const(5), TILE.DATA_SHARD),
      put(i32.const(11), i32.const(8), TILE.RELAY_NODE),
      put(i32.const(10), i32.const(10), TILE.DATA_SHARD),
      put(i32.const(12), i32.const(11), TILE.DATA_SHARD),

      // 2. Guaranteed Layer 2 rich anchor cluster + relay
      put(i32.const(11), i32.const(17), TILE.CIPHER_NODE),
      put(i32.const(12), i32.const(19), TILE.RELAY_NODE),
      put(i32.const(10), i32.const(22), TILE.CIPHER_NODE),
      put(i32.const(12), i32.const(25), TILE.CIPHER_NODE),

      // 3. Guaranteed Layer 3 anchor cores + relays
      put(i32.const(11), i32.const(32), TILE.CORE_FRAGMENT),
      put(i32.const(12), i32.const(35), TILE.RELAY_NODE),
      put(i32.const(10), i32.const(38), TILE.CORE_FRAGMENT),
      put(i32.const(12), i32.const(41), TILE.CORE_FRAGMENT),
      // Keep direct approach above Gateway Seal clear of HARD_WALL
      put(i32.const(11), i32.const(43), TILE.FIREWALL_BLOCK),
      put(i32.const(12), i32.const(43), TILE.FIREWALL_BLOCK),

      // 4. Gateway Chamber (Rows 44..45)
      put(i32.const(10), i32.const(44), TILE.GATEWAY_SEAL),
      put(i32.const(11), i32.const(44), TILE.GATEWAY_SEAL),
      put(i32.const(12), i32.const(44), TILE.GATEWAY_SEAL),
      put(i32.const(13), i32.const(44), TILE.GATEWAY_SEAL),
      put(i32.const(10), i32.const(45), TILE.EMPTY),
      put(i32.const(11), i32.const(45), TILE.CATHEDRAL_GATEWAY),
      put(i32.const(12), i32.const(45), TILE.CATHEDRAL_GATEWAY),
      put(i32.const(13), i32.const(45), TILE.EMPTY),

      // Initial visibility pass
      ctrl.call(fns.get("update_visibility")),
    ];
  });

  // -------------------------------------------------------------------------
  // 7. trigger_extract() - emergency extraction when energy hits 0 underground
  //    Salvages 65% of carried fragments, preserves all banked/upgrades/tunnels
  // -------------------------------------------------------------------------
  m.defineFunction("trigger_extract", 2, (fns) => {
    const carried = 0, salvaged = 1;
    return [
      getState(STATE.CARRIED), local.set(carried),
      // salvaged = (carried * 65 + 50) / 100 (rounded)
      local.get(carried), i32.const(65), i32.mul(), i32.const(50), i32.add(), i32.const(100), i32.div_s(),
      local.set(salvaged),
      setState(STATE.BANKED, [getState(STATE.BANKED), local.get(salvaged), i32.add()]),
      setState(STATE.LAST_LOST, [local.get(carried), local.get(salvaged), i32.sub()]),
      setState(STATE.CARRIED, i32.const(0)),
      setState(STATE.PX, i32.const(11)),
      setState(STATE.PY, i32.const(0)),
      setState(STATE.FACING, i32.const(DIR.DOWN)),
      setState(STATE.ENERGY, getState(STATE.MAX_ENERGY)),
      setState(STATE.EXTRACTIONS, [getState(STATE.EXTRACTIONS), i32.const(1), i32.add()]),
      setState(STATE.LAST_EVENT, i32.const(EVENT.EMERGENCY_EXTRACT)),
      setState(STATE.EVENT_ARG, local.get(salvaged)),
      setState(STATE.EVENT_X, i32.const(11)),
      setState(STATE.EVENT_Y, i32.const(0)),
      ctrl.call(fns.get("update_visibility")),
    ];
  });

  // -------------------------------------------------------------------------
  // 8. step_move(dir) -> eventCode
  // -------------------------------------------------------------------------
  m.defineFunction("step_move", 10, (fns) => {
    const dir = 0;
    const px = 1, py = 2, nx = 3, ny = 4, idx = 5, t = 6, hp = 7, dmg = 8, val = 9, energy = 10;
    return [
      setState(STATE.FACING, local.get(dir)),
      getState(STATE.PX), local.tee(px), local.set(nx),
      getState(STATE.PY), local.tee(py), local.set(ny),

      // Compute target (nx, ny)
      ctrl.if([local.get(dir), i32.const(DIR.UP), i32.eq()], [local.get(ny), i32.const(1), i32.sub(), local.set(ny)]),
      ctrl.if([local.get(dir), i32.const(DIR.DOWN), i32.eq()], [local.get(ny), i32.const(1), i32.add(), local.set(ny)]),
      ctrl.if([local.get(dir), i32.const(DIR.LEFT), i32.eq()], [local.get(nx), i32.const(1), i32.sub(), local.set(nx)]),
      ctrl.if([local.get(dir), i32.const(DIR.RIGHT), i32.eq()], [local.get(nx), i32.const(1), i32.add(), local.set(nx)]),

      setState(STATE.EVENT_X, local.get(nx)),
      setState(STATE.EVENT_Y, local.get(ny)),
      setState(STATE.EVENT_ARG, i32.const(0)),

      // Bounds check
      ctrl.if(
        [
          local.get(nx), i32.const(0), i32.lt_s(),
          local.get(nx), i32.const(GRID_W), i32.ge_s(), i32.or(),
          local.get(ny), i32.const(0), i32.lt_s(), i32.or(),
          local.get(ny), i32.const(GRID_H), i32.ge_s(), i32.or(),
        ],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.BLOCKED_HARD)),
          i32.const(EVENT.BLOCKED_HARD),
          ctrl.return(),
        ]
      ),

      tileIdxExpr(local.get(nx), local.get(ny)), local.set(idx),
      loadTile(local.get(idx)), local.set(t),

      // Case A: HARD_WALL -> blocked, no energy cost
      ctrl.if(
        [local.get(t), i32.const(TILE.HARD_WALL), i32.eq()],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.BLOCKED_HARD)),
          i32.const(EVENT.BLOCKED_HARD),
          ctrl.return(),
        ]
      ),

      // Case B: EMPTY or CATHEDRAL_GATEWAY -> move into tile
      ctrl.if(
        [
          local.get(t), i32.const(TILE.EMPTY), i32.eq(),
          local.get(t), i32.const(TILE.CATHEDRAL_GATEWAY), i32.eq(),
          i32.or(),
        ],
        [
          // If leaving surface (py == 0 && ny > 0), increment expedition counter
          ctrl.if(
            [local.get(py), i32.const(0), i32.eq(), local.get(ny), i32.const(0), i32.gt_s(), i32.and()],
            [setState(STATE.EXPEDITIONS, [getState(STATE.EXPEDITIONS), i32.const(1), i32.add()])]
          ),

          setState(STATE.PX, local.get(nx)),
          setState(STATE.PY, local.get(ny)),
          setState(STATE.TOTAL_MOVES, [getState(STATE.TOTAL_MOVES), i32.const(1), i32.add()]),

          // Track max depth
          ctrl.if(
            [local.get(ny), getState(STATE.MAX_DEPTH), i32.gt_s()],
            [setState(STATE.MAX_DEPTH, local.get(ny))]
          ),

          ctrl.call(fns.get("update_visibility")),

          // Check CATHEDRAL_GATEWAY -> Trigger The Impossible Login!
          ctrl.if(
            [local.get(t), i32.const(TILE.CATHEDRAL_GATEWAY), i32.eq()],
            [
              setState(STATE.COMPLETED, i32.const(1)),
              // Also bank any carried fragments on completion
              setState(STATE.BANKED, [getState(STATE.BANKED), getState(STATE.CARRIED), i32.add()]),
              setState(STATE.CARRIED, i32.const(0)),
              setState(STATE.LAST_EVENT, i32.const(EVENT.GATEWAY_REACHED)),
              i32.const(EVENT.GATEWAY_REACHED),
              ctrl.return(),
            ]
          ),

          // If on surface (ny == 0): recharge energy & bank carried fragments
          ctrl.if(
            [local.get(ny), i32.const(0), i32.eq()],
            [
              setState(STATE.ENERGY, getState(STATE.MAX_ENERGY)),
              getState(STATE.CARRIED), local.set(val),
              ctrl.if(
                [local.get(val), i32.const(0), i32.gt_s()],
                [
                  setState(STATE.BANKED, [getState(STATE.BANKED), local.get(val), i32.add()]),
                  setState(STATE.CARRIED, i32.const(0)),
                  setState(STATE.EVENT_ARG, local.get(val)),
                  setState(STATE.LAST_EVENT, i32.const(EVENT.DOCKED_BANKED)),
                  i32.const(EVENT.DOCKED_BANKED),
                  ctrl.return(),
                ]
              ),
              setState(STATE.LAST_EVENT, i32.const(EVENT.MOVED)),
              i32.const(EVENT.MOVED),
              ctrl.return(),
            ]
          ),

          // Underground movement costs 1 Energy
          getState(STATE.ENERGY), i32.const(1), i32.sub(), local.set(energy),
          ctrl.if(
            [local.get(energy), i32.const(0), i32.le_s()],
            [
              ctrl.call(fns.get("trigger_extract")),
              i32.const(EVENT.EMERGENCY_EXTRACT),
              ctrl.return(),
            ]
          ),
          setState(STATE.ENERGY, local.get(energy)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.MOVED)),
          i32.const(EVENT.MOVED),
          ctrl.return(),
        ]
      ),

      // Case C: Breakable block -> check required Drill Level
      local.get(t), ctrl.call(fns.get("tile_req_drill")), local.set(val),
      ctrl.if(
        [getState(STATE.DRILL_LV), local.get(val), i32.lt_s()],
        [
          setState(STATE.EVENT_ARG, local.get(val)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.BLOCKED_DRILL_LV)),
          i32.const(EVENT.BLOCKED_DRILL_LV),
          ctrl.return(),
        ]
      ),

      // Cargo capacity check for fragment-bearing blocks (never destroy resources when cargo cannot hold them)
      local.get(t), ctrl.call(fns.get("tile_value")), local.set(val),
      ctrl.if(
        [
          local.get(val), i32.const(0), i32.gt_s(),
          getState(STATE.CARRIED), local.get(val), i32.add(), getState(STATE.MAX_CARGO), i32.gt_s(),
          i32.and(),
        ],
        [
          setState(STATE.EVENT_ARG, local.get(val)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.BLOCKED_CARGO_FULL)),
          i32.const(EVENT.BLOCKED_CARGO_FULL),
          ctrl.return(),
        ]
      ),

      setState(STATE.TOTAL_MOVES, [getState(STATE.TOTAL_MOVES), i32.const(1), i32.add()]),

      // Apply drill damage
      getState(STATE.DRILL_LV), ctrl.call(fns.get("drill_power")), local.set(dmg),
      loadHp(local.get(idx)), local.get(dmg), i32.sub(), local.set(hp),

      // Drill strike costs 2 Energy (unless standing on surface row 0)
      getState(STATE.ENERGY),
      ctrl.if(
        [local.get(py), i32.const(0), i32.gt_s()],
        [i32.const(2)],
        [i32.const(1)],
        VALTYPE.i32
      ),
      i32.sub(),
      local.set(energy),

      // Still has HP remaining -> DRILLED_HIT
      ctrl.if(
        [local.get(hp), i32.const(0), i32.gt_s()],
        [
          storeHp(local.get(idx), local.get(hp)),
          ctrl.if(
            [local.get(energy), i32.const(0), i32.le_s()],
            [
              ctrl.call(fns.get("trigger_extract")),
              i32.const(EVENT.EMERGENCY_EXTRACT),
              ctrl.return(),
            ]
          ),
          setState(STATE.ENERGY, local.get(energy)),
          setState(STATE.EVENT_ARG, local.get(hp)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.DRILLED_HIT)),
          i32.const(EVENT.DRILLED_HIT),
          ctrl.return(),
        ]
      ),

      // Block broken! Clear tile and move probe into it
      ctrl.if(
        [local.get(py), i32.const(0), i32.eq(), local.get(ny), i32.const(0), i32.gt_s(), i32.and()],
        [setState(STATE.EXPEDITIONS, [getState(STATE.EXPEDITIONS), i32.const(1), i32.add()])]
      ),
      storeTile(local.get(idx), i32.const(TILE.EMPTY)),
      storeHp(local.get(idx), i32.const(0)),
      setState(STATE.TILES_DUG, [getState(STATE.TILES_DUG), i32.const(1), i32.add()]),
      setState(STATE.PX, local.get(nx)),
      setState(STATE.PY, local.get(ny)),
      ctrl.if(
        [local.get(ny), getState(STATE.MAX_DEPTH), i32.gt_s()],
        [setState(STATE.MAX_DEPTH, local.get(ny))]
      ),

      // Handle special block effects on break
      // 1. RELAY_NODE -> restore energy (+18 in L1/L2, +22 in L3)
      ctrl.if(
        [local.get(t), i32.const(TILE.RELAY_NODE), i32.eq()],
        [
          ctrl.if(
            [local.get(ny), i32.const(30), i32.ge_s()],
            [i32.const(22)],
            [i32.const(18)],
            VALTYPE.i32
          ),
          local.set(val),
          local.get(energy), local.get(val), i32.add(), local.set(energy),
          ctrl.if(
            [local.get(energy), getState(STATE.MAX_ENERGY), i32.gt_s()],
            [getState(STATE.MAX_ENERGY), local.set(energy)]
          ),
          setState(STATE.ENERGY, local.get(energy)),
          setState(STATE.EVENT_ARG, local.get(val)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.RELAY_COLLECTED)),
          ctrl.call(fns.get("update_visibility")),
          i32.const(EVENT.RELAY_COLLECTED),
          ctrl.return(),
        ]
      ),

      // 2. CORRUPT_HAZARD -> extra energy shock (-12 in L2, -16 in L3)
      ctrl.if(
        [local.get(t), i32.const(TILE.CORRUPT_HAZARD), i32.eq()],
        [
          ctrl.if(
            [local.get(ny), i32.const(30), i32.ge_s()],
            [i32.const(16)],
            [i32.const(12)],
            VALTYPE.i32
          ),
          local.set(val),
          local.get(energy), local.get(val), i32.sub(), local.set(energy),
          ctrl.if(
            [local.get(energy), i32.const(0), i32.le_s()],
            [
              ctrl.call(fns.get("trigger_extract")),
              i32.const(EVENT.EMERGENCY_EXTRACT),
              ctrl.return(),
            ]
          ),
          setState(STATE.ENERGY, local.get(energy)),
          setState(STATE.EVENT_ARG, local.get(val)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.HAZARD_TRIGGERED)),
          ctrl.call(fns.get("update_visibility")),
          i32.const(EVENT.HAZARD_TRIGGERED),
          ctrl.return(),
        ]
      ),

      // 3. Fragment-bearing tile -> add to CARRIED
      local.get(t), ctrl.call(fns.get("tile_value")), local.set(val),
      ctrl.if(
        [local.get(val), i32.const(0), i32.gt_s()],
        [
          setState(STATE.CARRIED, [getState(STATE.CARRIED), local.get(val), i32.add()]),
          ctrl.if(
            [local.get(energy), i32.const(0), i32.le_s()],
            [
              ctrl.call(fns.get("trigger_extract")),
              i32.const(EVENT.EMERGENCY_EXTRACT),
              ctrl.return(),
            ]
          ),
          setState(STATE.ENERGY, local.get(energy)),
          setState(STATE.EVENT_ARG, local.get(val)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.FRAGMENT_COLLECTED)),
          ctrl.call(fns.get("update_visibility")),
          i32.const(EVENT.FRAGMENT_COLLECTED),
          ctrl.return(),
        ]
      ),

      // 4. Normal structural block broken
      ctrl.if(
        [local.get(energy), i32.const(0), i32.le_s()],
        [
          ctrl.call(fns.get("trigger_extract")),
          i32.const(EVENT.EMERGENCY_EXTRACT),
          ctrl.return(),
        ]
      ),
      setState(STATE.ENERGY, local.get(energy)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.BLOCK_BROKEN)),
      ctrl.call(fns.get("update_visibility")),
      i32.const(EVENT.BLOCK_BROKEN),
    ];
  });

  // -------------------------------------------------------------------------
  // 9. trigger_scan() -> eventCode (Active Scanner Pulse, Scanner Lv >= 2, costs 5 E)
  // -------------------------------------------------------------------------
  m.defineFunction("trigger_scan", 10, (fns) => {
    const lv = 0, r = 1, r2 = 2, px = 3, py = 4, x = 5, y = 6, idx = 7, t = 8, hits = 9;
    return [
      getState(STATE.SCANNER_LV), local.set(lv),
      ctrl.if(
        [
          local.get(lv), i32.const(2), i32.lt_s(),
          getState(STATE.ENERGY), i32.const(5), i32.le_s(),
          i32.or(),
        ],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.SCAN_FAILED)),
          i32.const(EVENT.SCAN_FAILED),
          ctrl.return(),
        ]
      ),

      // Deduct 5 energy (only when underground)
      ctrl.if(
        [getState(STATE.PY), i32.const(0), i32.gt_s()],
        [setState(STATE.ENERGY, [getState(STATE.ENERGY), i32.const(5), i32.sub()])]
      ),

      local.get(lv), ctrl.call(fns.get("pulse_radius")), local.tee(r),
      local.get(r), i32.mul(), local.set(r2),
      getState(STATE.PX), local.set(px),
      getState(STATE.PY), local.set(py),
      i32.const(0), local.set(hits),

      i32.const(0), local.set(y),
      ctrl.block([
        ctrl.loop([
          local.get(y), i32.const(GRID_H), i32.ge_s(), ctrl.br_if(1),
          i32.const(0), local.set(x),
          ctrl.block([
            ctrl.loop([
              local.get(x), i32.const(GRID_W), i32.ge_s(), ctrl.br_if(1),
              // dist^2 <= r2
              local.get(x), local.get(px), i32.sub(),
              local.get(x), local.get(px), i32.sub(), i32.mul(),
              local.get(y), local.get(py), i32.sub(),
              local.get(y), local.get(py), i32.sub(), i32.mul(),
              i32.add(),
              local.get(r2), i32.le_s(),
              ctrl.if([], [
                tileIdxExpr(local.get(x), local.get(y)), local.set(idx),
                loadTile(local.get(idx)), local.set(t),
                // Mark SCANNED & EXPLORED
                storeFlag(local.get(idx), [loadFlag(local.get(idx)), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
                // Count interesting pings (shards, nodes, cores, relays, gateway, or hazards at lv>=3)
                ctrl.if(
                  [
                    local.get(t), i32.const(TILE.DATA_SHARD), i32.eq(),
                    local.get(t), i32.const(TILE.CIPHER_NODE), i32.eq(), i32.or(),
                    local.get(t), i32.const(TILE.CORE_FRAGMENT), i32.eq(), i32.or(),
                    local.get(t), i32.const(TILE.RELAY_NODE), i32.eq(), i32.or(),
                    local.get(t), i32.const(TILE.CATHEDRAL_GATEWAY), i32.eq(), i32.or(),
                    local.get(t), i32.const(TILE.CORRUPT_HAZARD), i32.eq(), local.get(lv), i32.const(3), i32.ge_s(), i32.and(), i32.or(),
                  ],
                  [local.get(hits), i32.const(1), i32.add(), local.set(hits)]
                ),
              ]),
              local.get(x), i32.const(1), i32.add(), local.set(x),
              ctrl.br(0),
            ]),
          ]),
          local.get(y), i32.const(1), i32.add(), local.set(y),
          ctrl.br(0),
        ]),
      ]),

      setState(STATE.EVENT_ARG, local.get(hits)),
      setState(STATE.EVENT_X, local.get(px)),
      setState(STATE.EVENT_Y, local.get(py)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.SCAN_PULSE)),
      i32.const(EVENT.SCAN_PULSE),
    ];
  });

  // -------------------------------------------------------------------------
  // 10. trigger_recall() -> eventCode (Tether Recall: costs 15% Max Energy, banks 100%)
  // -------------------------------------------------------------------------
  m.defineFunction("trigger_recall", 2, (fns) => {
    const cost = 0, carried = 1;
    return [
      ctrl.if(
        [getState(STATE.PY), i32.const(0), i32.eq()],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.RECALL_FAILED_SURFACE)),
          i32.const(EVENT.RECALL_FAILED_SURFACE),
          ctrl.return(),
        ]
      ),
      ctrl.call(fns.get("recall_cost")), local.set(cost),
      ctrl.if(
        [getState(STATE.ENERGY), local.get(cost), i32.lt_s()],
        [
          setState(STATE.EVENT_ARG, local.get(cost)),
          setState(STATE.LAST_EVENT, i32.const(EVENT.RECALL_FAILED_ENERGY)),
          i32.const(EVENT.RECALL_FAILED_ENERGY),
          ctrl.return(),
        ]
      ),
      getState(STATE.CARRIED), local.set(carried),
      setState(STATE.BANKED, [getState(STATE.BANKED), local.get(carried), i32.add()]),
      setState(STATE.CARRIED, i32.const(0)),
      setState(STATE.PX, i32.const(11)),
      setState(STATE.PY, i32.const(0)),
      setState(STATE.FACING, i32.const(DIR.DOWN)),
      setState(STATE.ENERGY, getState(STATE.MAX_ENERGY)),
      setState(STATE.EVENT_ARG, local.get(carried)),
      setState(STATE.EVENT_X, i32.const(11)),
      setState(STATE.EVENT_Y, i32.const(0)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.TETHER_RECALL)),
      ctrl.call(fns.get("update_visibility")),
      i32.const(EVENT.TETHER_RECALL),
    ];
  });

  // -------------------------------------------------------------------------
  // 11. buy_upgrade(upgradeId) -> eventCode (must be docked on Surface Row 0)
  // -------------------------------------------------------------------------
  m.defineFunction("buy_upgrade", 4, (fns) => {
    const uid = 0, lv = 1, cost = 2, newCap = 3;
    return [
      // Must be docked at surface (PY == 0)
      ctrl.if(
        [getState(STATE.PY), i32.const(0), i32.ne()],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.UPGRADE_FAILED)),
          i32.const(EVENT.UPGRADE_FAILED),
          ctrl.return(),
        ]
      ),
      // Get current level for upgradeId
      i32.const(0), local.set(lv),
      ctrl.if([local.get(uid), i32.const(UPGRADE.DRILL), i32.eq()], [getState(STATE.DRILL_LV), local.set(lv)]),
      ctrl.if([local.get(uid), i32.const(UPGRADE.BATTERY), i32.eq()], [getState(STATE.BATTERY_LV), local.set(lv)]),
      ctrl.if([local.get(uid), i32.const(UPGRADE.SCANNER), i32.eq()], [getState(STATE.SCANNER_LV), local.set(lv)]),
      ctrl.if([local.get(uid), i32.const(UPGRADE.CARGO), i32.eq()], [getState(STATE.CARGO_LV), local.set(lv)]),

      local.get(uid), local.get(lv), ctrl.call(fns.get("upgrade_cost")), local.set(cost),
      ctrl.if(
        [
          local.get(cost), i32.const(0), i32.lt_s(),
          getState(STATE.BANKED), local.get(cost), i32.lt_s(),
          i32.or(),
        ],
        [
          setState(STATE.LAST_EVENT, i32.const(EVENT.UPGRADE_FAILED)),
          i32.const(EVENT.UPGRADE_FAILED),
          ctrl.return(),
        ]
      ),

      // Deduct cost and increment level
      setState(STATE.BANKED, [getState(STATE.BANKED), local.get(cost), i32.sub()]),
      local.get(lv), i32.const(1), i32.add(), local.set(lv),

      ctrl.if([local.get(uid), i32.const(UPGRADE.DRILL), i32.eq()], [setState(STATE.DRILL_LV, local.get(lv))]),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.BATTERY), i32.eq()],
        [
          setState(STATE.BATTERY_LV, local.get(lv)),
          local.get(lv), ctrl.call(fns.get("battery_cap")), local.set(newCap),
          setState(STATE.MAX_ENERGY, local.get(newCap)),
          setState(STATE.ENERGY, local.get(newCap)),
        ]
      ),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.SCANNER), i32.eq()],
        [
          setState(STATE.SCANNER_LV, local.get(lv)),
          // Scanner Lv 4: Gateway Lock auto-marks Gateway Chamber (rows 44-45, cols 10-13) as SCANNED
          ctrl.if(
            [local.get(lv), i32.const(4), i32.ge_s()],
            [
              storeFlag(tileIdxExpr(i32.const(10), i32.const(44)), [loadFlag(tileIdxExpr(i32.const(10), i32.const(44))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
              storeFlag(tileIdxExpr(i32.const(11), i32.const(44)), [loadFlag(tileIdxExpr(i32.const(11), i32.const(44))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
              storeFlag(tileIdxExpr(i32.const(12), i32.const(44)), [loadFlag(tileIdxExpr(i32.const(12), i32.const(44))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
              storeFlag(tileIdxExpr(i32.const(13), i32.const(44)), [loadFlag(tileIdxExpr(i32.const(13), i32.const(44))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
              storeFlag(tileIdxExpr(i32.const(11), i32.const(45)), [loadFlag(tileIdxExpr(i32.const(11), i32.const(45))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
              storeFlag(tileIdxExpr(i32.const(12), i32.const(45)), [loadFlag(tileIdxExpr(i32.const(12), i32.const(45))), i32.const(FLAG.SCANNED | FLAG.EXPLORED), i32.or()]),
            ]
          ),
          ctrl.call(fns.get("update_visibility")),
        ]
      ),
      ctrl.if(
        [local.get(uid), i32.const(UPGRADE.CARGO), i32.eq()],
        [
          setState(STATE.CARGO_LV, local.get(lv)),
          local.get(lv), ctrl.call(fns.get("cargo_cap")), local.set(newCap),
          setState(STATE.MAX_CARGO, local.get(newCap)),
        ]
      ),

      setState(STATE.EVENT_ARG, local.get(uid)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.UPGRADE_BOUGHT)),
      i32.const(EVENT.UPGRADE_BOUGHT),
    ];
  });

  // -------------------------------------------------------------------------
  // 12. return_to_surface() - safe post-ending return to Surface Dock (11,0)
  // -------------------------------------------------------------------------
  m.defineFunction("return_to_surface", 0, (fns) => {
    return [
      setState(STATE.BANKED, [getState(STATE.BANKED), getState(STATE.CARRIED), i32.add()]),
      setState(STATE.CARRIED, i32.const(0)),
      setState(STATE.PX, i32.const(11)),
      setState(STATE.PY, i32.const(0)),
      setState(STATE.FACING, i32.const(DIR.DOWN)),
      setState(STATE.ENERGY, getState(STATE.MAX_ENERGY)),
      setState(STATE.LAST_EVENT, i32.const(EVENT.MOVED)),
      ctrl.call(fns.get("update_visibility")),
    ];
  });

  // -------------------------------------------------------------------------
  // 13. get_state(slot) -> i32
  // -------------------------------------------------------------------------
  m.defineFunction("get_state", 0, () => {
    const slot = 0;
    return [
      i32.const(MEM_STATE_OFFSET),
      local.get(slot), i32.const(4), i32.mul(),
      i32.add(),
      i32.load(),
    ];
  });

  return m.build();
}

// Execute when run directly as CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = compileArchiveCoreWasm();
  if (!WebAssembly.validate(bytes)) {
    new WebAssembly.Module(bytes); // surfaces detailed V8 error
  }
  fs.writeFileSync(OUT_WASM, bytes);
  const b64 = Buffer.from(bytes).toString("base64");
  fs.writeFileSync(
    OUT_B64,
    `// Auto-generated base64 fallback for file:// protocol loading.\n// Primary runtime loads ./archive_core.wasm directly over HTTP.\nexport const ARCHIVE_CORE_WASM_B64 = "${b64}";\n`
  );
  console.log(`Built ${OUT_WASM} (${bytes.length} bytes) — WebAssembly.validate() PASSED.`);
}
