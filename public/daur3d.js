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
    var V3 = THREE.Vector3, PI = Math.PI;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.6));
    var sun = new THREE.DirectionalLight(0xffffff, 0.65);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
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

    /* ---- lingkungan pantulan: kotak cahaya studio kecil, supaya kaca, logam, dan plastik punya kilap yang nyata ---- */
    var envOK = false;
    try {
      if (renderer.capabilities.isWebGL2 && THREE.PMREMGenerator) {
        var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
        var dm = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
        var dp = dm.geometry.attributes.position, dc = [], ei, et;
        for (ei = 0; ei < dp.count; ei++) {
          et = dp.getY(ei) / 20;
          if (et > 0) dc.push(0.5 + 0.4 * et, 0.56 + 0.38 * et, 0.58 + 0.4 * et);
          else dc.push(0.28 + 0.22 * (1 + et), 0.31 + 0.24 * (1 + et), 0.3 + 0.22 * (1 + et));
        }
        dm.geometry.setAttribute("color", new THREE.Float32BufferAttribute(dc, 3));
        es.add(dm);
        [[12, 8, 0, 14, 2, 5], [3, 10, -14, 5, 3, 6], [3, 9, 12, 4, 8, 4.5], [8, 3, 2, 3, -15, 2.5]].forEach(function (a) {
          var sb = new THREE.Mesh(new THREE.PlaneGeometry(a[0], a[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(a[5], a[5], a[5] * 0.97), side: THREE.DoubleSide }));
          sb.position.set(a[2], a[3], a[4]); sb.lookAt(0, 0, 0); es.add(sb);
        });
        scene.environment = pm.fromScene(es, 0.03).texture;
        envOK = true;
        pm.dispose();
      }
    } catch (e) { envOK = false; }
    floorMat.envMapIntensity = 0; // lantai tetap memakai warna tema, tidak ikut terpantul

    /* ---- alat bantu ---- */
    function M(color, o) {
      var p = Object.assign({ color: color, roughness: 0.7, metalness: 0, envMapIntensity: 0.35 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6; // tanpa peta pantulan, logam penuh akan tampil gelap
      return new THREE.MeshStandardMaterial(p);
    }
    function MP(color, o) { // plastik atau cat berlapis bening (kilap basah, plastik mengilap)
      var p = Object.assign({ color: color, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6;
      return new THREE.MeshPhysicalMaterial(p);
    }
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

    /* ---- derau dan bilangan acak berbenih: bentuk kusut selalu sama tiap dimuat ---- */
    function rng(seed) {
      var s = seed >>> 0;
      return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function hash3(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
    function vnoise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      function l(a, b, t) { return a + (b - a) * t; }
      return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 2.1 + 9.1) * 0.3 + vnoise(x * 4.3 + 2.7, y * 4.3 + 8.1, z * 4.3 + 3.3) * 0.15; }

    /* ---- tekstur prosedural (kanvas) dan bentuk putar ---- */
    var ANI = 4; try { ANI = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) { }
    function ccv(w, h, draw) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); return cv; }
    function tex(cv, rx, ry) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = ANI; return t; }
    function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48); }
    function offsetProfile(pts, t) { // profil bergeser ke dalam sejauh t: dinding botol yang punya ketebalan
      return pts.map(function (p, i) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [Math.max(0.002, p[0] - dy / l * t), p[1] + dx / l * t];
      });
    }
    /* bayangan kontak lembut di bawah benda: pelengkap bayangan matahari */
    var csCv = null;
    function contactShadow(rx, rz, ox) {
      if (!csCv) csCv = ccv(64, 64, function (c) {
        var gr = c.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(0.5, "rgba(0,0,0,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      });
      var t = tex(csCv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -PI / 2; m.scale.set(rx * 2, rz * 2, 1); m.position.set(ox || 0, 0.006, 0); m.renderOrder = -1;
      m.raycast = function () { }; m.userData.noCast = true; m.userData.noRecv = true; return m;
    }


    /* plastik bening atau kebiruan: lapisan warna tipis ditambah lapisan pantulan (hanya kilap) */
    function glassMesh(geo, tint, opacity, reflI, rough) {
      var g = new THREE.Group(), r = rough === undefined ? 0.06 : rough;
      var a = new THREE.Mesh(geo, MP(tint, { roughness: r, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 }));
      var b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: r, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: reflI }));
      a.renderOrder = 1; b.renderOrder = 2;
      a.userData.noCast = a.userData.noRecv = b.userData.noCast = b.userData.noRecv = true;
      g.add(a); g.add(b); return g;
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

    /* ================= bahan visual: gumpalan, pita, daun, tanah, label, tutup botol ================= */
    function blob(rad, sx, sy, sz, seed, color, o) { // gumpalan tak beraturan: noda lengket, remah, tetesan cat
      var g = new THREE.SphereGeometry(rad, 16, 12), p = g.attributes.position, i, x, y, z, k;
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = 1 + (fbm(x / rad * 1.6 + seed, y / rad * 1.6, z / rad * 1.6) - 0.5) * 0.7;
        p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
      }
      g.computeVertexNormals();
      return mesh(g, M(color, Object.assign({ roughness: 0.95 }, o || {})), 0, 0, 0);
    }
    function ribbonGeo(len, wd, bend, seed) { // lembar melengkung: ujung pita lakban
      var g = new THREE.PlaneGeometry(len, wd, 14, 2), p = g.attributes.position, i, x, y, th, tw, rho = len / (2 * bend);
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); th = x / (len / 2) * bend; tw = th * 0.5 + (fbm(x * 3 + seed, 1, seed) - 0.5) * 0.6;
        p.setXYZ(i, rho * Math.sin(th), y * Math.cos(tw), rho * (1 - Math.cos(th)) + y * Math.sin(tw));
      }
      g.computeVertexNormals(); return g;
    }
    function knurl(rad, h, n, amp, seg) { // sisi tutup bergerigi
      var g = new THREE.CylinderGeometry(rad, rad, h, seg, 1, true), p = g.attributes.position, i, a, k;
      for (i = 0; i < p.count; i++) { a = Math.atan2(p.getZ(i), p.getX(i)); k = 1 + amp * Math.cos(a * n); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      g.computeVertexNormals(); return g;
    }
    function makeCap(color) { // tutup ulir botol: sisi bergerigi, cincin segel, atas membulat
      var g = new THREE.Group();
      var mat = function () { return MP(color, { roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.28, envMapIntensity: 0.8 }); };
      g.add(mesh(knurl(0.322, 0.235, 34, 0.035, 170), mat(), 0, 0.1925, 0));
      g.add(mesh(lathe([[0.001, 0.339], [0.18, 0.34], [0.285, 0.335], [0.314, 0.318], [0.322, 0.296], [0.322, 0.27]], 64), mat(), 0, 0, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.318, 0.318, 0.058, 64, 1, true), mat(), 0, 0.031, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.296, 0.296, 0.02, 48, 1, true), mat(), 0, 0.068, 0));
      return g;
    }
    var LEAFC = null, LEAFT = null, LEAFG = {};
    function leafTex() { // siluet daun dengan tulang daun; warna daun datang dari warna material
      if (!LEAFT) {
        LEAFC = ccv(128, 192, function (c, w, h) {
          var i, gr;
          c.clearRect(0, 0, w, h);
          c.beginPath(); c.moveTo(w / 2, 4);
          c.bezierCurveTo(w * 0.98, h * 0.28, w * 0.92, h * 0.72, w / 2, h - 6);
          c.bezierCurveTo(w * 0.08, h * 0.72, w * 0.02, h * 0.28, w / 2, 4); c.closePath();
          gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#d9cdb0"); gr.addColorStop(0.5, "#f4ecd8"); gr.addColorStop(1, "#d3c6a6");
          c.fillStyle = gr; c.fill();
          c.strokeStyle = "rgba(90,70,40,0.6)"; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w / 2, h - 2); c.stroke();
          c.lineWidth = 1.4; c.strokeStyle = "rgba(90,70,40,0.38)";
          for (i = 1; i < 8; i++) {
            c.beginPath(); c.moveTo(w / 2, h * (0.1 + i * 0.11)); c.lineTo(w * 0.12 + i * 2, h * (0.04 + i * 0.1)); c.stroke();
            c.beginPath(); c.moveTo(w / 2, h * (0.1 + i * 0.11)); c.lineTo(w * 0.88 - i * 2, h * (0.04 + i * 0.1)); c.stroke();
          }
        });
        LEAFT = tex(LEAFC);
      }
      return LEAFT;
    }
    function leafGeo(i, w, h) {
      var key = i + ":" + w.toFixed(2) + ":" + h.toFixed(2);
      if (LEAFG[key]) return LEAFG[key];
      var g = new THREE.PlaneGeometry(w, h, 4, 6), p = g.attributes.position, k, x, y;
      for (k = 0; k < p.count; k++) { x = p.getX(k) / (w / 2); y = p.getY(k) / (h / 2); p.setZ(k, 0.05 * x * x * w / 0.3 - 0.025 * y * y + (fbm(x * 2 + i * 3, y * 2, i) - 0.5) * 0.04); }
      g.computeVertexNormals(); LEAFG[key] = g; return g;
    }
    function leafMesh(color, i, w, h) { return new THREE.Mesh(leafGeo(i, w, h), M(color, { map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, envMapIntensity: 0.4 })); }
    function sprout(g, x, y, z, s) { // bibit: batang melengkung, dua daun lembaga, empat daun sejati
      var pts = [new V3(0, 0, 0), new V3(0.02 * s, 0.22 * s, 0.01 * s), new V3(-0.01 * s, 0.42 * s, 0.03 * s), new V3(0, 0.55 * s, 0.04 * s)];
      g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.026 * s, 8, false), M(0x6fae4a, { roughness: 0.6 }), x, y, z));
      function leaf(col, ny, a, elev, w, h, i) {
        var hd = new THREE.Group(), tl = new THREE.Group(), lf = leafMesh(col, i, w * s, h * s);
        hd.position.set(x, y + ny * s, z); hd.rotation.y = a; tl.rotation.x = elev;
        lf.rotation.x = -PI / 2; lf.position.z = -h * s / 2; tl.add(lf); hd.add(tl); g.add(hd);
      }
      leaf(0x8ccf5a, 0.4, 0.5, 0.35, 0.13, 0.18, 0); leaf(0x8ccf5a, 0.4, 0.5 + PI, 0.35, 0.13, 0.18, 1);
      [0, 1, 2, 3].forEach(function (n) { leaf(n % 2 ? 0x3f9b4a : 0x4aa84f, 0.55, n * 1.57 + 0.3, 0.55 + n * 0.12, 0.22, 0.32, n % 3); });
    }
    var SOIL = null;
    function soilSet() {
      if (SOIL) return SOIL;
      var r1 = rng(41);
      function dots(c, bump) {
        var i, x, y, rr, t, g;
        c.fillStyle = bump ? "#555555" : "#3b2713"; c.fillRect(0, 0, 512, 512);
        for (i = 0; i < 5200; i++) {
          x = r1() * 512; y = r1() * 512; rr = 0.8 + r1() * 3.2; t = r1();
          if (bump) { g = Math.round(60 + t * 190); c.fillStyle = "rgb(" + g + "," + g + "," + g + ")"; }
          else c.fillStyle = t < 0.55 ? "rgba(20,12,6," + (0.2 + r1() * 0.4).toFixed(2) + ")" : t < 0.93 ? "rgba(110,78,44," + (0.15 + r1() * 0.35).toFixed(2) + ")" : t < 0.975 ? "rgba(225,225,215,0.85)" : "rgba(150,170,90,0.6)";
          c.beginPath(); c.arc(x, y, rr, 0, PI * 2); c.fill();
        }
      }
      SOIL = { c: ccv(512, 512, function (c) { dots(c, false); }), b: ccv(512, 512, function (c) { dots(c, true); }) };
      return SOIL;
    }
    function soilMat(rx, ry) { var s = soilSet(); return M(0xffffff, { map: tex(s.c, rx, ry), bumpMap: tex(s.b, rx, ry), bumpScale: 2, roughness: 1, envMapIntensity: 0.15 }); }
    var CLODCOL = [0x3a2512, 0x4b3018, 0x5a3b1f, 0x33200f];
    function sodaLabel(w, h) { // label kaleng: merah bergradasi, gelombang putih, gelembung, tulisan SODA
      return ccv(w, h, function (c) {
        var x, i, r1 = rng(29), gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#e0392c"); gr.addColorStop(0.5, "#cf2a22"); gr.addColorStop(1, "#a81d18"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.moveTo(0, h * 0.74);
        for (x = 0; x <= w; x += 8) c.lineTo(x, h * 0.74 + Math.sin(x / w * PI * 6) * h * 0.05);
        for (x = w; x >= 0; x -= 8) c.lineTo(x, h * 0.82 + Math.sin(x / w * PI * 6 + 0.6) * h * 0.05);
        c.closePath(); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 2;
        for (i = 0; i < 46; i++) { c.beginPath(); c.arc(r1() * w, r1() * h * 0.72, 3 + r1() * 9, 0, PI * 2); c.stroke(); }
        c.textAlign = "center"; c.textBaseline = "middle"; c.font = "900 " + Math.round(h * 0.4) + "px Arial, sans-serif";
        c.lineWidth = Math.round(h * 0.05); c.strokeStyle = "rgba(90,10,8,0.6)"; c.strokeText("SODA", w / 2, h * 0.4);
        c.fillStyle = "#ffffff"; c.fillText("SODA", w / 2, h * 0.4);
        c.font = "700 " + Math.round(h * 0.09) + "px Arial, sans-serif"; c.fillStyle = "rgba(255,255,255,0.9)"; c.fillText("330 ml", w / 2, h * 0.64);
      });
    }
    function waterLabel(w, h) { // label botol air mineral: biru bergradasi, tetes dan gelombang, tulisan AIR
      return ccv(w, h, function (c) {
        var x, i, gr = c.createLinearGradient(0, 0, 0, h), r1 = rng(17);
        gr.addColorStop(0, "#2b7ae0"); gr.addColorStop(1, "#154a99"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.16)";
        for (i = 0; i < 9; i++) { x = i * w / 9 + 30; c.beginPath(); c.moveTo(x, h * 0.12); c.quadraticCurveTo(x + 26, h * 0.34, x, h * 0.4); c.quadraticCurveTo(x - 26, h * 0.34, x, h * 0.12); c.fill(); }
        c.fillStyle = "rgba(255,255,255,0.85)"; c.beginPath(); c.moveTo(0, h * 0.78);
        for (x = 0; x <= w; x += 8) c.lineTo(x, h * 0.78 + Math.sin(x / w * PI * 8) * h * 0.04);
        c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill();
        c.textAlign = "center"; c.textBaseline = "middle"; c.font = "900 " + Math.round(h * 0.46) + "px Arial, sans-serif";
        c.lineWidth = Math.round(h * 0.04); c.strokeStyle = "rgba(0,30,80,0.5)"; c.strokeText("AIR", w / 2, h * 0.42);
        c.fillStyle = "#ffffff"; c.fillText("AIR", w / 2, h * 0.42);
        c.font = "700 " + Math.round(h * 0.09) + "px Arial, sans-serif"; c.fillStyle = "#12396f"; c.fillText("MINERAL", w / 2, h * 0.88);
      });
    }

    /* ---- ukuran dan bentuk botol ---- */
    var R = 0.6, CUT = 2.35, TOP = 3.6, LIFT = 2.7;

    /* profil botol air kemasan: bagian bawah sampai garis potong (dua alur dan sedikit pinggang), bagian atas dari garis potong (bahu, cincin leher, leher) */
    var petP = null;
    function petOuter() {
      if (petP) return petP;
      var low = [[0.002, 0.075], [0.18, 0.07], [0.35, 0.04], [0.45, 0.004], [0.52, 0.0], [0.57, 0.03], [0.592, 0.09], [R - 0.004, 0.17]], y, k, t, s;
      for (y = 0.22; y < CUT - 0.001; y += 0.06) {
        low.push([R - 0.034 * Math.exp(-Math.pow((y - 0.6) / 0.075, 2)) - 0.034 * Math.exp(-Math.pow((y - 1.8) / 0.075, 2)) - 0.012 * Math.exp(-Math.pow((y - 1.2) / 0.4, 2)), y]);
      }
      low.push([R, CUT]);
      var up = [[R, 0.0], [R, 0.3]];
      for (k = 1; k <= 12; k++) { t = k / 12; s = t * t * (3 - 2 * t); up.push([0.222 + (R - 0.222) * (1 - s), 0.3 + 0.55 * t]); }
      up.push([0.224, 0.9], [0.272, 0.915], [0.276, 0.93], [0.27, 0.945], [0.226, 0.96], [0.22, 0.985], [0.218, 1.1], [0.226, 1.12], [0.232, 1.13], [0.224, 1.134]);
      petP = { low: low, up: up };
      return petP;
    }
    function petShell(pts, seg) { return lathe(pts.concat(offsetProfile(pts, 0.013).reverse()), seg || 56); }

    var bottle = new THREE.Group(); bottle.visible = false; scene.add(bottle);
    var lower = new THREE.Group(), upper = new THREE.Group();
    bottle.add(lower, upper);
    bottle.add(contactShadow(0.8, 0.8, 0));
    lower.add(glassMesh(petShell(petOuter().low), 0xdff2f8, 0.18, 2.0));
    // bagian atas: pusat grup ada di garis potong supaya bisa berputar dari sana
    upper.position.set(0, CUT, 0);
    upper.add(glassMesh(petShell(petOuter().up), 0xdff2f8, 0.18, 2.0));
    var cap = makeCap(0x1e66c8); cap.scale.setScalar(0.78); cap.position.y = 1.0; upper.add(cap);
    upper.traverse(function (o) { if (o.isMesh && !o.userData.noCast) o.castShadow = true; });

    // tepi pot setelah dipotong: plastik putih kebiruan yang tebal
    var edge = mesh(new THREE.TorusGeometry(R - 0.006, 0.02, 8, 48), MP(0xcfe8f2, { roughness: 0.5, clearcoat: 0.3 }), 0, CUT, 0); edge.rotation.x = PI / 2; edge.visible = false; lower.add(edge);

    // noda kotor: bercak lengket kering yang dipipihkan menempel di dinding (skala dipakai untuk menghilangkannya)
    var specks = [], i, scol = [0x6a4a22, 0x7a5a2e, 0x4a3318];
    for (i = 0; i < 14; i++) {
      var th = ((i * 0.37) % 1) * 2.3 - 1.15, sy = 0.25 + ((i * 0.53) % 1) * 1.9;
      var sp = blob(0.065, 1, 1, 1, i * 1.7, scol[i % 3], { roughness: 0.3 });
      sp.position.set(Math.sin(th) * (R + 0.015), sy, Math.cos(th) * (R + 0.015));
      sp.rotation.y = th; lower.add(sp); specks.push(sp);
    }

    // label "AIR": lengan kertas berlapis bening yang menempel di badan botol
    var label = new THREE.Group(); lower.add(label);
    var lbm = mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 0.8, 64, 1, true), MP(0xffffff, { map: tex(waterLabel(1280, 256)), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.7 }), 0, 1.1, 0);
    lbm.rotation.y = PI; label.add(lbm);

    // garis potong putus-putus
    var ring = new THREE.Group(), dashes = [], ND = 28;
    for (i = 0; i < ND; i++) {
      var a = i / ND * PI * 2;
      var d = mesh(new THREE.BoxGeometry(0.17, 0.05, 0.035), new THREE.MeshBasicMaterial({ color: 0xc23b2e }), Math.sin(a) * (R + 0.03), CUT, Math.cos(a) * (R + 0.03));
      d.rotation.y = a; ring.add(d);
      dashes.push({ m: d, a: Math.abs(a > PI ? a - PI * 2 : a) });
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
      hole.add(mesh(new THREE.RingGeometry(0.083, 0.105, 20), M(0xcfe8f2, { roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0.004)); // tepi lubang yang baru dilubangi
      g.add(dot, halo, hole); lower.add(g);
      markers.push({ g: g, dot: dot, halo: halo, hole: hole, pos: g.position.clone(), done: false });
    });
    function refreshMarkers(on) {
      markers.forEach(function (m) { m.dot.visible = on && !m.done; m.halo.visible = on && !m.done; m.hole.visible = m.done; });
    }

    // cat di badan botol: lapisan enamel mengilap dengan bekas sapuan kuas dan tetesan
    var paint = new THREE.Group(); paint.visible = false; paint.scale.y = 0.001; lower.add(paint);
    var strokeCv = ccv(256, 256, function (c, w, h) {
      var r1 = rng(71), i, g, x;
      c.fillStyle = "#808080"; c.fillRect(0, 0, w, h);
      for (i = 0; i < 90; i++) { x = r1() * w; g = 90 + Math.round(r1() * 100); c.strokeStyle = "rgb(" + g + "," + g + "," + g + ")"; c.lineWidth = 1 + r1() * 3; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + (r1() - 0.5) * 6, h); c.stroke(); }
    });
    function band(y0, h, col, r) {
      var g = new THREE.CylinderGeometry(r, r, h, 48, 1, true); g.translate(0, y0 + h / 2, 0);
      return new THREE.Mesh(g, MP(col, { roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, bumpMap: tex(strokeCv, 3, 1), bumpScale: 1.2, side: THREE.DoubleSide, envMapIntensity: 0.7 }));
    }
    paint.add(band(0.02, 1.9, 0xe0ae00, R + 0.02), band(0.5, 0.3, 0xc23b2e, R + 0.026), band(1.15, 0.14, 0xffffff, R + 0.032));
    [[0.5, 0xc23b2e, 0.026, 5, 0.3], [1.15, 0xffffff, 0.032, 3, 1.1]].forEach(function (b, bi) { // tetesan di tepi bawah pita
      var k, an, dl, dd;
      for (k = 0; k < b[3]; k++) {
        an = k * 1.3 + b[4]; dl = 0.1 + ((k * 0.43 + bi * 0.2) % 1) * 0.14;
        dd = blob(0.03, 1, 1, 1, k * 1.9 + bi, b[1], { roughness: 0.25, metalness: 0.05 });
        dd.scale.set(1, dl / 0.06, 0.7); dd.position.set(Math.sin(an) * (R + 0.04), b[0] - dl * 0.5, Math.cos(an) * (R + 0.04)); dd.rotation.y = an; paint.add(dd);
      }
    });
    paint.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // tanah dan bibit di dalam pot: sisi bertekstur, permukaan atas bergelombang, gumpalan; skala y dipakai untuk mengisi
    var soilFill = new THREE.Group(); soilFill.visible = false; soilFill.scale.y = 0.001; lower.add(soilFill);
    (function () {
      var RL = R - 0.06, k, p, an, rr, c;
      var sg = new THREE.CylinderGeometry(R - 0.05, R - 0.06, 1.5, 36, 1, true); sg.translate(0, 0.81, 0);
      soilFill.add(new THREE.Mesh(sg, soilMat(3, 2)));
      var rg = new THREE.RingGeometry(0.001, RL, 48, 12); p = rg.attributes.position;
      for (k = 0; k < p.count; k++) { var q = (p.getX(k) * p.getX(k) + p.getY(k) * p.getY(k)) / (RL * RL); p.setZ(k, q >= 1 ? 0 : (1 - q) * 0.06 + (fbm(p.getX(k) * 4 + 3, p.getY(k) * 4, 2.1) - 0.5) * 0.09 * (1 - q)); }
      rg.computeVertexNormals(); rg.rotateX(-PI / 2);
      soilFill.add(mesh(rg, soilMat(2.4, 2.4), 0, 1.56, 0));
      var r = rng(95);
      for (k = 0; k < 26; k++) {
        an = r() * PI * 2; rr = (RL - 0.06) * Math.sqrt(r());
        c = blob(0.03 + r() * 0.04, 1, 0.7, 1, r() * 9, CLODCOL[k % 4], { roughness: 1 });
        c.position.set(Math.cos(an) * rr, 1.58 + (1 - rr * rr / (RL * RL)) * 0.05, Math.sin(an) * rr); c.rotation.y = r() * 6; soilFill.add(c);
      }
      soilFill.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    })();
    var plant = new THREE.Group(); plant.position.set(0, 1.56, 0); plant.visible = false; plant.scale.setScalar(0.001); lower.add(plant);
    sprout(plant, 0, 0, 0, 1.5);
    plant.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // badan botol yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = TOP; bottle.add(hitBody);

    // keran air untuk bilas: pipa turun dari atas, melengkung menjadi cerat, ujung bersaringan
    var faucet = new THREE.Group(), drops = [], fz = R + 0.04;
    var chrome = function () { return M(0xdfe5ea, { metalness: 1, roughness: 0.14, envMapIntensity: 1.8 }); };
    var fpts = [[1.1, 9], [1.1, 5.3], [1.08, 4.97], [0.95, 4.78], [0.7, 4.71], [0.3, 4.71], [0.08, 4.71]].map(function (q) { return new V3(q[0], q[1], fz); });
    faucet.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fpts), 48, 0.12, 14, false), chrome(), 0, 0, 0));
    faucet.add(mesh(lathe([[0.001, 4.3], [0.13, 4.3], [0.145, 4.33], [0.145, 4.74], [0.001, 4.74]], 24), chrome(), 0, 0, fz));
    faucet.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 20), chrome(), 1.1, 5.6, fz)); // kerah pipa
    var lever = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), chrome(), 1.35, 6.0, fz); lever.rotation.z = PI / 2 - 0.15; faucet.add(lever); // tuas
    faucet.add(mesh(new THREE.SphereGeometry(0.075, 12, 8), MP(0x2a6fbd, { roughness: 0.3, clearcoat: 0.8 }), 1.6, 5.93, fz));
    for (i = 0; i < 8; i++) {
      var dr = mesh(new THREE.SphereGeometry(0.05, 12, 8), MP(0x8ccdf0, { transparent: true, opacity: 0.75, roughness: 0.02, clearcoat: 1, envMapIntensity: 2 }), ((i * 0.37) % 1 - 0.5) * 0.5, 3, fz);
      dr.scale.y = 1.7; faucet.add(dr); drops.push(dr);
    }
    faucet.visible = false; scene.add(faucet);

    /* ---- benda di meja: bahan dan alat ---- */
    function alu() { return M(0xe3e7ea, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5, side: THREE.DoubleSide }); }
    function steelMat() { return M(0xcfd3d6, { metalness: 0.9, roughness: 0.28, envMapIntensity: 1.6, side: THREE.DoubleSide }); }
    function roundedBase(w, d, h, r) { // kotak bersudut membulat; alas di y = 0
      var s = new THREE.Shape(), x = w / 2, z = d / 2;
      s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
      s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
      var g = new THREE.ExtrudeGeometry(s, { depth: h - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 });
      g.rotateX(-PI / 2); return g;
    }
    function weaveCanvas(base, c1, c2) { // kain lakban: anyaman halus
      return ccv(256, 128, function (c, w, h) {
        var i; c.fillStyle = base; c.fillRect(0, 0, w, h);
        for (i = 0; i < h; i += 3) { c.fillStyle = c1; c.fillRect(0, i, w, 1); }
        for (i = 0; i < w; i += 3) { c.fillStyle = c2; c.fillRect(i, 0, 1, h); }
      });
    }
    function tapeRoll(ro, ri, h, wallCv, col) { // gulungan lakban berbaring: dinding berlapis, sisi bergaris melingkar, inti karton, ujung terkelupas
      var g = new THREE.Group(), rc = ccv(256, 256, function (c) {
        var i, r; c.fillStyle = col; c.fillRect(0, 0, 256, 256);
        for (i = 0; i < 62; i++) { r = ri / ro * 128 + i * (128 - ri / ro * 128) / 62; c.strokeStyle = "rgba(20,10,40," + (i % 2 ? 0.35 : 0.14) + ")"; c.lineWidth = 1; c.beginPath(); c.arc(128, 128, r, 0, PI * 2); c.stroke(); }
      });
      g.add(mesh(new THREE.CylinderGeometry(ro, ro, h, 56, 1, true), M(0xffffff, { map: tex(wallCv, 6, 1), roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.4 }), 0, h / 2, 0));
      [h, 0.0].forEach(function (y, k) { var e = mesh(new THREE.RingGeometry(ri, ro, 56, 1), M(0xffffff, { map: tex(rc), roughness: 0.65, side: THREE.DoubleSide }), 0, y, 0); e.rotation.x = k ? PI / 2 : -PI / 2; g.add(e); });
      g.add(mesh(new THREE.CylinderGeometry(ri, ri, h, 40, 1, true), M(0xb99562, { roughness: 0.9, side: THREE.DoubleSide }), 0, h / 2, 0));
      g.add(mesh(ribbonGeo(0.24, h, 0.9, 2), M(0xffffff, { map: tex(wallCv, 1, 1), roughness: 0.55, side: THREE.DoubleSide }), 0.12, h / 2, ro));
      return g;
    }
    function glueBottle(rad, bh, nh) { // botol lem putih berlabel, tutup ujung oranye
      var g = new THREE.Group();
      g.add(mesh(lathe([[0.001, 0.0], [rad * 0.85, 0.0], [rad, rad * 0.18], [rad, bh * 0.8], [rad * 0.9, bh * 0.92], [rad * 0.5, bh * 0.99], [rad * 0.42, bh], [0.001, bh]], 32), MP(0xf4f4f0, { roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.7 }), 0, 0, 0));
      var lc = ccv(512, 192, function (c, w, h) {
        c.fillStyle = "#f4f4f0"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#1e66c8"; c.fillRect(0, h * 0.58, w, h * 0.3);
        c.fillStyle = "#f2c230"; c.fillRect(0, h * 0.55, w, h * 0.03);
        c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#1e66c8"; c.font = "900 " + Math.round(h * 0.4) + "px Arial, sans-serif"; c.fillText("LEM", w / 2, h * 0.3);
        c.fillStyle = "#ffffff"; c.font = "700 " + Math.round(h * 0.13) + "px Arial, sans-serif"; c.fillText("KERTAS & KRIYA", w / 2, h * 0.73);
      });
      var lb = mesh(new THREE.CylinderGeometry(rad * 1.006, rad * 1.006, bh * 0.62, 36, 1, true), M(0xffffff, { map: tex(lc), roughness: 0.5 }), 0, bh * 0.45, 0); lb.rotation.y = PI; g.add(lb);
      g.add(mesh(lathe([[0.001, bh], [rad * 0.52, bh], [rad * 0.52, bh + 0.05], [rad * 0.36, bh + nh * 0.35], [rad * 0.14, bh + nh * 0.9], [rad * 0.1, bh + nh], [0.001, bh + nh]], 28), MP(0xe9801b, { roughness: 0.45, clearcoat: 0.3 }), 0, 0, 0));
      return g;
    }
    function soilTray(g) { // nampan baja berisi gundukan tanah lembap, gumpalan, kerikil, remah
      g.add(mesh(lathe([[0.001, 0.0], [0.52, 0.0], [0.57, 0.02], [0.62, 0.12], [0.61, 0.125], [0.56, 0.05], [0.001, 0.045]], 56), M(0x9aa0a6, { metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 1.2 }), 0, 0, 0));
      var mg = new THREE.SphereGeometry(1, 36, 18, 0, PI * 2, 0, PI / 2), p = mg.attributes.position, i, x, y, z, k;
      function kk(dx, dy, dz) { return 1 + (fbm(dx * 3.2 + 2, dy * 3.2, dz * 3.2) - 0.5) * 0.4; }
      for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = kk(x, y, z); p.setXYZ(i, x * 0.5 * k, y * 0.4 * k, z * 0.5 * k); }
      mg.computeVertexNormals();
      g.add(mesh(mg, soilMat(2, 1), 0, 0.05, 0));
      var r = rng(83), n, yy, aa, rxz, c;
      for (n = 0; n < 34; n++) {
        yy = 0.15 + r() * 0.85; aa = r() * PI * 2; rxz = Math.sqrt(1 - yy * yy);
        x = rxz * Math.cos(aa); z = rxz * Math.sin(aa); k = kk(x, yy, z);
        c = blob(0.03 + r() * 0.05, 1, 0.7, 1, r() * 9, CLODCOL[n % 4], { roughness: 1 });
        c.position.set(x * 0.5 * k, yy * 0.4 * k + 0.06, z * 0.5 * k); c.rotation.y = r() * 6; g.add(c);
      }
      for (n = 0; n < 5; n++) { aa = n * 1.3 + 0.4; c = blob(0.025, 1, 0.7, 1, n, 0x8d9094, { roughness: 0.6 }); c.position.set(Math.cos(aa) * 0.3, 0.22 + 0.1 * (n % 2), Math.sin(aa) * 0.3); g.add(c); }
      for (n = 0; n < 14; n++) { aa = r() * PI * 2; c = blob(0.02 + r() * 0.025, 1, 0.5, 1, r() * 9, CLODCOL[n % 4], { roughness: 1 }); c.position.set(Math.cos(aa) * (0.54 + r() * 0.04), 0.055, Math.sin(aa) * (0.54 + r() * 0.04)); g.add(c); }
    }

    var MODEL = {
      botol: function (g) { // botol air kemasan bening dengan tutup biru: bentuk yang sama dengan botol besar, dikecilkan
        var b = new THREE.Group(), pp = petOuter(), full = pp.low.concat(pp.up.slice(1).map(function (q) { return [q[0], q[1] + CUT]; }));
        b.add(glassMesh(petShell(full), 0xdff2f8, 0.2, 2.0));
        var cp = makeCap(0x1e66c8); cp.scale.setScalar(0.78); cp.position.y = CUT + 1.0; b.add(cp);
        b.scale.setScalar(0.4); g.add(b);
      },
      cutter: function (g) { // pemotong snap-off: badan kuning, karet hitam beralur, tombol geser, bilah baja bersegmen
        var ys = new THREE.Shape();
        ys.moveTo(-0.5, 0.0); ys.lineTo(0.42, 0.0); ys.lineTo(0.5, 0.05); ys.lineTo(0.5, 0.12); ys.lineTo(0.38, 0.16); ys.lineTo(-0.42, 0.16); ys.quadraticCurveTo(-0.5, 0.16, -0.5, 0.1); ys.lineTo(-0.5, 0.0);
        var bg = new THREE.ExtrudeGeometry(ys, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 });
        g.add(mesh(bg, MP(0xf0c23a, { roughness: 0.45, clearcoat: 0.3, envMapIntensity: 0.6 }), 0, 0.03, -0.11));
        var k, rub = function () { return M(0x1b1b1b, { roughness: 0.8 }); };
        g.add(mesh(new THREE.BoxGeometry(0.5, 0.02, 0.2), rub(), -0.22, 0.2, 0));
        for (k = 0; k < 9; k++) g.add(mesh(new THREE.BoxGeometry(0.02, 0.016, 0.2), rub(), -0.43 + k * 0.055, 0.214, 0)); // alur karet
        g.add(mesh(new THREE.BoxGeometry(0.15, 0.045, 0.1), M(0x2b2b2b, { roughness: 0.5 }), 0.05, 0.205, 0)); // tombol geser
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), steelMat(), -0.4, 0.2, 0));
        var bs = new THREE.Shape();
        [[0.42, -0.1], [0.82, -0.1], [0.97, 0.1], [0.42, 0.1]].forEach(function (q, n) { if (n) bs.lineTo(q[0], q[1]); else bs.moveTo(q[0], q[1]); });
        bs.closePath();
        var blg = new THREE.ExtrudeGeometry(bs, { depth: 0.012, bevelEnabled: false });
        blg.rotateX(-PI / 2);
        g.add(mesh(blg, steelMat(), 0, 0.094, 0));
        [0.56, 0.68, 0.8].forEach(function (x) { var ln = mesh(new THREE.BoxGeometry(0.006, 0.014, 0.2), M(0x44484c, { roughness: 0.5 }), x, 0.1, 0); ln.rotation.y = 0.55; g.add(ln); }); // garis patah bilah
      },
      cat: function (g) { // kaleng cat: badan baja bermanik, label cat, tutup bercincin, tetesan cat kering, gagang kawat
        g.add(mesh(lathe([[0.001, 0.0], [0.34, 0.0], [0.37, 0.012], [0.38, 0.04], [0.38, 0.1], [0.39, 0.12], [0.38, 0.14], [0.38, 0.4], [0.39, 0.42], [0.38, 0.44], [0.38, 0.5], [0.392, 0.522], [0.4, 0.545], [0.392, 0.565], [0.37, 0.57], [0.001, 0.57]], 48), M(0xb7bcc1, { metalness: 0.8, roughness: 0.4, envMapIntensity: 1.3 }), 0, 0, 0));
        var lc = ccv(1024, 220, function (c, w, h) {
          c.fillStyle = "#e0ae00"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#c23b2e"; c.fillRect(0, h * 0.7, w, h * 0.3);
          c.fillStyle = "#ffffff"; c.beginPath(); c.arc(w / 2, h * 0.42, h * 0.3, 0, PI * 2); c.fill();
          c.fillStyle = "#e0ae00"; c.beginPath(); c.arc(w / 2, h * 0.42, h * 0.22, 0, PI * 2); c.fill();
          c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#3a2a00"; c.font = "900 " + Math.round(h * 0.3) + "px Arial, sans-serif"; c.fillText("CAT", w / 2, h * 0.43);
          c.fillStyle = "#fff"; c.font = "800 " + Math.round(h * 0.15) + "px Arial, sans-serif"; c.fillText("KUNING CERAH  1 L", w / 2, h * 0.85);
        });
        var lb = mesh(new THREE.CylinderGeometry(0.384, 0.384, 0.27, 48, 1, true), MP(0xffffff, { map: tex(lc), roughness: 0.5, clearcoat: 0.3 }), 0, 0.27, 0); lb.rotation.y = PI; g.add(lb);
        var lr = mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 48), M(0xb7bcc1, { metalness: 0.8, roughness: 0.4 }), 0, 0.57, 0); lr.rotation.x = PI / 2; g.add(lr); // cincin pada tutup
        var ps = blob(0.16, 1, 0.1, 1, 3.1, 0xe0ae00, { roughness: 0.2, metalness: 0.05 }); ps.position.set(0.05, 0.575, 0.04); g.add(ps); // cat tumpah di tutup
        [[0.3, 0.14], [1.7, 0.2], [3.4, 0.11], [5.0, 0.17]].forEach(function (a, n) { // tetesan di sisi badan
          var dd = blob(0.026, 1, 1, 1, n * 2.2, 0xe0ae00, { roughness: 0.2, metalness: 0.05 });
          dd.scale.set(1, a[1] / 0.052, 0.7); dd.position.set(Math.sin(a[0]) * 0.395, 0.56 - a[1] * 0.5, Math.cos(a[0]) * 0.395); dd.rotation.y = a[0]; g.add(dd);
        });
        var hp = [], k; for (k = 0; k <= 16; k++) hp.push(new V3(Math.cos(k / 16 * PI) * 0.385, Math.sin(k / 16 * PI) * 0.385, 0));
        var hd = new THREE.Group(); hd.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hp), 32, 0.012, 6, false), steelMat(), 0, 0, 0));
        hd.position.set(0, 0.5, 0); hd.rotation.x = -1.2; g.add(hd); // gagang kawat terkulai ke belakang
      },
      brush: function (g) { // kuas pipih: gagang kayu mengilap, selubung logam berlipit, bulu bertekstur dengan ujung bercat merah
        var hp = [[0.001, 0.0], [0.03, 0.0], [0.04, 0.05], [0.05, 0.3], [0.045, 0.6], [0.036, 0.8], [0.03, 0.9]];
        var h = mesh(lathe(hp, 20), MP(0x8a5a2b, { roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }), -0.45, 0.06, 0); h.rotation.z = -PI / 2; g.add(h);
        var fp = [[0.03, 0.0], [0.05, 0.0], [0.052, 0.04], [0.06, 0.05], [0.07, 0.12], [0.078, 0.14], [0.085, 0.22], [0.09, 0.3]];
        var f = mesh(lathe(fp, 20), M(0xd0d4d8, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5, side: THREE.DoubleSide }), 0.35, 0.06, 0); f.rotation.z = -PI / 2; g.add(f);
        var bc = ccv(128, 64, function (c, w, hh) { var r5 = rng(5), i, x; c.fillStyle = "#d9c9a0"; c.fillRect(0, 0, w, hh); for (i = 0; i < 80; i++) { x = r5() * hh; c.fillStyle = r5() < 0.5 ? "rgba(255,248,225,0.5)" : "rgba(120,95,50,0.4)"; c.fillRect(0, x, w, 1 + r5() * 1.5); } });
        var bg = new THREE.BoxGeometry(0.24, 0.17, 0.07, 6, 4, 1), bp = bg.attributes.position, i, t;
        for (i = 0; i < bp.count; i++) { t = bp.getX(i) / 0.24 + 0.5; bp.setZ(i, bp.getZ(i) * (1 - 0.3 * t) * (1 + (fbm(i * 0.7, t * 3, 1) - 0.5) * 0.15)); bp.setX(i, bp.getX(i) + (t > 0.9 ? (fbm(i * 1.3, 2, 5) - 0.5) * 0.03 : 0)); }
        bg.computeVertexNormals();
        g.add(mesh(bg, M(0xffffff, { map: tex(bc), roughness: 0.9 }), 0.74, 0.06, 0));
        var tip = mesh(new THREE.BoxGeometry(0.06, 0.172, 0.052), MP(0xc23b2e, { roughness: 0.3, clearcoat: 0.8 }), 0.835, 0.06, 0); g.add(tip); // ujung bulu berlumur cat
      },
      tanah: function (g) { soilTray(g); sprout(g, 0.12, 0.42, 0.05, 0.9); },
      soil: function (g) { soilTray(g); },
      seed: function (g) { // pot tanah liat kecil berisi tanah dan bibit
        g.add(mesh(lathe([[0.001, 0.0], [0.2, 0.0], [0.26, 0.02], [0.3, 0.2], [0.34, 0.34], [0.36, 0.345], [0.365, 0.4], [0.35, 0.41], [0.325, 0.4], [0.31, 0.37]], 40), MP(0xc8772b, { roughness: 0.85, side: THREE.DoubleSide, envMapIntensity: 0.3 }), 0, 0, 0));
        var rg = new THREE.RingGeometry(0.001, 0.31, 32, 6), p = rg.attributes.position, k;
        for (k = 0; k < p.count; k++) p.setZ(k, (fbm(p.getX(k) * 6 + 1, p.getY(k) * 6, 3) - 0.5) * 0.04);
        rg.computeVertexNormals(); rg.rotateX(-PI / 2);
        g.add(mesh(rg, soilMat(1.2, 1.2), 0, 0.375, 0));
        sprout(g, 0, 0.38, 0, 0.9);
      },
      blender: function (g) { // blender: dasar hitam mengilap dengan kenop dan tombol, jar bening berskala, bilah baja, tutup, air
        var dark = function () { return MP(0x2b3036, { roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.8 }); };
        g.add(mesh(roundedBase(0.8, 0.8, 0.4, 0.14), dark(), 0, 0, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 36), M(0xcfd3d6, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5 }), 0, 0.41, 0));
        var kn = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), M(0xcfd3d6, { metalness: 0.9, roughness: 0.3 }), 0, 0.2, 0.42); kn.rotation.x = PI / 2; g.add(kn);
        [-0.22, 0.22].forEach(function (x, k) { var bt = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 14), MP(k ? 0xc23b2e : 0x3f9b4a, { roughness: 0.4, clearcoat: 0.6 }), x, 0.2, 0.41); bt.rotation.x = PI / 2; g.add(bt); });
        var jo = [[0.001, 0.43], [0.22, 0.43], [0.27, 0.45], [0.285, 0.5], [0.36, 1.3], [0.375, 1.32], [0.375, 1.34]];
        g.add(glassMesh(lathe(jo.concat(offsetProfile(jo, 0.012).reverse()), 40), 0xdcecf5, 0.2, 1.6, 0.08));
        g.add(mesh(lathe([[0.001, 0.44], [0.265, 0.44], [0.285, 0.5], [0.305, 0.72], [0.001, 0.72]], 36), MP(0x7ec8e8, { transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false }), 0, 0, 0));
        var pts = [new V3(0.35, 1.15, 0), new V3(0.52, 1.1, 0), new V3(0.58, 0.85, 0), new V3(0.5, 0.62, 0), new V3(0.31, 0.58, 0)];
        g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 8, false), dark(), 0, 0, 0));
        [0, PI / 2].forEach(function (a) { var bl = mesh(new THREE.BoxGeometry(0.24, 0.008, 0.05), steelMat(), 0, 0.47, 0); bl.rotation.y = a; bl.rotation.z = 0.15; g.add(bl); });
        g.add(mesh(new THREE.CylinderGeometry(0.376, 0.376, 0.06, 36), dark(), 0, 1.35, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), MP(0x4a5058, { roughness: 0.4 }), 0, 1.4, 0));
      },
      lem: function (g) { // botol lem putih dan lakban kain ungu
        var b = glueBottle(0.14, 0.6, 0.22); b.position.x = -0.28; g.add(b);
        var tr = tapeRoll(0.38, 0.17, 0.2, weaveCanvas("#6a4cc2", "rgba(40,20,90,0.25)", "rgba(190,170,240,0.2)"), "#6a4cc2"); tr.position.x = 0.36; tr.position.z = 0.05; g.add(tr);
      },
      kaleng: function (g) { // kaleng minuman utuh: dasar cekung, leher menyempit, tutup dengan cincin tarik yang sudah dibuka
        var o = [[0.001, 0.05], [0.12, 0.045], [0.2, 0.02], [0.22, 0.0], [0.27, 0.0], [0.3, 0.03], [0.33, 0.1], [0.335, 0.14], [0.335, 0.62], [0.33, 0.7], [0.3, 0.77], [0.285, 0.8], [0.3, 0.81], [0.3, 0.855], [0.285, 0.865], [0.255, 0.835], [0.001, 0.835]];
        g.add(mesh(lathe(o, 48), alu(), 0, 0, 0));
        var sl = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.56, 48, 1, true), MP(0xffffff, { map: tex(sodaLabel(1024, 270)), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.8 }), 0, 0.4, 0);
        sl.rotation.y = PI; g.add(sl);
        var op = mesh(new THREE.CircleGeometry(0.1, 24), M(0x1d1f22, { roughness: 0.6 }), 0.1, 0.838, 0); op.scale.set(1.3, 1, 1); op.rotation.x = -PI / 2; g.add(op);
        var ts = new THREE.Shape(); ts.moveTo(-0.1, -0.045); ts.lineTo(0.1, -0.045); ts.quadraticCurveTo(0.14, 0, 0.1, 0.045); ts.lineTo(-0.1, 0.045); ts.quadraticCurveTo(-0.13, 0, -0.1, -0.045);
        var th2 = new THREE.Path(); th2.absellipse(-0.045, 0, 0.04, 0.022, 0, PI * 2, true, 0); ts.holes.push(th2);
        var tgm = new THREE.ExtrudeGeometry(ts, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 });
        tgm.rotateX(-PI / 2);
        var tb = mesh(tgm, alu(), -0.03, 0.85, 0); tb.rotation.z = 0.15; g.add(tb);
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), alu(), 0.04, 0.845, 0));
      }
    };
    var CONTACT = { botol: [0.3, 0.3, 0], cutter: [0.62, 0.22, 0.12], cat: [0.46, 0.46, 0], tanah: [0.66, 0.66, 0], blender: [0.55, 0.55, 0], lem: [0.78, 0.44, 0.04], kaleng: [0.4, 0.4, 0] };
    function buildObj(key, hitR, hitY, contact) {
      var g = new THREE.Group(); MODEL[key](g);
      if (contact && CONTACT[key]) g.add(contactShadow(CONTACT[key][0], CONTACT[key][1], CONTACT[key][2]));
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noRecv; } });
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
      var g = buildObj(m.k, 0.8, 0.45, true);
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
    sun.shadow.mapSize.set(2048, 2048);
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

    /* ---- lingkungan pantulan: kotak cahaya studio kecil, supaya kaca, logam, dan plastik punya kilap yang nyata ---- */
    var envOK = false;
    try {
      if (renderer.capabilities.isWebGL2 && THREE.PMREMGenerator) {
        var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
        var dm = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
        var dp = dm.geometry.attributes.position, dc = [], ei, et;
        for (ei = 0; ei < dp.count; ei++) {
          et = dp.getY(ei) / 20;
          if (et > 0) dc.push(0.5 + 0.4 * et, 0.56 + 0.38 * et, 0.58 + 0.4 * et);
          else dc.push(0.28 + 0.22 * (1 + et), 0.31 + 0.24 * (1 + et), 0.3 + 0.22 * (1 + et));
        }
        dm.geometry.setAttribute("color", new THREE.Float32BufferAttribute(dc, 3));
        es.add(dm);
        [[12, 8, 0, 14, 2, 5], [3, 10, -14, 5, 3, 6], [3, 9, 12, 4, 8, 4.5], [8, 3, 2, 3, -15, 2.5]].forEach(function (a) {
          var sb = new THREE.Mesh(new THREE.PlaneGeometry(a[0], a[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(a[5], a[5], a[5] * 0.97), side: THREE.DoubleSide }));
          sb.position.set(a[2], a[3], a[4]); sb.lookAt(0, 0, 0); es.add(sb);
        });
        scene.environment = pm.fromScene(es, 0.03).texture;
        envOK = true;
        pm.dispose();
      }
    } catch (e) { envOK = false; }
    floorMat.envMapIntensity = 0; // lantai tetap memakai warna tema, tidak ikut terpantul

    /* ---- alat bantu ---- */
    function M(color, o) {
      var p = Object.assign({ color: color, roughness: 0.7, metalness: 0, envMapIntensity: 0.35 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6; // tanpa peta pantulan, logam penuh akan tampil gelap
      return new THREE.MeshStandardMaterial(p);
    }
    function MP(color, o) { // plastik atau cat berlapis bening (kilap basah, plastik mengilap)
      var p = Object.assign({ color: color, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6;
      return new THREE.MeshPhysicalMaterial(p);
    }
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

    /* ---- derau dan bilangan acak berbenih: bentuk kusut selalu sama tiap dimuat ---- */
    function rng(seed) {
      var s = seed >>> 0;
      return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function hash3(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
    function vnoise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      function l(a, b, t) { return a + (b - a) * t; }
      return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 2.1 + 9.1) * 0.3 + vnoise(x * 4.3 + 2.7, y * 4.3 + 8.1, z * 4.3 + 3.3) * 0.15; }

    /* ---- tekstur prosedural (kanvas) dan bentuk putar ---- */
    var ANI = 4; try { ANI = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) { }
    function ccv(w, h, draw) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); return cv; }
    function tex(cv, rx, ry) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = ANI; return t; }
    function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48); }
    function offsetProfile(pts, t) { // profil bergeser ke dalam sejauh t: dinding botol yang punya ketebalan
      return pts.map(function (p, i) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [Math.max(0.002, p[0] - dy / l * t), p[1] + dx / l * t];
      });
    }
    /* bayangan kontak lembut di bawah benda: pelengkap bayangan matahari */
    var csCv = null;
    function contactShadow(rx, rz, ox) {
      if (!csCv) csCv = ccv(64, 64, function (c) {
        var gr = c.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(0.5, "rgba(0,0,0,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      });
      var t = tex(csCv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -PI / 2; m.scale.set(rx * 2, rz * 2, 1); m.position.set(ox || 0, 0.006, 0); m.renderOrder = -1;
      m.raycast = function () { }; m.userData.noCast = true; m.userData.noRecv = true; return m;
    }


    /* plastik bening atau kebiruan: lapisan warna tipis ditambah lapisan pantulan (hanya kilap) */
    function glassMesh(geo, tint, opacity, reflI, rough) {
      var g = new THREE.Group(), r = rough === undefined ? 0.06 : rough;
      var a = new THREE.Mesh(geo, MP(tint, { roughness: r, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 }));
      var b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: r, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: reflI }));
      a.renderOrder = 1; b.renderOrder = 2;
      a.userData.noCast = a.userData.noRecv = b.userData.noCast = b.userData.noRecv = true;
      g.add(a); g.add(b); return g;
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

    /* ================= bahan visual: gumpalan, pita, tekstur label dan kertas, pensil, botol lem ================= */
    function blob(rad, sx, sy, sz, seed, color, o) { // gumpalan tak beraturan: noda lengket, remah, simpul
      var g = new THREE.SphereGeometry(rad, 16, 12), p = g.attributes.position, i, x, y, z, k;
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = 1 + (fbm(x / rad * 1.6 + seed, y / rad * 1.6, z / rad * 1.6) - 0.5) * 0.7;
        p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
      }
      g.computeVertexNormals();
      return mesh(g, M(color, Object.assign({ roughness: 0.95 }, o || {})), 0, 0, 0);
    }
    function ribbonGeo(len, wd, bend, seed) { // lembar melengkung: ujung pita lakban dan ujung kertas
      var g = new THREE.PlaneGeometry(len, wd, 14, 2), p = g.attributes.position, i, x, y, th, tw, rho = len / (2 * bend);
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); th = x / (len / 2) * bend; tw = th * 0.5 + (fbm(x * 3 + seed, 1, seed) - 0.5) * 0.6;
        p.setXYZ(i, rho * Math.sin(th), y * Math.cos(tw), rho * (1 - Math.cos(th)) + y * Math.sin(tw));
      }
      g.computeVertexNormals(); return g;
    }
    function sodaLabel(w, h) { // label kaleng: merah bergradasi, gelombang putih, gelembung, tulisan SODA di tengah
      return ccv(w, h, function (c) {
        var x, i, r1 = rng(29), gr = c.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, "#e0392c"); gr.addColorStop(0.5, "#cf2a22"); gr.addColorStop(1, "#a81d18"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(255,255,255,0.92)"; c.beginPath(); c.moveTo(0, h * 0.74);
        for (x = 0; x <= w; x += 8) c.lineTo(x, h * 0.74 + Math.sin(x / w * PI * 6) * h * 0.05);
        for (x = w; x >= 0; x -= 8) c.lineTo(x, h * 0.82 + Math.sin(x / w * PI * 6 + 0.6) * h * 0.05);
        c.closePath(); c.fill();
        c.strokeStyle = "rgba(255,255,255,0.3)"; c.lineWidth = 2;
        for (i = 0; i < 46; i++) { c.beginPath(); c.arc(r1() * w, r1() * h * 0.72, 3 + r1() * 9, 0, PI * 2); c.stroke(); }
        c.textAlign = "center"; c.textBaseline = "middle"; c.font = "900 " + Math.round(h * 0.4) + "px Arial, sans-serif";
        c.lineWidth = Math.round(h * 0.05); c.strokeStyle = "rgba(90,10,8,0.6)"; c.strokeText("SODA", w / 2, h * 0.4);
        c.fillStyle = "#ffffff"; c.fillText("SODA", w / 2, h * 0.4);
        c.font = "700 " + Math.round(h * 0.09) + "px Arial, sans-serif"; c.fillStyle = "rgba(255,255,255,0.9)"; c.fillText("330 ml", w / 2, h * 0.64);
      });
    }
    var PAPC = null, PAPB = null, SPIRC = null, CREPE = null, GLUEC = null;
    function paperCanvas() { // kertas bungkus bermotif: kuning emas, jalur jingga, bunga hijau; menyambung di sisi kiri dan kanan
      return PAPC || (PAPC = ccv(512, 256, function (c, w, h) {
        var r1 = rng(53), x, i, q, k;
        c.fillStyle = "#f3b73e"; c.fillRect(0, 0, w, h);
        for (x = 0; x < w; x += 128) { c.fillStyle = "#e5801a"; c.fillRect(x, 0, 22, h); c.fillStyle = "rgba(255,240,200,0.55)"; c.fillRect(x + 6, 0, 3, h); c.fillRect(x + 15, 0, 2, h); }
        for (q = 0; q < 3; q++) for (i = 0; i < 4; i++) {
          var cx = 64 + i * 128 + (q % 2) * 40, cy = 40 + q * 84;
          for (k = 0; k < 6; k++) { c.fillStyle = "#2e7d4f"; c.beginPath(); c.ellipse(cx + Math.cos(k * 1.047) * 14, cy + Math.sin(k * 1.047) * 14, 12, 6, k * 1.047, 0, PI * 2); c.fill(); }
          c.fillStyle = "#f7e08a"; c.beginPath(); c.arc(cx, cy, 7, 0, PI * 2); c.fill();
        }
        for (i = 0; i < 420; i++) { c.strokeStyle = r1() < 0.5 ? "rgba(255,250,230,0.14)" : "rgba(120,70,10,0.1)"; c.lineWidth = 1; var fx = r1() * w, fy = r1() * h; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + (r1() - 0.5) * 18, fy + (r1() - 0.5) * 18); c.stroke(); } // serat kertas
      }));
    }
    function paperBump() {
      return PAPB || (PAPB = ccv(256, 128, function (c, w, h) {
        var r1 = rng(54), i;
        c.fillStyle = "#808080"; c.fillRect(0, 0, w, h);
        for (i = 0; i < 700; i++) { var g = 90 + Math.round(r1() * 100); c.strokeStyle = "rgb(" + g + "," + g + "," + g + ")"; c.lineWidth = 1; var fx = r1() * w, fy = r1() * h; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + (r1() - 0.5) * 14, fy + (r1() - 0.5) * 14); c.stroke(); }
      }));
    }
    function spiralCanvas() { // ujung gulungan kertas: lapisan melingkar
      return SPIRC || (SPIRC = ccv(256, 256, function (c) {
        var i, r;
        c.fillStyle = "#efe6d0"; c.fillRect(0, 0, 256, 256);
        for (i = 0; i < 52; i++) { r = 27 + i * 2; c.strokeStyle = "rgba(120,100,70," + (i % 2 ? 0.45 : 0.2) + ")"; c.lineWidth = 1; c.beginPath(); c.arc(128 + Math.sin(i * 0.3) * 0.8, 128, r, 0, PI * 2); c.stroke(); }
        c.fillStyle = "#b99562"; c.beginPath(); c.arc(128, 128, 27, 0, PI * 2); c.fill();
      }));
    }
    function crepeCanvas() { // lakban kertas: krep halus
      return CREPE || (CREPE = ccv(256, 128, function (c, w, h) {
        var r1 = rng(37), i, y;
        c.fillStyle = "#e6cf93"; c.fillRect(0, 0, w, h);
        for (i = 0; i < 90; i++) { y = r1() * h; c.fillStyle = r1() < 0.5 ? "rgba(255,245,210,0.28)" : "rgba(150,110,50,0.18)"; c.fillRect(0, y, w, 1 + r1() * 2.2); }
        for (i = 0; i < 300; i++) { c.fillStyle = "rgba(120,90,40,0.07)"; c.fillRect(r1() * w, r1() * h, 2 + r1() * 5, 1); }
      }));
    }
    function glueCanvas() { // lem yang dioles: goresan kuas
      return GLUEC || (GLUEC = ccv(512, 256, function (c, w, h) {
        var r1 = rng(61), i, y, x;
        c.clearRect(0, 0, w, h);
        c.fillStyle = "rgba(255,248,224,0.7)"; c.fillRect(0, 0, w, h);
        for (i = 0; i < 120; i++) { y = r1() * h; x = r1() * w; c.strokeStyle = r1() < 0.5 ? "rgba(255,255,255,0.45)" : "rgba(255,236,190,0.35)"; c.lineWidth = 2 + r1() * 5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 40, y + (r1() - 0.5) * 12, x + 90 + r1() * 90, y + (r1() - 0.5) * 8); c.stroke(); }
      }));
    }

    /* pensil segi enam: bodi bercat mengilap, kayu runcing, ujung grafit, cincin logam dan penghapus di pangkal */
    function pencilModel(col, len, r) {
      var g = new THREE.Group(), er = r * 1.2, fr = r * 1.8, y0 = er + fr, hw = r * 5;
      var eraser = mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, er, 14), M(0xe8929a, { roughness: 0.85 }), 0, er / 2, 0); g.add(eraser);
      var fer = mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, fr, 14), M(0xd0d4d8, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.4 }), 0, er + fr / 2, 0); g.add(fer);
      var body = mesh(new THREE.CylinderGeometry(r, r, len - y0, 6), MP(col, { roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.8 }), 0, y0 + (len - y0) / 2, 0); body.rotation.y = PI / 6; g.add(body);
      var wood = mesh(new THREE.ConeGeometry(r, hw, 6), M(0xe8c48a, { roughness: 0.7 }), 0, len + hw / 2, 0); wood.rotation.y = PI / 6; g.add(wood);
      var tip = mesh(new THREE.ConeGeometry(r * 0.38, hw * 0.38, 10), M(0x3a3a3c, { roughness: 0.35, metalness: 0.3 }), 0, len + hw * 0.81, 0); g.add(tip);
      return g;
    }

    /* botol lem putih: badan mengilap berlabel, tutup ujung oranye; berdiri dengan dasar di y = 0 */
    function glueBottle(rad, bh, nh, drop) {
      var g = new THREE.Group();
      g.add(mesh(lathe([[0.001, 0.0], [rad * 0.85, 0.0], [rad, rad * 0.18], [rad, bh * 0.8], [rad * 0.9, bh * 0.92], [rad * 0.5, bh * 0.99], [rad * 0.42, bh], [0.001, bh]], 32), MP(0xf4f4f0, { roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.7 }), 0, 0, 0));
      var lc = ccv(512, 192, function (c, w, h) {
        c.fillStyle = "#f4f4f0"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#1e66c8"; c.fillRect(0, h * 0.58, w, h * 0.3);
        c.fillStyle = "#f2c230"; c.fillRect(0, h * 0.55, w, h * 0.03);
        c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#1e66c8"; c.font = "900 " + Math.round(h * 0.4) + "px Arial, sans-serif"; c.fillText("LEM", w / 2, h * 0.3);
        c.fillStyle = "#ffffff"; c.font = "700 " + Math.round(h * 0.13) + "px Arial, sans-serif"; c.fillText("KERTAS & KRIYA", w / 2, h * 0.73);
      });
      var lb = mesh(new THREE.CylinderGeometry(rad * 1.006, rad * 1.006, bh * 0.62, 36, 1, true), M(0xffffff, { map: tex(lc), roughness: 0.5 }), 0, bh * 0.45, 0); lb.rotation.y = PI; g.add(lb);
      g.add(mesh(lathe([[0.001, bh], [rad * 0.52, bh], [rad * 0.52, bh + 0.05], [rad * 0.36, bh + nh * 0.35], [rad * 0.14, bh + nh * 0.9], [rad * 0.1, bh + nh], [0.001, bh + nh]], 28), MP(0xe9801b, { roughness: 0.45, clearcoat: 0.3 }), 0, 0, 0));
      if (drop) { var dp2 = blob(0.04, 1, 1.3, 1, 3.3, 0xfdfaf0, { roughness: 0.15 }); dp2.position.set(0, bh + nh + 0.03, 0); g.add(dp2); }
      return g;
    }

    /* ---- ukuran dan bentuk kaleng ---- */
    var R = 0.85, H = 2.0, LIFT = 2.6, TAPE_Z = 1;
    function alu() { return M(0xe3e7ea, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5, side: THREE.DoubleSide }); }

    /* badan kaleng aluminium bekas: dasar cekung dengan cincin kaki, dinding sedikit penyok, tepi atas menggulung */
    var canG = null;
    function canGeo() {
      if (canG) return canG;
      var o = [[0.002, 0.16], [0.25, 0.15], [0.45, 0.11], [0.58, 0.05], [0.62, 0.0], [0.7, 0.0], [0.76, 0.02], [0.82, 0.1], [R - 0.005, 0.2], [R, 0.3]], y;
      for (y = 0.4; y < H - 0.06; y += 0.08) o.push([R, y]);
      o.push([R, H - 0.06], [R + 0.012, H - 0.035], [R + 0.02, H - 0.005], [R + 0.014, H + 0.02], [R - 0.004, H + 0.028]);
      var g = lathe(o.concat(offsetProfile(o, 0.014).reverse()), 72), p = g.attributes.position, i, x, yy, z, a, k;
      for (i = 0; i < p.count; i++) {
        yy = p.getY(i);
        if (yy > 0.3 && yy < H - 0.2) { x = p.getX(i); z = p.getZ(i); a = Math.atan2(z, x); k = 1 + (fbm(Math.cos(a) * 1.4, yy * 2.2, Math.sin(a) * 1.4) - 0.5) * 0.02; p.setX(i, x * k); p.setZ(i, z * k); }
      }
      g.computeVertexNormals(); canG = g; return g;
    }

    var can = new THREE.Group(); can.visible = false; scene.add(can);
    can.add(mesh(canGeo(), alu(), 0, 0, 0));
    can.add(contactShadow(1.1, 1.1, 0));
    can.traverse(function (o) { if (o.isMesh && !o.userData.noCast) o.castShadow = true; });
    var i;

    // noda kotor: bercak lengket kering yang dipipihkan menempel di dinding (skala dipakai untuk menghilangkannya)
    var specks = [], scol = [0x6a4a22, 0x7a5a2e, 0x4a3318];
    for (i = 0; i < 14; i++) {
      var th = ((i * 0.37) % 1) * 2.3 - 1.15, sy = 0.25 + ((i * 0.53) % 1) * 1.5;
      var sp = blob(0.07, 1, 1, 1, i * 1.7, scol[i % 3], { roughness: 0.3, metalness: 0.05 });
      sp.position.set(Math.sin(th) * (R + 0.015), sy, Math.cos(th) * (R + 0.015));
      sp.rotation.y = th; can.add(sp); specks.push(sp);
    }

    // label SODA: lengan plastik yang menempel di badan kaleng
    var label = new THREE.Group(); can.add(label);
    var sleeve = mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.012, 1.1, 64, 1, true), MP(0xffffff, { map: tex(sodaLabel(1280, 256)), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.8 }), 0, 1.0, 0);
    sleeve.rotation.y = PI; label.add(sleeve); // bagian tengah label menghadap kamera

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

    // lakban kertas di tepi: pita yang melipat menutupi bibir kaleng; lebar diatur lewat skala z
    var tg = lathe([[R + 0.035, -0.1], [R + 0.035, 0.03], [R + 0.022, 0.062], [R, 0.072], [R - 0.02, 0.062], [R - 0.03, 0.03], [R - 0.03, -0.1]], 72);
    tg.rotateX(-PI / 2);
    var tape = new THREE.Mesh(tg, MP(0xffffff, { map: tex(crepeCanvas(), 6, 1), bumpMap: tex(crepeCanvas(), 6, 1), bumpScale: 0.8, roughness: 0.6, clearcoat: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.4 }));
    tape.position.y = H - 0.02; tape.rotation.x = PI / 2; tape.scale.z = 0.001; tape.visible = false; tape.castShadow = true; can.add(tape);

    // lem: lapisan bening berkilap dengan goresan kuas, tetesan di tepi atas
    var glue = new THREE.Group(); glue.visible = false; glue.scale.y = 0.001; can.add(glue);
    var gg = new THREE.CylinderGeometry(R + 0.025, R + 0.025, H - 0.3, 48, 1, true); gg.translate(0, 0.08 + (H - 0.3) / 2, 0);
    glue.add(new THREE.Mesh(gg, MP(0xfff8e0, { map: tex(glueCanvas(), 2, 1), transparent: true, opacity: 0.85, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 })));
    for (i = 0; i < 7; i++) {
      var da = i * 0.9 + 0.3, dl = 0.18 + ((i * 0.37) % 1) * 0.22, dd = blob(0.035, 1, 1, 1, i * 2.1, 0xfdf8e8, { roughness: 0.12, transparent: true, opacity: 0.9 });
      dd.scale.set(1, dl / 0.07, 0.6); dd.position.set(Math.sin(da) * (R + 0.04), 0.08 + (H - 0.3) - dl * 0.5, Math.cos(da) * (R + 0.04)); dd.rotation.y = da; glue.add(dd);
    }

    // kertas pembungkus: dibuat bertahap supaya terlihat melingkar
    var PH = H - 0.2, PR = R + 0.05, wrapTex = tex(paperCanvas()), wrapBump = tex(paperBump());
    function wrapGeo(p) {
      var g = new THREE.CylinderGeometry(PR, PR, PH, 64, 1, true, 0, Math.max(0.001, p) * PI * 2);
      g.translate(0, 0.08 + PH / 2, 0); return g;
    }
    var paperMesh = new THREE.Mesh(wrapGeo(1), M(0xffffff, { map: wrapTex, bumpMap: wrapBump, bumpScale: 0.7, roughness: 0.75, envMapIntensity: 0.3, side: THREE.DoubleSide }));
    paperMesh.visible = false; paperMesh.castShadow = true; can.add(paperMesh);
    function setWrap(p) {
      var old = paperMesh.geometry; paperMesh.geometry = wrapGeo(p); old.dispose();
      wrapTex.repeat.x = Math.max(0.01, p) * 2; wrapBump.repeat.x = wrapTex.repeat.x;
    }

    // pensil di dalam kaleng
    var pencilsIn = new THREE.Group(); pencilsIn.visible = false; can.add(pencilsIn);
    function pencil(col) {
      var g = pencilModel(col, 2.4, 0.06);
      g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    [[-0.3, -0.15, 0.12, 0.05, 0xf2c230], [-0.05, 0.2, -0.05, 0.1, 0xd23a2f], [0.25, 0, -0.15, -0.08, 0x1e66c8], [0.12, -0.28, 0.05, -0.12, 0x3f9b4a], [-0.25, 0.2, 0.1, 0.14, 0xe0688a]].forEach(function (a) {
      var pg = pencil(a[4]); pg.position.set(a[0], 0.15, a[1]); pg.rotation.z = a[2]; pg.rotation.x = a[3]; pencilsIn.add(pg);
    });

    // badan kaleng yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = H + 0.3; can.add(hitBody);

    // keran air untuk bilas: pipa turun dari atas, melengkung menjadi cerat, ujung bersaringan
    var faucet = new THREE.Group(), drops = [], fz = R + 0.04;
    var chrome = function () { return M(0xdfe5ea, { metalness: 1, roughness: 0.14, envMapIntensity: 1.8 }); };
    var fpts = [[1.1, 9], [1.1, 5.5], [1.08, 5.12], [0.95, 4.92], [0.7, 4.85], [0.3, 4.85], [0.08, 4.85]].map(function (q) { return new V3(q[0], q[1], fz); });
    faucet.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(fpts), 48, 0.12, 14, false), chrome(), 0, 0, 0));
    faucet.add(mesh(lathe([[0.001, 4.5], [0.13, 4.5], [0.145, 4.53], [0.145, 4.88], [0.001, 4.88]], 24), chrome(), 0, 0, fz));
    faucet.add(mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.14, 20), chrome(), 1.1, 5.9, fz)); // kerah pipa
    var lever = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 10), chrome(), 1.35, 6.3, fz); lever.rotation.z = PI / 2 - 0.15; faucet.add(lever); // tuas
    faucet.add(mesh(new THREE.SphereGeometry(0.075, 12, 8), MP(0x2a6fbd, { roughness: 0.3, clearcoat: 0.8 }), 1.6, 6.23, fz));
    for (i = 0; i < 8; i++) {
      var dr = mesh(new THREE.SphereGeometry(0.05, 12, 8), MP(0x8ccdf0, { transparent: true, opacity: 0.75, roughness: 0.02, clearcoat: 1, envMapIntensity: 2 }), ((i * 0.37) % 1 - 0.5) * 0.5, 3, fz);
      dr.scale.y = 1.7; faucet.add(dr); drops.push(dr);
    }
    faucet.position.y = -0.9; // lebih rendah daripada di latihan botol karena kaleng lebih pendek
    faucet.visible = false; scene.add(faucet);

    /* ---- benda di meja: bahan dan alat ---- */
    function batteryLabel(c, w, h) { // baterai alkaline bekas: sleeve hijau, pita emas, goresan dan noda
      var r4 = rng(13), i, gr;
      gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1f7a34"); gr.addColorStop(0.5, "#2b8a3e"); gr.addColorStop(1, "#1a6a2c"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.fillStyle = "#17191b"; c.fillRect(0, h * 0.72, w, h * 0.28);
      c.fillStyle = "#e3b21a"; c.fillRect(0, h * 0.68, w, h * 0.04);
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillStyle = "#f2f2ee"; c.font = "800 30px Arial, sans-serif"; c.fillText("ALKALINE", w / 2, h * 0.2);
      c.font = "800 56px Arial, sans-serif"; c.fillText("1,5 V", w / 2, h * 0.42);
      c.fillStyle = "#e3b21a"; c.font = "800 26px Arial, sans-serif"; c.fillText("SIZE AA  LR6", w / 2, h * 0.6);
      c.fillStyle = "#cfd2d4"; c.font = "700 17px Arial, sans-serif"; c.fillText("JANGAN DIISI ULANG", w / 2, h * 0.8); c.fillText("BUANG KE TEMPAT B3", w / 2, h * 0.9);
      for (i = 0; i < 26; i++) { c.strokeStyle = "rgba(220,230,220," + (0.08 + r4() * 0.2).toFixed(2) + ")"; c.lineWidth = 0.8 + r4() * 1.4; var sx = r4() * w, sy = r4() * h; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (r4() - 0.5) * 70, sy + (r4() - 0.5) * 24); c.stroke(); }
      for (i = 0; i < 40; i++) { c.fillStyle = "rgba(120,72,32," + (0.06 + r4() * 0.14).toFixed(2) + ")"; c.beginPath(); c.arc(r4() * w, h * (0.7 + r4() * 0.3), 1.5 + r4() * 5, 0, PI * 2); c.fill(); }
      gr = c.createRadialGradient(w * 0.55, 0, 2, w * 0.55, 0, 90); gr.addColorStop(0, "rgba(190,140,50,0.7)"); gr.addColorStop(1, "rgba(190,140,50,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, 100);
    }
    function roundedBase(w, d, h, r) { // kotak bersudut membulat; alas di y = 0
      var s = new THREE.Shape(), x = w / 2, z = d / 2;
      s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
      s.lineTo(-x + r, z); s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
      var g = new THREE.ExtrudeGeometry(s, { depth: h - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 8 });
      g.rotateX(-PI / 2); return g;
    }

    var MODEL = {
      kaleng: function (g) { // kaleng minuman utuh: dasar cekung, leher menyempit, tutup dengan cincin tarik yang sudah dibuka
        var o = [[0.001, 0.05], [0.12, 0.045], [0.2, 0.02], [0.22, 0.0], [0.27, 0.0], [0.3, 0.03], [0.33, 0.1], [0.335, 0.14], [0.335, 0.62], [0.33, 0.7], [0.3, 0.77], [0.285, 0.8], [0.3, 0.81], [0.3, 0.855], [0.285, 0.865], [0.255, 0.835], [0.001, 0.835]];
        g.add(mesh(lathe(o, 48), alu(), 0, 0, 0));
        var sl = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.56, 48, 1, true), MP(0xffffff, { map: tex(sodaLabel(1024, 270)), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3, side: THREE.DoubleSide, envMapIntensity: 0.8 }), 0, 0.4, 0);
        sl.rotation.y = PI; g.add(sl);
        var op = mesh(new THREE.CircleGeometry(0.1, 24), M(0x1d1f22, { roughness: 0.6 }), 0.1, 0.838, 0); op.scale.set(1.3, 1, 1); op.rotation.x = -PI / 2; g.add(op); // lubang yang sudah dibuka
        var ts = new THREE.Shape(); ts.moveTo(-0.1, -0.045); ts.lineTo(0.1, -0.045); ts.quadraticCurveTo(0.14, 0, 0.1, 0.045); ts.lineTo(-0.1, 0.045); ts.quadraticCurveTo(-0.13, 0, -0.1, -0.045);
        var th2 = new THREE.Path(); th2.absellipse(-0.045, 0, 0.04, 0.022, 0, PI * 2, true, 0); ts.holes.push(th2);
        var tgm = new THREE.ExtrudeGeometry(ts, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: 12 });
        tgm.rotateX(-PI / 2);
        var tb = mesh(tgm, alu(), -0.03, 0.85, 0); tb.rotation.z = 0.15; g.add(tb); // cincin tarik terangkat sedikit
        g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), alu(), 0.04, 0.845, 0)); // paku keling
      },
      lakban: function (g) { // gulungan lakban kertas: tepi berlapis-lapis, inti karton, ujung pita terkelupas
        var rc = ccv(256, 256, function (c) {
          var i, r;
          c.fillStyle = "#e6cf93"; c.fillRect(0, 0, 256, 256);
          for (i = 0; i < 62; i++) { r = 50 + i * 1.28; c.strokeStyle = "rgba(130,100,50," + (i % 2 ? 0.4 : 0.18) + ")"; c.lineWidth = 1; c.beginPath(); c.arc(128, 128, r, 0, PI * 2); c.stroke(); }
        });
        var tm = function () { return M(0xffffff, { map: tex(crepeCanvas(), 6, 1), roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.4 }); };
        g.add(mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.26, 56, 1, true), tm(), 0, 0.13, 0));
        [0.26, 0.0].forEach(function (y, k) { var e = mesh(new THREE.RingGeometry(0.17, 0.43, 56, 1), M(0xffffff, { map: tex(rc), roughness: 0.65, side: THREE.DoubleSide }), 0, y, 0); e.rotation.x = k ? PI / 2 : -PI / 2; g.add(e); });
        g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 40, 1, true), M(0xb99562, { roughness: 0.9, side: THREE.DoubleSide }), 0, 0.13, 0)); // inti karton
        var tl = mesh(ribbonGeo(0.24, 0.26, 0.9, 2), M(0xe6cf93, { roughness: 0.55, side: THREE.DoubleSide }), 0, 0.13, 0.43); tl.position.x = 0.12; g.add(tl);
      },
      kertas: function (g) { // gulungan kertas bungkus berdiri: ujung berlapis, tabung inti, ujung lembar menjuntai, karet pengikat
        var pm2 = function (rx) { return M(0xffffff, { map: tex(paperCanvas(), rx, 1), bumpMap: tex(paperBump(), rx, 1), bumpScale: 0.7, roughness: 0.75, envMapIntensity: 0.3, side: THREE.DoubleSide }); };
        g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 40, 1, true), pm2(1.5), 0, 0.45, 0));
        [0.9, 0.0].forEach(function (y, k) { var e = mesh(new THREE.RingGeometry(0.06, 0.28, 40, 1), M(0xffffff, { map: tex(spiralCanvas()), roughness: 0.8, side: THREE.DoubleSide }), 0, y, 0); e.rotation.x = k ? PI / 2 : -PI / 2; g.add(e); });
        g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.92, 16, 1, true), M(0xb99562, { roughness: 0.9, side: THREE.DoubleSide }), 0, 0.45, 0));
        var tail = mesh(ribbonGeo(0.34, 0.8, 0.5, 3), pm2(0.7), 0.17, 0.45, 0.28); g.add(tail);
        var rb = mesh(new THREE.TorusGeometry(0.286, 0.012, 6, 40), M(0xc23b2e, { roughness: 0.6 }), 0, 0.62, 0); rb.rotation.x = PI / 2; g.add(rb);
      },
      lem: function (g) { g.add(glueBottle(0.17, 0.6, 0.24, false)); },
      lemtool: function (g) { // botol lem berbaring, ujung lancip ke kanan, setetes lem di ujung
        var b = glueBottle(0.15, 1.0, 0.3, true); b.rotation.z = -PI / 2; b.position.set(-0.5, 0.16, 0); g.add(b);
      },
      pensil: function (g) {
        [[-0.12, 0, 0.06, 0xf2c230], [0.02, 0.1, -0.05, 0xd23a2f], [0.14, -0.04, 0.1, 0x1e66c8], [-0.02, -0.12, -0.08, 0x3f9b4a]].forEach(function (a) {
          var p = pencilModel(a[3], 0.8, 0.045); p.position.set(a[0], 0, a[1]); p.rotation.z = a[2]; g.add(p);
        });
      },
      blender: function (g) { // blender: dasar hitam mengilap dengan kenop dan tombol, jar plastik bening berskala, bilah baja, tutup, air di dalam
        var dark = function () { return MP(0x2b3036, { roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.8 }); };
        g.add(mesh(roundedBase(0.8, 0.8, 0.4, 0.14), dark(), 0, 0, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 36), M(0xcfd3d6, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5 }), 0, 0.41, 0));
        var kn = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 20), M(0xcfd3d6, { metalness: 0.9, roughness: 0.3 }), 0, 0.2, 0.42); kn.rotation.x = PI / 2; g.add(kn);
        [-0.22, 0.22].forEach(function (x, k) { var bt = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 14), MP(k ? 0xc23b2e : 0x3f9b4a, { roughness: 0.4, clearcoat: 0.6 }), x, 0.2, 0.41); bt.rotation.x = PI / 2; g.add(bt); });
        var jo = [[0.001, 0.43], [0.22, 0.43], [0.27, 0.45], [0.285, 0.5], [0.36, 1.3], [0.375, 1.32], [0.375, 1.34]];
        g.add(glassMesh(lathe(jo.concat(offsetProfile(jo, 0.012).reverse()), 40), 0xdcecf5, 0.2, 1.6, 0.08));
        g.add(mesh(lathe([[0.001, 0.44], [0.265, 0.44], [0.285, 0.5], [0.305, 0.72], [0.001, 0.72]], 36), MP(0x7ec8e8, { transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.5, depthWrite: false }), 0, 0, 0)); // air
        var pts = [new V3(0.35, 1.15, 0), new V3(0.52, 1.1, 0), new V3(0.58, 0.85, 0), new V3(0.5, 0.62, 0), new V3(0.31, 0.58, 0)];
        g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.035, 8, false), dark(), 0, 0, 0)); // pegangan
        [0, PI / 2].forEach(function (a) { var bl = mesh(new THREE.BoxGeometry(0.24, 0.008, 0.05), M(0xcfd3d6, { metalness: 0.9, roughness: 0.25, envMapIntensity: 1.5 }), 0, 0.47, 0); bl.rotation.y = a; bl.rotation.z = 0.15; g.add(bl); });
        g.add(mesh(new THREE.CylinderGeometry(0.376, 0.376, 0.06, 36), dark(), 0, 1.35, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 24), MP(0x4a5058, { roughness: 0.4 }), 0, 1.4, 0));
      },
      baterai: function (g) { // baterai bekas: sleeve berlabel, kaleng baja, terminal, kerak putih bocoran
        var steel2 = function () { return M(0xb4b8bc, { metalness: 0.85, roughness: 0.38, envMapIntensity: 1.4 }); };
        g.add(mesh(lathe([[0.001, 0.004], [0.14, 0.004], [0.15, 0.0], [0.19, 0.0], [0.2, 0.012], [0.2, 0.05], [0.196, 0.054]], 40), steel2(), 0, 0, 0));
        var sl = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.69, 48, 1, true), M(0xffffff, { map: tex(ccv(512, 280, batteryLabel)), roughness: 0.42, metalness: 0.1, envMapIntensity: 0.6 }), 0, 0.395, 0);
        sl.rotation.y = PI; g.add(sl);
        g.add(mesh(lathe([[0.2, 0.736], [0.2, 0.752], [0.188, 0.764], [0.17, 0.768]], 40), steel2(), 0, 0, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 32), M(0xd8d6cc, { roughness: 0.6 }), 0, 0.774, 0));
        g.add(mesh(lathe([[0.001, 0.78], [0.07, 0.78], [0.078, 0.786], [0.078, 0.8], [0.072, 0.822], [0.05, 0.832], [0.001, 0.834]], 32), M(0xc9cdd0, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5 }), 0, 0, 0));
        var c1 = blob(0.11, 1, 0.3, 1, 2.2, 0xe9e7da); c1.position.set(0.03, 0.792, 0.02); g.add(c1);
        var c2 = blob(0.06, 1, 0.35, 1, 6.5, 0x9db8a4); c2.position.set(-0.06, 0.794, 0.07); g.add(c2);
      }
    };
    var CONTACT = { kaleng: [0.4, 0.4, 0], lakban: [0.52, 0.52, 0], kertas: [0.4, 0.4, 0], lem: [0.24, 0.24, 0], pensil: [0.34, 0.3, 0], blender: [0.55, 0.55, 0], baterai: [0.28, 0.28, 0] };
    function buildObj(key, hitR, hitY, contact) {
      var g = new THREE.Group(); MODEL[key](g);
      if (contact && CONTACT[key]) g.add(contactShadow(CONTACT[key][0], CONTACT[key][1], CONTACT[key][2]));
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noRecv; } });
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
      var g = buildObj(m.k, 0.8, 0.45, true);
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
    sun.shadow.mapSize.set(2048, 2048);
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

    /* ---- lingkungan pantulan: kotak cahaya studio kecil, supaya kaca, logam, dan plastik punya kilap yang nyata ---- */
    var envOK = false;
    try {
      if (renderer.capabilities.isWebGL2 && THREE.PMREMGenerator) {
        var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
        var dm = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
        var dp = dm.geometry.attributes.position, dc = [], ei, et;
        for (ei = 0; ei < dp.count; ei++) {
          et = dp.getY(ei) / 20;
          if (et > 0) dc.push(0.5 + 0.4 * et, 0.56 + 0.38 * et, 0.58 + 0.4 * et);
          else dc.push(0.28 + 0.22 * (1 + et), 0.31 + 0.24 * (1 + et), 0.3 + 0.22 * (1 + et));
        }
        dm.geometry.setAttribute("color", new THREE.Float32BufferAttribute(dc, 3));
        es.add(dm);
        [[12, 8, 0, 14, 2, 5], [3, 10, -14, 5, 3, 6], [3, 9, 12, 4, 8, 4.5], [8, 3, 2, 3, -15, 2.5]].forEach(function (a) {
          var sb = new THREE.Mesh(new THREE.PlaneGeometry(a[0], a[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(a[5], a[5], a[5] * 0.97), side: THREE.DoubleSide }));
          sb.position.set(a[2], a[3], a[4]); sb.lookAt(0, 0, 0); es.add(sb);
        });
        scene.environment = pm.fromScene(es, 0.03).texture;
        envOK = true;
        pm.dispose();
      }
    } catch (e) { envOK = false; }
    floorMat.envMapIntensity = 0; // lantai tetap memakai warna tema, tidak ikut terpantul

    /* ---- alat bantu ---- */
    function M(color, o) {
      var p = Object.assign({ color: color, roughness: 0.7, metalness: 0, envMapIntensity: 0.35 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6; // tanpa peta pantulan, logam penuh akan tampil gelap
      return new THREE.MeshStandardMaterial(p);
    }
    function MP(color, o) { // plastik atau cat berlapis bening (kilap basah, plastik mengilap)
      var p = Object.assign({ color: color, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6;
      return new THREE.MeshPhysicalMaterial(p);
    }
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

    /* ---- derau dan bilangan acak berbenih: bentuk kusut selalu sama tiap dimuat ---- */
    function rng(seed) {
      var s = seed >>> 0;
      return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function hash3(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
    function vnoise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      function l(a, b, t) { return a + (b - a) * t; }
      return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 2.1 + 9.1) * 0.3 + vnoise(x * 4.3 + 2.7, y * 4.3 + 8.1, z * 4.3 + 3.3) * 0.15; }

    /* ---- tekstur prosedural (kanvas) dan bentuk putar ---- */
    var ANI = 4; try { ANI = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) { }
    function ccv(w, h, draw) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); return cv; }
    function tex(cv, rx, ry) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = ANI; return t; }
    function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48); }
    function offsetProfile(pts, t) { // profil bergeser ke dalam sejauh t: dinding botol yang punya ketebalan
      return pts.map(function (p, i) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [Math.max(0.002, p[0] - dy / l * t), p[1] + dx / l * t];
      });
    }
    /* bayangan kontak lembut di bawah benda: pelengkap bayangan matahari */
    var csCv = null;
    function contactShadow(rx, rz, ox) {
      if (!csCv) csCv = ccv(64, 64, function (c) {
        var gr = c.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(0.5, "rgba(0,0,0,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      });
      var t = tex(csCv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -PI / 2; m.scale.set(rx * 2, rz * 2, 1); m.position.set(ox || 0, 0.006, 0); m.renderOrder = -1;
      m.raycast = function () { }; m.userData.noCast = true; m.userData.noRecv = true; return m;
    }


    /* plastik bening atau kebiruan: lapisan warna tipis ditambah lapisan pantulan (hanya kilap) */
    function glassMesh(geo, tint, opacity, reflI, rough) {
      var g = new THREE.Group(), r = rough === undefined ? 0.06 : rough;
      var a = new THREE.Mesh(geo, MP(tint, { roughness: r, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.6 }));
      var b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: r, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: reflI }));
      a.renderOrder = 1; b.renderOrder = 2;
      a.userData.noCast = a.userData.noRecv = b.userData.noCast = b.userData.noRecv = true;
      g.add(a); g.add(b); return g;
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

    /* ================= tekstur dan potongan untuk isi ember dan benda di meja ================= */
    /* peta warna dan relief dari serpihan acak (daun, potongan sayur) */
    function litterSet(seed, o) {
      var r1 = rng(seed), list = [], i, k;
      for (i = 0; i < o.count; i++) {
        var s = { x: r1() * 512, y: r1() * 512, a: r1() * PI, l: o.size[0] + r1() * (o.size[1] - o.size[0]), c: o.pal[Math.floor(r1() * o.pal.length)], v: 0.45 + r1() * 0.55, p: [] };
        s.w = s.l * o.slim * (0.7 + r1() * 0.6);
        for (k = 0; k < 6; k++) s.p.push([k / 6 * PI * 2 + (r1() - 0.5) * 0.7, 0.65 + r1() * 0.45]);
        list.push(s);
      }
      function drawAll(c, bump) {
        c.fillStyle = bump ? "#303030" : o.bg; c.fillRect(0, 0, 512, 512);
        list.forEach(function (s) {
          [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(function (d) { // salinan di tepi supaya tekstur menyambung
            var cx = s.x + d[0], cy = s.y + d[1];
            if (cx < -60 || cx > 572 || cy < -60 || cy > 572) return;
            c.save(); c.translate(cx, cy); c.rotate(s.a); c.beginPath();
            if (o.shape === "leaf") { c.moveTo(-s.l / 2, 0); c.quadraticCurveTo(0, -s.w, s.l / 2, 0); c.quadraticCurveTo(0, s.w, -s.l / 2, 0); }
            else s.p.forEach(function (q, j) { var px = Math.cos(q[0]) * s.l * q[1] * 0.5, py = Math.sin(q[0]) * s.w * q[1]; if (j) c.lineTo(px, py); else c.moveTo(px, py); });
            c.closePath();
            if (bump) { var gg = Math.round(255 * s.v); c.fillStyle = "rgb(" + gg + "," + gg + "," + gg + ")"; c.fill(); c.strokeStyle = "rgba(0,0,0,0.85)"; c.lineWidth = 2; c.stroke(); }
            else {
              c.fillStyle = s.c; c.fill();
              c.fillStyle = "rgba(255,255,255," + ((1 - s.v) * 0.35).toFixed(2) + ")"; c.fill();
              c.strokeStyle = "rgba(0,0,0,0.3)"; c.lineWidth = 1; c.stroke();
              if (o.shape === "leaf") { c.beginPath(); c.moveTo(-s.l / 2, 0); c.lineTo(s.l / 2, 0); c.strokeStyle = "rgba(60,36,12,0.55)"; c.stroke(); }
              if (o.gloss) { c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.arc(-s.l * 0.15, -s.w * 0.15, 1.8, 0, PI * 2); c.fill(); }
            }
            c.restore();
          });
        });
      }
      return { c: ccv(512, 512, function (c) { drawAll(c, false); }), b: ccv(512, 512, function (c) { drawAll(c, true); }) };
    }
    var LEAFSET = null, SCRAPSET = null, COMPSET = null, SOIL = null;
    function leafSet() { return LEAFSET || (LEAFSET = litterSet(5, { count: 260, size: [44, 80], slim: 0.42, shape: "leaf", bg: "#46301a", pal: ["#a9772f", "#c08a3b", "#8a5a22", "#d49a45", "#6e4a1f", "#b86a24", "#9a6a2a"] })); }
    function scrapSet() { return SCRAPSET || (SCRAPSET = litterSet(6, { count: 330, size: [22, 50], slim: 0.7, shape: "blob", gloss: true, bg: "#3a3a22", pal: ["#6aa23a", "#4f9e3c", "#8bbf4a", "#e9801b", "#c23b2e", "#f2c230", "#eadfc0", "#6d4a2a", "#7aa63c"] })); }
    function compostSet() { return COMPSET || (COMPSET = litterSet(7, { count: 1500, size: [9, 22], slim: 0.7, shape: "blob", bg: "#3a2814", pal: ["#4d3519", "#5a3d1c", "#3f2c14", "#6b4a22", "#2f2a14", "#4a5a2a", "#52381a"] })); }
    function soilSet() {
      if (SOIL) return SOIL;
      var r1 = rng(41);
      function dots(c, bump) {
        var i, x, y, rr, t, g;
        c.fillStyle = bump ? "#555555" : "#3b2713"; c.fillRect(0, 0, 512, 512);
        for (i = 0; i < 5200; i++) {
          x = r1() * 512; y = r1() * 512; rr = 0.8 + r1() * 3.2; t = r1();
          if (bump) { g = Math.round(60 + t * 190); c.fillStyle = "rgb(" + g + "," + g + "," + g + ")"; }
          else c.fillStyle = t < 0.55 ? "rgba(20,12,6," + (0.2 + r1() * 0.4).toFixed(2) + ")" : t < 0.93 ? "rgba(110,78,44," + (0.15 + r1() * 0.35).toFixed(2) + ")" : t < 0.975 ? "rgba(225,225,215,0.85)" : "rgba(150,170,90,0.6)";
          c.beginPath(); c.arc(x, y, rr, 0, PI * 2); c.fill();
        }
      }
      SOIL = { c: ccv(512, 512, function (c) { dots(c, false); }), b: ccv(512, 512, function (c) { dots(c, true); }) };
      return SOIL;
    }
    var BUR = null;
    function burlapCanvas() { // goni: anyaman benang bersilang
      return BUR || (BUR = ccv(256, 256, function (c, w, h) {
        var r1 = rng(23), i;
        c.fillStyle = "#c4a064"; c.fillRect(0, 0, w, h);
        for (i = 0; i < h; i += 4) { c.fillStyle = "rgba(" + (r1() < 0.5 ? "90,62,28" : "235,205,150") + "," + (0.18 + r1() * 0.25).toFixed(2) + ")"; c.fillRect(0, i, w, 2 + r1() * 1.5); }
        for (i = 0; i < w; i += 4) { c.fillStyle = "rgba(" + (r1() < 0.5 ? "90,62,28" : "235,205,150") + "," + (0.18 + r1() * 0.25).toFixed(2) + ")"; c.fillRect(i, 0, 2 + r1() * 1.5, h); }
        for (i = 0; i < 260; i++) { c.fillStyle = "rgba(70,46,20," + (0.1 + r1() * 0.2).toFixed(2) + ")"; c.fillRect(r1() * w, r1() * h, 3 + r1() * 8, 1.5); }
      }));
    }
    var LEAFC = null, LEAFT = null;
    function leafTex() { // siluet daun dengan tulang daun; warna daun datang dari warna material
      if (!LEAFT) {
        LEAFC = ccv(128, 192, function (c, w, h) {
          var i, gr;
          c.clearRect(0, 0, w, h);
          c.beginPath(); c.moveTo(w / 2, 4);
          c.bezierCurveTo(w * 0.98, h * 0.28, w * 0.92, h * 0.72, w / 2, h - 6);
          c.bezierCurveTo(w * 0.08, h * 0.72, w * 0.02, h * 0.28, w / 2, 4); c.closePath();
          gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#d9cdb0"); gr.addColorStop(0.5, "#f4ecd8"); gr.addColorStop(1, "#d3c6a6");
          c.fillStyle = gr; c.fill();
          c.strokeStyle = "rgba(90,70,40,0.6)"; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w / 2, h - 2); c.stroke();
          c.lineWidth = 1.4; c.strokeStyle = "rgba(90,70,40,0.38)";
          for (i = 1; i < 8; i++) {
            c.beginPath(); c.moveTo(w / 2, h * (0.1 + i * 0.11)); c.lineTo(w * 0.12 + i * 2, h * (0.04 + i * 0.1)); c.stroke();
            c.beginPath(); c.moveTo(w / 2, h * (0.1 + i * 0.11)); c.lineTo(w * 0.88 - i * 2, h * (0.04 + i * 0.1)); c.stroke();
          }
        });
        LEAFT = tex(LEAFC);
      }
      return LEAFT;
    }
    var LEAFG = {};
    function leafGeo(i, w, h) { // helai daun melengkung dan sedikit berkerut
      var key = i + ":" + w.toFixed(2);
      if (LEAFG[key]) return LEAFG[key];
      var g = new THREE.PlaneGeometry(w, h, 4, 6), p = g.attributes.position, k, x, y;
      for (k = 0; k < p.count; k++) { x = p.getX(k) / (w / 2); y = p.getY(k) / (h / 2); p.setZ(k, 0.05 * x * x * w / 0.3 - 0.025 * y * y + (fbm(x * 2 + i * 3, y * 2, i) - 0.5) * 0.05); }
      g.computeVertexNormals(); LEAFG[key] = g; return g;
    }
    function leafMesh(color, i, w, h) { return new THREE.Mesh(leafGeo(i, w, h), M(color, { map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85, envMapIntensity: 0.25 })); }
    var LEAFCOL = [0xb7792a, 0xd18a2e, 0x8f5a1f, 0xc9702a];

    function ribbonGeo(len, wd, bend, seed) { // kulit yang menggulung: pita melengkung dan terpuntir
      var g = new THREE.PlaneGeometry(len, wd, 14, 2), p = g.attributes.position, i, x, y, th, tw, rho = len / (2 * bend);
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); th = x / (len / 2) * bend; tw = th * 0.9 + (fbm(x * 3 + seed, 1, seed) - 0.5) * 1.2;
        p.setXYZ(i, rho * Math.sin(th), y * Math.cos(tw), rho * (1 - Math.cos(th)) + y * Math.sin(tw));
      }
      g.computeVertexNormals(); return g;
    }
    function blob(rad, sx, sy, sz, seed, color, o) { // gumpalan tak beraturan: remah, gumpalan tanah, simpul
      var g = new THREE.SphereGeometry(rad, 16, 12), p = g.attributes.position, i, x, y, z, k;
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = 1 + (fbm(x / rad * 1.6 + seed, y / rad * 1.6, z / rad * 1.6) - 0.5) * 0.7;
        p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
      }
      g.computeVertexNormals();
      return mesh(g, M(color, Object.assign({ roughness: 0.95 }, o || {})), 0, 0, 0);
    }
    var KERN = null;
    function kernelCanvas() { // butir jagung
      return KERN || (KERN = ccv(64, 64, function (c) {
        var x, y; c.fillStyle = "#a8841a"; c.fillRect(0, 0, 64, 64);
        for (y = 0; y < 8; y++) for (x = 0; x < 8; x++) { c.fillStyle = (x + y) % 2 ? "#f3c93a" : "#efbf2c"; c.beginPath(); c.arc(4 + x * 8 + (y % 2) * 2, 4 + y * 8, 3.4, 0, PI * 2); c.fill(); }
      }));
    }
    function vegPiece(kind, r) { // satu potongan sisa makanan atau daun; r = pembangkit acak
      var g = new THREE.Group(), b = new THREE.Group(), k, m;
      g.add(b);
      b.rotation.set((r() - 0.5) * 1.0, 0, (r() - 0.5) * 1.0);
      if (kind === "dry") {
        m = leafMesh(LEAFCOL[Math.floor(r() * 4)], Math.floor(r() * 3), 0.3 + r() * 0.1, 0.42 + r() * 0.1); m.rotation.x = -PI / 2; b.add(m);
      } else if (kind === "lettuce") {
        m = leafMesh(r() < 0.5 ? 0x72b13a : 0x8cc152, Math.floor(r() * 3), 0.32 + r() * 0.08, 0.3 + r() * 0.08); m.rotation.x = -PI / 2; b.add(m);
      } else if (kind === "tomato") {
        b.add(mesh(new THREE.SphereGeometry(0.085, 16, 8, 0, PI * 2, 0, PI / 2), MP(0xc8302a, { roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: 0.9 }), 0, 0, 0));
        var f = mesh(new THREE.CircleGeometry(0.085, 18), M(0xe9644d, { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.001, 0); f.rotation.x = PI / 2; b.add(f);
        for (k = 0; k < 6; k++) { var sd = mesh(new THREE.SphereGeometry(0.008, 6, 4), M(0xf2d98a, { roughness: 0.4 }), Math.cos(k * 1.05) * 0.045, 0.0, Math.sin(k * 1.05) * 0.045); sd.scale.y = 0.4; b.add(sd); }
        b.rotation.set((r() - 0.5) * 2.4, 0, (r() - 0.5) * 2.4);
      } else if (kind === "carrot") {
        b.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.032, 18), M(0xe9801b, { roughness: 0.55 }), 0, 0.016, 0));
        var fc = mesh(new THREE.CircleGeometry(0.058, 18), M(0xf4a94e, { roughness: 0.5 }), 0, 0.0325, 0); fc.rotation.x = -PI / 2; b.add(fc);
        var cc = mesh(new THREE.CircleGeometry(0.02, 12), M(0xf9cc8e, { roughness: 0.5 }), 0, 0.033, 0); cc.rotation.x = -PI / 2; b.add(cc);
        b.rotation.set((r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
      } else if (kind === "peel" || kind === "potato" || kind === "banana") {
        var col = kind === "peel" ? 0xe9801b : kind === "potato" ? 0xa9814f : 0xf2d03b, wd = kind === "banana" ? 0.08 : 0.035;
        m = mesh(ribbonGeo(kind === "banana" ? 0.3 : 0.26, wd, 1.4 + r() * 1.2, r() * 9), MP(col, { roughness: 0.4, clearcoat: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.6 }), 0, 0.03, 0); b.add(m);
      } else if (kind === "corn") {
        var ct = tex(kernelCanvas(), 4, 2);
        m = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 14), M(0xffffff, { map: ct, roughness: 0.45, envMapIntensity: 0.5 }), 0, 0.05, 0); m.rotation.z = PI / 2; b.add(m);
        b.rotation.set(0, 0, 0);
      } else if (kind === "egg") {
        m = mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, PI * 2, 0, 1.1), M(0xf3ead6, { roughness: 0.55, side: THREE.DoubleSide }), 0, 0.02, 0); m.scale.set(1, 0.7, 1); b.add(m);
        b.rotation.set(0, 0, 0);
      }
      return g;
    }
    function scatter(g, n, seed, RL, th, kinds, yOff) { // sebar potongan di permukaan lapisan
      var r = rng(seed), i, rr, a, x, z, pc;
      for (i = 0; i < n; i++) {
        rr = (RL - 0.1) * Math.sqrt(r()); a = r() * PI * 2; x = rr * Math.cos(a); z = rr * Math.sin(a);
        pc = vegPiece(kinds[i % kinds.length], r);
        pc.position.set(x, th(x, z) + yOff, z); pc.rotation.y = r() * PI * 2; g.add(pc);
      }
    }
    function clods(g, n, seed, RL, th) { // gumpalan tanah di atas lapisan tanah
      var r = rng(seed), i, rr, a, x, z, c, cols = [0x3a2512, 0x4b3018, 0x5a3b1f, 0x33200f];
      for (i = 0; i < n; i++) {
        rr = (RL - 0.08) * Math.sqrt(r()); a = r() * PI * 2; x = rr * Math.cos(a); z = rr * Math.sin(a);
        c = blob(0.035 + r() * 0.05, 1, 0.7, 1, r() * 9, cols[i % 4], { roughness: 1 });
        c.position.set(x, th(x, z) + 0.015, z); c.rotation.y = r() * 6; g.add(c);
      }
    }

    /* ---- ukuran dan bentuk ember (atas lebih lebar dari bawah) ---- */
    var RT = 0.9, RB = 0.72, H = 1.9, LIFT = 2.6;
    function rAt(y) { return RB + (RT - RB) * (y / H); }

    /* dinding ember: plastik bening kebiruan dengan dua rusuk penguat dan cincin kaki; tepi atas padat dan tebal */
    var bkG = null;
    function bucketParts() {
      if (bkG) return bkG;
      var o = [[0.002, 0.075], [0.3, 0.065], [RB - 0.16, 0.035], [RB - 0.1, 0.0], [RB - 0.02, 0.0], [RB, 0.03]], y, rb;
      for (y = 0.08; y < H - 0.1; y += 0.06) {
        rb = 0.02 * Math.exp(-Math.pow((y - 0.98) / 0.05, 2)) + 0.02 * Math.exp(-Math.pow((y - 1.45) / 0.05, 2));
        o.push([rAt(y) + rb, y]);
      }
      o.push([rAt(H - 0.1), H - 0.1]);
      var rim = [[RT - 0.05, H - 0.15], [RT - 0.015, H - 0.15], [RT + 0.03, H - 0.11], [RT + 0.065, H - 0.05], [RT + 0.075, H], [RT + 0.06, H + 0.02], [RT + 0.02, H + 0.025], [RT - 0.03, H + 0.02], [RT - 0.05, H - 0.02], [RT - 0.05, H - 0.15]];
      bkG = { wall: lathe(o.concat(offsetProfile(o, 0.018).reverse()), 64), rim: lathe(rim, 64) };
      return bkG;
    }
    function makeBucketShell() {
      var p = bucketParts(), g = new THREE.Group();
      g.add(glassMesh(p.wall, 0x3a7bd5, 0.24, 1.5, 0.16));
      g.add(mesh(p.rim, MP(0x2a5fa8, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.7 }), 0, 0, 0));
      return g;
    }

    var bucket = new THREE.Group(); bucket.visible = false; scene.add(bucket);
    bucket.add(makeBucketShell());
    bucket.add(contactShadow(1.15, 1.15, 0));
    bucket.traverse(function (o) { if (o.isMesh && !o.userData.noCast) o.castShadow = true; });

    // titik lubang di bagian bawah
    var markers = [];
    [-0.8, 0, 0.8].forEach(function (a) {
      var r = rAt(0.45) + 0.015, g = new THREE.Group();
      g.position.set(Math.sin(a) * r, 0.45, Math.cos(a) * r); g.rotation.y = a;
      var dot = mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 0, 0.03);
      var halo = mesh(new THREE.RingGeometry(0.12, 0.18, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), 0, 0, 0.03);
      var hole = mesh(new THREE.CircleGeometry(0.09, 18), new THREE.MeshBasicMaterial({ color: 0x10181d }), 0, 0, 0.005);
      hole.add(mesh(new THREE.RingGeometry(0.088, 0.112, 20), M(0x2f67b5, { roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0.004)); // tepi lubang yang baru dibor
      g.add(dot, halo, hole); bucket.add(g);
      markers.push({ g: g, dot: dot, halo: halo, hole: hole, done: false });
    });
    function refreshMarkers(on) {
      markers.forEach(function (m) { m.dot.visible = on && !m.done; m.halo.visible = on && !m.done; m.hole.visible = m.done; });
    }

    /* lapisan isi ember: daun, sisa makanan, tanah. Sisi dan permukaan atas bertekstur, potongan menyembul di atas.
       Saat diaduk, lapisan kompos memudar masuk dan potongan menyusut (tintLayers). */
    var LAYERS = {};
    function lumpy(x, y, RL, amp, sd) { // permukaan atas: cembung di tengah, bergelombang, rata di tepi
      var q = (x * x + y * y) / (RL * RL);
      if (q >= 1) return 0;
      var e = 1 - q;
      return amp * 0.5 * Math.pow(e, 0.5) + (fbm(x * 4 + sd, y * 4, sd * 0.7) - 0.5) * amp * 1.6 * Math.sqrt(e);
    }
    function layer(name, y0, y1, o) {
      var h = y1 - y0, rTop = rAt(y1) - 0.05, rBot = rAt(y0) - 0.05, RL = rTop - 0.004, g = new THREE.Group(), ts = o.set, rep = Math.max(1, h * 2.2), i;
      var mat = function (rx, ry) { return M(0xffffff, { map: tex(ts.c, rx, ry), bumpMap: tex(ts.b, rx, ry), bumpScale: 1.6, roughness: o.rough, envMapIntensity: 0.4 }); };
      g.add(mesh(new THREE.CylinderGeometry(rTop, rBot, h, 48, 1, true), mat(3, rep), 0, h / 2, 0));
      var rg = new THREE.RingGeometry(0.001, RL, 56, 14), p = rg.attributes.position;
      for (i = 0; i < p.count; i++) p.setZ(i, lumpy(p.getX(i), p.getY(i), RL, o.amp, o.seed));
      rg.computeVertexNormals(); rg.rotateX(-PI / 2);
      g.add(mesh(rg, mat(2.4, 2.4), 0, h, 0));
      var pcs = new THREE.Group(); pcs.position.y = h; g.add(pcs);
      o.pieces(pcs, RL, function (x, z) { return lumpy(x, -z, RL, o.amp, o.seed); });
      var cs = compostSet(), ov = [];
      var om = function (rx, ry) {
        var m = M(0xffffff, { map: tex(cs.c, rx, ry), bumpMap: tex(cs.b, rx, ry), bumpScale: 1.6, roughness: 1, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 0.3 });
        ov.push(m); return m;
      };
      var o1 = mesh(new THREE.CylinderGeometry(rTop + 0.004, rBot + 0.004, h, 48, 1, true), om(3, rep), 0, h / 2, 0); o1.renderOrder = 1; g.add(o1);
      var o2 = mesh(rg, om(2.4, 2.4), 0, h + 0.002, 0); o2.renderOrder = 1; g.add(o2);
      g.position.y = y0; g.visible = false; g.scale.y = 0.001;
      g.traverse(function (q) { if (q.isMesh) q.castShadow = q !== o1 && q !== o2; });
      bucket.add(g);
      LAYERS[name] = { m: g, ov: ov, pcs: pcs };
    }
    layer("leaves", 0.06, 0.6, { set: leafSet(), rough: 0.9, amp: 0.14, seed: 3, pieces: function (g, RL, th) { scatter(g, 30, 7, RL, th, ["dry"], 0.03); } });
    layer("scraps", 0.6, 1.15, { set: scrapSet(), rough: 0.6, amp: 0.12, seed: 5, pieces: function (g, RL, th) { scatter(g, 26, 8, RL, th, ["tomato", "carrot", "lettuce", "peel", "corn", "egg", "banana", "potato", "carrot", "lettuce"], 0.03); } });
    layer("soil", 1.15, 1.6, { set: soilSet(), rough: 1, amp: 0.1, seed: 9, pieces: function (g, RL, th) { clods(g, 34, 9, RL, th); } });
    function tintLayers(f) { // f 0..1: kompos memudar masuk, potongan di atas menyusut
      Object.keys(LAYERS).forEach(function (k) {
        var L = LAYERS[k];
        L.ov.forEach(function (m) { m.opacity = f; });
        L.pcs.children.forEach(function (c) { c.scale.setScalar(Math.max(0.001, 1 - f)); });
      });
    }

    // tutup ember: cincin pinggir menutup tepi, permukaan bertingkat, gagang tarik melengkung
    var lid = new THREE.Group(); lid.visible = false; bucket.add(lid);
    var lidMat = function () { return MP(0x2a5fa8, { roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 0.6 }); };
    lid.add(mesh(lathe([[0.001, -0.03], [RT + 0.078, -0.03], [RT + 0.078, -0.14], [RT + 0.115, -0.14], [RT + 0.115, 0.02], [RT + 0.09, 0.045], [0.62, 0.045], [0.58, 0.03], [0.46, 0.03], [0.42, 0.045], [0.001, 0.045]], 72), lidMat(), 0, 0, 0));
    lid.add(mesh(new THREE.TorusGeometry(0.2, 0.05, 10, 24, PI), lidMat(), 0, 0.045, 0)); // gagang
    var lring = mesh(new THREE.TorusGeometry(0.75, 0.012, 6, 64), lidMat(), 0, 0.047, 0); lring.rotation.x = PI / 2; lid.add(lring);
    lid.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    // badan ember yang tidak terlihat, dipakai untuk membaca sentuhan
    var hg = new THREE.CylinderGeometry(RT + 0.04, RT + 0.04, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = H + 0.3; bucket.add(hitBody);

    /* ---- benda di meja: bahan dan alat ---- */
    var WOOD = null;
    function woodCanvas() {
      if (WOOD) return WOOD;
      WOOD = ccv(128, 512, function (c, w, h) {
        var r3 = rng(77), i, k, y, x, gr = c.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, "#b98a52"); gr.addColorStop(0.5, "#c99b61"); gr.addColorStop(1, "#b78852");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (i = 0; i < 170; i++) { // serat memanjang
          x = r3() * w;
          c.strokeStyle = r3() < 0.6 ? "rgba(110,72,34," + (0.1 + r3() * 0.28).toFixed(2) + ")" : "rgba(235,200,150," + (0.08 + r3() * 0.2).toFixed(2) + ")";
          c.lineWidth = 0.6 + r3() * 2.2; c.beginPath(); c.moveTo(x, 0);
          for (y = 0; y <= h; y += 32) c.lineTo(x + Math.sin(y * 0.02 + i) * 3 + (r3() - 0.5) * 2, y);
          c.stroke();
        }
        [[40, 150], [92, 380]].forEach(function (n) { // mata kayu
          for (k = 12; k > 0; k--) { c.strokeStyle = "rgba(80,48,20," + (0.12 + (12 - k) * 0.035).toFixed(2) + ")"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(n[0], n[1], k * 1.7, k * 4.2, 0, 0, PI * 2); c.stroke(); }
          c.fillStyle = "rgba(60,34,14,0.75)"; c.beginPath(); c.ellipse(n[0], n[1], 3, 7, 0, 0, PI * 2); c.fill();
        });
      });
      return WOOD;
    }
    function stickGeo(len, r) { // batang bulat sedikit meruncing, ujung dihaluskan
      var pts = [[0.001, 0], [r * 0.7, 0.002], [r * 0.95, 0.012]], n = 12, i, y;
      for (i = 1; i < n; i++) { y = len * i / n; pts.push([r * (1 - 0.06 * i / n) * (1 + 0.02 * Math.sin(i * 1.9)), y]); }
      pts.push([r * 0.9, len - 0.012], [r * 0.66, len - 0.002], [0.001, len]);
      return lathe(pts, 20);
    }
    function woodMat() { var cv = woodCanvas(); return M(0xffffff, { map: tex(cv), bumpMap: tex(cv), bumpScale: 0.6, roughness: 0.74, envMapIntensity: 0.25 }); }
    var STEEL = function () { return M(0xcfd3d6, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.6, side: THREE.DoubleSide }); };
    function rod(x0, y0, x1, y1, r, mat) { // batang dari titik (x0,y0) ke (x1,y1) pada bidang xy
      var m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, Math.hypot(x1 - x0, y1 - y0), 12), mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0); m.rotation.z = Math.atan2(y1 - y0, x1 - x0) - PI / 2; return m;
    }
    function plasticMat(op) { return MP(0xf4f6f6, { transparent: true, opacity: op, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 }); }
    function twist(geo, turns, lobes, amp, y0, hh) { // lipatan dan puntiran pada leher kantong
      var p = geo.attributes.position, i, x, y, z, k;
      for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = 1 + amp * Math.sin(Math.atan2(z, x) * lobes + (y - y0) / hh * turns); p.setX(i, x * k); p.setZ(i, z * k); }
      geo.computeVertexNormals();
    }

    var MODEL = {
      ember: function (g) { // ember plastik kecil: dikecilkan dari model ember besar, gagang kawat berpegangan plastik
        var b = new THREE.Group(); b.add(makeBucketShell()); b.scale.setScalar(0.43); g.add(b);
        var pts = [], k, a;
        for (k = 0; k <= 20; k++) { a = k / 20 * PI; pts.push(new V3(Math.cos(a) * 0.395, 0.82 + Math.sin(a) * 0.38, 0)); }
        g.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.014, 6, false), M(0xcfd3d6, { metalness: 0.85, roughness: 0.3, envMapIntensity: 1.4 }), 0, 0, 0));
        var gr = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), MP(0xc23b2e, { roughness: 0.5 }), 0, 1.2, 0); gr.rotation.z = PI / 2; g.add(gr);
        [-1, 1].forEach(function (s) { g.add(mesh(new THREE.BoxGeometry(0.05, 0.06, 0.05), MP(0x2a5fa8, { roughness: 0.45 }), s * 0.405, 0.82, 0)); }); // telinga pengait
      },
      daun: function (g) { // karung goni berisi daun kering: mulut digulung, diikat tali
        var o = [[0.001, 0.0], [0.3, 0.0], [0.38, 0.03], [0.42, 0.2], [0.42, 0.45], [0.385, 0.65], [0.345, 0.77], [0.37, 0.8], [0.385, 0.84], [0.365, 0.88], [0.335, 0.865], [0.318, 0.8], [0.318, 0.74], [0.001, 0.74]];
        var sg = lathe(o, 56), p = sg.attributes.position, i, x, y, z, a, k;
        for (i = 0; i < p.count; i++) { // lipatan dan kerutan karung
          x = p.getX(i); y = p.getY(i); z = p.getZ(i); a = Math.atan2(z, x);
          k = 1 + (fbm(Math.cos(a) * 1.6 + 3, y * 3.2, Math.sin(a) * 1.6) - 0.5) * 0.14 + 0.02 * Math.sin(a * 9 + y * 2.5);
          p.setX(i, x * k); p.setZ(i, z * k);
        }
        sg.computeVertexNormals();
        g.add(mesh(sg, M(0xffffff, { map: tex(burlapCanvas(), 3, 2), bumpMap: tex(burlapCanvas(), 3, 2), bumpScale: 1.2, roughness: 0.95, envMapIntensity: 0.15, side: THREE.DoubleSide }), 0, 0, 0));
        var tw = mesh(new THREE.TorusGeometry(0.392, 0.014, 6, 40), M(0x8a6a3c, { roughness: 1 }), 0, 0.66, 0); tw.rotation.x = PI / 2; g.add(tw);
        var r = rng(61), n, rr, aa, h2, lf;
        for (n = 0; n < 26; n++) { // daun kering menyembul dari mulut karung
          rr = 0.3 * Math.sqrt(r()); aa = r() * PI * 2;
          lf = vegPiece("dry", r);
          lf.position.set(rr * Math.cos(aa), 0.76 + 0.26 * (1 - rr / 0.3) + r() * 0.05, rr * Math.sin(aa)); lf.rotation.y = r() * 6.28; g.add(lf);
        }
      },
      sisa: function (g) { // mangkuk keramik putih berisi sisa sayur dan buah
        var o = [[0.001, 0.0], [0.24, 0.0], [0.26, 0.0], [0.3, 0.0], [0.31, 0.02], [0.36, 0.07], [0.44, 0.2], [0.5, 0.34], [0.51, 0.365], [0.485, 0.372], [0.465, 0.35], [0.4, 0.2], [0.3, 0.1], [0.2, 0.07], [0.001, 0.06]];
        g.add(mesh(lathe(o, 56), MP(0xf4f4f0, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide, envMapIntensity: 0.9 }), 0, 0, 0));
        g.add(mesh(lathe([[0.49, 0.31], [0.503, 0.337]], 56), MP(0x2a6fbd, { roughness: 0.3, clearcoat: 0.8, side: THREE.DoubleSide }), 0, 0, 0)); // garis biru di bibir
        var mush = mesh(new THREE.SphereGeometry(1, 28, 10, 0, PI * 2, 0, PI / 2), MP(0x34401f, { roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.7 }), 0, 0.2, 0);
        mush.scale.set(0.42, 0.18, 0.42); g.add(mush);
        var kinds = ["tomato", "carrot", "lettuce", "peel", "carrot", "egg", "banana", "lettuce", "corn", "potato", "tomato", "carrot", "peel", "lettuce", "carrot", "egg"], r = rng(71), n, rr, a, pc;
        for (n = 0; n < kinds.length; n++) {
          rr = 0.36 * Math.sqrt((n + 0.5) / kinds.length) * (0.85 + r() * 0.3); a = n * 2.4 + r();
          pc = vegPiece(kinds[n], r);
          pc.position.set(rr * Math.cos(a), 0.2 + 0.18 * Math.sqrt(Math.max(0, 1 - Math.pow(rr / 0.42, 2))) + 0.02, rr * Math.sin(a)); pc.rotation.y = r() * 6.28; g.add(pc);
        }
      },
      tanah: function (g) { // nampan baja berisi gundukan tanah lembap, gumpalan, kerikil, dan remah
        g.add(mesh(lathe([[0.001, 0.0], [0.52, 0.0], [0.57, 0.02], [0.61, 0.11], [0.6, 0.115], [0.56, 0.04], [0.001, 0.035]], 56), M(0x9aa0a6, { metalness: 0.8, roughness: 0.4, side: THREE.DoubleSide, envMapIntensity: 1.2 }), 0, 0, 0));
        var ss = soilSet(), mg = new THREE.SphereGeometry(1, 36, 18, 0, PI * 2, 0, PI / 2), p = mg.attributes.position, i, x, y, z, k;
        function kk(dx, dy, dz) { return 1 + (fbm(dx * 3.2 + 2, dy * 3.2, dz * 3.2) - 0.5) * 0.4; }
        for (i = 0; i < p.count; i++) { x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = kk(x, y, z); p.setXYZ(i, x * 0.5 * k, y * 0.4 * k, z * 0.5 * k); }
        mg.computeVertexNormals();
        g.add(mesh(mg, M(0xffffff, { map: tex(ss.c, 2, 1), bumpMap: tex(ss.b, 2, 1), bumpScale: 2, roughness: 1, envMapIntensity: 0.15 }), 0, 0.04, 0));
        var r = rng(83), n, yy, aa, rxz, c, cols = [0x3a2512, 0x4b3018, 0x5a3b1f, 0x33200f];
        for (n = 0; n < 34; n++) { // gumpalan di permukaan gundukan
          yy = 0.15 + r() * 0.85; aa = r() * PI * 2; rxz = Math.sqrt(1 - yy * yy);
          x = rxz * Math.cos(aa); z = rxz * Math.sin(aa); k = kk(x, yy, z);
          c = blob(0.03 + r() * 0.05, 1, 0.7, 1, r() * 9, cols[n % 4], { roughness: 1 });
          c.position.set(x * 0.5 * k, yy * 0.4 * k + 0.05, z * 0.5 * k); c.rotation.y = r() * 6; g.add(c);
        }
        for (n = 0; n < 5; n++) { // kerikil
          aa = n * 1.3 + 0.4; c = blob(0.025, 1, 0.7, 1, n, 0x8d9094, { roughness: 0.6 });
          c.position.set(Math.cos(aa) * 0.3, 0.2 + 0.1 * (n % 2), Math.sin(aa) * 0.3); g.add(c);
        }
        for (n = 0; n < 14; n++) { // remah di dasar nampan
          aa = r() * PI * 2; c = blob(0.02 + r() * 0.025, 1, 0.5, 1, r() * 9, cols[n % 4], { roughness: 1 });
          c.position.set(Math.cos(aa) * (0.52 + r() * 0.05), 0.045, Math.sin(aa) * (0.52 + r() * 0.05)); g.add(c);
        }
      },
      sekop: function (g) { // sekop tangan berbaring, bilah ke kanan: genggaman karet merah, gagang kayu, selubung baja, bilah cekung
        var gp = [[0.001, 0.0], [0.05, 0.0], [0.062, 0.03], [0.068, 0.1], [0.066, 0.22], [0.055, 0.3], [0.045, 0.35], [0.001, 0.352]], i;
        gp = gp.map(function (q) { return [q[0] > 0.01 ? q[0] + 0.004 * Math.sin(q[1] * 60) : q[0], q[1]]; });
        var grip = mesh(lathe(gp, 24), MP(0xc23b2e, { roughness: 0.7, clearcoat: 0.15 }), -0.82, 0.12, 0); grip.rotation.z = -PI / 2; g.add(grip);
        var sh = new THREE.Mesh(stickGeo(0.5, 0.045), woodMat()); sh.rotation.z = -PI / 2; sh.position.set(-0.47, 0.12, 0); g.add(sh);
        var fe = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.14, 20), STEEL(), 0.1, 0.12, 0); fe.rotation.z = PI / 2; g.add(fe);
        g.add(rod(0.16, 0.118, 0.27, 0.062, 0.032, STEEL()));
        var bl = new THREE.PlaneGeometry(0.44, 0.34, 18, 8), bp = bl.attributes.position, t, s, w2;
        for (i = 0; i < bp.count; i++) { // bilah: runcing di ujung, cekung seperti sendok
          t = bp.getX(i) / 0.44 + 0.5; s = bp.getY(i) / 0.17;
          w2 = 0.16 * (1 - Math.pow(t, 2.3)) * (0.5 + 0.5 * Math.min(1, t * 4));
          bp.setXYZ(i, 0.22 + t * 0.44, 0.04 * s * s * (1 - 0.4 * t) - 0.01 * (1 - s * s), s * w2);
        }
        bl.computeVertexNormals();
        g.add(mesh(bl, STEEL(), 0, 0.03, 0));
      },
      plastik: function (g) { // kantong kresek bening kusut, leher dipuntir dan diikat, berisi bungkus warna-warni
        var bg = new THREE.SphereGeometry(0.4, 40, 28), p = bg.attributes.position, i, x, y, z, k;
        for (i = 0; i < p.count; i++) {
          x = p.getX(i); y = p.getY(i); z = p.getZ(i);
          k = 1 + (fbm(x * 4 + 1, y * 4, z * 4) - 0.5) * 0.18 + (1 - 2 * Math.abs(fbm(x * 6, y * 6 + 3, z * 6) - 0.5)) * 0.05;
          p.setXYZ(i, x * k * 1.1, y * k * 0.9, z * k * 0.9);
        }
        bg.computeVertexNormals();
        [[-0.12, 0.28, 0.05, 0xd62f2a], [0.14, 0.34, -0.06, 0xf2c230], [0.0, 0.2, 0.12, 0x2a74c9], [-0.05, 0.42, -0.1, 0xf4f4ee]].forEach(function (a, n) {
          var cb = blob(0.14, 1, 0.55, 0.9, n * 2.3, a[3], { roughness: 0.45, metalness: 0.25 }); cb.position.set(a[0], a[1], a[2]); g.add(cb);
        });
        var bag = mesh(bg, plasticMat(0.55), 0, 0.35, 0); bag.renderOrder = 1; bag.userData.noCast = true; g.add(bag);
        var ng = new THREE.CylinderGeometry(0.035, 0.14, 0.34, 18, 12, true);
        twist(ng, 6, 3, 0.12, -0.17, 0.34);
        var nk = mesh(ng, plasticMat(0.7), 0, 0.76, 0); nk.renderOrder = 1; nk.userData.noCast = true; g.add(nk);
        var kn = blob(0.06, 1, 0.9, 1, 4.4, 0xf0f2f2, { roughness: 0.3 }); kn.position.set(0, 0.95, 0); g.add(kn);
        [0.5, 3.4].forEach(function (a, n) { // ujung ikatan yang mencuat
          var tl = mesh(ribbonGeo(0.2, 0.05, 0.6, n + 1), plasticMat(0.8), 0, 0.97, 0); tl.rotation.set(0, a, 0.9 - n * 0.3); tl.renderOrder = 1; tl.userData.noCast = true; g.add(tl);
        });
      },
      daging: function (g) { // piring keramik: daging berurat dan lemak, genangan minyak, botol minyak goreng
        g.add(mesh(lathe([[0.001, 0.0], [0.28, 0.0], [0.3, 0.006], [0.42, 0.03], [0.5, 0.07], [0.505, 0.075], [0.49, 0.078], [0.42, 0.045], [0.3, 0.02], [0.001, 0.02]], 56), MP(0xf4f4f0, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, side: THREE.DoubleSide }), -0.1, 0, 0));
        var mc = ccv(256, 256, function (c, w, h) {
          var r = rng(19), i, gr = c.createLinearGradient(0, 0, w, h);
          gr.addColorStop(0, "#b3261e"); gr.addColorStop(1, "#8f1c18"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
          for (i = 0; i < 90; i++) { c.strokeStyle = "rgba(" + (r() < 0.5 ? "120,20,16" : "200,70,60") + "," + (0.15 + r() * 0.25).toFixed(2) + ")"; c.lineWidth = 1 + r() * 2; c.beginPath(); c.moveTo(r() * w, 0); c.lineTo(r() * w * 0.2 + w * 0.4, h); c.stroke(); } // serat daging
          for (i = 0; i < 26; i++) { var sx = r() * w, sy = r() * h; c.strokeStyle = "rgba(244,206,196," + (0.4 + r() * 0.4).toFixed(2) + ")"; c.lineWidth = 1.5 + r() * 3; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(sx + 30, sy + (r() - 0.5) * 40, sx + 60 * (r() + 0.4), sy + (r() - 0.5) * 30); c.stroke(); } // urat lemak
          c.fillStyle = "rgba(246,226,200,0.9)"; c.fillRect(0, h - 22, w, 22); // tepi lemak
        });
        var st = new THREE.SphereGeometry(1, 40, 24), sp = st.attributes.position, i, x, y, z, k;
        for (i = 0; i < sp.count; i++) {
          x = sp.getX(i); y = sp.getY(i); z = sp.getZ(i); k = 1 + (fbm(x * 2.2 + 5, y * 2.2, z * 2.2) - 0.5) * 0.28;
          sp.setXYZ(i, x * 0.28 * k, y * 0.075 * k, z * 0.2 * k);
        }
        st.computeVertexNormals();
        var meat = mesh(st, MP(0xffffff, { map: tex(mc), roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, envMapIntensity: 0.8 }), -0.1, 0.09, 0); meat.rotation.y = 0.3; g.add(meat);
        var os = new THREE.Shape(), N = 24, a, rr;
        for (i = 0; i < N; i++) { a = i / N * PI * 2; rr = 1 + (fbm(Math.cos(a) * 1.3 + 3, Math.sin(a) * 1.3, 5) - 0.5) * 0.7; if (i) os.lineTo(Math.cos(a) * 0.15 * rr, Math.sin(a) * 0.11 * rr); else os.moveTo(Math.cos(a) * 0.15 * rr, Math.sin(a) * 0.11 * rr); }
        os.closePath();
        var og = new THREE.ShapeGeometry(os); og.rotateX(-PI / 2);
        var oil = mesh(og, MP(0xe8b21c, { transparent: true, opacity: 0.55, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, depthWrite: false }), 0.14, 0.024, 0.12); oil.renderOrder = 1; oil.userData.noCast = oil.userData.noRecv = true; g.add(oil);
        // botol minyak goreng: botol PET bening, minyak keemasan, label, tutup merah
        var bt = new THREE.Group(), o = [[0.001, 0.006], [0.07, 0.006], [0.105, 0.014], [0.12, 0.06], [0.122, 0.3], [0.118, 0.36]], t, s;
        for (k = 1; k <= 8; k++) { t = k / 8; s = t * t * (3 - 2 * t); o.push([0.046 + 0.072 * (1 - s), 0.36 + 0.11 * t]); }
        o.push([0.045, 0.5], [0.052, 0.505], [0.045, 0.51], [0.046, 0.535], [0.052, 0.54]);
        var fill = mesh(lathe([[0.001, 0.016], [0.104, 0.016], [0.113, 0.06], [0.114, 0.3], [0.108, 0.34], [0.001, 0.34]], 36), MP(0xe4a712, { transparent: true, opacity: 0.8, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }), 0, 0, 0);
        fill.userData.noCast = true; bt.add(fill);
        bt.add(glassMesh(lathe(o.concat(offsetProfile(o, 0.008).reverse()), 40), 0xf6e7b0, 0.22, 1.8));
        var lc = ccv(512, 112, function (c, w, h) {
          c.fillStyle = "#c8281f"; c.fillRect(0, 0, w, h); c.fillStyle = "#f4f0e0"; c.fillRect(0, h * 0.62, w, h * 0.38);
          c.fillStyle = "#f2c230"; c.beginPath(); c.arc(w / 2, h * 0.34, 26, 0, PI * 2); c.fill();
          c.fillStyle = "#c8281f"; c.font = "800 26px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("MINYAK GORENG", w / 2, h * 0.81);
        });
        var lb = mesh(new THREE.CylinderGeometry(0.126, 0.126, 0.14, 40, 1, true), M(0xffffff, { map: tex(lc), roughness: 0.6 }), 0, 0.18, 0); lb.rotation.y = PI; bt.add(lb);
        bt.add(mesh(lathe([[0.001, 0.505], [0.056, 0.505], [0.056, 0.54], [0.05, 0.552], [0.001, 0.552]], 32), MP(0xc23b2e, { roughness: 0.4, side: THREE.DoubleSide }), 0, 0, 0));
        bt.position.set(0.42, 0, 0.1); g.add(bt);
      }
    };
    var CONTACT = { ember: [0.44, 0.44, 0], daun: [0.5, 0.5, 0], sisa: [0.56, 0.56, 0], tanah: [0.66, 0.66, 0], sekop: [0.9, 0.2, -0.08], plastik: [0.52, 0.46, 0], daging: [0.72, 0.5, 0.12] };
    function buildObj(key, hitR, hitY, contact) {
      var g = new THREE.Group(); MODEL[key](g);
      if (contact && CONTACT[key]) g.add(contactShadow(CONTACT[key][0], CONTACT[key][1], CONTACT[key][2]));
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noRecv; } });
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
      var g = buildObj(m.k, 0.8, 0.45, true);
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
      Object.keys(LAYERS).forEach(function (k) { var L = LAYERS[k]; L.m.visible = false; L.m.scale.y = 0.001; L.ov.forEach(function (m) { m.opacity = 0; }); L.pcs.children.forEach(function (c) { c.scale.setScalar(1); }); });
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
    sun.shadow.mapSize.set(2048, 2048);
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

    /* ---- lingkungan pantulan: kotak cahaya studio kecil, supaya kaca, logam, dan plastik punya kilap yang nyata ---- */
    var envOK = false;
    try {
      if (renderer.capabilities.isWebGL2 && THREE.PMREMGenerator) {
        var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
        var dm = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
        var dp = dm.geometry.attributes.position, dc = [], di, dt;
        for (di = 0; di < dp.count; di++) {
          dt = dp.getY(di) / 20;
          if (dt > 0) dc.push(0.5 + 0.4 * dt, 0.56 + 0.38 * dt, 0.58 + 0.4 * dt);
          else dc.push(0.28 + 0.22 * (1 + dt), 0.31 + 0.24 * (1 + dt), 0.3 + 0.22 * (1 + dt));
        }
        dm.geometry.setAttribute("color", new THREE.Float32BufferAttribute(dc, 3));
        es.add(dm);
        [[12, 8, 0, 14, 2, 5], [3, 10, -14, 5, 3, 6], [3, 9, 12, 4, 8, 4.5], [8, 3, 2, 3, -15, 2.5]].forEach(function (a) {
          var sb = new THREE.Mesh(new THREE.PlaneGeometry(a[0], a[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(a[5], a[5], a[5] * 0.97), side: THREE.DoubleSide }));
          sb.position.set(a[2], a[3], a[4]); sb.lookAt(0, 0, 0); es.add(sb);
        });
        scene.environment = pm.fromScene(es, 0.03).texture;
        envOK = true;
        pm.dispose();
      }
    } catch (e) { envOK = false; }
    floorMat.envMapIntensity = 0; // lantai tetap memakai warna tema, tidak ikut terpantul

    /* ---- alat bantu ---- */
    function M(color, o) {
      var p = Object.assign({ color: color, roughness: 0.7, metalness: 0, envMapIntensity: 0.35 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6; // tanpa peta pantulan, logam penuh akan tampil gelap
      return new THREE.MeshStandardMaterial(p);
    }
    function MP(color, o) { // plastik atau cat berlapis bening (kilap basah, plastik mengilap)
      var p = Object.assign({ color: color, roughness: 0.5, metalness: 0, envMapIntensity: 0.5 }, o || {});
      if (!envOK && p.metalness > 0.3) p.metalness *= 0.6;
      return new THREE.MeshPhysicalMaterial(p);
    }
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

    /* ---- derau dan bilangan acak berbenih: bentuk kusut selalu sama tiap dimuat ---- */
    function rng(seed) {
      var s = seed >>> 0;
      return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function hash3(x, y, z) { var h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
    function vnoise(x, y, z) {
      var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
      function l(a, b, t) { return a + (b - a) * t; }
      return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
        l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
    }
    function fbm(x, y, z) { return vnoise(x, y, z) * 0.55 + vnoise(x * 2.1 + 5.2, y * 2.1 + 1.3, z * 2.1 + 9.1) * 0.3 + vnoise(x * 4.3 + 2.7, y * 4.3 + 8.1, z * 4.3 + 3.3) * 0.15; }

    /* ---- tekstur prosedural (kanvas) dan bentuk putar ---- */
    var ANI = 4; try { ANI = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } catch (e) { }
    function ccv(w, h, draw) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; draw(cv.getContext("2d"), w, h); return cv; }
    function tex(cv, rx, ry) { var t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.anisotropy = ANI; return t; }
    function lathe(pts, seg) { return new THREE.LatheGeometry(pts.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48); }
    function offsetProfile(pts, t) { // profil bergeser ke dalam sejauh t: dinding botol yang punya ketebalan
      return pts.map(function (p, i) {
        var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
        return [Math.max(0.002, p[0] - dy / l * t), p[1] + dx / l * t];
      });
    }
    function helixGeo(r, y0, y1, turns, tube) { // ulir leher botol
      var pts = [], n = 40, i, a;
      for (i = 0; i <= n; i++) { a = i / n * turns * PI * 2; pts.push(new V3(Math.cos(a) * r, y0 + (y1 - y0) * i / n, Math.sin(a) * r)); }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, tube, 6, false);
    }
    function knurl(rad, h, n, amp, seg) { // sisi tutup bergerigi
      var g = new THREE.CylinderGeometry(rad, rad, h, seg, 1, true), p = g.attributes.position, i, a, k;
      for (i = 0; i < p.count; i++) { a = Math.atan2(p.getZ(i), p.getX(i)); k = 1 + amp * Math.cos(a * n); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      g.computeVertexNormals(); return g;
    }

    /* bayangan kontak lembut di bawah benda: pelengkap bayangan matahari */
    var csCv = null;
    function contactShadow(rx, rz, ox) {
      if (!csCv) csCv = ccv(64, 64, function (c) {
        var gr = c.createRadialGradient(32, 32, 2, 32, 32, 31);
        gr.addColorStop(0, "rgba(0,0,0,0.6)"); gr.addColorStop(0.5, "rgba(0,0,0,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = gr; c.fillRect(0, 0, 64, 64);
      });
      var t = tex(csCv); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      var m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0.8 }));
      m.rotation.x = -PI / 2; m.scale.set(rx * 2, rz * 2, 1); m.position.set(ox || 0, 0.006, 0); m.renderOrder = -1;
      m.raycast = function () { }; m.userData.noCast = true; m.userData.noRecv = true; return m;
    }

    /* kepingan potongan bungkus: pecahan kecil melengkung, tiap keping warna sendiri, satu geometri */
    function shredGeo(n, seed, place) {
      var r2 = rng(seed), pos = [], col = [], idx = [], base = 0, i, gx, gy, a;
      var pal = ["#d8392f", "#f2c230", "#2a74c9", "#f1f1ea", "#e9801b", "#3f9a4b", "#b9bfc5", "#c9ced3"].map(function (h) { return new THREE.Color(h); });
      var mt = new THREE.Matrix4(), mr = new THREE.Matrix4(), v = new V3();
      for (i = 0; i < n; i++) {
        var pp = place(r2), w = 0.07 + r2() * 0.09, h = 0.045 + r2() * 0.06, bend = (r2() - 0.5) * 7, cc = pal[Math.floor(r2() * pal.length)], k = 0.85 + r2() * 0.3;
        mt.makeRotationY(r2() * PI * 2);
        mr.makeRotationFromEuler(new THREE.Euler(-PI / 2 + (r2() - 0.5) * 1.4, 0, (r2() - 0.5) * 1.4));
        mt.multiply(mr);
        for (gy = 0; gy <= 2; gy++) for (gx = 0; gx <= 3; gx++) {
          v.set((gx / 3 - 0.5) * w, (gy / 2 - 0.5) * h, 0);
          v.z = bend * v.x * v.x + (r2() - 0.5) * 0.008;
          v.applyMatrix4(mt);
          pos.push(v.x + pp[0], v.y + pp[1], v.z + pp[2]);
          var sh = k * (0.9 + 0.2 * gx / 3);
          col.push(Math.min(1, cc.r * sh), Math.min(1, cc.g * sh), Math.min(1, cc.b * sh));
        }
        for (gy = 0; gy < 2; gy++) for (gx = 0; gx < 3; gx++) { a = base + gy * 4 + gx; idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5); }
        base += 12;
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx); g.computeVertexNormals(); return g;
    }
    function shredMat() { return M(0xffffff, { vertexColors: true, side: THREE.DoubleSide, roughness: 0.42, metalness: 0.35, envMapIntensity: 1 }); }

    /* lembar kemasan kusut (kerutan, segel bergerigi di ujung, tepi melengkung) */
    function sheetZ(u, v, w, d, o) {
      var x = u * w / 2, y = v * d / 2, s = o.seed || 0;
      var z = o.amp * 2.2 + (o.puff || 0) * Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
      z += o.amp * ((fbm(x * 3.1 + s, y * 3.1, s * 0.7) - 0.5) * 2 + (1 - 2 * Math.abs(fbm(x * 2.2, y * 2.2 + s, 3.3) - 0.5)) * 0.7);
      if (o.crimp && Math.abs(u) > 0.84) z += o.crimp * Math.sin(y * 100) * Math.min(1, (Math.abs(u) - 0.84) / 0.04);
      if (o.curl) z += o.curl * (u * u * 0.7 + v * v);
      return z;
    }
    function sheetGeo(w, d, nx, ny, o) {
      var g = new THREE.PlaneGeometry(w, d, nx, ny), p = g.attributes.position, i;
      for (i = 0; i < p.count; i++) p.setZ(i, sheetZ(p.getX(i) / (w / 2), p.getY(i) / (d / 2), w, d, o));
      g.computeVertexNormals(); g.rotateX(-PI / 2);
      return g;
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

    /* ---- botol: badan, bahu, leher berulir; lapisan isi; tutup ---- */
    var R = 0.62, H = 2.4, TOPY = 3.0, LIFT = 3.6, HOVER = 4.0;

    /* kaca atau plastik bening: lapisan warna tipis ditambah lapisan pantulan (hanya kilap), sehingga tepi dan sorotan terlihat nyata */
    function glassMesh(geo, tint, opacity, reflI) {
      var g = new THREE.Group();
      var a = new THREE.Mesh(geo, MP(tint, { roughness: 0.06, transparent: true, opacity: opacity, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.6 }));
      var b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: reflI }));
      a.renderOrder = 1; b.renderOrder = 2;
      a.userData.noCast = a.userData.noRecv = b.userData.noCast = b.userData.noRecv = true;
      g.add(a); g.add(b); return g;
    }

    var petG = null;
    function petParts() {
      if (petG) return petG;
      var o = [[0.002, 0.075], [0.18, 0.07], [0.36, 0.04], [0.47, 0.004], [0.545, 0.0], [0.59, 0.03], [0.612, 0.09], [R - 0.004, 0.17]], y, t, k, s;
      for (y = 0.22; y < H - 0.001; y += 0.06) { // dua alur cekung dan sedikit pinggang, seperti botol air kemasan
        o.push([R - 0.034 * Math.exp(-Math.pow((y - 0.62) / 0.075, 2)) - 0.034 * Math.exp(-Math.pow((y - 1.8) / 0.075, 2)) - 0.012 * Math.exp(-Math.pow((y - 1.2) / 0.4, 2)), y]);
      }
      o.push([R, H]);
      for (k = 1; k <= 12; k++) { t = k / 12; s = t * t * (3 - 2 * t); o.push([0.27 + (R - 0.27) * (1 - s), H + 0.5 * t]); }
      o.push([0.272, 2.915], [0.274, 2.925], [0.332, 2.935], [0.338, 2.95], [0.332, 2.965], [0.274, 2.978], [0.268, 3.0], [0.266, 3.1], [0.266, 3.21], [0.274, 3.232], [0.28, 3.248], [0.272, 3.262]);
      petG = { shell: lathe(o.concat(offsetProfile(o, 0.013).reverse()), 56), thread: helixGeo(0.268, 3.04, 3.2, 1.7, 0.017) };
      return petG;
    }
    function makePETShell() {
      var p = petParts(), g = new THREE.Group();
      g.add(glassMesh(p.shell, 0xdff2f8, 0.18, 2.0));
      g.add(glassMesh(p.thread, 0xdff2f8, 0.3, 1.5));
      return g;
    }
    function makeCap(color) { // tutup ulir: sisi bergerigi, cincin segel di bawah, atas membulat di tepi
      var g = new THREE.Group();
      var mat = function () { return MP(color, { roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.28, envMapIntensity: 0.8 }); };
      g.add(mesh(knurl(0.322, 0.235, 34, 0.035, 170), mat(), 0, 0.1925, 0));
      g.add(mesh(lathe([[0.001, 0.339], [0.18, 0.34], [0.285, 0.335], [0.314, 0.318], [0.322, 0.296], [0.322, 0.27]], 64), mat(), 0, 0, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.318, 0.318, 0.058, 64, 1, true), mat(), 0, 0.031, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.296, 0.296, 0.02, 48, 1, true), mat(), 0, 0.068, 0));
      return g;
    }

    var bottle = new THREE.Group(); bottle.visible = false; scene.add(bottle);
    bottle.add(makePETShell());
    bottle.add(contactShadow(0.85, 0.85, 0));

    /* isi botol: potongan bungkus yang menumpuk. Sisi berbintik pecahan warna-warni (peta warna dan relief), permukaan atas bergelombang dengan keping-keping di atasnya */
    var CRM = null;
    function crumpleTex() {
      if (CRM) return CRM;
      var r1 = rng(5), shards = [], pal = ["#d8392f", "#f2c230", "#2a74c9", "#f1f1ea", "#e9801b", "#3f9a4b", "#b9bfc5", "#8f979e", "#e8e8e2"], i, k;
      for (i = 0; i < 1100; i++) {
        var sh = { x: r1() * 512, y: r1() * 512, a: r1() * PI, l: 9 + r1() * 22, w: 5 + r1() * 12, c: pal[Math.floor(r1() * pal.length)], v: 0.45 + r1() * 0.55, p: [], cr: (r1() - 0.5) * 0.6 };
        for (k = 0; k < 5; k++) sh.p.push([k / 5 * PI * 2 + (r1() - 0.5) * 0.8, 0.6 + r1() * 0.5]);
        shards.push(sh);
      }
      function drawAll(c, bump) {
        c.fillStyle = bump ? "#303030" : "#16181a"; c.fillRect(0, 0, 512, 512);
        shards.forEach(function (s) {
          [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(function (o) { // salinan di tepi supaya tekstur menyambung
            var cx = s.x + o[0], cy = s.y + o[1];
            if (cx < -40 || cx > 552 || cy < -40 || cy > 552) return;
            c.save(); c.translate(cx, cy); c.rotate(s.a); c.beginPath();
            s.p.forEach(function (q, j) { var px = Math.cos(q[0]) * s.l * q[1] * 0.5, py = Math.sin(q[0]) * s.w * q[1] * 0.5; if (j) c.lineTo(px, py); else c.moveTo(px, py); });
            c.closePath();
            if (bump) {
              var gg = Math.round(255 * s.v); c.fillStyle = "rgb(" + gg + "," + gg + "," + gg + ")"; c.fill();
              c.strokeStyle = "rgba(0,0,0,0.9)"; c.lineWidth = 2; c.stroke();
            } else {
              c.fillStyle = s.c; c.fill();
              c.fillStyle = "rgba(255,255,255," + ((1 - s.v) * 0.5).toFixed(2) + ")"; c.fill();
              c.strokeStyle = "rgba(255,255,255,0.28)"; c.lineWidth = 1; c.stroke();
              c.beginPath(); c.moveTo(-s.l * 0.3, 0); c.lineTo(s.l * 0.3, s.cr * s.w); c.strokeStyle = "rgba(0,0,0,0.28)"; c.stroke();
            }
            c.restore();
          });
        });
      }
      CRM = { c: ccv(512, 512, function (c) { drawAll(c, false); }), b: ccv(512, 512, function (c) { drawAll(c, true); }) };
      return CRM;
    }
    function topHeight(x, y, RL) { // tinggi permukaan atas lapisan: cembung di tengah, bergelombang, rata di tepi
      var q = (x * x + y * y) / (RL * RL);
      if (q >= 1) return 0;
      var e = 1 - q;
      return 0.06 * Math.pow(e, 0.6) + (fbm(x * 4.2 + 3, y * 4.2, 1.7) - 0.5) * 0.16 * Math.sqrt(e);
    }
    var LAYERS = {};
    function layer(name, y0, h, seed) { // dasar lapisan di y0, tinggi penuh h; scale.y dipakai untuk mengisi dan memadatkan
      var cm = crumpleTex(), RL = R - 0.045, g = new THREE.Group(), rep = Math.max(1, h * 1.6);
      var mat = function (rx, ry) { return M(0xffffff, { map: tex(cm.c, rx, ry), bumpMap: tex(cm.b, rx, ry), bumpScale: 1.6, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.9 }); };
      g.add(mesh(new THREE.CylinderGeometry(RL, RL, h, 48, 1, true), mat(3, rep), 0, h / 2, 0));
      var rg = new THREE.RingGeometry(0.001, RL, 56, 14), p = rg.attributes.position, i;
      for (i = 0; i < p.count; i++) p.setZ(i, topHeight(p.getX(i), p.getY(i), RL));
      rg.computeVertexNormals(); rg.rotateX(-PI / 2);
      g.add(mesh(rg, mat(2.2, 2.2), 0, h, 0));
      g.add(mesh(shredGeo(80, seed, function (r) {
        var rr = (RL - 0.06) * Math.sqrt(r()), a = r() * PI * 2, x = rr * Math.cos(a), z = rr * Math.sin(a);
        return [x, topHeight(x, -z, RL) + 0.012 + r() * 0.03, z];
      }), shredMat(), 0, h, 0));
      g.position.y = y0; g.visible = false; g.scale.y = 0.001; g.userData.h = h;
      g.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      bottle.add(g);
      LAYERS[name] = { m: g, y0: y0 };
    }
    layer("a", 0.06, 1.3, 31);   // 1.3 dipadatkan ke 70%: puncak di 0.97
    layer("b", 0.97, 1.35, 32);  // 1.35 dipadatkan ke 80%: puncak di 2.05

    var lid = makeCap(0x1e66c8); lid.visible = false; bottle.add(lid);
    lid.traverse(function (o) { if (o.isMesh) o.castShadow = true; });

    var hg = new THREE.CylinderGeometry(R + 0.05, R + 0.05, 1, 20); hg.translate(0, 0.5, 0);
    var hitBody = new THREE.Mesh(hg, invisibleMat()); hitBody.scale.y = TOPY + 0.3; bottle.add(hitBody);

    /* ---- benda di meja: bahan dan alat ---- */
    var STEEL = function () { return M(0xd5d9dc, { metalness: 0.92, roughness: 0.26, envMapIntensity: 1.7 }); };

    /* bungkus snack kering: cetakan warna-warni, segel ujung bergerigi, bagian dalam perak */
    var WRAP_PAL = [["#d62f2a", "#f7c331"], ["#1f6fc6", "#f4f6f8"], ["#f2c230", "#2f8f3e"], ["#3f9a4b", "#f2c230"]];
    function drawWrap(c, w, h, pal) {
      var x, i;
      c.fillStyle = pal[0]; c.fillRect(0, 0, w, h);
      for (x = -h; x < w + h; x += 46) { // garis diagonal samar
        c.fillStyle = "rgba(255,255,255,0.08)"; c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 22, 0); c.lineTo(x + 22 - h * 0.6, h); c.lineTo(x - h * 0.6, h); c.fill();
      }
      c.fillStyle = pal[1]; c.beginPath(); c.moveTo(0, h * 0.82);
      for (x = 0; x <= w; x += 8) c.lineTo(x, h * 0.84 + Math.sin(x / 26) * 9);
      c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = pal[1]; c.beginPath(); c.arc(w / 2, h * 0.46, h * 0.33, 0, PI * 2); c.fill();
      c.lineWidth = 7; c.strokeStyle = "#ffffff"; c.stroke();
      c.fillStyle = "#e9b84a"; c.beginPath(); c.ellipse(w / 2, h * 0.41, 66, 42, -0.25, 0, PI * 2); c.fill(); // keripik
      c.lineWidth = 3; c.strokeStyle = "#b5862c"; c.stroke();
      c.fillStyle = "rgba(150,100,30,0.55)";
      for (i = 0; i < 12; i++) { c.beginPath(); c.arc(w / 2 - 40 + (i * 37 % 80), h * 0.41 - 22 + (i * 23 % 44), 3, 0, PI * 2); c.fill(); }
      c.textAlign = "center"; c.textBaseline = "middle"; c.font = "800 46px Arial, sans-serif";
      c.lineWidth = 8; c.strokeStyle = "rgba(0,0,0,0.45)"; c.strokeText("RENYAH", w / 2, h * 0.66);
      c.fillStyle = "#ffffff"; c.fillText("RENYAH", w / 2, h * 0.66);
      [0, w * 0.93].forEach(function (sx) { // segel ujung
        c.fillStyle = "#cfd4d8"; c.fillRect(sx, 0, w * 0.07, h);
        c.strokeStyle = "rgba(60,70,80,0.45)"; c.lineWidth = 2;
        for (i = 0; i < 9; i++) { c.beginPath(); c.moveTo(sx + 4 + i * 4, 0); c.lineTo(sx + 4 + i * 4, h); c.stroke(); }
      });
      c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 2; // pantulan lipatan
      for (i = 0; i < 14; i++) { c.beginPath(); c.moveTo((i * 97) % w, 0); c.lineTo((i * 97 + 90) % w, h); c.stroke(); }
    }
    var WRAPS = [];
    function wrapPart(i) {
      if (WRAPS[i]) return WRAPS[i];
      var pal = WRAP_PAL[i];
      WRAPS[i] = {
        cv: ccv(512, 320, function (c, w, h) { drawWrap(c, w, h, pal); }),
        geo: sheetGeo(0.78, 0.5, 36, 40, { amp: 0.008, puff: 0.03, crimp: 0.011, seed: i * 3.7 + 1 })
      };
      return WRAPS[i];
    }

    /* bungkus basah: kusut, merah mengilap, noda saus dan minyak, genangan air dan tetesan */
    var WETC = null;
    function wetCanvases() {
      if (WETC) return WETC;
      var r1 = rng(91), blots = [], i;
      for (i = 0; i < 9; i++) blots.push({ x: 90 + r1() * 340, y: 60 + r1() * 200, rx: 30 + r1() * 70, ry: 24 + r1() * 50, a: r1() * PI, sauce: i < 3 });
      function eachBlot(c, stops) {
        blots.forEach(function (b) {
          c.save(); c.translate(b.x, b.y); c.rotate(b.a); c.scale(1, b.ry / b.rx);
          var gr = c.createRadialGradient(0, 0, 0, 0, 0, b.rx), s = stops(b);
          gr.addColorStop(0, s[0]); gr.addColorStop(0.7, s[1]); gr.addColorStop(1, s[2]);
          c.fillStyle = gr; c.beginPath(); c.arc(0, 0, b.rx, 0, PI * 2); c.fill(); c.restore();
        });
      }
      WETC = {
        c: ccv(512, 320, function (c, w, h) {
          c.fillStyle = "#c8281f"; c.fillRect(0, 0, w, h);
          c.fillStyle = "rgba(255,255,255,0.10)"; c.beginPath(); c.arc(w * 0.5, h * 0.5, h * 0.34, 0, PI * 2); c.fill();
          c.strokeStyle = "rgba(255,255,255,0.18)"; c.lineWidth = 6; c.stroke();
          c.fillStyle = "rgba(255,230,160,0.22)"; c.font = "800 54px Arial, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("RENYAH", w * 0.5, h * 0.5);
          c.fillStyle = "#c2c7cb"; c.fillRect(0, 0, w * 0.07, h); c.fillRect(w * 0.93, 0, w * 0.07, h);
          eachBlot(c, function (b) { return b.sauce ? ["rgba(150,70,20,0.85)", "rgba(170,80,25,0.55)", "rgba(170,80,25,0)"] : ["rgba(90,12,8,0.55)", "rgba(100,14,10,0.35)", "rgba(100,14,10,0)"]; });
          for (i = 0; i < 40; i++) { c.fillStyle = "rgba(255,210,90," + (0.12 + r1() * 0.2).toFixed(2) + ")"; c.beginPath(); c.arc(60 + r1() * 392, 40 + r1() * 240, 2 + r1() * 7, 0, PI * 2); c.fill(); }
        }),
        r: ccv(512, 320, function (c, w, h) { // peta kekasaran: area basah licin
          c.fillStyle = "#b4b4b4"; c.fillRect(0, 0, w, h);
          eachBlot(c, function () { return ["rgba(16,16,16,1)", "rgba(40,40,40,0.8)", "rgba(180,180,180,0)"]; });
        })
      };
      return WETC;
    }
    var wetGeoC = null;
    var WET_O = { amp: 0.026, puff: 0.02, curl: 0.1, seed: 4.2 }, WET_W = 0.72, WET_D = 0.48;
    function wetPoint(px, py) { return sheetZ(px / (WET_W / 2), py / (WET_D / 2), WET_W, WET_D, WET_O); } // tinggi lembar di titik (px,py) pada bidang lembar

    var WOOD = null;
    function woodCanvas() {
      if (WOOD) return WOOD;
      WOOD = ccv(128, 512, function (c, w, h) {
        var r3 = rng(77), i, k, y, x, gr = c.createLinearGradient(0, 0, w, 0);
        gr.addColorStop(0, "#b98a52"); gr.addColorStop(0.5, "#c99b61"); gr.addColorStop(1, "#b78852");
        c.fillStyle = gr; c.fillRect(0, 0, w, h);
        for (i = 0; i < 170; i++) { // serat memanjang
          x = r3() * w;
          c.strokeStyle = r3() < 0.6 ? "rgba(110,72,34," + (0.1 + r3() * 0.28).toFixed(2) + ")" : "rgba(235,200,150," + (0.08 + r3() * 0.2).toFixed(2) + ")";
          c.lineWidth = 0.6 + r3() * 2.2; c.beginPath(); c.moveTo(x, 0);
          for (y = 0; y <= h; y += 32) c.lineTo(x + Math.sin(y * 0.02 + i) * 3 + (r3() - 0.5) * 2, y);
          c.stroke();
        }
        [[40, 150], [92, 380]].forEach(function (n) { // mata kayu
          for (k = 12; k > 0; k--) { c.strokeStyle = "rgba(80,48,20," + (0.12 + (12 - k) * 0.035).toFixed(2) + ")"; c.lineWidth = 1.6; c.beginPath(); c.ellipse(n[0], n[1], k * 1.7, k * 4.2, 0, 0, PI * 2); c.stroke(); }
          c.fillStyle = "rgba(60,34,14,0.75)"; c.beginPath(); c.ellipse(n[0], n[1], 3, 7, 0, 0, PI * 2); c.fill();
        });
      });
      return WOOD;
    }
    function stickGeo(len, r) { // tongkat bulat: sedikit meruncing dan tidak persis lurus, ujung dihaluskan
      var pts = [[0.001, 0], [r * 0.7, 0.002], [r * 0.95, 0.012]], n = 16, i, y;
      for (i = 1; i < n; i++) { y = len * i / n; pts.push([r * (1 - 0.08 * i / n) * (1 + 0.025 * Math.sin(i * 1.9)), y]); }
      pts.push([r * 0.9, len - 0.012], [r * 0.66, len - 0.002], [0.001, len]);
      return lathe(pts, 22);
    }
    function woodMat() { var cv = woodCanvas(); return M(0xffffff, { map: tex(cv), bumpMap: tex(cv), bumpScale: 0.6, roughness: 0.74, envMapIntensity: 0.25 }); }

    var BAT = null;
    function batteryCanvas() {
      if (BAT) return BAT;
      BAT = ccv(512, 280, function (c, w, h) {
        var r4 = rng(13), i, gr;
        c.fillStyle = "#15171a"; c.fillRect(0, 0, w, h);
        gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,255,255,0.06)"); gr.addColorStop(1, "rgba(0,0,0,0.3)"); c.fillStyle = gr; c.fillRect(0, 0, w, h);
        c.fillStyle = "#e3b21a"; c.fillRect(0, h * 0.5, w, h * 0.17); // pita emas
        c.fillStyle = "#b8870c"; c.fillRect(0, h * 0.5, w, 3); c.fillRect(0, h * 0.67 - 3, w, 3);
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillStyle = "#f2f2ee"; c.font = "800 30px Arial, sans-serif"; c.fillText("HEAVY DUTY", w / 2, h * 0.16);
        c.font = "800 58px Arial, sans-serif"; c.fillText("1,5 V", w / 2, h * 0.36);
        c.fillStyle = "#1c1500"; c.font = "800 28px Arial, sans-serif"; c.fillText("SIZE D  R20", w / 2, h * 0.585);
        c.fillStyle = "#cfd2d4"; c.font = "700 17px Arial, sans-serif"; c.fillText("JANGAN DIISI ULANG", w / 2, h * 0.78); c.fillText("BUANG KE TEMPAT B3", w / 2, h * 0.88);
        for (i = 0; i < 26; i++) { // goresan dan lecet
          c.strokeStyle = "rgba(220,220,215," + (0.08 + r4() * 0.2).toFixed(2) + ")"; c.lineWidth = 0.8 + r4() * 1.4;
          var sx = r4() * w, sy = r4() * h; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + (r4() - 0.5) * 70, sy + (r4() - 0.5) * 24); c.stroke();
        }
        for (i = 0; i < 40; i++) { c.fillStyle = "rgba(120,72,32," + (0.06 + r4() * 0.14).toFixed(2) + ")"; c.beginPath(); c.arc(r4() * w, h * (0.7 + r4() * 0.3), 1.5 + r4() * 5, 0, PI * 2); c.fill(); }
        gr = c.createRadialGradient(w * 0.55, 0, 2, w * 0.55, 0, 90); gr.addColorStop(0, "rgba(190,140,50,0.7)"); gr.addColorStop(1, "rgba(190,140,50,0)"); c.fillStyle = gr; c.fillRect(0, 0, w, 100); // noda cairan bocor
      });
      return BAT;
    }
    function crust(rad, sx, sy, sz, seed, color) { // kerak putih dari bocoran baterai: gumpalan tak beraturan
      var g = new THREE.IcosahedronGeometry(rad, 2), p = g.attributes.position, i, x, y, z, k;
      for (i = 0; i < p.count; i++) {
        x = p.getX(i); y = p.getY(i); z = p.getZ(i); k = 1 + (fbm(x * 9 + seed, y * 9, z * 9) - 0.5) * 0.7;
        p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
      }
      g.computeVertexNormals();
      return mesh(g, M(color, { roughness: 0.95 }), 0, 0, 0);
    }

    var GLG = null;
    function glassBottleGeo() {
      if (GLG) return GLG;
      var o = [[0.002, 0.0], [0.27, 0.0], [0.318, 0.01], [0.346, 0.045], [0.356, 0.11], [0.358, 0.2], [0.358, 0.62]], k, t, s;
      for (k = 1; k <= 14; k++) { t = k / 14; s = t * t * (3 - 2 * t); o.push([0.175 + 0.183 * (1 - s), 0.62 + 0.3 * t]); }
      o.push([0.175, 0.96], [0.172, 0.99], [0.19, 1.0], [0.204, 1.012], [0.206, 1.04], [0.194, 1.055], [0.176, 1.055]);
      GLG = lathe(o.concat(offsetProfile(o, 0.028).reverse()), 48);
      return GLG;
    }

    var pileN = 0;
    var MODEL = {
      botol: function (g) { // botol air kemasan bening dengan tutup biru, dikecilkan dari model botol besar
        var b = new THREE.Group(), cap = makeCap(0x1e66c8);
        b.add(makePETShell()); cap.position.y = TOPY; b.add(cap); b.scale.setScalar(0.43); g.add(b);
      },
      bungkus: function (g) {
        [[0, 0, 0, 0], [1, 0.42, 0.03, -0.02], [2, -0.33, -0.03, 0.03], [3, 0.14, 0.02, 0.01]].forEach(function (a, i) {
          var wp = wrapPart(a[0]), s = new THREE.Group();
          s.add(mesh(wp.geo, M(0xffffff, { map: tex(wp.cv), roughness: 0.4, metalness: 0.3, envMapIntensity: 1.1 }), 0, 0, 0));
          s.add(mesh(wp.geo, M(0xc4c9cd, { metalness: 0.8, roughness: 0.4, side: THREE.BackSide }), 0, 0, 0));
          s.position.set(a[2], 0.004 + i * 0.045, a[3]); s.rotation.y = a[1]; g.add(s);
        });
      },
      potongan: function (g) { // tumpukan keping potongan bungkus
        var core = mesh(new THREE.SphereGeometry(1, 24, 10, 0, PI * 2, 0, PI / 2), M(0x7d817e, { roughness: 0.85 }), 0, 0, 0);
        core.scale.set(0.4, 0.22, 0.4); g.add(core);
        g.add(mesh(shredGeo(200, 200 + (pileN++) * 13, function (r) {
          var rr = 0.5 * Math.sqrt(r()), a = r() * PI * 2, e = 1 - Math.pow(rr / 0.5, 2);
          return [rr * Math.cos(a), 0.3 * Math.pow(Math.max(0, e), 0.75) * (0.85 + r() * 0.3) + 0.012 + r() * 0.03, rr * Math.sin(a)];
        }), shredMat(), 0, 0, 0));
      },
      gunting: function (g) { // bilah ke arah +x, gagang plastik merah di -x; poros di titik asal, tiap lengan berputar di sekitar poros
        var grip = function () { return MP(0xc23b2e, { roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.7 }); };
        [1, -1].forEach(function (s, i) {
          var arm = new THREE.Group(), y0 = i === 0 ? 0.062 : 0.034, sh = new THREE.Shape();
          [[-0.06, 0.03], [0.0, 0.062], [0.3, 0.06], [0.72, 0.015], [0.745, 0.0], [0.3, -0.018], [0.0, -0.036], [-0.1, -0.048], [-0.19, -0.09], [-0.215, -0.11], [-0.235, -0.095], [-0.19, -0.04], [-0.12, 0.0]].forEach(function (p, k) {
            if (k) sh.lineTo(p[0], s * p[1]); else sh.moveTo(p[0], s * p[1]);
          });
          sh.closePath();
          var bg = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
          bg.rotateX(-PI / 2);
          arm.add(mesh(bg, STEEL(), 0, y0, 0));
          var ring = new THREE.Shape(), hole = new THREE.Path();
          ring.absellipse(-0.37, s * -0.115, 0.19, 0.105, 0, PI * 2, false, 0);
          hole.absellipse(-0.37, s * -0.115, 0.125, 0.056, 0, PI * 2, true, 0);
          ring.holes.push(hole);
          var rg = new THREE.ExtrudeGeometry(ring, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 32 });
          rg.rotateX(-PI / 2);
          arm.add(mesh(rg, grip(), 0, y0 - 0.01, 0));
          arm.rotation.y = s * 0.12; g.add(arm); g.userData["b" + (i + 1)] = arm;
        });
        g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 20), STEEL(), 0, 0.075, 0)); // baut poros
        var hd = mesh(new THREE.SphereGeometry(0.046, 16, 8, 0, PI * 2, 0, PI / 2), STEEL(), 0, 0.108, 0); hd.scale.y = 0.55; g.add(hd);
        var sl = mesh(new THREE.BoxGeometry(0.075, 0.008, 0.012), M(0x2a2f33, { metalness: 0.6, roughness: 0.5 }), 0, 0.133, 0); sl.rotation.y = 0.5; g.add(sl);
        g.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.016, 16), STEEL(), 0, 0.03, 0));
      },
      tongkat: function (g) { // berbaring
        var s = new THREE.Mesh(stickGeo(1.6, 0.055), woodMat()); s.rotation.z = -PI / 2; s.position.set(-0.8, 0.055, 0); g.add(s);
      },
      tongkatV: function (g) { // berdiri, ujung bawah di titik asal
        g.add(new THREE.Mesh(stickGeo(2.6, 0.055), woodMat()));
      },
      basah: function (g) {
        var wc = wetCanvases(), k, a, grp = new THREE.Group();
        if (!wetGeoC) wetGeoC = sheetGeo(WET_W, WET_D, 36, 36, WET_O);
        grp.rotation.y = 0.4; g.add(grp);
        grp.add(mesh(wetGeoC, MP(0xffffff, { map: tex(wc.c), roughnessMap: tex(wc.r), roughness: 1, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 1.2 }), 0, 0, 0));
        grp.add(mesh(wetGeoC, M(0xb8bdc2, { metalness: 0.75, roughness: 0.45, side: THREE.BackSide }), 0, 0, 0));
        var water = function (op) { return MP(0xe6f3fb, { roughness: 0.02, transparent: true, opacity: op, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.6, depthWrite: false }); };
        var ps = new THREE.Shape(), N = 28; // genangan air di bawah dan sekitar bungkus
        for (k = 0; k < N; k++) {
          a = k / N * PI * 2; var rr = 1 + (fbm(Math.cos(a) * 1.3 + 7, Math.sin(a) * 1.3, 2) - 0.5) * 0.7;
          if (k) ps.lineTo(Math.cos(a) * 0.55 * rr, Math.sin(a) * 0.42 * rr); else ps.moveTo(Math.cos(a) * 0.55 * rr, Math.sin(a) * 0.42 * rr);
        }
        ps.closePath();
        var pg = new THREE.ShapeGeometry(ps); pg.rotateX(-PI / 2);
        var pd = mesh(pg, water(0.5), 0, 0.006, 0); pd.renderOrder = 1; pd.userData.noCast = pd.userData.noRecv = true; g.add(pd);
        [[0.1, 0.12, 0.05], [-0.18, -0.06, 0.04], [0.28, -0.12, 0.035]].forEach(function (d) { // tetesan di atas bungkus
          var dr = mesh(new THREE.SphereGeometry(d[2], 14, 10), water(0.55), d[0], wetPoint(d[0], d[1]) + 0.004, -d[1]); dr.scale.y = 0.55; dr.renderOrder = 1; dr.userData.noCast = true; grp.add(dr);
        });
        [[0.62, 0.52, 0.04], [-0.5, 0.58, 0.032], [0.2, -0.5, 0.036]].forEach(function (d) { // tetesan di meja
          var dr = mesh(new THREE.SphereGeometry(d[2], 14, 10), water(0.55), d[0] * 0.8, 0.012, d[1] * 0.45); dr.scale.y = 0.55; dr.renderOrder = 1; dr.userData.noCast = true; g.add(dr);
        });
        [[0.05, 0.02, 0.05, 0xc78a3a], [-0.2, 0.08, 0.04, 0x8c5a2b], [0.18, -0.1, 0.035, 0xd09a4a], [-0.08, -0.12, 0.03, 0xa9692f]].forEach(function (d, i) { // remah gorengan
          var cr = crust(d[2], 1, 0.55, 1, i * 3.1, d[3]); cr.position.set(d[0], wetPoint(d[0], d[1]) + 0.012, -d[1]); grp.add(cr);
        });
        for (k = 0; k < 8; k++) { // serpihan cabai
          var fx = Math.cos(k * 2.4) * (0.08 + k * 0.025), fy = Math.sin(k * 2.4) * (0.06 + k * 0.015);
          var fl = crust(0.013, 1.3, 0.4, 0.9, k, 0xa3231b); fl.position.set(fx, wetPoint(fx, fy) + 0.006, -fy); fl.rotation.y = k; grp.add(fl);
        }
      },
      baterai: function (g) { // baterai bekas ukuran D: kaleng baja, selongsong berlabel, terminal, kerak bocoran
        var steel = function () { return M(0xb4b8bc, { metalness: 0.85, roughness: 0.38, envMapIntensity: 1.4 }); };
        g.add(mesh(lathe([[0.001, 0.004], [0.14, 0.004], [0.15, 0.0], [0.19, 0.0], [0.2, 0.012], [0.2, 0.05], [0.196, 0.054]], 40), steel(), 0, 0, 0));
        var sl = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.69, 48, 1, true), M(0xffffff, { map: tex(batteryCanvas()), roughness: 0.42, metalness: 0.1, envMapIntensity: 0.6 }), 0, 0.395, 0);
        sl.rotation.y = PI; g.add(sl); // bagian depan label menghadap kamera
        g.add(mesh(lathe([[0.2, 0.736], [0.2, 0.752], [0.188, 0.764], [0.17, 0.768]], 40), steel(), 0, 0, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 32), M(0xd8d6cc, { roughness: 0.6 }), 0, 0.774, 0));
        g.add(mesh(lathe([[0.001, 0.78], [0.07, 0.78], [0.078, 0.786], [0.078, 0.8], [0.072, 0.822], [0.05, 0.832], [0.001, 0.834]], 32), M(0xc9cdd0, { metalness: 0.9, roughness: 0.3, envMapIntensity: 1.5 }), 0, 0, 0));
        var c1 = crust(0.11, 1, 0.3, 1, 2.2, 0xe9e7da); c1.position.set(0.03, 0.792, 0.02); g.add(c1);
        var c2 = crust(0.06, 1, 0.35, 1, 6.5, 0x9db8a4); c2.position.set(-0.06, 0.794, 0.07); g.add(c2);
      },
      kaca: function (g) { // botol kaca mulut lebar, kaca tebal kehijauan, tutup logam emas, label kertas
        var geo = glassBottleGeo(), k;
        g.add(glassMesh(geo, 0xb3dcc4, 0.34, 2.6));
        var bt = glassMesh(new THREE.CylinderGeometry(0.33, 0.33, 0.075, 40), 0xb3dcc4, 0.4, 1.8); bt.position.y = 0.04; g.add(bt); // dasar kaca yang tebal
        var lc = ccv(768, 128, function (c, w, h) {
          c.fillStyle = "#efe5cc"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#b8321f"; c.fillRect(0, 0, w, 14); c.fillRect(0, h - 14, w, 14);
          c.fillStyle = "#b8321f"; c.beginPath(); c.arc(w / 2, h / 2, 40, 0, PI * 2); c.fill();
          c.fillStyle = "#efe5cc"; c.beginPath(); c.ellipse(w / 2, h / 2, 22, 11, -0.6, 0, PI * 2); c.fill();
          c.fillStyle = "rgba(60,50,40,0.5)";
          for (k = 0; k < 5; k++) { c.fillRect(w / 2 - 190 - k * 4, 34 + k * 14, 110 - k * 6, 5); c.fillRect(w / 2 + 90 + k * 4, 34 + k * 14, 100 - k * 8, 5); }
        });
        var lb = mesh(new THREE.CylinderGeometry(0.362, 0.362, 0.3, 48, 1, true, -0.8 * PI, 1.6 * PI), M(0xffffff, { map: tex(lc), roughness: 0.75, side: THREE.DoubleSide }), 0, 0.3, 0);
        g.add(lb);
        var gold = function () { return M(0xc9a227, { metalness: 0.9, roughness: 0.32, envMapIntensity: 1.5 }); };
        g.add(mesh(knurl(0.222, 0.125, 28, 0.04, 120), gold(), 0, 1.018, 0));
        g.add(mesh(lathe([[0.001, 1.103], [0.15, 1.103], [0.208, 1.098], [0.222, 1.083], [0.222, 1.06]], 48), gold(), 0, 0, 0));
      }
    };
    var CONTACT = { botol: [0.36, 0.36, 0], bungkus: [0.62, 0.46, 0], gunting: [0.62, 0.3, 0.1], tongkat: [0.95, 0.16, 0], basah: [0.66, 0.5, 0], baterai: [0.3, 0.3, 0], kaca: [0.46, 0.46, 0] };
    function buildObj(key, hitR, hitY, contact) {
      var g = new THREE.Group(); MODEL[key](g);
      if (contact && CONTACT[key]) g.add(contactShadow(CONTACT[key][0], CONTACT[key][1], CONTACT[key][2]));
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noRecv; } });
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
      var g = buildObj(m.k, 0.8, 0.5, true);
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


