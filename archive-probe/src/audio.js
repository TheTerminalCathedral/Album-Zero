// Procedural Web Audio API synthesizer — zero external audio assets.
// Restrained terminal & arcade feedback with persistent mute toggle.

const MUTE_KEY = "tc_archive_probe_muted_v1";

export class SynthAudio {
  constructor() {
    this.ctx = null;
    this.muted = this._loadMute();
  }

  _loadMute() {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  }

  setMuted(flag) {
    this.muted = Boolean(flag);
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      // Ignore storage errors in restricted contexts
    }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  _ensureCtx() {
    if (this.muted) return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  _tone(freq, duration, type = "square", gainPeak = 0.06, endFreq = null, delay = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playMove() {
    this._tone(160, 0.035, "triangle", 0.028, 120);
  }

  playDrillHit(depth = 1) {
    const base = depth >= 30 ? 110 : depth >= 15 ? 145 : 185;
    this._tone(base, 0.055, "sawtooth", 0.045, base * 0.65);
  }

  playBlockBreak() {
    this._tone(140, 0.08, "square", 0.05, 65);
  }

  playFragment(value = 10) {
    const base = value >= 60 ? 660 : value >= 25 ? 520 : 420;
    this._tone(base, 0.08, "triangle", 0.06, base * 1.15);
    this._tone(base * 1.5, 0.11, "sine", 0.055, base * 1.5, 0.055);
  }

  playRelay() {
    this._tone(320, 0.09, "sine", 0.055, 640);
    this._tone(640, 0.12, "triangle", 0.045, 880, 0.07);
  }

  playHazard() {
    this._tone(240, 0.14, "sawtooth", 0.075, 72);
    this._tone(190, 0.12, "square", 0.05, 58, 0.05);
  }

  playBlocked() {
    this._tone(95, 0.07, "square", 0.045, 78);
  }

  playBank() {
    this._tone(392, 0.08, "triangle", 0.05);
    this._tone(523, 0.11, "triangle", 0.055, null, 0.07);
  }

  playRecall() {
    this._tone(260, 0.22, "sine", 0.06, 780);
    this._tone(520, 0.18, "triangle", 0.04, 1040, 0.06);
  }

  playExtract() {
    this._tone(340, 0.28, "sawtooth", 0.06, 85);
    this._tone(210, 0.25, "square", 0.045, 55, 0.12);
  }

  playScan() {
    this._tone(740, 0.24, "sine", 0.05, 420);
    this._tone(1110, 0.18, "sine", 0.03, 740, 0.04);
  }

  playUpgrade() {
    this._tone(330, 0.08, "triangle", 0.055);
    this._tone(440, 0.08, "triangle", 0.055, null, 0.07);
    this._tone(660, 0.14, "triangle", 0.06, null, 0.14);
  }

  playGateway() {
    this._tone(220, 0.35, "sine", 0.06);
    this._tone(330, 0.35, "triangle", 0.045, null, 0.08);
    this._tone(440, 0.4, "sine", 0.05, null, 0.16);
    // Crisp "ACCESS IMPOSSIBLE" low denial tone
    this._tone(155, 0.25, "square", 0.055, 140, 0.55);
  }

  playRegistrarAlert(level = 1) {
    const base = level >= 3 ? 195 : level === 2 ? 235 : 280;
    this._tone(base, 0.14, "triangle", 0.05);
    this._tone(base * 0.85, 0.18, "sine", 0.045, null, 0.12);
    if (level >= 3) {
      this._tone(130, 0.22, "sawtooth", 0.035, 95, 0.04);
    }
  }

  playTermination() {
    this._tone(280, 0.16, "square", 0.055, 110);
    this._tone(110, 0.32, "sawtooth", 0.05, 42, 0.14);
  }
}
