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

  /* ---------- quiz ---------- */
  var QS = [
    { q: "Apa yang sebaiknya dilakukan pada botol plastik sebelum disetor?", o: ["Dibilas dan dikeringkan", "Dibiarkan ada sisa minuman", "Dicampur dengan sisa makanan"], a: 0, t: "Sampah yang bersih dan kering lebih mudah didaur ulang dan lebih bernilai." },
    { q: "SDG nomor berapa yang membahas konsumsi dan produksi yang bertanggung jawab?", o: ["SDG 6", "SDG 12", "SDG 16"], a: 1, t: "SDG 12 menargetkan pengurangan timbulan sampah lewat pencegahan, pengurangan, daur ulang, dan penggunaan kembali." },
    { q: "Apa arti kewargaan ekologis?", o: ["Hanya patuh pada aturan kebersihan", "Menjalankan tanggung jawab sebagai warga untuk menjaga lingkungan", "Menyerahkan urusan sampah kepada petugas"], a: 1, t: "Kewargaan ekologis menekankan kewajiban moral dan peran aktif warga dalam menjaga keberlanjutan lingkungan." },
    { q: "Mana langkah yang paling awal dalam mengelola sampah?", o: ["Mendaur ulang", "Mengurangi sampah sejak awal", "Menimbun di tempat pembuangan"], a: 1, t: "Mengurangi sampah dari sumbernya lebih baik daripada mendaur ulang sampah yang sudah terlanjur dibuat." }
  ];
  var qEl = $("quiz"), answeredQ = 0, rightQ = 0;
  QS.forEach(function (it, qi) {
    var box = document.createElement("div"); box.className = "q";
    var h = document.createElement("h3"); h.textContent = (qi + 1) + ". " + it.q; box.appendChild(h);
    var opts = document.createElement("div"); opts.className = "opts"; box.appendChild(opts);
    var why = document.createElement("p"); why.className = "why-text"; why.setAttribute("aria-live", "polite"); box.appendChild(why);
    var btns = [];
    it.o.forEach(function (txt, oi) {
      var b = document.createElement("button"); b.className = "opt"; b.type = "button"; b.textContent = txt; btns.push(b);
      b.addEventListener("click", function () {
        btns.forEach(function (x, xi) { x.disabled = true; if (xi === it.a) x.classList.add("right"); });
        if (oi !== it.a) b.classList.add("wrong"); else rightQ++;
        why.textContent = (oi === it.a ? "Benar. " : "Belum tepat. ") + it.t;
        answeredQ++;
        if (answeredQ === QS.length) $("quiz-score").textContent = "Skor kuis: " + rightQ + " dari " + QS.length + ".";
      });
      opts.appendChild(b);
    });
    qEl.appendChild(box);
  });
})();
