(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var KEY = "sim-guest";
  var STEP = "sim-step";   // "info" = peserta sudah lanjut dari latihan memilah ke info daur ulang
  var SCREENS = ["s0", "s1", "swait", "s2", "sinfo", "s3"];
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

  var phase = "wait", hasPre = false, hasPost = false;
  var quiz = null;          // pertanyaan dan pilihan dari server (tanpa kunci jawaban)
  var pilah = null, pilahTried = false;
  var current = null;
  function getStep() { try { return localStorage.getItem(STEP); } catch (e) { return null; } }
  function setStep(v) { try { if (v) localStorage.setItem(STEP, v); else localStorage.removeItem(STEP); } catch (e) { } }
  var playStart = null;     // waktu sentuhan pertama pada permainan yang sedang berjalan
  var lastTop = null;       // data leaderboard terbaru dari server (dipakai claim hadiah dan podium)

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
    if (!r) { $("res-grid").hidden = true; $("res-note").textContent = ""; $("res-top").hidden = true; lastTop = null; updateClaim(); return; }
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
    lastTop = t || null;
    updateClaim();
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
    if (id === "swait") initPdf();
    if (id === "s2" && !pilahTried && window.initPilah) {
      pilahTried = true;
      try { pilah = window.initPilah(); } catch (e) { console.error("3D:", e); }
    }
  }
  function route() {
    if (!guest) return show("s0");
    if (!hasPre) return show("s1");
    if (phase === "wait") return show("swait"); // waiting room: tunggu admin membuka simulasi
    if (phase === "post") return show("s3");
    // urutan: pre-task, waiting room (swait), latihan memilah (s2), info daur ulang (sinfo), post-task (s3, dibuka admin)
    // yang sudah post-task ikut balik ke simulasi saat admin mengembalikan fase
    show(getStep() === "info" ? "sinfo" : "s2");
  }

  /* ---------- waiting room: pratinjau PDF materi ----------
     Dirender dengan PDF.js ke canvas, bukan iframe/embed, karena browser HP (iOS Safari, Chrome Android)
     tidak menampilkan semua halaman PDF di dalam iframe. PDF.js baru dimuat saat waiting room dibuka. */
  var PDF_URL = "BankSampah.pdf";
  var PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var pdfStarted = false, pdfDoc = null, pdfToken = 0, pdfWidth = 0, pdfTimer = null, pdfZoom = false;

  function pdfFail() {
    $("pdf-status").hidden = false;
    $("pdf-status").textContent = "Pratinjau tidak bisa dimuat. Tekan Buka PDF atau Unduh untuk membaca materinya.";
    pdfStarted = false; // boleh dicoba lagi saat waiting room dibuka berikutnya
  }
  function pdfRender() {
    if (!pdfDoc) return;
    var box = $("pdf-pages"), token = ++pdfToken;
    var w = Math.min(box.clientWidth || 320, 1600);
    pdfWidth = box.clientWidth;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var n = pdfDoc.numPages, i = 1;
    box.textContent = "";
    (function next() {
      if (token !== pdfToken || i > n) { if (token === pdfToken) $("pdf-status").hidden = true; return; }
      var num = i++;
      pdfDoc.getPage(num).then(function (page) {
        if (token !== pdfToken) return;
        var base = page.getViewport({ scale: 1 });
        var vp = page.getViewport({ scale: (w * dpr) / base.width });
        var cv = document.createElement("canvas");
        cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
        cv.className = "pdf-page";
        cv.setAttribute("role", "img");
        cv.setAttribute("aria-label", "Slide " + num + " dari " + n);
        box.appendChild(cv);
        return page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise.then(next);
      }).catch(function (e) { console.error("pdf:", e); if (token === pdfToken) pdfFail(); });
    })();
  }
  function initPdf() {
    if (pdfStarted) { if (pdfDoc && $("pdf-pages").clientWidth !== pdfWidth) pdfRender(); return; }
    pdfStarted = true;
    $("pdf-status").hidden = false; $("pdf-status").textContent = "Memuat materi...";
    function open() {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      window.pdfjsLib.getDocument(PDF_URL).promise.then(function (doc) { pdfDoc = doc; pdfRender(); }).catch(function (e) { console.error("pdf:", e); pdfFail(); });
    }
    if (window.pdfjsLib) return open();
    var sc = document.createElement("script");
    sc.src = PDFJS; sc.async = true; sc.onload = open; sc.onerror = pdfFail;
    document.head.appendChild(sc);
  }
  // putar layar HP / ubah ukuran jendela: render ulang supaya tetap tajam dan pas lebar
  window.addEventListener("resize", function () {
    clearTimeout(pdfTimer);
    pdfTimer = setTimeout(function () {
      if (!$("swait").hidden && pdfDoc && Math.abs($("pdf-pages").clientWidth - pdfWidth) > 20) pdfRender();
    }, 250);
  });
  // layar sempit: tombol Perbesar melebarkan slide (bisa digeser ke samping) supaya teks slide terbaca
  $("pdf-zoom").hidden = false;
  $("pdf-zoom").addEventListener("click", function () {
    pdfZoom = !pdfZoom;
    $("pdf-box").classList.toggle("zoomed", pdfZoom);
    $("pdf-zoom").setAttribute("aria-pressed", pdfZoom ? "true" : "false");
    $("pdf-zoom").textContent = pdfZoom ? "Perkecil" : "Perbesar";
    pdfRender();
  });

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
    guest = null; phase = "wait"; hasPre = false; hasPost = false; quiz = null; playStart = null;
    $("f-gate").reset();
    pre.clear(); post.clear();
    lastTop = null; closeClaimUi(); updateClaim();
    $("post-done").hidden = true; $("post-actions").hidden = false;
    $("post-intro").textContent = "Jawab 10 pertanyaan yang sama seperti di awal. Pilih satu jawaban untuk tiap pertanyaan. Jawaban tidak bisa diubah setelah dikirim.";
    $("err1").textContent = ""; $("err3").textContent = "";
    $("err0").textContent = "Sesi dimulai ulang oleh admin. Masukkan namamu lagi.";
    if (pilah) pilah.restart();
    if (window.praktikReset) window.praktikReset();
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

    /* pilihan praktik daur ulang: peserta memilih praktik mana yang dikerjakan lebih dulu, urutan bebas */
  var PRAKTIK = {
    botol: { panel: "d3-panel", reset: "d3-reset", nama: "pot dari botol bekas" },
    kaleng: { panel: "k3-panel", reset: "k3-reset", nama: "tempat pensil dari kaleng bekas" },
    kompos: { panel: "c3-panel", reset: "c3-reset", nama: "kompos dari sisa makanan" },
    ecobrick: { panel: "e3-panel", reset: "e3-reset", nama: "ecobrick dari bungkus plastik" }
  };
  var praktikNow = null, praktikDone = {};
  var pickBtns = document.querySelectorAll(".d3-opt");
  function praktikMsg() {
    var m = $("d3-pickmsg"), keys = Object.keys(PRAKTIK);
    var all = keys.every(function (k) { return praktikDone[k]; });
    if (all) { m.textContent = "Semua praktik sudah selesai. Lanjut baca materi di bawah, lalu tunggu instruksi admin."; return; }
    if (!praktikNow) { m.textContent = "Pilih salah satu praktik di atas untuk memulai."; return; }
    if (praktikDone[praktikNow]) {
      var other = keys.filter(function (k) { return k !== praktikNow && !praktikDone[k]; })[0];
      m.textContent = "Praktik ini selesai. Mau coba " + PRAKTIK[other].nama + " juga?";
      return;
    }
    m.textContent = "Kamu bisa berpindah praktik kapan saja. Kemajuan di tiap praktik tetap ada selama halaman ini terbuka.";
  }
  function choosePraktik(p, scroll) {
    praktikNow = p;
    Object.keys(PRAKTIK).forEach(function (k) { $(PRAKTIK[k].panel).hidden = k !== p; });
    Array.prototype.forEach.call(pickBtns, function (b) {
      var on = b.getAttribute("data-p") === p;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    praktikMsg();
    if (scroll && p) {
      var el = $(PRAKTIK[p].panel), calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try { el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }); } catch (e) { el.scrollIntoView(); }
    }
  }
  Array.prototype.forEach.call(pickBtns, function (b) {
    b.addEventListener("click", function () { choosePraktik(b.getAttribute("data-p"), true); });
  });
  function markPraktik(p) {
    praktikDone[p] = true;
    Array.prototype.forEach.call(pickBtns, function (b) {
      if (b.getAttribute("data-p") === p) b.querySelector(".tag").hidden = false;
    });
    praktikMsg();
  }
  window.addEventListener("daur3d:finish", function () { markPraktik("botol"); });
  window.addEventListener("daur3d2:finish", function () { markPraktik("kaleng"); });
  window.addEventListener("daur3d3:finish", function () { markPraktik("kompos"); });
  window.addEventListener("daur3d4:finish", function () { markPraktik("ecobrick"); });
  window.praktikReset = function () { // sesi dimulai ulang: kembalikan semua praktik dan pilihan ke awal
    praktikDone = {};
    Array.prototype.forEach.call(pickBtns, function (b) { b.querySelector(".tag").hidden = true; });
    Object.keys(PRAKTIK).forEach(function (k) { var b = $(PRAKTIK[k].reset); if (b) b.click(); });
    choosePraktik(null, false);
  };


  /* ---------- claim hadiah top 3 ----------
     Alur: tombol Claim hadiah -> pilih e-wallet + isi nomor -> popup "apakah ini nomor Anda?" ->
     simpan ke server -> layar penuh podium (rank, skor, waktu). Setelah tersimpan, tombol hanya membuka podium lagi. */
  var EWALLETS = ["ShopeePay", "OVO", "DANA", "GoPay", "BCA"];
  var walletType = null, walletNo = "";
  function rupiah(n) { return "Rp " + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function cleanNo(type, raw) { // sama dengan aturan server (server tetap memeriksa ulang)
    var n = String(raw || "").replace(/[\s.\-()]/g, "");
    if (!/^\+?\d+$/.test(n)) return null;
    if (type === "BCA") return /^\d{10}$/.test(n) ? n : null;
    n = n.replace(/^\+?62/, "0");
    return /^08\d{8,12}$/.test(n) ? n : null;
  }
  function fmtNo(n) { return n.replace(/(\d{4})(?=\d)/g, "$1 "); }

  function updateClaim() {
    var w = lastTop && lastTop.winner;
    $("claim-box").hidden = !w;
    if (!w) return;
    $("claim-text").textContent = w.payout
      ? "Peringkat #" + w.rank + ", hadiah " + rupiah(w.prize) + ". Data " + w.payout.ewallet + " (\u2022\u2022\u2022\u2022 " + w.payout.last4 + ") sudah tersimpan."
      : "Kamu peringkat #" + w.rank + " dan berhak atas hadiah " + rupiah(w.prize) + ". Tekan tombol di bawah, isi e-wallet kamu, lalu lihat peringkatmu.";
    $("b-claim").textContent = w.payout ? "Lihat peringkatku" : "Claim hadiah";
  }

  var walletBtns = [];
  (function buildWalletOpts() {
    var box = $("wallet-opts");
    EWALLETS.forEach(function (name) {
      var b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = name;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        walletType = name;
        walletBtns.forEach(function (x) {
          var on = x === b; x.classList.toggle("picked", on); x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        $("wallet-no-lbl").textContent = name === "BCA" ? "Nomor rekening BCA" : "Nomor HP " + name;
        $("wallet-no").placeholder = name === "BCA" ? "1234567890" : "081234567890";
        $("err-wallet").textContent = "";
      });
      walletBtns.push(b); box.appendChild(b);
    });
  })();

  function openDlg(d) { if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute("open", ""); }
  function closeDlg(d) { if (d.close) { if (d.open) d.close(); } else d.removeAttribute("open"); }
  function closeClaimUi() {
    closeDlg($("dlg-wallet")); closeDlg($("dlg-confirm")); closePodium();
    walletType = null; walletNo = ""; $("wallet-no").value = ""; $("err-wallet").textContent = ""; $("err-confirm").textContent = "";
    walletBtns.forEach(function (x) { x.classList.remove("picked"); x.setAttribute("aria-pressed", "false"); });
  }

  /* layar penuh: pakai Fullscreen API kalau browser mengizinkan, kalau tidak tetap menutup seluruh layar lewat CSS */
  function openPodium() {
    var w = lastTop && lastTop.winner;
    if (!w) return;
    var me = lastTop.list.filter(function (r) { return r.me; })[0];
    if (!me) return;
    var medal = ["#ffc83d", "#cbd3e6", "#eba26b"][w.rank - 1];
    $("podium").querySelector(".pd-me").style.setProperty("--mc", medal);
    $("pd-rank").textContent = "#" + w.rank;
    $("pd-name").textContent = me.nama;
    $("pd-score").textContent = me.skor + " / " + me.total;
    $("pd-time").textContent = fmtMs(me.ms);
    $("pd-prize").textContent = rupiah(w.prize);
    $("pd-wallet").textContent = w.payout ? "Hadiah dikirim ke " + w.payout.ewallet + " \u2022\u2022\u2022\u2022 " + w.payout.last4 : "";
    var ol = $("pd-podium"); ol.textContent = "";
    lastTop.list.forEach(function (row) {
      var li = document.createElement("li"); li.setAttribute("data-rank", row.rank); if (row.me) li.className = "me";
      var who = document.createElement("div"); who.className = "pd-who";
      var nm = document.createElement("b"); nm.textContent = row.nama + (row.me ? " (kamu)" : "");
      var sc = document.createElement("small"); sc.textContent = row.skor + " / " + row.total + " \u00b7 " + fmtMs(row.ms);
      var pz = document.createElement("small"); pz.textContent = rupiah(row.prize);
      who.appendChild(nm); who.appendChild(sc); who.appendChild(pz);
      var blk = document.createElement("div"); blk.className = "pd-block"; blk.textContent = row.rank;
      li.appendChild(who); li.appendChild(blk); ol.appendChild(li);
    });
    $("podium").hidden = false;
    document.body.style.overflow = "hidden";
    var el = $("podium");
    try { var rq = el.requestFullscreen || el.webkitRequestFullscreen; if (rq) { var pr = rq.call(el); if (pr && pr.catch) pr.catch(function () { }); } } catch (e) { }
    $("pd-close").focus();
  }
  function closePodium() {
    if ($("podium").hidden) return;
    $("podium").hidden = true;
    document.body.style.overflow = "";
    try {
      var fs = document.fullscreenElement || document.webkitFullscreenElement;
      if (fs) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    } catch (e) { }
  }
  $("pd-close").addEventListener("click", closePodium);
  // keluar dari fullscreen lewat tombol Esc browser: tutup juga overlay-nya supaya tidak tertinggal setengah layar
  function onFsChange() { if (!document.fullscreenElement && !document.webkitFullscreenElement && !$("podium").hidden) closePodium(); }
  document.addEventListener("fullscreenchange", onFsChange);
  document.addEventListener("webkitfullscreenchange", onFsChange);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("podium").hidden) closePodium(); });

  $("b-claim").addEventListener("click", function () {
    var w = lastTop && lastTop.winner;
    if (!w) return;
    if (w.payout) { openPodium(); return; }       // sudah pernah konfirmasi: langsung lihat peringkat
    $("dw-prize").textContent = "Peringkat #" + w.rank + ": hadiah " + rupiah(w.prize) + ". Isi data e-wallet untuk pencairan.";
    $("err-wallet").textContent = "";
    openDlg($("dlg-wallet"));
  });
  $("wallet-cancel").addEventListener("click", function () { closeDlg($("dlg-wallet")); });

  $("f-wallet").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!walletType) { $("err-wallet").textContent = "Pilih jenis e-wallet dulu."; return; }
    var n = cleanNo(walletType, $("wallet-no").value);
    if (!n) {
      $("err-wallet").textContent = walletType === "BCA" ? "Nomor rekening BCA harus 10 digit." : "Nomor HP tidak valid. Contoh: 081234567890.";
      return;
    }
    walletNo = n;
    $("dc-type").textContent = walletType;
    $("dc-no").textContent = fmtNo(n);
    $("err-confirm").textContent = "";
    closeDlg($("dlg-wallet"));
    openDlg($("dlg-confirm"));
  });
  $("confirm-no").addEventListener("click", function () { closeDlg($("dlg-confirm")); openDlg($("dlg-wallet")); $("wallet-no").focus(); });

  $("confirm-yes").addEventListener("click", function () {
    var btn = $("confirm-yes"), old = btn.textContent;
    btn.disabled = true; btn.textContent = "Menyimpan...";
    $("err-confirm").textContent = "";
    // podium dibuka setelah server menyimpan (fullscreen masih dalam jendela aksi klik pengguna; kalau diblokir, overlay CSS tetap menutup layar)
    socket.timeout(8000).emit("payout:save", { ewallet: walletType, number: walletNo }, function (err, res) {
      btn.disabled = false; btn.textContent = old;
      if (err || !res) { $("err-confirm").textContent = "Koneksi bermasalah. Tekan Ya, ini nomor saya lagi."; return; }
      if (res.reset) { resetLocal(); return; }
      if (!res.ok) { $("err-confirm").textContent = res.error || "Gagal menyimpan."; return; }
      lastTop = res.result && res.result.top ? res.result.top : lastTop;
      updateClaim();
      closeDlg($("dlg-confirm"));
      walletNo = ""; $("wallet-no").value = "";
      openPodium();
    });
  });

  route();
})();
