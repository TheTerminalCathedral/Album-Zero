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
  // a click or tap on the dimmed backdrop, outside the box, cancels as well (not one on the box's own padding)
  dialog.addEventListener("click", function (event) {
    var r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) {
      dialog.close();
    }
  });
  // Escape belongs to the dialog while it is open: the browser still closes it, but the page's own Escape handler
  // (hub.js: finish the typing at once) does not also run behind it
  dialog.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      event.stopPropagation();
    }
  });
  // Back after EXECUTE may restore this page from the back/forward cache: show it without the dialog
  window.addEventListener("pageshow", function (event) {
    if (event.persisted && dialog.open) {
      dialog.close();
    }
  });
  // Escape (the browser's own cancel), CANCEL and the backdrop all end here: focus goes back to the trigger
  dialog.addEventListener("close", function () {
    run.focus();
  });
})();
