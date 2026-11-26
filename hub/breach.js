/*
 * Stage 3K (HUMAN-approved placement): the header's overlooked local script.
 * [ RUN ] opens an in-universe confirmation dialog; only EXECUTE goes to the game (archive-probe/).
 * This file loads nothing of the game. Without JavaScript, or without <dialog> support, the trigger stays hidden
 * and the page is unchanged. No storage, no network, no analytics.
 */
(function () {
  "use strict";
  var run = document.getElementById("breach-run");
  var dialog = document.getElementById("breach-dialog");
  var cancel = document.getElementById("breach-cancel");
  if (!run || !dialog || !cancel || typeof dialog.showModal !== "function") {
    return;
  }
  run.hidden = false;

  run.addEventListener("click", function () {
    if (dialog.open) {
      return;
    }
    dialog.showModal();
    cancel.focus(); // the safe choice first
  });
  cancel.addEventListener("click", function () {
    dialog.close();
  });
  // a click or tap on the dimmed backdrop (the dialog element itself, outside its content) cancels as well
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });
  // Escape (the browser's own cancel), CANCEL and the backdrop all end here: focus goes back to the trigger
  dialog.addEventListener("close", function () {
    run.focus();
  });
})();
