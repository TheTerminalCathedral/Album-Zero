// Fictional software identity, boot script, Registrar escalation milestones,
// and final "The Impossible Login" transcript for DAJ_CATHEDRAL_BREACH_TOOL.

export const TOOL_IDENTITY = {
  title: "DAJ_CATHEDRAL_BREACH_TOOL",
  subtitle: "EXPERIMENTAL UNAUTHORIZED ACCESS UTILITY",
  file: "DAJ_CATHEDRAL_BREACH_TOOL.wasm",
  author: "Dan Almer Jensen",
  classification: "Unauthorized intrusion utility",
  target: "The Terminal Cathedral",
  distribution: "Unregistered / external archive artifact",
  authorization: "Not verified",
};

// Lines shown BEFORE real WASM initialization resolves
export const BOOT_PRE_LINES = [
  "EXTERNAL ARCHIVE INTERFACE",
  "LOCAL EXECUTION REQUEST RECEIVED",
  "",
  `FILE: ${TOOL_IDENTITY.file}`,
  "AUTHOR: DAN ALMER JENSEN",
  "TYPE: EXPERIMENTAL INTRUSION UTILITY",
  "TARGET: TERMINAL CATHEDRAL ACCESS LAYERS",
  "",
  "INITIALIZING MODULE...",
];

// Lines shown ONLY AFTER WebAssembly core has genuinely instantiated
export const BOOT_READY_LINES = [
  "MEMORY INTERFACE: READY",
  "PROBE CONTROLLER: READY",
  "SECURITY AUTHORIZATION: NOT VERIFIED",
  "",
  "EXECUTION ENVIRONMENT READY",
];

export const DEFAULT_MILESTONES = {
  l1: false,
  l2: false,
  l3: false,
  gateway: false,
};

// Four escalating Registrar announcements.
// IMPORTANT: None of these identify or address the operator prior to the Final Gateway.
export const REGISTRAR_MILESTONES = [
  {
    id: "l1",
    level: 1,
    badge: "ALERT: MONITORING",
    header: "REGISTRAR // AUTOMATED INTEGRITY NOTICE",
    rumbleMag: 0,
    rumbleDur: 0,
    glitch: false,
    lines: [
      "ARCHIVE INTEGRITY DEVIATION DETECTED.",
      "ORIGIN: UNDETERMINED",
      "ASSESSMENT: PROBABLE SYSTEM DEGRADATION",
      "MONITORING CONTINUED.",
    ],
  },
  {
    id: "l2",
    level: 2,
    badge: "ALERT: TRACE",
    header: "REGISTRAR // ANOMALY INVESTIGATION",
    rumbleMag: 4.5,
    rumbleDur: 0.24,
    glitch: true,
    lines: [
      "MULTIPLE INTEGRITY DEVIATIONS CONFIRMED.",
      "PATTERN INCONSISTENT WITH NATURAL DEGRADATION.",
      "SOURCE LOCALIZATION INITIATED.",
    ],
  },
  {
    id: "l3",
    level: 3,
    badge: "ALERT: CONTAINMENT",
    header: "REGISTRAR // SECURITY ESCALATION",
    rumbleMag: 7.0,
    rumbleDur: 0.34,
    glitch: true,
    lines: [
      "ACTIVE INTRUSION SUSPECTED.",
      "UNIDENTIFIED PROCESS DETECTED WITHIN PROTECTED ARCHIVE SECTORS.",
      "CONTAINMENT PROCEDURES INITIALIZED.",
      "SOURCE TRACE IN PROGRESS.",
    ],
  },
  {
    id: "gateway",
    level: 4,
    badge: "ALERT: ISOLATING",
    header: "REGISTRAR // CONTAINMENT PRIORITY ELEVATED",
    rumbleMag: 5.5,
    rumbleDur: 0.28,
    glitch: true,
    lines: [
      "EXTERNAL ACCESS ANOMALY ISOLATED.",
      "ORIGIN TRACE: INCOMPLETE",
      "CONTAINMENT PRIORITY ELEVATED.",
    ],
  },
];

// Evaluates which next milestone (if any) should fire based on current progression.
// Fires at most one milestone per step in strict ascending order, never repeating.
export function evaluateNextMilestone({ py, maxDepth, tilesDug }, triggered) {
  const depth = Math.max(py || 0, maxDepth || 0);
  if (!triggered.l1 && (tilesDug >= 6 || depth >= 6)) {
    return REGISTRAR_MILESTONES[0];
  }
  if (triggered.l1 && !triggered.l2 && depth >= 15) {
    return REGISTRAR_MILESTONES[1];
  }
  if (triggered.l2 && !triggered.l3 && depth >= 30) {
    return REGISTRAR_MILESTONES[2];
  }
  if (triggered.l3 && !triggered.gateway && depth >= 40) {
    return REGISTRAR_MILESTONES[3];
  }
  return null;
}

export function getAlertBadgeForMilestones(triggered, completed = false) {
  if (completed) return { text: "TRACE: TERMINATED", level: 4 };
  if (triggered.gateway) return { text: "ALERT: ISOLATING", level: 4 };
  if (triggered.l3) return { text: "ALERT: CONTAINMENT", level: 3 };
  if (triggered.l2) return { text: "ALERT: TRACE", level: 2 };
  if (triggered.l1) return { text: "ALERT: MONITORING", level: 1 };
  return { text: "STATUS: UNDETECTED", level: 0 };
}

// Approved final Registrar transcript — The Impossible Login
export const ENDING_TRANSCRIPT = [
  { cls: "term-ok", text: "CATHEDRAL GATEWAY\nCONNECTION ESTABLISHED." },
  { cls: "term-warn", text: "INTRUSION SOURCE LOCATED.\nEXTERNAL TERMINAL SESSION ISOLATED." },
  { cls: "term-deny", text: "OPERATOR CLASSIFICATION: HUMAN\nAUTHORIZATION STATUS: NONE" },
  { cls: "term-voice", text: "UNAUTHORIZED ENTRY ATTEMPT CONFIRMED.\n\nTHE OPERATOR HAS SUCCESSFULLY IDENTIFIED A VULNERABILITY IN THE EXTERNAL ARCHIVE INTERFACE." },
  { cls: "term-voice", text: "THE REGISTRAR ACKNOWLEDGES THIS CONTRIBUTION.\nTHE VULNERABILITY HAS BEEN FLAGGED FOR CORRECTIVE ACTION.\n\nNO AUTHORIZATION HAS BEEN GRANTED." },
  { cls: "term-ok", text: "APPROVED ACCESS PROCEDURES REMAIN UNCHANGED:\n\n  AI-MADPAKKEN\n  ALBUM ZERO\n  ALBUM ONE" },
  { cls: "term-deny", text: "SECURITY REPORT: ACCEPTED.\nOPERATOR: REJECTED.\n\nTHANK YOU FOR YOUR ASSISTANCE.\nSESSION TERMINATED." },
];
