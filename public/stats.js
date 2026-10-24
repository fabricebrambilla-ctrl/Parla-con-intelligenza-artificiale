// Anonymous usage counting for the owner's /stats page: says "this device opened
// the site", with only the anonymous device ID. Conversations are counted on the
// server. It never changes the page and never waits for an answer.
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

  try {
    var id = anonId();
    if (id && navigator.sendBeacon) {
      navigator.sendBeacon("/api/stats/visit", new Blob([JSON.stringify({ id: id })], { type: "text/plain" }));
    }
  } catch (e) { /* statistics must never affect the site */ }
})();
