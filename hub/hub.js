/*
 * Cathedral Gateway — PROTOTYPE (Stage 2A; content 2B; in-place navigation 2C; six routes 2D;
 * typewriter reveal 2E; Registrar-first navigation 2F; all six areas with expandable records 2G).
 *
 * Three levels (HUMAN decisions, Stages 2F and 2G):
 *   1. the six sidebar buttons select an area;
 *   2. the Registrar Console introduces the area (hub-data.js "areas"), typed first;
 *   3. the area's overview shows compact, collapsed records (.rec-item). Opening one expands it
 *      inline to its full height, and only then types its text. It can be collapsed again.
 *      Within an area only one record is open at a time (accordion).
 *
 * Views are routes: an area ("music") or an area with one record open ("music/workshop").
 * The area is one .record[data-record] section; its records are .rec-item[data-item] inside it.
 *
 * Sequence on a deliberate area selection (click, Enter, Back, Forward): Registrar reveal, then
 * the overview reveal, never at the same time. Both are laid out at their final size from the
 * first frame; the overview is held invisible until the Registrar is done.
 * Sequence on opening a record: (A) the container expands to its full measured height, a short
 * animation; (B) only after that, its text types into its final positions. The text is already
 * laid out (transparent) during (A), so (B) moves nothing. Stage 2H: a damaged archive
 * (Electronics, Software) runs a short decorative interference stage between (A) and (B).
 *
 * Skip / reveal all: the Skip button, a click in the record display (not on a record toggle),
 * Escape, or selecting the current area again. It completes any expansion or collapse at once
 * and completes the text. Never on hover or focus; nothing animates under reduced motion.
 * Any new action (area, record, history) first completes and restores whatever is still
 * running, so no stale step or timer can change another record.
 *
 * Progressive enhancement: without JavaScript every area and every record is expanded and
 * readable, the toggles do nothing, the general introduction is in index.html.
 *
 * Navigation (HUMAN decision, Stage 2C, kept): stationary, in place.
 *   - The page never scrolls by itself: no scrollIntoView, no anchor jumps (no element carries a
 *     route's id), history.scrollRestoration is "manual". The display keeps a temporary height
 *     reserve so a shorter area or a collapsing record cannot pull the viewport up; a record that
 *     fits the window is pinned (sticky) inside the display.
 *   - One exception, to keep what the visitor clicked in place: when opening a record closes
 *     another one ABOVE it while the page is scrolled, the page is shifted by exactly the height
 *     that disappeared above, so the clicked record header stays where it was on screen.
 *   - Area selections use history.pushState (Back/Forward move between areas). Opening or
 *     closing a record uses history.replaceState: the URL always names the open record, so
 *     refresh and direct links restore it, without adding history entries for each toggle.
 *     Old deep link "#ai/madpakken" opens AI with AI Madpakken expanded.
 *   - Focus stays where the visitor put it (sidebar button or record toggle).
 *
 * Analytics (HUMAN decisions 2A–2G): the two existing event names, through analytics.js only.
 *   hub_destination_select  a deliberate selection:
 *                             sidebar button    option_kind "gateway",         button_id "gateway_<area>"
 *                             record opened     option_kind "record_expand",   button_id "toggle_<area>_<item>"
 *                             record closed     option_kind "record_collapse", button_id "toggle_<area>_<item>"
 *                             original console  option_kind "record_link",     destination "registrar_console"
 *                           destination: the area, or "<area>/<item>" for the record toggled.
 *                           Not counted: re-selecting the current area, Skip, page load, refresh,
 *                           direct links, Back/Forward, and a record closed automatically by the accordion.
 *   hub_outbound_click      an external link; button_id "outbound_<name>" from data-outbound,
 *                           node_id = the view it was in (e.g. "ai/madpakken").
 */
(function () {
  "use strict";

  var analytics = window.TerminalCathedralAnalytics;
  var data = window.CATHEDRAL_HUB || {};
  var live = document.getElementById("hubLive");
  var dialogue = document.getElementById("hubDialogue");
  var display = document.getElementById("record-display");
  var records = Array.prototype.slice.call(document.querySelectorAll(".record[data-record]"));
  var routes = Array.prototype.slice.call(document.querySelectorAll(".gateway-route[data-destination]"));

  if (!display || records.length === 0) {
    return; // keep the static document
  }

  var PIN_MARGIN_PX = 16;
  var EXPAND_MS = 260;    // Stage A: container expansion
  var COLLAPSE_MS = 200;
  var ALIASES = { "": "start", gateway: "start", start: "start" };
  var KNOWN = {};
  var GENERAL_INTRO = data.intro && data.intro.text ? data.intro.text : (dialogue ? dialogue.textContent : "");
  var AREAS = data.areas || {};

  var currentRoute = null;
  var reducedMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

  /*
   * Typewriter (HUMAN decisions, Stages 2E–2G): one reusable reveal, run as a sequence of steps.
   * start([{ root, host, gate }, ...]):
   *   root  the element whose text is revealed;
   *   host  where the Skip button sits while that step types;
   *   gate  optional promise: the step does not draw a single character before it resolves
   *         (used for the record expansion: no typing while the container is still expanding).
   * All steps are prepared at once, so every text has its final layout before the first
   * character. Steps after the first are held invisible (tw-pending) until their turn.
   *
   * Each visible text node is split, in place, into a revealed and a not-yet-revealed part; the
   * second keeps its characters but is drawn transparent, so nothing moves while it appears.
   * Text inside [hidden] (collapsed records) is left alone. The text is never duplicated, and
   * when the run ends (or is skipped or cancelled) the original text nodes are put back.
   *
   * Screen readers: transparent text is in the accessibility tree, so the full text is readable
   * at once; revealed elements are aria-busy while typing; nothing is announced per character.
   * Reduced motion: no reveal at all.
   */
  var typewriter = (function () {
    var CHARS_PER_SECOND = 260;   // calm, terminal-like
    var MIN_DURATION_MS = 450;
    var MAX_DURATION_MS = 2600;   // long records type faster rather than longer
    var STEP_GAP_MS = 180;        // a short beat between the Registrar and the content
    var active = null;
    var onSkip = null;

    function collect(root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          if (!node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT; // layout whitespace between elements stays untouched
          }
          var parent = node.parentElement;
          if (!parent || parent.closest(".sr-only, .tw-skip, [hidden]")) {
            return NodeFilter.FILTER_REJECT; // invisible, collapsed, or our own control
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [];
      while (walker.nextNode()) {
        nodes.push(walker.currentNode);
      }
      return nodes;
    }

    function prepare(target) {
      var total = 0;
      var segments = collect(target.root).map(function (node) {
        var wrap = document.createElement("span");
        var shown = document.createElement("span");
        var rest = document.createElement("span");
        wrap.className = "tw-seg";
        shown.className = "tw-shown";
        rest.className = "tw-rest";
        rest.textContent = node.nodeValue;
        wrap.appendChild(shown);
        wrap.appendChild(rest);
        node.parentNode.replaceChild(wrap, node);
        // One reveal step per character; a whole run of whitespace is a single step.
        var cuts = [];
        var text = node.nodeValue;
        for (var i = 0; i < text.length; i += 1) {
          if (/\s/.test(text.charAt(i))) {
            while (i + 1 < text.length && /\s/.test(text.charAt(i + 1))) {
              i += 1;
            }
          }
          cuts.push(i + 1);
        }
        var seg = { node: node, text: text, cuts: cuts, wrap: wrap, shown: shown, rest: rest, from: total };
        total += cuts.length;
        return seg;
      });
      return {
        root: target.root,
        host: target.host || target.root,
        gate: target.gate || null,
        gateOpen: !target.gate,
        segments: segments,
        total: total,
        index: 0,
        duration: Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, (total / CHARS_PER_SECOND) * 1000)),
        done: false
      };
    }

    function restore(step) {
      if (step.done) {
        return;
      }
      step.done = true;
      step.segments.forEach(function (seg) {
        if (seg.wrap.parentNode) {
          seg.wrap.parentNode.replaceChild(seg.node, seg.wrap); // the original text node, untouched
        }
      });
      step.root.classList.remove("tw-typing", "tw-pending");
      step.root.removeAttribute("aria-busy");
    }

    function moveSkip(skip, host) {
      if (skip.parentNode === host) {
        return;
      }
      var hadFocus = document.activeElement === skip;
      host.appendChild(skip);
      if (hadFocus) {
        skip.focus({ preventScroll: true });
      }
    }

    function finish() {
      if (!active) {
        return;
      }
      var run = active;
      active = null;
      window.cancelAnimationFrame(run.frame);
      run.steps.forEach(restore);
      if (run.skip.parentNode) {
        run.skip.parentNode.removeChild(run.skip);
      }
    }

    function draw(step, count) {
      while (step.index < step.segments.length) {
        var seg = step.segments[step.index];
        var n = Math.max(0, Math.min(seg.cuts.length, count - seg.from));
        var upto = n === 0 ? 0 : seg.cuts[n - 1];
        if (seg.shown.textContent.length !== upto) {
          seg.shown.textContent = seg.text.slice(0, upto);
          seg.rest.textContent = seg.text.slice(upto);
        }
        seg.wrap.classList.toggle("tw-current", upto < seg.text.length);
        if (upto < seg.text.length) {
          break;
        }
        step.index += 1;
      }
    }

    function start(targets) {
      finish();
      if (reducedMotion.matches) {
        return;
      }
      var steps = targets.filter(function (t) { return t && t.root; }).map(prepare).filter(function (s) {
        if (s.total === 0) {
          restore(s);
          return false;
        }
        return true;
      });
      if (steps.length === 0) {
        return;
      }
      steps.forEach(function (s, i) {
        s.root.classList.add("tw-typing");
        s.root.setAttribute("aria-busy", "true");
        if (i > 0) {
          s.root.classList.add("tw-pending");
        }
      });

      var skip = document.createElement("button");
      skip.type = "button";
      skip.className = "tw-skip";
      skip.textContent = "Skip";
      skip.setAttribute("aria-label", "Show the whole record now");
      skip.addEventListener("click", function (event) {
        event.stopPropagation();
        if (onSkip) {
          onSkip();
        } else {
          finish();
        }
      });
      steps[0].host.appendChild(skip);

      var run = { steps: steps, current: 0, startTime: performance.now(), skip: skip, frame: 0 };
      active = run;
      steps.forEach(function (s) {
        if (s.gate) {
          s.gate.then(function () {
            if (active === run && !s.gateOpen) {
              s.gateOpen = true;
              if (run.steps[run.current] === s) {
                run.startTime = performance.now(); // the reveal clock starts only now
              }
            }
          });
        }
      });

      function tick(now) {
        if (active !== run) {
          return; // cancelled: a newer run or a skip has already restored everything
        }
        var step = run.steps[run.current];
        if (step.gateOpen && now >= run.startTime) {
          if (step.root.classList.contains("tw-pending")) {
            step.root.classList.remove("tw-pending");
            moveSkip(skip, step.host);
          }
          var count = Math.min(step.total, Math.ceil(step.total * Math.min(1, (now - run.startTime) / step.duration)));
          draw(step, count);
          if (count >= step.total) {
            restore(step);
            run.current += 1;
            if (run.current >= run.steps.length) {
              finish();
              return;
            }
            run.startTime = now + STEP_GAP_MS;
          }
        }
        run.frame = window.requestAnimationFrame(tick);
      }
      run.frame = window.requestAnimationFrame(tick);
    }

    return {
      start: start,
      finish: finish,
      setSkipHandler: function (fn) { onSkip = fn; },
      isTyping: function () { return !!active; }
    };
  })();

  /*
   * Expandable records (HUMAN decision, Stage 2G): one reusable component for every .rec-item.
   *   <article class="rec-item" data-item="slug">
   *     <h3><button class="rec-toggle" aria-expanded aria-controls="BODY">…</button></h3>
   *     <div class="rec-body" id="BODY" role="region"><div class="rec-body-inner">…</div></div>
   *   </article>
   * Collapsed bodies are [hidden]: not drawn, not focusable, not in the accessibility tree.
   * Expansion measures the body's real height at the current width (its content laid out
   * complete), animates 0 -> that height, then releases it to "auto". Collapse animates back.
   * Only one height animation runs at a time; settle() jumps it to its end.
   */
  var records2g = (function () {
    var all = [];
    var anim = null;

    Array.prototype.forEach.call(document.querySelectorAll(".record[data-record] .rec-item[data-item]"), function (el) {
      var area = el.closest(".record[data-record]").getAttribute("data-record");
      var toggle = el.querySelector(".rec-toggle");
      var body = toggle ? document.getElementById(toggle.getAttribute("aria-controls")) : null;
      if (!toggle || !body) {
        return;
      }
      all.push({
        area: area,
        slug: el.getAttribute("data-item"),
        view: area + "/" + el.getAttribute("data-item"),
        el: el,
        toggle: toggle,
        body: body,
        inner: body.querySelector(".rec-body-inner") || body,
        title: (el.querySelector(".rec-title") || toggle).textContent.replace(/\s+/g, " ").trim()
      });
    });

    function setState(item, open) {
      item.toggle.setAttribute("aria-expanded", open ? "true" : "false");
      item.el.classList.toggle("is-open", open);
      item.body.hidden = !open;
    }

    function settle() {
      if (anim) {
        anim.done();
      }
    }

    // Animate the body's height between two values; resolves when it is at rest.
    function animateHeight(body, from, to, ms, after) {
      settle();
      var resolve;
      var gate = new Promise(function (r) { resolve = r; });
      body.style.overflow = "hidden";
      body.style.height = from + "px";
      void body.offsetHeight; // commit the start height
      body.style.transition = "height " + ms + "ms ease-out";
      body.style.height = to + "px";
      var a = {
        body: body,
        timer: window.setTimeout(function () { a.done(); }, ms + 20),
        done: function () {
          if (anim !== a) {
            return;
          }
          anim = null;
          window.clearTimeout(a.timer);
          body.style.transition = "";
          body.style.height = "";
          body.style.overflow = "";
          if (after) {
            after();
          }
          resolve();
        }
      };
      anim = a;
      return gate;
    }

    // Returns a gate promise (resolved when the container is at its final size), or null.
    function open(item, animate, after) {
      setState(item, true);
      if (!animate || reducedMotion.matches) {
        if (after) {
          after();
        }
        return null;
      }
      var full = item.body.offsetHeight; // the real height at this width, content complete
      return animateHeight(item.body, 0, full, EXPAND_MS, after);
    }

    function close(item, animate, after) {
      if (!animate || reducedMotion.matches || item.body.hidden) {
        setState(item, false);
        if (after) {
          after();
        }
        return;
      }
      var h = item.body.offsetHeight;
      item.toggle.setAttribute("aria-expanded", "false");
      item.el.classList.remove("is-open");
      animateHeight(item.body, h, 0, COLLAPSE_MS, function () {
        item.body.hidden = true;
        if (after) {
          after();
        }
      });
    }

    return {
      all: all,
      settle: settle,
      open: open,
      close: close,
      setState: setState,
      inArea: function (area) { return all.filter(function (i) { return i.area === area; }); },
      byView: function (view) { return all.filter(function (i) { return i.view === view; })[0] || null; },
      isOpen: function (item) { return item.toggle.getAttribute("aria-expanded") === "true"; },
      busy: function () { return !!anim; }
    };
  })();

  /*
   * Damaged archives (HUMAN decision, Stage 2H): Electronics and Software (.rec-kind-damaged).
   * One extra, short stage between the expansion and the typing: the record is already at its
   * final size, its text laid out and transparent, and a decorative interference overlay
   * (CSS, hub.css "is-glitching") runs for GLITCH_MS. Nothing in the layout or in the
   * accessibility tree changes: the overlay is a pseudo-element, the text is never altered.
   * Skip, a new action, or reduced motion end or skip it; it is never tracked.
   */
  var glitch = (function () {
    var GLITCH_MS = 520;
    var current = null;

    function finish() {
      if (!current) {
        return;
      }
      var c = current;
      current = null;
      window.clearTimeout(c.timer);
      c.item.el.classList.remove("is-glitching");
      c.resolve();
    }

    function run(item) {
      finish();
      if (reducedMotion.matches) {
        return Promise.resolve();
      }
      return new Promise(function (resolve) {
        var c = { item: item, resolve: resolve };
        current = c;
        item.el.classList.add("is-glitching");
        c.timer = window.setTimeout(finish, GLITCH_MS);
      });
    }

    return { run: run, finish: finish, busy: function () { return !!current; } };
  })();

  records.forEach(function (r) { KNOWN[r.getAttribute("data-record")] = true; });
  records2g.all.forEach(function (i) { KNOWN[i.view] = true; });

  var actionToken = 0; // bumped by every completion, so a stale promise callback cannot start anything

  function finishAll() {
    actionToken += 1;
    records2g.settle();
    glitch.finish();
    typewriter.finish();
  }
  typewriter.setSkipHandler(finishAll);

  document.documentElement.classList.add("hub-js");
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  // The Registrar panel is as tall as its longest introduction (invisible sizers in the same grid
  // cell), so changing the introduction never moves the navigation or the records below.
  var messageBlock = dialogue ? dialogue.closest(".message-block") : null;
  if (dialogue) {
    var stack = document.createElement("div");
    stack.className = "dialogue-stack";
    dialogue.parentNode.insertBefore(stack, dialogue);
    stack.appendChild(dialogue);
    var intros = [GENERAL_INTRO];
    Object.keys(AREAS).forEach(function (area) {
      var intro = AREAS[area] && AREAS[area].intro;
      if (intro && intro.text && intros.indexOf(intro.text) === -1) {
        intros.push(intro.text);
      }
    });
    intros.forEach(function (text) {
      var sizer = document.createElement("p");
      sizer.className = "dialogue-text dialogue-sizer";
      sizer.setAttribute("aria-hidden", "true");
      sizer.textContent = text;
      stack.appendChild(sizer);
    });
  }

  function areaOf(view) {
    return String(view).split("/")[0];
  }

  function areaIntro(view) {
    var area = AREAS[areaOf(view)];
    return area && area.intro && area.intro.text ? area.intro.text : null;
  }

  // "#music" -> "music"; "#ai/madpakken" -> "ai/madpakken"; "", "#gateway" -> "start";
  // an unknown record inside a known area -> that area; anything else -> null
  function routeFromHref(href) {
    var id = (href || "").replace(/^#/, "");
    try {
      id = decodeURIComponent(id);
    } catch (e) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(ALIASES, id)) {
      return ALIASES[id];
    }
    if (KNOWN[id]) {
      return id;
    }
    return KNOWN[areaOf(id)] ? areaOf(id) : null;
  }

  function urlFor(route) {
    var base = window.location.pathname + window.location.search;
    return route === "start" ? base : base + "#" + route;
  }

  function recordFor(route) {
    var area = areaOf(route);
    for (var i = 0; i < records.length; i += 1) {
      if (records[i].getAttribute("data-record") === area) {
        return records[i];
      }
    }
    return null;
  }

  function fitDisplay(scrollY) {
    var active = recordFor(currentRoute);
    records.forEach(function (r) {
      if (r !== active) {
        r.classList.remove("is-pinned");
      }
    });
    if (!active) {
      display.style.minHeight = "";
      return;
    }
    var natural = active.offsetHeight;
    active.classList.toggle("is-pinned", natural + PIN_MARGIN_PX * 2 <= window.innerHeight);
    if (scrollY <= 0) {
      display.style.minHeight = "";
      return;
    }
    var current = display.offsetHeight;
    var docHeight = document.documentElement.scrollHeight;
    var needed = scrollY + window.innerHeight - (docHeight - current);
    display.style.minHeight = needed > natural + 1 ? Math.ceil(needed) + "px" : "";
  }

  function lockDisplay() {
    display.style.minHeight = display.offsetHeight + "px";
  }

  // Put every record of every area in the state the view names (instantly).
  function applyRecordState(view) {
    records2g.all.forEach(function (item) {
      records2g.setState(item, item.view === view);
    });
  }

  // Open a record in the current area (deliberate or from history). Closes the area's other
  // open record first, keeping the clicked header where it was on screen.
  function openRecord(item, animate) {
    finishAll();
    var scrollY = window.scrollY;
    lockDisplay();
    var before = item.toggle.getBoundingClientRect().top;
    var shifted = false;
    records2g.inArea(item.area).forEach(function (other) {
      if (other !== item && records2g.isOpen(other)) {
        var above = !!(other.el.compareDocumentPosition(item.el) & Node.DOCUMENT_POSITION_FOLLOWING);
        records2g.close(other, false);
        shifted = shifted || above;
      }
    });
    if (shifted && scrollY > 0) {
      var moved = item.toggle.getBoundingClientRect().top - before;
      if (moved !== 0) {
        window.scrollTo(window.scrollX, Math.max(0, scrollY + moved)); // keep the clicked header in place
        scrollY = window.scrollY;
      }
    }
    // the display is re-fitted once the record has its final height (pinning depends on it)
    var gate = records2g.open(item, animate, function () { fitDisplay(window.scrollY); });
    if (gate) {
      // Stage A (expansion) runs now; Stage B (typing) waits for the gate.
      // A damaged archive (Stage 2H) adds its short interference stage between A and B.
      if (item.el.classList.contains("rec-kind-damaged")) {
        var token = actionToken;
        gate = gate.then(function () {
          return token === actionToken ? glitch.run(item) : null;
        });
      }
      typewriter.start([{ root: item.inner, host: item.body, gate: gate }]);
    }
  }

  function closeRecord(item, animate) {
    finishAll();
    var scrollY = window.scrollY;
    lockDisplay();
    records2g.close(item, animate, function () {
      fitDisplay(window.scrollY);
    });
    if (window.scrollY !== scrollY) {
      window.scrollTo(window.scrollX, scrollY); // safety net; should never be needed
    }
  }

  function render(route, announce, animate) {
    if (route === currentRoute) {
      return false;
    }
    finishAll(); // obsolete reveals and expansions are completed and restored before the swap
    var area = areaOf(route);

    // Same area, another record (history or a typed hash): only the records change.
    if (currentRoute !== null && areaOf(currentRoute) === area) {
      currentRoute = route;
      var target = records2g.byView(route);
      if (target) {
        openRecord(target, animate);
      } else {
        records2g.inArea(area).forEach(function (item) {
          if (records2g.isOpen(item)) {
            closeRecord(item, animate);
          }
        });
      }
      return true;
    }

    var scrollY = window.scrollY;
    lockDisplay();
    currentRoute = route;
    var record = recordFor(route);
    records.forEach(function (section) {
      section.hidden = section !== record;
    });
    applyRecordState(route);
    routes.forEach(function (link) {
      if (link.getAttribute("data-destination") === area) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    var own = areaIntro(route);
    var intro = own || GENERAL_INTRO;
    var speaks = false;
    if (dialogue && dialogue.textContent !== intro) {
      dialogue.textContent = intro;
      speaks = !!own;
    }

    fitDisplay(scrollY);
    if (window.scrollY !== scrollY) {
      window.scrollTo(window.scrollX, scrollY); // safety net; should never be needed
    }
    if (announce && live) {
      var heading = record && record.querySelector("h2");
      var said = speaks ? "Registrar: " + intro.replace(/\s*\n\s*/g, " ") + " " : "";
      live.textContent = said + (heading ? "Record: " + heading.textContent + "." : "");
    }
    if (animate && record) {
      typewriter.start([speaks ? { root: dialogue, host: messageBlock } : null, { root: record, host: record }]);
    }
    return true;
  }

  function track(eventName, details) {
    if (analytics && typeof analytics.trackEvent === "function") {
      analytics.trackEvent(eventName, details);
    }
  }

  function isPlainActivation(event) {
    return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
  }

  // Sidebar buttons: switch area in place, add one history entry, report one selection.
  routes.forEach(function (link) {
    var destination = link.getAttribute("data-destination");
    link.addEventListener("click", function (event) {
      if (!isPlainActivation(event)) {
        return; // new tab or window: let the browser handle it (not tracked)
      }
      event.preventDefault();
      if (currentRoute !== null && destination === areaOf(currentRoute)) {
        finishAll(); // selecting the current area again simply completes what is running
        return;
      }
      window.history.pushState({ route: destination }, "", urlFor(destination));
      render(destination, true, true);
      track("hub_destination_select", {
        destination: destination,
        button_id: "gateway_" + destination,
        node_id: destination,
        option_label: link.querySelector(".gateway-label").textContent,
        option_kind: "gateway"
      });
    });
  });

  // Record toggles: open or close in place; the URL names the open record (replaceState).
  records2g.all.forEach(function (item) {
    item.toggle.addEventListener("click", function () {
      var opening = !records2g.isOpen(item);
      if (opening) {
        currentRoute = item.view;
        openRecord(item, true);
      } else {
        currentRoute = item.area;
        closeRecord(item, true);
      }
      window.history.replaceState({ route: currentRoute }, "", urlFor(currentRoute));
      track("hub_destination_select", {
        destination: item.view,
        button_id: "toggle_" + item.area + "_" + item.slug,
        node_id: item.area,
        option_label: item.title,
        option_kind: opening ? "record_expand" : "record_collapse"
      });
    });
  });

  // Entering the original console from The Lab: a real page navigation, tracked once.
  Array.prototype.forEach.call(display.querySelectorAll("a[data-destination-link]"), function (link) {
    link.addEventListener("click", function (event) {
      if (!isPlainActivation(event)) {
        return;
      }
      var destination = link.getAttribute("data-destination-link");
      track("hub_destination_select", {
        destination: destination,
        button_id: "record_" + destination,
        node_id: currentRoute,
        option_kind: "record_link"
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-outbound]"), function (link) {
    link.addEventListener("click", function () {
      if (!link.getAttribute("href")) {
        return;
      }
      track("hub_outbound_click", {
        destination: link.href,
        button_id: "outbound_" + link.getAttribute("data-outbound"),
        node_id: currentRoute,
        option_kind: "external"
      });
    });
  });

  var skipLink = document.querySelector(".skip-link");
  if (skipLink) {
    skipLink.addEventListener("click", function (event) {
      event.preventDefault();
      display.focus();
    });
  }

  // Back/Forward and a typed hash: restore the view in place. Not tracked.
  function restoreFromUrl() {
    var route = routeFromHref(window.location.hash);
    if (route) {
      render(route, true, true);
    }
  }
  window.addEventListener("popstate", restoreFromUrl);
  window.addEventListener("hashchange", restoreFromUrl);

  window.addEventListener("scroll", function () {
    // while a record is still collapsing, keep the reserve: it is re-fitted when the record is at rest
    if (display.style.minHeight && !records2g.busy()) {
      fitDisplay(window.scrollY);
    }
  }, { passive: true });
  window.addEventListener("resize", function () {
    fitDisplay(window.scrollY);
  });

  // A click in the record display (links still work) reveals everything at once; record toggles
  // have their own handler. Escape does the same.
  display.addEventListener("click", function (event) {
    if (event.target && event.target.closest && event.target.closest(".rec-toggle")) {
      return;
    }
    finishAll();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      finishAll();
    }
  });

  // Page load, refresh and direct links show everything complete. An unknown record in a known
  // area falls back to that area; anything unknown falls back to the start record.
  var initial = routeFromHref(window.location.hash) || "start";
  render(initial, false, false);
  if (initial !== "start" && ("#" + initial) !== window.location.hash) {
    window.history.replaceState({ route: initial }, "", urlFor(initial)); // tidy an unsupported hash
  }
})();
