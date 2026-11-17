window.initPilah = function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var CATS = { org: "Organik", an: "Anorganik", res: "Residu", b3: "B3" };
  var FALLBACK = { "--c-org": "#2E7D4F", "--on-org": "#FFFFFF", "--c-an": "#E0AE00", "--on-an": "#1B1500", "--c-res": "#59656E", "--on-res": "#FFFFFF", "--c-b3": "#C23B2E", "--on-b3": "#FFFFFF", "--soft": "#E3EADF", "--bg": "#F0F3EE" };
  var ITEMS = [
    { n: "Sisa nasi dan lauk", h: "Dari kantin", c: "org", m: "food", t: "Sisa makanan basah mudah membusuk, jadi masuk organik dan bisa dikomposkan." },
    { n: "Kulit pisang", h: "Sisa buah", c: "org", m: "banana", t: "Kulit buah termasuk organik dan terurai menjadi kompos." },
    { n: "Botol air mineral", h: "Plastik PET, sudah kosong", c: "an", m: "pet", t: "Botol PET bersih punya nilai jual. Bilas dulu dan lepas tutup serta labelnya." },
    { n: "Kardus paket", h: "Bekas bungkus belanja online", c: "an", m: "box", t: "Kardus kering dan bersih bisa disetor. Lipat supaya hemat tempat." },
    { n: "Kertas fotokopi bekas", h: "Tugas atau catatan lama", c: "an", m: "paper", t: "Kertas bersih yang kering termasuk anorganik dan laku didaur ulang." },
    { n: "Kaleng minuman", h: "Aluminium", c: "an", m: "can", t: "Kaleng aluminium termasuk yang bernilai tinggi. Kosongkan dan remukkan." },
    { n: "Gelas plastik kopi", h: "Sudah dibilas", c: "an", m: "cup", t: "Gelas plastik yang sudah dibilas bisa disetor. Yang masih berisi sisa minuman sebaiknya dibilas dulu." },
    { n: "Baterai bekas", h: "Dari remote atau mouse", c: "b3", m: "battery", t: "Baterai mengandung bahan berbahaya. Kumpulkan terpisah di tempat khusus B3." },
    { n: "Lampu neon rusak", h: "Dari kos atau ruang kelas", c: "b3", m: "lamp", t: "Lampu mengandung merkuri, jadi termasuk B3. Jangan dipecahkan atau dibuang bersama sampah biasa." },
    { n: "Tisu bekas pakai", h: "Kotor dan lembap", c: "res", m: "tissue", t: "Tisu bekas sudah kotor dan tidak bisa didaur ulang, jadi masuk residu." },
    { n: "Kemasan sachet camilan", h: "Plastik berlapis", c: "res", m: "sachet", t: "Kemasan berlapis sulit didaur ulang sehingga masuk residu. Kurangi dengan membeli ukuran besar." },
    { n: "Kotak makan styrofoam", h: "Bekas makanan", c: "res", m: "foam", t: "Styrofoam berminyak sulit didaur ulang. Lebih baik bawa wadah makan sendiri." }
  ];
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  function cssVar(n) {
    var v = "";
    try { v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); } catch (e) {}
    return v || FALLBACK[n] || "#888888";
  }
  function webglOk() {
    try {
      var c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }

  /* ================= tampilan 3D ================= */
  function build3D() {
    var wrap = $("stage"), canvas = $("scene");
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a90, 0.55));
    var sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.position.set(4, 10, 6); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    var sc = sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    var floorMat = new THREE.MeshStandardMaterial({ color: 0xe3eadf, roughness: 1 });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    var padMat = new THREE.MeshBasicMaterial({ color: 0x59656e, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    var pad = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.05, 48), padMat);
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; scene.add(pad);

    /* ---- tong ---- */
    var bins = {};
    function roundRect(ctx, x, y, w, h, r) {
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    Object.keys(CATS).forEach(function (c) {
      var g = new THREE.Group();
      var bodyMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.55 });
      var rimMat = new THREE.MeshStandardMaterial({ color: 0x1f5a37, roughness: 0.5 });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.8, 1.8, 36), bodyMat);
      body.position.y = 0.9; body.castShadow = true; body.receiveShadow = true;
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.075, 12, 36), rimMat);
      rim.rotation.x = Math.PI / 2; rim.position.y = 1.8; rim.castShadow = true;
      var hole = new THREE.Mesh(new THREE.CircleGeometry(0.9, 36), new THREE.MeshBasicMaterial({ color: 0x0a0f0c }));
      hole.rotation.x = -Math.PI / 2; hole.position.y = 1.815;
      var ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide });
      var ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 48), ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
      /* label: potongan selimut tabung yang menempel di badan tong (bukan sprite datar),
         jadi tidak pernah tertembus badan tong dan ikut melengkung mengikuti bentuknya */
      var cv = document.createElement("canvas"); cv.width = 512; cv.height = 176;
      var tex = new THREE.CanvasTexture(cv);
      if (renderer.capabilities && renderer.capabilities.getMaxAnisotropy) tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      var LBL_Y = 0.95, LBL_H = 0.58, LBL_ARC = 1.9; // tinggi, dan lebar busur (radian)
      var rAt = function (y) { return 0.8 + 0.15 * (y / 1.8) + 0.02; }; // jari-jari badan di ketinggian y + sedikit jarak
      var lbl = new THREE.Mesh(
        new THREE.CylinderGeometry(rAt(LBL_Y + LBL_H / 2), rAt(LBL_Y - LBL_H / 2), LBL_H, 40, 1, true, -LBL_ARC / 2, LBL_ARC),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      );
      lbl.position.y = LBL_Y;
      g.add(body, rim, hole, ring, lbl);
      scene.add(g);
      bins[c] = { g: g, body: bodyMat, rim: rimMat, ring: ringMat, cv: cv, tex: tex, h: 0, want: 0, bump: 0, flashUntil: 0 };
    });
    function drawLabel(c) {
      var b = bins[c], ctx = b.cv.getContext("2d"), W = b.cv.width, H = b.cv.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = cssVar("--c-" + c); roundRect(ctx, 4, 8, W - 8, H - 16, 22); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = cssVar("--edge") || "#111"; ctx.stroke();
      ctx.fillStyle = cssVar("--on-" + c);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      var txt = CATS[c].toUpperCase(), size = 76, maxW = W - 120; // sisakan ruang kiri/kanan: tepi label tampak menyempit saat melengkung
      do {
        ctx.font = '800 ' + size + 'px "Bricolage Grotesque", "Trebuchet MS", Arial, sans-serif';
        size -= 2;
      } while (ctx.measureText(txt).width > maxW && size > 20);
      ctx.fillText(txt, W / 2, H / 2 + 3);
      b.tex.needsUpdate = true;
    }
    function applyTheme() {
      Object.keys(bins).forEach(function (c) {
        var col = cssVar("--c-" + c), b = bins[c];
        b.body.color.set(col);
        b.rim.color.set(col); b.rim.color.multiplyScalar(0.72);
        b.ring.color.set(col);
        drawLabel(c);
      });
      floorMat.color.set(cssVar("--soft"));
    }
    applyTheme();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyTheme);
    try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme); } catch (e) {}
    try { new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] }); } catch (e) {}

    /* ---- benda ---- */
    /* Lingkungan pantulan (langit, lantai, softbox) dibuat sekali lewat PMREM, hanya dipakai oleh benda,
       supaya logam dan plastik punya kilau yang meyakinkan. Kalau gagal, logam dilemahkan agar tidak tampil hitam. */
    var ENV = null;
    try {
      var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
      var gc = document.createElement("canvas"); gc.width = 8; gc.height = 256;
      var gx = gc.getContext("2d"), gr = gx.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.45, "#dfe6f0"); gr.addColorStop(0.5, "#b9c2bd"); gr.addColorStop(1, "#6f7380");
      gx.fillStyle = gr; gx.fillRect(0, 0, 8, 256);
      es.add(new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), side: THREE.BackSide })));
      [[0, 14, 4, 16, 5], [-14, 6, 6, 5, 12], [14, 5, -2, 5, 12]].forEach(function (s) {
        var pl = new THREE.Mesh(new THREE.PlaneGeometry(s[3], s[4]), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
        pl.position.set(s[0], s[1], s[2]); pl.lookAt(0, 0, 0); es.add(pl);
      });
      ENV = pm.fromScene(es, 0.03).texture; pm.dispose();
    } catch (e) { ENV = null; }
    var MAXA = 4;
    try { MAXA = Math.min(8, renderer.capabilities.getMaxAnisotropy()); } catch (e) { }

    function M(color, o) {
      var p = Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {});
      if (ENV) { p.envMap = ENV; if (p.envMapIntensity === undefined) p.envMapIntensity = 0.5; }
      else if (p.metalness > 0.3) p.metalness *= 0.4;
      return new THREE.MeshStandardMaterial(p);
    }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function nz(x, y, z) { return Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 0.5 + Math.sin(x * 5.1 - z * 9.3 + y * 3.7) * 0.5; }
    function tex(w, h, draw, rx, ry) { // tekstur dari kanvas (label, kemasan, serat)
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      draw(cv.getContext("2d"), w, h);
      var t = new THREE.CanvasTexture(cv); t.anisotropy = MAXA;
      if (rx) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry || rx); }
      return t;
    }
    function lathe(pts, mat, seg) { // benda putar dari profil [jari-jari, tinggi]
      mat.side = THREE.DoubleSide;
      return new THREE.Mesh(new THREE.LatheGeometry(pts.map(function (a) { return new THREE.Vector2(a[0], a[1]); }), seg || 40), mat);
    }
    function wrapMesh(rTop, rBot, y0, y1, map, o, arc) { // selimut tabung bergambar; bagian tengah gambar menghadap depan
      var a = arc || Math.PI * 2;
      var m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, y1 - y0, 56, 1, true, -a / 2, a), M(0xffffff, Object.assign({ map: map, roughness: 0.5 }, o || {})));
      m.position.y = (y0 + y1) / 2; return m;
    }
    function grid(nu, nt, fn) { // permukaan dari kisi: fn(u dari -1 ke 1, t dari 0 ke 1) -> [x, y, z]
      var pos = [], uv = [], idx = [], i, j, p;
      for (j = 0; j <= nt; j++) for (i = 0; i <= nu; i++) { var u = i / nu * 2 - 1, t = j / nt; p = fn(u, t); pos.push(p[0], p[1], p[2]); uv.push((u + 1) / 2, t); }
      for (j = 0; j < nt; j++) for (i = 0; i < nu; i++) { var a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals(); return geo;
    }
    function vcol(geo, fn) { // warna per titik: fn(posisi, warna)
      var p = geo.attributes.position, c = [], v = new THREE.Vector3(), k = new THREE.Color();
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); fn(v, k); c.push(k.r, k.g, k.b); }
      geo.setAttribute("color", new THREE.Float32BufferAttribute(c, 3)); return geo;
    }
    function lump(geo, amp, freq) { // benjolan halus pada bola
      var p = geo.attributes.position, v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + amp * nz(v.x * freq, v.y * freq, v.z * freq)); p.setXYZ(i, v.x, v.y, v.z); }
      geo.computeVertexNormals(); return geo;
    }
    function grains(g, n, mat, place) { // butiran kecil (nasi, remah) dalam satu InstancedMesh
      var im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), mat, n), d = new THREE.Object3D();
      for (var k = 0; k < n; k++) {
        var q = place(k); d.position.set(q[0], q[1], q[2]); d.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); d.scale.set(q[3], q[4], q[5]);
        d.updateMatrix(); im.setMatrixAt(k, d.matrix);
      }
      im.instanceMatrix.needsUpdate = true; g.add(im); return im;
    }
    function rrect(path, w, d, r) { // persegi bersudut bulat, titik tengah di (0,0)
      var x = -w / 2, y = -d / 2;
      path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
      path.lineTo(x + w, y + d - r); path.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
      path.lineTo(x + r, y + d); path.quadraticCurveTo(x, y + d, x, y + d - r);
      path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y); return path;
    }
    function card(c, w, h) { // karton bergelombang
      var i; c.fillStyle = "#b98a56"; c.fillRect(0, 0, w, h);
      for (i = 0; i < 700; i++) { c.fillStyle = "rgba(" + (Math.random() < 0.5 ? "90,60,25" : "225,190,140") + "," + rnd(0.03, 0.09).toFixed(3) + ")"; c.fillRect(Math.random() * w, Math.random() * h, rnd(8, 60), rnd(1, 3)); }
      for (i = 0; i < h; i += 5) { c.fillStyle = "rgba(80,50,20,0.05)"; c.fillRect(0, i, w, 1); }
    }
    function arrows(c, x, y) { c.fillStyle = "#3a2a18"; [0, 46].forEach(function (d) { c.beginPath(); c.moveTo(x + d, y - 26); c.lineTo(x + d + 16, y - 2); c.lineTo(x + d + 6, y - 2); c.lineTo(x + d + 6, y + 26); c.lineTo(x + d - 6, y + 26); c.lineTo(x + d - 6, y - 2); c.lineTo(x + d - 16, y - 2); c.closePath(); c.fill(); }); }
    var CHIP = "#f2c230";

    var MODELS = {
      /* piring berisi sisa nasi, ayam goreng, sambal, timun, dan selada */
      food: function (g) {
        var plate = M(0xf4f2ec, { roughness: 0.25, envMapIntensity: 0.9 });
        g.add(lathe([[0, 0], [0.3, 0], [0.5, 0.02], [0.7, 0.085], [0.78, 0.115], [0.8, 0.13], [0.77, 0.135], [0.68, 0.11], [0.5, 0.055], [0.3, 0.045], [0, 0.045]], plate, 48));
        var rim = mesh(new THREE.TorusGeometry(0.69, 0.012, 6, 48), M(0x2b5fa8, { roughness: 0.3 }), 0, 0.104, 0); rim.rotation.x = Math.PI / 2; g.add(rim);
        var rm = mesh(lump(new THREE.SphereGeometry(0.4, 32, 20), 0.05, 6), M(0xfffdf4, { roughness: 0.85 }), -0.15, 0.05, 0.05); rm.scale.set(1, 0.55, 1); g.add(rm);
        grains(g, 160, M(0xfffbe8, { roughness: 0.7 }), function () {
          var th = rnd(0, 6.283), ph = Math.acos(rnd(0.12, 1)), s = rnd(0.93, 1.02);
          return [-0.15 + 0.4 * s * Math.sin(ph) * Math.cos(th), 0.05 + 0.22 * s * Math.cos(ph), 0.05 + 0.4 * s * Math.sin(ph) * Math.sin(th), 0.05, 0.021, 0.021];
        });
        var ck = new THREE.Group(); ck.position.set(0.36, 0.1, 0.22); ck.rotation.y = 0.5; ck.rotation.z = -0.08;
        var meat = mesh(lump(new THREE.SphereGeometry(0.3, 28, 18), 0.09, 8), M(0xa65f24, { roughness: 0.65 }), 0, 0.08, 0); meat.scale.set(1.1, 0.62, 0.78); ck.add(meat);
        var crisp = mesh(lump(new THREE.SphereGeometry(0.2, 24, 14), 0.14, 11), M(0x7e4217, { roughness: 0.8 }), -0.08, 0.14, 0.02); crisp.scale.set(1, 0.5, 0.8); ck.add(crisp);
        var bone = mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 10), M(0xf1e6cf, { roughness: 0.6 }), 0.42, 0.07, 0); bone.rotation.z = Math.PI / 2 + 0.1; ck.add(bone);
        ck.add(mesh(new THREE.SphereGeometry(0.058, 10, 8), M(0xf1e6cf, { roughness: 0.6 }), 0.56, 0.09, 0.03));
        ck.add(mesh(new THREE.SphereGeometry(0.058, 10, 8), M(0xf1e6cf, { roughness: 0.6 }), 0.56, 0.09, -0.03));
        g.add(ck);
        var sb = mesh(new THREE.SphereGeometry(0.13, 16, 10), M(0xc62a1a, { roughness: 0.35 }), -0.46, 0.065, -0.28); sb.scale.set(1.2, 0.22, 0.9); g.add(sb);
        [[0.0, -0.46, 0.2], [0.26, -0.38, -0.3]].forEach(function (c, i) {
          var sl = new THREE.Group(); sl.position.set(c[0], 0.075 + i * 0.012, c[1]); sl.rotation.set(0.15 * (i ? -1 : 1), 0, 0.1);
          sl.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), M(0x3f8f3a, { roughness: 0.5 }), 0, 0, 0));
          sl.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.034, 24), M(0xd3e8b4, { roughness: 0.5 }), 0, 0, 0));
          g.add(sl);
        });
        var lf = new THREE.PlaneGeometry(0.34, 0.28, 10, 8), lp = lf.attributes.position;
        for (var i = 0; i < lp.count; i++) lp.setZ(i, 0.025 * Math.sin(lp.getX(i) * 20) + 0.02 * Math.sin(lp.getY(i) * 17));
        lf.computeVertexNormals();
        var leaf = mesh(lf, M(0x6cbf4a, { roughness: 0.5, side: THREE.DoubleSide }), -0.36, 0.1, 0.42); leaf.rotation.set(-Math.PI / 2 + 0.2, 0, 0.5); g.add(leaf);
      },

      /* kulit pisang: empat helai lebar yang terkulai dari pangkal bertangkai; satu helai terbalik (sisi kuning di atas) */
      banana: function (g) {
        function blob(c, x, y, r, col) { var rg = c.createRadialGradient(x, y, 2, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, "rgba(90,55,15,0)"); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2); }
        // kanvas: sumbu x = melintang helai, sumbu y = memanjang (atas = ujung, bawah = pangkal)
        var outer = tex(128, 512, function (c, w, h) {
          var gr = c.createLinearGradient(0, h, 0, 0);
          gr.addColorStop(0, "#a9b03a"); gr.addColorStop(0.1, "#e2c02a"); gr.addColorStop(0.5, "#f3cd2b"); gr.addColorStop(0.84, "#e0ad1c"); gr.addColorStop(0.93, "#7a5018"); gr.addColorStop(1, "#2e1d0c");
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          c.fillStyle = "rgba(150,100,10,0.4)"; [0, w / 2, w - 3].forEach(function (x) { c.fillRect(x - 1.5, 0, 3.5, h); });
          var i; for (i = 0; i < 80; i++) { c.fillStyle = "rgba(70,40,10," + rnd(0.3, 0.8).toFixed(2) + ")"; c.beginPath(); c.arc(Math.random() * w, rnd(40, h - 60), rnd(1, 3.2), 0, 6.283); c.fill(); }
          for (i = 0; i < 3; i++) blob(c, rnd(14, w - 14), rnd(120, h - 120), rnd(18, 34), "rgba(95,58,15,0.65)");
        });
        var inner = tex(128, 512, function (c, w, h) {
          c.fillStyle = "#f1e8c0"; c.fillRect(0, 0, w, h);
          var i; for (i = 0; i < 60; i++) { c.fillStyle = "rgba(190,175,110," + rnd(0.15, 0.4).toFixed(2) + ")"; c.fillRect(Math.random() * w, 0, rnd(1, 2.5), h); }
          var eg = c.createLinearGradient(0, 0, w, 0); eg.addColorStop(0, "rgba(200,180,100,0.6)"); eg.addColorStop(0.18, "rgba(200,180,100,0)"); eg.addColorStop(0.82, "rgba(200,180,100,0)"); eg.addColorStop(1, "rgba(200,180,100,0.6)");
          c.fillStyle = eg; c.fillRect(0, 0, w, h);
          for (i = 0; i < 4; i++) blob(c, rnd(14, w - 14), rnd(80, h - 60), rnd(16, 30), "rgba(120,80,30,0.55)");
          var tg = c.createLinearGradient(0, 0, 0, 70); tg.addColorStop(0, "rgba(60,38,14,0.9)"); tg.addColorStop(1, "rgba(60,38,14,0)"); c.fillStyle = tg; c.fillRect(0, 0, w, 70);
        });
        var mo = M(0xffffff, { map: outer, roughness: 0.5, side: THREE.DoubleSide }), mi = M(0xffffff, { map: inner, roughness: 0.85, side: THREE.DoubleSide });
        function strip(s, isInner) {
          var a = s[0], len = s[1], wid = s[2], flip = s[3], sway = s[4], dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
          return grid(14, 26, function (u, t) {
            var r = 0.08 + t * len;
            var w = Math.max(0.002, wid * Math.pow(Math.max(0, Math.sin(Math.PI * (0.12 + 0.88 * t))), 0.75)) * (isInner ? 0.8 : 1);
            var side = u * w + sway * Math.sin(Math.PI * t * 1.2);
            var base = 0.025 + 0.2 * Math.pow(1 - t, 1.5) + 0.04 * Math.sin(Math.PI * t);
            var y = base + (flip ? 0.5 * w * (1 - u * u) + (isInner ? -0.016 : 0) : 0.6 * w * u * u + (isInner ? 0.016 : 0));
            return [dx * r + sx * side, y, dz * r + sz * side];
          });
        }
        [[0.2, 0.8, 0.24, false, 0.08], [1.75, 0.7, 0.22, true, -0.1], [3.4, 0.78, 0.25, false, -0.06], [4.85, 0.66, 0.2, false, 0.1]].forEach(function (s) {
          g.add(mesh(strip(s, false), mo)); g.add(mesh(strip(s, true), mi));
        });
        var jn = mesh(lump(new THREE.SphereGeometry(0.13, 20, 14), 0.12, 9), M(0xc9bd45, { roughness: 0.7 }), 0, 0.17, 0); jn.scale.y = 0.75; g.add(jn);
        var stk = new THREE.Group(); stk.position.set(0, 0.2, 0); stk.rotation.y = -5.66; g.add(stk);
        var cy = mesh(new THREE.CylinderGeometry(0.05, 0.068, 0.36, 12), M(0x7a7336, { roughness: 0.8 }), 0.18, 0.03, 0); cy.rotation.z = -(Math.PI / 2 - 0.25); stk.add(cy);
        var ce = mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.022, 12), M(0x3d2a14, { roughness: 0.9 }), 0.354, 0.074, 0); ce.rotation.z = -(Math.PI / 2 - 0.25); stk.add(ce);
      },

      /* botol air mineral PET: rusuk, bahu, leher, label, tutup bergerigi */
      pet: function (g) {
        var R = 0.26, pts = [[0, 0.07], [0.1, 0.062], [0.17, 0.012], [0.2, 0], [0.235, 0.03], [R, 0.11]], k, s;
        for (k = 0; k <= 24; k++) pts.push([R - 0.011 * (0.5 - 0.5 * Math.cos(k * Math.PI / 2)), 0.12 + k * 0.0125]);
        pts.push([R, 0.42], [R, 0.96]);
        for (k = 1; k <= 10; k++) { s = k / 10; pts.push([0.105 + (R - 0.105) * Math.pow(1 - s, 1.7), 0.96 + 0.24 * s]); }
        pts.push([0.105, 1.215], [0.136, 1.222], [0.136, 1.244], [0.105, 1.252], [0.105, 1.3]);
        g.add(lathe(pts, M(0xd6f0fb, { transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false, envMapIntensity: 1.3 }), 48));
        var lb = tex(512, 200, function (c, w, h) {
          var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#1673b8"); gr.addColorStop(1, "#37b0ec");
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          c.fillStyle = "rgba(255,255,255,0.35)"; c.beginPath(); c.moveTo(0, h * 0.78);
          for (var x = 0; x <= w; x += 8) c.lineTo(x, h * 0.78 + Math.sin(x / 38) * 9); c.lineTo(w, h); c.lineTo(0, h); c.fill();
          c.fillStyle = "#fff"; c.beginPath(); c.moveTo(w / 2, 22); c.bezierCurveTo(w / 2 + 34, 70, w / 2 + 30, 92, w / 2, 94); c.bezierCurveTo(w / 2 - 30, 92, w / 2 - 34, 70, w / 2, 22); c.fill();
          c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "800 46px Arial, sans-serif"; c.fillText("AIR MINERAL", w / 2, 142);
          c.font = "600 24px Arial, sans-serif"; c.fillText("600 ml", w / 2, 176);
        });
        g.add(wrapMesh(R + 0.004, R + 0.004, 0.46, 0.94, lb, { roughness: 0.4 }));
        var sh = new THREE.Shape(), N = 36, a, rr;
        for (k = 0; k < N * 2; k++) { a = k / (N * 2) * Math.PI * 2; rr = k % 2 ? 0.118 : 0.128; if (k) sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else sh.moveTo(rr, 0); }
        var cap = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.085, bevelEnabled: false }), M(0x1e66c8, { roughness: 0.35 }), 0, 1.262, 0); cap.rotation.x = -Math.PI / 2; g.add(cap);
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.026, 28), M(0x1850a0, { roughness: 0.4 }), 0, 1.252, 0));
      },

      /* kardus paket: karton bergelombang, lakban, label pengiriman, tanda panah */
      box: function (g) {
        var side = function (draw) { return new THREE.MeshStandardMaterial({ map: tex(440, 320, function (c, w, h) { card(c, w, h); draw(c, w, h); }), roughness: 0.95, envMap: ENV || null, envMapIntensity: 0.3 }); };
        var tape = function (c, x, y, w, h) { c.fillStyle = "rgba(214,176,118,0.9)"; c.fillRect(x, y, w, h); c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(x, y + 4, w, 4); };
        var front = side(function (c, w, h) {
          c.fillStyle = "#f7f7f4"; c.fillRect(56, 46, 190, 150); c.strokeStyle = "#999"; c.lineWidth = 2; c.strokeRect(56, 46, 190, 150);
          c.fillStyle = "#222"; for (var i = 0; i < 38; i++) c.fillRect(70 + i * 4.4, 60, rnd(1.5, 3.5), 40);
          c.fillStyle = "#666"; [118, 134, 150, 166].forEach(function (y, k) { c.fillRect(70, y, 130 - k * 14, 5); });
          c.fillStyle = "#c0392b"; c.font = "800 34px Arial, sans-serif"; c.fillText("FRAGILE", 262, 120);
          arrows(c, 330, 230); tape(c, 0, 0, w, 0);
        });
        var back = side(function (c) { arrows(c, 220, 170); });
        var end = side(function (c, w, h) { tape(c, w / 2 - 28, 0, 56, 90); });
        var top = new THREE.MeshStandardMaterial({ map: tex(440, 360, function (c, w, h) {
          card(c, w, h); c.fillStyle = "rgba(60,35,10,0.55)"; c.fillRect(0, h / 2 - 1, w, 2);
          tape(c, 0, h / 2 - 28, w, 56); c.fillStyle = "rgba(120,90,50,0.5)"; c.fillRect(w - 40, h / 2 - 28, 3, 56);
        }), roughness: 0.9, envMap: ENV || null, envMapIntensity: 0.4 });
        var bot = side(function () { });
        var bx = mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), [end, end.clone(), top, bot, front, back], 0, 0.4, 0); g.add(bx);
      },

      /* tumpukan kertas HVS bekas: tepi berlapis, lembar atas bertulisan, sudut melengkung */
      paper: function (g) {
        var edge = new THREE.MeshStandardMaterial({ map: tex(256, 32, function (c, w, h) { c.fillStyle = "#fbfbf8"; c.fillRect(0, 0, w, h); for (var y = 0; y < h; y += 3) { c.fillStyle = "rgba(120,125,130," + rnd(0.15, 0.35).toFixed(2) + ")"; c.fillRect(0, y, w, 1); } }), roughness: 0.95 });
        var flat = M(0xfbfbf8, { roughness: 0.95 });
        g.add(mesh(new THREE.BoxGeometry(1.0, 0.13, 0.72), [edge, edge, flat, flat, edge, edge], 0.0, 0.065, 0));
        [[0.03, 0.04, 0.136, 0.7], [-0.02, -0.05, 0.142, 0.8]].forEach(function (s) {
          var sh = mesh(new THREE.BoxGeometry(1.0, 0.005, 0.72), flat, s[0], s[2], s[1]); sh.rotation.y = s[3] * 0.08; g.add(sh);
        });
        var print = tex(512, 364, function (c, w, h) {
          c.fillStyle = "#fdfdfb"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#2b2f36"; c.font = "800 28px Arial, sans-serif"; c.fillText("TUGAS KELOMPOK 3", 40, 52);
          c.fillStyle = "#6b727b"; for (var y = 84, i = 0; y < h - 30; y += 17, i++) c.fillRect(40, y, rnd(250, 430) - (i % 5 === 4 ? 160 : 0), 5);
          c.strokeStyle = "#2457c5"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(60, 270);
          for (var x = 60; x < 300; x += 12) c.lineTo(x, 270 + Math.sin(x / 5) * 8 - (x % 36 < 12 ? 10 : 0)); c.stroke();
          c.strokeStyle = "#c0392b"; c.lineWidth = 3; c.beginPath(); c.arc(440, 56, 26, 0, 6.283); c.stroke();
          c.fillStyle = "#c0392b"; c.font = "800 26px Arial, sans-serif"; c.textAlign = "center"; c.fillText("85", 440, 66);
          c.strokeStyle = "rgba(120,80,40,0.35)"; c.lineWidth = 6; c.beginPath(); c.arc(380, 260, 34, 0, 6.283); c.stroke();
          c.fillStyle = "#b8bcc2"; c.beginPath(); c.arc(22, 22, 5, 0, 6.283); c.fill();
        });
        var top = grid(14, 10, function (u, t) {
          var x = u * 0.5, z = (0.5 - t) * 0.72, c = Math.max(0, x * 0.9 + z * 0.9 - 0.38);
          return [x, 0.146 + 0.8 * c * c + 0.004 * Math.sin(x * 9), z];
        });
        var ts = mesh(top, M(0xffffff, { map: print, roughness: 0.95, side: THREE.DoubleSide }), 0, 0, 0); ts.rotation.y = -0.05; g.add(ts);
      },

      /* kaleng minuman: dasar cekung, badan bercetak, bahu, leher, tutup dengan cincin tarik */
      can: function (g) {
        var al = M(0xd5d9dd, { metalness: 0.9, roughness: 0.25, envMapIntensity: 0.9 });
        g.add(lathe([[0, 0.06], [0.12, 0.055], [0.2, 0.025], [0.245, 0], [0.275, 0.012], [0.3, 0.045], [0.335, 0.09], [0.34, 0.1]], al));
        var pr = tex(1024, 352, function (c, w, h) {
          var gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#d3182f"); gr.addColorStop(1, "#98101f");
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          c.fillStyle = "rgba(255,255,255,0.10)"; for (var i = 0; i < 40; i++) { c.beginPath(); c.arc(Math.random() * w, Math.random() * h, rnd(4, 14), 0, 6.283); c.fill(); }
          c.strokeStyle = "#fff"; c.lineWidth = 34; c.lineCap = "round"; c.beginPath(); c.moveTo(150, h * 0.8); c.bezierCurveTo(330, h * 0.5, 700, h * 1.15, 880, h * 0.62); c.stroke();
          c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "italic 900 150px Arial, sans-serif"; c.fillText("FIZZ", w / 2, h * 0.52);
          c.font = "700 30px Arial, sans-serif"; c.fillText("MINUMAN BERKARBONASI  330 ml", w / 2, h * 0.9);
        });
        g.add(wrapMesh(0.34, 0.34, 0.1, 0.82, pr, { roughness: 0.32, metalness: 0.45, envMapIntensity: 0.8 }));
        g.add(lathe([[0.34, 0.82], [0.335, 0.87], [0.315, 0.95], [0.29, 1.01], [0.272, 1.045], [0.27, 1.07]], M(0xb9142a, { metalness: 0.6, roughness: 0.3, envMapIntensity: 0.8 })));
        g.add(lathe([[0.27, 1.07], [0.272, 1.09], [0.285, 1.1], [0.29, 1.112], [0.285, 1.122], [0.27, 1.122], [0.25, 1.1], [0.238, 1.09], [0.22, 1.1], [0.2, 1.105], [0, 1.105]], al));
        var ts = new THREE.Shape(); ts.absellipse(0, 0, 0.14, 0.06, 0, Math.PI * 2, false);
        var th = new THREE.Path(); th.absellipse(0.075, 0, 0.05, 0.028, 0, Math.PI * 2, true); ts.holes.push(th);
        var tab = mesh(new THREE.ExtrudeGeometry(ts, { depth: 0.012, bevelEnabled: false }), al, -0.04, 1.108, 0); tab.rotation.x = -Math.PI / 2; g.add(tab);
        var slot = mesh(new THREE.CircleGeometry(0.06, 16), M(0x7d8388, { metalness: 0.5, roughness: 0.5 }), 0.1, 1.107, 0); slot.rotation.x = -Math.PI / 2; slot.scale.y = 0.55; g.add(slot);
        g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.02, 10), M(0xb0b5ba, { metalness: 0.8, roughness: 0.3 }), -0.1, 1.122, 0));
      },

      /* gelas kopi plastik bening: tutup kubah, sedotan bergaris, label bergambar biji kopi */
      cup: function (g) {
        var cl = M(0xe8f4f8, { transparent: true, opacity: 0.34, roughness: 0.06, depthWrite: false, envMapIntensity: 1.2 });
        g.add(lathe([[0, 0.02], [0.17, 0], [0.19, 0], [0.2, 0.03], [0.33, 0.93], [0.345, 0.94], [0.345, 0.975]], cl, 48));
        var lip = mesh(new THREE.TorusGeometry(0.34, 0.022, 8, 48), M(0xeef6f9, { transparent: true, opacity: 0.6, roughness: 0.1, depthWrite: false }), 0, 0.965, 0); lip.rotation.x = Math.PI / 2; g.add(lip);
        var rs = mesh(new THREE.CircleGeometry(0.17, 24), M(0x7a5230, { transparent: true, opacity: 0.35, roughness: 0.4, depthWrite: false }), 0, 0.034, 0); rs.rotation.x = -Math.PI / 2; g.add(rs);
        var lg = tex(256, 150, function (c, w, h) {
          c.fillStyle = "#1f6b45"; c.fillRect(0, 0, w, h);
          c.fillStyle = "#fff"; c.beginPath(); c.ellipse(w / 2, 52, 26, 34, 0.5, 0, 6.283); c.fill();
          c.strokeStyle = "#1f6b45"; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2 - 16, 78); c.quadraticCurveTo(w / 2, 52, w / 2 + 16, 26); c.stroke();
          c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "800 34px Arial, sans-serif"; c.fillText("KOPI", w / 2, 118);
        });
        g.add(wrapMesh(0.308, 0.25, 0.35, 0.75, lg, { roughness: 0.5 }, 2.5));
        g.add(lathe([[0.36, 0.94], [0.36, 0.985], [0.345, 1.0], [0.3, 1.0], [0.28, 1.04], [0.22, 1.12], [0.12, 1.165], [0, 1.175]], M(0xeef6f9, { transparent: true, opacity: 0.5, roughness: 0.08, depthWrite: false, envMapIntensity: 1.2 }), 48));
        var st = tex(16, 64, function (c, w, h) { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.fillStyle = "#1f6b45"; for (var y = 0; y < h; y += 16) c.fillRect(0, y, w, 8); }, 1, 10);
        var sw = mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.3, 10), M(0xffffff, { map: st, roughness: 0.4 }), 0.07, 0.82, 0); sw.rotation.z = -0.1; g.add(sw);
      },

      /* baterai AA: sleeve hitam dan tembaga, kutub positif, rembesan kerak di ujung */
      battery: function (g) {
        var steel = M(0xd0d3d6, { metalness: 0.9, roughness: 0.25, envMapIntensity: 0.9 });
        g.add(lathe([[0, 0], [0.19, 0], [0.2, 0.012], [0.2, 0.03]], steel));
        var bt = tex(512, 512, function (c, w, h) {
          var gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, "#111"); gr.addColorStop(0.5, "#2a2c30"); gr.addColorStop(1, "#111");
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          var cg = c.createLinearGradient(0, 0, w, 0); cg.addColorStop(0, "#9a5a1c"); cg.addColorStop(0.5, "#e0a04a"); cg.addColorStop(1, "#9a5a1c");
          c.fillStyle = cg; c.beginPath(); c.moveTo(0, h * 0.66); c.lineTo(w, h * 0.54); c.lineTo(w, h); c.lineTo(0, h); c.fill();
          c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "800 120px Arial, sans-serif"; c.fillText("AA", w / 2, h * 0.34);
          c.font = "700 34px Arial, sans-serif"; c.fillText("ALKALINE  1.5V", w / 2, h * 0.46);
          c.font = "800 52px Arial, sans-serif"; c.fillText("+", w / 2, 56); c.fillStyle = "#3a1d05"; c.fillText("\u2212", w / 2, h - 18);
        });
        g.add(wrapMesh(0.2, 0.2, 0.03, 1.25, bt, { roughness: 0.35, envMapIntensity: 0.7 }));
        g.add(lathe([[0.2, 1.25], [0.195, 1.265], [0.19, 1.285], [0.1, 1.29], [0.075, 1.292], [0.07, 1.335], [0, 1.34]], steel));
        [[0.07, 0.01], [-0.06, 0.05], [0.0, -0.08]].forEach(function (p, i) {
          var cr = mesh(lump(new THREE.SphereGeometry(0.045 + i * 0.008, 10, 8), 0.3, 25), M(0xbfd9c6, { roughness: 1 }), p[0], 1.295, p[1]); cr.scale.y = 0.6; g.add(cr);
        });
      },

      /* lampu neon T8 rusak: kaca berlapis fosfor, ujung menghitam, retak, tutup dan pin */
      lamp: function (g) {
        var lt = tex(256, 1024, function (c, w, h) {
          c.fillStyle = "#f3f5fa"; c.fillRect(0, 0, w, h);
          [0, h].forEach(function (y0) { var gr = c.createLinearGradient(0, y0, 0, y0 ? h - 150 : 150); gr.addColorStop(0, "rgba(25,22,20,0.95)"); gr.addColorStop(1, "rgba(25,22,20,0)"); c.fillStyle = gr; c.fillRect(0, y0 ? h - 150 : 0, w, 150); });
          c.fillStyle = "#fff"; c.fillRect(90, 330, 120, 360); c.strokeStyle = "#9aa"; c.lineWidth = 2; c.strokeRect(90, 330, 120, 360);
          c.save(); c.translate(150, 510); c.rotate(Math.PI / 2); c.fillStyle = "#3a4048"; c.textAlign = "center"; c.font = "700 26px Arial, sans-serif"; c.fillText("18W T8  COOL DAYLIGHT 6500K", 0, 8); c.restore();
          c.strokeStyle = "rgba(90,95,100,0.8)"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(20, 780); c.lineTo(60, 812); c.lineTo(48, 850); c.lineTo(100, 880); c.moveTo(60, 812); c.lineTo(110, 800); c.stroke();
        });
        var tube = mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.7, 32, 1, true), M(0xffffff, { map: lt, roughness: 0.18, envMapIntensity: 0.9 }), 0, 0.107, 0); tube.rotation.z = Math.PI / 2; g.add(tube);
        [-1, 1].forEach(function (s) {
          var cap = mesh(new THREE.CylinderGeometry(0.108, 0.108, 0.1, 24), M(0xe9e6dc, { roughness: 0.5 }), s * 0.9, 0.107, 0); cap.rotation.z = Math.PI / 2; g.add(cap);
          [-0.03, 0.03].forEach(function (z) {
            var pin = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.09, 8), M(0xc8b06a, { metalness: 0.9, roughness: 0.3 }), s * 0.985, 0.107, z); pin.rotation.z = Math.PI / 2; g.add(pin);
          });
        });
      },

      /* tisu bekas: gumpalan diremas (permukaan berfaset, lipatan tajam, noda krem) dan selembar tisu kusut di bawahnya */
      tissue: function (g) {
        var wh = new THREE.Color(0xfdfcf8), gy = new THREE.Color(0xa9b1bf), st = new THREE.Color(0xc9b48a);
        function ridge(x, y, z) { return 1 - Math.abs(Math.sin(x + 1.7 * Math.sin(y) + 2.1 * Math.cos(z))); }
        function shade(q, v, c) { c.copy(gy).lerp(wh, Math.min(1, Math.max(0, (q - 0.25) * 1.9))); if (nz(v.x * 7, v.y * 7, v.z * 7) > 0.72) c.lerp(st, 0.55); }
        function wad(r, x, y, z, sd) {
          var geo = new THREE.IcosahedronGeometry(r, 3), p = geo.attributes.position, v = new THREE.Vector3(), d = [], i, n, q;
          for (i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i); n = v.clone().normalize();
            q = 0.5 * ridge(n.x * 5 + sd, n.y * 6, n.z * 5) + 0.3 * ridge(n.x * 11, n.y * 10 + sd, n.z * 12) + 0.2 * ridge(n.x * 23, n.y * 21, n.z * 19 + sd);
            d.push(q); v.copy(n).multiplyScalar(r * (0.82 + 0.34 * q)); p.setXYZ(i, v.x, v.y, v.z);
          }
          geo.computeVertexNormals(); // geometri tanpa indeks: normal per sisi, jadi lipatan tampak tajam
          var k = 0; vcol(geo, function (vv, c) { shade(d[k++], vv, c); });
          var m = mesh(geo, M(0xffffff, { roughness: 1, vertexColors: true }), x, y, z); m.scale.y = 0.8; m.rotation.y = sd; return m;
        }
        g.add(wad(0.34, 0, 0.32, 0, 1.3)); g.add(wad(0.24, 0.42, 0.22, 0.2, 2.7)); g.add(wad(0.18, -0.38, 0.17, -0.2, 4.1));
        var sh = grid(16, 14, function (u, t) {
          var x = u * 0.42 + 0.15, z = (t - 0.5) * 0.7 + 0.2, c = Math.max(0, x * 0.9 - z * 0.9 - 0.3);
          return [x, 0.012 + 0.035 * ridge(x * 22 + 1, z * 19, 1.3) * 0.6 + 0.6 * c * c, z];
        });
        vcol(sh, function (v, c) { shade(0.25 + 0.75 * ridge(v.x * 22 + 1, v.z * 19, 1.3), v, c); });
        g.add(mesh(sh, M(0xffffff, { roughness: 1, side: THREE.DoubleSide, vertexColors: true })));
      },

      /* sachet camilan: kantong bantal berisi udara, segel bergerigi, cetakan warna-warni, bagian belakang foil */
      sachet: function (g) {
        var W = 0.4, L = 0.575, T = 0.16, S0 = 0.74;
        var pr = tex(512, 640, function (c, w, h) {
          var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#d1337a"); gr.addColorStop(1, "#8d1b52");
          c.fillStyle = gr; c.fillRect(0, 0, w, h);
          c.fillStyle = "#ffd23f"; c.beginPath(); for (var i = 0; i < 28; i++) { var a = i / 28 * 6.283, r = i % 2 ? 150 : 205; c.lineTo(w / 2 + Math.cos(a) * r, 300 + Math.sin(a) * r); } c.fill();
          c.fillStyle = "#fff"; c.textAlign = "center"; c.font = "900 84px Arial, sans-serif"; c.strokeStyle = "#8d1b52"; c.lineWidth = 8; c.strokeText("KRIPIK", w / 2, 286); c.fillText("KRIPIK", w / 2, 286);
          c.font = "800 38px Arial, sans-serif"; c.fillStyle = "#8d1b52"; c.fillText("RASA BALADO", w / 2, 340);
          c.fillStyle = "#f08a24"; [[150, 450], [260, 480], [360, 440]].forEach(function (p) { c.beginPath(); c.ellipse(p[0], p[1], 52, 34, p[0] / 90, 0, 6.283); c.fill(); });
          c.fillStyle = "#c0c4c8"; [0, h - 84].forEach(function (y) { c.fillRect(0, y, w, 84); }); c.fillStyle = "rgba(60,60,60,0.5)"; for (var x = 0; x < w; x += 6) { c.fillRect(x, 0, 2, 84); c.fillRect(x, h - 84, 2, 84); }
        });
        var front = grid(18, 28, function (u, t) {
          var x = u * W, z = (0.5 - t) * 2 * L, zz = Math.abs(z) / L, e = zz < S0 ? Math.sqrt(1 - Math.pow(zz / S0, 3)) : 0;
          var y = 0.012 + T * e * Math.pow(1 - u * u, 0.55) * (1 + 0.12 * nz(x * 9, 0, z * 9));
          if (zz >= S0) y += 0.004 * Math.sin(z * 160);
          return [x, y, z];
        });
        g.add(mesh(front, M(0xffffff, { map: pr, roughness: 0.28, metalness: 0.3, envMapIntensity: 0.9, side: THREE.DoubleSide })));
        var bk = tex(64, 64, function (c, w, h) { var gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, "#e6e8ea"); gr.addColorStop(0.5, "#aab0b6"); gr.addColorStop(1, "#dfe2e5"); c.fillStyle = gr; c.fillRect(0, 0, w, h); });
        var back = mesh(new THREE.PlaneGeometry(W * 2, L * 2), M(0xffffff, { map: bk, metalness: 0.8, roughness: 0.3, envMapIntensity: 1, side: THREE.DoubleSide }), 0, 0.006, 0);
        back.rotation.x = -Math.PI / 2; g.add(back);
      },

      /* kotak makan styrofoam: wadah berbutir, tutup terbuka, bekas minyak, sambal, dan butir nasi */
      foam: function (g) {
        var spk = tex(128, 128, function (c, w, h) { c.fillStyle = "#f6f5f0"; c.fillRect(0, 0, w, h); for (var i = 0; i < 900; i++) { c.fillStyle = "rgba(" + (Math.random() < 0.5 ? "205,200,190" : "255,255,255") + ",0.55)"; c.fillRect(Math.random() * w, Math.random() * h, rnd(1, 3), rnd(1, 3)); } }, 1, 1);
        var fm = M(0xffffff, { map: spk, roughness: 1 }), bev = { bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 3, curveSegments: 10 };
        function ring(depth, inset) {
          var s = rrect(new THREE.Shape(), 1.3, 1.0, 0.13); s.holes.push(rrect(new THREE.Path(), 1.3 - inset * 2, 1.0 - inset * 2, 0.08));
          var m = mesh(new THREE.ExtrudeGeometry(s, Object.assign({ depth: depth }, bev)), fm, 0, 0.025, 0); m.rotation.x = -Math.PI / 2; return m;
        }
        g.add(ring(0.3, 0.07));
        var fl = mesh(new THREE.ExtrudeGeometry(rrect(new THREE.Shape(), 1.3, 1.0, 0.13), { depth: 0.05, bevelEnabled: false, curveSegments: 10 }), fm, 0, 0, 0); fl.rotation.x = -Math.PI / 2; g.add(fl);
        g.add(mesh(new THREE.BoxGeometry(0.04, 0.2, 0.86), fm, 0.18, 0.15, 0));
        var st = tex(512, 400, function (c, w, h) {
          function blob(x, y, r, col) { var gr = c.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, col); gr.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
          blob(150, 200, 120, "rgba(190,120,40,0.55)"); blob(110, 280, 70, "rgba(190,40,25,0.7)"); blob(330, 120, 80, "rgba(205,150,60,0.45)"); blob(400, 290, 60, "rgba(80,140,50,0.5)");
        });
        var stain = mesh(new THREE.PlaneGeometry(1.16, 0.86), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false }), 0, 0.058, 0); stain.rotation.x = -Math.PI / 2; g.add(stain);
        grains(g, 26, M(0xfffbe8, { roughness: 0.7 }), function () { return [rnd(-0.55, 0.12), 0.07, rnd(-0.38, 0.38), 0.045, 0.018, 0.018]; });
        var pv = new THREE.Group(); pv.position.set(0, 0.35, -0.5); pv.rotation.x = -1.15; g.add(pv);
        var lw = ring(0.1, 0.07); lw.position.set(0, 0, 0.5); lw.scale.set(1, 1, 1); pv.add(lw);
        var ls = mesh(new THREE.ExtrudeGeometry(rrect(new THREE.Shape(), 1.3, 1.0, 0.13), { depth: 0.04, bevelEnabled: false, curveSegments: 10 }), fm, 0, 0.1, 0.5); ls.rotation.x = -Math.PI / 2; pv.add(ls);
        var ls2 = mesh(new THREE.PlaneGeometry(1.16, 0.86), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.6 }), 0, 0.098, 0.5); ls2.rotation.x = Math.PI / 2; pv.add(ls2);
      }
    };
    function buildItem(key) {
      var g = new THREE.Group();
      MODELS[key](g);
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      var hit = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      hit.position.y = 0.55; g.add(hit);
      return g;
    }
    function dispose(obj) { // bebaskan geometri, material, dan tekstur kanvas milik benda (lingkungan pantulan dipakai bersama, tidak dibuang)
      obj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { if (m.map) m.map.dispose(); m.dispose(); });
      });
    }

    /* ---- animasi ---- */
    var tweens = [];
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
    function tween(dur, fn, done, ease) { tweens.push({ t0: performance.now(), dur: dur, fn: fn, done: done, ease: ease || easeInOut }); }
    function moveTo(obj, to, dur, done, arc) {
      var from = obj.position.clone();
      tween(dur, function (p) { obj.position.lerpVectors(from, to, p); if (arc) obj.position.y += Math.sin(p * Math.PI) * arc; }, done);
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    /* ---- tata letak ---- */
    var look = new THREE.Vector3(), homePos = new THREE.Vector3(), cur = null, mode = "idle";
    var binSpots = {};
    function layout() {
      var w = wrap.clientWidth || 600, h = wrap.clientHeight || 400;
      renderer.setSize(w, h, false);
      var asp = w / h, halfW, halfH = 0, sx, sz, elev;
      camera.aspect = asp;
      if (asp >= 1.3) {
        binSpots = { org: [-4.5, -1.6], an: [-1.5, -1.6], res: [1.5, -1.6], b3: [4.5, -1.6] };
        sx = 0; sz = 3.2; look.set(0, 0.6, 0.5); halfW = 6.7; elev = [0.6, 0.8];
      } else {
        binSpots = { org: [-2.2, -3.2], an: [2.2, -3.2], res: [-2.2, 0.9], b3: [2.2, 0.9] };
        sx = 0; sz = 4.4; look.set(0, 0.5, 0.6); halfW = 4.1; halfH = 5.6; elev = [0.85, 0.55]; // halfH: supaya tong baris atas dan benda tidak terpotong di layar sempit
      }
      Object.keys(bins).forEach(function (c) { bins[c].g.position.set(binSpots[c][0], 0, binSpots[c][1]); });
      var tf = Math.tan(camera.fov * Math.PI / 360);
      var d = Math.max(10, halfW / (tf * asp), halfH / tf);
      camera.position.set(look.x, look.y + d * elev[0], look.z + d * elev[1]);
      camera.lookAt(look); camera.updateProjectionMatrix();
      homePos.set(sx, 0, sz); pad.position.set(sx, 0.02, sz);
      if (cur && mode === "idle") { cur.position.x = sx; cur.position.z = sz; }
    }
    layout();
    if (window.ResizeObserver) new ResizeObserver(layout).observe(wrap); else window.addEventListener("resize", layout);

    /* ---- seret dan lepas ---- */
    var LIFT = 1.3, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -LIFT);
    var target = new THREE.Vector3(), tmp = new THREE.Vector3(), nearC = null, onRelease = null;
    function setNdc(e) {
      var r = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
    }
    function nearest(v) {
      var best = null, bd = 1.8;
      Object.keys(bins).forEach(function (c) {
        var p = bins[c].g.position, d = Math.hypot(v.x - p.x, v.z - p.z);
        if (d < bd) { bd = d; best = c; }
      });
      return best;
    }
    function setNear(c) {
      nearC = c;
      Object.keys(bins).forEach(function (k) { bins[k].want = k === c ? 1 : 0; });
    }
    canvas.addEventListener("pointerdown", function (e) {
      if (mode !== "idle" || !cur) return;
      setNdc(e);
      if (!ray.intersectObject(cur, true).length) return;
      mode = "drag";
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      target.copy(cur.position); target.y = LIFT;
      canvas.style.cursor = "grabbing";
      var tip = $("tip"); if (tip) tip.classList.add("gone");
      e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
      setNdc(e);
      if (mode === "drag") {
        if (ray.ray.intersectPlane(plane, tmp)) {
          target.set(clamp(tmp.x, -7.5, 7.5), LIFT, clamp(tmp.z, -6, 5.5));
          setNear(nearest(target));
        }
      } else if (mode === "idle" && cur) {
        canvas.style.cursor = ray.intersectObject(cur, true).length ? "grab" : "default";
      }
    });
    function release() {
      if (mode !== "drag") return;
      canvas.style.cursor = "grab";
      var c = nearC; setNear(null);
      if (c && onRelease) { mode = "idle"; if (!onRelease(c)) goHome(); }
      else goHome();
    }
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    function goHome(done) {
      mode = "busy";
      var it = cur, rx = it.rotation.x, rz = it.rotation.z;
      moveTo(it, homePos.clone(), 480, function () { it.rotation.x = 0; it.rotation.z = 0; mode = "idle"; if (done) done(); }, 0.8);
      tween(480, function (p) { it.rotation.x = rx * (1 - p); it.rotation.z = rz * (1 - p); });
    }

    /* ---- API untuk logika permainan ---- */
    var view = {
      isIdle: function () { return mode === "idle"; },
      setReleaseHandler: function (fn) { onRelease = fn; },
      spawn: function (item) {
        var it = buildItem(item.m);
        cur = it; it.position.copy(homePos); it.scale.setScalar(0.01); scene.add(it);
        mode = "busy";
        tween(380, function (p) { it.scale.setScalar(0.01 + 0.99 * Math.max(0, easeOutBack(p))); }, function () { it.scale.setScalar(1); mode = "idle"; });
      },
      drop: function (c, ok, done) {
        mode = "busy";
        var b = bins[c], it = cur, top = new THREE.Vector3(b.g.position.x, 2.9, b.g.position.z);
        var rx = it.rotation.x, rz = it.rotation.z;
        tween(260, function (p) { it.rotation.x = rx * (1 - p); it.rotation.z = rz * (1 - p); });
        moveTo(it, top, 260, function () {
          if (ok) {
            tween(320, function (p) { it.position.y = 2.9 - 1.7 * p; it.scale.setScalar(1 - 0.75 * p); it.rotation.y += 0.15; }, function () {
              scene.remove(it); dispose(it); cur = null;
              tween(300, function (p) { b.bump = Math.sin(p * Math.PI); });
              mode = "idle"; done();
            });
          } else {
            tween(260, function (p) { b.bump = Math.sin(p * Math.PI * 3) * (1 - p); });
            goHome(done);
          }
        });
      },
      hint: function (c) { bins[c].flashUntil = performance.now() + 2200; }
    };

    /* ---- render ---- */
    function frame(now) {
      requestAnimationFrame(frame);
      if (!canvas.offsetParent) return; // layar sedang tersembunyi
      for (var i = tweens.length - 1; i >= 0; i--) {
        var t = tweens[i], p = Math.min(1, (now - t.t0) / t.dur);
        t.fn(t.ease(p));
        if (p >= 1) { tweens.splice(i, 1); if (t.done) t.done(); }
      }
      if (cur) {
        if (mode === "drag") {
          cur.position.lerp(target, 0.28);
          var vx = target.x - cur.position.x, vz = target.z - cur.position.z;
          cur.rotation.z += (-clamp(vx * 0.35, -0.6, 0.6) - cur.rotation.z) * 0.2;
          cur.rotation.x += (clamp(vz * 0.35, -0.6, 0.6) - cur.rotation.x) * 0.2;
        } else if (mode === "idle" && !reduce) {
          cur.rotation.y += 0.012;
          cur.position.y = homePos.y + 0.02 + 0.04 * (1 + Math.sin(now / 600)); // melayang 0,02 sampai 0,10 di atas lantai, tidak pernah menembus
        }
      }
      Object.keys(bins).forEach(function (c) {
        var b = bins[c];
        b.h += (b.want - b.h) * 0.25;
        var op = b.h * 0.85;
        if (now < b.flashUntil) op = Math.max(op, 0.45 + 0.4 * Math.sin(now / 110));
        b.ring.opacity = op;
        b.g.scale.set(1 + 0.05 * b.h, 1 + 0.05 * b.h + 0.12 * b.bump, 1 + 0.05 * b.h);
      });
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    return view;
  }

  /* ================= tanpa 3D ================= */
  function fallbackView() {
    var handler = null;
    return {
      isIdle: function () { return true; },
      setReleaseHandler: function (fn) { handler = fn; },
      spawn: function () {},
      drop: function (c, ok, done) { setTimeout(done, 0); },
      hint: function () {}
    };
  }

  var has3D = !!window.THREE && webglOk();
  var View;
  if (has3D) {
    try { View = build3D(); } catch (e) { has3D = false; }
  }
  if (!has3D) { View = fallbackView(); $("stage").hidden = true; $("nogl").hidden = false; }

  /* ================= logika permainan ================= */
  var order, idx, score, attempts, canAnswer, busy = false, advTimer = null;
  var AUTO_NEXT_MS = 1200; // jeda (ms) sebelum otomatis pindah ke sampah berikutnya setelah jawaban benar
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function binBtns() { return Array.prototype.slice.call(document.querySelectorAll("#g-bins .bin")); }
  function setBtns(on) { binBtns().forEach(function (b) { b.disabled = !on; }); }

  function startGame() {
    if (advTimer) { clearTimeout(advTimer); advTimer = null; }
    order = shuffle(ITEMS); idx = 0; score = 0;
    $("g-result").hidden = true; $("g-play").hidden = false;
    showItem(false);
  }
  function showItem(keepFeedback) {
    var it = order[idx];
    attempts = 0; canAnswer = true; busy = false;
    $("g-name").textContent = it.n; $("g-hint").textContent = it.h;
    $("g-count").textContent = "Sampah " + (idx + 1) + " dari " + order.length;
    $("g-score").textContent = "Benar: " + score;
    $("g-bar").style.width = (idx / order.length * 100) + "%";
    // setelah jawaban benar, penjelasan sebelumnya tetap tampil supaya sempat dibaca
    if (!keepFeedback) $("g-fb").textContent = "Seret benda ke tong yang tepat, atau pilih lewat tombol di bawah.";
    setBtns(true);
    View.spawn(it);
  }
  function answer(c) {
    if (!canAnswer || busy || !View.isIdle()) return false;
    var it = order[idx], ok = c === it.c;
    busy = true; setBtns(false);
    View.drop(c, ok, function () {
      busy = false;
      var fb = $("g-fb"); fb.textContent = "";
      var s = document.createElement("b");
      if (ok) {
        if (attempts === 0) score++;
        canAnswer = false;
        $("g-score").textContent = "Benar: " + score;
        s.className = "ok"; s.textContent = attempts === 0 ? "Tepat. " : "Sekarang tepat. ";
        advTimer = setTimeout(function () { // otomatis lanjut, tanpa tombol
          advTimer = null;
          if (idx < order.length - 1) { idx++; showItem(true); } else finish();
        }, AUTO_NEXT_MS);
      } else {
        attempts++;
        s.className = "no"; s.textContent = "Kurang tepat. Jawabannya " + CATS[it.c] + ". ";
        View.hint(it.c); setBtns(true);
      }
      fb.appendChild(s); fb.appendChild(document.createTextNode((ok ? it.n + ": " : "") + it.t));
    });
    return true;
  }
  function finish() {
    $("g-bar").style.width = "100%";
    $("g-play").hidden = true; $("g-result").hidden = false;
    $("r-score").textContent = score + " / " + order.length;
    $("r-msg").textContent = score >= 11 ? "Hampir sempurna. Kamu siap mengajak teman memilah." : score >= 8 ? "Sudah bagus. Baca lagi penjelasan pada jawaban yang salah untuk menyempurnakannya." : "Masih tahap awal, dan itu wajar. Ulangi latihan sambil membaca penjelasannya.";
    var best = score;
    try { var prev = parseInt(localStorage.getItem("bsp-best") || "0", 10); if (prev > best) best = prev; localStorage.setItem("bsp-best", String(best)); } catch (e) {}
    $("r-best").textContent = "Skor terbaikmu di perangkat ini: " + best + " / " + order.length;
    // app.js mengirim skor ke server (yang disimpan: skor tertinggi)
    try { window.dispatchEvent(new CustomEvent("pilah:finish", { detail: { skor: score, total: order.length } })); } catch (e) {}
  }

  View.setReleaseHandler(answer);
  binBtns().forEach(function (b) { b.addEventListener("click", function () { answer(b.getAttribute("data-c")); }); });
  $("g-again").addEventListener("click", startGame);
  startGame();
  return { restart: startGame };
};
