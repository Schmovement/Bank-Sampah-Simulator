(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "sim-guest";
  var STEP = "sim-step";   // "info" = peserta sudah lanjut dari latihan memilah ke info daur ulang
  var SCREENS = ["s0", "s1", "s2", "sinfo", "s3"];
  var socket = io();

  /* identitas guest: User ID acak dibuat di browser, disimpan supaya refresh tidak membuat dokumen baru */
  function randId() {
    var a = new Uint8Array(12);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }
  var guest = null;
  try { guest = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!guest || !guest.uid || !guest.nama) guest = null;

  var phase = "simulator", hasPre = false, hasPost = false;
  var quiz = null;          // pertanyaan dan pilihan dari server (tanpa kunci jawaban)
  var pilah = null, pilahTried = false;
  var current = null;
  function getStep() { try { return localStorage.getItem(STEP); } catch (e) { return null; } }
  function setStep(v) { try { if (v) localStorage.setItem(STEP, v); else localStorage.removeItem(STEP); } catch (e) { } }
  var playStart = null;     // waktu sentuhan pertama pada permainan yang sedang berjalan

  /* ---------- kuis (dipakai pre-task dan post-task, desain sama dengan kuis di situs) ---------- */
  function makeQuiz(boxId, countId, errId) {
    var Q = { picks: [], cards: [] };
    Q.answered = function () { return Q.picks.filter(function (p) { return p >= 0; }).length; };
    Q.update = function () { $(countId).textContent = "Terjawab " + Q.answered() + " dari " + quiz.length; };
    Q.complete = function () { return !!quiz && Q.picks.length === quiz.length && Q.answered() === quiz.length; };
    Q.render = function () {
      var box = $(boxId);
      box.textContent = "";
      Q.picks = quiz.map(function () { return -1; });
      Q.cards = [];
      quiz.forEach(function (it, qi) {
        var card = document.createElement("div"); card.className = "q";
        var h = document.createElement("h3"); h.textContent = (qi + 1) + ". " + it.q; card.appendChild(h);
        var opts = document.createElement("div"); opts.className = "opts"; opts.setAttribute("role", "group");
        opts.setAttribute("aria-label", "Pilihan jawaban pertanyaan " + (qi + 1));
        var why = document.createElement("p"); why.className = "why-text"; why.setAttribute("aria-live", "polite");
        var btns = [];
        it.o.forEach(function (txt, oi) {
          var b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = txt;
          b.setAttribute("aria-pressed", "false");
          b.addEventListener("click", function () {
            Q.picks[qi] = oi;
            $(errId).textContent = "";
            btns.forEach(function (x, xi) {
              x.classList.toggle("picked", xi === oi);
              x.setAttribute("aria-pressed", xi === oi ? "true" : "false");
            });
            Q.update();
          });
          btns.push(b); opts.appendChild(b);
        });
        card.appendChild(opts); card.appendChild(why); box.appendChild(card);
        Q.cards.push({ btns: btns, why: why });
      });
      Q.update();
    };
    Q.clear = function () { $(boxId).textContent = ""; $(countId).textContent = ""; Q.picks = []; Q.cards = []; };
    return Q;
  }
  var pre = makeQuiz("quiz-pre", "pre-count", "err1");
  var post = makeQuiz("quiz-post", "post-count", "err3");

  function ensureQuiz() {
    if (!quiz) return;
    if (!pre.cards.length) pre.render();
    if (!post.cards.length) post.render();
  }

  function fmtMs(ms) {
    if (ms == null) return "-";
    var d = ms / 1000;
    if (d < 60) return d.toFixed(1).replace(".", ",") + " dtk";
    return Math.floor(d / 60) + " mnt " + Math.round(d % 60) + " dtk";
  }

  /* hasil setelah post-task: skor pre, skor post, skor terbaik latihan memilah,
     lalu tandai jawaban benar dan salah beserta penjelasan dan jawaban pre-task di tiap soal */
  function showResult(r) {
    $("post-done").hidden = false;
    $("post-actions").hidden = true;
    $("post-intro").textContent = "Post-task selesai.";
    $("err3").textContent = "";
    if (!r) { $("res-grid").hidden = true; $("res-note").textContent = ""; $("res-top").hidden = true; return; }
    $("res-grid").hidden = false;
    $("res-pre").textContent = r.preSkor == null ? "-" : r.preSkor + " / " + r.total;
    $("res-post").textContent = r.skor + " / " + r.total;
    $("res-game").textContent = r.game ? r.game.best + " / " + r.game.total : "Belum main";
    if (r.preSkor == null) { $("res-note").textContent = ""; }
    else {
      var d = r.skor - r.preSkor;
      $("res-note").textContent = d > 0 ? "Skor post-task naik " + d + " poin dibanding pre-task."
        : d === 0 ? "Skor post-task sama dengan pre-task."
          : "Skor post-task turun " + (-d) + " poin dibanding pre-task.";
    }
    var t = r.top;
    $("res-top").hidden = !t;
    if (t) {
      var ol = $("res-top-list"); ol.textContent = "";
      t.list.forEach(function (row) {
        var li = document.createElement("li"); if (row.me) li.className = "me";
        var rk = document.createElement("span"); rk.className = "rk"; rk.textContent = "#" + row.rank;
        var nm = document.createElement("span"); nm.className = "nm"; nm.textContent = row.nama + (row.me ? " (kamu)" : "");
        var sc = document.createElement("span"); sc.className = "sc"; sc.textContent = row.skor + " / " + row.total + " \u00b7 " + fmtMs(row.ms);
        li.appendChild(rk); li.appendChild(nm); li.appendChild(sc); ol.appendChild(li);
      });
      var note = "Dihitung dari permainan pertama. Skor sama dipecah waktu tercepat.";
      if (t.myRank && t.myRank > 3) note += " Peringkatmu: #" + t.myRank + " dari " + t.count + " peserta.";
      else if (!t.myRank && r.game && r.game.first != null) note += " Permainan pertamamu: " + r.game.first + " / " + r.game.total + ".";
      $("res-top-score").textContent = note;
    }
    r.review.forEach(function (rv, i) {
      var c = post.cards[i]; if (!c) return;
      c.btns.forEach(function (b, bi) {
        b.disabled = true;
        b.classList.remove("picked");
        b.setAttribute("aria-pressed", bi === rv.picked ? "true" : "false");
        if (bi === rv.a) b.classList.add("right");
        if (bi === rv.picked && rv.picked !== rv.a) b.classList.add("wrong");
      });
      c.why.textContent = "";
      c.why.appendChild(document.createTextNode((rv.picked === rv.a ? "Benar. " : "Belum tepat. ") + rv.t));
      if (quiz && quiz[i] && rv.prePicked >= 0 && quiz[i].o[rv.prePicked] !== undefined) {
        c.why.appendChild(document.createElement("br"));
        c.why.appendChild(document.createTextNode("Jawaban pre-task: " + quiz[i].o[rv.prePicked] + (rv.prePicked === rv.a ? " (tepat)" : " (belum tepat)")));
      }
    });
  }

  /* ---------- layar ---------- */
  function show(id) {
    SCREENS.forEach(function (x) { $(x).hidden = x !== id; });
    if (current !== id) { current = id; window.scrollTo(0, 0); }
    // adegan 3D dibuat sekali, saat layar latihan pertama kali tampil (ukuran kanvas baru bisa dibaca saat terlihat)
    if (id === "sinfo") { $("i-wait").hidden = hasPost; $("i-result").hidden = !hasPost; }
    if (id === "s2" && !pilahTried && window.initPilah) {
      pilahTried = true;
      try { pilah = window.initPilah(); } catch (e) { console.error("3D:", e); }
    }
  }
  function route() {
    if (!guest) return show("s0");
    if (!hasPre) return show("s1");
    if (phase === "post") return show("s3");
    // urutan: pre-task, latihan memilah (s2), info daur ulang (sinfo), post-task (s3, dibuka admin)
    // yang sudah post-task ikut balik ke simulasi saat admin mengembalikan fase
    show(getStep() === "info" ? "sinfo" : "s2");
  }

  /* kirim event dengan ack + timeout; aman dikirim ulang karena server menolak duplikat */
  function send(ev, payload, btn, errEl, onOk) {
    errEl.textContent = "";
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = "Menyimpan...";
    socket.timeout(8000).emit(ev, payload, function (err, res) {
      btn.disabled = false; btn.textContent = old;
      if (err || !res) { errEl.textContent = "Koneksi bermasalah. Tekan Kirim jawaban lagi."; return; }
      if (res.reset) { resetLocal(); return; }
      if (!res.ok) { errEl.textContent = res.error || "Gagal menyimpan."; return; }
      onOk(res);
    });
  }

  /* sesi di-reset admin: hapus identitas lokal dan kembali ke layar nama */
  function resetLocal() {
    try { localStorage.removeItem(KEY); localStorage.removeItem("bsp-best"); } catch (e) { }
    setStep(null);
    guest = null; phase = "simulator"; hasPre = false; hasPost = false; quiz = null; playStart = null;
    $("f-gate").reset();
    pre.clear(); post.clear();
    $("post-done").hidden = true; $("post-actions").hidden = false;
    $("post-intro").textContent = "Jawab 4 pertanyaan yang sama seperti di awal. Pilih satu jawaban untuk tiap pertanyaan. Jawaban tidak bisa diubah setelah dikirim.";
    $("err1").textContent = ""; $("err3").textContent = "";
    $("err0").textContent = "Sesi dimulai ulang oleh admin. Masukkan namamu lagi.";
    if (pilah) pilah.restart();
    show("s0");
  }

  function join() {
    if (!guest) return;
    socket.emit("user:join", { uid: guest.uid, nama: guest.nama, sid: guest.sid }, function (res) {
      if (res && res.reset) { resetLocal(); return; }
      if (!res || !res.ok) { $("err0").textContent = (res && res.error) || "Gagal masuk sesi."; show("s0"); return; }
      if (res.sid && guest.sid !== res.sid) {
        guest.sid = res.sid;
        try { localStorage.setItem(KEY, JSON.stringify(guest)); } catch (e) { }
      }
      phase = res.phase; hasPre = res.hasPre; hasPost = res.hasPost;
      if (res.quiz && !quiz) quiz = res.quiz;
      ensureQuiz();
      if (hasPost) showResult(res.result);
      route();
    });
  }

  socket.on("connect", function () { $("conn").textContent = "Terhubung"; $("conn").classList.remove("off"); join(); });
  socket.on("disconnect", function () { $("conn").textContent = "Menyambung ulang..."; $("conn").classList.add("off"); });
  socket.on("phase:change", function (p) { // perintah force redirect dari admin
    phase = p;
    route();
    if (p === "post" && hasPost) join(); // yang sudah post-task: ambil ulang hasil supaya leaderboard terbaru
  });

  socket.on("goto:info", function () {
    if (guest && hasPost) show("sinfo");
  });

  socket.on("session:reset", resetLocal); // admin menekan clear memory

  /* waktu satu permainan: dari sentuhan/klik pertama di area game sampai selesai */
  function markStart() { if (playStart === null) playStart = Date.now(); }
  $("game").addEventListener("pointerdown", markStart, true);
  $("game").addEventListener("click", markStart, true); // keyboard

  /* skor + waktu latihan memilah dikirim ke server tiap selesai main (leaderboard hanya memakai permainan pertama) */
  window.addEventListener("pilah:finish", function (e) {
    if (!guest || !e.detail) return;
    var payload = { skor: e.detail.skor, total: e.detail.total };
    if (playStart !== null) payload.ms = Math.round(Date.now() - playStart);
    playStart = null;
    socket.timeout(8000).emit("game:score", payload, function (err, res) {
      if (!err && res && res.reset) resetLocal();
    });
  });

  /* Layar 0: nama */
  $("f-gate").addEventListener("submit", function (e) {
    e.preventDefault();
    var nama = $("nama").value.trim();
    if (nama.length < 2) { $("err0").textContent = "Nama minimal 2 karakter."; return; }
    try { localStorage.removeItem("bsp-best"); } catch (er) { } // skor terbaik milik peserta sebelumnya di perangkat ini
    setStep(null);
    guest = { uid: randId(), nama: nama };
    try { localStorage.setItem(KEY, JSON.stringify(guest)); } catch (er) { }
    $("err0").textContent = "";
    if (socket.connected) join(); // kalau belum tersambung, handler "connect" yang memanggil join()
  });

  /* perpindahan latihan memilah <-> info daur ulang */
  $("g-next").addEventListener("click", function () { setStep("info"); route(); });
  $("i-back").addEventListener("click", function () { setStep(null); route(); });
  $("i-res").addEventListener("click", function () { show("s3"); });

  /* Layar 1: pre-task */
  $("f-pre").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!pre.complete()) { $("err1").textContent = "Jawab semua pertanyaan dulu."; return; }
    send("pre:submit", { jawaban: pre.picks }, $("b-pre"), $("err1"), function (res) {
      hasPre = true; phase = res.phase; route();
    });
  });

  /* Layar 3: post-task */
  $("f-post").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!post.complete()) { $("err3").textContent = "Jawab semua pertanyaan dulu."; return; }
    send("post:submit", { jawaban: post.picks }, $("b-post"), $("err3"), function (res) {
      hasPost = true; showResult(res.result); window.scrollTo(0, 0); route();
    });
  });

  route();
})();
