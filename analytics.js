(function () {
  // Stage 3B: initialise once per page, even if this script is included or injected twice.
  if (window.TerminalCathedralAnalytics) {
    return;
  }

  /*
   * Stage 3D, privacy-first aggregate statistics (HUMAN decision).
   *
   * The site never sends a record of a visitor. Each counted action sends one tiny message that names one metric
   * from the fixed list below, e.g. {"v":1,"m":"area_music"}, and nothing else: no visit or session id, no URL,
   * no referrer, no time stamp, no device or browser details, no text from the page. The collector adds one to
   * that metric's counter for the day (see the Stage 3D collector proposal). Durations are sent only as a coarse
   * bucket. Actions that are not on the list are not sent at all.
   *
   * RELEASE SWITCH: AGGREGATE_COLLECTOR_URL is the web-app address of the new aggregate collector. While it is
   * empty, statistics are switched off completely: nothing is sent or logged, and the homepage does not show
   * the Registrar Observation Protocol, because there is nothing to agree to. The address of the old event-row
   * collector is deliberately not kept here: it must never receive these messages (Stage 3D fallback).
   */
  const AGGREGATE_COLLECTOR_URL = "";
  const DEFAULT_CONFIG = {
    collectorUrl: AGGREGATE_COLLECTOR_URL,
    engagementThresholdMs: 10000
  };
  const runtimeConfig = window.TERMINAL_CATHEDRAL_ANALYTICS_CONFIG || {};
  const config = {
    collectorUrl: typeof runtimeConfig.collectorUrl === "string"
      ? runtimeConfig.collectorUrl.trim()
      : DEFAULT_CONFIG.collectorUrl,
    engagementThresholdMs:
      typeof runtimeConfig.engagementThresholdMs === "number"
        ? runtimeConfig.engagementThresholdMs
        : DEFAULT_CONFIG.engagementThresholdMs
  };
  // Stage 3B, fail closed: a Google Apps Script collector only ever receives messages from the public site itself.
  // Any other origin (localhost, 127.0.0.1, file://, previews, copies) sends nothing.
  const PRODUCTION_ORIGINS = ["https://terminalcathedral.com", "https://www.terminalcathedral.com"];
  if (isProductionCollector(config.collectorUrl) &&
      PRODUCTION_ORIGINS.indexOf(window.location.protocol + "//" + window.location.host) === -1) {
    config.collectorUrl = "";
  }

  function isProductionCollector(candidate) {
    if (!candidate) {
      return false;
    }

    try {
      // parsed host, so ports, a trailing dot, user info or another scheme cannot slip past the gate
      return new URL(candidate, window.location.href).hostname.replace(/\.$/, "").toLowerCase() === "script.google.com";
    } catch (error) {
      return true; // unparseable: treat as production and fail closed
    }
  }

  // Stage 3D: earlier versions carried a visit id between pages as ?tc_visit=. No id exists any more; an old
  // link or bookmark that still has the parameter is tidied from the address bar and otherwise ignored.
  (function removeLegacyVisitParameter() {
    try {
      const here = new URL(window.location.href);
      if (here.searchParams.has("tc_visit")) {
        here.searchParams.delete("tc_visit");
        window.history.replaceState(window.history.state, "", here.href);
      }
    } catch (error) {
      // nothing is read from it either way
    }
  })();

  // ---- the fixed metric list (the only values that can ever be sent) ----
  // Which page this is: only these two pages load the script. Anything else counts nothing.
  const PAGE = (function () {
    const path = window.location.pathname;
    if (path === "/" || path === "/index.html") {
      return "home";
    }
    if (path === "/terminal-cathedral/" || path === "/terminal-cathedral/index.html") {
      return "console";
    }
    return "";
  })();
  const AREAS = ["electronics", "ai", "software", "music", "lab", "human"];
  const RECORDS = ["electronics/archive", "ai/madpakken", "software/archive", "music/cathedral", "music/workshop",
    "lab/console", "human/identity", "human/linkedin", "human/github", "human/reddit"];
  const HOME_LINKS = ["ai-madpakken", "album-zero", "album-one", "dans-workshop-suno", "linkedin", "github", "reddit"];
  // the original console's external options, by their exact address in dialogue-data.js
  const CONSOLE_LINKS = {
    "https://drive.google.com/drive/folders/1DXBSEI1ghVsJoKKkrqZzUqLKpnEdp64I?usp=sharing": "source_materials",
    "https://chatgpt.com/g/g-69d216e50f688191b4d5adc9bf1a1284-keeper-of-the-records": "keeper",
    "https://distrokid.com/hyperfollow/theterminalcathedral/album-one": "album_one",
    "https://drive.google.com/file/d/1gywkhx_4sFD092doKK3WM2iP4EOW24yM/view?usp=drive_link": "album_one_visual",
    "https://distrokid.com/hyperfollow/theterminalcathedral/album-zero/": "album_zero",
    "https://drive.google.com/file/d/1NZ5XlsjbmeYp02UHFX8ljuF6njeNaOde/view?usp=drive_link": "album_zero_visual"
  };
  const PASSAGE_MARKERS = ["passage_intro", "sequence_one", "sequence_two", "sequence_three", "sequence_four",
    "sequence_five", "track_15_signal", "loopback_notice"];
  // Duration buckets (Stage 3D review of the suggested seven: 3–5 and 5–10 minutes are merged, because on a
  // small personal site they would mostly hold single visits and add little).
  const DURATION_BUCKETS = [
    [10000, "under_10s"], [30000, "10_30s"], [60000, "30_60s"], [180000, "1_3m"], [600000, "3_10m"], [Infinity, "over_10m"]
  ];

  function durationBucket(ms) {
    for (let i = 0; i < DURATION_BUCKETS.length; i += 1) {
      if (ms < DURATION_BUCKETS[i][0]) {
        return DURATION_BUCKETS[i][1];
      }
    }
    return "";
  }

  function has(list, value) {
    return typeof value === "string" && list.indexOf(value) !== -1;
  }

  function isKnownDialogueNode(nodeId) {
    const tree = window.REGISTRAR_DIALOGUE ||
      (typeof REGISTRAR_DIALOGUE !== "undefined" ? REGISTRAR_DIALOGUE : null); // eslint-disable-line no-undef
    return Boolean(tree && Object.prototype.hasOwnProperty.call(tree, nodeId));
  }

  // Maps a page's own description of an action (the event names the pages have always used) to one metric code
  // from the fixed list, or "" when the action is not counted. Only fixed strings from this file are returned.
  function metricFor(eventName, details) {
    const d = details || {};
    if (!PAGE) {
      return "";
    }
    switch (eventName) {
      case "landing_page_view":
        return PAGE + "_view";
      case "engaged_10_seconds":
        return PAGE + "_engaged_10s";
      case "session_end": {
        const ms = d.total_time_ms;
        return typeof ms === "number" && isFinite(ms) && ms > 0 ? PAGE + "_duration_" + durationBucket(ms) : "";
      }
      case "js_error":
        return PAGE + "_script_error";
      default:
        break;
    }
    if (PAGE === "home") {
      if (eventName === "hub_destination_select") {
        if (d.option_kind === "gateway" && has(AREAS, d.destination)) {
          return "area_" + d.destination;
        }
        if (d.option_kind === "record_expand" && has(RECORDS, d.destination)) {
          return "record_" + d.destination.replace("/", "_");
        }
        if (d.option_kind === "record_link" && d.destination === "registrar_console") {
          return "lab_console_entry";
        }
        return ""; // closing a record is not counted
      }
      if (eventName === "hub_outbound_click" && typeof d.button_id === "string" &&
          has(HOME_LINKS, d.button_id.replace(/^outbound_/, ""))) {
        return "link_" + d.button_id.replace(/^outbound_/, "").replace(/-/g, "_");
      }
      return "";
    }
    // PAGE === "console" (the original Registrar console; its own code is unchanged)
    switch (eventName) {
      case "registrar_terminal_click":
        return "console_entered";
      case "album_zero_click":
        return "console_album_zero_button";
      case "album_one_click":
        return "console_album_one_button";
      case "terminal_outbound_click":
        return Object.prototype.hasOwnProperty.call(CONSOLE_LINKS, d.destination)
          ? "console_link_" + CONSOLE_LINKS[d.destination]
          : "";
      case "passage_depth_reached":
        return has(PASSAGE_MARKERS, d.depth_marker) ? "console_passage_" + d.depth_marker : "";
      case "terminal_route_select":
        // which options a visitor picks is not counted; only a choice that leads nowhere ("Routing error")
        return typeof d.target_node_id === "string" && d.target_node_id && !isKnownDialogueNode(d.target_node_id)
          ? "console_routing_error"
          : "";
      default:
        return ""; // e.g. terminal_node_view: not counted
    }
  }

  // ---- consent (Stage 3C, unchanged) ----
  // Optional statistics run only after the visitor has chosen YES. The only thing kept on the device is that
  // choice, under one key with the value "granted" or "denied": no identifier, no timestamp. Before a choice,
  // after NO, and whenever storage is unavailable, nothing is sent and nothing is measured.
  const CONSENT_KEY = "tc_observation";
  let consent = readStoredConsent();
  const sentLog = [];
  // Short-lived, in this page's memory only (never stored, never sent as such), reset for every showing of the
  // page: whether this showing's view, 10-second mark and duration have been counted, and the visible time since
  // YES that the duration bucket is taken from.
  let viewSent = false;
  let engagedEventSent = false;
  let durationSent = false;
  let errorSent = false;
  let visibleTimeMs = 0;
  let visibilityStartedAt = null;
  let engagementTimerId = null;

  function readStoredConsent() {
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      return stored === "granted" || stored === "denied" ? stored : null;
    } catch (error) {
      return null; // storage unavailable: undecided, so nothing runs
    }
  }

  function writeStoredConsent(value) {
    try {
      window.localStorage.setItem(CONSENT_KEY, value);
      return true;
    } catch (error) {
      return false; // the choice then holds for this page only
    }
  }

  function isCollectorConfigured() {
    return Boolean(config.collectorUrl);
  }

  function isGranted() {
    return consent === "granted" && isCollectorConfigured();
  }

  // Runs when consent is (or becomes) granted: one view per showing of the page, and the 10-second check.
  function startCollecting() {
    if (!isGranted()) {
      return;
    }
    if (!viewSent) {
      viewSent = true;
      trackEvent("landing_page_view");
    }
    // visible time counts only from here on: time before YES (or while NO applied) is never measured
    visibilityStartedAt = document.visibilityState === "hidden" ? null : Date.now();
    sendEngagedEventIfReady();
    scheduleEngagementCheck();
  }

  function applyConsent(value) {
    if (isGranted()) {
      updateVisibleTime(); // keep the time that was visible while consent applied
    }
    consent = value === "granted" || value === "denied" ? value : null;
    if (isGranted()) {
      startCollecting();
    } else {
      clearEngagementTimer();
      visibilityStartedAt = null;
    }
  }

  // Stage 3D review: always fetch, never sendBeacon. A beacon is always sent with credentials, so a visitor signed in
  // to Google would send Google's cookies along with every counter message. This request carries no cookies and no
  // Referer; keepalive lets it finish while the page is being left (the job sendBeacon did before).
  function sendPayload(payload) {
    const requestBody = JSON.stringify(payload);

    if (typeof window.fetch !== "function") {
      return false;
    }

    window.fetch(config.collectorUrl, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8"
      },
      body: requestBody
    }).catch(function () {
      return undefined;
    });

    return true;
  }

  function trackEvent(eventName, eventDetails) {
    if (!isGranted()) {
      return undefined; // switched off, no choice yet, or NO: nothing is counted
    }

    if (window.navigator && window.navigator.webdriver) {
      return undefined;
    }

    if ((eventName === "session_end" && durationSent) || (eventName === "js_error" && errorSent)) {
      return undefined; // one duration, and at most one script-error count, per showing of the page
    }

    const metric = metricFor(eventName, eventDetails);
    if (!metric) {
      return undefined; // not on the fixed list: not sent
    }
    if (eventName === "session_end") {
      durationSent = true;
    }
    if (eventName === "js_error") {
      errorSent = true;
    }

    const payload = { v: 1, m: metric };
    sentLog.push(payload);
    sendPayload(payload);

    return { v: 1, m: metric };
  }

  function getRemainingVisibleTimeMs() {
    return Math.max(0, config.engagementThresholdMs - visibleTimeMs);
  }

  function clearEngagementTimer() {
    if (engagementTimerId) {
      window.clearTimeout(engagementTimerId);
      engagementTimerId = null;
    }
  }

  function updateVisibleTime() {
    if (!isGranted()) {
      visibilityStartedAt = null; // no time is counted without consent
      return;
    }

    if (visibilityStartedAt === null) {
      return;
    }

    visibleTimeMs += Date.now() - visibilityStartedAt;
    visibilityStartedAt = null;
  }

  function sendEngagedEventIfReady() {
    if (
      !isGranted() ||
      engagedEventSent ||
      document.visibilityState === "hidden" ||
      visibleTimeMs < config.engagementThresholdMs
    ) {
      return;
    }

    engagedEventSent = true;
    clearEngagementTimer();
    trackEvent("engaged_10_seconds");
  }

  function scheduleEngagementCheck() {
    clearEngagementTimer();

    if (
      !isGranted() ||
      engagedEventSent ||
      document.visibilityState === "hidden" ||
      visibilityStartedAt === null
    ) {
      return;
    }

    engagementTimerId = window.setTimeout(function () {
      updateVisibleTime();
      sendEngagedEventIfReady();

      if (!engagedEventSent) {
        visibilityStartedAt = Date.now();
        scheduleEngagementCheck();
      }
    }, getRemainingVisibleTimeMs());
  }

  function handleVisibilityChange() {
    if (document.visibilityState === "hidden") {
      updateVisibleTime();
      clearEngagementTimer();
      return;
    }

    if (isGranted()) {
      visibilityStartedAt = Date.now();
    }
    scheduleEngagementCheck();
  }

  const analyticsApi = {
    config: Object.freeze({
      collectorUrl: config.collectorUrl,
      engagementThresholdMs: config.engagementThresholdMs
    }),
    // exactly the messages this page has sent, e.g. [{ v: 1, m: "home_view" }]
    getEventLog: function () {
      return sentLog.map(function (p) { return { v: p.v, m: p.m }; });
    },
    getVisibleTimeMs: function () {
      updateVisibleTime();
      if (isGranted() && document.visibilityState !== "hidden") {
        visibilityStartedAt = Date.now(); // keep measuring after a read
      }
      return visibleTimeMs;
    },
    isCollectorConfigured: isCollectorConfigured,
    // Stage 3D: false while the release switch is off (no aggregate collector): then nothing is asked or sent
    isAvailable: isCollectorConfigured,
    trackEvent: trackEvent,
    // Stage 3C consent: "granted", "denied" or null (no choice yet)
    getConsent: function () {
      return consent;
    },
    // returns true if the choice could be remembered on this device, false if it holds for this page only
    setConsent: function (granted) {
      const value = granted ? "granted" : "denied";
      const stored = writeStoredConsent(value);
      applyConsent(value);
      return stored;
    }
  };

  window.TerminalCathedralAnalytics = analyticsApi;

  startCollecting(); // only if the visitor chose YES earlier; otherwise nothing happens until they do
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted) {
      return;
    }
    // restored from the back/forward cache: this is a new showing of the page (its earlier duration was already
    // counted when it was left), and a choice made meanwhile in another page applies
    clearEngagementTimer();
    viewSent = false;
    engagedEventSent = false;
    durationSent = false;
    errorSent = false;
    visibleTimeMs = 0;
    visibilityStartedAt = null;
    applyConsent(readStoredConsent());
  });
  // a choice made in another tab of this site applies here too
  window.addEventListener("storage", function (event) {
    if (event.key === CONSENT_KEY || event.key === null) {
      applyConsent(readStoredConsent());
    }
  });

  window.addEventListener("error", function () {
    // counted only as "a script error happened on this page"; the message itself is never sent
    trackEvent("js_error");
  });
})();
