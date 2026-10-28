(function () {
  "use strict";
  var root = document.documentElement, KEY = "bsp-theme";
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {}
  function effective() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function init() {
    var b = document.getElementById("theme-toggle");
    if (!b) return;
    function sync() {
      var dark = effective() === "dark";
      b.lastChild.textContent = dark ? "Mode terang" : "Mode gelap";
      b.setAttribute("aria-pressed", dark ? "true" : "false");
    }
    b.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      sync();
    });
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync); } catch (e) {}
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
