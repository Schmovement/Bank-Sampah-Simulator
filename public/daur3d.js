/* daur3d.js (gabungan): empat latihan daur ulang 3D dalam satu berkas.
   Urutan: pot dari botol, tempat pensil dari kaleng, kompos dari ember, ecobrick dari botol.
   Tiap latihan tetap dalam IIFE sendiri (id panel d3-, k3-, c3-, e3-), sehingga tidak saling bentrok.
   Event selesai tetap: daur3d:finish, daur3d2:finish, daur3d3:finish, daur3d4:finish. */

/* ===== daur3d.js ===== */
/* Latihan daur ulang 3D: pot tanaman dari botol (layar info di index.html).
   Peserta mengerjakan tiap langkah langsung pada model 3D: menggosok, memotong, mengetuk, menyeret.
   Teks instruksi di atas adegan memandu langkahnya. Tombol Petunjuk memutar contoh gerakan di model yang sama.
   Isi langkah dan umpan balik mengikuti proyek "Pot tanaman dari botol" di daur.js.
   Tidak ada data yang dikirim ke server. Saat selesai, window menerima event "daur3d:finish" { salah, petunjuk, lewati }.
   Semua teks disisipkan dengan textContent. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("d3-stage");
  if (!stage) return;

  var FALLBACK = { "--soft": "#E3EADF", "--accent": "#1B6A47" };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function cssVar(n) {
    var v = "";
    try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { }
    return v || FALLBACK[n] || "#888888";
  }
  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= data (sama dengan proyek botol di daur.js) ================= */
  var OTHER = "Tidak dipakai di sini.";
  var MATS = [
    { k: "botol", t: "Botol plastik bekas, bersih", s: "Botol bekas", ok: 1 },
    { k: "cutter", t: "Cutter atau gunting kuat", s: "Cutter", ok: 1 },
    { k: "cat", t: "Cat atau spidol permanen", s: "Cat", ok: 1 },
    { k: "tanah", t: "Tanah dan bibit kecil", s: "Tanah & bibit", ok: 1 },
    { k: "blender", t: "Blender dan baskom air", s: "Blender", fb: OTHER },
    { k: "lem", t: "Lem dan lakban kain", s: "Lem & lakban", fb: OTHER },
    { k: "kaleng", t: "Kaleng minuman bekas", s: "Kaleng", fb: OTHER }
  ];
  var MAT_NEED = MATS.filter(function (m) { return m.ok; }).length;

  var T_CLEAN = "Bersihkan botol dulu.";
  var T_LAST = "Tanah diisi paling akhir.";
  var T_WET = "Cat dulu sampai kering, baru isi tanah.";
  var T_SEED = "Bibit butuh tanah dulu.";

  /* tiap langkah terdiri dari satu atau lebih aksi. type: scrub (geser di botol), tap (ketuk), drag (seret).
     traps: alat yang belum waktunya dipakai. Kalau disentuh, muncul umpan balik dan dihitung salah. */
  var ACTS = {
    clean: { type: "scrub", need: 1.0, title: "Bersihkan botol", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik di layar sampai botol bersih.",
      ok: "Botol bersih, label lepas.", traps: { cutter: T_CLEAN, soil: T_LAST, seed: T_LAST } },
    cut: { type: "scrub", need: 1.0, tool: "cutter", title: "Potong botol", text: "Geser jari kiri-kanan.",
      tip: "Geser jari", hint: "Geser jari kiri-kanan. Cutter memotong di garis merah.",
      ok: "Bagian atas terpotong.", traps: { soil: T_LAST, seed: T_LAST } },
    holes: { type: "tap", title: "Beri lubang", text: "Ketuk botol.",
      tip: "Ketuk botol", hint: "Ketuk bagian bawah botol.",
      ok: "Air bisa mengalir keluar.", traps: { soil: T_LAST, seed: T_LAST } },
    paint: { type: "scrub", need: 1.2, tool: "brush", title: "Cat botol", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik. Kuas mengecat botol.",
      ok: "Botol sudah dicat.", traps: { soil: T_WET, seed: T_SEED } },
    soil: { type: "drag", obj: "soil", title: "Isi tanah", text: "Ketuk kantong tanah.",
      tip: "Ketuk tanah", hint: "Ketuk kantong tanah di sisi kanan.",
      ok: "Tanah terisi.", traps: { seed: T_SEED } },
    seed: { type: "drag", obj: "seed", title: "Tanam bibit", text: "Ketuk bibit.",
      tip: "Ketuk bibit", hint: "Ketuk bibit di sisi kanan.",
      ok: "Bibit tertanam.", traps: {} }
  };
  var STEPS = [
    { acts: ["clean"], d: "Botol bersih." },
    { acts: ["cut"], d: "Botol terpotong.", warn: "Cutter tajam, hati-hati." },
    { acts: ["holes"], d: "Dasar berlubang." },
    { acts: ["paint", "soil", "seed"], d: "Pot sudah ditanami." }
  ];
  var DONE = "Botol bekas jadi pot tanaman.";

  /* ================= antarmuka (teks, tombol, status) ================= */
  var V = null;      // jembatan ke adegan 3D, diisi setelah adegan dibuat
  var st = null;     // status latihan

  function newState() {
    return { phase: "bahan", step: 0, ai: 0, stepDone: false, picked: {}, bad: {}, mist: 0, hints: 0, skips: 0, fb: null, order: shuffle(range(MATS.length)) };
  }
  function setFbState(cls, strong, text) { if (st) st.fb = cls ? [cls, strong, text] : null; }

  function render() {
    if (!st) return;
    var n = STEPS.length, pct = 0, warn = $("d3-warn");
    warn.hidden = true; $("d3-next").hidden = true; $("d3-mist").textContent = "";
    var got = Object.keys(st.picked).length;
    var playing = st.phase === "bahan" ? got < MAT_NEED : (st.phase === "langkah" && !st.stepDone);
    $("d3-hint").hidden = !playing; $("d3-skip").hidden = !playing;
    if (st.phase === "bahan") {
      $("d3-phase").textContent = "Bahan";
      $("d3-title").textContent = "Pilih bahan";
      $("d3-text").textContent = "Ketuk " + MAT_NEED + " benda yang dipakai. Terpilih " + got + " dari " + MAT_NEED + ".";
      pct = (got / MAT_NEED) / (n + 1) * 100;
    } else if (st.phase === "langkah") {
      var step = STEPS[st.step], def = ACTS[step.acts[st.ai]];
      $("d3-phase").textContent = "Langkah " + (st.step + 1) + " dari " + n;
      if (st.stepDone) { $("d3-title").textContent = "Selesai"; $("d3-text").textContent = step.d; }
      else { $("d3-title").textContent = def.title; $("d3-text").textContent = def.text; }
      if (step.warn && !st.stepDone) { warn.hidden = false; warn.textContent = step.warn; }
      pct = (1 + st.step + (st.stepDone ? 1 : st.ai / step.acts.length)) / (n + 1) * 100;
    } else {
      pct = 100;
      $("d3-phase").textContent = "Selesai";
      $("d3-title").textContent = "Pot jadi!";
      $("d3-text").textContent = DONE + " Salah: " + st.mist + ". Petunjuk: " + st.hints + ".";
    }
    $("d3-bar").style.width = pct + "%";
    var fb = $("d3-fb"); fb.textContent = "";
    fb.hidden = !st.fb;
    if (st.fb) {
      var b = document.createElement("b"); b.className = st.fb[0]; b.textContent = st.fb[1]; fb.appendChild(b);
      fb.appendChild(document.createTextNode(st.fb[2] || ""));
    }
  }

  function showNoGl() { $("d3-nogl").hidden = false; $("d3-body").hidden = true; }

  $("d3-hint").addEventListener("click", function () { if (V) V.hint(); });
  $("d3-skip").addEventListener("click", function () { if (V) V.force(); });
  $("d3-next").addEventListener("click", function () { if (V) V.next(); });
  $("d3-reset").addEventListener("click", function () { if (V) V.begin(); });

  /* ================= adegan 3D ================= */
  function start() {
    var canvas = $("d3-canvas");
    var V3 = THREE.Vector3;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.6));
    var sun = new THREE.DirectionalLight(0xffffff, 0.65);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe3eadf, roughness: 1 });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    function applyTheme() { floorMat.color.set(cssVar("--soft")); }
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { }
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { }

    /* ---- alat bantu ---- */
    function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {})); }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function invisibleMat() { return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    // ubah keburaman seluruh objek (dipakai untuk meredupkan, memudar, dan memulihkan)
    function setOpacity(obj, f) {
      obj.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material;
        if (m.userData.base === undefined) { m.userData.base = m.opacity; m.userData.tr = m.transparent; }
        m.transparent = m.userData.tr || f < 1;
        m.opacity = m.userData.base * f;
      });
    }

    /* ---- animasi ---- */
    var tweens = [];
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function tween(dur, fn, done, ease, owner) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut, owner: owner || "" }); }
    function killTweens(owner) { for (var i = tweens.length - 1; i >= 0; i--) if (tweens[i].owner === owner) tweens.splice(i, 1); }
    function seq(list, done) {
      var i = 0;
      (function nxt() { if (i >= list.length) { if (done) done(); return; } list[i++](nxt); })();
    }
    function moveTo(obj, to, dur, done, arc) {
      var from = obj.position.clone();
      tween(dur, function (p) { obj.position.lerpVectors(from, to, p); if (arc) obj.position.y += Math.sin(p * Math.PI) * arc; }, done);
    }
    function popIn(o, dur) { o.visible = true; tween(dur || 380, function (p) { o.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { o.scale.setScalar(1); }); }

    /* ---- ukuran dan bentuk botol ---- */
    var R = 0.6, CUT = 2.35, TOP = 3.6, LIFT = 2.7;
    function pet() { return M(0x9fd8ee, { transparent: true, opacity: 0.5, roughness: 0.15, side: THREE.DoubleSide }); }

    var bottle = new THREE.Group(); bottle.visible = false; scene.add(bottle);
    var lower = new THREE.Group(), upper = new THREE.Group();
    bottle.add(lower, upper);
    lower.add(mesh(new THREE.CylinderGeometry(R, R, CUT, 32, 1, true), pet(), 0, CUT / 2, 0));
    var base = mesh(new THREE.CircleGeometry(R, 32), pet(), 0, 0.01, 0); base.rotation.x = -Math.PI / 2; lower.add(base);
    // bagian atas: pusat grup ada di garis potong supaya bisa berputar dari sana
    upper.position.set(0, CUT, 0);
    upper.add(mesh(new THREE.CylinderGeometry(R, R, 0.3, 32, 1, true), pet(), 0, 0.15, 0));
    upper.add(mesh(new THREE.CylinderGeometry(0.22, R, 0.55, 32, 1, true), pet(), 0, 0.575, 0));
    upper.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.25, 20, 1, true), pet(), 0, 0.975, 0));
    upper.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.15, 20), M(0x1e66c8), 0, 1.175, 0));
    [lower, upper].forEach(function (g) { g.traverse(function (o) { if (o.isMesh) o.castShadow = true; }); });

    // tepi pot setelah dipotong
    var edge = mesh(new THREE.TorusGeometry(R, 0.025, 8, 36), M(0x5aa6c4), 0, CUT, 0); edge.rotation.x = Math.PI / 2; edge.visible = false; lower.add(edge);

    // noda kotor
    var specks = [], i;
    for (i = 0; i < 14; i++) {
      var th = ((i * 0.37) % 1) * 2.3 - 1.15, sy = 0.25 + ((i * 0.53) % 1) * 1.9;
      var sp = mesh(new THREE.SphereGeometry(0.065, 8, 6), M(0x7a5a2e, { roughness: 1 }), Math.sin(th) * (R + 0.015), sy, Math.cos(th) * (R + 0.015));
      sp.rotation.y = th; lower.add(sp); specks.push(sp);
    }

    // label "AIR"
    var label = new THREE.Group(); lower.add(label);
    label.add(mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.8, 32, 1, true), M(0x1e66c8, { roughness: 0.6 }), 0, 1.1, 0));
    (function () {
      var cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
      var c = cv.getContext("2d"); c.fillStyle = "#fff"; c.font = '800 84px Arial, sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("AIR", 128, 68);
      var tx = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true });
      label.add(mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.4, 16, 1, true, -0.5, 1.0), tx, 0, 1.1, 0));
    })();

    // garis potong putus-putus
    var ring = new THREE.Group(), dashes = [], ND = 28;
    for (i = 0; i < ND; i++) {
      var a = i / ND * Math.PI * 2;
      var d = mesh(new THREE.BoxGeometry(0.17, 0.05, 0.035), new THREE.MeshBasicMaterial({ color: 0xc23b2e }), Math.sin(a) * (R + 0.03), CUT, Math.cos(a) * (R + 0.03));
      d.rotation.y = a; ring.add(d);
      dashes.push({ m: d, a: Math.abs(a > Math.PI ? a - Math.PI * 2 : a) });
    }
    var dashOrder = dashes.slice().sort(function (x, y) { return x.a - y.a; }); // terpotong dari tengah depan ke samping
    ring.visible = false; lower.add(ring);

    // titik lubang di dasar
    var markers = [];
    [-0.8, 0, 0.8].forEach(function (a) {
      var g = new THREE.Group();
      g.position.set(Math.sin(a) * (R + 0.015), 0.4, Math.cos(a) * (R + 0.015)); g.rotation.y = a;
      var dot = mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 0, 0.03);
      var halo = mesh(new THREE.RingGeometry(0.11, 0.17, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0.03);
      var hole = mesh(new THREE.CircleGeometry(0.085, 18), new THREE.MeshBasicMaterial({ color: 0x10181d }), 0, 0, 0.005);
      g.add(dot, halo, hole); lower.add(g);
      markers.push({ g: g, dot: dot, halo: halo, hole: hole, pos: g.position.clone(), done: false });
    });
    function refreshMarkers(on) {
      markers.forEach(function (m) { m.dot.visible = on && !m.done; m.halo.visible = on && !m.done; m.hole.visible = m.done; });
    }

    // cat, tanah, bibit di dalam pot
    var paint = new THREE.Group(); paint.visible = false; paint.scale.y = 0.001; lower.add(paint);
    function band(y0, h, col) {
      var g = new THREE.CylinderGeometry(R + 0.02, R + 0.02, h, 32, 1, true); g.translate(0, y0 + h / 2, 0);
      return new THREE.Mesh(g, M(col, { roughness: 0.5, side: THREE.DoubleSide }));
    }
    paint.add(band(0.02, 1.9, 0xe0ae00), band(0.5, 0.3, 0xc23b2e), band(1.15, 0.14, 0xffffff));
    var fillGeo = new THREE.CylinderGeometry(R - 0.05, R - 0.06, 1.5, 24); fillGeo.translate(0, 0.81, 0);
    var soilFill = new THREE.Mesh(fillGeo, M(0x5b3a1e, { roughness: 1 })); soilFill.visible = false; soilFill.scale.y = 0.001; lower.add(soilFill);
    var plant = new THREE.Group(); plant.position.set(0, 1.56, 0); plant.visible = false; plant.scale.setScalar(0.001); lower.add(plant);
    function sprout(g, x, y, z, s) {
      g.add(mesh(new THREE.CylinderGeometry(0.03 * s, 0.04 * s, 0.5 * s, 8), M(0x2e7d4f), x, y + 0.25 * s, z));
      [-1, 1].forEach(function (dir) {
        var l = mesh(new THREE.SphereGeometry(0.2 * s, 12, 8), M(0x3f9b4a, { roughness: 0.6 }), x + dir * 0.18 * s, y + 0.5 * s, z);
        l.scale.set(1.2, 0.3, 0.7); l.rotation.z = dir * 0.5; g.add(l);
      });
    }
    sprout(plant, 0, 0, 0, 1.5);

    // badan botol yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = TOP; bottle.add(hitBody);

    // keran air untuk bilas
    var faucet = new THREE.Group(), drops = [];
    var steel = M(0xaab2ba, { metalness: 0.7, roughness: 0.3 });
    faucet.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 14), steel, 1.1, 3.8, -0.6));
    var arm = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 14), steel, 0.5, 4.6, -0.6); arm.rotation.z = Math.PI / 2; faucet.add(arm);
    faucet.add(mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.35, 14), steel, -0.1, 4.45, -0.6));
    for (i = 0; i < 8; i++) {
      var dr = mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5ab2e0 }), ((i * 0.37) % 1 - 0.5) * 0.9, 3, R + 0.04);
      dr.scale.y = 1.7; faucet.add(dr); drops.push(dr);
    }
    faucet.visible = false; scene.add(faucet);

    /* ---- benda di meja: bahan dan alat ---- */
    var MODEL = {
      botol: function (g) {
        var pm = M(0x9fd8ee, { transparent: true, opacity: 0.68, roughness: 0.15 });
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 24), pm, 0, 0.5, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.25, 24), pm, 0, 1.12, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), pm, 0, 1.29, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), M(0x1e66c8), 0, 1.39, 0));
      },
      cutter: function (g) {
        g.add(mesh(new THREE.BoxGeometry(1.0, 0.16, 0.3), M(0xf0c23a, { roughness: 0.5 }), 0, 0.1, 0));
        g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 0.2), M(0xcfd3d6, { metalness: 0.8, roughness: 0.3 }), 0.72, 0.1, 0));
        g.add(mesh(new THREE.BoxGeometry(0.3, 0.05, 0.12), M(0x1b1b1b), -0.25, 0.2, 0));
      },
      cat: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.55, 24), M(0xe0ae00, { metalness: 0.3, roughness: 0.4 }), 0, 0.28, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.16, 24), M(0xc23b2e), 0, 0.3, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 24), M(0xcfd3d6, { metalness: 0.7, roughness: 0.3 }), 0, 0.58, 0));
      },
      brush: function (g) {
        var h = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 10), M(0x8a5a2b), 0, 0.06, 0); h.rotation.z = Math.PI / 2; g.add(h);
        var f = mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.3, 10), M(0xcfd3d6, { metalness: 0.7, roughness: 0.3 }), 0.5, 0.06, 0); f.rotation.z = Math.PI / 2; g.add(f);
        g.add(mesh(new THREE.BoxGeometry(0.22, 0.16, 0.08), M(0xc23b2e), 0.74, 0.06, 0));
      },
      tanah: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.12, 24), M(0x7a8088), 0, 0.06, 0));
        g.add(mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x5b3a1e, { roughness: 1 }), 0, 0.12, 0));
        sprout(g, 0.12, 0.45, 0.05, 0.9);
      },
      soil: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.12, 24), M(0x7a8088), 0, 0.06, 0));
        g.add(mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x5b3a1e, { roughness: 1 }), 0, 0.12, 0));
      },
      seed: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.4, 20), M(0xc8772b, { roughness: 0.8 }), 0, 0.2, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 20), M(0x5b3a1e, { roughness: 1 }), 0, 0.38, 0));
        sprout(g, 0, 0.38, 0, 0.9);
      },
      blender: function (g) {
        g.add(mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), M(0x2b3036), 0, 0.2, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.9, 20), M(0xdcecf5, { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.85, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), M(0x2b3036), 0, 1.34, 0));
      },
      lem: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 16), M(0xf4f4f0), -0.28, 0.35, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.22, 16), M(0xc23b2e), -0.28, 0.81, 0));
        var tape = mesh(new THREE.TorusGeometry(0.28, 0.1, 10, 24), M(0x6a4cc2, { roughness: 0.5 }), 0.36, 0.1, 0.05); tape.rotation.x = Math.PI / 2; g.add(tape);
      },
      kaleng: function (g) {
        var al = M(0xc9ced3, { metalness: 0.85, roughness: 0.28 });
        g.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.85, 28), al, 0, 0.43, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.4, 28), M(0xd23a2f, { metalness: 0.3, roughness: 0.4 }), 0, 0.45, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 28), al, 0, 0.88, 0));
      }
    };
    function buildObj(key, hitR, hitY) {
      var g = new THREE.Group(); MODEL[key](g);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(mesh(new THREE.SphereGeometry(hitR || 0.85, 12, 8), invisibleMat(), 0, hitY === undefined ? 0.45 : hitY, 0));
      scene.add(g); return g;
    }
    function labelSprite(txt) {
      var cv = document.createElement("canvas"); cv.width = 320; cv.height = 80;
      var c = cv.getContext("2d");
      c.fillStyle = "rgba(10,22,18,0.88)"; roundRect(c, 4, 8, 312, 64, 14); c.fill();
      var fs = 36; c.font = "700 " + fs + "px Arial, sans-serif";
      while (fs > 20 && c.measureText(txt).width > 276) { fs -= 2; c.font = "700 " + fs + "px Arial, sans-serif"; } // teks dikecilkan agar muat di kotaknya
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 160, 42);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5; scene.add(sp); return sp; // lebar 1.5 < jarak antar benda 1.7, jadi tidak bersentuhan
    }
    var items = MATS.map(function (m, idx) {
      var g = buildObj(m.k, 0.8, 0.45);
      var r = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.76, 36), new THREE.MeshBasicMaterial({ color: 0x2e7d4f, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      r.rotation.x = -Math.PI / 2; r.visible = false; scene.add(r);
      g.userData = { idx: idx, ring: r, label: labelSprite(m.s), flashUntil: 0, fl: false };
      return g;
    });
    var tools = {
      cutter: buildObj("cutter", 0.8, 0.2), cat: buildObj("cat", 0.6, 0.3), brush: buildObj("brush", 0.7, 0.1),
      soil: buildObj("soil", 0.85, 0.3), seed: buildObj("seed", 0.7, 0.4)
    };
    Object.keys(tools).forEach(function (k) { tools[k].userData.key = k; tools[k].visible = false; });

    /* ---- penunjuk jari untuk petunjuk ---- */
    var GS = 0.9, ghost = (function () {
      var cv = document.createElement("canvas"); cv.width = cv.height = 128; var c = cv.getContext("2d");
      c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.fillStyle = "rgba(255,255,255,0.4)"; c.fill();
      c.lineWidth = 8; c.strokeStyle = cssVar("--accent"); c.stroke();
      c.beginPath(); c.arc(64, 64, 18, 0, Math.PI * 2); c.fillStyle = cssVar("--accent"); c.fill();
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      s.scale.setScalar(GS); s.renderOrder = 20; s.visible = false; scene.add(s); return s;
    })();

    /* ---- kamera dan tata letak ---- */
    var poseA, poseB, blend = 0, slots = [], slotOf = shuffle(range(MATS.length)), toolHome = {};
    function distOf(p) { var t = Math.tan(camera.fov * Math.PI / 360); return Math.max(8, p.halfW / (t * camera.aspect), p.halfH / t); }
    function updateCam() {
      var k = blend, look = new V3().lerpVectors(poseA.look, poseB.look, k);
      var dist = distOf(poseA) * (1 - k) + distOf(poseB) * k;
      var dir = new V3(0, poseA.ey * (1 - k) + poseB.ey * k, poseA.ez * (1 - k) + poseB.ez * k).normalize();
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look); camera.updateProjectionMatrix();
    }
    function placeItems() {
      items.forEach(function (it, idx) {
        var s = slots[slotOf[idx]], u = it.userData;
        it.position.set(s[0], 0, s[1]);
        u.label.position.set(s[0], 0.12, s[1] + 0.95);
        u.ring.position.set(s[0], 0.03, s[1]);
      });
    }
    function placeTools() {
      Object.keys(tools).forEach(function (k) {
        var t = tools[k];
        if (!busy && !drag && !demoCarry) t.position.copy(toolHome[k]);
      });
    }
    function layout() {
      var w = stage.clientWidth || 600, h = stage.clientHeight || 400, xT;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (camera.aspect >= 1.3) {
        poseA = { look: new V3(0, 0.5, 0.3), halfW: 6.6, halfH: 3.2, ey: 0.8, ez: 0.75 };
        poseB = { look: new V3(0, 1.8, 0), halfW: 4.8, halfH: 3.0, ey: 0.3, ez: 1.0 };
        slots = range(7).map(function (j) { return [(j - 3) * 1.75, 0.4]; });
        xT = 2.9;
      } else {
        poseA = { look: new V3(0, 0.2, -0.2), halfW: 3.6, halfH: 3.4, ey: 1.0, ez: 0.55 };
        poseB = { look: new V3(0, 1.8, 0), halfW: 3.2, halfH: 3.0, ey: 0.3, ez: 1.0 };
        slots = [[-2.55, -1.6], [-0.85, -1.6], [0.85, -1.6], [2.55, -1.6], [-1.7, 1.1], [0, 1.1], [1.7, 1.1]];
        xT = 2.1;
      }
      toolHome = {
        cutter: new V3(-xT, 0, 1.1), cat: new V3(-xT, 0, -0.3), brush: new V3(-xT + 0.1, 0, -1.4),
        soil: new V3(xT, 0, 0.5), seed: new V3(xT, 0, -1.0)
      };
      updateCam();
      if (st && st.phase === "bahan") placeItems();
      placeTools();
    }

    /* ---- membaca sentuhan ---- */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    var dragTarget = new THREE.Vector3();
    var cur = null, busy = false, drag = null, down = null, lastWrong = 0;
    var demoOn = false, demoCarry = null, demoRestore = null;
    var autoT = null, nudgeT = null, tipT = null;

    function setNdc(e) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function hitObj(obj) { var r = ray.intersectObject(obj, true); return r.length ? r[0] : null; }
    function hitItem() {
      var best = -1, bd = 1e9;
      items.forEach(function (it, idx) {
        if (!it.visible) return;
        var h = ray.intersectObject(it, true);
        if (h.length && h[0].distance < bd) { bd = h[0].distance; best = idx; }
      });
      return best;
    }

    /* ---- teks kecil di atas adegan dan tombol petunjuk ---- */
    function setTip(text) {
      var tip = $("d3-tip");
      if (tipT) { clearTimeout(tipT); tipT = null; }
      tip.textContent = text || "";
      tip.classList.toggle("gone", !text);
      if (text) tipT = setTimeout(function () { tip.classList.add("gone"); }, 7000);
    }
    function markActive() { // setelah 15 detik tanpa sentuhan, tombol Petunjuk berkedip
      if (nudgeT) clearTimeout(nudgeT);
      $("d3-hint").classList.remove("pulse");
      nudgeT = setTimeout(function () { if (st && st.phase !== "selesai" && !st.stepDone) $("d3-hint").classList.add("pulse"); }, 15000);
    }
    function tipForAction() { setTip(cur ? cur.def.tip : ""); }

    /* ---- gerak kecil ---- */
    function shake(o) { var bx = o.position.x; tween(320, function (p) { o.position.x = bx + Math.sin(p * 20) * 0.14 * (1 - p); }, function () { o.position.x = bx; }); }
    function goHome(o) {
      var home = toolHome[o.userData.key], rz = o.rotation.z;
      moveTo(o, home.clone(), 420, null, 0.7);
      tween(420, function (p) { o.rotation.z = rz * (1 - p); });
    }
    function waterDrop(pos) {
      var dp = mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5ab2e0, transparent: true }), pos.x * 1.08, pos.y, pos.z * 1.08);
      dp.scale.y = 1.6; scene.add(dp);
      tween(700, function (p) { dp.position.y = pos.y - 0.4 * p * p; dp.material.opacity = 1 - p; }, function () { scene.remove(dp); dp.geometry.dispose(); dp.material.dispose(); });
    }

    /* ---- bahan ---- */
    function markItem(idx, kind) {
      var it = items[idx], r = it.userData.ring;
      r.material.color.set(kind === "ok" ? 0x2e7d4f : 0xc23b2e); r.material.opacity = 0.95; r.visible = true;
      if (kind === "bad") { setOpacity(it, 0.35); shake(it); }
      else tween(320, function (p) { it.position.y = Math.sin(p * Math.PI) * 0.3; }, function () { it.position.y = 0; });
    }
    function pick(idx) {
      if (!st || st.phase !== "bahan" || busy || st.picked[idx] || st.bad[idx]) return;
      if (Object.keys(st.picked).length >= MAT_NEED) return;
      var m = MATS[idx];
      if (m.ok) { st.picked[idx] = 1; markItem(idx, "ok"); setFbState("ok", "Tepat. ", m.s + " dipakai."); }
      else { st.bad[idx] = 1; st.mist++; markItem(idx, "bad"); setFbState("no", "Belum tepat. ", m.fb); }
      render(); markActive();
      if (Object.keys(st.picked).length >= MAT_NEED) autoT = setTimeout(function () { autoT = null; next(); }, 1200);
    }
    function nextCorrect() {
      for (var k = 0; k < st.order.length; k++) { var mi = st.order[k]; if (MATS[mi].ok && !st.picked[mi]) return mi; }
      return -1;
    }

    /* ---- pindah dari bahan ke langkah ---- */
    function enterWork(cb) {
      busy = true;
      seq([
        function (n) {
          items.forEach(function (it) {
            tween(300, function (p) { it.scale.setScalar(1 - p); }, function () { it.visible = false; it.userData.label.visible = false; it.userData.ring.visible = false; });
          });
          tween(320, function () { }, n);
        },
        function (n) {
          bottle.visible = true; bottle.scale.setScalar(0.01);
          tween(450, function (p) { bottle.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { bottle.scale.setScalar(1); });
          Object.keys(tools).forEach(function (k) { tools[k].position.copy(toolHome[k]); popIn(tools[k], 450); });
          tween(800, function (p) { blend = p; updateCam(); }, n);
        }
      ], function () { busy = false; cb(); });
    }

    /* ---- aksi ---- */
    function startAction() {
      var id = STEPS[st.step].acts[st.ai];
      cur = { id: id, def: ACTS[id], p: 0, done: false };
      faucet.visible = id === "clean";
      ring.visible = id === "cut";
      refreshMarkers(id === "holes");
      canvas.style.touchAction = (cur.def.type === "tap") ? "pan-y" : "none"; // ketukan boleh sambil menggulir halaman
      tipForAction(); markActive();
    }

    function applyScrub() {
      var f = Math.min(1, cur.p / cur.def.need);
      if (cur.id === "clean") {
        var g1 = Math.min(1, f * 2), g2 = Math.max(0, f * 2 - 1);
        specks.forEach(function (sp, k) { var v = clamp(1 - (g1 * specks.length - k), 0, 1); sp.visible = v > 0.02; sp.scale.set(1.3 * v, v, 0.35 * v); });
        label.scale.set(1 + 0.25 * g2, 1, 1 + 0.25 * g2); label.position.y = 0.2 * g2; label.rotation.y = g2 * 0.5; setOpacity(label, 1 - 0.85 * g2);
        faucet.visible = g1 < 1;
      } else if (cur.id === "cut") {
        var n = Math.floor(f * dashOrder.length + 0.0001);
        dashOrder.forEach(function (dd, k) { var on = k < n; dd.m.material.color.set(on ? 0x1b1b1b : 0xc23b2e); dd.m.scale.y = on ? 1.8 : 1; });
      } else if (cur.id === "paint") {
        paint.visible = f > 0; paint.scale.y = Math.max(0.001, f);
      }
    }
    var toolPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(R + 0.35));
    function moveTool() { // alat mengikuti jari, tetapi selalu di depan botol dan tidak perlu tepat
      if (!drag.tool || !ray.ray.intersectPlane(toolPlane, tmp)) return;
      var y = cur.id === "cut" ? CUT + (clamp(tmp.y, 0.3, 3.2) - CUT) * 0.15 : clamp(tmp.y, 0.3, CUT - 0.2);
      drag.toolTarget.set(clamp(tmp.x, -1.6, 1.6) - 0.95, y, R + 0.35);
    }
    function scrubTo(e) { // kemajuan = jarak geser jari di layar, di mana pun di kanvas
      var r = canvas.getBoundingClientRect(), unit = Math.min(r.width, 600);
      cur.p += Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / unit;
      drag.lx = e.clientX; drag.ly = e.clientY;
      moveTool(); applyScrub();
      if (cur.p >= cur.def.need) completeAction();
    }
    function trap(key, msg) {
      shake(tools[key]); st.mist++;
      setFbState("no", "Belum tepat. ", msg); render();
    }
    function makeHole(k) {
      var m = markers[k]; if (m.done) return;
      m.done = true; refreshMarkers(true); waterDrop(m.pos);
      var left = markers.filter(function (x) { return !x.done; }).length;
      if (left === 0) completeAction();
      else { setFbState("ok", "Tepat. ", "Lubang " + (3 - left) + " dari 3."); render(); }
    }
    function makeAllHoles() {
      var left = [];
      markers.forEach(function (m, k) { if (!m.done) left.push(k); });
      if (!left.length) return;
      busy = true;
      left.forEach(function (k, n) {
        tween(60 + n * 240, function () { }, function () {
          markers[k].done = true; refreshMarkers(true); waterDrop(markers[k].pos);
          if (n === left.length - 1) { busy = false; completeAction(); }
        });
      });
    }
    function tapAt() {
      if (st.phase === "bahan") { var idx = hitItem(); if (idx >= 0) pick(idx); return; }
      if (st.phase !== "langkah" || !cur || cur.done || cur.def.type !== "tap") return;
      var h = hitObj(hitBody); if (!h) return;
      if (h.point.y > 1.4) {
        st.mist++; setFbState("no", "Belum tepat. ", "Lubang ada di bagian bawah."); render();
        return;
      }
      makeAllHoles();
    }

    canvas.addEventListener("pointerdown", function (e) {
      markActive();
      if (demoOn) endDemo();
      if (busy || !st) return;
      setNdc(e);
      down = { x: e.clientX, y: e.clientY };
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      var def = cur.def, keys = Object.keys(def.traps || {}), k;
      for (k = 0; k < keys.length; k++) {
        var tl = tools[keys[k]];
        if (tl && tl.visible && hitObj(tl)) { trap(keys[k], def.traps[keys[k]]); down = null; return; }
      }
      if (def.type === "scrub") {
        drag = { kind: "scrub", lx: e.clientX, ly: e.clientY, tool: def.tool ? tools[def.tool] : null, toolTarget: new V3() };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        moveTool();
        e.preventDefault();
      } else if (def.type === "drag") {
        var t = tools[def.obj];
        if (t && hitObj(t)) {
          drag = { kind: "drag", obj: t };
          dragTarget.copy(t.position); dragTarget.y = LIFT;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
          setTip("");
          e.preventDefault();
        }
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      setNdc(e);
      if (drag.kind === "scrub") {
        scrubTo(e);
      } else if (ray.ray.intersectPlane(plane, tmp)) {
        dragTarget.set(clamp(tmp.x, -5, 5), LIFT, clamp(tmp.z, -4, 4));
      }
    });
    function release(e) {
      var d = drag, was = down; drag = null; down = null;
      if (d) {
        if (d.kind === "scrub") { if (d.tool) goHome(d.tool); }
        else if (cur && !cur.done) {
          var moved = was ? Math.hypot(e.clientX - was.x, e.clientY - was.y) : 99;
          if (moved < 12 || Math.hypot(dragTarget.x, dragTarget.z) < 2.2) completeAction(d.obj); // ketukan atau lepas di dekat botol sudah cukup
          else { goHome(d.obj); setTip("Ketuk bendanya"); }
        }
        return;
      }
      if (e.type === "pointerup" && was && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 14) { setNdc(e); tapAt(); }
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    /* ---- animasi penutup tiap aksi ---- */
    var FIN = {
      clean: function (cb) {
        specks.forEach(function (sp) { sp.visible = false; });
        faucet.visible = false;
        tween(300, function (p) { label.scale.set(1.25 * (1 - p) + 0.01, 1, 1.25 * (1 - p) + 0.01); }, function () { label.visible = false; cb(); });
      },
      cut: function (cb) {
        ring.visible = false; edge.visible = true; hitBody.scale.y = CUT;
        tween(850, function (p) {
          upper.position.set(1.4 * p, CUT + 0.7 * Math.sin(p * Math.PI) + 0.5 * p, 0.3 * p);
          upper.rotation.z = -0.9 * p; setOpacity(upper, 1 - p);
        }, function () { upper.visible = false; cb(); });
      },
      holes: function (cb) { tween(350, function () { }, cb); },
      paint: function (cb) { tween(350, function () { }, cb); },
      soil: function (cb) {
        var o = tools.soil, from = o.position.clone(), to = new V3(0, LIFT + 0.4, 0);
        seq([
          function (n) { tween(300, function (p) { o.position.lerpVectors(from, to, p); }, n); },
          function (n) {
            soilFill.visible = true;
            tween(900, function (p) { o.rotation.z = -1.1 * Math.min(1, p * 2.5); soilFill.scale.y = Math.max(0.001, p); setOpacity(o, 1 - 0.8 * p); }, n);
          },
          function (n) { o.visible = false; n(); }
        ], cb);
      },
      seed: function (cb) {
        var o = tools.seed, from = o.position.clone(), to = new V3(0, LIFT + 0.5, 0);
        seq([
          function (n) { tween(300, function (p) { o.position.lerpVectors(from, to, p); }, n); },
          function (n) { tween(450, function (p) { o.position.y = to.y - 1.0 * p; o.scale.setScalar(1 - 0.8 * p); }, n); },
          function (n) { o.visible = false; plant.visible = true; tween(750, function (p) { plant.scale.setScalar(0.001 + 0.999 * Math.max(0, easeOutBack(p))); }, n); }
        ], cb);
      }
    };

    function completeAction() {
      if (!cur || cur.done) return;
      cur.done = true; endDemo();
      if (drag) { if (drag.tool) goHome(drag.tool); drag = null; }
      busy = true; setTip("");
      var id = cur.id;
      FIN[id](function () { busy = false; afterAction(id); });
    }
    function afterAction(id) {
      var step = STEPS[st.step], last = st.ai === step.acts.length - 1;
      setFbState("ok", "Tepat. ", ACTS[id].ok);
      if (last) { st.stepDone = true; render(); autoT = setTimeout(function () { autoT = null; next(); }, 1400); }
      else {
        st.ai++; render();
        autoT = setTimeout(function () { autoT = null; startAction(); render(); }, 1100);
      }
    }

    /* ---- petunjuk: contoh gerakan di model ---- */
    function gAt(v) { return function (n) { ghost.position.copy(v); n(); }; }
    function gTo(v, dur) { return function (n) { var from = ghost.position.clone(); tween(dur || 500, function (p) { ghost.position.lerpVectors(from, v, p); }, n, null, "demo"); }; }
    function gPress() { return function (n) { tween(300, function (p) { ghost.scale.setScalar(GS * (1 - 0.3 * Math.sin(p * Math.PI))); }, n, null, "demo"); }; }
    function gWait(ms) { return function (n) { tween(ms, function () { }, n, null, "demo"); }; }
    function zig(y, x0, x1, z, n, dur) { var l = []; for (var k = 0; k < n; k++) { l.push(gTo(new V3(x1, y, z), dur)); l.push(gTo(new V3(x0, y, z), dur)); } return l; }
    function endDemo() {
      killTweens("demo"); demoOn = false; ghost.visible = false; ghost.scale.setScalar(GS); demoCarry = null;
      if (demoRestore) { var f = demoRestore; demoRestore = null; f(); }
      if (st && st.phase === "langkah" && cur && !cur.done) tipForAction(); else if (st && st.phase === "bahan") setTip("Ketuk benda");
    }
    function runDemo(list, carry, restore) {
      endDemo(); demoOn = true; demoCarry = carry || null; demoRestore = restore || null;
      ghost.visible = true; ghost.scale.setScalar(GS);
      seq(list, function () { endDemo(); });
    }
    function hint() {
      if (!st || busy || st.phase === "selesai" || st.stepDone) return;
      var msg, list, carry = null, restore = null, l, k;
      if (st.phase === "bahan") {
        var ni = nextCorrect(); if (ni < 0) return;
        var it = items[ni], p = it.position;
        msg = "Ini salah satu yang dipakai: " + MATS[ni].t + ". Ketuk bendanya yang berkedip.";
        it.userData.flashUntil = performance.now() + 3000;
        list = [gAt(new V3(p.x, 1.7, p.z + 0.6)), gTo(new V3(p.x, 0.7, p.z + 0.2), 650), gPress(), gWait(400), gPress(), gWait(300)];
      } else {
        if (!cur || cur.done) return;
        var id = cur.id, def = cur.def;
        msg = def.hint;
        if (id === "clean") list = [gAt(new V3(-0.45, 1.3, 0.95))].concat(zig(1.3, -0.45, 0.45, 0.95, 4, 450));
        else if (id === "cut") {
          list = [gAt(new V3(-0.5, CUT, 0.9))].concat(zig(CUT, -0.5, 0.5, 0.9, 3, 600));
          carry = { obj: tools.cutter, off: new V3(-0.95, 0, 0.05) }; restore = function () { goHome(tools.cutter); };
        } else if (id === "paint") {
          l = [gAt(new V3(-0.45, 0.4, 0.95))];
          for (k = 0; k < 3; k++) { l.push(gTo(new V3(0.45, 0.65 + k * 0.5, 0.95), 450)); l.push(gTo(new V3(-0.45, 0.9 + k * 0.5, 0.95), 450)); }
          list = l; carry = { obj: tools.brush, off: new V3(-0.8, 0, 0.05) }; restore = function () { goHome(tools.brush); };
        } else if (id === "holes") {
          list = [gAt(new V3(0, 0.6, 1.0)), gPress(), gWait(300), gPress(), gWait(300)];
        } else {
          var hp = toolHome[def.obj];
          list = [gAt(new V3(hp.x, 1.2, hp.z + 0.3)), gTo(new V3(hp.x, 0.6, hp.z), 600), gPress(), gWait(300), gPress(), gWait(300)];
        }
      }
      st.hints++;
      setFbState("hint", "Petunjuk: ", msg); render();
      setTip(msg);
      runDemo(list, carry, restore);
      markActive();
    }

    /* ---- selesaikan aksi lewat tombol (alternatif bagi yang sulit menggeser atau menyeret) ---- */
    function force() {
      if (!st || busy) return;
      if (st.phase === "bahan") { var ni = nextCorrect(); if (ni >= 0) { st.skips++; pick(ni); } return; }
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      st.skips++;
      var def = cur.def;
      if (def.type === "scrub") { cur.p = def.need; applyScrub(); completeAction(); }
      else if (def.type === "tap") { makeAllHoles(); }
      else { var o = tools[def.obj]; dragTarget.set(0, LIFT, 0); o.position.set(0, LIFT, 0); completeAction(); }
    }

    function next() {
      if (!st || busy) return;
      if (st.phase === "bahan") {
        if (Object.keys(st.picked).length < MAT_NEED) return;
        st.fb = null; st.phase = "langkah"; st.step = 0; st.ai = 0; st.stepDone = false;
        setTip(""); render();
        enterWork(function () { startAction(); render(); });
        return;
      }
      if (st.phase === "langkah" && st.stepDone) {
        st.fb = null;
        if (st.step === STEPS.length - 1) { finishAll(); return; }
        st.step++; st.ai = 0; st.stepDone = false;
        startAction(); render();
      }
    }
    function finishAll() {
      st.phase = "selesai"; st.stepDone = false; cur = null; setFbState(null);
      canvas.style.touchAction = "pan-y"; setTip(""); render();
      if (nudgeT) clearTimeout(nudgeT); $("d3-hint").classList.remove("pulse");
      try { window.dispatchEvent(new CustomEvent("daur3d:finish", { detail: { salah: st.mist, petunjuk: st.hints, lewati: st.skips } })); } catch (e) { }
    }

    /* ---- mulai dari awal ---- */
    function resetBottle() {
      bottle.visible = false; bottle.rotation.y = 0; bottle.scale.setScalar(1);
      upper.visible = true; upper.position.set(0, CUT, 0); upper.rotation.set(0, 0, 0); setOpacity(upper, 1);
      specks.forEach(function (s) { s.visible = true; s.scale.set(1.3, 1, 0.35); });
      label.visible = true; label.scale.set(1, 1, 1); label.position.set(0, 0, 0); label.rotation.set(0, 0, 0); setOpacity(label, 1);
      paint.visible = false; paint.scale.y = 0.001;
      dashes.forEach(function (dd) { dd.m.material.color.set(0xc23b2e); dd.m.scale.y = 1; });
      ring.visible = false; edge.visible = false; faucet.visible = false;
      markers.forEach(function (m) { m.done = false; m.halo.scale.setScalar(1); });
      refreshMarkers(false);
      soilFill.visible = false; soilFill.scale.y = 0.001; plant.visible = false; plant.scale.setScalar(0.001);
      hitBody.scale.y = TOP;
    }
    function resetItems() {
      slotOf = shuffle(range(MATS.length));
      items.forEach(function (it) {
        it.visible = true; it.scale.setScalar(1); it.rotation.set(0, 0, 0); setOpacity(it, 1);
        it.userData.ring.visible = false; it.userData.ring.material.opacity = 0; it.userData.label.visible = true; it.userData.fl = false;
      });
      placeItems();
    }
    function resetTools() {
      Object.keys(tools).forEach(function (k) {
        var t = tools[k]; t.visible = false; t.scale.setScalar(1); t.rotation.set(0, 0, 0); setOpacity(t, 1); t.position.copy(toolHome[k]);
      });
    }
    function begin() {
      if (autoT) { clearTimeout(autoT); autoT = null; }
      endDemo(); tweens.length = 0;
      busy = false; drag = null; down = null; cur = null;
      st = newState();
      resetBottle(); resetItems(); resetTools();
      blend = 0; updateCam();
      canvas.style.touchAction = "pan-y";
      render(); setTip("Ketuk benda"); markActive();
    }

    /* ---- render ---- */
    function frame(now) {
      requestAnimationFrame(frame);
      if (!canvas.offsetParent) return; // layar sedang tersembunyi
      for (var i = tweens.length - 1; i >= 0; i--) {
        var t = tweens[i]; if (!t) continue;
        var p = clamp((now - t.t0) / t.dur, 0, 1);
        t.fn(t.ease(p));
        if (p >= 1) { var at = tweens.indexOf(t); if (at >= 0) tweens.splice(at, 1); if (t.done) t.done(); }
      }
      if (demoCarry) demoCarry.obj.position.set(ghost.position.x + demoCarry.off.x, ghost.position.y + demoCarry.off.y, ghost.position.z + demoCarry.off.z);
      if (drag) {
        if (drag.kind === "drag") {
          var o = drag.obj, vx = dragTarget.x - o.position.x;
          o.position.lerp(dragTarget, 0.3);
          o.rotation.z += (-clamp(vx * 0.35, -0.6, 0.6) - o.rotation.z) * 0.2;
        } else if (drag.tool) {
          drag.tool.position.lerp(drag.toolTarget, 0.35);
        }
      }
      if (!reduce) {
        markers.forEach(function (m) { if (!m.done && m.halo.visible) m.halo.scale.setScalar(1 + 0.3 * Math.sin(now / 220)); });
        if (faucet.visible) drops.forEach(function (dp, k) { dp.position.y = 4.3 - (((now / 650) + k / drops.length) % 1) * 3.7; });
      } else if (faucet.visible) drops.forEach(function (dp, k) { dp.position.y = 4.3 - (k / drops.length) * 3.7; });
      items.forEach(function (it) {
        var u = it.userData;
        if (u.flashUntil > now) { u.fl = true; it.scale.setScalar(1 + 0.12 * Math.sin(now / 90)); }
        else if (u.fl) { u.fl = false; it.scale.setScalar(1); }
      });
      if (st && st.phase === "selesai" && !reduce) bottle.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage); else window.addEventListener("resize", layout);
    V = { pick: pick, hint: hint, force: force, next: next, begin: begin };
    begin();
    requestAnimationFrame(frame);
  }

  /* adegan dibuat sekali, saat layar info pertama kali tampil (ukuran kanvas baru bisa dibaca saat terlihat) */
  var built = false;
  function tryBuild() {
    if (built || !stage.clientWidth) return;
    built = true;
    if (!(window.THREE && webglOk())) { showNoGl(); return; }
    try { start(); } catch (e) { console.error("daur3d:", e); V = null; showNoGl(); }
  }
  if (window.ResizeObserver) new ResizeObserver(tryBuild).observe(stage); else window.setInterval(tryBuild, 600);
  tryBuild();
})();


/* ===== daur3d2.js ===== */
/* Latihan daur ulang 3D kedua: tempat pensil dari kaleng bekas (layar info di index.html).
   Pola sama dengan daur3d.js (pot dari botol): pilih bahan, lalu kerjakan tiap langkah langsung pada model 3D
   dengan menggosok, mengetuk, dan menyeret. Tombol Petunjuk memutar contoh gerakan di model yang sama.
   Panel memakai id berawalan "k3-". Tidak ada data yang dikirim ke server.
   Saat selesai, window menerima event "daur3d2:finish" { salah, petunjuk, lewati }.
   Semua teks disisipkan dengan textContent. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("k3-stage");
  if (!stage) return;

  var FALLBACK = { "--soft": "#E3EADF", "--accent": "#1B6A47" };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function cssVar(n) {
    var v = "";
    try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { }
    return v || FALLBACK[n] || "#888888";
  }
  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= data ================= */
  var OTHER = "Tidak dipakai di sini.";
  var MATS = [
    { k: "kaleng", t: "Kaleng minuman bekas, bersih", s: "Kaleng bekas", ok: 1 },
    { k: "lakban", t: "Lakban kertas untuk menutup tepi", s: "Lakban", ok: 1 },
    { k: "kertas", t: "Kertas bungkus atau kardus tipis", s: "Kertas bungkus", ok: 1 },
    { k: "lem", t: "Lem kertas", s: "Lem", ok: 1 },
    { k: "pensil", t: "Pensil dan pulpen", s: "Pensil", ok: 1 },
    { k: "blender", t: "Blender dan baskom air", s: "Blender", fb: OTHER },
    { k: "baterai", t: "Baterai bekas", s: "Baterai", fb: "Baterai itu B3, bukan bahan kerajinan." }
  ];
  var MAT_NEED = MATS.filter(function (m) { return m.ok; }).length;

  var T_CLEAN = "Bersihkan kaleng dulu.";
  var T_RIM = "Lapisi tepi dulu.";
  var T_GLUE = "Oleskan lem dulu.";
  var T_LAST = "Pensil dimasukkan paling akhir.";

  /* type: scrub (geser di kaleng), tap (ketuk), drag (seret atau ketuk benda).
     traps: alat yang belum waktunya dipakai. Kalau disentuh, muncul umpan balik dan dihitung salah. */
  var ACTS = {
    clean: { type: "scrub", need: 1.0, title: "Bersihkan kaleng", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik di layar sampai kaleng bersih.",
      ok: "Kaleng bersih, label lepas.", traps: { lem: T_CLEAN, paper: T_CLEAN, pens: T_LAST } },
    rim: { type: "tap", title: "Lapisi tepi kaleng", text: "Ketuk bagian atas kaleng.",
      tip: "Ketuk tepi atas", hint: "Ketuk tepi atas kaleng. Lakban menutup bagian yang tajam.",
      ok: "Tepi tertutup lakban, aman dipegang.", traps: { lem: T_RIM, paper: T_RIM, pens: T_LAST } },
    glue: { type: "scrub", need: 1.0, tool: "lem", title: "Oleskan lem", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik. Lem dioleskan di sekeliling kaleng.",
      ok: "Lem sudah merata.", traps: { paper: T_GLUE, pens: T_LAST } },
    paper: { type: "drag", obj: "paper", title: "Bungkus dengan kertas", text: "Ketuk gulungan kertas.",
      tip: "Ketuk kertas", hint: "Ketuk gulungan kertas di sisi kanan.",
      ok: "Kertas membungkus kaleng.", traps: { pens: T_LAST } },
    pens: { type: "drag", obj: "pens", title: "Masukkan alat tulis", text: "Ketuk pensil.",
      tip: "Ketuk pensil", hint: "Ketuk pensil di sisi kanan.",
      ok: "Pensil masuk ke kaleng.", traps: {} }
  };
  var STEPS = [
    { acts: ["clean"], d: "Kaleng bersih." },
    { acts: ["rim"], d: "Tepi kaleng aman.", warn: "Tepi kaleng tajam, hati-hati." },
    { acts: ["glue", "paper"], d: "Kaleng terbungkus kertas." },
    { acts: ["pens"], d: "Tempat pensil siap dipakai." }
  ];
  var DONE = "Kaleng bekas jadi tempat pensil.";

  /* ================= antarmuka ================= */
  var V = null;
  var st = null;

  function newState() {
    return { phase: "bahan", step: 0, ai: 0, stepDone: false, picked: {}, bad: {}, mist: 0, hints: 0, skips: 0, fb: null, order: shuffle(range(MATS.length)) };
  }
  function setFbState(cls, strong, text) { if (st) st.fb = cls ? [cls, strong, text] : null; }

  function render() {
    if (!st) return;
    var n = STEPS.length, pct = 0, warn = $("k3-warn");
    warn.hidden = true; $("k3-next").hidden = true; $("k3-mist").textContent = "";
    var got = Object.keys(st.picked).length;
    var playing = st.phase === "bahan" ? got < MAT_NEED : (st.phase === "langkah" && !st.stepDone);
    $("k3-hint").hidden = !playing; $("k3-skip").hidden = !playing;
    if (st.phase === "bahan") {
      $("k3-phase").textContent = "Bahan";
      $("k3-title").textContent = "Pilih bahan";
      $("k3-text").textContent = "Ketuk " + MAT_NEED + " benda yang dipakai. Terpilih " + got + " dari " + MAT_NEED + ".";
      pct = (got / MAT_NEED) / (n + 1) * 100;
    } else if (st.phase === "langkah") {
      var step = STEPS[st.step], def = ACTS[step.acts[st.ai]];
      $("k3-phase").textContent = "Langkah " + (st.step + 1) + " dari " + n;
      if (st.stepDone) { $("k3-title").textContent = "Selesai"; $("k3-text").textContent = step.d; }
      else { $("k3-title").textContent = def.title; $("k3-text").textContent = def.text; }
      if (step.warn && !st.stepDone) { warn.hidden = false; warn.textContent = step.warn; }
      pct = (1 + st.step + (st.stepDone ? 1 : st.ai / step.acts.length)) / (n + 1) * 100;
    } else {
      pct = 100;
      $("k3-phase").textContent = "Selesai";
      $("k3-title").textContent = "Tempat pensil jadi!";
      $("k3-text").textContent = DONE + " Salah: " + st.mist + ". Petunjuk: " + st.hints + ".";
    }
    $("k3-bar").style.width = pct + "%";
    var fb = $("k3-fb"); fb.textContent = "";
    fb.hidden = !st.fb;
    if (st.fb) {
      var b = document.createElement("b"); b.className = st.fb[0]; b.textContent = st.fb[1]; fb.appendChild(b);
      fb.appendChild(document.createTextNode(st.fb[2] || ""));
    }
  }

  function showNoGl() { $("k3-nogl").hidden = false; $("k3-body").hidden = true; }

  $("k3-hint").addEventListener("click", function () { if (V) V.hint(); });
  $("k3-skip").addEventListener("click", function () { if (V) V.force(); });
  $("k3-next").addEventListener("click", function () { if (V) V.next(); });
  $("k3-reset").addEventListener("click", function () { if (V) V.begin(); });

  /* ================= adegan 3D ================= */
  function start() {
    var canvas = $("k3-canvas");
    var V3 = THREE.Vector3, PI = Math.PI;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.65));
    var sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe3eadf, roughness: 1 });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), floorMat);
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; scene.add(floor);
    function applyTheme() { floorMat.color.set(cssVar("--soft")); }
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { }
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { }

    /* ---- alat bantu ---- */
    function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {})); }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function invisibleMat() { return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function setOpacity(obj, f) {
      obj.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material;
        if (m.userData.base === undefined) { m.userData.base = m.opacity; m.userData.tr = m.transparent; }
        m.transparent = m.userData.tr || f < 1;
        m.opacity = m.userData.base * f;
      });
    }

    /* ---- animasi ---- */
    var tweens = [];
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function tween(dur, fn, done, ease, owner) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut, owner: owner || "" }); }
    function killTweens(owner) { for (var i = tweens.length - 1; i >= 0; i--) if (tweens[i].owner === owner) tweens.splice(i, 1); }
    function seq(list, done) {
      var i = 0;
      (function nxt() { if (i >= list.length) { if (done) done(); return; } list[i++](nxt); })();
    }
    function moveTo(obj, to, dur, done, arc) {
      var from = obj.position.clone();
      tween(dur, function (p) { obj.position.lerpVectors(from, to, p); if (arc) obj.position.y += Math.sin(p * PI) * arc; }, done);
    }
    function popIn(o, dur) { o.visible = true; tween(dur || 380, function (p) { o.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { o.scale.setScalar(1); }); }

    /* ---- ukuran dan bentuk kaleng ---- */
    var R = 0.85, H = 2.0, LIFT = 2.6, TAPE_Z = 1.3;
    function metal() { return M(0xb9c2c9, { metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }); }

    var can = new THREE.Group(); can.visible = false; scene.add(can);
    can.add(mesh(new THREE.CylinderGeometry(R, R, H, 40, 1, true), metal(), 0, H / 2, 0));
    var base = mesh(new THREE.CircleGeometry(R, 40), metal(), 0, 0.01, 0); base.rotation.x = -PI / 2; can.add(base);
    var rimTorus = mesh(new THREE.TorusGeometry(R, 0.035, 8, 48), M(0xdde3e8, { metalness: 0.5, roughness: 0.3 }), 0, H, 0); rimTorus.rotation.x = PI / 2; can.add(rimTorus);
    can.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // noda kotor
    var specks = [], i;
    for (i = 0; i < 14; i++) {
      var th = ((i * 0.37) % 1) * 2.3 - 1.15, sy = 0.25 + ((i * 0.53) % 1) * 1.5;
      var sp = mesh(new THREE.SphereGeometry(0.07, 8, 6), M(0x7a5a2e, { roughness: 1 }), Math.sin(th) * (R + 0.015), sy, Math.cos(th) * (R + 0.015));
      sp.rotation.y = th; can.add(sp); specks.push(sp);
    }

    // label "SODA"
    var label = new THREE.Group(); can.add(label);
    label.add(mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 1.1, 40, 1, true), M(0xd23a2f, { roughness: 0.5 }), 0, 1.0, 0));
    (function () {
      var cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
      var c = cv.getContext("2d"); c.fillStyle = "#fff"; c.font = '800 70px Arial, sans-serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("SODA", 128, 68);
      var tx = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true });
      label.add(mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.55, 20, 1, true, -0.6, 1.2), tx, 0, 1.0, 0));
    })();

    // titik di tepi atas (ketuk untuk melapisi)
    var rimMarks = new THREE.Group(), halos = [];
    rimMarks.visible = false; can.add(rimMarks);
    for (i = 0; i < 8; i++) {
      var ra = i / 8 * PI * 2;
      var rg = new THREE.Group(); rg.position.set(Math.sin(ra) * R, H + 0.03, Math.cos(ra) * R);
      rg.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 0, 0));
      var halo = mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0);
      halo.rotation.x = -PI / 2; rg.add(halo); halos.push(halo); rimMarks.add(rg);
    }

    // lakban di tepi
    var tape = mesh(new THREE.TorusGeometry(R + 0.01, 0.09, 10, 48), M(0xe6cf93, { roughness: 0.6 }), 0, H - 0.02, 0);
    tape.rotation.x = PI / 2; tape.scale.z = 0.001; tape.visible = false; tape.castShadow = true; can.add(tape);

    // lem
    var glue = new THREE.Group(); glue.visible = false; glue.scale.y = 0.001; can.add(glue);
    var gg = new THREE.CylinderGeometry(R + 0.025, R + 0.025, H - 0.3, 40, 1, true); gg.translate(0, 0.08 + (H - 0.3) / 2, 0);
    glue.add(new THREE.Mesh(gg, M(0xfff6d6, { roughness: 0.3, transparent: true, opacity: 0.7, side: THREE.DoubleSide })));

    // kertas pembungkus: dibuat bertahap supaya terlihat melingkar
    function paperTexture() {
      var cv = document.createElement("canvas"); cv.width = 256; cv.height = 128;
      var c = cv.getContext("2d");
      c.fillStyle = "#F4B942"; c.fillRect(0, 0, 256, 128);
      c.fillStyle = "#E98A15"; for (var x = 0; x < 256; x += 64) c.fillRect(x, 0, 12, 128);
      c.fillStyle = "#2E7D4F";
      for (var r = 0; r < 3; r++) for (var q = 0; q < 4; q++) { c.beginPath(); c.arc(32 + q * 64 + (r % 2) * 20, 24 + r * 40, 9, 0, PI * 2); c.fill(); }
      var t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return t;
    }
    var PH = H - 0.2, PR = R + 0.05, wrapTex = paperTexture();
    function wrapGeo(p) {
      var g = new THREE.CylinderGeometry(PR, PR, PH, 48, 1, true, 0, Math.max(0.001, p) * PI * 2);
      g.translate(0, 0.08 + PH / 2, 0); return g;
    }
    var paperMesh = new THREE.Mesh(wrapGeo(1), M(0xffffff, { map: wrapTex, roughness: 0.8, side: THREE.DoubleSide }));
    paperMesh.visible = false; paperMesh.castShadow = true; can.add(paperMesh);
    function setWrap(p) {
      var old = paperMesh.geometry; paperMesh.geometry = wrapGeo(p); old.dispose();
      wrapTex.repeat.x = Math.max(0.01, p) * 2;
    }

    // pensil di dalam kaleng
    var pencilsIn = new THREE.Group(); pencilsIn.visible = false; can.add(pencilsIn);
    function pencil(col) {
      var g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10), M(col), 0, 1.2, 0));
      g.add(mesh(new THREE.ConeGeometry(0.06, 0.3, 10), M(0xe8c48a), 0, 2.55, 0));
      g.add(mesh(new THREE.ConeGeometry(0.024, 0.1, 8), M(0x333333), 0, 2.75, 0));
      g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    [[-0.3, -0.15, 0.12, 0.05, 0xf2c230], [-0.05, 0.2, -0.05, 0.1, 0xd23a2f], [0.25, 0, -0.15, -0.08, 0x1e66c8], [0.12, -0.28, 0.05, -0.12, 0x3f9b4a], [-0.25, 0.2, 0.1, 0.14, 0xe0688a]].forEach(function (a) {
      var pg = pencil(a[4]); pg.position.set(a[0], 0.15, a[1]); pg.rotation.z = a[2]; pg.rotation.x = a[3]; pencilsIn.add(pg);
    });

    // badan kaleng yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = H + 0.3; can.add(hitBody);

    // keran air untuk bilas
    var faucet = new THREE.Group(), drops = [];
    var steel = M(0xaab2ba, { metalness: 0.7, roughness: 0.3 });
    faucet.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.6, 14), steel, 1.1, 3.8, -0.6));
    var arm = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.3, 14), steel, 0.5, 4.6, -0.6); arm.rotation.z = PI / 2; faucet.add(arm);
    faucet.add(mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.35, 14), steel, -0.1, 4.45, -0.6));
    for (i = 0; i < 8; i++) {
      var dr = mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x5ab2e0 }), ((i * 0.37) % 1 - 0.5) * 0.9, 3, R + 0.04);
      dr.scale.y = 1.7; faucet.add(dr); drops.push(dr);
    }
    faucet.position.y = -0.9; // lebih rendah daripada di latihan botol karena kaleng lebih pendek
    faucet.visible = false; scene.add(faucet);

    /* ---- benda di meja: bahan dan alat ---- */
    var MODEL = {
      kaleng: function (g) {
        var al = M(0xc9ced3, { metalness: 0.6, roughness: 0.3 });
        g.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.85, 28), al, 0, 0.43, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.4, 28), M(0xd23a2f, { metalness: 0.3, roughness: 0.4 }), 0, 0.45, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 28), al, 0, 0.88, 0));
      },
      lakban: function (g) {
        var tp = mesh(new THREE.TorusGeometry(0.3, 0.13, 10, 28), M(0xe6cf93, { roughness: 0.6 }), 0, 0.14, 0); tp.rotation.x = PI / 2; g.add(tp);
        g.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 20), M(0xcfd3d6), 0, 0.08, 0));
      },
      kertas: function (g) {
        var tx = paperTexture(); tx.repeat.set(1.5, 1);
        g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 24), M(0xffffff, { map: tx, roughness: 0.8 }), 0, 0.45, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20), M(0xf6f1e4), 0, 0.9, 0));
      },
      lem: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.6, 18), M(0xf4f4f0), 0, 0.3, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.24, 18), M(0xe9801b), 0, 0.72, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.14, 18), M(0x1e66c8), 0, 0.3, 0));
      },
      lemtool: function (g) { // botol lem berbaring, ujung lancip ke kanan
        var body = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.0, 18), M(0xf4f4f0), 0, 0.16, 0); body.rotation.z = PI / 2; g.add(body);
        var band = mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.22, 18), M(0x1e66c8), -0.1, 0.16, 0); band.rotation.z = PI / 2; g.add(band);
        var tip = mesh(new THREE.CylinderGeometry(0.03, 0.14, 0.3, 18), M(0xe9801b), 0.65, 0.16, 0); tip.rotation.z = -PI / 2; g.add(tip);
      },
      pensil: function (g) {
        [[-0.12, 0, 0.06, 0xf2c230], [0.02, 0.1, -0.05, 0xd23a2f], [0.14, -0.04, 0.1, 0x1e66c8], [-0.02, -0.12, -0.08, 0x3f9b4a]].forEach(function (a) {
          var p = new THREE.Group(); p.position.set(a[0], 0, a[1]); p.rotation.z = a[2];
          p.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 10), M(a[3]), 0, 0.4, 0));
          p.add(mesh(new THREE.ConeGeometry(0.05, 0.2, 10), M(0xe8c48a), 0, 0.9, 0));
          p.add(mesh(new THREE.ConeGeometry(0.02, 0.07, 8), M(0x333333), 0, 1.03, 0));
          g.add(p);
        });
      },
      blender: function (g) {
        g.add(mesh(new THREE.BoxGeometry(0.8, 0.4, 0.8), M(0x2b3036), 0, 0.2, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.9, 20), M(0xdcecf5, { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.85, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), M(0x2b3036), 0, 1.34, 0));
      },
      baterai: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.75, 20), M(0x2b8a3e, { roughness: 0.5 }), 0, 0.38, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 20), M(0x1b1b1b), 0, 0.18, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), M(0xd4af37, { metalness: 0.6, roughness: 0.3 }), 0, 0.79, 0));
      }
    };
    function buildObj(key, hitR, hitY) {
      var g = new THREE.Group(); MODEL[key](g);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(mesh(new THREE.SphereGeometry(hitR || 0.85, 12, 8), invisibleMat(), 0, hitY === undefined ? 0.45 : hitY, 0));
      scene.add(g); return g;
    }
    function labelSprite(txt) {
      var cv = document.createElement("canvas"); cv.width = 320; cv.height = 80;
      var c = cv.getContext("2d");
      c.fillStyle = "rgba(10,22,18,0.88)"; roundRect(c, 4, 8, 312, 64, 14); c.fill();
      var fs = 36; c.font = "700 " + fs + "px Arial, sans-serif";
      while (fs > 20 && c.measureText(txt).width > 276) { fs -= 2; c.font = "700 " + fs + "px Arial, sans-serif"; }
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 160, 42);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5; scene.add(sp); return sp;
    }
    var items = MATS.map(function (m, idx) {
      var g = buildObj(m.k, 0.8, 0.45);
      var r = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.76, 36), new THREE.MeshBasicMaterial({ color: 0x2e7d4f, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      r.rotation.x = -PI / 2; r.visible = false; scene.add(r);
      g.userData = { idx: idx, ring: r, label: labelSprite(m.s), flashUntil: 0, fl: false };
      return g;
    });
    var tools = { lem: buildObj("lemtool", 0.8, 0.2), paper: buildObj("kertas", 0.7, 0.45), pens: buildObj("pensil", 0.7, 0.5) };
    Object.keys(tools).forEach(function (k) { tools[k].userData.key = k; tools[k].visible = false; });

    /* ---- penunjuk jari untuk petunjuk ---- */
    var GS = 0.9, ghost = (function () {
      var cv = document.createElement("canvas"); cv.width = cv.height = 128; var c = cv.getContext("2d");
      c.beginPath(); c.arc(64, 64, 52, 0, PI * 2); c.fillStyle = "rgba(255,255,255,0.4)"; c.fill();
      c.lineWidth = 8; c.strokeStyle = cssVar("--accent"); c.stroke();
      c.beginPath(); c.arc(64, 64, 18, 0, PI * 2); c.fillStyle = cssVar("--accent"); c.fill();
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      s.scale.setScalar(GS); s.renderOrder = 20; s.visible = false; scene.add(s); return s;
    })();

    /* ---- kamera dan tata letak ---- */
    var poseA, poseB, blend = 0, slots = [], slotOf = shuffle(range(MATS.length)), toolHome = {};
    function distOf(p) { var t = Math.tan(camera.fov * PI / 360); return Math.max(8, p.halfW / (t * camera.aspect), p.halfH / t); }
    function updateCam() {
      var k = blend, look = new V3().lerpVectors(poseA.look, poseB.look, k);
      var dist = distOf(poseA) * (1 - k) + distOf(poseB) * k;
      var dir = new V3(0, poseA.ey * (1 - k) + poseB.ey * k, poseA.ez * (1 - k) + poseB.ez * k).normalize();
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look); camera.updateProjectionMatrix();
    }
    function placeItems() {
      items.forEach(function (it, idx) {
        var s = slots[slotOf[idx]], u = it.userData;
        it.position.set(s[0], 0, s[1]);
        u.label.position.set(s[0], 0.12, s[1] + 0.95);
        u.ring.position.set(s[0], 0.03, s[1]);
      });
    }
    function placeTools() {
      Object.keys(tools).forEach(function (k) {
        if (!busy && !drag && !demoCarry) tools[k].position.copy(toolHome[k]);
      });
    }
    function layout() {
      var w = stage.clientWidth || 600, h = stage.clientHeight || 400, xT;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (camera.aspect >= 1.3) {
        poseA = { look: new V3(0, 0.5, 0.3), halfW: 6.6, halfH: 3.2, ey: 0.8, ez: 0.75 };
        poseB = { look: new V3(0, 1.3, 0), halfW: 4.8, halfH: 2.9, ey: 0.55, ez: 1.0 };
        slots = range(7).map(function (j) { return [(j - 3) * 1.75, 0.4]; });
        xT = 3.0;
      } else {
        poseA = { look: new V3(0, 0.2, -0.2), halfW: 3.6, halfH: 3.4, ey: 1.0, ez: 0.55 };
        poseB = { look: new V3(0, 1.3, 0), halfW: 3.3, halfH: 2.9, ey: 0.55, ez: 1.0 };
        slots = [[-2.55, -1.6], [-0.85, -1.6], [0.85, -1.6], [2.55, -1.6], [-1.7, 1.1], [0, 1.1], [1.7, 1.1]];
        xT = 2.2;
      }
      toolHome = { lem: new V3(-xT, 0, 0.3), paper: new V3(xT, 0, 0.7), pens: new V3(xT, 0, -1.0) };
      updateCam();
      if (st && st.phase === "bahan") placeItems();
      placeTools();
    }

    /* ---- membaca sentuhan ---- */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    var dragTarget = new THREE.Vector3();
    var cur = null, busy = false, drag = null, down = null;
    var demoOn = false, demoCarry = null, demoRestore = null;
    var autoT = null, nudgeT = null, tipT = null;

    function setNdc(e) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function hitObj(obj) { var r = ray.intersectObject(obj, true); return r.length ? r[0] : null; }
    function hitItem() {
      var best = -1, bd = 1e9;
      items.forEach(function (it, idx) {
        if (!it.visible) return;
        var h = ray.intersectObject(it, true);
        if (h.length && h[0].distance < bd) { bd = h[0].distance; best = idx; }
      });
      return best;
    }

    /* ---- teks kecil di atas adegan dan tombol petunjuk ---- */
    function setTip(text) {
      var tip = $("k3-tip");
      if (tipT) { clearTimeout(tipT); tipT = null; }
      tip.textContent = text || "";
      tip.classList.toggle("gone", !text);
      if (text) tipT = setTimeout(function () { tip.classList.add("gone"); }, 7000);
    }
    function markActive() {
      if (nudgeT) clearTimeout(nudgeT);
      $("k3-hint").classList.remove("pulse");
      nudgeT = setTimeout(function () { if (st && st.phase !== "selesai" && !st.stepDone) $("k3-hint").classList.add("pulse"); }, 15000);
    }
    function tipForAction() { setTip(cur ? cur.def.tip : ""); }

    /* ---- gerak kecil ---- */
    function shake(o) { var bx = o.position.x; tween(320, function (p) { o.position.x = bx + Math.sin(p * 20) * 0.14 * (1 - p); }, function () { o.position.x = bx; }); }
    function goHome(o) {
      var home = toolHome[o.userData.key], rz = o.rotation.z;
      moveTo(o, home.clone(), 420, null, 0.7);
      tween(420, function (p) { o.rotation.z = rz * (1 - p); });
    }

    /* ---- bahan ---- */
    function markItem(idx, kind) {
      var it = items[idx], r = it.userData.ring;
      r.material.color.set(kind === "ok" ? 0x2e7d4f : 0xc23b2e); r.material.opacity = 0.95; r.visible = true;
      if (kind === "bad") { setOpacity(it, 0.35); shake(it); }
      else tween(320, function (p) { it.position.y = Math.sin(p * PI) * 0.3; }, function () { it.position.y = 0; });
    }
    function pick(idx) {
      if (!st || st.phase !== "bahan" || busy || st.picked[idx] || st.bad[idx]) return;
      if (Object.keys(st.picked).length >= MAT_NEED) return;
      var m = MATS[idx];
      if (m.ok) { st.picked[idx] = 1; markItem(idx, "ok"); setFbState("ok", "Tepat. ", m.s + " dipakai."); }
      else { st.bad[idx] = 1; st.mist++; markItem(idx, "bad"); setFbState("no", "Belum tepat. ", m.fb); }
      render(); markActive();
      if (Object.keys(st.picked).length >= MAT_NEED) autoT = setTimeout(function () { autoT = null; next(); }, 1200);
    }
    function nextCorrect() {
      for (var k = 0; k < st.order.length; k++) { var mi = st.order[k]; if (MATS[mi].ok && !st.picked[mi]) return mi; }
      return -1;
    }

    /* ---- pindah dari bahan ke langkah ---- */
    function enterWork(cb) {
      busy = true;
      seq([
        function (n) {
          items.forEach(function (it) {
            tween(300, function (p) { it.scale.setScalar(1 - p); }, function () { it.visible = false; it.userData.label.visible = false; it.userData.ring.visible = false; });
          });
          tween(320, function () { }, n);
        },
        function (n) {
          can.visible = true; can.scale.setScalar(0.01);
          tween(450, function (p) { can.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { can.scale.setScalar(1); });
          Object.keys(tools).forEach(function (k) { tools[k].position.copy(toolHome[k]); popIn(tools[k], 450); });
          tween(800, function (p) { blend = p; updateCam(); }, n);
        }
      ], function () { busy = false; cb(); });
    }

    /* ---- aksi ---- */
    function startAction() {
      var id = STEPS[st.step].acts[st.ai];
      cur = { id: id, def: ACTS[id], p: 0, done: false };
      faucet.visible = id === "clean";
      rimMarks.visible = id === "rim";
      canvas.style.touchAction = (cur.def.type === "tap") ? "pan-y" : "none";
      tipForAction(); markActive();
    }

    function applyScrub() {
      var f = Math.min(1, cur.p / cur.def.need);
      if (cur.id === "clean") {
        var g1 = Math.min(1, f * 2), g2 = Math.max(0, f * 2 - 1);
        specks.forEach(function (sp, k) { var v = clamp(1 - (g1 * specks.length - k), 0, 1); sp.visible = v > 0.02; sp.scale.set(1.3 * v, v, 0.35 * v); });
        label.scale.set(1 + 0.25 * g2, 1, 1 + 0.25 * g2); label.position.y = 0.2 * g2; label.rotation.y = g2 * 0.5; setOpacity(label, 1 - 0.85 * g2);
        faucet.visible = g1 < 1;
      } else if (cur.id === "glue") {
        glue.visible = f > 0; glue.scale.y = Math.max(0.001, f);
      }
    }
    var toolPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(R + 0.35));
    function moveTool() { // alat mengikuti jari, selalu di depan kaleng dan tidak perlu tepat
      if (!drag.tool || !ray.ray.intersectPlane(toolPlane, tmp)) return;
      drag.toolTarget.set(clamp(tmp.x, -1.7, 1.7) - 0.95, clamp(tmp.y, 0.3, H - 0.2), R + 0.35);
    }
    function scrubTo(e) { // kemajuan = jarak geser jari di layar, di mana pun di kanvas
      var r = canvas.getBoundingClientRect(), unit = Math.min(r.width, 600);
      cur.p += Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / unit;
      drag.lx = e.clientX; drag.ly = e.clientY;
      moveTool(); applyScrub();
      if (cur.p >= cur.def.need) completeAction();
    }
    function trap(key, msg) {
      shake(tools[key]); st.mist++;
      setFbState("no", "Belum tepat. ", msg); render();
    }
    function tapAt() {
      if (st.phase === "bahan") { var idx = hitItem(); if (idx >= 0) pick(idx); return; }
      if (st.phase !== "langkah" || !cur || cur.done || cur.def.type !== "tap") return;
      var h = hitObj(hitBody); if (!h) return;
      if (h.point.y < H - 0.9) {
        st.mist++; setFbState("no", "Belum tepat. ", "Tepi ada di bagian atas kaleng."); render();
        return;
      }
      completeAction();
    }

    canvas.addEventListener("pointerdown", function (e) {
      markActive();
      if (demoOn) endDemo();
      if (busy || !st) return;
      setNdc(e);
      down = { x: e.clientX, y: e.clientY };
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      var def = cur.def, keys = Object.keys(def.traps || {}), k;
      for (k = 0; k < keys.length; k++) {
        var tl = tools[keys[k]];
        if (tl && tl.visible && hitObj(tl)) { trap(keys[k], def.traps[keys[k]]); down = null; return; }
      }
      if (def.type === "scrub") {
        drag = { kind: "scrub", lx: e.clientX, ly: e.clientY, tool: def.tool ? tools[def.tool] : null, toolTarget: new V3() };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        moveTool();
        e.preventDefault();
      } else if (def.type === "drag") {
        var t = tools[def.obj];
        if (t && hitObj(t)) {
          drag = { kind: "drag", obj: t };
          dragTarget.copy(t.position); dragTarget.y = LIFT;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
          setTip("");
          e.preventDefault();
        }
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      setNdc(e);
      if (drag.kind === "scrub") {
        scrubTo(e);
      } else if (ray.ray.intersectPlane(plane, tmp)) {
        dragTarget.set(clamp(tmp.x, -5, 5), LIFT, clamp(tmp.z, -4, 4));
      }
    });
    function release(e) {
      var d = drag, was = down; drag = null; down = null;
      if (d) {
        if (d.kind === "scrub") { if (d.tool) goHome(d.tool); }
        else if (cur && !cur.done) {
          var moved = was ? Math.hypot(e.clientX - was.x, e.clientY - was.y) : 99;
          if (moved < 12 || Math.hypot(dragTarget.x, dragTarget.z) < 2.2) completeAction(); // ketukan atau lepas di dekat kaleng sudah cukup
          else { goHome(d.obj); setTip("Ketuk bendanya"); }
        }
        return;
      }
      if (e.type === "pointerup" && was && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 14) { setNdc(e); tapAt(); }
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    /* ---- animasi penutup tiap aksi ---- */
    var FIN = {
      clean: function (cb) {
        specks.forEach(function (sp) { sp.visible = false; });
        faucet.visible = false;
        tween(300, function (p) { label.scale.set(1.25 * (1 - p) + 0.01, 1, 1.25 * (1 - p) + 0.01); }, function () { label.visible = false; cb(); });
      },
      rim: function (cb) {
        rimMarks.visible = false; tape.visible = true; tape.scale.z = 0.001;
        tween(500, function (p) { tape.scale.z = 0.001 + (TAPE_Z - 0.001) * Math.max(0, easeOutBack(p)); }, function () { tape.scale.z = TAPE_Z; cb(); });
      },
      glue: function (cb) { tween(350, function () { }, cb); },
      paper: function (cb) {
        var o = tools.paper, from = o.position.clone(), to = new V3(0, 1.2, R + 0.9), rz = o.rotation.z;
        seq([
          function (n) { tween(320, function (p) { o.position.lerpVectors(from, to, p); o.rotation.z = rz * (1 - p); }, n); },
          function (n) {
            paperMesh.visible = true; setWrap(0.001);
            tween(1000, function (p) { setWrap(Math.max(0.001, p)); o.rotation.y = p * PI * 4; setOpacity(o, 1 - 0.9 * p); }, n);
          },
          function (n) { o.visible = false; setWrap(1); n(); }
        ], cb);
      },
      pens: function (cb) {
        var o = tools.pens, from = o.position.clone(), to = new V3(0, H + 1.3, 0), rz = o.rotation.z;
        seq([
          function (n) { tween(320, function (p) { o.position.lerpVectors(from, to, p); o.rotation.z = rz * (1 - p); }, n); },
          function (n) {
            pencilsIn.visible = true; pencilsIn.scale.setScalar(0.001);
            tween(700, function (p) { pencilsIn.scale.setScalar(0.001 + 0.999 * Math.max(0, easeOutBack(p))); setOpacity(o, 1 - p); }, n);
          },
          function (n) { o.visible = false; pencilsIn.scale.setScalar(1); n(); }
        ], cb);
      }
    };

    function completeAction() {
      if (!cur || cur.done) return;
      cur.done = true; endDemo();
      if (drag) { if (drag.tool) goHome(drag.tool); drag = null; }
      busy = true; setTip("");
      var id = cur.id;
      FIN[id](function () { busy = false; afterAction(id); });
    }
    function afterAction(id) {
      var step = STEPS[st.step], last = st.ai === step.acts.length - 1;
      setFbState("ok", "Tepat. ", ACTS[id].ok);
      if (last) { st.stepDone = true; render(); autoT = setTimeout(function () { autoT = null; next(); }, 1400); }
      else {
        st.ai++; render();
        autoT = setTimeout(function () { autoT = null; startAction(); render(); }, 1100);
      }
    }

    /* ---- petunjuk: contoh gerakan di model ---- */
    function gAt(v) { return function (n) { ghost.position.copy(v); n(); }; }
    function gTo(v, dur) { return function (n) { var from = ghost.position.clone(); tween(dur || 500, function (p) { ghost.position.lerpVectors(from, v, p); }, n, null, "demo"); }; }
    function gPress() { return function (n) { tween(300, function (p) { ghost.scale.setScalar(GS * (1 - 0.3 * Math.sin(p * PI))); }, n, null, "demo"); }; }
    function gWait(ms) { return function (n) { tween(ms, function () { }, n, null, "demo"); }; }
    function zig(y, x0, x1, z, n, dur) { var l = []; for (var k = 0; k < n; k++) { l.push(gTo(new V3(x1, y, z), dur)); l.push(gTo(new V3(x0, y, z), dur)); } return l; }
    function endDemo() {
      killTweens("demo"); demoOn = false; ghost.visible = false; ghost.scale.setScalar(GS); demoCarry = null;
      if (demoRestore) { var f = demoRestore; demoRestore = null; f(); }
      if (st && st.phase === "langkah" && cur && !cur.done) tipForAction(); else if (st && st.phase === "bahan") setTip("Ketuk benda");
    }
    function runDemo(list, carry, restore) {
      endDemo(); demoOn = true; demoCarry = carry || null; demoRestore = restore || null;
      ghost.visible = true; ghost.scale.setScalar(GS);
      seq(list, function () { endDemo(); });
    }
    function hint() {
      if (!st || busy || st.phase === "selesai" || st.stepDone) return;
      var msg, list, carry = null, restore = null, l, k;
      if (st.phase === "bahan") {
        var ni = nextCorrect(); if (ni < 0) return;
        var it = items[ni], p = it.position;
        msg = "Ini salah satu yang dipakai: " + MATS[ni].t + ". Ketuk bendanya yang berkedip.";
        it.userData.flashUntil = performance.now() + 3000;
        list = [gAt(new V3(p.x, 1.7, p.z + 0.6)), gTo(new V3(p.x, 0.7, p.z + 0.2), 650), gPress(), gWait(400), gPress(), gWait(300)];
      } else {
        if (!cur || cur.done) return;
        var id = cur.id, def = cur.def, zf = R + 0.35;
        msg = def.hint;
        if (id === "clean") list = [gAt(new V3(-0.5, 1.2, zf))].concat(zig(1.2, -0.5, 0.5, zf, 4, 450));
        else if (id === "glue") {
          l = [gAt(new V3(-0.5, 0.5, zf))];
          for (k = 0; k < 3; k++) { l.push(gTo(new V3(0.5, 0.7 + k * 0.4, zf), 450)); l.push(gTo(new V3(-0.5, 0.9 + k * 0.4, zf), 450)); }
          list = l; carry = { obj: tools.lem, off: new V3(-0.95, 0, 0.05) }; restore = function () { goHome(tools.lem); };
        } else if (id === "rim") {
          list = [gAt(new V3(0, H + 0.9, 0.5)), gTo(new V3(0, H + 0.15, 0.5), 600), gPress(), gWait(300), gPress(), gWait(300)];
        } else {
          var hp = toolHome[def.obj];
          list = [gAt(new V3(hp.x, 1.2, hp.z + 0.3)), gTo(new V3(hp.x, 0.6, hp.z), 600), gPress(), gWait(300), gPress(), gWait(300)];
        }
      }
      st.hints++;
      setFbState("hint", "Petunjuk: ", msg); render();
      setTip(msg);
      runDemo(list, carry, restore);
      markActive();
    }

    /* ---- selesaikan aksi lewat tombol (alternatif bagi yang sulit menggeser atau menyeret) ---- */
    function force() {
      if (!st || busy) return;
      if (st.phase === "bahan") { var ni = nextCorrect(); if (ni >= 0) { st.skips++; pick(ni); } return; }
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      st.skips++;
      var def = cur.def;
      if (def.type === "scrub") { cur.p = def.need; applyScrub(); completeAction(); }
      else if (def.type === "tap") { completeAction(); }
      else { var o = tools[def.obj]; dragTarget.set(0, LIFT, 0); o.position.set(0, LIFT, 0); completeAction(); }
    }

    function next() {
      if (!st || busy) return;
      if (st.phase === "bahan") {
        if (Object.keys(st.picked).length < MAT_NEED) return;
        st.fb = null; st.phase = "langkah"; st.step = 0; st.ai = 0; st.stepDone = false;
        setTip(""); render();
        enterWork(function () { startAction(); render(); });
        return;
      }
      if (st.phase === "langkah" && st.stepDone) {
        st.fb = null;
        if (st.step === STEPS.length - 1) { finishAll(); return; }
        st.step++; st.ai = 0; st.stepDone = false;
        startAction(); render();
      }
    }
    function finishAll() {
      st.phase = "selesai"; st.stepDone = false; cur = null; setFbState(null);
      canvas.style.touchAction = "pan-y"; setTip(""); render();
      rimMarks.visible = false;
      if (nudgeT) clearTimeout(nudgeT); $("k3-hint").classList.remove("pulse");
      try { window.dispatchEvent(new CustomEvent("daur3d2:finish", { detail: { salah: st.mist, petunjuk: st.hints, lewati: st.skips } })); } catch (e) { }
    }

    /* ---- mulai dari awal ---- */
    function resetCan() {
      can.visible = false; can.rotation.y = 0; can.scale.setScalar(1);
      specks.forEach(function (s) { s.visible = true; s.scale.set(1.3, 1, 0.35); });
      label.visible = true; label.scale.set(1, 1, 1); label.position.set(0, 0, 0); label.rotation.set(0, 0, 0); setOpacity(label, 1);
      rimMarks.visible = false;
      tape.visible = false; tape.scale.z = 0.001;
      glue.visible = false; glue.scale.y = 0.001;
      paperMesh.visible = false; setWrap(1);
      pencilsIn.visible = false; pencilsIn.scale.setScalar(1);
      faucet.visible = false;
      hitBody.scale.y = H + 0.3;
    }
    function resetItems() {
      slotOf = shuffle(range(MATS.length));
      items.forEach(function (it) {
        it.visible = true; it.scale.setScalar(1); it.rotation.set(0, 0, 0); setOpacity(it, 1);
        it.userData.ring.visible = false; it.userData.ring.material.opacity = 0; it.userData.label.visible = true; it.userData.fl = false;
      });
      placeItems();
    }
    function resetTools() {
      Object.keys(tools).forEach(function (k) {
        var t = tools[k]; t.visible = false; t.scale.setScalar(1); t.rotation.set(0, 0, 0); setOpacity(t, 1); t.position.copy(toolHome[k]);
      });
    }
    function begin() {
      if (autoT) { clearTimeout(autoT); autoT = null; }
      endDemo(); tweens.length = 0;
      busy = false; drag = null; down = null; cur = null;
      st = newState();
      resetCan(); resetItems(); resetTools();
      blend = 0; updateCam();
      canvas.style.touchAction = "pan-y";
      render(); setTip("Ketuk benda"); markActive();
    }

    /* ---- render ---- */
    function frame(now) {
      requestAnimationFrame(frame);
      if (!canvas.offsetParent) return; // panel sedang tersembunyi
      for (var i = tweens.length - 1; i >= 0; i--) {
        var t = tweens[i]; if (!t) continue;
        var p = clamp((now - t.t0) / t.dur, 0, 1);
        t.fn(t.ease(p));
        if (p >= 1) { var at = tweens.indexOf(t); if (at >= 0) tweens.splice(at, 1); if (t.done) t.done(); }
      }
      if (demoCarry) demoCarry.obj.position.set(ghost.position.x + demoCarry.off.x, ghost.position.y + demoCarry.off.y, ghost.position.z + demoCarry.off.z);
      if (drag) {
        if (drag.kind === "drag") {
          var o = drag.obj, vx = dragTarget.x - o.position.x;
          o.position.lerp(dragTarget, 0.3);
          o.rotation.z += (-clamp(vx * 0.35, -0.6, 0.6) - o.rotation.z) * 0.2;
        } else if (drag.tool) {
          drag.tool.position.lerp(drag.toolTarget, 0.35);
        }
      }
      if (!reduce) {
        if (rimMarks.visible) halos.forEach(function (h) { h.scale.setScalar(1 + 0.3 * Math.sin(now / 220)); });
        if (faucet.visible) drops.forEach(function (dp, k) { dp.position.y = 4.3 - (((now / 650) + k / drops.length) % 1) * 3.4; });
      } else if (faucet.visible) drops.forEach(function (dp, k) { dp.position.y = 4.3 - (k / drops.length) * 3.4; });
      items.forEach(function (it) {
        var u = it.userData;
        if (u.flashUntil > now) { u.fl = true; it.scale.setScalar(1 + 0.12 * Math.sin(now / 90)); }
        else if (u.fl) { u.fl = false; it.scale.setScalar(1); }
      });
      if (st && st.phase === "selesai" && !reduce) can.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage); else window.addEventListener("resize", layout);
    V = { pick: pick, hint: hint, force: force, next: next, begin: begin };
    begin();
    requestAnimationFrame(frame);
  }

  /* adegan dibuat sekali, saat panel pertama kali tampil (ukuran kanvas baru bisa dibaca saat terlihat) */
  var built = false;
  function tryBuild() {
    if (built || !stage.clientWidth) return;
    built = true;
    if (!(window.THREE && webglOk())) { showNoGl(); return; }
    try { start(); } catch (e) { console.error("daur3d2:", e); V = null; showNoGl(); }
  }
  if (window.ResizeObserver) new ResizeObserver(tryBuild).observe(stage); else window.setInterval(tryBuild, 600);
  tryBuild();
})();


/* ===== daur3d3.js ===== */
/* Latihan daur ulang 3D ketiga: kompos dari sisa makanan dalam ember bekas (layar info di index.html).
   Pola sama dengan daur3d.js dan daur3d2.js: pilih bahan, lalu kerjakan tiap langkah langsung pada model 3D.
   Panel memakai id berawalan "c3-". Tidak ada data yang dikirim ke server.
   Saat selesai, window menerima event "daur3d3:finish" { salah, petunjuk, lewati }.
   Semua teks disisipkan dengan textContent. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("c3-stage");
  if (!stage) return;

  var FALLBACK = { "--soft": "#E3EADF", "--accent": "#1B6A47" };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function cssVar(n) {
    var v = "";
    try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { }
    return v || FALLBACK[n] || "#888888";
  }
  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= data ================= */
  var MATS = [
    { k: "ember", t: "Ember bekas", s: "Ember bekas", ok: 1 },
    { k: "daun", t: "Daun kering", s: "Daun kering", ok: 1 },
    { k: "sisa", t: "Sisa sayur dan buah", s: "Sisa sayur", ok: 1 },
    { k: "tanah", t: "Tanah", s: "Tanah", ok: 1 },
    { k: "sekop", t: "Sekop kecil untuk mengaduk", s: "Sekop kecil", ok: 1 },
    { k: "plastik", t: "Plastik pembungkus", s: "Plastik", fb: "Plastik tidak membusuk, jadi tidak ikut dikomposkan." },
    { k: "daging", t: "Daging dan minyak goreng", s: "Daging & minyak", fb: "Daging dan minyak menimbulkan bau dan mengundang hama." }
  ];
  var MAT_NEED = MATS.filter(function (m) { return m.ok; }).length;

  var T_HOLE = "Beri lubang dulu.";
  var T_LEAF = "Alasi daun kering dulu.";
  var T_SCRAP = "Masukkan sisa makanan dulu.";
  var T_END = "Sekop dipakai untuk mengaduk di akhir.";

  var ACTS = {
    holes: { type: "tap", title: "Beri lubang", text: "Ketuk bagian bawah ember.",
      tip: "Ketuk bawah ember", hint: "Ketuk bagian bawah ember. Lubang membuat udara dan air bisa lewat.",
      ok: "Udara dan air bisa mengalir.", traps: { daun: T_HOLE, sisa: T_HOLE, tanah: T_HOLE, sekop: T_END } },
    leaves: { type: "drag", obj: "daun", title: "Alasi daun kering", text: "Ketuk karung daun.",
      tip: "Ketuk daun", hint: "Ketuk karung daun kering di sisi kiri.",
      ok: "Alas daun terpasang.", traps: { sisa: T_LEAF, tanah: T_LEAF, sekop: T_END } },
    scraps: { type: "drag", obj: "sisa", title: "Masukkan sisa makanan", text: "Ketuk mangkuk sisa sayur.",
      tip: "Ketuk mangkuk", hint: "Ketuk mangkuk sisa sayur di sisi kanan.",
      ok: "Sisa makanan masuk.", traps: { tanah: T_SCRAP, sekop: T_END } },
    cover: { type: "drag", obj: "tanah", title: "Tutup dengan tanah", text: "Ketuk kantong tanah.",
      tip: "Ketuk tanah", hint: "Ketuk kantong tanah di sisi kanan.",
      ok: "Tanah menutupi sisa makanan.", traps: { sekop: T_END } },
    mix: { type: "scrub", need: 1.2, tool: "sekop", title: "Aduk kompos", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik. Sekop mengaduk isi ember.",
      ok: "Isi ember tercampur rata.", traps: {} },
    lid: { type: "tap", title: "Tutup ember", text: "Ketuk ember.",
      tip: "Ketuk ember", hint: "Ketuk ember atau tutupnya. Tutup menjaga kelembapan dan mengurangi bau.",
      ok: "Ember tertutup.", traps: {} }
  };
  var STEPS = [
    { acts: ["holes"], d: "Ember berlubang.", warn: "Melubangi ember perlu hati-hati, minta bantuan kalau perlu." },
    { acts: ["leaves"], d: "Alas daun terpasang." },
    { acts: ["scraps", "cover"], d: "Sisa makanan tertutup tanah." },
    { acts: ["mix", "lid"], d: "Kompos teraduk dan ember tertutup." }
  ];
  var DONE = "Sisa makanan siap berubah jadi kompos.";

  /* ================= antarmuka ================= */
  var V = null;
  var st = null;

  function newState() {
    return { phase: "bahan", step: 0, ai: 0, stepDone: false, picked: {}, bad: {}, mist: 0, hints: 0, skips: 0, fb: null, order: shuffle(range(MATS.length)) };
  }
  function setFbState(cls, strong, text) { if (st) st.fb = cls ? [cls, strong, text] : null; }

  function render() {
    if (!st) return;
    var n = STEPS.length, pct = 0, warn = $("c3-warn");
    warn.hidden = true; $("c3-next").hidden = true; $("c3-mist").textContent = "";
    var got = Object.keys(st.picked).length;
    var playing = st.phase === "bahan" ? got < MAT_NEED : (st.phase === "langkah" && !st.stepDone);
    $("c3-hint").hidden = !playing; $("c3-skip").hidden = !playing;
    if (st.phase === "bahan") {
      $("c3-phase").textContent = "Bahan";
      $("c3-title").textContent = "Pilih bahan";
      $("c3-text").textContent = "Ketuk " + MAT_NEED + " benda yang dipakai. Terpilih " + got + " dari " + MAT_NEED + ".";
      pct = (got / MAT_NEED) / (n + 1) * 100;
    } else if (st.phase === "langkah") {
      var step = STEPS[st.step], def = ACTS[step.acts[st.ai]];
      $("c3-phase").textContent = "Langkah " + (st.step + 1) + " dari " + n;
      if (st.stepDone) { $("c3-title").textContent = "Selesai"; $("c3-text").textContent = step.d; }
      else { $("c3-title").textContent = def.title; $("c3-text").textContent = def.text; }
      if (step.warn && !st.stepDone) { warn.hidden = false; warn.textContent = step.warn; }
      pct = (1 + st.step + (st.stepDone ? 1 : st.ai / step.acts.length)) / (n + 1) * 100;
    } else {
      pct = 100;
      $("c3-phase").textContent = "Selesai";
      $("c3-title").textContent = "Komposter jadi!";
      $("c3-text").textContent = DONE + " Salah: " + st.mist + ". Petunjuk: " + st.hints + ".";
    }
    $("c3-bar").style.width = pct + "%";
    var fb = $("c3-fb"); fb.textContent = "";
    fb.hidden = !st.fb;
    if (st.fb) {
      var b = document.createElement("b"); b.className = st.fb[0]; b.textContent = st.fb[1]; fb.appendChild(b);
      fb.appendChild(document.createTextNode(st.fb[2] || ""));
    }
  }

  function showNoGl() { $("c3-nogl").hidden = false; $("c3-body").hidden = true; }

  $("c3-hint").addEventListener("click", function () { if (V) V.hint(); });
  $("c3-skip").addEventListener("click", function () { if (V) V.force(); });
  $("c3-next").addEventListener("click", function () { if (V) V.next(); });
  $("c3-reset").addEventListener("click", function () { if (V) V.begin(); });

  /* ================= adegan 3D ================= */
  function start() {
    var canvas = $("c3-canvas");
    var V3 = THREE.Vector3, PI = Math.PI;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.65));
    var sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe3eadf, roughness: 1 });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), floorMat);
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; scene.add(floor);
    function applyTheme() { floorMat.color.set(cssVar("--soft")); }
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { }
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { }

    /* ---- alat bantu ---- */
    function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {})); }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function invisibleMat() { return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function setOpacity(obj, f) {
      obj.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material;
        if (m.userData.base === undefined) { m.userData.base = m.opacity; m.userData.tr = m.transparent; }
        m.transparent = m.userData.tr || f < 1;
        m.opacity = m.userData.base * f;
      });
    }

    /* ---- animasi ---- */
    var tweens = [];
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function tween(dur, fn, done, ease, owner) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut, owner: owner || "" }); }
    function killTweens(owner) { for (var i = tweens.length - 1; i >= 0; i--) if (tweens[i].owner === owner) tweens.splice(i, 1); }
    function seq(list, done) {
      var i = 0;
      (function nxt() { if (i >= list.length) { if (done) done(); return; } list[i++](nxt); })();
    }
    function moveTo(obj, to, dur, done, arc) {
      var from = obj.position.clone();
      tween(dur, function (p) { obj.position.lerpVectors(from, to, p); if (arc) obj.position.y += Math.sin(p * PI) * arc; }, done);
    }
    function popIn(o, dur) { o.visible = true; tween(dur || 380, function (p) { o.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { o.scale.setScalar(1); }); }

    /* ---- ukuran dan bentuk ember (atas lebih lebar dari bawah) ---- */
    var RT = 0.9, RB = 0.72, H = 1.9, LIFT = 2.6;
    function rAt(y) { return RB + (RT - RB) * (y / H); }

    var bucket = new THREE.Group(); bucket.visible = false; scene.add(bucket);
    var plastic = function () { return M(0x3a7bd5, { transparent: true, opacity: 0.5, roughness: 0.3, side: THREE.DoubleSide }); };
    bucket.add(mesh(new THREE.CylinderGeometry(RT, RB, H, 40, 1, true), plastic(), 0, H / 2, 0));
    var bbase = mesh(new THREE.CircleGeometry(RB, 40), plastic(), 0, 0.01, 0); bbase.rotation.x = -PI / 2; bucket.add(bbase);
    var brim = mesh(new THREE.TorusGeometry(RT, 0.045, 8, 48), M(0x2a5fa8), 0, H, 0); brim.rotation.x = PI / 2; bucket.add(brim);
    bucket.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // titik lubang di bagian bawah
    var markers = [];
    [-0.8, 0, 0.8].forEach(function (a) {
      var r = rAt(0.45) + 0.015, g = new THREE.Group();
      g.position.set(Math.sin(a) * r, 0.45, Math.cos(a) * r); g.rotation.y = a;
      var dot = mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 0, 0.03);
      var halo = mesh(new THREE.RingGeometry(0.12, 0.18, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0.03);
      var hole = mesh(new THREE.CircleGeometry(0.09, 18), new THREE.MeshBasicMaterial({ color: 0x10181d }), 0, 0, 0.005);
      g.add(dot, halo, hole); bucket.add(g);
      markers.push({ g: g, dot: dot, halo: halo, hole: hole, done: false });
    });
    function refreshMarkers(on) {
      markers.forEach(function (m) { m.dot.visible = on && !m.done; m.halo.visible = on && !m.done; m.hole.visible = m.done; });
    }

    // lapisan isi ember: daun, sisa makanan, tanah (dasar tiap lapisan di y lokalnya)
    var LAYERS = {};
    function layer(name, y0, y1, col) {
      var g = new THREE.CylinderGeometry(rAt(y1) - 0.05, rAt(y0) - 0.05, y1 - y0, 28); g.translate(0, (y1 - y0) / 2, 0);
      var m = new THREE.Mesh(g, M(col, { roughness: 1 }));
      m.position.y = y0; m.visible = false; m.scale.y = 0.001; bucket.add(m);
      LAYERS[name] = { m: m, col: new THREE.Color(col) };
    }
    layer("leaves", 0.06, 0.6, 0xa9772f);
    layer("scraps", 0.6, 1.15, 0x86b03a);
    layer("soil", 1.15, 1.6, 0x4a3018);
    var MIXC = new THREE.Color(0x5c3f1c);
    function tintLayers(f) { Object.keys(LAYERS).forEach(function (k) { LAYERS[k].m.material.color.copy(LAYERS[k].col).lerp(MIXC, f); }); }

    // tutup ember
    var lid = new THREE.Group(); lid.visible = false; bucket.add(lid);
    lid.add(mesh(new THREE.CylinderGeometry(RT + 0.07, RT + 0.07, 0.1, 40), M(0x2a5fa8, { roughness: 0.5 }), 0, 0, 0));
    var knob = mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 20), M(0x1d4684), 0, 0.12, 0); knob.rotation.x = PI / 2; lid.add(knob);
    lid.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // badan ember yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(RT + 0.04, RT + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = H + 0.3; bucket.add(hitBody);

    /* ---- benda di meja: bahan dan alat ---- */
    var MODEL = {
      ember: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.8, 24), M(0x3a7bd5, { roughness: 0.4 }), 0, 0.4, 0));
        var er = mesh(new THREE.TorusGeometry(0.4, 0.035, 8, 28), M(0x2a5fa8), 0, 0.8, 0); er.rotation.x = PI / 2; g.add(er);
        var hd = mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 24, PI), M(0xcfd3d6, { metalness: 0.6, roughness: 0.3 }), 0, 0.8, 0); g.add(hd);
      },
      daun: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.8, 20), M(0xc9a46a, { roughness: 0.9 }), 0, 0.4, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.12, 20), M(0xa8864f, { roughness: 0.9 }), 0, 0.82, 0));
        [[-0.12, 0xd9822b], [0.1, 0xb5651d], [0, 0xe0a030]].forEach(function (a, i) {
          var l = mesh(new THREE.SphereGeometry(0.2, 10, 6), M(a[1], { roughness: 0.8 }), a[0], 0.95 + i * 0.05, (i - 1) * 0.08); l.scale.set(1.3, 0.25, 0.8); l.rotation.z = (i - 1) * 0.5; g.add(l);
        });
      },
      sisa: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.5, 0.34, 0.36, 24), M(0xf4f4f0, { roughness: 0.4 }), 0, 0.18, 0));
        [[-0.2, 0.42, 0.05, 0x4f9e3c], [0.15, 0.45, -0.1, 0xe9801b], [0.05, 0.46, 0.15, 0xc23b2e], [-0.05, 0.4, -0.18, 0x7aa63c]].forEach(function (a) {
          g.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), M(a[3], { roughness: 0.6 }), a[0], a[1], a[2]));
        });
        var peel = mesh(new THREE.BoxGeometry(0.4, 0.05, 0.14), M(0xf2d03b), 0.1, 0.55, 0.1); peel.rotation.y = 0.5; peel.rotation.z = 0.2; g.add(peel);
      },
      tanah: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.12, 24), M(0x7a8088), 0, 0.06, 0));
        g.add(mesh(new THREE.SphereGeometry(0.5, 20, 12, 0, PI * 2, 0, PI / 2), M(0x5b3a1e, { roughness: 1 }), 0, 0.12, 0));
      },
      sekop: function (g) { // sekop berbaring, bilah ke kanan
        var hd = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 10), M(0x8a5a2b), -0.2, 0.12, 0); hd.rotation.z = PI / 2; g.add(hd);
        g.add(mesh(new THREE.BoxGeometry(0.15, 0.12, 0.1), M(0xc23b2e), -0.7, 0.12, 0));
        g.add(mesh(new THREE.BoxGeometry(0.42, 0.04, 0.3), M(0xcfd3d6, { metalness: 0.7, roughness: 0.3 }), 0.4, 0.1, 0));
        var neck = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 8), M(0xcfd3d6, { metalness: 0.7, roughness: 0.3 }), 0.2, 0.11, 0); neck.rotation.z = PI / 2; g.add(neck);
      },
      plastik: function (g) {
        var bag = mesh(new THREE.SphereGeometry(0.4, 14, 10), M(0xf2f2f2, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, 0.35, 0); bag.scale.set(1.1, 0.9, 0.9); g.add(bag);
        g.add(mesh(new THREE.ConeGeometry(0.14, 0.3, 10), M(0xf2f2f2, { transparent: true, opacity: 0.7, roughness: 0.2 }), 0, 0.82, 0));
      },
      daging: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.5, 0.45, 0.07, 24), M(0xf4f4f0), -0.1, 0.04, 0));
        var meat = mesh(new THREE.BoxGeometry(0.5, 0.14, 0.34), M(0xc0392b, { roughness: 0.5 }), -0.1, 0.14, 0); meat.rotation.y = 0.3; g.add(meat);
        g.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.55, 14), M(0xf2c230, { transparent: true, opacity: 0.8, roughness: 0.2 }), 0.42, 0.28, 0.1));
      }
    };
    function buildObj(key, hitR, hitY) {
      var g = new THREE.Group(); MODEL[key](g);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(mesh(new THREE.SphereGeometry(hitR || 0.85, 12, 8), invisibleMat(), 0, hitY === undefined ? 0.45 : hitY, 0));
      scene.add(g); return g;
    }
    function labelSprite(txt) {
      var cv = document.createElement("canvas"); cv.width = 320; cv.height = 80;
      var c = cv.getContext("2d");
      c.fillStyle = "rgba(10,22,18,0.88)"; roundRect(c, 4, 8, 312, 64, 14); c.fill();
      var fs = 36; c.font = "700 " + fs + "px Arial, sans-serif";
      while (fs > 20 && c.measureText(txt).width > 276) { fs -= 2; c.font = "700 " + fs + "px Arial, sans-serif"; }
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 160, 42);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5; scene.add(sp); return sp;
    }
    var items = MATS.map(function (m, idx) {
      var g = buildObj(m.k, 0.8, 0.45);
      var r = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.76, 36), new THREE.MeshBasicMaterial({ color: 0x2e7d4f, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      r.rotation.x = -PI / 2; r.visible = false; scene.add(r);
      g.userData = { idx: idx, ring: r, label: labelSprite(m.s), flashUntil: 0, fl: false };
      return g;
    });
    var tools = { sekop: buildObj("sekop", 0.8, 0.2), daun: buildObj("daun", 0.7, 0.45), sisa: buildObj("sisa", 0.7, 0.35), tanah: buildObj("tanah", 0.85, 0.3) };
    Object.keys(tools).forEach(function (k) { tools[k].userData.key = k; tools[k].visible = false; });

    /* ---- penunjuk jari untuk petunjuk ---- */
    var GS = 0.9, ghost = (function () {
      var cv = document.createElement("canvas"); cv.width = cv.height = 128; var c = cv.getContext("2d");
      c.beginPath(); c.arc(64, 64, 52, 0, PI * 2); c.fillStyle = "rgba(255,255,255,0.4)"; c.fill();
      c.lineWidth = 8; c.strokeStyle = cssVar("--accent"); c.stroke();
      c.beginPath(); c.arc(64, 64, 18, 0, PI * 2); c.fillStyle = cssVar("--accent"); c.fill();
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      s.scale.setScalar(GS); s.renderOrder = 20; s.visible = false; scene.add(s); return s;
    })();

    /* ---- kamera dan tata letak ---- */
    var poseA, poseB, blend = 0, slots = [], slotOf = shuffle(range(MATS.length)), toolHome = {};
    function distOf(p) { var t = Math.tan(camera.fov * PI / 360); return Math.max(8, p.halfW / (t * camera.aspect), p.halfH / t); }
    function updateCam() {
      var k = blend, look = new V3().lerpVectors(poseA.look, poseB.look, k);
      var dist = distOf(poseA) * (1 - k) + distOf(poseB) * k;
      var dir = new V3(0, poseA.ey * (1 - k) + poseB.ey * k, poseA.ez * (1 - k) + poseB.ez * k).normalize();
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look); camera.updateProjectionMatrix();
    }
    function placeItems() {
      items.forEach(function (it, idx) {
        var s = slots[slotOf[idx]], u = it.userData;
        it.position.set(s[0], 0, s[1]);
        u.label.position.set(s[0], 0.12, s[1] + 0.95);
        u.ring.position.set(s[0], 0.03, s[1]);
      });
    }
    function placeTools() {
      Object.keys(tools).forEach(function (k) {
        if (!busy && !drag && !demoCarry) tools[k].position.copy(toolHome[k]);
      });
    }
    function layout() {
      var w = stage.clientWidth || 600, h = stage.clientHeight || 400, xT;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (camera.aspect >= 1.3) {
        poseA = { look: new V3(0, 0.5, 0.3), halfW: 6.6, halfH: 3.2, ey: 0.8, ez: 0.75 };
        poseB = { look: new V3(0, 1.2, 0), halfW: 4.8, halfH: 2.9, ey: 0.65, ez: 1.0 };
        slots = range(7).map(function (j) { return [(j - 3) * 1.75, 0.4]; });
        xT = 3.0;
      } else {
        poseA = { look: new V3(0, 0.2, -0.2), halfW: 3.6, halfH: 3.4, ey: 1.0, ez: 0.55 };
        poseB = { look: new V3(0, 1.2, 0), halfW: 3.3, halfH: 2.9, ey: 0.65, ez: 1.0 };
        slots = [[-2.55, -1.6], [-0.85, -1.6], [0.85, -1.6], [2.55, -1.6], [-1.7, 1.1], [0, 1.1], [1.7, 1.1]];
        xT = 2.2;
      }
      toolHome = { sekop: new V3(-xT, 0, 0.5), daun: new V3(-xT, 0, -1.1), sisa: new V3(xT, 0, 0.7), tanah: new V3(xT, 0, -1.0) };
      updateCam();
      if (st && st.phase === "bahan") placeItems();
      placeTools();
    }

    /* ---- membaca sentuhan ---- */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    var dragTarget = new THREE.Vector3();
    var cur = null, busy = false, drag = null, down = null;
    var demoOn = false, demoCarry = null, demoRestore = null;
    var autoT = null, nudgeT = null, tipT = null;

    function setNdc(e) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function hitObj(obj) { var r = ray.intersectObject(obj, true); return r.length ? r[0] : null; }
    function hitItem() {
      var best = -1, bd = 1e9;
      items.forEach(function (it, idx) {
        if (!it.visible) return;
        var h = ray.intersectObject(it, true);
        if (h.length && h[0].distance < bd) { bd = h[0].distance; best = idx; }
      });
      return best;
    }

    /* ---- teks kecil di atas adegan dan tombol petunjuk ---- */
    function setTip(text) {
      var tip = $("c3-tip");
      if (tipT) { clearTimeout(tipT); tipT = null; }
      tip.textContent = text || "";
      tip.classList.toggle("gone", !text);
      if (text) tipT = setTimeout(function () { tip.classList.add("gone"); }, 7000);
    }
    function markActive() {
      if (nudgeT) clearTimeout(nudgeT);
      $("c3-hint").classList.remove("pulse");
      nudgeT = setTimeout(function () { if (st && st.phase !== "selesai" && !st.stepDone) $("c3-hint").classList.add("pulse"); }, 15000);
    }
    function tipForAction() { setTip(cur ? cur.def.tip : ""); }

    /* ---- gerak kecil ---- */
    function shake(o) { var bx = o.position.x; tween(320, function (p) { o.position.x = bx + Math.sin(p * 20) * 0.14 * (1 - p); }, function () { o.position.x = bx; }); }
    function goHome(o) {
      var home = toolHome[o.userData.key], rz = o.rotation.z;
      moveTo(o, home.clone(), 420, null, 0.7);
      tween(420, function (p) { o.rotation.z = rz * (1 - p); });
    }

    /* ---- bahan ---- */
    function markItem(idx, kind) {
      var it = items[idx], r = it.userData.ring;
      r.material.color.set(kind === "ok" ? 0x2e7d4f : 0xc23b2e); r.material.opacity = 0.95; r.visible = true;
      if (kind === "bad") { setOpacity(it, 0.35); shake(it); }
      else tween(320, function (p) { it.position.y = Math.sin(p * PI) * 0.3; }, function () { it.position.y = 0; });
    }
    function pick(idx) {
      if (!st || st.phase !== "bahan" || busy || st.picked[idx] || st.bad[idx]) return;
      if (Object.keys(st.picked).length >= MAT_NEED) return;
      var m = MATS[idx];
      if (m.ok) { st.picked[idx] = 1; markItem(idx, "ok"); setFbState("ok", "Tepat. ", m.s + " dipakai."); }
      else { st.bad[idx] = 1; st.mist++; markItem(idx, "bad"); setFbState("no", "Belum tepat. ", m.fb); }
      render(); markActive();
      if (Object.keys(st.picked).length >= MAT_NEED) autoT = setTimeout(function () { autoT = null; next(); }, 1200);
    }
    function nextCorrect() {
      for (var k = 0; k < st.order.length; k++) { var mi = st.order[k]; if (MATS[mi].ok && !st.picked[mi]) return mi; }
      return -1;
    }

    /* ---- pindah dari bahan ke langkah ---- */
    function enterWork(cb) {
      busy = true;
      seq([
        function (n) {
          items.forEach(function (it) {
            tween(300, function (p) { it.scale.setScalar(1 - p); }, function () { it.visible = false; it.userData.label.visible = false; it.userData.ring.visible = false; });
          });
          tween(320, function () { }, n);
        },
        function (n) {
          bucket.visible = true; bucket.scale.setScalar(0.01);
          tween(450, function (p) { bucket.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { bucket.scale.setScalar(1); });
          Object.keys(tools).forEach(function (k) { tools[k].position.copy(toolHome[k]); popIn(tools[k], 450); });
          tween(800, function (p) { blend = p; updateCam(); }, n);
        }
      ], function () { busy = false; cb(); });
    }

    /* ---- aksi ---- */
    function startAction() {
      var id = STEPS[st.step].acts[st.ai];
      cur = { id: id, def: ACTS[id], p: 0, done: false };
      refreshMarkers(id === "holes");
      lid.visible = id === "lid"; lid.position.set(0, H + 1.3, 0); lid.rotation.set(0, 0, 0);
      canvas.style.touchAction = (cur.def.type === "tap") ? "pan-y" : "none"; // ketukan boleh sambil menggulir halaman
      tipForAction(); markActive();
    }

    function applyScrub() {
      var f = Math.min(1, cur.p / cur.def.need);
      if (cur.id === "mix") tintLayers(f);
    }
    var toolPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(RT + 0.35));
    function moveTool() { // alat mengikuti jari, selalu di depan ember dan tidak perlu tepat
      if (!drag.tool || !ray.ray.intersectPlane(toolPlane, tmp)) return;
      drag.toolTarget.set(clamp(tmp.x, -1.7, 1.7) - 0.95, clamp(tmp.y, 0.4, H - 0.1), RT + 0.35);
    }
    function scrubTo(e) { // kemajuan = jarak geser jari di layar, di mana pun di kanvas
      var r = canvas.getBoundingClientRect(), unit = Math.min(r.width, 600);
      cur.p += Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / unit;
      drag.lx = e.clientX; drag.ly = e.clientY;
      moveTool(); applyScrub();
      if (cur.p >= cur.def.need) completeAction();
    }
    function trap(key, msg) {
      shake(tools[key]); st.mist++;
      setFbState("no", "Belum tepat. ", msg); render();
    }
    function makeHole(k) {
      markers[k].done = true; refreshMarkers(true);
      tween(260, function (p) { markers[k].hole.scale.setScalar(0.6 + 0.4 * easeOutBack(p)); });
    }
    function makeAllHoles() {
      var left = [];
      markers.forEach(function (m, k) { if (!m.done) left.push(k); });
      if (!left.length) return;
      busy = true;
      left.forEach(function (k, n) {
        tween(60 + n * 240, function () { }, function () {
          makeHole(k);
          if (n === left.length - 1) { busy = false; completeAction(); }
        });
      });
    }
    function tapAt() {
      if (st.phase === "bahan") { var idx = hitItem(); if (idx >= 0) pick(idx); return; }
      if (st.phase !== "langkah" || !cur || cur.done || cur.def.type !== "tap") return;
      if (cur.id === "lid") { if (hitObj(hitBody) || hitObj(lid)) completeAction(); return; }
      var h = hitObj(hitBody); if (!h) return;
      if (h.point.y > 1.1) {
        st.mist++; setFbState("no", "Belum tepat. ", "Lubang ada di bagian bawah ember."); render();
        return;
      }
      makeAllHoles();
    }

    canvas.addEventListener("pointerdown", function (e) {
      markActive();
      if (demoOn) endDemo();
      if (busy || !st) return;
      setNdc(e);
      down = { x: e.clientX, y: e.clientY };
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      var def = cur.def, keys = Object.keys(def.traps || {}), k;
      for (k = 0; k < keys.length; k++) {
        var tl = tools[keys[k]];
        if (tl && tl.visible && hitObj(tl)) { trap(keys[k], def.traps[keys[k]]); down = null; return; }
      }
      if (def.type === "scrub") {
        drag = { kind: "scrub", lx: e.clientX, ly: e.clientY, tool: def.tool ? tools[def.tool] : null, toolTarget: new V3() };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        moveTool();
        e.preventDefault();
      } else if (def.type === "drag") {
        var t = tools[def.obj];
        if (t && hitObj(t)) {
          drag = { kind: "drag", obj: t };
          dragTarget.copy(t.position); dragTarget.y = LIFT;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
          setTip("");
          e.preventDefault();
        }
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      setNdc(e);
      if (drag.kind === "scrub") {
        scrubTo(e);
      } else if (ray.ray.intersectPlane(plane, tmp)) {
        dragTarget.set(clamp(tmp.x, -5, 5), LIFT, clamp(tmp.z, -4, 4));
      }
    });
    function release(e) {
      var d = drag, was = down; drag = null; down = null;
      if (d) {
        if (d.kind === "scrub") { if (d.tool) goHome(d.tool); }
        else if (cur && !cur.done) {
          var moved = was ? Math.hypot(e.clientX - was.x, e.clientY - was.y) : 99;
          if (moved < 12 || Math.hypot(dragTarget.x, dragTarget.z) < 2.2) completeAction(); // ketukan atau lepas di dekat ember sudah cukup
          else { goHome(d.obj); setTip("Ketuk bendanya"); }
        }
        return;
      }
      if (e.type === "pointerup" && was && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 14) { setNdc(e); tapAt(); }
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    /* ---- animasi penutup tiap aksi ---- */
    function pour(o, name) { // benda terangkat ke atas ember, dimiringkan, lalu lapisannya naik
      var from = o.position.clone(), to = new V3(0, LIFT + 0.4, 0), L = LAYERS[name].m;
      return function (cb) {
        seq([
          function (n) { tween(300, function (p) { o.position.lerpVectors(from, to, p); }, n); },
          function (n) {
            L.visible = true;
            tween(900, function (p) { o.rotation.z = -1.1 * Math.min(1, p * 2.5); L.scale.y = Math.max(0.001, p); setOpacity(o, 1 - 0.8 * p); }, n);
          },
          function (n) { o.visible = false; n(); }
        ], cb);
      };
    }
    var FIN = {
      holes: function (cb) { tween(350, function () { }, cb); },
      leaves: function (cb) { pour(tools.daun, "leaves")(cb); },
      scraps: function (cb) { pour(tools.sisa, "scraps")(cb); },
      cover: function (cb) { pour(tools.tanah, "soil")(cb); },
      mix: function (cb) { tween(350, function () { }, cb); },
      lid: function (cb) {
        lid.visible = true;
        tween(550, function (p) { lid.position.y = H + 1.3 - (1.3 - 0.06) * p; }, function () { lid.position.y = H + 0.06; cb(); });
      }
    };

    function completeAction() {
      if (!cur || cur.done) return;
      cur.done = true; endDemo();
      if (drag) { if (drag.tool) goHome(drag.tool); drag = null; }
      busy = true; setTip("");
      var id = cur.id;
      FIN[id](function () { busy = false; afterAction(id); });
    }
    function afterAction(id) {
      var step = STEPS[st.step], last = st.ai === step.acts.length - 1;
      setFbState("ok", "Tepat. ", ACTS[id].ok);
      if (last) { st.stepDone = true; render(); autoT = setTimeout(function () { autoT = null; next(); }, 1400); }
      else {
        st.ai++; render();
        autoT = setTimeout(function () { autoT = null; startAction(); render(); }, 1100);
      }
    }

    /* ---- petunjuk: contoh gerakan di model ---- */
    function gAt(v) { return function (n) { ghost.position.copy(v); n(); }; }
    function gTo(v, dur) { return function (n) { var from = ghost.position.clone(); tween(dur || 500, function (p) { ghost.position.lerpVectors(from, v, p); }, n, null, "demo"); }; }
    function gPress() { return function (n) { tween(300, function (p) { ghost.scale.setScalar(GS * (1 - 0.3 * Math.sin(p * PI))); }, n, null, "demo"); }; }
    function gWait(ms) { return function (n) { tween(ms, function () { }, n, null, "demo"); }; }
    function endDemo() {
      killTweens("demo"); demoOn = false; ghost.visible = false; ghost.scale.setScalar(GS); demoCarry = null;
      if (demoRestore) { var f = demoRestore; demoRestore = null; f(); }
      if (st && st.phase === "langkah" && cur && !cur.done) tipForAction(); else if (st && st.phase === "bahan") setTip("Ketuk benda");
    }
    function runDemo(list, carry, restore) {
      endDemo(); demoOn = true; demoCarry = carry || null; demoRestore = restore || null;
      ghost.visible = true; ghost.scale.setScalar(GS);
      seq(list, function () { endDemo(); });
    }
    function hint() {
      if (!st || busy || st.phase === "selesai" || st.stepDone) return;
      var msg, list, carry = null, restore = null, l, k;
      if (st.phase === "bahan") {
        var ni = nextCorrect(); if (ni < 0) return;
        var it = items[ni], p = it.position;
        msg = "Ini salah satu yang dipakai: " + MATS[ni].t + ". Ketuk bendanya yang berkedip.";
        it.userData.flashUntil = performance.now() + 3000;
        list = [gAt(new V3(p.x, 1.7, p.z + 0.6)), gTo(new V3(p.x, 0.7, p.z + 0.2), 650), gPress(), gWait(400), gPress(), gWait(300)];
      } else {
        if (!cur || cur.done) return;
        var id = cur.id, def = cur.def, zf = RT + 0.35;
        msg = def.hint;
        if (id === "holes") list = [gAt(new V3(0, 0.6, zf)), gPress(), gWait(300), gPress(), gWait(300)];
        else if (id === "lid") list = [gAt(new V3(0, H + 1.9, 0.5)), gTo(new V3(0, H + 1.4, 0.5), 600), gPress(), gWait(300), gPress(), gWait(300)];
        else if (id === "mix") {
          l = [gAt(new V3(-0.5, 0.7, zf))];
          for (k = 0; k < 3; k++) { l.push(gTo(new V3(0.5, 1.0 + k * 0.2, zf), 450)); l.push(gTo(new V3(-0.5, 0.8 + k * 0.2, zf), 450)); }
          list = l; carry = { obj: tools.sekop, off: new V3(-0.95, 0, 0.05) }; restore = function () { goHome(tools.sekop); };
        } else {
          var hp = toolHome[def.obj];
          list = [gAt(new V3(hp.x, 1.2, hp.z + 0.3)), gTo(new V3(hp.x, 0.6, hp.z), 600), gPress(), gWait(300), gPress(), gWait(300)];
        }
      }
      st.hints++;
      setFbState("hint", "Petunjuk: ", msg); render();
      setTip(msg);
      runDemo(list, carry, restore);
      markActive();
    }

    /* ---- selesaikan aksi lewat tombol (alternatif bagi yang sulit menggeser atau menyeret) ---- */
    function force() {
      if (!st || busy) return;
      if (st.phase === "bahan") { var ni = nextCorrect(); if (ni >= 0) { st.skips++; pick(ni); } return; }
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      st.skips++;
      var def = cur.def;
      if (def.type === "scrub") { cur.p = def.need; applyScrub(); completeAction(); }
      else if (def.type === "tap") { if (cur.id === "holes") makeAllHoles(); else completeAction(); }
      else { var o = tools[def.obj]; dragTarget.set(0, LIFT, 0); o.position.set(0, LIFT, 0); completeAction(); }
    }

    function next() {
      if (!st || busy) return;
      if (st.phase === "bahan") {
        if (Object.keys(st.picked).length < MAT_NEED) return;
        st.fb = null; st.phase = "langkah"; st.step = 0; st.ai = 0; st.stepDone = false;
        setTip(""); render();
        enterWork(function () { startAction(); render(); });
        return;
      }
      if (st.phase === "langkah" && st.stepDone) {
        st.fb = null;
        if (st.step === STEPS.length - 1) { finishAll(); return; }
        st.step++; st.ai = 0; st.stepDone = false;
        startAction(); render();
      }
    }
    function finishAll() {
      st.phase = "selesai"; st.stepDone = false; cur = null; setFbState(null);
      canvas.style.touchAction = "pan-y"; setTip(""); render();
      if (nudgeT) clearTimeout(nudgeT); $("c3-hint").classList.remove("pulse");
      try { window.dispatchEvent(new CustomEvent("daur3d3:finish", { detail: { salah: st.mist, petunjuk: st.hints, lewati: st.skips } })); } catch (e) { }
    }

    /* ---- mulai dari awal ---- */
    function resetBucket() {
      bucket.visible = false; bucket.rotation.y = 0; bucket.scale.setScalar(1);
      markers.forEach(function (m) { m.done = false; m.halo.scale.setScalar(1); m.hole.scale.setScalar(1); });
      refreshMarkers(false);
      Object.keys(LAYERS).forEach(function (k) { var L = LAYERS[k]; L.m.visible = false; L.m.scale.y = 0.001; L.m.material.color.copy(L.col); });
      lid.visible = false; lid.position.set(0, H + 1.3, 0);
      hitBody.scale.y = H + 0.3;
    }
    function resetItems() {
      slotOf = shuffle(range(MATS.length));
      items.forEach(function (it) {
        it.visible = true; it.scale.setScalar(1); it.rotation.set(0, 0, 0); setOpacity(it, 1);
        it.userData.ring.visible = false; it.userData.ring.material.opacity = 0; it.userData.label.visible = true; it.userData.fl = false;
      });
      placeItems();
    }
    function resetTools() {
      Object.keys(tools).forEach(function (k) {
        var t = tools[k]; t.visible = false; t.scale.setScalar(1); t.rotation.set(0, 0, 0); setOpacity(t, 1); t.position.copy(toolHome[k]);
      });
    }
    function begin() {
      if (autoT) { clearTimeout(autoT); autoT = null; }
      endDemo(); tweens.length = 0;
      busy = false; drag = null; down = null; cur = null;
      st = newState();
      resetBucket(); resetItems(); resetTools();
      blend = 0; updateCam();
      canvas.style.touchAction = "pan-y";
      render(); setTip("Ketuk benda"); markActive();
    }

    /* ---- render ---- */
    function frame(now) {
      requestAnimationFrame(frame);
      if (!canvas.offsetParent) return; // panel sedang tersembunyi
      for (var i = tweens.length - 1; i >= 0; i--) {
        var t = tweens[i]; if (!t) continue;
        var p = clamp((now - t.t0) / t.dur, 0, 1);
        t.fn(t.ease(p));
        if (p >= 1) { var at = tweens.indexOf(t); if (at >= 0) tweens.splice(at, 1); if (t.done) t.done(); }
      }
      if (demoCarry) demoCarry.obj.position.set(ghost.position.x + demoCarry.off.x, ghost.position.y + demoCarry.off.y, ghost.position.z + demoCarry.off.z);
      if (drag) {
        if (drag.kind === "drag") {
          var o = drag.obj, vx = dragTarget.x - o.position.x;
          o.position.lerp(dragTarget, 0.3);
          o.rotation.z += (-clamp(vx * 0.35, -0.6, 0.6) - o.rotation.z) * 0.2;
        } else if (drag.tool) {
          drag.tool.position.lerp(drag.toolTarget, 0.35);
        }
      }
      if (!reduce) markers.forEach(function (m) { if (!m.done && m.halo.visible) m.halo.scale.setScalar(1 + 0.3 * Math.sin(now / 220)); });
      items.forEach(function (it) {
        var u = it.userData;
        if (u.flashUntil > now) { u.fl = true; it.scale.setScalar(1 + 0.12 * Math.sin(now / 90)); }
        else if (u.fl) { u.fl = false; it.scale.setScalar(1); }
      });
      if (st && st.phase === "selesai" && !reduce) bucket.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage); else window.addEventListener("resize", layout);
    V = { pick: pick, hint: hint, force: force, next: next, begin: begin };
    begin();
    requestAnimationFrame(frame);
  }

  /* adegan dibuat sekali, saat panel pertama kali tampil (ukuran kanvas baru bisa dibaca saat terlihat) */
  var built = false;
  function tryBuild() {
    if (built || !stage.clientWidth) return;
    built = true;
    if (!(window.THREE && webglOk())) { showNoGl(); return; }
    try { start(); } catch (e) { console.error("daur3d3:", e); V = null; showNoGl(); }
  }
  if (window.ResizeObserver) new ResizeObserver(tryBuild).observe(stage); else window.setInterval(tryBuild, 600);
  tryBuild();
})();


/* ===== daur3d4.js ===== */
/* Latihan daur ulang 3D keempat: ecobrick dari bungkus plastik dalam botol bekas (layar info di index.html).
   Pola sama dengan daur3d.js, daur3d2.js, dan daur3d3.js: pilih bahan, lalu kerjakan tiap langkah langsung pada model 3D.
   Panel memakai id berawalan "e3-". Tidak ada data yang dikirim ke server.
   Saat selesai, window menerima event "daur3d4:finish" { salah, petunjuk, lewati }.
   Semua teks disisipkan dengan textContent. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var stage = $("e3-stage");
  if (!stage) return;

  var FALLBACK = { "--soft": "#E3EADF", "--accent": "#1B6A47" };
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function cssVar(n) {
    var v = "";
    try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) { }
    return v || FALLBACK[n] || "#888888";
  }
  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ================= data ================= */
  var MATS = [
    { k: "botol", t: "Botol plastik bening bekas", s: "Botol plastik", ok: 1 },
    { k: "bungkus", t: "Bungkus snack yang bersih dan kering", s: "Bungkus kering", ok: 1 },
    { k: "gunting", t: "Gunting", s: "Gunting", ok: 1 },
    { k: "tongkat", t: "Tongkat kayu untuk memadatkan", s: "Tongkat kayu", ok: 1 },
    { k: "basah", t: "Bungkus basah dan berminyak", s: "Bungkus basah", fb: "Sisa makanan dan air membuat ecobrick berjamur dan berbau." },
    { k: "baterai", t: "Baterai bekas", s: "Baterai bekas", fb: "Baterai termasuk B3. Jangan dimasukkan, setor ke tempat khusus." },
    { k: "kaca", t: "Botol kaca", s: "Botol kaca", fb: "Kaca mudah pecah dan bisa melukai saat dipadatkan." }
  ];
  var MAT_NEED = MATS.filter(function (m) { return m.ok; }).length;

  var T_CUT = "Potong bungkus dulu.";
  var T_FILL = "Masukkan potongan dulu.";
  var PRESS = { press1: { L: "a", to: 0.7 }, press2: { L: "b", to: 0.8 } };

  var ACTS = {
    cut: { type: "scrub", need: 1.0, tool: "gunting", title: "Gunting bungkus", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik. Gunting memotong bungkus jadi kecil supaya mudah dipadatkan.",
      ok: "Bungkus terpotong kecil.", traps: { tongkat: "Tongkat dipakai nanti untuk memadatkan." } },
    fill1: { type: "drag", obj: "p1", title: "Isi lapisan pertama", text: "Ketuk tumpukan potongan.",
      tip: "Ketuk potongan", hint: "Ketuk tumpukan potongan di sisi kanan. Botol diisi selapis demi selapis.",
      ok: "Lapisan pertama masuk.", traps: { tongkat: T_FILL, p2: "Itu untuk lapisan kedua." } },
    press1: { type: "scrub", need: 1.2, tool: "tongkat", title: "Padatkan dengan tongkat", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik. Tongkat menekan potongan sampai padat tanpa rongga udara.",
      ok: "Lapisan pertama padat.", traps: { p2: "Padatkan lapisan pertama dulu." } },
    fill2: { type: "drag", obj: "p2", title: "Isi lapisan kedua", text: "Ketuk tumpukan potongan.",
      tip: "Ketuk potongan", hint: "Ketuk tumpukan potongan yang tersisa di sisi kanan.",
      ok: "Lapisan kedua masuk.", traps: { tongkat: T_FILL } },
    press2: { type: "scrub", need: 1.2, tool: "tongkat", title: "Padatkan lagi", text: "Geser jari di layar.",
      tip: "Geser jari", hint: "Geser jari bolak-balik sampai isi botol keras dan tidak bisa dipencet.",
      ok: "Botol terisi padat.", traps: {} },
    cap: { type: "tap", title: "Tutup botol", text: "Ketuk botol.",
      tip: "Ketuk botol", hint: "Ketuk botol atau tutupnya. Tutup rapat menjaga potongan tetap di dalam.",
      ok: "Botol tertutup rapat.", traps: {} }
  };
  var STEPS = [
    { acts: ["cut"], d: "Bungkus terpotong kecil.", warn: "Pastikan botol dan bungkus bersih dan kering. Gunting dengan hati-hati." },
    { acts: ["fill1", "press1"], d: "Lapisan pertama padat." },
    { acts: ["fill2", "press2"], d: "Lapisan kedua padat." },
    { acts: ["cap"], d: "Botol tertutup rapat." }
  ];
  var DONE = "Bungkus plastik berubah jadi ecobrick, bisa dipakai jadi bata taman atau kursi. Ecobrick yang padat tidak bisa dipencet.";

  /* ================= antarmuka ================= */
  var V = null;
  var st = null;

  function newState() {
    return { phase: "bahan", step: 0, ai: 0, stepDone: false, picked: {}, bad: {}, mist: 0, hints: 0, skips: 0, fb: null, order: shuffle(range(MATS.length)) };
  }
  function setFbState(cls, strong, text) { if (st) st.fb = cls ? [cls, strong, text] : null; }

  function render() {
    if (!st) return;
    var n = STEPS.length, pct = 0, warn = $("e3-warn");
    warn.hidden = true; $("e3-next").hidden = true; $("e3-mist").textContent = "";
    var got = Object.keys(st.picked).length;
    var playing = st.phase === "bahan" ? got < MAT_NEED : (st.phase === "langkah" && !st.stepDone);
    $("e3-hint").hidden = !playing; $("e3-skip").hidden = !playing;
    if (st.phase === "bahan") {
      $("e3-phase").textContent = "Bahan";
      $("e3-title").textContent = "Pilih bahan";
      $("e3-text").textContent = "Ketuk " + MAT_NEED + " benda yang dipakai. Terpilih " + got + " dari " + MAT_NEED + ".";
      pct = (got / MAT_NEED) / (n + 1) * 100;
    } else if (st.phase === "langkah") {
      var step = STEPS[st.step], def = ACTS[step.acts[st.ai]];
      $("e3-phase").textContent = "Langkah " + (st.step + 1) + " dari " + n;
      if (st.stepDone) { $("e3-title").textContent = "Selesai"; $("e3-text").textContent = step.d; }
      else { $("e3-title").textContent = def.title; $("e3-text").textContent = def.text; }
      if (step.warn && !st.stepDone) { warn.hidden = false; warn.textContent = step.warn; }
      pct = (1 + st.step + (st.stepDone ? 1 : st.ai / step.acts.length)) / (n + 1) * 100;
    } else {
      pct = 100;
      $("e3-phase").textContent = "Selesai";
      $("e3-title").textContent = "Ecobrick jadi!";
      $("e3-text").textContent = DONE + " Salah: " + st.mist + ". Petunjuk: " + st.hints + ".";
    }
    $("e3-bar").style.width = pct + "%";
    var fb = $("e3-fb"); fb.textContent = "";
    fb.hidden = !st.fb;
    if (st.fb) {
      var b = document.createElement("b"); b.className = st.fb[0]; b.textContent = st.fb[1]; fb.appendChild(b);
      fb.appendChild(document.createTextNode(st.fb[2] || ""));
    }
  }

  function showNoGl() { $("e3-nogl").hidden = false; $("e3-body").hidden = true; }

  $("e3-hint").addEventListener("click", function () { if (V) V.hint(); });
  $("e3-skip").addEventListener("click", function () { if (V) V.force(); });
  $("e3-next").addEventListener("click", function () { if (V) V.next(); });
  $("e3-reset").addEventListener("click", function () { if (V) V.begin(); });

  /* ================= adegan 3D ================= */
  function start() {
    var canvas = $("e3-canvas");
    var V3 = THREE.Vector3, PI = Math.PI;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.65));
    var sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe3eadf, roughness: 1 });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), floorMat);
    floor.rotation.x = -PI / 2; floor.receiveShadow = true; scene.add(floor);
    function applyTheme() { floorMat.color.set(cssVar("--soft")); }
    applyTheme();
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) { }
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) { }

    /* ---- alat bantu ---- */
    function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {})); }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function invisibleMat() { return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }); }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function setOpacity(obj, f) {
      obj.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        var m = o.material;
        if (m.userData.base === undefined) { m.userData.base = m.opacity; m.userData.tr = m.transparent; }
        m.transparent = m.userData.tr || f < 1;
        m.opacity = m.userData.base * f;
      });
    }
    function confetti(rx, ry) { // tekstur potongan bungkus warna-warni
      var cv = document.createElement("canvas"); cv.width = cv.height = 128;
      var c = cv.getContext("2d"), cols = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#f4f4f0", "#fb8c00"], i;
      c.fillStyle = "#d9d9d4"; c.fillRect(0, 0, 128, 128);
      for (i = 0; i < 90; i++) {
        c.save(); c.translate(Math.random() * 128, Math.random() * 128); c.rotate(Math.random() * PI);
        c.fillStyle = cols[i % cols.length]; c.fillRect(-7, -4, 14, 8); c.restore();
      }
      var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t;
    }

    /* ---- animasi ---- */
    var tweens = [];
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function tween(dur, fn, done, ease, owner) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut, owner: owner || "" }); }
    function killTweens(owner) { for (var i = tweens.length - 1; i >= 0; i--) if (tweens[i].owner === owner) tweens.splice(i, 1); }
    function seq(list, done) {
      var i = 0;
      (function nxt() { if (i >= list.length) { if (done) done(); return; } list[i++](nxt); })();
    }
    function moveTo(obj, to, dur, done, arc) {
      var from = obj.position.clone();
      tween(dur, function (p) { obj.position.lerpVectors(from, to, p); if (arc) obj.position.y += Math.sin(p * PI) * arc; }, done);
    }
    function popIn(o, dur) { o.visible = true; tween(dur || 380, function (p) { o.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { o.scale.setScalar(1); }); }

    /* ---- botol: badan, bahu, leher; lapisan isi; tutup ---- */
    var R = 0.62, H = 2.4, TOPY = 3.0, LIFT = 3.6, HOVER = 4.0;
    var bottle = new THREE.Group(); bottle.visible = false; scene.add(bottle);
    var glass = function () { return M(0x9fd8ee, { transparent: true, opacity: 0.38, roughness: 0.15, side: THREE.DoubleSide }); };
    bottle.add(mesh(new THREE.CylinderGeometry(R, R, H, 32, 1, true), glass(), 0, H / 2, 0));
    var bbase = mesh(new THREE.CircleGeometry(R, 32), glass(), 0, 0.01, 0); bbase.rotation.x = -PI / 2; bottle.add(bbase);
    bottle.add(mesh(new THREE.CylinderGeometry(0.26, R, 0.5, 32, 1, true), glass(), 0, H + 0.25, 0));
    bottle.add(mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.35, 20, 1, true), glass(), 0, H + 0.675, 0));
    [0.6, 1.8].forEach(function (y) { var g = mesh(new THREE.TorusGeometry(R + 0.01, 0.025, 6, 40), M(0x7ab8d4), 0, y, 0); g.rotation.x = PI / 2; bottle.add(g); });
    var thread = mesh(new THREE.TorusGeometry(0.27, 0.03, 6, 20), M(0x7ab8d4), 0, TOPY - 0.05, 0); thread.rotation.x = PI / 2; bottle.add(thread);
    bottle.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var LAYERS = {};
    function layer(name, y0, h) { // dasar lapisan di y0, tinggi penuh h; scale.y dipakai untuk mengisi dan memadatkan
      var g = new THREE.CylinderGeometry(R - 0.04, R - 0.04, h, 24); g.translate(0, h / 2, 0);
      var m = new THREE.Mesh(g, M(0xffffff, { map: confetti(4, Math.max(1, Math.round(h * 1.6))), roughness: 0.85 }));
      m.position.y = y0; m.visible = false; m.scale.y = 0.001; m.userData.h = h; bottle.add(m);
      LAYERS[name] = { m: m, y0: y0 };
    }
    layer("a", 0.06, 1.3);   // 1.3 dipadatkan ke 70%: puncak di 0.97
    layer("b", 0.97, 1.35);  // 1.35 dipadatkan ke 80%: puncak di 2.05

    var lid = new THREE.Group(); lid.visible = false; bottle.add(lid);
    lid.add(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 24), M(0x1e66c8, { roughness: 0.5 }), 0, 0.15, 0));
    lid.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 24), M(0x1d4684), 0, 0.3, 0));
    lid.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var hg = new THREE.CylinderGeometry(R + 0.05, R + 0.05, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = TOPY + 0.3; bottle.add(hitBody);

    /* ---- benda di meja: bahan dan alat ---- */
    var STEEL = function () { return M(0xcfd3d6, { metalness: 0.7, roughness: 0.3 }); };
    var MODEL = {
      botol: function (g) {
        var cl = function () { return M(0x9fd8ee, { transparent: true, opacity: 0.6, roughness: 0.2 }); };
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20), cl(), 0, 0.45, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.25, 20), cl(), 0, 1.025, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.15, 14), cl(), 0, 1.225, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 14), M(0x1e66c8), 0, 1.33, 0));
      },
      bungkus: function (g) {
        [[0xe53935, 0], [0x1e88e5, 0.5], [0xfdd835, -0.4], [0x43a047, 0.9]].forEach(function (a, i) {
          var s = mesh(new THREE.BoxGeometry(0.7, 0.04, 0.45), M(a[0], { roughness: 0.4 }), 0, 0.03 + i * 0.045, 0); s.rotation.y = a[1]; g.add(s);
        });
      },
      potongan: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.2, 20), M(0xf4f4f0, { roughness: 0.4 }), 0, 0.1, 0));
        g.add(mesh(new THREE.SphereGeometry(0.46, 16, 10, 0, PI * 2, 0, PI / 2), M(0xffffff, { map: confetti(2, 1), roughness: 0.8 }), 0, 0.2, 0));
      },
      gunting: function (g) { // bilah ke arah +x, gagang merah di -x
        [1, -1].forEach(function (s, i) {
          var b = new THREE.Group();
          b.add(mesh(new THREE.BoxGeometry(0.7, 0.03, 0.07), STEEL(), 0.35, 0.1, 0));
          var h = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 16), M(0xc23b2e), -0.15, 0.1, 0.0); h.rotation.x = PI / 2; b.add(h);
          b.rotation.y = s * 0.12; g.add(b); g.userData["b" + (i + 1)] = b;
        });
      },
      tongkat: function (g) { // berbaring
        var s = mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.6, 10), M(0xb98a52), 0, 0.06, 0); s.rotation.z = PI / 2; g.add(s);
      },
      tongkatV: function (g) { // berdiri, ujung bawah di titik asal
        g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 10), M(0xb98a52), 0, 1.3, 0));
        g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), M(0x8a6a3c), 0, 0, 0));
      },
      basah: function (g) {
        var s = mesh(new THREE.BoxGeometry(0.7, 0.04, 0.45), M(0xe53935), 0, 0.04, 0); s.rotation.y = 0.4; g.add(s);
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 14), M(0x8a5a2b), 0.05, 0.07, 0.02));
        [[-0.25, 0.2], [0.3, -0.15]].forEach(function (a) { var d = mesh(new THREE.SphereGeometry(0.09, 10, 8), M(0x4aa3df, { transparent: true, opacity: 0.8 }), a[0], 0.06, a[1]); d.scale.y = 0.5; g.add(d); });
      },
      baterai: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 18), M(0x2a2f33, { roughness: 0.4 }), 0, 0.4, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.18, 18), M(0xf2c230), 0, 0.5, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), M(0xcfd3d6, { metalness: 0.7 }), 0, 0.84, 0));
      },
      kaca: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.8, 22), M(0xcfe8e0, { transparent: true, opacity: 0.45, roughness: 0.1 }), 0, 0.4, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 22), M(0xc9a227, { metalness: 0.5, roughness: 0.4 }), 0, 0.85, 0));
      }
    };
    function buildObj(key, hitR, hitY) {
      var g = new THREE.Group(); MODEL[key](g);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      g.add(mesh(new THREE.SphereGeometry(hitR || 0.85, 12, 8), invisibleMat(), 0, hitY === undefined ? 0.45 : hitY, 0));
      scene.add(g); return g;
    }
    function labelSprite(txt) {
      var cv = document.createElement("canvas"); cv.width = 320; cv.height = 80;
      var c = cv.getContext("2d");
      c.fillStyle = "rgba(10,22,18,0.88)"; roundRect(c, 4, 8, 312, 64, 14); c.fill();
      var fs = 36; c.font = "700 " + fs + "px Arial, sans-serif";
      while (fs > 20 && c.measureText(txt).width > 276) { fs -= 2; c.font = "700 " + fs + "px Arial, sans-serif"; }
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 160, 42);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      sp.scale.set(1.5, 0.375, 1); sp.renderOrder = 5; scene.add(sp); return sp;
    }
    var items = MATS.map(function (m, idx) {
      var g = buildObj(m.k, 0.8, 0.5);
      var r = new THREE.Mesh(new THREE.RingGeometry(0.64, 0.76, 36), new THREE.MeshBasicMaterial({ color: 0x2e7d4f, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      r.rotation.x = -PI / 2; r.visible = false; scene.add(r);
      g.userData = { idx: idx, ring: r, label: labelSprite(m.s), flashUntil: 0, fl: false };
      return g;
    });
    var tools = {
      gunting: buildObj("gunting", 0.8, 0.2), tongkat: buildObj("tongkatV", 0.55, 1.2),
      bungkus: buildObj("bungkus", 0.8, 0.2), p1: buildObj("potongan", 0.75, 0.3), p2: buildObj("potongan", 0.75, 0.3)
    };
    Object.keys(tools).forEach(function (k) { tools[k].userData.key = k; tools[k].visible = false; });
    var BASE_TOOLS = ["gunting", "tongkat", "bungkus"];

    /* ---- penunjuk jari untuk petunjuk ---- */
    var GS = 0.9, ghost = (function () {
      var cv = document.createElement("canvas"); cv.width = cv.height = 128; var c = cv.getContext("2d");
      c.beginPath(); c.arc(64, 64, 52, 0, PI * 2); c.fillStyle = "rgba(255,255,255,0.4)"; c.fill();
      c.lineWidth = 8; c.strokeStyle = cssVar("--accent"); c.stroke();
      c.beginPath(); c.arc(64, 64, 18, 0, PI * 2); c.fillStyle = cssVar("--accent"); c.fill();
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
      s.scale.setScalar(GS); s.renderOrder = 20; s.visible = false; scene.add(s); return s;
    })();

    /* ---- kamera dan tata letak ---- */
    var poseA, poseB, blend = 0, slots = [], slotOf = shuffle(range(MATS.length)), toolHome = {};
    function distOf(p) { var t = Math.tan(camera.fov * PI / 360); return Math.max(8, p.halfW / (t * camera.aspect), p.halfH / t); }
    function updateCam() {
      var k = blend, look = new V3().lerpVectors(poseA.look, poseB.look, k);
      var dist = distOf(poseA) * (1 - k) + distOf(poseB) * k;
      var dir = new V3(0, poseA.ey * (1 - k) + poseB.ey * k, poseA.ez * (1 - k) + poseB.ez * k).normalize();
      camera.position.copy(look).addScaledVector(dir, dist);
      camera.lookAt(look); camera.updateProjectionMatrix();
    }
    function placeItems() {
      items.forEach(function (it, idx) {
        var s = slots[slotOf[idx]], u = it.userData;
        it.position.set(s[0], 0, s[1]);
        u.label.position.set(s[0], 0.12, s[1] + 0.95);
        u.ring.position.set(s[0], 0.03, s[1]);
      });
    }
    function placeTools() {
      Object.keys(tools).forEach(function (k) {
        if (!busy && !drag && !demoCarry) tools[k].position.copy(toolHome[k]);
      });
    }
    function layout() {
      var w = stage.clientWidth || 600, h = stage.clientHeight || 400, xT;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (camera.aspect >= 1.3) {
        poseA = { look: new V3(0, 0.5, 0.3), halfW: 6.6, halfH: 3.2, ey: 0.8, ez: 0.75 };
        poseB = { look: new V3(0, 1.8, 0), halfW: 4.8, halfH: 3.6, ey: 0.65, ez: 1.0 };
        slots = range(7).map(function (j) { return [(j - 3) * 1.75, 0.4]; });
        xT = 3.0;
      } else {
        poseA = { look: new V3(0, 0.2, -0.2), halfW: 3.6, halfH: 3.4, ey: 1.0, ez: 0.55 };
        poseB = { look: new V3(0, 1.8, 0), halfW: 3.3, halfH: 3.6, ey: 0.65, ez: 1.0 };
        slots = [[-2.55, -1.6], [-0.85, -1.6], [0.85, -1.6], [2.55, -1.6], [-1.7, 1.1], [0, 1.1], [1.7, 1.1]];
        xT = 2.2;
      }
      toolHome = {
        gunting: new V3(-xT, 0, -0.9), tongkat: new V3(-xT, 0, 0.7), bungkus: new V3(xT, 0, 0),
        p1: new V3(xT, 0, -0.9), p2: new V3(xT, 0, 0.9)
      };
      updateCam();
      if (st && st.phase === "bahan") placeItems();
      placeTools();
    }

    /* ---- membaca sentuhan ---- */
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    var dragTarget = new THREE.Vector3();
    var cur = null, busy = false, drag = null, down = null;
    var demoOn = false, demoCarry = null, demoRestore = null;
    var autoT = null, nudgeT = null, tipT = null;

    function setNdc(e) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function hitObj(obj) { var r = ray.intersectObject(obj, true); return r.length ? r[0] : null; }
    function hitItem() {
      var best = -1, bd = 1e9;
      items.forEach(function (it, idx) {
        if (!it.visible) return;
        var h = ray.intersectObject(it, true);
        if (h.length && h[0].distance < bd) { bd = h[0].distance; best = idx; }
      });
      return best;
    }

    /* ---- teks kecil di atas adegan dan tombol petunjuk ---- */
    function setTip(text) {
      var tip = $("e3-tip");
      if (tipT) { clearTimeout(tipT); tipT = null; }
      tip.textContent = text || "";
      tip.classList.toggle("gone", !text);
      if (text) tipT = setTimeout(function () { tip.classList.add("gone"); }, 7000);
    }
    function markActive() {
      if (nudgeT) clearTimeout(nudgeT);
      $("e3-hint").classList.remove("pulse");
      nudgeT = setTimeout(function () { if (st && st.phase !== "selesai" && !st.stepDone) $("e3-hint").classList.add("pulse"); }, 15000);
    }
    function tipForAction() { setTip(cur ? cur.def.tip : ""); }

    /* ---- gerak kecil ---- */
    function shake(o) { var bx = o.position.x; tween(320, function (p) { o.position.x = bx + Math.sin(p * 20) * 0.14 * (1 - p); }, function () { o.position.x = bx; }); }
    function goHome(o) {
      var home = toolHome[o.userData.key], rz = o.rotation.z;
      moveTo(o, home.clone(), 420, null, 0.7);
      tween(420, function (p) { o.rotation.z = rz * (1 - p); });
    }

    /* ---- bahan ---- */
    function markItem(idx, kind) {
      var it = items[idx], r = it.userData.ring;
      r.material.color.set(kind === "ok" ? 0x2e7d4f : 0xc23b2e); r.material.opacity = 0.95; r.visible = true;
      if (kind === "bad") { setOpacity(it, 0.35); shake(it); }
      else tween(320, function (p) { it.position.y = Math.sin(p * PI) * 0.3; }, function () { it.position.y = 0; });
    }
    function pick(idx) {
      if (!st || st.phase !== "bahan" || busy || st.picked[idx] || st.bad[idx]) return;
      if (Object.keys(st.picked).length >= MAT_NEED) return;
      var m = MATS[idx];
      if (m.ok) { st.picked[idx] = 1; markItem(idx, "ok"); setFbState("ok", "Tepat. ", m.s + " dipakai."); }
      else { st.bad[idx] = 1; st.mist++; markItem(idx, "bad"); setFbState("no", "Belum tepat. ", m.fb); }
      render(); markActive();
      if (Object.keys(st.picked).length >= MAT_NEED) autoT = setTimeout(function () { autoT = null; next(); }, 1200);
    }
    function nextCorrect() {
      for (var k = 0; k < st.order.length; k++) { var mi = st.order[k]; if (MATS[mi].ok && !st.picked[mi]) return mi; }
      return -1;
    }

    /* ---- pindah dari bahan ke langkah ---- */
    function enterWork(cb) {
      busy = true;
      seq([
        function (n) {
          items.forEach(function (it) {
            tween(300, function (p) { it.scale.setScalar(1 - p); }, function () { it.visible = false; it.userData.label.visible = false; it.userData.ring.visible = false; });
          });
          tween(320, function () { }, n);
        },
        function (n) {
          bottle.visible = true; bottle.scale.setScalar(0.01);
          tween(450, function (p) { bottle.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { bottle.scale.setScalar(1); });
          BASE_TOOLS.forEach(function (k) { tools[k].position.copy(toolHome[k]); popIn(tools[k], 450); });
          tween(800, function (p) { blend = p; updateCam(); }, n);
        }
      ], function () { busy = false; cb(); });
    }

    /* ---- aksi ---- */
    function startAction() {
      var id = STEPS[st.step].acts[st.ai];
      cur = { id: id, def: ACTS[id], p: 0, done: false };
      lid.visible = id === "cap"; lid.position.set(0, HOVER, 0);
      canvas.style.touchAction = (cur.def.type === "tap") ? "pan-y" : "none"; // ketukan boleh sambil menggulir halaman
      tipForAction(); markActive();
    }

    function layerTop(name) { var L = LAYERS[name].m; return L.position.y + L.userData.h * L.scale.y; }
    function applyScrub() {
      var f = Math.min(1, cur.p / cur.def.need);
      if (cur.id === "cut") setOpacity(tools.bungkus, 1 - 0.85 * f);
      else { var P = PRESS[cur.id]; LAYERS[P.L].m.scale.y = 1 - (1 - P.to) * f; }
    }
    function goal() { // alat bergerak sendiri mengikuti kemajuan geseran jari
      if (!drag || !drag.tool || !cur) return;
      if (cur.id === "cut") {
        var pp = tools.bungkus.position;
        drag.toolTarget.set(pp.x - 0.55 + Math.sin(cur.p * 18) * 0.2, 0.55, pp.z + 0.05);
      } else {
        drag.toolTarget.set(0, layerTop(PRESS[cur.id].L) + 0.1 + Math.abs(Math.sin(cur.p * 14)) * 0.4, 0);
      }
    }
    function scrubTo(e) { // kemajuan = jarak geser jari di layar, di mana pun di kanvas
      var r = canvas.getBoundingClientRect(), unit = Math.min(r.width, 600);
      cur.p += Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / unit;
      drag.lx = e.clientX; drag.ly = e.clientY;
      applyScrub();
      if (cur.p >= cur.def.need) completeAction();
    }
    function trap(key, msg) {
      shake(tools[key]); st.mist++;
      setFbState("no", "Belum tepat. ", msg); render();
    }
    function tapAt() {
      if (st.phase === "bahan") { var idx = hitItem(); if (idx >= 0) pick(idx); return; }
      if (st.phase !== "langkah" || !cur || cur.done || cur.def.type !== "tap") return;
      if (hitObj(hitBody) || hitObj(lid)) completeAction();
    }

    canvas.addEventListener("pointerdown", function (e) {
      markActive();
      if (demoOn) endDemo();
      if (busy || !st) return;
      setNdc(e);
      down = { x: e.clientX, y: e.clientY };
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      var def = cur.def, keys = Object.keys(def.traps || {}), k;
      for (k = 0; k < keys.length; k++) {
        var tl = tools[keys[k]];
        if (tl && tl.visible && hitObj(tl)) { trap(keys[k], def.traps[keys[k]]); down = null; return; }
      }
      if (def.type === "scrub") {
        drag = { kind: "scrub", lx: e.clientX, ly: e.clientY, tool: def.tool ? tools[def.tool] : null, toolTarget: new V3() };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
        goal();
        e.preventDefault();
      } else if (def.type === "drag") {
        var t = tools[def.obj];
        if (t && hitObj(t)) {
          drag = { kind: "drag", obj: t };
          dragTarget.copy(t.position); dragTarget.y = LIFT;
          try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
          setTip("");
          e.preventDefault();
        }
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      if (!drag) return;
      setNdc(e);
      if (drag.kind === "scrub") {
        scrubTo(e);
      } else if (ray.ray.intersectPlane(plane, tmp)) {
        dragTarget.set(clamp(tmp.x, -5, 5), LIFT, clamp(tmp.z, -4, 4));
      }
    });
    function release(e) {
      var d = drag, was = down; drag = null; down = null;
      if (d) {
        if (d.kind === "scrub") { if (d.tool) goHome(d.tool); }
        else if (cur && !cur.done) {
          var moved = was ? Math.hypot(e.clientX - was.x, e.clientY - was.y) : 99;
          if (moved < 12 || Math.hypot(dragTarget.x, dragTarget.z) < 2.2) completeAction(); // ketukan atau lepas di dekat botol sudah cukup
          else { goHome(d.obj); setTip("Ketuk bendanya"); }
        }
        return;
      }
      if (e.type === "pointerup" && was && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 14) { setNdc(e); tapAt(); }
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    /* ---- animasi penutup tiap aksi ---- */
    function pour(o, name) { // tumpukan terangkat ke atas botol, dimiringkan, lalu lapisannya naik
      var from = o.position.clone(), to = new V3(0, LIFT + 0.4, 0), L = LAYERS[name].m;
      return function (cb) {
        seq([
          function (n) { tween(300, function (p) { o.position.lerpVectors(from, to, p); }, n); },
          function (n) {
            L.visible = true;
            tween(900, function (p) { o.rotation.z = -1.1 * Math.min(1, p * 2.5); L.scale.y = Math.max(0.001, p); setOpacity(o, 1 - 0.8 * p); }, n);
          },
          function (n) { o.visible = false; n(); }
        ], cb);
      };
    }
    var FIN = {
      cut: function (cb) {
        var b = tools.bungkus;
        tween(300, function (p) { setOpacity(b, 0.15 * (1 - p)); }, function () {
          b.visible = false;
          ["p1", "p2"].forEach(function (k) { tools[k].position.copy(toolHome[k]); tools[k].rotation.set(0, 0, 0); setOpacity(tools[k], 1); popIn(tools[k], 400); });
          tween(450, function () { }, cb);
        });
      },
      fill1: function (cb) { pour(tools.p1, "a")(cb); },
      press1: function (cb) { tween(350, function () { }, cb); },
      fill2: function (cb) { pour(tools.p2, "b")(cb); },
      press2: function (cb) { tween(350, function () { }, cb); },
      cap: function (cb) {
        lid.visible = true;
        tween(550, function (p) { lid.position.y = HOVER - (HOVER - TOPY) * p; }, function () { lid.position.y = TOPY; cb(); });
      }
    };

    function completeAction() {
      if (!cur || cur.done) return;
      cur.done = true; endDemo();
      if (drag) { if (drag.tool) goHome(drag.tool); drag = null; }
      busy = true; setTip("");
      var id = cur.id;
      FIN[id](function () { busy = false; afterAction(id); });
    }
    function afterAction(id) {
      var step = STEPS[st.step], last = st.ai === step.acts.length - 1;
      setFbState("ok", "Tepat. ", ACTS[id].ok);
      if (last) { st.stepDone = true; render(); autoT = setTimeout(function () { autoT = null; next(); }, 1400); }
      else {
        st.ai++; render();
        autoT = setTimeout(function () { autoT = null; startAction(); render(); }, 1100);
      }
    }

    /* ---- petunjuk: contoh gerakan di model ---- */
    function gAt(v) { return function (n) { ghost.position.copy(v); n(); }; }
    function gTo(v, dur) { return function (n) { var from = ghost.position.clone(); tween(dur || 500, function (p) { ghost.position.lerpVectors(from, v, p); }, n, null, "demo"); }; }
    function gPress() { return function (n) { tween(300, function (p) { ghost.scale.setScalar(GS * (1 - 0.3 * Math.sin(p * PI))); }, n, null, "demo"); }; }
    function gWait(ms) { return function (n) { tween(ms, function () { }, n, null, "demo"); }; }
    function endDemo() {
      killTweens("demo"); demoOn = false; ghost.visible = false; ghost.scale.setScalar(GS); demoCarry = null;
      if (demoRestore) { var f = demoRestore; demoRestore = null; f(); }
      if (st && st.phase === "langkah" && cur && !cur.done) tipForAction(); else if (st && st.phase === "bahan") setTip("Ketuk benda");
    }
    function runDemo(list, carry, restore) {
      endDemo(); demoOn = true; demoCarry = carry || null; demoRestore = restore || null;
      ghost.visible = true; ghost.scale.setScalar(GS);
      seq(list, function () { endDemo(); });
    }
    function hint() {
      if (!st || busy || st.phase === "selesai" || st.stepDone) return;
      var msg, list, carry = null, restore = null, l, k;
      if (st.phase === "bahan") {
        var ni = nextCorrect(); if (ni < 0) return;
        var it = items[ni], p = it.position;
        msg = "Ini salah satu yang dipakai: " + MATS[ni].t + ". Ketuk bendanya yang berkedip.";
        it.userData.flashUntil = performance.now() + 3000;
        list = [gAt(new V3(p.x, 1.7, p.z + 0.6)), gTo(new V3(p.x, 0.7, p.z + 0.2), 650), gPress(), gWait(400), gPress(), gWait(300)];
      } else {
        if (!cur || cur.done) return;
        var id = cur.id, def = cur.def, zf = R + 0.35;
        msg = def.hint;
        if (id === "cap") list = [gAt(new V3(0, HOVER + 0.6, 0.5)), gTo(new V3(0, HOVER, 0.5), 600), gPress(), gWait(300), gPress(), gWait(300)];
        else if (id === "cut") {
          var pp = tools.bungkus.position;
          l = [gAt(new V3(pp.x - 0.2, 0.7, pp.z))];
          for (k = 0; k < 3; k++) { l.push(gTo(new V3(pp.x + 0.2, 0.7, pp.z), 400)); l.push(gTo(new V3(pp.x - 0.2, 0.7, pp.z), 400)); }
          list = l; carry = { obj: tools.gunting, off: new V3(-0.35, -0.15, 0) }; restore = function () { goHome(tools.gunting); };
        } else if (id === "press1" || id === "press2") {
          var top = layerTop(PRESS[id].L);
          l = [gAt(new V3(0, top + 0.8, zf))];
          for (k = 0; k < 3; k++) { l.push(gTo(new V3(0, top + 0.15, zf), 380)); l.push(gTo(new V3(0, top + 0.8, zf), 380)); }
          list = l; carry = { obj: tools.tongkat, off: new V3(0, 0, -zf) }; restore = function () { goHome(tools.tongkat); };
        } else {
          var hp = toolHome[def.obj];
          list = [gAt(new V3(hp.x, 1.2, hp.z + 0.3)), gTo(new V3(hp.x, 0.6, hp.z), 600), gPress(), gWait(300), gPress(), gWait(300)];
        }
      }
      st.hints++;
      setFbState("hint", "Petunjuk: ", msg); render();
      setTip(msg);
      runDemo(list, carry, restore);
      markActive();
    }

    /* ---- selesaikan aksi lewat tombol (alternatif bagi yang sulit menggeser atau menyeret) ---- */
    function force() {
      if (!st || busy) return;
      if (st.phase === "bahan") { var ni = nextCorrect(); if (ni >= 0) { st.skips++; pick(ni); } return; }
      if (st.phase !== "langkah" || !cur || cur.done || st.stepDone) return;
      st.skips++;
      var def = cur.def;
      if (def.type === "scrub") { cur.p = def.need; applyScrub(); completeAction(); }
      else if (def.type === "tap") completeAction();
      else { var o = tools[def.obj]; dragTarget.set(0, LIFT, 0); o.position.set(0, LIFT, 0); completeAction(); }
    }

    function next() {
      if (!st || busy) return;
      if (st.phase === "bahan") {
        if (Object.keys(st.picked).length < MAT_NEED) return;
        st.fb = null; st.phase = "langkah"; st.step = 0; st.ai = 0; st.stepDone = false;
        setTip(""); render();
        enterWork(function () { startAction(); render(); });
        return;
      }
      if (st.phase === "langkah" && st.stepDone) {
        st.fb = null;
        if (st.step === STEPS.length - 1) { finishAll(); return; }
        st.step++; st.ai = 0; st.stepDone = false;
        startAction(); render();
      }
    }
    function finishAll() {
      st.phase = "selesai"; st.stepDone = false; cur = null; setFbState(null);
      canvas.style.touchAction = "pan-y"; setTip(""); render();
      if (nudgeT) clearTimeout(nudgeT); $("e3-hint").classList.remove("pulse");
      try { window.dispatchEvent(new CustomEvent("daur3d4:finish", { detail: { salah: st.mist, petunjuk: st.hints, lewati: st.skips } })); } catch (e) { }
    }

    /* ---- mulai dari awal ---- */
    function resetBottle() {
      bottle.visible = false; bottle.rotation.y = 0; bottle.scale.setScalar(1);
      Object.keys(LAYERS).forEach(function (k) { var L = LAYERS[k].m; L.visible = false; L.scale.y = 0.001; });
      lid.visible = false; lid.position.set(0, HOVER, 0);
    }
    function resetItems() {
      slotOf = shuffle(range(MATS.length));
      items.forEach(function (it) {
        it.visible = true; it.scale.setScalar(1); it.rotation.set(0, 0, 0); setOpacity(it, 1);
        it.userData.ring.visible = false; it.userData.ring.material.opacity = 0; it.userData.label.visible = true; it.userData.fl = false;
      });
      placeItems();
    }
    function resetTools() {
      Object.keys(tools).forEach(function (k) {
        var t = tools[k]; t.visible = false; t.scale.setScalar(1); t.rotation.set(0, 0, 0); setOpacity(t, 1); t.position.copy(toolHome[k]);
      });
    }
    function begin() {
      if (autoT) { clearTimeout(autoT); autoT = null; }
      endDemo(); tweens.length = 0;
      busy = false; drag = null; down = null; cur = null;
      st = newState();
      resetBottle(); resetItems(); resetTools();
      blend = 0; updateCam();
      canvas.style.touchAction = "pan-y";
      render(); setTip("Ketuk benda"); markActive();
    }

    /* ---- render ---- */
    function frame(now) {
      requestAnimationFrame(frame);
      if (!canvas.offsetParent) return; // panel sedang tersembunyi
      for (var i = tweens.length - 1; i >= 0; i--) {
        var t = tweens[i]; if (!t) continue;
        var p = clamp((now - t.t0) / t.dur, 0, 1);
        t.fn(t.ease(p));
        if (p >= 1) { var at = tweens.indexOf(t); if (at >= 0) tweens.splice(at, 1); if (t.done) t.done(); }
      }
      if (demoCarry) demoCarry.obj.position.set(ghost.position.x + demoCarry.off.x, ghost.position.y + demoCarry.off.y, ghost.position.z + demoCarry.off.z);
      if (drag) {
        if (drag.kind === "drag") {
          var o = drag.obj, vx = dragTarget.x - o.position.x;
          o.position.lerp(dragTarget, 0.3);
          o.rotation.z += (-clamp(vx * 0.35, -0.6, 0.6) - o.rotation.z) * 0.2;
        } else if (drag.tool) {
          goal(); drag.tool.position.lerp(drag.toolTarget, 0.35);
        }
      }
      var gt = tools.gunting; // bilah gunting membuka dan menutup saat dipakai
      if (gt.visible && ((drag && drag.tool === gt) || (demoCarry && demoCarry.obj === gt)) && !reduce) {
        var a = 0.05 + 0.22 * (0.5 + 0.5 * Math.sin(now / 70)); gt.userData.b1.rotation.y = a; gt.userData.b2.rotation.y = -a;
      }
      items.forEach(function (it) {
        var u = it.userData;
        if (u.flashUntil > now) { u.fl = true; it.scale.setScalar(1 + 0.12 * Math.sin(now / 90)); }
        else if (u.fl) { u.fl = false; it.scale.setScalar(1); }
      });
      if (st && st.phase === "selesai" && !reduce) bottle.rotation.y += 0.01;
      renderer.render(scene, camera);
    }

    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(stage); else window.addEventListener("resize", layout);
    V = { pick: pick, hint: hint, force: force, next: next, begin: begin };
    begin();
    requestAnimationFrame(frame);
  }

  /* adegan dibuat sekali, saat panel pertama kali tampil (ukuran kanvas baru bisa dibaca saat terlihat) */
  var built = false;
  function tryBuild() {
    if (built || !stage.clientWidth) return;
    built = true;
    if (!(window.THREE && webglOk())) { showNoGl(); return; }
    try { start(); } catch (e) { console.error("daur3d4:", e); V = null; showNoGl(); }
  }
  if (window.ResizeObserver) new ResizeObserver(tryBuild).observe(stage); else window.setInterval(tryBuild, 600);
  tryBuild();
})();


