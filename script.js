(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CATS = { org: "Organik", an: "Anorganik", res: "Residu", b3: "B3" };
  var ITEMS = [
    { n: "Sisa nasi dan lauk", h: "Dari kantin", c: "org", t: "Sisa makanan basah mudah membusuk, jadi masuk organik dan bisa dikomposkan." },
    { n: "Kulit pisang", h: "Sisa buah", c: "org", t: "Kulit buah termasuk organik dan terurai menjadi kompos." },
    { n: "Botol air mineral", h: "Plastik PET, sudah kosong", c: "an", t: "Botol PET bersih punya nilai jual. Bilas dulu dan lepas tutup serta labelnya." },
    { n: "Kardus paket", h: "Bekas bungkus belanja online", c: "an", t: "Kardus kering dan bersih bisa disetor. Lipat supaya hemat tempat." },
    { n: "Kertas fotokopi bekas", h: "Tugas atau catatan lama", c: "an", t: "Kertas bersih yang kering termasuk anorganik dan laku didaur ulang." },
    { n: "Kaleng minuman", h: "Aluminium", c: "an", t: "Kaleng aluminium termasuk yang bernilai tinggi. Kosongkan dan remukkan." },
    { n: "Gelas plastik kopi", h: "Sudah dibilas", c: "an", t: "Gelas plastik yang sudah dibilas bisa disetor. Yang masih berisi sisa minuman sebaiknya dibilas dulu." },
    { n: "Baterai bekas", h: "Dari remote atau mouse", c: "b3", t: "Baterai mengandung bahan berbahaya. Kumpulkan terpisah di tempat khusus B3." },
    { n: "Lampu neon rusak", h: "Dari kos atau ruang kelas", c: "b3", t: "Lampu mengandung merkuri, jadi termasuk B3. Jangan dipecahkan atau dibuang bersama sampah biasa." },
    { n: "Tisu bekas pakai", h: "Kotor dan lembap", c: "res", t: "Tisu bekas sudah kotor dan tidak bisa didaur ulang, jadi masuk residu." },
    { n: "Kemasan sachet camilan", h: "Plastik berlapis", c: "res", t: "Kemasan berlapis sulit didaur ulang sehingga masuk residu. Kurangi dengan membeli ukuran besar." },
    { n: "Kotak makan styrofoam", h: "Bekas makanan", c: "res", t: "Styrofoam berminyak sulit didaur ulang. Lebih baik bawa wadah makan sendiri." }
  ];

  /* ---------- sorting game ---------- */
  var order, idx, score, answered;
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function bins() { return Array.prototype.slice.call(document.querySelectorAll("#g-bins .bin")); }
  function startGame() {
    order = shuffle(ITEMS); idx = 0; score = 0;
    $("g-result").hidden = true; $("g-play").hidden = false;
    showItem();
  }
  function showItem() {
    answered = false;
    var it = order[idx];
    $("g-name").textContent = it.n; $("g-hint").textContent = it.h;
    $("g-count").textContent = "Sampah " + (idx + 1) + " dari " + order.length;
    $("g-score").textContent = "Benar: " + score;
    $("g-bar").style.width = (idx / order.length * 100) + "%";
    $("g-fb").textContent = "Pilih salah satu tempat sampah di atas.";
    $("g-next").disabled = true;
    $("g-next").textContent = idx === order.length - 1 ? "Lihat hasil" : "Sampah berikutnya";
    bins().forEach(function (b) { b.disabled = false; b.classList.remove("right", "picked-wrong"); });
  }
  function pick(c) {
    if (answered) return;
    answered = true;
    var it = order[idx], ok = c === it.c;
    if (ok) score++;
    $("g-score").textContent = "Benar: " + score;
    bins().forEach(function (b) {
      var bc = b.getAttribute("data-c");
      if (bc === it.c) { b.classList.add("right"); b.style.opacity = 1; }
      else if (bc === c) { b.classList.add("picked-wrong"); }
      b.disabled = true;
    });
    var fb = $("g-fb"); fb.textContent = "";
    var s = document.createElement("b"); s.className = ok ? "ok" : "no";
    s.textContent = ok ? "Tepat. " : "Kurang tepat. Jawabannya " + CATS[it.c] + ". ";
    fb.appendChild(s); fb.appendChild(document.createTextNode(it.t));
    $("g-next").disabled = false; $("g-next").focus();
  }
  function next() {
    if (idx < order.length - 1) { idx++; showItem(); return; }
    $("g-bar").style.width = "100%";
    $("g-play").hidden = true; $("g-result").hidden = false;
    $("r-score").textContent = score + " / " + order.length;
    var m = score >= 11 ? "Hampir sempurna. Kamu siap mengajak teman memilah." : score >= 8 ? "Sudah bagus. Baca lagi penjelasan pada jawaban yang salah untuk menyempurnakannya." : "Masih tahap awal, dan itu wajar. Ulangi latihan sambil membaca penjelasannya.";
    $("r-msg").textContent = m;
    var best = score;
    try { var prev = parseInt(localStorage.getItem("bsp-best") || "0", 10); if (prev > best) best = prev; localStorage.setItem("bsp-best", String(best)); } catch (e) {}
    $("r-best").textContent = "Skor terbaikmu di perangkat ini: " + best + " / " + order.length;
  }
  bins().forEach(function (b) { b.addEventListener("click", function () { pick(b.getAttribute("data-c")); }); });
  $("g-next").addEventListener("click", next);
  $("g-again").addEventListener("click", startGame);
  startGame();

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
