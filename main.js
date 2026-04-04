(function () {
  const welcomeScreen = document.getElementById("welcomeScreen");
  const terminalShell = document.getElementById("terminalShell");
  const dialoguePanel = document.getElementById("dialoguePanel");
  const albumEntryButton = document.getElementById("albumEntryButton");
  const enterTerminalButton = document.getElementById("enterTerminalButton");
  const dialogueText = document.getElementById("dialogueText");
  const speakerLabel = document.getElementById("speakerLabel");
  const optionBlock = document.querySelector(".option-block");
  const optionsContainer = document.getElementById("optionsContainer");

  const dialogueTree = window.REGISTRAR_DIALOGUE || REGISTRAR_DIALOGUE;
  const REVEAL_MIN_DURATION_MS = 180;
  const REVEAL_MAX_DURATION_MS = 720;
  const REVEAL_CHARACTERS_PER_SECOND = 180;

  let currentNodeId = "start";
  let activeRenderToken = 0;
  let hasEnteredTerminal = false;

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
    button.type = "button";
    button.textContent = option.label;
    if (option.externalUrl) {
      button.classList.add("external-option");
      button.setAttribute("data-external-url", option.externalUrl);
      button.setAttribute("aria-label", option.label + " (opens in a new tab)");
    }
    button.addEventListener("click", function () {
      if (option.externalUrl) {
        window.open(option.externalUrl, "_blank", "noopener,noreferrer");
      }

      if (option.next && option.next !== currentNodeId) {
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
    });
  }

  if (albumEntryButton) {
    const albumUrl = getFirstExternalUrl("album_route");

    if (albumUrl) {
      albumEntryButton.href = albumUrl;
    }
  }

  if (enterTerminalButton) {
    enterTerminalButton.addEventListener("click", enterTerminal);
  } else {
    renderNode(currentNodeId);
  }
})();
