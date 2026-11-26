// Main browser controller for DAJ_CATHEDRAL_BREACH_TOOL.
// Orchestrates: Boot Sequence -> Main Menu -> Gameplay -> Registrar Escalation ->
// Final Gateway (The Impossible Login) -> Forced Session Termination -> Main Menu.

import {
  DEFAULT_SEED,
  GRID_W,
  MEM_TILES_OFFSET,
  STATE,
  DIR,
  EVENT,
  UPGRADE,
  UPGRADE_INFO,
  getLayerForY,
} from "./constants.js";
import { ARCHIVE_CORE_WASM_B64 } from "./archive_core_b64.js";
import { SynthAudio } from "./audio.js";
import { VectorRenderer } from "./renderer.js";
import { saveGame, loadGame, restoreWasmState, clearSave } from "./storage.js";
import { loadSettings, saveSettings } from "./settings.js";
import {
  BOOT_PRE_LINES,
  BOOT_READY_LINES,
  DEFAULT_MILESTONES,
  ENDING_TRANSCRIPT,
  evaluateNextMilestone,
  getAlertBadgeForMilestones,
} from "./narrative.js";

export async function loadWasmCore() {
  // Test hook allowing automated E2E verification of real WASM init failure handling
  if (window.__FORCE_WASM_FAIL__) {
    throw new Error("Simulated WebAssembly module initialization failure.");
  }
  // Primary path: fetch standalone archive_core.wasm over HTTP
  if (window.location.protocol !== "file:") {
    try {
      const resp = await fetch("./src/archive_core.wasm");
      if (resp.ok) {
        const bytes = await resp.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes);
        return { instance, source: "http-wasm" };
      }
    } catch {
      // Fall through to embedded base64 binary fallback for offline/file:// use
    }
  }
  const bin = atob(ARCHIVE_CORE_WASM_B64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const { instance } = await WebAssembly.instantiate(bytes);
  return { instance, source: "embedded-wasm" };
}

class BreachToolApp {
  constructor() {
    this.wasm = null;
    this.memory = null;
    this.audio = new SynthAudio();
    this.renderer = new VectorRenderer(document.getElementById("game-canvas"));
    this.settings = loadSettings();

    // Screen state: "boot" | "menu" | "game"
    this.screen = "boot";
    this.wasmReady = false;
    this.bootSkipQueued = false;
    this.bootTimers = [];
    this.endingTimers = [];
    this.registrarTimer = null;
    this.glitchTimer = null;

    this.paused = false;
    this.activeModal = null;
    this.playTimeSec = 0;
    this.completedAt = null;
    this.milestones = { ...DEFAULT_MILESTONES };
    this.endingShownForRun = false;
    this.hasExistingSave = false;
    this.justEjected = false;

    this.heldDir = null;
    this.repeatTimer = 0;
    this.REPEAT_DELAY = 0.115;

    this._bindElements();
    this._applySettings();
    this._bindEvents();

    this.lastFrame = performance.now();
    requestAnimationFrame((t) => this._loop(t));

    // Start boot & real WASM module initialization
    this._startBootSequence({ allowAutoSkip: this.settings.skipBoot });
  }

  _bindElements() {
    this.el = {
      screenBoot: document.getElementById("screen-boot"),
      bootOutput: document.getElementById("boot-output"),
      bootError: document.getElementById("boot-error"),
      bootErrorMsg: document.getElementById("boot-error-msg"),
      bootHint: document.getElementById("boot-hint"),
      btnBootSkip: document.getElementById("btn-boot-skip"),
      btnBootRetry: document.getElementById("btn-boot-retry"),

      screenMenu: document.getElementById("screen-menu"),
      menuTerminatedBanner: document.getElementById("menu-terminated-banner"),
      menuSaveSummary: document.getElementById("menu-save-summary"),
      menuNav: document.getElementById("menu-nav"),
      btnMenuStart: document.getElementById("btn-menu-start"),
      btnMenuNew: document.getElementById("btn-menu-new"),
      btnMenuSettings: document.getElementById("btn-menu-settings"),
      btnMenuControls: document.getElementById("btn-menu-controls"),
      btnMenuAbout: document.getElementById("btn-menu-about"),
      btnMenuExit: document.getElementById("btn-menu-exit"),
      menuNewConfirm: document.getElementById("menu-new-confirm"),

      appShell: document.getElementById("app-shell"),
      canvasWrap: document.getElementById("canvas-wrap"),
      alertBadge: document.getElementById("hud-alert-badge"),
      layer: document.getElementById("hud-layer"),
      energyText: document.getElementById("hud-energy-text"),
      energyFill: document.getElementById("hud-energy-fill"),
      recallMarker: document.getElementById("hud-recall-marker"),
      cargoPill: document.getElementById("hud-cargo-pill"),
      carried: document.getElementById("hud-carried"),
      banked: document.getElementById("hud-banked"),
      rig: document.getElementById("hud-rig"),
      statusLog: document.getElementById("status-log"),
      registrarBanner: document.getElementById("registrar-banner"),
      registrarHeader: document.getElementById("registrar-header"),
      registrarBody: document.getElementById("registrar-body"),
      dockStatus: document.getElementById("dock-status"),
      upgradeListSide: document.getElementById("upgrade-list"),
      upgradeListModal: document.getElementById("upgrade-list-modal"),
      modalDockNote: document.getElementById("modal-dock-note"),
      recallHint: document.getElementById("recall-hint"),
      btnScanSide: document.getElementById("btn-scan-side"),
      btnRecallSide: document.getElementById("btn-recall-side"),
      btnScanTouch: document.getElementById("btn-scan-touch"),
      btnRecallTouch: document.getElementById("btn-recall-touch"),
      touchScanSub: document.getElementById("touch-scan-sub"),
      touchRecallSub: document.getElementById("touch-recall-sub"),
      btnSettings: document.getElementById("btn-settings"),
      btnMenuReturn: document.getElementById("btn-menu-return"),
      btnPause: document.getElementById("btn-pause"),
      btnUpgrades: document.getElementById("btn-upgrades"),

      optAudio: document.getElementById("opt-audio"),
      optShake: document.getElementById("opt-shake"),
      optReducedMotion: document.getElementById("opt-reduced-motion"),
      optSkipBoot: document.getElementById("opt-skip-boot"),
      settingsResetConfirm: document.getElementById("settings-reset-confirm"),

      pauseStats: document.getElementById("pause-stats"),
      resetConfirm: document.getElementById("reset-confirm"),
      endingTranscript: document.getElementById("ending-transcript"),
      endingActions: document.getElementById("ending-actions"),
      btnEndingSkip: document.getElementById("btn-ending-skip"),
    };
  }

  _applySettings() {
    this.audio.setMuted(!this.settings.audio);
    this.renderer.setEffectsConfig({
      screenShake: this.settings.screenShake,
      reducedMotion: this.settings.reducedMotion,
    });
    document.body.classList.toggle("reduced-motion", this.settings.reducedMotion);

    this.el.optAudio.checked = this.settings.audio;
    this.el.optShake.checked = this.settings.screenShake;
    this.el.optReducedMotion.checked = this.settings.reducedMotion;
    this.el.optSkipBoot.checked = this.settings.skipBoot;
  }

  _updateSetting(patch) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    this._applySettings();
  }

  // =========================================================================
  // BOOT SEQUENCE (never claims READY before real WASM init succeeds)
  // =========================================================================
  _clearBootTimers() {
    for (const id of this.bootTimers) clearTimeout(id);
    this.bootTimers = [];
  }

  async _startBootSequence({ allowAutoSkip = false, replayOnly = false } = {}) {
    this._clearBootTimers();
    this._closeAllModals();
    this.screen = "boot";
    this.bootSkipQueued = false;
    this.el.screenBoot.hidden = false;
    this.el.screenMenu.hidden = true;
    this.el.appShell.hidden = true;
    this.el.bootError.hidden = true;
    this.el.bootOutput.textContent = "";
    this.el.btnBootSkip.hidden = false;
    this.el.bootHint.textContent = "PRESS ANY KEY OR TAP TO SKIP";

    // Render pre-init lines
    if (this.settings.reducedMotion || allowAutoSkip) {
      this.el.bootOutput.textContent = BOOT_PRE_LINES.join("\n") + "\n";
    } else {
      BOOT_PRE_LINES.forEach((line, idx) => {
        const tid = setTimeout(() => {
          if (this.screen !== "boot" || !this.el.bootError.hidden) return;
          this.el.bootOutput.textContent += line + "\n";
        }, idx * 85);
        this.bootTimers.push(tid);
      });
    }

    // Perform real WASM initialization (unless replaying boot after already loaded)
    if (!this.wasmReady || !replayOnly) {
      try {
        if (!this.wasmReady) {
          const { instance } = await loadWasmCore();
          this.wasm = instance.exports;
          this.memory = instance.exports.memory;
          this.wasmReady = true;
          this._restoreOrInit();
        }
      } catch (err) {
        this._clearBootTimers();
        this.el.bootOutput.textContent = BOOT_PRE_LINES.join("\n") + "\n[ERR] MODULE LOAD ABORTED.\n";
        this.el.bootErrorMsg.textContent = `INITIALIZATION ERROR: ${err?.message || "Unable to load WASM module."}`;
        this.el.bootError.hidden = false;
        this.el.btnBootSkip.hidden = true;
        this.el.bootHint.textContent = "RECOVERY REQUIRED";
        this.el.btnBootRetry.focus();
        return;
      }
    }

    // Auto-skip straight to Main Menu if user enabled Skip Boot on Launch
    if (allowAutoSkip && !replayOnly) {
      this._showMainMenu();
      return;
    }

    // If user already tapped Skip while WASM was initializing, enter Menu immediately
    if (this.bootSkipQueued) {
      this._showMainMenu();
      return;
    }

    // Reveal post-init READY lines ONLY AFTER WASM actually succeeded
    if (this.settings.reducedMotion) {
      this.el.bootOutput.textContent = [...BOOT_PRE_LINES, ...BOOT_READY_LINES].join("\n");
      this.el.btnBootSkip.textContent = "CONTINUE >>";
      this.el.btnBootSkip.focus();
      const tid = setTimeout(() => {
        if (this.screen === "boot") this._showMainMenu();
      }, 900);
      this.bootTimers.push(tid);
    } else {
      const baseDelay = BOOT_PRE_LINES.length * 85 + 120;
      BOOT_READY_LINES.forEach((line, idx) => {
        const tid = setTimeout(() => {
          if (this.screen !== "boot") return;
          this.el.bootOutput.textContent += line + "\n";
          if (idx === BOOT_READY_LINES.length - 1) {
            this.el.btnBootSkip.textContent = "CONTINUE >>";
          }
        }, baseDelay + idx * 110);
        this.bootTimers.push(tid);
      });
      const doneTid = setTimeout(() => {
        if (this.screen === "boot") this._showMainMenu();
      }, baseDelay + BOOT_READY_LINES.length * 110 + 550);
      this.bootTimers.push(doneTid);
    }
  }

  skipBoot() {
    if (this.screen !== "boot") return;
    if (!this.el.bootError.hidden) return; // cannot skip past a fatal init error
    if (!this.wasmReady) {
      this.bootSkipQueued = true;
      return;
    }
    this._clearBootTimers();
    this._showMainMenu();
  }

  // =========================================================================
  // MAIN MENU
  // =========================================================================
  _showMainMenu({ fromEjection = false } = {}) {
    this._clearBootTimers();
    this._closeAllModals();
    this.screen = "menu";
    this.paused = true;
    this.heldDir = null;
    this.justEjected = Boolean(fromEjection);

    this.el.screenBoot.hidden = true;
    this.el.appShell.hidden = true;
    this.el.screenMenu.hidden = false;
    this.el.menuNewConfirm.hidden = true;

    this._syncMenuUI();
    this.el.btnMenuStart.focus();
  }

  _syncMenuUI() {
    if (!this.wasmReady) return;
    const completed = this.wasm.get_state(STATE.COMPLETED) === 1;
    const dug = this.wasm.get_state(STATE.TILES_DUG);
    const banked = this.wasm.get_state(STATE.BANKED);
    const maxDepth = this.wasm.get_state(STATE.MAX_DEPTH);
    const dLv = this.wasm.get_state(STATE.DRILL_LV);
    const bLv = this.wasm.get_state(STATE.BATTERY_LV);
    const sLv = this.wasm.get_state(STATE.SCANNER_LV);
    const cLv = this.wasm.get_state(STATE.CARGO_LV);
    const hasProgress = this.hasExistingSave || dug > 0 || banked > 0 || completed;

    this.el.btnMenuStart.textContent = hasProgress ? "CONTINUE INTRUSION" : "START INTRUSION";
    this.el.btnMenuNew.hidden = !hasProgress;
    this.el.menuTerminatedBanner.hidden = !this.justEjected && !completed;

    if (hasProgress) {
      this.el.menuSaveSummary.hidden = false;
      this.el.menuSaveSummary.textContent =
        `LOCAL SESSION: ACCESS DEPTH ${String(maxDepth).padStart(3, "0")} · EXPLOIT LIBRARY ${banked} SIGS · MODULES B${dLv}·P${bLv}·R${sLv}·E${cLv}` +
        (completed ? " · SESSION TERMINATED" : "");
    } else {
      this.el.menuSaveSummary.hidden = true;
    }
  }

  _enterGameplay() {
    if (!this.wasmReady) return;
    this._closeAllModals();
    this.screen = "game";
    this.paused = false;
    this.el.screenBoot.hidden = true;
    this.el.screenMenu.hidden = true;
    this.el.appShell.hidden = false;
    this.renderer.resize();
    this._syncUI();
  }

  // =========================================================================
  // SAVE / RESTORE / RESET
  // =========================================================================
  _restoreOrInit() {
    const loaded = loadGame();
    if (loaded.ok && loaded.data) {
      restoreWasmState(this.memory, loaded.data);
      this.playTimeSec = loaded.data.playTimeSec || 0;
      this.completedAt = loaded.data.completedAt || null;
      this.milestones = { ...DEFAULT_MILESTONES, ...(loaded.data.milestones || {}) };
      this.endingShownForRun = this.wasm.get_state(STATE.COMPLETED) === 1;
      this.hasExistingSave = true;
      this.wasm.update_visibility();
      this._setLog("[RESUME] LOCAL ARCHIVE SESSION RESTORED FROM MEMORY.");
    } else {
      this.wasm.init_world(DEFAULT_SEED);
      this.milestones = { ...DEFAULT_MILESTONES };
      this.hasExistingSave = false;
      if (loaded.reason === "corrupt") {
        clearSave();
        this._setLog("[RECOVERY] CORRUPT SAVE DISCARDED — INITIALIZED FRESH LOCAL NODE.");
      } else {
        this._setLog("[LOCAL NODE] RECOVER VULNERABILITY SIGNATURES. RETURN TO LOCAL NODE TO ANALYZE SIGS & COMPILE MODULES.");
      }
    }
  }

  _save() {
    if (!this.wasmReady) return;
    this.hasExistingSave = true;
    saveGame(this.memory, {
      playTimeSec: this.playTimeSec,
      completedAt: this.completedAt,
      milestones: this.milestones,
    });
  }

  _resetGame({ enterGame = false } = {}) {
    this._clearEndingTimers();
    this._dismissRegistrarBanner();
    clearSave();
    this.wasm.init_world(DEFAULT_SEED);
    this.playTimeSec = 0;
    this.completedAt = null;
    this.milestones = { ...DEFAULT_MILESTONES };
    this.endingShownForRun = false;
    this.hasExistingSave = false;
    this.justEjected = false;
    this._closeAllModals();
    this._setLog("[RESET] LOCAL MEMORY WIPED. READY FOR NEW INTRUSION SESSION.");
    if (enterGame || this.screen === "game") {
      this._enterGameplay();
    } else {
      this._syncMenuUI();
    }
  }

  _setLog(msg) {
    this.el.statusLog.textContent = msg;
  }

  // =========================================================================
  // REGISTRAR ESCALATION (Non-blocking, milestone-persisted, never early ID)
  // =========================================================================
  _checkRegistrarEscalation() {
    if (!this.wasmReady) return;
    const py = this.wasm.get_state(STATE.PY);
    const maxDepth = this.wasm.get_state(STATE.MAX_DEPTH);
    const tilesDug = this.wasm.get_state(STATE.TILES_DUG);

    const next = evaluateNextMilestone({ py, maxDepth, tilesDug }, this.milestones);
    if (!next) return;

    this.milestones[next.id] = true;
    this._save();
    this._presentRegistrarMilestone(next);
  }

  _presentRegistrarMilestone(milestone) {
    if (this.registrarTimer) clearTimeout(this.registrarTimer);
    this.audio.playRegistrarAlert(milestone.level);

    if (milestone.rumbleMag > 0) {
      this.renderer.triggerShake(milestone.rumbleMag, milestone.rumbleDur);
    }
    if (milestone.glitch && !this.settings.reducedMotion) {
      this._triggerViewportDisturbance();
    }

    this.el.registrarHeader.textContent = milestone.header;
    this.el.registrarBody.textContent = milestone.lines.join("\n");
    this.el.registrarBanner.className = `registrar-banner level-${milestone.level}`;
    this.el.registrarBanner.hidden = false;
    this._syncUI();

    this.registrarTimer = setTimeout(() => {
      this._dismissRegistrarBanner();
    }, 7000);
  }

  _dismissRegistrarBanner() {
    if (this.registrarTimer) {
      clearTimeout(this.registrarTimer);
      this.registrarTimer = null;
    }
    this.el.registrarBanner.hidden = true;
  }

  _triggerViewportDisturbance() {
    if (this.settings.reducedMotion) return;
    if (this.glitchTimer) clearTimeout(this.glitchTimer);
    this.el.canvasWrap.classList.remove("is-disturbed");
    // Force reflow so rapid triggers replay cleanly
    void this.el.canvasWrap.offsetWidth;
    this.el.canvasWrap.classList.add("is-disturbed");
    this.glitchTimer = setTimeout(() => {
      this.el.canvasWrap.classList.remove("is-disturbed");
      this.glitchTimer = null;
    }, 400);
  }

  // =========================================================================
  // INPUT & EVENT BINDING
  // =========================================================================
  _bindEvents() {
    window.addEventListener("resize", () => {
      if (this.screen === "game") this.renderer.resize();
    });

    // Boot screen interactions
    this.el.btnBootSkip.addEventListener("click", () => this.skipBoot());
    this.el.screenBoot.addEventListener("click", (e) => {
      if (e.target.closest("button")) return;
      this.skipBoot();
    });
    this.el.btnBootRetry.addEventListener("click", () => {
      this._startBootSequence({ allowAutoSkip: false });
    });

    // Main Menu interactions
    this.el.btnMenuStart.addEventListener("click", () => this._enterGameplay());
    this.el.btnMenuNew.addEventListener("click", () => {
      this.el.menuNewConfirm.hidden = false;
    });
    document.getElementById("btn-menu-new-cancel").addEventListener("click", () => {
      this.el.menuNewConfirm.hidden = true;
    });
    document.getElementById("btn-menu-new-confirm").addEventListener("click", () => {
      this._resetGame({ enterGame: true });
    });
    this.el.btnMenuSettings.addEventListener("click", () => this._openModal("modal-settings"));
    this.el.btnMenuControls.addEventListener("click", () => this._openModal("modal-help"));
    this.el.btnMenuAbout.addEventListener("click", () => this._openModal("modal-about"));

    // Keyboard navigation across Boot, Menu, Modals, and Gameplay
    const keyToDir = {
      ArrowUp: DIR.UP,
      KeyW: DIR.UP,
      ArrowRight: DIR.RIGHT,
      KeyD: DIR.RIGHT,
      ArrowDown: DIR.DOWN,
      KeyS: DIR.DOWN,
      ArrowLeft: DIR.LEFT,
      KeyA: DIR.LEFT,
    };

    window.addEventListener("keydown", (e) => {
      // Boot screen: any action key skips boot
      if (this.screen === "boot") {
        if (["Enter", "Space", "Escape"].includes(e.code)) {
          e.preventDefault();
          this.skipBoot();
        }
        return;
      }

      // Modal open: Escape closes (except during forced ending before skip/ack)
      if (this.activeModal) {
        if (e.code === "Escape") {
          e.preventDefault();
          if (this.activeModal === "modal-ending") {
            this._skipEndingTranscript();
          } else {
            this._closeAllModals();
          }
        }
        return;
      }

      // Main Menu keyboard navigation (ArrowUp / ArrowDown cycle visible menu items)
      if (this.screen === "menu") {
        if (e.code === "ArrowDown" || e.code === "ArrowUp") {
          e.preventDefault();
          const items = Array.from(this.el.menuNav.querySelectorAll("button:not([hidden]), a:not([hidden])"));
          if (items.length === 0) return;
          const idx = items.indexOf(document.activeElement);
          const nextIdx =
            e.code === "ArrowDown"
              ? (idx + 1 + items.length) % items.length
              : (idx - 1 + items.length) % items.length;
          items[nextIdx].focus();
        }
        return;
      }

      // Active gameplay keys
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        this._openModal("modal-pause");
        return;
      }
      if (e.code === "KeyM") {
        this._updateSetting({ audio: !this.settings.audio });
        this._setLog(this.settings.audio ? "[AUDIO] SYNTHESIZED SFX ENABLED." : "[AUDIO] SYNTHESIZED SFX MUTED.");
        return;
      }
      if (e.code === "KeyU") {
        this._openModal("modal-upgrades");
        return;
      }
      if (e.code === "Space" || e.code === "KeyE") {
        this.doScan();
        return;
      }
      if (e.code === "KeyR") {
        this.doRecall();
        return;
      }
      const dir = keyToDir[e.code];
      if (dir !== undefined && this.heldDir !== dir) {
        this.heldDir = dir;
        this.repeatTimer = this.REPEAT_DELAY;
        this.doMove(dir);
      }
    });

    window.addEventListener("keyup", (e) => {
      const dir = keyToDir[e.code];
      if (dir !== undefined && this.heldDir === dir) {
        this.heldDir = null;
      }
    });

    window.addEventListener("blur", () => {
      this.heldDir = null;
    });

    // Touch D-Pad (Pointer Events with hold-to-repeat)
    document.querySelectorAll(".dpad-btn").forEach((btn) => {
      const dir = Number(btn.dataset.dir);
      const startHold = (e) => {
        e.preventDefault();
        if (this.screen !== "game" || this.activeModal) return;
        btn.classList.add("pressed");
        this.heldDir = dir;
        this.repeatTimer = this.REPEAT_DELAY;
        this.doMove(dir);
      };
      const endHold = () => {
        btn.classList.remove("pressed");
        if (this.heldDir === dir) this.heldDir = null;
      };
      btn.addEventListener("pointerdown", startHold);
      btn.addEventListener("pointerup", endHold);
      btn.addEventListener("pointercancel", endHold);
      btn.addEventListener("pointerleave", endHold);
    });

    // Gameplay header & action buttons
    this.el.btnScanSide.addEventListener("click", () => this.doScan());
    this.el.btnRecallSide.addEventListener("click", () => this.doRecall());
    this.el.btnScanTouch.addEventListener("click", () => this.doScan());
    this.el.btnRecallTouch.addEventListener("click", () => this.doRecall());

    this.el.btnSettings.addEventListener("click", () => this._openModal("modal-settings"));
    this.el.btnMenuReturn.addEventListener("click", () => {
      this._save();
      this._showMainMenu();
    });
    this.el.btnPause.addEventListener("click", () => this._openModal("modal-pause"));
    this.el.btnUpgrades.addEventListener("click", () => this._openModal("modal-upgrades"));
    document.getElementById("btn-registrar-dismiss").addEventListener("click", () => this._dismissRegistrarBanner());

    // Settings controls
    this.el.optAudio.addEventListener("change", () => this._updateSetting({ audio: this.el.optAudio.checked }));
    this.el.optShake.addEventListener("change", () => this._updateSetting({ screenShake: this.el.optShake.checked }));
    this.el.optReducedMotion.addEventListener("change", () =>
      this._updateSetting({ reducedMotion: this.el.optReducedMotion.checked })
    );
    this.el.optSkipBoot.addEventListener("change", () =>
      this._updateSetting({ skipBoot: this.el.optSkipBoot.checked })
    );
    document.getElementById("btn-replay-boot").addEventListener("click", () => {
      this._startBootSequence({ allowAutoSkip: false, replayOnly: true });
    });
    document.getElementById("btn-settings-controls").addEventListener("click", () => this._openModal("modal-help"));
    document.getElementById("btn-settings-reset-req").addEventListener("click", () => {
      this.el.settingsResetConfirm.hidden = false;
    });
    document.getElementById("btn-settings-reset-cancel").addEventListener("click", () => {
      this.el.settingsResetConfirm.hidden = true;
    });
    document.getElementById("btn-settings-reset-confirm").addEventListener("click", () => {
      this._resetGame({ enterGame: false });
    });

    // Modal close & Pause buttons
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => this._closeAllModals());
    });
    document.getElementById("btn-resume").addEventListener("click", () => this._closeAllModals());
    document.getElementById("btn-pause-settings").addEventListener("click", () => this._openModal("modal-settings"));
    document.getElementById("btn-pause-menu").addEventListener("click", () => {
      this._save();
      this._showMainMenu();
    });
    document.getElementById("btn-reset-request").addEventListener("click", () => {
      this.el.resetConfirm.hidden = false;
    });
    document.getElementById("btn-reset-cancel").addEventListener("click", () => {
      this.el.resetConfirm.hidden = true;
    });
    document.getElementById("btn-reset-confirm").addEventListener("click", () => {
      this._resetGame({ enterGame: true });
    });

    // Ending modal buttons
    this.el.btnEndingSkip.addEventListener("click", () => this._skipEndingTranscript());
    document.getElementById("btn-ending-eject").addEventListener("click", () => this._performForcedEjection());
  }

  // =========================================================================
  // MODALS
  // =========================================================================
  _clearEndingTimers() {
    for (const id of this.endingTimers) clearTimeout(id);
    this.endingTimers = [];
  }

  _openModal(id) {
    this._closeAllModals();
    this.activeModal = id;
    this.paused = true;
    this.heldDir = null;
    document.querySelectorAll(".dpad-btn.pressed").forEach((b) => b.classList.remove("pressed"));
    if (id === "modal-pause") {
      this.el.resetConfirm.hidden = true;
      this._renderPauseStats();
    } else if (id === "modal-upgrades") {
      this._renderUpgrades();
    } else if (id === "modal-settings") {
      this.el.settingsResetConfirm.hidden = true;
      this._applySettings();
    }
    const modal = document.getElementById(id);
    modal.hidden = false;
    const focusTarget = modal.querySelector("button:not([hidden]):not(:disabled), input:not(:disabled)");
    if (focusTarget) focusTarget.focus();
  }

  _closeAllModals() {
    this._clearEndingTimers();
    [
      "modal-upgrades",
      "modal-settings",
      "modal-about",
      "modal-pause",
      "modal-help",
      "modal-ending",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    this.activeModal = null;
    this.paused = this.screen !== "game";
  }

  // =========================================================================
  // GAMEPLAY ACTIONS (preserved bare-metal WASM core)
  // =========================================================================
  doMove(dir) {
    if (this.screen !== "game" || this.paused || this.activeModal || !this.wasmReady) return;
    const ev = this.wasm.step_move(dir);
    const arg = this.wasm.get_state(STATE.EVENT_ARG);
    const ex = this.wasm.get_state(STATE.EVENT_X);
    const ey = this.wasm.get_state(STATE.EVENT_Y);

    switch (ev) {
      case EVENT.MOVED:
        this.audio.playMove();
        break;
      case EVENT.DRILLED_HIT:
        this.audio.playDrillHit(ey);
        this.renderer.triggerRecoil(dir);
        this.renderer.spawnParticles(ex, ey, "#e8b85c", 6, 65);
        break;
      case EVENT.BLOCK_BROKEN:
        this.audio.playBlockBreak();
        this.renderer.triggerShake(2.2, 0.09);
        this.renderer.spawnParticles(ex, ey, "#9bb5a3", 10, 85);
        break;
      case EVENT.FRAGMENT_COLLECTED:
        this.audio.playFragment(arg);
        this.renderer.triggerShake(2.5, 0.1);
        this.renderer.spawnParticles(ex, ey, arg >= 60 ? "#6ce8ff" : "#e8b85c", 14, 100);
        this.renderer.spawnPopup(ex, ey, `+${arg} SIGS`, arg >= 60 ? "#6ce8ff" : "#f0c265");
        this._setLog(`[EXPLOIT BUFFER] RECOVERED +${arg} SIGS. RETURN TO LOCAL NODE TO ANALYZE.`);
        break;
      case EVENT.RELAY_COLLECTED:
        this.audio.playRelay();
        this.renderer.spawnParticles(ex, ey, "#58cf8b", 14, 95);
        this.renderer.spawnPopup(ex, ey, `+${arg} POWER`, "#76f0a8");
        this._setLog(`[POWER RELAY] CELL RECHARGED (+${arg} E RESTORED).`);
        break;
      case EVENT.HAZARD_TRIGGERED:
        this.audio.playHazard();
        this.renderer.triggerShake(5.5, 0.22);
        this.renderer.spawnParticles(ex, ey, "#ff5c5c", 16, 115);
        this.renderer.spawnPopup(ex, ey, `-${arg} E FAULT`, "#ff6b6b");
        this._setLog(`[WARNING] CORRUPT FAULT DISCHARGED (-${arg} E).`);
        break;
      case EVENT.BLOCKED_HARD:
        this.audio.playBlocked();
        this.renderer.triggerRecoil(dir);
        break;
      case EVENT.BLOCKED_DRILL_LV:
        this.audio.playBlocked();
        this.renderer.triggerRecoil(dir);
        this.renderer.spawnPopup(ex, ey, `BREACH LV ${arg} REQ`, "#ff8080");
        this._setLog(`[LOCKED] SECURITY LAYER REQUIRES BREACH ENGINE LV ${arg}. COMPILE AT LOCAL NODE.`);
        break;
      case EVENT.BLOCKED_CARGO_FULL: {
        const carried = this.wasm.get_state(STATE.CARRIED);
        const maxCargo = this.wasm.get_state(STATE.MAX_CARGO);
        this.audio.playBlocked();
        this.renderer.triggerRecoil(dir);
        this.renderer.spawnPopup(ex, ey, "BUFFER FULL", "#ff8080");
        this._setLog(
          `[EXPLOIT BUFFER FULL] ${carried}/${maxCargo} SIGS (+${arg} NEEDS SPACE). SIGNATURE PRESERVED — RETURN TO LOCAL NODE OR SAFE DISCONNECT [R].`
        );
        break;
      }
      case EVENT.DOCKED_BANKED: {
        const lib = this.wasm.get_state(STATE.BANKED);
        this.audio.playBank();
        this.renderer.spawnPopup(ex, ey, `ANALYZED +${arg} SIGS`, "#5fd4e8");
        this._setLog(
          `[LOCAL NODE CONNECTED] VULNERABILITY SIGNATURES ANALYZED: +${arg} SIGS · EXPLOIT LIBRARY: ${lib} SIGS.`
        );
        break;
      }
      case EVENT.EMERGENCY_EXTRACT: {
        const lost = this.wasm.get_state(STATE.LAST_LOST);
        this.audio.playExtract();
        this.renderer.triggerShake(6, 0.28);
        this.renderer.spawnPopup(11, 1, `FAILSAFE EJECT (+${arg} SIGS)`, "#ff8080");
        this._setLog(
          `[FAILSAFE EJECT] POWER CELL DEPLETED — RETURNED TO LOCAL NODE. SALVAGED ${arg} SIGS (LOST ${lost}). MODULES & ROUTES PRESERVED.`
        );
        break;
      }
      case EVENT.GATEWAY_REACHED:
        this._dismissRegistrarBanner();
        this.audio.playGateway();
        if (!this.completedAt) {
          this.completedAt = new Date().toISOString();
        }
        this._save();
        this._syncUI();
        if (!this.endingShownForRun) {
          this._triggerImpossibleLoginEnding();
        } else {
          this._setLog("[GATEWAY] SESSION PREVIOUSLY TERMINATED BY REGISTRAR. AUTHORIZATION REMAINS DENIED.");
        }
        return;
      default:
        break;
    }

    this._checkRegistrarEscalation();
    this._save();
    this._syncUI();
  }

  doScan() {
    if (this.screen !== "game" || this.paused || this.activeModal || !this.wasmReady) return;
    const ev = this.wasm.trigger_scan();
    if (ev === EVENT.SCAN_PULSE) {
      const hits = this.wasm.get_state(STATE.EVENT_ARG);
      const px = this.wasm.get_state(STATE.PX);
      const py = this.wasm.get_state(STATE.PY);
      const lv = this.wasm.get_state(STATE.SCANNER_LV);
      const rad = UPGRADE_INFO[UPGRADE.SCANNER].pulseRadii[lv - 1] || 7;
      this.audio.playScan();
      if (!this.settings.reducedMotion) {
        this.renderer.triggerScanWave(px, py, rad);
      }
      this._setLog(`[RECON MODULE] PULSE COMPLETE — ${hits} SIGNATURE/SIGNAL(S) DETECTED WITHIN RADIUS ${rad}.`);
      this._save();
    } else {
      this.audio.playBlocked();
      const lv = this.wasm.get_state(STATE.SCANNER_LV);
      this._setLog(
        lv < 2
          ? "[RECON MODULE] ACTIVE PULSE REQUIRES RECON MODULE LV 2. COMPILE AT LOCAL NODE."
          : "[RECON MODULE] INSUFFICIENT POWER FOR PULSE (> 5 E REQUIRED)."
      );
    }
    this._syncUI();
  }

  doRecall() {
    if (this.screen !== "game" || this.paused || this.activeModal || !this.wasmReady) return;
    const ev = this.wasm.trigger_recall();
    if (ev === EVENT.TETHER_RECALL) {
      const banked = this.wasm.get_state(STATE.EVENT_ARG);
      const lib = this.wasm.get_state(STATE.BANKED);
      this.audio.playRecall();
      this.renderer.spawnParticles(11, 0, "#5fd4e8", 16, 95);
      this._setLog(
        `[SAFE DISCONNECT] LOCAL NODE CONNECTED. ANALYZED +${banked} SIGS (100% TRANSFERRED) · EXPLOIT LIBRARY: ${lib} SIGS.`
      );
      this._save();
    } else if (ev === EVENT.RECALL_FAILED_SURFACE) {
      this._setLog("[SAFE DISCONNECT] ALREADY CONNECTED TO LOCAL NODE (ROW 0).");
    } else if (ev === EVENT.RECALL_FAILED_ENERGY) {
      const req = this.wasm.get_state(STATE.EVENT_ARG);
      this.audio.playBlocked();
      this._setLog(`[SAFE DISCONNECT] INSUFFICIENT POWER (${req} E REQUIRED FOR SAFE DISCONNECT).`);
    }
    this._syncUI();
  }

  buyUpgrade(uid) {
    if (!this.wasmReady) return;
    const ev = this.wasm.buy_upgrade(uid);
    if (ev === EVENT.UPGRADE_BOUGHT) {
      this.audio.playUpgrade();
      const info = UPGRADE_INFO[uid];
      const newLv =
        uid === UPGRADE.DRILL
          ? this.wasm.get_state(STATE.DRILL_LV)
          : uid === UPGRADE.BATTERY
          ? this.wasm.get_state(STATE.BATTERY_LV)
          : uid === UPGRADE.SCANNER
          ? this.wasm.get_state(STATE.SCANNER_LV)
          : this.wasm.get_state(STATE.CARGO_LV);
      this._setLog(`[MODULE COMPILER] ${info.name} COMPILED TO LV ${newLv} — ${info.descriptions[newLv - 1]}.`);
      this._save();
    } else {
      this.audio.playBlocked();
    }
    this._syncUI();
  }

  // =========================================================================
  // FINAL GATEWAY — THE IMPOSSIBLE LOGIN & FORCED SESSION TERMINATION
  // =========================================================================
  _triggerImpossibleLoginEnding() {
    this.endingShownForRun = true;
    this._openModal("modal-ending");
    this.el.endingTranscript.innerHTML = "";
    this.el.endingActions.hidden = true;
    this.el.btnEndingSkip.hidden = false;

    if (this.settings.reducedMotion) {
      this._renderFullEndingTranscript();
      return;
    }

    ENDING_TRANSCRIPT.forEach((entry, i) => {
      const tid = setTimeout(() => {
        const div = document.createElement("div");
        div.className = `term-line ${entry.cls}`;
        div.textContent = entry.text;
        this.el.endingTranscript.appendChild(div);
        this.el.endingTranscript.scrollTop = this.el.endingTranscript.scrollHeight;
        if (i === ENDING_TRANSCRIPT.length - 1) {
          this.el.endingActions.hidden = false;
          this.el.btnEndingSkip.hidden = true;
          const btn = document.getElementById("btn-ending-eject");
          if (btn) btn.focus();
        }
      }, i * 380);
      this.endingTimers.push(tid);
    });
  }

  _renderFullEndingTranscript() {
    this._clearEndingTimers();
    this.el.endingTranscript.innerHTML = "";
    for (const entry of ENDING_TRANSCRIPT) {
      const div = document.createElement("div");
      div.className = `term-line ${entry.cls}`;
      div.textContent = entry.text;
      this.el.endingTranscript.appendChild(div);
    }
    this.el.endingTranscript.scrollTop = this.el.endingTranscript.scrollHeight;
    this.el.endingActions.hidden = false;
    this.el.btnEndingSkip.hidden = true;
    const btn = document.getElementById("btn-ending-eject");
    if (btn) btn.focus();
  }

  _skipEndingTranscript() {
    if (this.activeModal !== "modal-ending") return;
    if (this.el.endingActions.hidden) {
      this._renderFullEndingTranscript();
    }
  }

  _performForcedEjection() {
    this.audio.playTermination();
    // Preserve completion state & safely dock probe at Row 0 so save remains clean & replayable
    this.wasm.return_to_surface();
    this._save();

    const finishEject = () => {
      const card = document.querySelector(".ending-card");
      if (card) card.classList.remove("is-ejecting");
      this._showMainMenu({ fromEjection: true });
    };

    if (this.settings.reducedMotion) {
      finishEject();
    } else {
      const card = document.querySelector(".ending-card");
      if (card) card.classList.add("is-ejecting");
      this._triggerViewportDisturbance();
      const tid = setTimeout(finishEject, 340);
      this.endingTimers.push(tid);
    }
  }

  // =========================================================================
  // UI SYNC
  // =========================================================================
  _renderPauseStats() {
    const mins = Math.floor(this.playTimeSec / 60);
    const secs = Math.floor(this.playTimeSec % 60);
    const depth = this.wasm.get_state(STATE.MAX_DEPTH);
    const dug = this.wasm.get_state(STATE.TILES_DUG);
    const exp = this.wasm.get_state(STATE.EXPEDITIONS);
    const ext = this.wasm.get_state(STATE.EXTRACTIONS);
    this.el.pauseStats.innerHTML = `
      <div>PLAYTIME<strong>${mins}m ${String(secs).padStart(2, "0")}s</strong></div>
      <div>ACCESS DEPTH<strong>${String(depth).padStart(3, "0")} / 045</strong></div>
      <div>RUNS<strong>${exp}</strong></div>
      <div>BLOCKS BREACHED<strong>${dug}</strong></div>
      <div>FAILSAFE EJECTS<strong>${ext}</strong></div>
      <div>STATUS<strong>${this.wasm.get_state(STATE.COMPLETED) ? "SESSION TERMINATED" : "IN PROGRESS"}</strong></div>
    `;
  }

  _renderUpgrades() {
    const docked = this.wasm.get_state(STATE.PY) === 0;
    const banked = this.wasm.get_state(STATE.BANKED);
    const levels = {
      [UPGRADE.DRILL]: this.wasm.get_state(STATE.DRILL_LV),
      [UPGRADE.BATTERY]: this.wasm.get_state(STATE.BATTERY_LV),
      [UPGRADE.SCANNER]: this.wasm.get_state(STATE.SCANNER_LV),
      [UPGRADE.CARGO]: this.wasm.get_state(STATE.CARGO_LV),
    };

    this.el.dockStatus.textContent = docked ? "CONNECTED" : "REMOTE";
    this.el.dockStatus.className = docked ? "dock-pill" : "dock-pill away";
    this.el.modalDockNote.textContent = docked
      ? `Local Node Connected · Exploit Library: ${banked} SIGS`
      : `Remote sector active (Exploit Library: ${banked} SIGS). Return to Local Node or use Safe Disconnect to compile modules.`;

    const buildCards = (container) => {
      container.innerHTML = "";
      for (const uid of [UPGRADE.DRILL, UPGRADE.BATTERY, UPGRADE.SCANNER, UPGRADE.CARGO]) {
        const info = UPGRADE_INFO[uid];
        const lv = levels[uid];
        const isMax = lv >= info.maxLevel;
        const cost = this.wasm.get_upgrade_cost(uid, lv);
        const canBuy = docked && !isMax && banked >= cost;

        const card = document.createElement("div");
        card.className = `upgrade-card${canBuy ? " affordable" : ""}`;
        card.innerHTML = `
          <div class="upgrade-top">
            <span>${info.name}</span>
            <span>LV ${lv} / ${info.maxLevel}</span>
          </div>
          <div class="upgrade-desc">${info.descriptions[lv - 1]}</div>
          ${!isMax ? `<div class="upgrade-next">NEXT: ${info.descriptions[lv]}</div>` : `<div class="upgrade-next">MAX BUILD COMPILED</div>`}
        `;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-buy";
        btn.disabled = !canBuy;
        btn.textContent = isMax
          ? "MAXED"
          : !docked
          ? `LOCAL NODE REQ (${cost} SIGS)`
          : `COMPILE LV ${lv + 1} — ${cost} SIGS`;
        btn.addEventListener("click", () => this.buyUpgrade(uid));
        card.appendChild(btn);
        container.appendChild(card);
      }
    };

    buildCards(this.el.upgradeListSide);
    buildCards(this.el.upgradeListModal);
  }

  _syncUI() {
    if (!this.wasmReady) return;
    const px = this.wasm.get_state(STATE.PX);
    const py = this.wasm.get_state(STATE.PY);
    const energy = this.wasm.get_state(STATE.ENERGY);
    const maxEnergy = this.wasm.get_state(STATE.MAX_ENERGY);
    const carried = this.wasm.get_state(STATE.CARRIED);
    const maxCargo = this.wasm.get_state(STATE.MAX_CARGO);
    const banked = this.wasm.get_state(STATE.BANKED);
    const dLv = this.wasm.get_state(STATE.DRILL_LV);
    const bLv = this.wasm.get_state(STATE.BATTERY_LV);
    const sLv = this.wasm.get_state(STATE.SCANNER_LV);
    const cLv = this.wasm.get_state(STATE.CARGO_LV);
    const completed = this.wasm.get_state(STATE.COMPLETED) === 1;
    const recallCost = this.wasm.get_recall_cost();

    const memAddr = (MEM_TILES_OFFSET + py * GRID_W + px).toString(16).toUpperCase().padStart(4, "0");
    const layer = getLayerForY(py);
    this.el.layer.textContent = `${layer.name} · ACCESS DEPTH: ${String(py).padStart(3, "0")} · 0x${memAddr}`;

    const badge = getAlertBadgeForMilestones(this.milestones, completed);
    this.el.alertBadge.textContent = badge.text;
    this.el.alertBadge.className = `alert-badge level-${badge.level}`;

    this.el.energyText.textContent = `${energy} / ${maxEnergy} E`;
    const pct = Math.max(0, Math.min(100, (energy / maxEnergy) * 100));
    this.el.energyFill.style.width = `${pct}%`;
    this.el.energyFill.className =
      pct <= 20 ? "energy-fill crit" : pct <= 40 ? "energy-fill warn" : "energy-fill";

    const recallPct = Math.min(100, (recallCost / maxEnergy) * 100);
    this.el.recallMarker.style.left = `${recallPct}%`;
    this.el.recallHint.textContent = `Safe Disconnect costs ${recallCost} E (15%) & analyzes 100% of buffer.`;

    this.el.carried.textContent = `${carried} / ${maxCargo} SIGS`;
    const cargoFull = carried >= maxCargo;
    this.el.carried.className = cargoFull ? "stat-val full" : "stat-val amber";
    this.el.cargoPill.className = cargoFull ? "stat-pill cargo-full" : "stat-pill";
    this.el.banked.textContent = `${banked} SIGS`;
    this.el.rig.textContent = `B${dLv} · P${bLv} · R${sLv} · E${cLv}`;

    const canScan = sLv >= 2 && (py === 0 || energy > 5);
    const canRecall = py > 0 && energy >= recallCost;
    this.el.btnScanSide.disabled = !canScan;
    this.el.btnRecallSide.disabled = !canRecall;
    this.el.btnScanTouch.disabled = !canScan;
    this.el.btnRecallTouch.disabled = !canRecall;
    this.el.touchScanSub.textContent = sLv < 2 ? "LV 2 REQ" : "5 E";
    this.el.touchRecallSub.textContent = `${recallCost} E`;

    this._renderUpgrades();
  }

  _loop(now) {
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    if (this.screen === "game" && this.wasmReady) {
      if (!this.paused && !this.activeModal) {
        this.playTimeSec += dt;
        if (this.heldDir !== null) {
          this.repeatTimer -= dt;
          if (this.repeatTimer <= 0) {
            this.repeatTimer = this.REPEAT_DELAY;
            this.doMove(this.heldDir);
          }
        }
      }
      this.renderer.update(dt, this.memory);
      this.renderer.render(this.memory);
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

// Stage 3K (website integration): the app object is no longer a public debug interface. Automated tests set
// window.__ARCHIVE_PROBE_TEST__ = true before the page loads (for example with CDP addScriptToEvaluateOnNewDocument).
const app = new BreachToolApp();
if (window.__ARCHIVE_PROBE_TEST__ === true) {
  window.__ARCHIVE_PROBE__ = app;
}
