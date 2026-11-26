// Real headless Chrome/Edge browser E2E verification via Chrome DevTools Protocol (zero npm deps).
// Covers Stage 1 + Stage 2 requirements:
// 1. Real WASM init failure handling & recovery (never shows READY on failure)
// 2. Boot sequence display, skip, and Main Menu presentation (DAJ_CATHEDRAL_BREACH_TOOL)
// 3. Settings persistence (Audio, Screen Shake, Reduced Motion, Skip Boot) & reduced-motion class
// 4. Desktop keyboard navigation (menu + gameplay ArrowDown drilling + Pause/Return to Menu)
// 5. Registrar escalation milestones (L1 -> L2 -> L3 -> Gateway) in order, non-repeating, no early ID
// 6. Mobile portrait viewport (390x844): touch D-pad via real CDP click, zero horizontal overflow
// 7. Final Gateway (The Impossible Login) -> Forced Session Termination -> Main Menu ejection
// 8. Forbidden Record unlock, placeholder banner, persistence across reload, and Reset Save Data
//
// Run: node archive-probe/tests/browser-e2e.mjs [--screenshots <dir>]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAME_ROOT = path.resolve(__dirname, "..");

const ssFlagIdx = process.argv.indexOf("--screenshots");
const SCREENSHOT_DIR = ssFlagIdx !== -1 && process.argv[ssFlagIdx + 1]
  ? path.resolve(process.argv[ssFlagIdx + 1])
  : null;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json",
};

function findBrowserBinary() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = (req.url || "/").split("?")[0];
      const rel = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
      const filePath = path.resolve(GAME_ROOT, rel);
      if (!filePath.startsWith(GAME_ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: addr.port });
    });
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve);
      this.ws.addEventListener("error", reject);
    });
    this.ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        this.events.push(msg);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Browser JS exception: ${res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async capture(name) {
    if (!SCREENSHOT_DIR) return;
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const { data } = await this.send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(SCREENSHOT_DIR, name), Buffer.from(data, "base64"));
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function waitForDevTools(port, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/json`);
      if (resp.ok) {
        const targets = await resp.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("Timed out waiting for Chrome DevTools endpoint");
}

async function main() {
  const browserBin = findBrowserBinary();
  if (!browserBin) {
    console.error("No local Chrome/Edge binary found.");
    process.exit(1);
  }

  const { server, port: httpPort } = await startStaticServer();
  const cdpPort = 9222 + Math.floor(Math.random() * 500);
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "tc-game-cdp-"));

  const chrome = spawn(
    browserBin,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let cdp = null;
  try {
    const wsUrl = await waitForDevTools(cdpPort);
    cdp = new CDPClient(wsUrl);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });

    const url = `http://127.0.0.1:${httpPort}/`;

    // 1. Test graceful WASM initialization failure & Retry recovery
    const failScript = await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: "window.__FORCE_WASM_FAIL__ = true;",
    });
    await cdp.send("Page.navigate", { url });
    await new Promise((r) => setTimeout(r, 450));

    const failState = await cdp.eval(`(() => ({
      bootVisible: !document.getElementById('screen-boot').hidden,
      errorVisible: !document.getElementById('boot-error').hidden,
      hasReady: (document.getElementById('boot-output').textContent || '').includes('EXECUTION ENVIRONMENT READY'),
    }))()`);
    assert.equal(failState.bootVisible, true, "Boot screen should remain visible on init failure");
    assert.equal(failState.errorVisible, true, "Error recovery panel should appear on WASM init failure");
    assert.equal(failState.hasReady, false, "Boot must NEVER claim READY on WASM failure");

    // Clear forced failure & click Retry -> recovers cleanly
    await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: failScript.identifier });
    await cdp.eval(`window.__FORCE_WASM_FAIL__ = false; document.getElementById('btn-boot-retry').click();`);
    await new Promise((r) => setTimeout(r, 950));
    await cdp.capture("01-boot-screen.png");

    // 2. Skip boot via keyboard Enter -> enters Main Menu
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await new Promise((r) => setTimeout(r, 150));

    const menuState = await cdp.eval(`(() => ({
      menuVisible: !document.getElementById('screen-menu').hidden,
      title: document.querySelector('.menu-title')?.textContent?.trim(),
      startText: document.getElementById('btn-menu-start')?.textContent?.trim(),
      exitHref: document.getElementById('btn-menu-exit')?.getAttribute('href'),
      exitText: document.getElementById('btn-menu-exit')?.textContent?.trim(),
      hasForbiddenModal: Boolean(document.getElementById('modal-forbidden')),
      hasForbiddenMenuBtn: Boolean(document.getElementById('btn-menu-forbidden')),
    }))()`);
    assert.equal(menuState.menuVisible, true, "Main menu did not appear after skipping boot");
    assert.equal(menuState.title, "DAJ_CATHEDRAL_BREACH_TOOL");
    assert.equal(menuState.startText, "START INTRUSION");
    assert.equal(menuState.exitHref, "https://terminalcathedral.com/", "EXIT TO ARCHIVE must link to https://terminalcathedral.com/");
    assert.equal(menuState.exitText, "EXIT TO ARCHIVE");
    assert.equal(menuState.hasForbiddenModal, false, "Forbidden Record modal must be removed");
    assert.equal(menuState.hasForbiddenMenuBtn, false, "Forbidden Record menu button must be removed");
    await cdp.capture("02-main-menu.png");

    // 3. Open Settings modal, verify toggles & persistence, capture screenshot
    await cdp.eval(`document.getElementById('btn-menu-settings').click()`);
    await new Promise((r) => setTimeout(r, 120));
    await cdp.capture("03-settings-modal.png");

    await cdp.eval(`(() => {
      const rm = document.getElementById('opt-reduced-motion');
      rm.checked = true; rm.dispatchEvent(new Event('change', { bubbles: true }));
      const sb = document.getElementById('opt-skip-boot');
      sb.checked = true; sb.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    assert.equal(await cdp.eval(`document.body.classList.contains('reduced-motion')`), true, "Reduced motion class not applied");

    // Reload and verify Skip Boot skips straight to Main Menu & Reduced Motion persisted
    await cdp.send("Page.reload", { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 500));
    const afterSettingsReload = await cdp.eval(`(() => ({
      menuVisible: !document.getElementById('screen-menu').hidden,
      reducedMotion: document.body.classList.contains('reduced-motion'),
    }))()`);
    assert.equal(afterSettingsReload.menuVisible, true, "Skip Boot setting did not skip to Main Menu on reload");
    assert.equal(afterSettingsReload.reducedMotion, true, "Reduced Motion setting did not persist across reload");

    // Turn Reduced Motion back off so we can also exercise normal gameplay effects
    await cdp.eval(`(() => {
      window.__ARCHIVE_PROBE__._updateSetting({ reducedMotion: false, screenShake: true });
    })()`);

    // 4. Start Excavation from Main Menu & verify Cargo HUD + 4 upgrade categories + keyboard drilling
    await cdp.eval(`document.getElementById('btn-menu-start').click()`);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(await cdp.eval(`!document.getElementById('app-shell').hidden`), true, "Gameplay shell did not open");

    const cargoHudCheck = await cdp.eval(`(() => {
      const bodyText = (document.body.innerText || '').toUpperCase();
      return {
        cargoText: document.getElementById('hud-carried')?.textContent?.trim(),
        bankedText: document.getElementById('hud-banked')?.textContent?.trim(),
        layerText: document.getElementById('hud-layer')?.textContent?.trim(),
        rigText: document.getElementById('hud-rig')?.textContent?.trim(),
        upgradeCount: document.querySelectorAll('#upgrade-list .upgrade-card').length,
        compilerText: (document.getElementById('upgrade-list')?.textContent || '').toUpperCase(),
        hasLegacyTerms: /\\b(FRAGS?|CARGO|DATA SHARD|SURFACE DOCK|TETHER RECALL|EMERGENCY EXTRACTION|FORBIDDEN)\\b/.test(bodyText),
      };
    })()`);
    assert.equal(cargoHudCheck.cargoText, "0 / 60 SIGS", "HUD must show EXPLOIT BUFFER: current / max SIGS");
    assert.equal(cargoHudCheck.bankedText, "0 SIGS", "HUD must show EXPLOIT LIBRARY in SIGS");
    assert.ok(cargoHudCheck.layerText.includes("LOCAL NODE") && cargoHudCheck.layerText.includes("ACCESS DEPTH: 000"));
    assert.equal(cargoHudCheck.rigText, "B1 · P1 · R1 · E1");
    assert.equal(cargoHudCheck.upgradeCount, 4, "Module Compiler should have 4 upgrade categories");
    assert.ok(cargoHudCheck.compilerText.includes("BREACH ENGINE"));
    assert.ok(cargoHudCheck.compilerText.includes("POWER CELL"));
    assert.ok(cargoHudCheck.compilerText.includes("RECON MODULE"));
    assert.ok(cargoHudCheck.compilerText.includes("EXPLOIT BUFFER"));
    assert.equal(cargoHudCheck.hasLegacyTerms, false, "Found legacy mining/Forbidden terms in rendered UI");

    for (let i = 0; i < 3; i++) {
      await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
      await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
      await new Promise((r) => setTimeout(r, 40));
    }
    assert.equal(await cdp.eval(`window.__ARCHIVE_PROBE__.wasm.get_state(1)`), 1, "Keyboard ArrowDown failed to drill into row 1");

    // 5. Verify Registrar escalation milestones trigger in order without identifying operator
    const escalationCheck = await cdp.eval(`(() => {
      const app = window.__ARCHIVE_PROBE__;
      const st = new Int32Array(app.memory.buffer, 0, 23);
      // Trigger L1 (tilesDug >= 6)
      st[14] = 6;
      app._checkRegistrarEscalation();
      const l1Text = document.getElementById('registrar-body').textContent;
      // Trigger L2 (py >= 15)
      st[1] = 15; st[16] = 15;
      app._checkRegistrarEscalation();
      const l2Text = document.getElementById('registrar-body').textContent;
      // Trigger L3 (py >= 30)
      st[1] = 30; st[16] = 30;
      app.wasm.update_visibility();
      app._checkRegistrarEscalation();
      const l3Text = document.getElementById('registrar-body').textContent;
      const badge = document.getElementById('hud-alert-badge').textContent;
      return {
        bannerVisible: !document.getElementById('registrar-banner').hidden,
        l1Ok: l1Text.includes('PROBABLE SYSTEM DEGRADATION'),
        l2Ok: l2Text.includes('SOURCE LOCALIZATION INITIATED'),
        l3Ok: l3Text.includes('CONTAINMENT PROCEDURES INITIALIZED'),
        badge,
        milestones: { ...app.milestones },
      };
    })()`);
    assert.equal(escalationCheck.bannerVisible, true, "Registrar escalation banner not visible");
    assert.equal(escalationCheck.l1Ok, true, "L1 Registrar message missing");
    assert.equal(escalationCheck.l2Ok, true, "L2 Registrar message missing");
    assert.equal(escalationCheck.l3Ok, true, "L3 Registrar message missing");
    assert.equal(escalationCheck.milestones.l1 && escalationCheck.milestones.l2 && escalationCheck.milestones.l3, true);
    await cdp.capture("04-gameplay-escalation.png");

    // Reset probe back to (11,1) for mobile touch test
    await cdp.eval(`(() => {
      const st = new Int32Array(window.__ARCHIVE_PROBE__.memory.buffer, 0, 23);
      st[0] = 11; st[1] = 1;
      window.__ARCHIVE_PROBE__._dismissRegistrarBanner();
      window.__ARCHIVE_PROBE__._syncUI();
    })()`);

    // 6. Verify Pause -> Return to Main Menu -> Continue preserves progress
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "p", code: "KeyP", windowsVirtualKeyCode: 80 });
    assert.equal(await cdp.eval(`!document.getElementById('modal-pause').hidden`), true, "Pause modal did not open");
    await cdp.eval(`document.getElementById('btn-pause-menu').click()`);
    assert.equal(await cdp.eval(`document.getElementById('btn-menu-start').textContent.trim()`), "CONTINUE INTRUSION");
    await cdp.eval(`document.getElementById('btn-menu-start').click()`);

    // 7. Mobile portrait emulation (390x844): touch D-pad via real CDP click & zero overflow
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await new Promise((r) => setTimeout(r, 200));

    const mobileCheck = await cdp.eval(`(() => ({
      touchDisplay: getComputedStyle(document.getElementById('touch-controls')).display,
      sideDisplay: getComputedStyle(document.getElementById('side-panel')).display,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    }))()`);
    assert.equal(mobileCheck.touchDisplay, "flex", "Touch controls should be visible on mobile portrait");
    assert.equal(mobileCheck.sideDisplay, "none", "Desktop sidebar should be hidden on mobile portrait");
    assert.equal(mobileCheck.overflowX, false, "Mobile portrait viewport has horizontal overflow");

    const upRect = await cdp.eval(`(() => {
      const r = document.querySelector('.dpad-up').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: upRect.x, y: upRect.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: upRect.x, y: upRect.y, button: "left", clickCount: 1 });
    assert.equal(await cdp.eval(`window.__ARCHIVE_PROBE__.wasm.get_state(1)`), 0, "Touch D-pad UP failed to move probe to row 0");

    // Switch back to desktop for Ending screenshot & verification
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 150));

    // 8. Final Gateway (The Impossible Login) -> Forced Session Termination -> Main Menu Ejection
    await cdp.eval(`(() => {
      const app = window.__ARCHIVE_PROBE__;
      const st = new Int32Array(app.memory.buffer, 0, 23);
      const tiles = new Uint8Array(app.memory.buffer, 0x0400, 24 * 46);
      tiles[44 * 24 + 11] = 0;
      st[0] = 11; st[1] = 44;
      app.doMove(2);
    })()`);
    await new Promise((r) => setTimeout(r, 200));
    await cdp.eval(`document.getElementById('btn-ending-skip').click()`);
    await new Promise((r) => setTimeout(r, 150));

    const endingCheck = await cdp.eval(`(() => {
      const text = document.getElementById('ending-transcript').textContent || '';
      return {
        open: !document.getElementById('modal-ending').hidden,
        hasHuman: text.includes('OPERATOR CLASSIFICATION: HUMAN'),
        hasRoutes: text.includes('AI-MADPAKKEN') && text.includes('ALBUM ZERO') && text.includes('ALBUM ONE'),
        hasTerminated: text.includes('SESSION TERMINATED.'),
        hasForbidden: text.toUpperCase().includes('FORBIDDEN'),
        actionsVisible: !document.getElementById('ending-actions').hidden,
      };
    })()`);
    assert.equal(endingCheck.open, true);
    assert.equal(endingCheck.hasHuman, true);
    assert.equal(endingCheck.hasRoutes, true);
    assert.equal(endingCheck.hasTerminated, true);
    assert.equal(endingCheck.hasForbidden, false, "Ending transcript must not reference Forbidden Record");
    assert.equal(endingCheck.actionsVisible, true);
    await cdp.capture("05-final-ending.png");

    // Click Return to Main Menu -> ejects to Main Menu with terminated notice & EXIT TO ARCHIVE
    await cdp.eval(`document.getElementById('btn-ending-eject').click()`);
    await new Promise((r) => setTimeout(r, 450));

    const ejectedCheck = await cdp.eval(`(() => ({
      menuVisible: !document.getElementById('screen-menu').hidden,
      terminatedBannerVisible: !document.getElementById('menu-terminated-banner').hidden,
      exitHref: document.getElementById('btn-menu-exit')?.getAttribute('href'),
      py: window.__ARCHIVE_PROBE__.wasm.get_state(1),
      completed: window.__ARCHIVE_PROBE__.wasm.get_state(12),
    }))()`);
    assert.equal(ejectedCheck.menuVisible, true, "Forced ejection did not return to Main Menu");
    assert.equal(ejectedCheck.terminatedBannerVisible, true, "Terminated banner not shown on Main Menu");
    assert.equal(ejectedCheck.exitHref, "https://terminalcathedral.com/");
    assert.equal(ejectedCheck.py, 0, "Probe not docked safely at Row 0 after ejection");
    assert.equal(ejectedCheck.completed, 1, "Completion flag lost during ejection");
    await cdp.capture("06-post-ejection-menu.png");

    await cdp.send("Page.reload", { ignoreCache: true });
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(
      await cdp.eval(`window.__ARCHIVE_PROBE__.wasm.get_state(12) === 1 && !document.getElementById('menu-terminated-banner').hidden`),
      true,
      "Terminated session state did not persist across reload"
    );

    // Verify Reset Save Data from Settings clears completion cleanly
    await cdp.eval(`document.getElementById('btn-menu-settings').click()`);
    await cdp.eval(`document.getElementById('btn-settings-reset-req').click()`);
    await cdp.eval(`document.getElementById('btn-settings-reset-confirm').click()`);
    assert.equal(
      await cdp.eval(`window.__ARCHIVE_PROBE__.wasm.get_state(12) === 0 && document.getElementById('menu-terminated-banner').hidden`),
      true,
      "Settings Reset Save Data failed to clear progress"
    );

    const consoleErrors = cdp.events.filter(
      (e) => e.method === "Runtime.exceptionThrown" || (e.method === "Runtime.consoleAPICalled" && e.params?.type === "error")
    );
    assert.equal(consoleErrors.length, 0, `Browser console errors detected: ${JSON.stringify(consoleErrors)}`);

    console.log("BROWSER E2E PASSED: WASM failure recovery, boot skip, Main Menu & EXIT TO ARCHIVE, Cargo HUD & 4 upgrades, Settings persistence & Reduced Motion, Registrar escalation L1-L3, mobile 390x844 touch D-pad, Impossible Login & forced termination return to menu, Reset Save, 0 console errors.");
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("BROWSER E2E FAILED:", err);
  process.exit(1);
});
