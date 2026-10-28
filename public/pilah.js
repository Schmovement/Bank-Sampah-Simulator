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
      var cv = document.createElement("canvas"); cv.width = 512; cv.height = 160;
      var tex = new THREE.CanvasTexture(cv);
      var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.scale.set(2.2, 0.69, 1); sp.position.set(0, 0.95, 1.0);
      g.add(body, rim, hole, ring, sp);
      scene.add(g);
      bins[c] = { g: g, body: bodyMat, rim: rimMat, ring: ringMat, cv: cv, tex: tex, h: 0, want: 0, bump: 0, flashUntil: 0 };
    });
    function drawLabel(c) {
      var b = bins[c], ctx = b.cv.getContext("2d");
      ctx.clearRect(0, 0, 512, 160);
      ctx.fillStyle = cssVar("--c-" + c); roundRect(ctx, 6, 14, 500, 132, 16); ctx.fill();
      ctx.fillStyle = cssVar("--on-" + c);
      ctx.font = '800 64px Archivo, "Arial Narrow", Arial, sans-serif';
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(CATS[c].toUpperCase(), 256, 82);
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
    function M(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.7, metalness: 0 }, o || {})); }
    function mesh(geo, mat, x, y, z) { var m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); return m; }
    var MODELS = {
      food: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.75, 0.65, 0.1, 32), M(0xf3f1ea), 0, 0.05, 0));
        [[-0.2, -0.1], [0.05, -0.2], [-0.05, 0.12]].forEach(function (p) {
          var s = mesh(new THREE.SphereGeometry(0.27, 16, 12), M(0xfff7e0, { roughness: 0.9 }), p[0], 0.24, p[1]); s.scale.set(1, 0.7, 1); g.add(s);
        });
        var ch = mesh(new THREE.BoxGeometry(0.45, 0.2, 0.3), M(0x8a4b1f), 0.3, 0.2, 0.22); ch.rotation.y = 0.5; g.add(ch);
        g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), M(0x3f9b4a), -0.4, 0.17, 0.2));
        g.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), M(0x3f9b4a), -0.3, 0.16, 0.38));
      },
      banana: function (g) {
        for (var i = 0; i < 3; i++) {
          var a = i * Math.PI * 2 / 3;
          var p = mesh(new THREE.SphereGeometry(0.3, 16, 12), M(0xf2c61f, { roughness: 0.6 }), Math.cos(a) * 0.42, 0.13, Math.sin(a) * 0.42);
          p.scale.set(1.8, 0.2, 0.55); p.rotation.y = -a; p.rotation.z = 0.2; g.add(p);
        }
        g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.3, 12), M(0x6b4a1d), 0, 0.15, 0));
      },
      pet: function (g) {
        var pm = M(0x9fd8ee, { transparent: true, opacity: 0.68, roughness: 0.15 });
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.0, 24), pm, 0, 0.5, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.25, 24), pm, 0, 1.12, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 16), pm, 0, 1.29, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 16), M(0x1e66c8), 0, 1.39, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.308, 0.308, 0.36, 24), M(0xffffff), 0, 0.5, 0));
        g.scale.setScalar(0.95);
      },
      box: function (g) {
        g.add(mesh(new THREE.BoxGeometry(1.1, 0.8, 0.9), M(0xb98a56, { roughness: 0.9 }), 0, 0.4, 0));
        g.add(mesh(new THREE.BoxGeometry(0.14, 0.02, 0.92), M(0xe3cfa8), 0, 0.805, 0));
        g.add(mesh(new THREE.BoxGeometry(0.4, 0.26, 0.01), M(0xffffff), 0.2, 0.42, 0.455));
      },
      paper: function (g) {
        for (var i = 0; i < 5; i++) {
          var s = mesh(new THREE.BoxGeometry(1.0, 0.05, 0.72), M(0xffffff, { roughness: 0.95 }), (i % 2) * 0.03, 0.03 + i * 0.055, 0);
          s.rotation.y = (i - 2) * 0.07; g.add(s);
        }
        for (var j = 0; j < 4; j++) g.add(mesh(new THREE.BoxGeometry(0.7, 0.004, 0.025), M(0x9aa7b3), 0, 0.31, -0.2 + j * 0.13));
      },
      can: function (g) {
        var al = M(0xc9ced3, { metalness: 0.85, roughness: 0.28 });
        g.add(mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.85, 28), al, 0, 0.45, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.4, 28), M(0xd23a2f, { metalness: 0.3, roughness: 0.4 }), 0, 0.46, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 28), al, 0, 0.9, 0));
        g.add(mesh(new THREE.BoxGeometry(0.16, 0.02, 0.08), al, 0.05, 0.93, 0));
      },
      cup: function (g) {
        var wm = M(0xf6f6f6, { transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 0.4 });
        g.add(mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.85, 28, 1, true), wm, 0, 0.43, 0));
        var bot = mesh(new THREE.CircleGeometry(0.3, 24), wm, 0, 0.02, 0); bot.rotation.x = -Math.PI / 2; g.add(bot);
        var lip = mesh(new THREE.TorusGeometry(0.42, 0.03, 8, 28), M(0xffffff), 0, 0.855, 0); lip.rotation.x = Math.PI / 2; g.add(lip);
        g.add(mesh(new THREE.CylinderGeometry(0.375, 0.34, 0.34, 28, 1, true), M(0xb98a56, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.42, 0));
      },
      battery: function (g) {
        g.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.85, 24), M(0x1b1b1b, { roughness: 0.5 }), 0, 0.43, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.224, 0.224, 0.52, 24), M(0xc8772b, { metalness: 0.5, roughness: 0.4 }), 0, 0.38, 0));
        g.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 16), M(0xcfd3d6, { metalness: 0.8, roughness: 0.3 }), 0, 0.89, 0));
      },
      lamp: function (g) {
        var tube = mesh(new THREE.CylinderGeometry(0.13, 0.13, 1.7, 20), M(0xf4f7ff, { emissive: 0x2a3340, roughness: 0.3 }), 0, 0.14, 0);
        tube.rotation.z = Math.PI / 2; g.add(tube);
        [-0.86, 0.86].forEach(function (x) {
          var cap = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 20), M(0x8a9199, { metalness: 0.6, roughness: 0.4 }), x, 0.14, 0);
          cap.rotation.z = Math.PI / 2; g.add(cap);
        });
      },
      tissue: function (g) {
        var tm = M(0xf7f7f7, { roughness: 1, flatShading: true });
        var a = mesh(new THREE.IcosahedronGeometry(0.42, 1), tm, 0, 0.36, 0); a.scale.set(1, 0.85, 1); g.add(a);
        g.add(mesh(new THREE.IcosahedronGeometry(0.26, 1), tm, 0.4, 0.22, 0.2));
        g.add(mesh(new THREE.IcosahedronGeometry(0.22, 1), tm, -0.38, 0.2, -0.18));
      },
      sachet: function (g) {
        g.add(mesh(new THREE.BoxGeometry(0.95, 0.05, 0.7), M(0xd1337a, { roughness: 0.4 }), 0, 0.04, 0));
        g.add(mesh(new THREE.BoxGeometry(0.95, 0.054, 0.18), M(0xffd23f, { roughness: 0.4 }), 0, 0.042, 0));
        [-0.5, 0.5].forEach(function (x) { g.add(mesh(new THREE.BoxGeometry(0.06, 0.07, 0.7), M(0x9f2159, { roughness: 0.5 }), x, 0.045, 0)); });
        g.rotation.z = 0.05;
      },
      foam: function (g) {
        var fm = M(0xf5f5f2, { roughness: 1 });
        g.add(mesh(new THREE.BoxGeometry(1.25, 0.38, 0.95), fm, 0, 0.19, 0));
        g.add(mesh(new THREE.BoxGeometry(1.05, 0.1, 0.75), M(0xe0ddd5, { roughness: 1 }), 0, 0.36, 0));
        var st = mesh(new THREE.CircleGeometry(0.28, 20), M(0xc99a5b, { roughness: 1 }), 0.15, 0.415, 0.05); st.rotation.x = -Math.PI / 2; g.add(st);
        var pivot = new THREE.Group(); pivot.position.set(0, 0.38, -0.475); pivot.rotation.x = -1.15;
        pivot.add(mesh(new THREE.BoxGeometry(1.25, 0.1, 0.95), fm, 0, 0, 0.475)); g.add(pivot);
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
    function dispose(obj) {
      obj.traverse(function (o) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
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
      var asp = w / h, halfW, sx, sz, elev;
      camera.aspect = asp;
      if (asp >= 1.3) {
        binSpots = { org: [-4.5, -1.6], an: [-1.5, -1.6], res: [1.5, -1.6], b3: [4.5, -1.6] };
        sx = 0; sz = 3.2; look.set(0, 0.6, 0.5); halfW = 6.7; elev = [0.6, 0.8];
      } else {
        binSpots = { org: [-2.2, -3.2], an: [2.2, -3.2], res: [-2.2, 0.9], b3: [2.2, 0.9] };
        sx = 0; sz = 4.7; look.set(0, 0.4, 0.8); halfW = 3.9; elev = [0.85, 0.55];
      }
      Object.keys(bins).forEach(function (c) { bins[c].g.position.set(binSpots[c][0], 0, binSpots[c][1]); });
      var d = Math.max(10, halfW / (Math.tan(camera.fov * Math.PI / 360) * asp));
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
          cur.position.y = homePos.y + Math.sin(now / 600) * 0.06;
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
