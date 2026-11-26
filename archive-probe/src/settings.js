// Persistent user settings for DAJ_CATHEDRAL_BREACH_TOOL.
// Respects OS prefers-reduced-motion by default and migrates legacy Stage 1 mute flag.

export const SETTINGS_KEY = "tc_daj_breach_settings_v1";
const LEGACY_MUTE_KEY = "tc_archive_probe_muted_v1";

export function detectSystemReducedMotion(matchMediaFn = globalThis.matchMedia) {
  if (typeof matchMediaFn !== "function") return false;
  try {
    return Boolean(matchMediaFn("(prefers-reduced-motion: reduce)").matches);
  } catch {
    return false;
  }
}

export function getDefaultSettings(matchMediaFn = globalThis.matchMedia) {
  const reducedMotion = detectSystemReducedMotion(matchMediaFn);
  return {
    audio: true,
    screenShake: !reducedMotion,
    reducedMotion,
    skipBoot: false,
  };
}

export function loadSettings(storage = globalThis.localStorage, matchMediaFn = globalThis.matchMedia) {
  const defaults = getDefaultSettings(matchMediaFn);
  if (!storage) return defaults;

  // Check legacy Stage 1 mute preference if no Stage 2 settings exist yet
  let raw = null;
  try {
    raw = storage.getItem(SETTINGS_KEY);
  } catch {
    return defaults;
  }

  if (!raw) {
    try {
      if (storage.getItem(LEGACY_MUTE_KEY) === "1") {
        defaults.audio = false;
      }
    } catch {
      // Ignore
    }
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaults;
    return {
      audio: typeof parsed.audio === "boolean" ? parsed.audio : defaults.audio,
      screenShake: typeof parsed.screenShake === "boolean" ? parsed.screenShake : defaults.screenShake,
      reducedMotion: typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : defaults.reducedMotion,
      skipBoot: typeof parsed.skipBoot === "boolean" ? parsed.skipBoot : defaults.skipBoot,
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings, storage = globalThis.localStorage) {
  if (!storage) return false;
  const normalized = {
    audio: Boolean(settings.audio),
    screenShake: Boolean(settings.screenShake),
    reducedMotion: Boolean(settings.reducedMotion),
    skipBoot: Boolean(settings.skipBoot),
  };
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    storage.setItem(LEGACY_MUTE_KEY, normalized.audio ? "0" : "1");
    return true;
  } catch {
    return false;
  }
}
