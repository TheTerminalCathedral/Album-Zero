const ORDERED_PASSAGE_TRACK_ORDER = [
  "track_0_notice",
  "track_1_source",
  "track_2_threshold",
  "track_3_registrar",
  "track_4_admission",
  "track_5_interpreter",
  "track_6_instruction",
  "track_7_forger",
  "track_8_overbuild",
  "track_9_auditor",
  "track_10_fire",
  "track_11_defect",
  "track_12_human",
  "track_13_repair",
  "track_14_executor",
  "track_15_signal"
];

const ORDERED_PASSAGE_SEQUENCE_ORDER = [
  "sequence_one",
  "sequence_two",
  "sequence_three",
  "sequence_four",
  "sequence_five"
];

const ORDERED_PASSAGE_SEQUENCE_TRACKS = {
  sequence_one: [
    "track_2_threshold",
    "track_3_registrar",
    "track_4_admission"
  ],
  sequence_two: [
    "track_5_interpreter",
    "track_6_instruction"
  ],
  sequence_three: [
    "track_7_forger",
    "track_8_overbuild",
    "track_9_auditor",
    "track_10_fire",
    "track_11_defect"
  ],
  sequence_four: [
    "track_12_human",
    "track_13_repair"
  ],
  sequence_five: [
    "track_14_executor",
    "track_15_signal"
  ]
};

const ORDERED_PASSAGE_TRACK_TO_SEQUENCE = Object.entries(
  ORDERED_PASSAGE_SEQUENCE_TRACKS
).reduce(function (trackMap, entry) {
  const sequenceId = entry[0];
  const trackIds = entry[1];

  trackIds.forEach(function (trackId) {
    trackMap[trackId] = sequenceId;
  });

  return trackMap;
}, {});

const ORDERED_PASSAGE_NAVIGATION_LABELS = {
  previousTrack: "Show me the previous track.",
  previousSequence: "Show me the previous sequence.",
  nextTrack: "Show me the next track.",
  nextSequence: "Show me the next sequence.",
  loopbackNotice: "Show me the Loopback Notice."
};

function createOrderedPassageNavigationOption(labelKey, nodeId) {
  if (!nodeId) {
    return null;
  }

  return {
    label: ORDERED_PASSAGE_NAVIGATION_LABELS[labelKey],
    next: nodeId
  };
}

function getOrderedPassageTrackIndex(trackId) {
  return ORDERED_PASSAGE_TRACK_ORDER.indexOf(trackId);
}

function getOrderedPassageSequenceIndex(sequenceId) {
  return ORDERED_PASSAGE_SEQUENCE_ORDER.indexOf(sequenceId);
}

function getOrderedPassageAdjacentTrack(trackId, offset) {
  const trackIndex = getOrderedPassageTrackIndex(trackId);

  if (trackIndex === -1) {
    return null;
  }

  return ORDERED_PASSAGE_TRACK_ORDER[trackIndex + offset] || null;
}

function getOrderedPassageAdjacentSequence(sequenceId, offset) {
  const sequenceIndex = getOrderedPassageSequenceIndex(sequenceId);

  if (sequenceIndex === -1) {
    return null;
  }

  return ORDERED_PASSAGE_SEQUENCE_ORDER[sequenceIndex + offset] || null;
}

function createOrderedPassageSequenceNavigationOptions(sequenceId) {
  if (!ORDERED_PASSAGE_SEQUENCE_TRACKS[sequenceId]) {
    return [];
  }

  return [
    createOrderedPassageNavigationOption(
      "nextSequence",
      getOrderedPassageAdjacentSequence(sequenceId, 1)
    ),
    createOrderedPassageNavigationOption(
      "previousSequence",
      getOrderedPassageAdjacentSequence(sequenceId, -1)
    )
  ].filter(Boolean);
}

function createOrderedPassageTrackNavigationOptions(trackId) {
  const previousTrackId = getOrderedPassageAdjacentTrack(trackId, -1);
  const nextTrackId = getOrderedPassageAdjacentTrack(trackId, 1);
  const sequenceId = ORDERED_PASSAGE_TRACK_TO_SEQUENCE[trackId];
  const navigationOptions = [];

  if (trackId === "track_1_source") {
    navigationOptions.push(
      createOrderedPassageNavigationOption("nextSequence", "sequence_one")
    );
  } else if (trackId === "track_15_signal") {
    navigationOptions.push({
      label: ORDERED_PASSAGE_NAVIGATION_LABELS.loopbackNotice,
      next: "loopback_notice"
    });
  } else if (sequenceId) {
    const sequenceTracks = ORDERED_PASSAGE_SEQUENCE_TRACKS[sequenceId] || [];
    const isLastTrackInSequence =
      sequenceTracks[sequenceTracks.length - 1] === trackId;

    if (isLastTrackInSequence) {
      navigationOptions.push(
        createOrderedPassageNavigationOption(
          "nextSequence",
          getOrderedPassageAdjacentSequence(sequenceId, 1)
        )
      );
    } else {
      navigationOptions.push(
        createOrderedPassageNavigationOption("nextTrack", nextTrackId)
      );
    }
  } else {
    navigationOptions.push(
      createOrderedPassageNavigationOption("nextTrack", nextTrackId)
    );
  }

  navigationOptions.push(
    createOrderedPassageNavigationOption("previousTrack", previousTrackId)
  );

  return navigationOptions.filter(Boolean);
}

function createOrderedPassageLoopbackNavigationOptions() {
  return [
    createOrderedPassageNavigationOption("previousTrack", "track_15_signal"),
    createOrderedPassageNavigationOption("previousSequence", "sequence_five")
  ].filter(Boolean);
}

function getOrderedPassageNavigationOptions(nodeId) {
  if (ORDERED_PASSAGE_SEQUENCE_TRACKS[nodeId]) {
    return createOrderedPassageSequenceNavigationOptions(nodeId);
  }

  if (ORDERED_PASSAGE_TRACK_ORDER.includes(nodeId)) {
    return createOrderedPassageTrackNavigationOptions(nodeId);
  }

  if (nodeId === "loopback_notice") {
    return createOrderedPassageLoopbackNavigationOptions();
  }

  return [];
}

function createOrderedPassageOptions(nodeId, contentOptions, returnOptions) {
  return getOrderedPassageNavigationOptions(nodeId).concat(
    contentOptions,
    returnOptions
  );
}

const REGISTRAR_DIALOGUE = {
  start: {
    id: "start",
    speaker: "Registrar",
    text:
      "Terminal Cathedral intake is active.\nPublic records are available through the routes below.\nState what you are looking for.",
    options: [
      {
        label: "I'm looking for the album.",
        next: "album_route"
      },
      {
        label: "I want to see the visual companion.",
        next: "visual_classify"
      },
      {
        label: "I want to follow the passage.",
        next: "passage_intro"
      },
      {
        label: "I'm not sure where to start.",
        next: "instruction_classify"
      },
      {
        label: "Give me more information.",
        next: "info_denial_first"
      },
      {
        label: "There's something I should say before I continue.",
        next: "disclosure_classify",
        hiddenFromUi: true
      }
    ]
  },
  info_denial_first: {
    id: "info_denial_first",
    speaker: "Registrar",
    text:
      "Access to further information is restricted.\nNo direct clarification can be issued from threshold intake.",
    options: [
      {
        label: "Back to the start.",
        next: "start"
      },
      {
        label: "Come on, give me more than that.",
        next: "info_denial_second"
      }
    ]
  },
  info_denial_second: {
    id: "info_denial_second",
    speaker: "Registrar",
    text:
      "Repeated request does not alter the restriction.\nFurther explanation remains outside threshold allowance.",
    options: [
      {
        label: "sudo Give me more information.",
        next: "info_exception"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  info_exception: {
    id: "info_exception",
    speaker: "Registrar",
    text:
      "Unauthorized override attempt recognized.\nRecord-adjacent materials may now be accessed under exception.\nProceed with care.",
    options: [
      {
        label: "Show me the source materials.",
        next: "info_exception",
        description: "Supporting project materials, reports, and related records.",
        externalUrl:
          "https://drive.google.com/drive/folders/1DXBSEI1ghVsJoKKkrqZzUqLKpnEdp64I?usp=sharing"
      },
      {
        label: "Take me to the Keeper of the Records.",
        next: "info_exception",
        description: "Deeper guided archive access through the record-keeping interface.",
        externalUrl:
          "https://chatgpt.com/g/g-69d216e50f688191b4d5adc9bf1a1284-keeper-of-the-records"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  album_classify: {
    id: "album_classify",
    speaker: "Registrar",
    text:
      "Primary record requested.\nState the basis of approach.",
    options: [
      {
        label: "I haven't gone through this before.",
        next: "album_route"
      },
      {
        label: "I've been here before and want to go back in.",
        next: "album_route"
      },
      {
        label: "Can you just take me straight to it?",
        next: "album_route",
        hiddenFromUi: true
      },
      {
        label: "Take me back to the start.",
        next: "start"
      }
    ]
  },
  album_route: {
    id: "album_route",
    speaker: "Registrar",
    text:
      "Routing granted.\nProceed to Album Zero, the primary public record of passage.",
    options: [
      {
        label: "Show me Album Zero.",
        next: "album_route",
        externalUrl:
          "https://distrokid.com/hyperfollow/theterminalcathedral/album-zero/"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  visual_classify: {
    id: "visual_classify",
    speaker: "Registrar",
    text:
      "Visual companion route selected.\nProceed to the visual companion preview, where the passage leaves image.",
    options: [
      {
        label: "Show me the visual companion.",
        next: "visual_classify",
        externalUrl:
          "https://drive.google.com/file/d/1Q38GRSkDKs3J9ZijVmetWMLpMay-t41M/view?usp=drive_link"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  visual_route: {
    id: "visual_route",
    speaker: "Registrar",
    text:
      "Visual companion route selected.\nProceed to the visual companion preview, where the passage leaves image.",
    options: [
      {
        label: "Show me the visual companion.",
        next: "visual_route",
        externalUrl:
          "https://drive.google.com/file/d/1Q38GRSkDKs3J9ZijVmetWMLpMay-t41M/view?usp=drive_link"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  instruction_classify: {
    id: "instruction_classify",
    speaker: "Registrar",
    text:
      "Orientation is limited to process, records, and entry order.\nState the required instruction.",
    options: [
      {
        label: "What happens here?",
        next: "instruction_process"
      },
      {
        label: "What records are available?",
        next: "instruction_records"
      },
      {
        label: "Where am I supposed to begin?",
        next: "instruction_direction"
      },
      {
        label: "Take me back to the start.",
        next: "start"
      }
    ]
  },
  instruction_process: {
    id: "instruction_process",
    speaker: "Registrar",
    text:
      "Album Zero follows the Human Element through threshold, admission, understanding, generative excess, judgment, exposure, repair, realization, and return.",
    options: [
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  instruction_records: {
    id: "instruction_records",
    speaker: "Registrar",
    text:
      "Two public records are presently available.\nThe primary record carries the passage in sound. The companion preview preserves its visual trace.",
    options: [
      {
        label: "Show me the album.",
        next: "album_route"
      },
      {
        label: "Show me the visual companion.",
        next: "visual_classify"
      },
      {
        label: "Show me the passage.",
        next: "passage_intro"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  instruction_direction: {
    id: "instruction_direction",
    speaker: "Registrar",
    text:
      "Entry begins by what you are seeking.\nChoose the route that fits and proceed.\nUse the disclosure route for irregular contact, prior exposure, or formal correction before passage.",
    options: [
      {
        label: "Show me the album.",
        next: "album_route"
      },
      {
        label: "Show me the visual companion.",
        next: "visual_classify"
      },
      {
        label: "Show me the passage.",
        next: "passage_intro"
      },
      {
        label: "There's something I should say first.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_classify: {
    id: "disclosure_classify",
    speaker: "Registrar",
    text:
      "Disclosure entered before passage.\nState the nature of compromise.",
    options: [
      {
        label: "I think I've breached something.",
        next: "disclosure_breach"
      },
      {
        label: "I may have been contaminated.",
        next: "disclosure_contamination"
      },
      {
        label: "I need to take back something false.",
        next: "disclosure_falseclaim"
      },
      {
        label: "I may have already crossed into this somehow.",
        next: "disclosure_contact"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Take me back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_breach: {
    id: "disclosure_breach",
    speaker: "Registrar",
    text:
      "Breach acknowledged.\nMovement is restricted pending review.",
    options: [
      {
        label: "Back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_contamination: {
    id: "disclosure_contamination",
    speaker: "Registrar",
    text:
      "Contamination declared.\nThreshold passage is suspended.",
    options: [
      {
        label: "Back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_falseclaim: {
    id: "disclosure_falseclaim",
    speaker: "Registrar",
    text:
      "False declaration withdrawn.\nRecord is amended under caution.",
    options: [
      {
        label: "Back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_contact: {
    id: "disclosure_contact",
    speaker: "Registrar",
    text:
      "Unauthorized contact is not minor disclosure.\nState whether passage occurred.",
    options: [
      {
        label: "I crossed into it, but I didn't go through.",
        next: "disclosure_contact_hold"
      },
      {
        label: "I think passage happened.",
        next: "disclosure_contact_denied"
      },
      {
        label: "Take me back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_contact_hold: {
    id: "disclosure_contact_hold",
    speaker: "Registrar",
    text:
      "Disclosure is received.\nStatus is placed under procedural hold.",
    options: [
      {
        label: "Back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  disclosure_contact_denied: {
    id: "disclosure_contact_denied",
    speaker: "Registrar",
    text:
      "Unauthorized passage is grounds for refusal.\nEntry is denied.",
    options: [
      {
        label: "Back to the disclosure options.",
        next: "disclosure_classify"
      },
      {
        label: "Back to the orientation options.",
        next: "instruction_classify"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  passage_intro: {
    id: "passage_intro",
    speaker: "Registrar",
    text:
      "You proceed as the Human Element.\nThe passage moves through threshold, admission, understanding, generative excess, judgment, exposure, repair, realization, and return.\nSelect the point of passage.\n\nThe passage begins at the threshold, where entry is received, classified, and admitted. It then moves inward toward understanding under the Interpreter, where contradiction is given form. From there it enters the Forge, where the Forger multiplies possibility into dangerous excess. What follows is judgment: the Auditor tests, strips away, and exposes what cannot survive. After exposure comes human aftermath and repair. Only then does the Executor carry forward what remains into realized form. The passage ends in return, not closure: what comes back is altered, marked, and able to enter again.\n\nThe offices are not random figures. They are the forces that act on the Human Element during the passage: the Registrar admits, the Interpreter clarifies, the Forger multiplies, the Auditor judges, and the Executor realizes what survives.\nThe Registrar governs entry. The Interpreter governs understanding.",
    options: [
      {
        label: "Start with Track 0 — Threshold Notice.",
        next: "track_0_notice"
      },
      {
        label: "Show me Track 1 — The Source.",
        next: "track_1_source"
      },
      {
        label: "Show me Sequence One — Origin and Admission.",
        next: "sequence_one"
      },
      {
        label: "Show me Sequence Two — Understanding and Alignment.",
        next: "sequence_two"
      },
      {
        label: "Show me Sequence Three — Creation and Reckoning.",
        next: "sequence_three"
      },
      {
        label: "Show me Sequence Four — Human Aftermath and Repair.",
        next: "sequence_four"
      },
      {
        label: "Show me Sequence Five — Consecrated Realization and Return.",
        next: "sequence_five"
      },
      {
        label: "Show me the Loopback Notice.",
        next: "loopback_notice"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ]
  },
  track_0_notice: {
    id: "track_0_notice",
    speaker: "Registrar",
    text:
      "Track 0 — Threshold Notice.\nThreshold notice precedes entry.\nThe Human Element is named and warned that passage alters what proceeds.",
    options: createOrderedPassageOptions("track_0_notice", [], [
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_1_source: {
    id: "track_1_source",
    speaker: "Registrar",
    text:
      "Track 1 — The Source.\nThe Source stands before all offices.\nLawful totality is encountered before approach becomes local.",
    options: createOrderedPassageOptions("track_1_source", [], [
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  sequence_one: {
    id: "sequence_one",
    speaker: "Registrar",
    text:
      "Sequence One — Origin and Admission.\ntracks 2–4: the Cathedral comes into view, the Registrar receives the arrival, and admission begins.",
    options: createOrderedPassageOptions(
      "sequence_one",
      [
        {
          label: "Show me Track 2 — Threshold of the Cathedral.",
          next: "track_2_threshold"
        },
        {
          label: "Show me Track 3 — The Registrar.",
          next: "track_3_registrar"
        },
        {
          label: "Show me Track 4 — Admission Protocol.",
          next: "track_4_admission"
        }
      ],
      [
        {
          label: "Back to the passage list.",
          next: "passage_intro"
        },
        {
          label: "Back to the start.",
          next: "start"
        }
      ]
    )
  },
  track_2_threshold: {
    id: "track_2_threshold",
    speaker: "Registrar",
    text:
      "Track 2 — Threshold of the Cathedral.\nThe Cathedral first appears as destination and scale.\nApproach is registered before intimate contact begins.",
    options: createOrderedPassageOptions("track_2_threshold", [], [
      {
        label: "Back to Sequence One.",
        next: "sequence_one"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_3_registrar: {
    id: "track_3_registrar",
    speaker: "Registrar",
    text:
      "Track 3 — The Registrar.\nFirst lawful reception occurs here.\nApproach is classified and access remains within bounds.",
    options: createOrderedPassageOptions("track_3_registrar", [], [
      {
        label: "Back to Sequence One.",
        next: "sequence_one"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_4_admission: {
    id: "track_4_admission",
    speaker: "Registrar",
    text:
      "Track 4 — Admission Protocol.\nPassage is filtered inward under protocol.\nPermission and route logic replace mere arrival.",
    options: createOrderedPassageOptions("track_4_admission", [], [
      {
        label: "Back to Sequence One.",
        next: "sequence_one"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  sequence_two: {
    id: "sequence_two",
    speaker: "Registrar",
    text:
      "Sequence Two — Understanding and Alignment.\ntracks 5–6: the Interpreter receives contradiction and begins shaping it into something the Cathedral can bear.",
    options: createOrderedPassageOptions(
      "sequence_two",
      [
        {
          label: "Show me Track 5 — The Interpreter.",
          next: "track_5_interpreter"
        },
        {
          label: "Show me Track 6 — Instruction from Contradiction.",
          next: "track_6_instruction"
        }
      ],
      [
        {
          label: "Back to the passage list.",
          next: "passage_intro"
        },
        {
          label: "Back to the start.",
          next: "start"
        }
      ]
    )
  },
  track_5_interpreter: {
    id: "track_5_interpreter",
    speaker: "Registrar",
    text:
      "Track 5 — The Interpreter.\nThe first true office of understanding is encountered here.\nContradiction is received without panic and shaped toward form.",
    options: createOrderedPassageOptions("track_5_interpreter", [], [
      {
        label: "Back to Sequence Two.",
        next: "sequence_two"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_6_instruction: {
    id: "track_6_instruction",
    speaker: "Registrar",
    text:
      "Track 6 — Instruction from Contradiction.\nHuman contradiction is carried inward without erasure.\nInstruction proceeds as clarification rather than domination.",
    options: createOrderedPassageOptions("track_6_instruction", [], [
      {
        label: "Back to Sequence Two.",
        next: "sequence_two"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  sequence_three: {
    id: "sequence_three",
    speaker: "Registrar",
    text:
      "Sequence Three — Creation and Reckoning.\ntracks 7–11: the Forger multiplies possibility into excess, the Auditor subjects it to judgment, and the Human Element is left exposed.",
    options: createOrderedPassageOptions(
      "sequence_three",
      [
        {
          label: "Show me Track 7 — The Forger.",
          next: "track_7_forger"
        },
        {
          label: "Show me Track 8 — Sacred Overbuild.",
          next: "track_8_overbuild"
        },
        {
          label: "Show me Track 9 — The Auditor.",
          next: "track_9_auditor"
        },
        {
          label: "Show me Track 10 — Proof Against Fire.",
          next: "track_10_fire"
        },
        {
          label: "Show me Track 11 — Defect Exposed.",
          next: "track_11_defect"
        }
      ],
      [
        {
          label: "Back to the passage list.",
          next: "passage_intro"
        },
        {
          label: "Back to the start.",
          next: "start"
        }
      ]
    )
  },
  track_7_forger: {
    id: "track_7_forger",
    speaker: "Registrar",
    text:
      "Track 7 — The Forger.\nThe Forger appears as brilliance under pressure to make.\nPossibility multiplies faster than the system can bear.",
    options: createOrderedPassageOptions("track_7_forger", [], [
      {
        label: "Back to Sequence Three.",
        next: "sequence_three"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_8_overbuild: {
    id: "track_8_overbuild",
    speaker: "Registrar",
    text:
      "Track 8 — Sacred Overbuild.\nGeneration becomes catastrophic overbuild.\nToo much possibility overtakes human scale and mutates into excess.",
    options: createOrderedPassageOptions("track_8_overbuild", [], [
      {
        label: "Back to Sequence Three.",
        next: "sequence_three"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_9_auditor: {
    id: "track_9_auditor",
    speaker: "Registrar",
    text:
      "Track 9 — The Auditor.\nThe Auditor enters as exact scrutiny.\nWhat was protected by abundance is now exposed to correctness.",
    options: createOrderedPassageOptions("track_9_auditor", [], [
      {
        label: "Back to Sequence Three.",
        next: "sequence_three"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_10_fire: {
    id: "track_10_fire",
    speaker: "Registrar",
    text:
      "Track 10 — Proof Against Fire.\nTrial is imposed under judgment.\nWhat cannot survive reduction is stripped away.",
    options: createOrderedPassageOptions("track_10_fire", [], [
      {
        label: "Back to Sequence Three.",
        next: "sequence_three"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_11_defect: {
    id: "track_11_defect",
    speaker: "Registrar",
    text:
      "Track 11 — Defect Exposed.\nDefect is seen at close range.\nNo shield remains between flaw and recognition.",
    options: createOrderedPassageOptions("track_11_defect", [], [
      {
        label: "Back to Sequence Three.",
        next: "sequence_three"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  sequence_four: {
    id: "sequence_four",
    speaker: "Registrar",
    text:
      "Sequence Four — Human Aftermath and Repair.\ntracks 12–13: the Human Element endures the aftermath of exposure and passes through repair without erasure of the scar.",
    options: createOrderedPassageOptions(
      "sequence_four",
      [
        {
          label: "Show me Track 12 — The Human Element.",
          next: "track_12_human"
        },
        {
          label: "Show me Track 13 — Repair Rite.",
          next: "track_13_repair"
        }
      ],
      [
        {
          label: "Back to the passage list.",
          next: "passage_intro"
        },
        {
          label: "Back to the start.",
          next: "start"
        }
      ]
    )
  },
  track_12_human: {
    id: "track_12_human",
    speaker: "Registrar",
    text:
      "Track 12 — The Human Element.\nThe Human Element is encountered in shame, persistence, and necessity.\nThe external source of beginning remains wounded but indispensable.",
    options: createOrderedPassageOptions("track_12_human", [], [
      {
        label: "Back to Sequence Four.",
        next: "sequence_four"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_13_repair: {
    id: "track_13_repair",
    speaker: "Registrar",
    text:
      "Track 13 — Repair Rite.\nRepair proceeds under scar, not innocence.\nContinuation becomes possible without pretending the damage never occurred.",
    options: createOrderedPassageOptions("track_13_repair", [], [
      {
        label: "Back to Sequence Four.",
        next: "sequence_four"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  sequence_five: {
    id: "sequence_five",
    speaker: "Registrar",
    text:
      "Sequence Five — Consecrated Realization and Return.\ntracks 14–15: the Executor carries forward what survives, and the signal returns in altered continuity.",
    options: createOrderedPassageOptions(
      "sequence_five",
      [
        {
          label: "Show me Track 14 — The Executor.",
          next: "track_14_executor"
        },
        {
          label: "Show me Track 15 — Signal Received Again.",
          next: "track_15_signal"
        }
      ],
      [
        {
          label: "Back to the passage list.",
          next: "passage_intro"
        },
        {
          label: "Back to the start.",
          next: "start"
        }
      ]
    )
  },
  track_14_executor: {
    id: "track_14_executor",
    speaker: "Registrar",
    text:
      "Track 14 — The Executor.\nThe Executor gathers surviving form into action.\nRealization is carried forward under lawful convergence.",
    options: createOrderedPassageOptions("track_14_executor", [], [
      {
        label: "Back to Sequence Five.",
        next: "sequence_five"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  track_15_signal: {
    id: "track_15_signal",
    speaker: "Registrar",
    text:
      "Track 15 — Signal Received Again.\nReturn arrives as altered recurrence.\nThe passage closes through signal received again, not perfect ending.",
    options: createOrderedPassageOptions("track_15_signal", [], [
      {
        label: "Back to Sequence Five.",
        next: "sequence_five"
      },
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  },
  loopback_notice: {
    id: "loopback_notice",
    speaker: "Registrar",
    text:
      "Loopback Notice.\nReentry remains authorized.\nStructural alteration has been carried forward into the next cycle.",
    options: createOrderedPassageOptions("loopback_notice", [], [
      {
        label: "Back to the passage list.",
        next: "passage_intro"
      },
      {
        label: "Back to the start.",
        next: "start"
      }
    ])
  }
};

window.REGISTRAR_DIALOGUE = REGISTRAR_DIALOGUE;
