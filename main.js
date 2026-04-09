(function () {
  const welcomeScreen = document.getElementById("welcomeScreen");
  const terminalShell = document.getElementById("terminalShell");
  const dialoguePanel = document.getElementById("dialoguePanel");
  const albumEntryButton = document.getElementById("albumEntryButton");
  const enterTerminalButton = document.getElementById("enterTerminalButton");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const dialogueText = document.getElementById("dialogueText");
  const speakerLabel = document.getElementById("speakerLabel");
  const optionBlock = document.querySelector(".option-block");
  const optionsContainer = document.getElementById("optionsContainer");
  const analytics = window.TerminalCathedralAnalytics;

  const dialogueTree = window.REGISTRAR_DIALOGUE || REGISTRAR_DIALOGUE;
  const WELCOME_THEME_COLOR = "#0d0f10";
  const TERMINAL_THEME_COLOR = "#07090d";
  const REVEAL_MIN_DURATION_MS = 180;
  const REVEAL_MAX_DURATION_MS = 720;
  const REVEAL_CHARACTERS_PER_SECOND = 180;

  let currentNodeId = "start";
  let activeRenderToken = 0;
  let hasEnteredTerminal = false;
  const trackedNodeViews = new Set();
  const trackedPassageDepthMarkers = new Set();
  const PASSAGE_DEPTH_MARKERS = new Set([
    "passage_intro",
    "sequence_one",
    "sequence_two",
    "sequence_three",
    "sequence_four",
    "sequence_five",
    "track_15_signal",
    "loopback_notice"
  ]);

  function getNode(nodeId) {
    return dialogueTree[nodeId];
  }

  function getFirstExternalUrl(nodeId) {
    const node = getNode(nodeId);

    if (!node || !Array.isArray(node.options)) {
      return null;
    }

    const externalOption = node.options.find(function (option) {
      return Boolean(option.externalUrl);
    });

    return externalOption ? externalOption.externalUrl : null;
  }

  function getRevealDuration(text) {
    const computedDuration = Math.round(
      (text.length / REVEAL_CHARACTERS_PER_SECOND) * 1000
    );

    return Math.min(
      REVEAL_MAX_DURATION_MS,
      Math.max(REVEAL_MIN_DURATION_MS, computedDuration)
    );
  }

  function getNodeType(nodeId) {
    if (nodeId === "start") {
      return "start";
    }

    if (nodeId === "passage_intro") {
      return "passage";
    }

    if (nodeId === "loopback_notice") {
      return "loopback";
    }

    if (nodeId.indexOf("instruction_") === 0) {
      return "orientation";
    }

    if (nodeId.indexOf("album_") === 0) {
      return "album";
    }

    if (nodeId.indexOf("visual_") === 0) {
      return "visual";
    }

    if (nodeId.indexOf("sequence_") === 0) {
      return "sequence";
    }

    if (nodeId.indexOf("track_") === 0) {
      return "track";
    }

    if (nodeId.indexOf("disclosure_") === 0) {
      return "disclosure";
    }

    if (nodeId.indexOf("info_") === 0) {
      return "info";
    }

    return "";
  }

  function isBackNavigation(sourceNodeId, targetNodeId) {
    const sourceNodeType = getNodeType(sourceNodeId);

    if (targetNodeId === "start" && sourceNodeId !== "start") {
      return true;
    }

    if (
      targetNodeId === "passage_intro" &&
      ["track", "sequence", "loopback"].includes(sourceNodeType)
    ) {
      return true;
    }

    if (
      targetNodeId === "instruction_classify" &&
      ["orientation", "disclosure"].includes(sourceNodeType)
    ) {
      return true;
    }

    if (
      targetNodeId === "disclosure_classify" &&
      sourceNodeType === "disclosure"
    ) {
      return true;
    }

    return false;
  }

  function getOptionKind(option, sourceNodeId) {
    if (option.externalUrl) {
      return "external";
    }

    const sourceNodeType = getNodeType(sourceNodeId);
    const targetNodeType = getNodeType(option.next || "");

    if (isBackNavigation(sourceNodeId, option.next || "")) {
      return "back";
    }

    if (
      targetNodeType === "track" &&
      ["passage", "sequence", "track", "loopback"].includes(sourceNodeType)
    ) {
      return "track_nav";
    }

    if (
      targetNodeType === "sequence" &&
      ["passage", "sequence", "track", "loopback"].includes(sourceNodeType)
    ) {
      return "sequence_nav";
    }

    return "route";
  }

  function getTerminalEventDetails(nodeId) {
    return {
      node_id: nodeId,
      node_type: getNodeType(nodeId)
    };
  }

  function trackTerminalNodeView(nodeId) {
    if (!analytics || trackedNodeViews.has(nodeId)) {
      return;
    }

    trackedNodeViews.add(nodeId);
    analytics.trackEvent(
      "terminal_node_view",
      getTerminalEventDetails(nodeId)
    );
  }

  function trackPassageDepthReached(nodeId) {
    if (
      !analytics ||
      !PASSAGE_DEPTH_MARKERS.has(nodeId) ||
      trackedPassageDepthMarkers.has(nodeId)
    ) {
      return;
    }

    trackedPassageDepthMarkers.add(nodeId);
    analytics.trackEvent("passage_depth_reached", Object.assign(
      getTerminalEventDetails(nodeId),
      { depth_marker: nodeId }
    ));
  }

  function trackTerminalOption(option, sourceNodeId) {
    if (!analytics) {
      return;
    }

    const targetNodeId = option.next || "";
    const optionKind = getOptionKind(option, sourceNodeId);
    const eventDetails = Object.assign(
      getTerminalEventDetails(sourceNodeId),
      {
        source_node_id: sourceNodeId,
        target_node_id: targetNodeId,
        option_label: option.label || "",
        option_kind: optionKind
      }
    );

    if (option.externalUrl) {
      analytics.trackEvent("terminal_outbound_click", Object.assign(
        eventDetails,
        { destination: option.externalUrl }
      ));
      return;
    }

    if (targetNodeId && targetNodeId !== sourceNodeId) {
      analytics.trackEvent("terminal_route_select", eventDetails);
    }
  }

  function applyVisualTone(isTerminalActive) {
    document.body.classList.toggle("is-terminal-active", isTerminalActive);

    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        isTerminalActive ? TERMINAL_THEME_COLOR : WELCOME_THEME_COLOR
      );
    }
  }

  function setOptionsReady(isReady) {
    optionBlock.hidden = !isReady;
    optionsContainer.setAttribute("aria-hidden", String(!isReady));
  }

  function revealDialogueText(text, renderToken, onComplete) {
    const revealDuration = getRevealDuration(text);
    const startTime = performance.now();
    dialogueText.textContent = "";
    dialogueText.classList.add("is-rendering");

    function step(frameTime) {
      if (renderToken !== activeRenderToken) {
        return;
      }

      const elapsed = frameTime - startTime;
      const progress = Math.min(1, elapsed / revealDuration);
      const visibleCharacters = Math.max(
        1,
        Math.ceil(text.length * progress)
      );

      dialogueText.textContent = text.slice(0, visibleCharacters);

      if (progress < 1) {
        window.requestAnimationFrame(step);
        return;
      }

      dialogueText.textContent = text;
      dialogueText.classList.remove("is-rendering");
      onComplete();
    }

    window.requestAnimationFrame(step);
  }

  function createOptionButton(option) {
    const button = document.createElement("button");
    const accessibleParts = [option.label];
    button.type = "button";
    if (option.description) {
      const label = document.createElement("span");
      const description = document.createElement("span");
      label.className = "option-label";
      label.textContent = option.label;
      description.className = "option-description";
      description.textContent = option.description;
      button.append(label, description);
      accessibleParts.push(option.description);
    } else {
      button.textContent = option.label;
    }
    if (option.externalUrl) {
      button.classList.add("external-option");
      button.setAttribute("data-external-url", option.externalUrl);
      accessibleParts.push("opens in a new tab");
    }
    button.setAttribute("aria-label", accessibleParts.join(". "));
    button.addEventListener("click", function () {
      const sourceNodeId = currentNodeId;
      trackTerminalOption(option, sourceNodeId);

      if (option.externalUrl) {
        window.open(option.externalUrl, "_blank", "noopener,noreferrer");
      }

      if (option.next && option.next !== sourceNodeId) {
        renderNode(option.next);
      }
    });

    return button;
  }

  function getVisibleOptions(options) {
    return options.filter(function (option) {
      return !option.hiddenFromUi;
    });
  }

  function enterTerminal() {
    if (!welcomeScreen || !terminalShell) {
      return;
    }

    welcomeScreen.hidden = true;
    terminalShell.hidden = false;
    applyVisualTone(true);

    if (!hasEnteredTerminal) {
      hasEnteredTerminal = true;
      renderNode(currentNodeId);
    }

    window.requestAnimationFrame(function () {
      if (dialoguePanel) {
        dialoguePanel.focus();
      }
    });
  }

  function renderNode(nodeId) {
    const node = getNode(nodeId);
    const renderToken = ++activeRenderToken;

    if (!node) {
      dialogueText.classList.remove("is-rendering");
      dialogueText.textContent =
        "Routing error. Requested record could not be resolved.";
      speakerLabel.textContent = "System";
      setOptionsReady(true);
      optionsContainer.replaceChildren(createOptionButton({
        label: "Return to intake opening.",
        next: "start"
      }));
      currentNodeId = "start";
      return;
    }

    currentNodeId = node.id;
    speakerLabel.textContent = node.speaker;
    setOptionsReady(false);
    optionsContainer.replaceChildren();

    revealDialogueText(node.text, renderToken, function () {
      if (renderToken !== activeRenderToken) {
        return;
      }

      const optionButtons = getVisibleOptions(node.options).map(createOptionButton);
      optionsContainer.replaceChildren(...optionButtons);
      setOptionsReady(true);
      trackTerminalNodeView(node.id);
      trackPassageDepthReached(node.id);
    });
  }

  if (albumEntryButton) {
    const albumUrl = getFirstExternalUrl("album_route");

    if (albumUrl) {
      albumEntryButton.href = albumUrl;
    }

    albumEntryButton.addEventListener("click", function () {
      if (!analytics) {
        return;
      }

      analytics.trackEvent("album_zero_click", {
        destination: albumEntryButton.href || albumUrl || "",
        button_id: "albumEntryButton"
      });
    });
  }

  if (enterTerminalButton) {
    applyVisualTone(false);
    enterTerminalButton.addEventListener("click", function () {
      if (analytics) {
        analytics.trackEvent("registrar_terminal_click", {
          destination: "registrar_terminal",
          button_id: "enterTerminalButton"
        });
      }

      enterTerminal();
    });
  } else {
    applyVisualTone(true);
    renderNode(currentNodeId);
  }
})();
