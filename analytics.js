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
  const visitId = adoptVisitId(carriedVisitId) || createVisitId();
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
      visit_id: visitId
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
    if (visibilityStartedAt === null) {
      return;
    }

    visibleTimeMs += Date.now() - visibilityStartedAt;
    visibilityStartedAt = null;
  }

  function sendEngagedEventIfReady() {
    if (
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
    trackEvent: trackEvent
  };

  window.TerminalCathedralAnalytics = analyticsApi;

  trackEvent("landing_page_view");
  scheduleEngagementCheck();
  document.addEventListener("visibilitychange", handleVisibilityChange);

  window.addEventListener("error", function (event) {
    if (window.TerminalCathedralAnalytics) {
      window.TerminalCathedralAnalytics.trackEvent("js_error", {
        error_message: event.message || "Unknown error"
      });
    }
  });
})();
