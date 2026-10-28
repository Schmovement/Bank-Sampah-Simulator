(function () {
  var $ = function (id) { return document.getElementById(id); };
  /* ---------- calculator ---------- */
  var WASTE = [
    { id: "pet", n: "Botol plastik PET", p: 3500, v: 0.5 },
    { id: "cup", n: "Gelas plastik", p: 2500, v: 0.3 },
    { id: "box", n: "Kardus", p: 1800, v: 1 },
    { id: "pap", n: "Kertas HVS dan buku", p: 1500, v: 0.8 },
    { id: "can", n: "Kaleng aluminium", p: 10000, v: 0.2 }
  ];
  var fmt = new Intl.NumberFormat("id-ID");
  var rp = function (n) { return "Rp " + fmt.format(Math.round(n)); };
  var rowsEl = $("rows");
  WASTE.forEach(function (w) {
    var r = document.createElement("div"); r.className = "row";
    var l = document.createElement("label"); l.setAttribute("for", "w-" + w.id); l.textContent = w.n;
    var pr = document.createElement("span"); pr.className = "price"; pr.textContent = "contoh " + rp(w.p) + " per kg"; l.appendChild(pr);
    var inp = document.createElement("input"); inp.type = "number"; inp.className = "num"; inp.id = "w-" + w.id; inp.min = "0"; inp.max = "100"; inp.step = "0.1"; inp.value = String(w.v); inp.inputMode = "decimal";
    inp.setAttribute("aria-label", w.n + " dalam kilogram");
    var sub = document.createElement("div"); sub.className = "sub"; sub.id = "s-" + w.id;
    r.appendChild(l); r.appendChild(inp); r.appendChild(sub); rowsEl.appendChild(r);
    inp.addEventListener("input", calc);
  });
  function calc() {
    var total = 0, kg = 0;
    WASTE.forEach(function (w) {
      var v = parseFloat($("w-" + w.id).value); if (!isFinite(v) || v < 0) v = 0;
      var s = v * w.p; total += s; kg += v; $("s-" + w.id).textContent = rp(s);
    });
    $("c-week").textContent = rp(total);
    $("c-sem").textContent = rp(total * 16);
    $("c-kg").textContent = (Math.round(kg * 10) / 10).toString().replace(".", ",");
  }
  calc();
})();
