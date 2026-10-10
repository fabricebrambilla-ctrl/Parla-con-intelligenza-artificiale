(function () {
  "use strict";
  var I = window.I18N;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) {} }

  var lang = I.pick(get("lang") ? [get("lang")] : navigator.languages || [navigator.language]);
  I.applyPage(lang);

  var history = [];
  try { history = JSON.parse(get("history") || "[]"); } catch (e) {}

  var list = document.getElementById("list");

  function render() {
    list.textContent = "";
    if (!history.length) {
      var p = document.createElement("p");
      p.textContent = I.t(lang, "historyEmpty");
      list.appendChild(p);
      return;
    }
    history.forEach(function (h) {
      var h2 = document.createElement("h2");
      var date = new Date(h.date);
      var when = isNaN(date) ? "" : date.toLocaleDateString(I.META[lang].html, { year: "numeric", month: "long", day: "numeric" });
      h2.textContent = when + (h.topic ? " – " + h.topic : "");
      var p = document.createElement("p");
      p.textContent = h.summary || "";
      list.appendChild(h2);
      list.appendChild(p);
    });
  }

  render();

  document.getElementById("deleteAll").addEventListener("click", function () {
    del("history");
    history = [];
    render();
    var alert = document.getElementById("alert");
    alert.textContent = "";
    setTimeout(function () { alert.textContent = I.t(lang, "deleted"); }, 100);
  });
})();
