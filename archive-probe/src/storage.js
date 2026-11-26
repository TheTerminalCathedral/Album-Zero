// Resilient localStorage persistence for WASM linear memory state.
// Validates schema, bounds, and types; degrades gracefully on corrupt/missing data.

import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  MEM_STATE_OFFSET,
  MEM_TILES_OFFSET,
  MEM_HP_OFFSET,
  MEM_FLAGS_OFFSET,
  STATE_COUNT,
  LEGACY_STATE_COUNT,
  STATE,
} from "./constants.js";

export const SAVE_KEY = "tc_archive_probe_save_v1";
export const SAVE_VERSION = 1;

function uint8ToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function base64ToUint8(b64) {
  if (typeof b64 !== "string") return null;
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

export function serializeWasmState(memory, meta = {}) {
  const stateView = new Int32Array(memory.buffer, MEM_STATE_OFFSET, STATE_COUNT);
  const tilesView = new Uint8Array(memory.buffer, MEM_TILES_OFFSET, GRID_SIZE);
  const hpView = new Uint8Array(memory.buffer, MEM_HP_OFFSET, GRID_SIZE);
  const flagsView = new Uint8Array(memory.buffer, MEM_FLAGS_OFFSET, GRID_SIZE);

  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    playTimeSec: Math.max(0, Math.floor(Number(meta.playTimeSec) || 0)),
    completedAt: meta.completedAt || null,
    milestones: {
      l1: Boolean(meta.milestones?.l1),
      l2: Boolean(meta.milestones?.l2),
      l3: Boolean(meta.milestones?.l3),
      gateway: Boolean(meta.milestones?.gateway),
    },
    state: Array.from(stateView),
    tilesB64: uint8ToBase64(tilesView),
    hpB64: uint8ToBase64(hpView),
    flagsB64: uint8ToBase64(flagsView),
  };
}

export function validateSavePayload(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.version !== SAVE_VERSION) return null;
  if (!Array.isArray(raw.state)) return null;
  const isLegacy = raw.state.length === LEGACY_STATE_COUNT;
  if (!isLegacy && raw.state.length !== STATE_COUNT) return null;
  for (let i = 0; i < raw.state.length; i++) {
    if (typeof raw.state[i] !== "number" || !Number.isFinite(raw.state[i])) return null;
  }
  const tiles = base64ToUint8(raw.tilesB64);
  const hp = base64ToUint8(raw.hpB64);
  const flags = base64ToUint8(raw.flagsB64);
  if (!tiles || tiles.length !== GRID_SIZE) return null;
  if (!hp || hp.length !== GRID_SIZE) return null;
  if (!flags || flags.length !== GRID_SIZE) return null;

  // Migrate legacy 23-slot saves by appending default Cargo Lv 1 / Max Cargo 60 (or >= carried)
  const stateArr = raw.state.map((n) => n | 0);
  if (isLegacy) {
    const carried = Math.max(0, stateArr[STATE.CARRIED] || 0);
    stateArr.push(1, Math.max(60, carried));
  }

  // Sanity-check key gameplay invariants so tampered/corrupt saves cannot softlock
  const px = stateArr[STATE.PX];
  const py = stateArr[STATE.PY];
  const energy = stateArr[STATE.ENERGY];
  const drillLv = stateArr[STATE.DRILL_LV];
  const battLv = stateArr[STATE.BATTERY_LV];
  const scanLv = stateArr[STATE.SCANNER_LV];
  const cargoLv = stateArr[STATE.CARGO_LV];
  const maxE = stateArr[STATE.MAX_ENERGY];
  const maxCargo = stateArr[STATE.MAX_CARGO];
  if (px < 0 || px >= GRID_W || py < 0 || py >= GRID_H) {
    return null;
  }
  if (drillLv < 1 || drillLv > 4 || battLv < 1 || battLv > 4 || scanLv < 1 || scanLv > 4 || cargoLv < 1 || cargoLv > 4) {
    return null;
  }
  if (maxE < 50 || maxE > 500 || energy <= 0 || energy > maxE) {
    return null;
  }
  if (maxCargo < 60 || maxCargo > 1000) {
    return null;
  }

  const rawMilestones = raw.milestones && typeof raw.milestones === "object" ? raw.milestones : {};
  return {
    version: raw.version,
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : null,
    playTimeSec: Math.max(0, Math.floor(Number(raw.playTimeSec) || 0)),
    completedAt: typeof raw.completedAt === "string" ? raw.completedAt : null,
    milestones: {
      l1: Boolean(rawMilestones.l1),
      l2: Boolean(rawMilestones.l2),
      l3: Boolean(rawMilestones.l3),
      gateway: Boolean(rawMilestones.gateway),
    },
    state: stateArr,
    tiles,
    hp,
    flags,
  };
}

export function restoreWasmState(memory, validated) {
  const stateView = new Int32Array(memory.buffer, MEM_STATE_OFFSET, STATE_COUNT);
  const tilesView = new Uint8Array(memory.buffer, MEM_TILES_OFFSET, GRID_SIZE);
  const hpView = new Uint8Array(memory.buffer, MEM_HP_OFFSET, GRID_SIZE);
  const flagsView = new Uint8Array(memory.buffer, MEM_FLAGS_OFFSET, GRID_SIZE);

  stateView.set(validated.state);
  tilesView.set(validated.tiles);
  hpView.set(validated.hp);
  flagsView.set(validated.flags);
}

export function saveGame(memory, meta = {}, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    const payload = serializeWasmState(memory, meta);
    storage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(storage = globalThis.localStorage) {
  if (!storage) return { ok: false, reason: "no-storage", data: null };
  let rawStr;
  try {
    rawStr = storage.getItem(SAVE_KEY);
  } catch {
    return { ok: false, reason: "read-error", data: null };
  }
  if (!rawStr) return { ok: false, reason: "empty", data: null };
  try {
    const parsed = JSON.parse(rawStr);
    const validated = validateSavePayload(parsed);
    if (!validated) {
      return { ok: false, reason: "corrupt", data: null };
    }
    return { ok: true, reason: "ok", data: validated };
  } catch {
    return { ok: false, reason: "corrupt", data: null };
  }
}

export function clearSave(storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}
