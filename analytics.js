(function () {
  // Stage 3B: initialise once per page, even if this script is included or injected twice.
  if (window.TerminalCathedralAnalytics) {
    return;
  }

  const DEFAULT_COLLECTOR_URL =
    "https://script.google.com/macros/s/AKfycbx8-wC0luSvUFQY5P3SXGxLwaaIj5-garaXixwjscf8hmY6j2JgOAhXsus793tI50uL/exec";
  const DEFAULT_CONFIG = {
    collectorUrl: DEFAULT_COLLECTOR_URL,
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
  // Stage 3B, fail closed: the production collector only ever receives events from the public site itself.
  // Any other origin (localhost, 127.0.0.1, file://, previews, copies) keeps the in-page event log but sends nothing.
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
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  // Stage 3B visit continuity: the homepage passes its random visit_id to the original console as ?tc_visit=.
  // It is adopted only if it has the exact shape this script generates and the visitor arrived from this site;
  // otherwise a fresh id is created, as before. The parameter is always removed from the recorded page URLs and
  // from the address bar, so it is not kept in bookmarks, copied links or later referrers. Nothing is stored.
  const carriedVisitId = searchParams.get("tc_visit");
  if (carriedVisitId !== null) {
    searchParams.delete("tc_visit");
    try {
      window.history.replaceState(window.history.state, "", url.href);
    } catch (error) {
      // the address bar keeps the parameter; the recorded URLs below are still clean
    }
  }
  const eventLog = [];
  // Stage 3C, Registrar Observation Protocol (HUMAN decision): optional statistics run only after the visitor has
  // chosen YES. The only thing kept on the device is that choice, under one key with the value "granted" or
  // "denied": no identifier, no timestamp. Before a choice, after NO, and whenever storage is unavailable, nothing
  // is sent, nothing is logged and no visit_id exists. The same key is read by every page of the site, so the
  // homepage and the original console always follow the same decision.
  const CONSENT_KEY = "tc_observation";
  let consent = readStoredConsent();
  let visitId = "";
  let landingSent = false;
  let engagedEventSent = false;
  let visibleTimeMs = 0;
  let visibilityStartedAt = document.visibilityState === "hidden"
    ? null
    : Date.now();
  let engagementTimerId = null;

  function createVisitId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "visit_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
  }

  function adoptVisitId(candidate) {
    if (!candidate ||
        !(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate) ||
          /^visit_\d{1,16}_[0-9a-z]{1,10}$/.test(candidate))) {
      return "";
    }

    try {
      return document.referrer && new URL(document.referrer).origin === window.location.origin
        ? candidate
        : "";
    } catch (error) {
      return "";
    }
  }

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

  function isGranted() {
    return consent === "granted";
  }

  // Runs when consent is (or becomes) granted: one visit_id per page load (the homepage's, when it was carried
  // here from this site), one landing_page_view per page load, and the engagement check.
  function startCollecting() {
    if (!isGranted()) {
      return;
    }
    if (!visitId) {
      visitId = adoptVisitId(carriedVisitId) || createVisitId();
    }
    if (!landingSent) {
      landingSent = true;
      trackEvent("landing_page_view");
    }
    // visible time counts only from here on: time before YES (or while NO applied) is never reported
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

  function getDeviceType(userAgent) {
    if (!userAgent) {
      return "desktop";
    }

    if (/ipad|tablet|kindle|silk|playbook|sm-t|nexus 7|nexus 10/i.test(userAgent)) {
      return "tablet";
    }

    if (/mobi|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
      return "mobile";
    }

    return "desktop";
  }

  function getBasePayload() {
    return {
      site_name: "terminal_cathedral",
      page_title: document.title || "",
      page_url: url.href,
      landing_page_url: url.href,
      page_path: url.pathname || "/",
      referrer: document.referrer || "",
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      device_type: getDeviceType(window.navigator.userAgent || ""),
      visit_id: isGranted() ? visitId : "" // never handed out (e.g. to the Lab link) without consent
    };
  }

  function isCollectorConfigured() {
    return Boolean(config.collectorUrl);
  }

  function sendPayload(payload) {
    if (!isCollectorConfigured()) {
      return false;
    }

    const requestBody = JSON.stringify(payload);

    if (window.navigator && typeof window.navigator.sendBeacon === "function") {
      const beaconPayload = new Blob([requestBody], {
        type: "text/plain;charset=UTF-8"
      });

      if (window.navigator.sendBeacon(config.collectorUrl, beaconPayload)) {
        return true;
      }
    }

    window.fetch(config.collectorUrl, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
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
      return undefined; // no choice yet, or NO: optional statistics are inactive
    }

    if (window.navigator && window.navigator.webdriver) {
      return undefined;
    }

    const payload = Object.assign(
      {
        timestamp: new Date().toISOString(),
        event_name: eventName,
        destination: "",
        button_id: "",
        node_id: "",
        node_type: "",
        source_node_id: "",
        target_node_id: "",
        option_label: "",
        option_kind: "",
        depth_marker: "",
        total_time_ms: "",
        error_message: ""
      },
      getBasePayload(),
      eventDetails || {}
    );

    eventLog.push(payload);
    sendPayload(payload);

    return payload;
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

    visibilityStartedAt = Date.now();
    scheduleEngagementCheck();
  }

  const analyticsApi = {
    config: Object.freeze({
      collectorUrl: config.collectorUrl,
      engagementThresholdMs: config.engagementThresholdMs
    }),
    getBasePayload: function () {
      return Object.assign({}, getBasePayload());
    },
    getEventLog: function () {
      return eventLog.slice();
    },
    getVisibleTimeMs: function () {
      updateVisibleTime();
      return visibleTimeMs;
    },
    isCollectorConfigured: isCollectorConfigured,
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
  // a page restored from the back/forward cache may have missed a change made meanwhile: read the choice again
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) {
      applyConsent(readStoredConsent());
    }
  });
  // a choice made in another tab of this site applies here too
  window.addEventListener("storage", function (event) {
    if (event.key === CONSENT_KEY || event.key === null) {
      applyConsent(readStoredConsent());
    }
  });

  window.addEventListener("error", function (event) {
    if (window.TerminalCathedralAnalytics) {
      window.TerminalCathedralAnalytics.trackEvent("js_error", {
        error_message: event.message || "Unknown error"
      });
    }
  });
})();
