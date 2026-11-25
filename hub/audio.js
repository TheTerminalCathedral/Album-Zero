// Stage 3J: the audio players are plain HTML5 players. This only keeps them tidy on the homepage: one plays at a time, and
// audio pauses when its record or category is hidden. Nothing is measured, stored or sent.
(function () {
  "use strict";
  var players = Array.prototype.slice.call(document.querySelectorAll("audio.media-audio"));
  players.forEach(function (player) {
    player.addEventListener("play", function () {
      players.forEach(function (other) {
        if (other !== player) {
          other.pause();
        }
      });
    });
  });
  if (!players.length || !window.MutationObserver) {
    return;
  }
  new MutationObserver(function () {
    players.forEach(function (player) {
      if (!player.paused && player.closest("[hidden]")) {
        player.pause();
      }
    });
  }).observe(document.body, { attributes: true, attributeFilter: ["hidden"], subtree: true });
})();
