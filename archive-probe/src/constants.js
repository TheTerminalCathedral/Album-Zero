// Shared constants mirroring the bare-metal WebAssembly linear memory layout.
// Used by the WASM builder, browser renderer, storage serializer, and test suite.

export const GRID_W = 24;
export const GRID_H = 46;
export const GRID_SIZE = GRID_W * GRID_H; // 1104 tiles
export const DEFAULT_SEED = 0x43415448; // "CATH"

// WASM Linear Memory byte offsets
export const MEM_STATE_OFFSET = 0x0000; // Int32Array[32]
export const MEM_TILES_OFFSET = 0x0400; // Uint8Array[GRID_SIZE]
export const MEM_HP_OFFSET = 0x0c00;    // Uint8Array[GRID_SIZE]
export const MEM_FLAGS_OFFSET = 0x1400; // Uint8Array[GRID_SIZE]

// Int32 indices in MEM_STATE_OFFSET
export const STATE = {
  PX: 0,
  PY: 1,
  FACING: 2,
  ENERGY: 3,
  MAX_ENERGY: 4,
  CARRIED: 5,
  BANKED: 6,
  DRILL_LV: 7,
  BATTERY_LV: 8,
  SCANNER_LV: 9,
  RNG: 10,
  SEED: 11,
  COMPLETED: 12,
  EXPEDITIONS: 13,
  TILES_DUG: 14,
  EXTRACTIONS: 15,
  MAX_DEPTH: 16,
  LAST_EVENT: 17,
  EVENT_ARG: 18,
  EVENT_X: 19,
  EVENT_Y: 20,
  LAST_LOST: 21,
  TOTAL_MOVES: 22,
  CARGO_LV: 23,
  MAX_CARGO: 24,
};
export const STATE_COUNT = 25;
export const LEGACY_STATE_COUNT = 23;

// Directions
export const DIR = {
  UP: 0,
  RIGHT: 1,
  DOWN: 2,
  LEFT: 3,
};

// Tile types
export const TILE = {
  EMPTY: 0,
  CACHE_BLOCK: 1,      // Layer 1 soft data block (HP 3, Req Drill 1)
  DATA_SHARD: 2,       // Layer 1 amber fragment (HP 3, Req Drill 1, Val 10)
  DENSE_INDEX: 3,      // Layer 1/2 structural block (HP 5, Req Drill 1)
  CIPHER_BLOCK: 4,     // Layer 2 encrypted block (HP 6, Req Drill 2)
  CIPHER_NODE: 5,      // Layer 2 valuable node (HP 6, Req Drill 2, Val 25)
  CORRUPT_HAZARD: 6,   // Volatile corrupted block (HP 4, Req Drill 1, shock -12/-16 E)
  FIREWALL_BLOCK: 7,   // Layer 3 heavy firewall (HP 10, Req Drill 3)
  CORE_FRAGMENT: 8,    // Layer 3 rare cyan core (HP 10, Req Drill 3, Val 60)
  HARD_WALL: 9,        // Indestructible archive casing
  RELAY_NODE: 10,      // Energy capacitor (+18/+22 E on break)
  GATEWAY_SEAL: 11,    // Final lock (HP 16, Req Drill 4)
  CATHEDRAL_GATEWAY: 12, // Target destination -> triggers The Impossible Login
};

// Visibility & scan bitflags
export const FLAG = {
  VISIBLE: 1,
  SCANNED: 2,
  EXPLORED: 4,
};

// Event codes emitted by WASM into STATE.LAST_EVENT
export const EVENT = {
  NONE: 0,
  MOVED: 1,
  DRILLED_HIT: 2,
  BLOCK_BROKEN: 3,
  FRAGMENT_COLLECTED: 4,
  RELAY_COLLECTED: 5,
  HAZARD_TRIGGERED: 6,
  BLOCKED_HARD: 7,
  BLOCKED_DRILL_LV: 8,
  DOCKED_BANKED: 9,
  EMERGENCY_EXTRACT: 10,
  TETHER_RECALL: 11,
  RECALL_FAILED_ENERGY: 12,
  RECALL_FAILED_SURFACE: 13,
  SCAN_PULSE: 14,
  SCAN_FAILED: 15,
  UPGRADE_BOUGHT: 16,
  UPGRADE_FAILED: 17,
  GATEWAY_REACHED: 18,
  BLOCKED_CARGO_FULL: 19,
};

// Upgrade IDs
export const UPGRADE = {
  DRILL: 0,
  BATTERY: 1,
  SCANNER: 2,
  CARGO: 3,
};

// Upgrade metadata for Module Compiler UI (costs & stats mirror WASM logic exactly)
export const UPGRADE_INFO = {
  [UPGRADE.DRILL]: {
    id: UPGRADE.DRILL,
    name: "BREACH ENGINE",
    maxLevel: 4,
    costs: [0, 80, 280, 680],
    descriptions: [
      "PWR 1 | Penetrates Layer 1 Cache",
      "PWR 2 | Penetrates Layer 2 Vault",
      "PWR 4 | Penetrates Layer 3 Sanctum",
      "PWR 6 | Breaches Gateway Seal",
    ],
  },
  [UPGRADE.BATTERY]: {
    id: UPGRADE.BATTERY,
    name: "POWER CELL",
    maxLevel: 4,
    costs: [0, 70, 240, 540],
    capacities: [70, 120, 190, 280],
    descriptions: [
      "CAP 70 E | Short perimeter runs",
      "CAP 120 E | Vault-range power cell",
      "CAP 190 E | Deep sanctum reserve",
      "CAP 280 E | Maximum archive cell",
    ],
  },
  [UPGRADE.SCANNER]: {
    id: UPGRADE.SCANNER,
    name: "RECON MODULE",
    maxLevel: 4,
    costs: [0, 60, 210, 460],
    sightRadii: [3, 5, 7, 9],
    pulseRadii: [0, 7, 10, 14],
    descriptions: [
      "SIGHT 3 | Passive short telemetry",
      "SIGHT 5 | Pulse [SPACE] detects signatures (R7)",
      "SIGHT 7 | Pulse reveals faults + bearing (R10)",
      "SIGHT 9 | Deep array + Gateway lock (R14)",
    ],
  },
  [UPGRADE.CARGO]: {
    id: UPGRADE.CARGO,
    name: "EXPLOIT BUFFER",
    maxLevel: 4,
    costs: [0, 50, 170, 380],
    capacities: [60, 150, 300, 540],
    descriptions: [
      "CAP 60 SIGS | Compact signature buffer",
      "CAP 150 SIGS | Vault signature buffer",
      "CAP 300 SIGS | Deep signature buffer",
      "CAP 540 SIGS | Maximum signature buffer",
    ],
  },
};

export const LAYERS = [
  { id: 0, name: "LOCAL NODE", minY: 0, maxY: 0 },
  { id: 1, name: "L1 // PERIMETER CACHE", minY: 1, maxY: 14 },
  { id: 2, name: "L2 // ENCRYPTED VAULT", minY: 15, maxY: 29 },
  { id: 3, name: "L3 // CORE SANCTUM", minY: 30, maxY: 43 },
  { id: 4, name: "GATEWAY CHAMBER", minY: 44, maxY: 45 },
];

export function getLayerForY(y) {
  for (const layer of LAYERS) {
    if (y >= layer.minY && y <= layer.maxY) return layer;
  }
  return LAYERS[0];
}
