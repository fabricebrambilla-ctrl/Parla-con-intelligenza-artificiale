// Anonymous usage counting for the owner's /stats page. Sends only the
// anonymous device ID; it never changes the page and never waits for an answer.
(function () {
  "use strict";
  function anonId() {
    try {
      var id = localStorage.getItem("anonId");
      if (!id) {
        id = window.crypto && crypto.randomUUID ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
        localStorage.setItem("anonId", id);
      }
      return id;
    } catch (e) { return null; }
  }

  function send(kind) {
    try {
      var id = anonId();
      if (!id || !navigator.sendBeacon) return;
      navigator.sendBeacon("/api/stats/" + kind, new Blob([JSON.stringify({ id: id })], { type: "text/plain" }));
    } catch (e) { /* statistics must never affect the site */ }
  }

  send("visit");
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("button")) send("press");
  }, { capture: true, passive: true });
})();
