/* Jalur tahapan di header dan warna layar. Hanya membaca layar mana yang sedang tampil (atribut hidden
   yang diatur app.js), tidak mengubah alur, data, atau tombol apa pun. */
(function () {
  "use strict";
  var IDS = ["s0", "s1", "s2", "sinfo", "s3"];
  var AT = { s0: 0, s1: 1, s2: 2, sinfo: 3, s3: 4 };
  var route = document.getElementById("route");
  if (!route) return;
  var stops = route.querySelectorAll(".stop");
  function sync() {
    var cur = "s0";
    IDS.forEach(function (id) { var e = document.getElementById(id); if (e && !e.hidden) cur = id; });
    var at = AT[cur], pd = document.getElementById("post-done");
    if (cur === "s3" && pd && !pd.hidden) at = 5; // post-task selesai: semua tahap sudah dilewati
    document.body.setAttribute("data-screen", cur);
    route.hidden = at === 0;
    Array.prototype.forEach.call(stops, function (li) {
      var i = parseInt(li.getAttribute("data-i"), 10);
      li.classList.toggle("done", i < at);
      li.classList.toggle("on", i === at);
      if (i === at) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
    });
  }
  if (window.MutationObserver) {
    var mo = new MutationObserver(sync);
    IDS.concat(["post-done"]).forEach(function (id) {
      var e = document.getElementById(id);
      if (e) mo.observe(e, { attributes: true, attributeFilter: ["hidden"] });
    });
  }
  sync();
})();
