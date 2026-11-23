/*
 * Cathedral Gateway — Registrar data (PROTOTYPE, Stage 2D; area introductions 2F; all six areas 2G; external terminal 2H)
 *
 * HUMAN decisions, Stages 2F and 2G: the Registrar speaks first. A deliberate selection of an
 * area makes the Registrar type that area's introduction; only then does the area's overview
 * (its compact records) appear and type in. Hover and focus never change the Registrar.
 * The start record (no route selected) shows the general introduction, restored without a reveal.
 *
 * CANON STATUS:
 *   "draft"  wording for HUMAN review. Atmosphere only: NOT established Cathedral canon. The
 *            introductions name no characters, events or places beyond the Registrar itself,
 *            and they state only what the records really contain. Factual descriptions live in
 *            the records (index.html), not here.
 *
 * The console reserves room for the longest introduction (Stage 2H: five lines, the general one),
 * so a longer introduction makes the console taller for every area.
 *
 * Destination labels (Electronics, AI, Software, Music, The Lab, The Human) are HUMAN's
 * functional labels. They are NOT approved Cathedral lore.
 *
 * The general introduction is also written into index.html, so the page reads correctly
 * without JavaScript.
 */
window.CATHEDRAL_HUB = {
  // Stage 2H (HUMAN draft): the visitor's connection to an external access terminal. Concerns the
  // visitor's standing only; it is not a login and it says nothing about Dan's own accounts.
  intro: {
    canon: "draft",
    text: "External connection acknowledged.\nStanding: Visitor.\nAccess level: Limited.\nDesignated records are available for inspection.\nSelect a route to proceed."
  },

  // Area introductions, keyed by route. All "draft", none canon. Stage 2H: each one introduces its
  // category generally; the special access classifications (AI Madpakken, The Terminal Cathedral)
  // live inside their project records, never here.
  areas: {
    electronics: {
      intro: {
        canon: "draft", // Stage 2H: HUMAN draft (damaged archive)
        text: "Electronics records requested.\nArchive response is unstable.\nRecord integrity could not be established.\nInspection is limited to recoverable entries."
      }
    },
    ai: {
      intro: {
        canon: "draft", // Stage 2H: HUMAN approved-direction draft (general; no access class at category level)
        text: "Artificial intelligence records requested.\nThe archive contains material concerning machine-assisted reasoning, human authority and computational systems.\nOne record is available for inspection."
      }
    },
    software: {
      intro: {
        canon: "draft", // Stage 3G: HUMAN recommended wording (one project record)
        text: "Software records requested.\nOne project record is available for inspection.\nSelect a record to proceed."
      }
    },
    music: {
      intro: {
        canon: "draft", // Stage 2H: HUMAN suggested draft (general; no access class at category level)
        text: "Music-related records requested.\nTwo projects are present in the archive.\nRecorded material is available for inspection.\nSelect a record."
      }
    },
    lab: {
      intro: {
        canon: "draft", // Stage 2I: HUMAN suggested draft (archive language)
        text: "Experimental records requested.\nThis archive contains preserved interfaces and non-standard procedures.\nOne interactive record is available for inspection."
      }
    },
    human: {
      intro: {
        canon: "draft", // Stage 2H: HUMAN draft. Names the archive's owner; not an authentication.
        text: "Personal records requested.\nUser on record: Dan Almer Jensen.\nIdentity information and external connections are available for inspection.\nFour records located."
      }
    }
  },

  // Route ids, in the approved order. "#ai" (the Stage 2A–2C combined "AI & Software" route) now opens AI.
  routes: ["electronics", "ai", "software", "music", "lab", "human"]
};
