// Procedural Canvas 2D "Terminal Vector Mining" renderer.
// Reads game world directly from WASM linear memory buffers — zero external art assets.

import {
  GRID_W,
  GRID_H,
  GRID_SIZE,
  MEM_STATE_OFFSET,
  MEM_TILES_OFFSET,
  MEM_HP_OFFSET,
  MEM_FLAGS_OFFSET,
  STATE,
  STATE_COUNT,
  DIR,
  TILE,
  FLAG,
} from "./constants.js";

const TILE_MAX_HP = {
  [TILE.CACHE_BLOCK]: 3,
  [TILE.DATA_SHARD]: 3,
  [TILE.DENSE_INDEX]: 5,
  [TILE.CIPHER_BLOCK]: 6,
  [TILE.CIPHER_NODE]: 6,
  [TILE.CORRUPT_HAZARD]: 4,
  [TILE.FIREWALL_BLOCK]: 10,
  [TILE.CORE_FRAGMENT]: 10,
  [TILE.RELAY_NODE]: 3,
  [TILE.GATEWAY_SEAL]: 16,
};

export class VectorRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.tileSize = 32;
    this.camX = 0;
    this.camY = 0;
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.particles = [];
    this.popups = [];
    this.scanWave = null; // { x, y, maxRadius, progress }
    this.recoil = { x: 0, y: 0 };
    this.time = 0;
    this.screenShakeEnabled = true;
    this.reducedMotionEnabled = false;
  }

  setEffectsConfig({ screenShake = true, reducedMotion = false } = {}) {
    this.screenShakeEnabled = Boolean(screenShake);
    this.reducedMotionEnabled = Boolean(reducedMotion);
    if (!this.screenShakeEnabled || this.reducedMotionEnabled) {
      this.shakeTime = 0;
      this.shakeMag = 0;
      this.recoil = { x: 0, y: 0 };
    }
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(260, Math.floor(rect.width));
    const h = Math.max(220, Math.floor(rect.height));
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
    // Responsive tile size so 11-17 columns fit comfortably on mobile & desktop
    this.tileSize = Math.max(24, Math.min(36, Math.floor(Math.min(w / 12, h / 10))));
  }

  triggerShake(mag = 3.5, duration = 0.14) {
    if (!this.screenShakeEnabled || this.reducedMotionEnabled) return;
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  triggerRecoil(dir) {
    if (this.reducedMotionEnabled) return;
    const amt = 5;
    if (dir === DIR.UP) this.recoil = { x: 0, y: -amt };
    else if (dir === DIR.DOWN) this.recoil = { x: 0, y: amt };
    else if (dir === DIR.LEFT) this.recoil = { x: -amt, y: 0 };
    else if (dir === DIR.RIGHT) this.recoil = { x: amt, y: 0 };
  }

  spawnParticles(gx, gy, color, count = 8, speed = 70) {
    const cx = (gx + 0.5) * this.tileSize;
    const cy = (gy + 0.5) * this.tileSize;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.25 + Math.random() * 0.25,
        maxLife: 0.5,
        color,
        size: 1.5 + Math.random() * 2,
      });
    }
  }

  spawnPopup(gx, gy, text, color = "#e5c07b") {
    this.popups.push({
      x: (gx + 0.5) * this.tileSize,
      y: (gy + 0.25) * this.tileSize,
      text,
      color,
      life: 0.95,
      maxLife: 0.95,
    });
  }

  triggerScanWave(gx, gy, radiusTiles) {
    this.scanWave = {
      x: (gx + 0.5) * this.tileSize,
      y: (gy + 0.5) * this.tileSize,
      maxRadius: radiusTiles * this.tileSize,
      progress: 0,
    };
  }

  update(dt, memory) {
    this.time += dt;
    const state = new Int32Array(memory.buffer, MEM_STATE_OFFSET, STATE_COUNT);
    const px = state[STATE.PX];
    const py = state[STATE.PY];
    const ts = this.tileSize;

    // Smooth camera tracking (56px bottom padding keeps Row 45 clear of status toast)
    const targetX = (px + 0.5) * ts - this.viewW / 2;
    const targetY = (py + 0.5) * ts - this.viewH / 2;
    const maxCamX = Math.max(0, GRID_W * ts - this.viewW);
    const maxCamY = Math.max(0, GRID_H * ts - this.viewH + 56);
    const clampedX = Math.max(0, Math.min(maxCamX, targetX));
    const clampedY = Math.max(0, Math.min(maxCamY, targetY));

    const lerp = Math.min(1, dt * 12);
    this.camX += (clampedX - this.camX) * lerp;
    this.camY += (clampedY - this.camY) * lerp;

    // Decay recoil & screen shake
    this.recoil.x *= Math.max(0, 1 - dt * 18);
    this.recoil.y *= Math.max(0, 1 - dt * 18);
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMag = 0;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update floating popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y -= 26 * dt;
      pop.life -= dt;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Update radar scan wave
    if (this.scanWave) {
      this.scanWave.progress += dt * 1.9;
      if (this.scanWave.progress >= 1) this.scanWave = null;
    }
  }

  render(memory) {
    const ctx = this.ctx;
    const ts = this.tileSize;
    const state = new Int32Array(memory.buffer, MEM_STATE_OFFSET, STATE_COUNT);
    const tiles = new Uint8Array(memory.buffer, MEM_TILES_OFFSET, GRID_SIZE);
    const hpGrid = new Uint8Array(memory.buffer, MEM_HP_OFFSET, GRID_SIZE);
    const flags = new Uint8Array(memory.buffer, MEM_FLAGS_OFFSET, GRID_SIZE);

    const px = state[STATE.PX];
    const py = state[STATE.PY];
    const facing = state[STATE.FACING];
    const drillLv = state[STATE.DRILL_LV];
    const scannerLv = state[STATE.SCANNER_LV];

    // Background fill
    ctx.fillStyle = "#06080c";
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Subtle shake offset
    const sx = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;
    const sy = this.shakeTime > 0 ? (Math.random() - 0.5) * 2 * this.shakeMag : 0;

    // Center world horizontally if viewport wider than grid
    const worldW = GRID_W * ts;
    const offsetX = worldW < this.viewW ? Math.floor((this.viewW - worldW) / 2) : -Math.floor(this.camX);
    const offsetY = -Math.floor(this.camY);

    ctx.save();
    ctx.translate(offsetX + sx, offsetY + sy);

    const startCol = Math.max(0, Math.floor(-offsetX / ts) - 1);
    const endCol = Math.min(GRID_W - 1, Math.ceil((this.viewW - offsetX) / ts) + 1);
    const startRow = Math.max(0, Math.floor(-offsetY / ts) - 1);
    const endRow = Math.min(GRID_H - 1, Math.ceil((this.viewH - offsetY) / ts) + 1);

    // Draw surface dock banner (Row 0)
    if (startRow === 0) {
      ctx.fillStyle = "rgba(138, 111, 70, 0.09)";
      ctx.fillRect(0, 0, GRID_W * ts, ts);
      ctx.strokeStyle = "rgba(181, 148, 92, 0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, ts - 0.5);
      ctx.lineTo(GRID_W * ts, ts - 0.5);
      ctx.stroke();

      ctx.fillStyle = "rgba(196, 174, 134, 0.55)";
      ctx.font = `600 ${Math.max(9, Math.floor(ts * 0.3))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("▲ LOCAL NODE — ANALYZE SIGS & RECHARGE ▲", (GRID_W * ts) / 2, ts * 0.5);
    }

    // Draw depth layer divider labels
    this._drawLayerDivider(ctx, 15, ts, "L2 // ENCRYPTED VAULT [BREACH LV 2]", "#c98b44");
    this._drawLayerDivider(ctx, 30, ts, "L3 // CORE SANCTUM [BREACH LV 3]", "#c85555");
    this._drawLayerDivider(ctx, 44, ts, "GATEWAY SEAL [BREACH LV 4]", "#5fd4e8");

    // Draw visible tile window
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const idx = y * GRID_W + x;
        const t = tiles[idx];
        const hp = hpGrid[idx];
        const fl = flags[idx];
        const rx = x * ts;
        const ry = y * ts;

        const isVisible = (fl & FLAG.VISIBLE) !== 0;
        const isScanned = (fl & FLAG.SCANNED) !== 0;
        const isExplored = (fl & FLAG.EXPLORED) !== 0;

        if (!isVisible && !isExplored && !isScanned) {
          // Fog-of-war: faint terminal matrix dot
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = "rgba(110, 128, 150, 0.1)";
            ctx.fillRect(rx + ts * 0.5 - 1, ry + ts * 0.5 - 1, 2, 2);
          }
          continue;
        }

        if (t === TILE.EMPTY) {
          if (y > 0) {
            // Subtle carved tunnel grid outline
            ctx.strokeStyle = isVisible ? "rgba(120, 145, 165, 0.08)" : "rgba(120, 145, 165, 0.04)";
            ctx.lineWidth = 1;
            ctx.strokeRect(rx + 0.5, ry + 0.5, ts - 1, ts - 1);
          }
          continue;
        }

        // Dim tiles outside direct sight (explored or scanned memory echo)
        ctx.save();
        if (!isVisible) {
          ctx.globalAlpha = isScanned ? 0.58 : 0.34;
        }
        this._drawTile(ctx, rx, ry, ts, t, hp, y, isScanned && !isVisible, scannerLv);
        ctx.restore();
      }
    }

    // Draw Scanner Lv 3+ directional bearing arrow toward Gateway (11.5, 45)
    if (scannerLv >= 3 && py > 0 && py < 44) {
      const gx = 11.5;
      const gy = 45;
      const ang = Math.atan2(gy - py, gx - px);
      const pcx = (px + 0.5) * ts;
      const pcy = (py + 0.5) * ts;
      const dist = ts * 1.15;
      const ax = pcx + Math.cos(ang) * dist;
      const ay = pcy + Math.sin(ang) * dist;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.strokeStyle = "rgba(95, 212, 232, 0.65)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(5, 0);
      ctx.lineTo(-3, -3.5);
      ctx.lineTo(-3, 3.5);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Scanner Lv 4: Gateway Lock distance readout
      if (scannerLv >= 4) {
        const tileDist = Math.round(Math.hypot(gx - px, gy - py));
        ctx.save();
        ctx.fillStyle = "rgba(95, 212, 232, 0.85)";
        ctx.font = `700 ${Math.max(9, Math.floor(ts * 0.28))}px "IBM Plex Mono", monospace`;
        ctx.textAlign = "center";
        ctx.fillText(`GW:${tileDist}`, pcx, pcy - ts * 0.72);
        ctx.restore();
      }
    }

    // Draw probe
    this._drawProbe(
      ctx,
      (px + 0.5) * ts + this.recoil.x,
      (py + 0.5) * ts + this.recoil.y,
      ts,
      facing,
      drillLv
    );

    // Draw radar scan wave
    if (this.scanWave) {
      const rad = this.scanWave.maxRadius * this.scanWave.progress;
      const alpha = (1 - this.scanWave.progress) * 0.85;
      ctx.strokeStyle = `rgba(95, 212, 232, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.scanWave.x, this.scanWave.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Draw floating popups
    ctx.font = `700 ${Math.max(10, Math.floor(ts * 0.36))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const pop of this.popups) {
      ctx.globalAlpha = Math.min(1, pop.life / 0.35);
      ctx.fillStyle = "#05070a";
      ctx.fillText(pop.text, pop.x + 1, pop.y + 1);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  _drawLayerDivider(ctx, row, ts, label, color) {
    const y = row * ts;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ts, y);
    ctx.lineTo((GRID_W - 1) * ts, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.max(8, Math.floor(ts * 0.26))}px "IBM Plex Mono", monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(label, ts + 4, y - 2);
    ctx.restore();
  }

  _drawTile(ctx, x, y, ts, t, hp, row, isScanEcho, scannerLv) {
    const pad = 2;
    const w = ts - pad * 2;
    const cx = x + ts / 2;
    const cy = y + ts / 2;
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + x * 0.1 + y * 0.1);

    if (t === TILE.HARD_WALL) {
      ctx.fillStyle = "#10141c";
      ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
      ctx.strokeStyle = "#2b3545";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1.5, y + 1.5, ts - 3, ts - 3);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 4);
      ctx.lineTo(x + ts - 4, y + ts - 4);
      ctx.strokeStyle = "rgba(80, 96, 120, 0.28)";
      ctx.stroke();
      return;
    }

    if (t === TILE.CACHE_BLOCK) {
      ctx.fillStyle = "#121a16";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#3c5e4a";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
    } else if (t === TILE.DENSE_INDEX) {
      ctx.fillStyle = "#171c1f";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#5c6c68";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      ctx.strokeStyle = "rgba(138, 160, 152, 0.35)";
      ctx.strokeRect(x + pad + 4, y + pad + 4, w - 8, w - 8);
    } else if (t === TILE.DATA_SHARD) {
      ctx.fillStyle = "#1a1710";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#9c7a3c";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Amber diamond shard
      const r = ts * 0.24;
      ctx.fillStyle = "#e8b85c";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
    } else if (t === TILE.CIPHER_BLOCK) {
      ctx.fillStyle = "#1c1510";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#8f6233";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Cipher crosshatch
      ctx.strokeStyle = "rgba(176, 121, 59, 0.3)";
      ctx.beginPath();
      ctx.moveTo(x + pad + 3, cy);
      ctx.lineTo(x + ts - pad - 3, cy);
      ctx.moveTo(cx, y + pad + 3);
      ctx.lineTo(cx, y + ts - pad - 3);
      ctx.stroke();
    } else if (t === TILE.CIPHER_NODE) {
      ctx.fillStyle = "#161a20";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#c98b44";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Dual amber/cyan hex node
      const r = ts * 0.26;
      ctx.strokeStyle = "#5fd4e8";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const hx = cx + Math.cos(a) * r;
        const hy = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = "#f0be67";
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
    } else if (t === TILE.CORRUPT_HAZARD) {
      ctx.fillStyle = "#220f12";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = `rgba(229, 85, 85, ${0.65 + pulse * 0.35})`;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Warning triangle + exclamation
      ctx.strokeStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.moveTo(cx, y + pad + 5);
      ctx.lineTo(x + ts - pad - 5, y + ts - pad - 5);
      ctx.lineTo(x + pad + 5, y + ts - pad - 5);
      ctx.closePath();
      ctx.stroke();
      if (isScanEcho && scannerLv >= 3) {
        ctx.strokeStyle = "#ff4d4d";
        ctx.strokeRect(x + 1, y + 1, ts - 2, ts - 2);
      }
    } else if (t === TILE.FIREWALL_BLOCK) {
      ctx.fillStyle = "#181116";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#7d3d4a";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      ctx.strokeStyle = "rgba(180, 82, 98, 0.35)";
      ctx.strokeRect(x + pad + 5, y + pad + 5, w - 10, w - 10);
    } else if (t === TILE.CORE_FRAGMENT) {
      ctx.fillStyle = "#0e1b22";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = `rgba(95, 212, 232, ${0.65 + pulse * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Radiant cyan star core
      const r = ts * 0.28;
      ctx.fillStyle = "#6ce8ff";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.35, cy - r * 0.35);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx + r * 0.35, cy + r * 0.35);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.35, cy + r * 0.35);
      ctx.lineTo(cx - r, cy);
      ctx.lineTo(cx - r * 0.35, cy - r * 0.35);
      ctx.closePath();
      ctx.fill();
    } else if (t === TILE.RELAY_NODE) {
      ctx.fillStyle = "#0f1e18";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#52c985";
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      // Vector energy bolt
      ctx.fillStyle = "#76f0a8";
      ctx.beginPath();
      ctx.moveTo(cx + 2, y + pad + 4);
      ctx.lineTo(cx - 5, cy + 1);
      ctx.lineTo(cx, cy + 1);
      ctx.lineTo(cx - 2, y + ts - pad - 4);
      ctx.lineTo(cx + 5, cy - 1);
      ctx.lineTo(cx, cy - 1);
      ctx.closePath();
      ctx.fill();
    } else if (t === TILE.GATEWAY_SEAL) {
      ctx.fillStyle = "#1c1814";
      ctx.fillRect(x + pad, y + pad, w, w);
      ctx.strokeStyle = "#e5b869";
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, w - 1, w - 1);
      ctx.fillStyle = "#e5b869";
      ctx.font = `700 ${Math.max(8, Math.floor(ts * 0.28))}px "IBM Plex Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("L4", cx, cy);
    } else if (t === TILE.CATHEDRAL_GATEWAY) {
      ctx.fillStyle = `rgba(95, 212, 232, ${0.14 + pulse * 0.14})`;
      ctx.fillRect(x + 1, y + 1, ts - 2, ts - 2);
      ctx.strokeStyle = "#6ce8ff";
      ctx.lineWidth = 2;
      // Cathedral arch vector
      ctx.beginPath();
      ctx.moveTo(x + 6, y + ts - 4);
      ctx.lineTo(x + 6, cy);
      ctx.arc(cx, cy, ts * 0.3, Math.PI, 0, false);
      ctx.lineTo(x + ts - 6, y + ts - 4);
      ctx.stroke();
      ctx.fillStyle = "#f2d28b";
      ctx.beginPath();
      ctx.arc(cx, cy + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Damage indicator bar & fracture lines when block is partially drilled
    const maxHp = TILE_MAX_HP[t] || 0;
    if (maxHp > 0 && hp > 0 && hp < maxHp) {
      const ratio = hp / maxHp;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(x + 4, y + ts - 6, ts - 8, 3);
      ctx.fillStyle = ratio > 0.5 ? "#e5c07b" : "#ff6b6b";
      ctx.fillRect(x + 4, y + ts - 6, Math.max(2, (ts - 8) * ratio), 3);

      // Fracture lines
      ctx.strokeStyle = "rgba(255, 245, 220, 0.45)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy - 4);
      ctx.lineTo(cx + 2, cy);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.stroke();
    }
  }

  _drawProbe(ctx, cx, cy, ts, facing, drillLv) {
    ctx.save();
    ctx.translate(cx, cy);
    const angles = {
      [DIR.UP]: -Math.PI / 2,
      [DIR.RIGHT]: 0,
      [DIR.DOWN]: Math.PI / 2,
      [DIR.LEFT]: Math.PI,
    };
    ctx.rotate(angles[facing] ?? 0);

    const r = ts * 0.34;
    // Outer chassis
    ctx.fillStyle = "#161d26";
    ctx.strokeStyle = "#e6edf7";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(r * 0.55, -r * 0.65);
    ctx.lineTo(-r * 0.8, -r * 0.55);
    ctx.lineTo(-r * 0.8, r * 0.55);
    ctx.lineTo(r * 0.55, r * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Drill nose cone — visibly upgrades with Drill Level!
    const drillColors = ["#a8c49a", "#e8b85c", "#5fd4e8", "#ff9f59"];
    const drillLen = r * (0.95 + (drillLv - 1) * 0.16);
    ctx.fillStyle = drillColors[Math.min(3, drillLv - 1)];
    ctx.beginPath();
    ctx.moveTo(drillLen, 0);
    ctx.lineTo(r * 0.35, -r * 0.52);
    ctx.lineTo(r * 0.35, r * 0.52);
    ctx.closePath();
    ctx.fill();

    // Core sensor eye
    ctx.fillStyle = "#6ce8ff";
    ctx.fillRect(-r * 0.3, -2, 4, 4);

    ctx.restore();
  }
}
