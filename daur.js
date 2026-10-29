/* Simulasi virtual daur ulang (layar info di index.html).
   Peserta memilih proyek, menyiapkan bahan, lalu mengerjakan tiap langkah dengan memilih tindakan yang tepat.
   Gambar benda berubah di setiap langkah. Semua teks disisipkan dengan textContent; string SVG hanya berisi konstanta di file ini. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  if (!$("sim")) return;

  /* ================= gambar (SVG, viewBox 400 x 260) ================= */
  var DEFS = '<defs>' +
    '<pattern id="pp" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="16" height="16" fill="#f2c61f"/><rect width="8" height="16" fill="#2E7D4F"/></pattern>' +
    '<pattern id="pk" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><rect width="18" height="18" fill="#fffdf6"/><rect width="9" height="18" fill="#4DAA74"/></pattern>' +
    '</defs>';
  var TABLE = '<rect class="tbl" x="0" y="200" width="400" height="60"/><line x1="0" y1="200" x2="400" y2="200" stroke="#888" stroke-opacity=".5" stroke-width="2"/>';
  function wrap(inner) { return DEFS + '<g class="scene">' + TABLE + inner + '</g>'; }
  function shadow(cx, rx) { return '<ellipse class="sh" cx="' + cx + '" cy="204" rx="' + rx + '" ry="7"/>'; }
  function star(x, y, s) { return '<polygon fill="#F0C23A" points="' + x + ',' + (y - s) + ' ' + (x + s / 3) + ',' + (y - s / 3) + ' ' + (x + s) + ',' + y + ' ' + (x + s / 3) + ',' + (y + s / 3) + ' ' + x + ',' + (y + s) + ' ' + (x - s / 3) + ',' + (y + s / 3) + ' ' + (x - s) + ',' + y + ' ' + (x - s / 3) + ',' + (y - s / 3) + '"/>'; }
  function drop(x, y) { return '<path fill="#5AB2E0" d="M' + x + ' ' + y + ' q-5 8 0 10 q5 -2 0 -10z"/>'; }
  function speck(x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#8a6a3a"/>'; }

  /* ----- botol ----- */
  function bottle(o) {
    var F = '#9fd8ee', g = shadow(200, 48);
    function top() {
      return '<polygon class="o" fill="' + F + '" fill-opacity=".55" points="165,90 235,90 215,62 185,62"/>' +
        '<rect class="o" fill="' + F + '" fill-opacity=".55" x="185" y="48" width="30" height="14"/>' +
        '<rect class="o" fill="#1e66c8" x="182" y="36" width="36" height="12" rx="2"/>';
    }
    var bt = o.cut ? 100 : 90;
    g += '<rect class="o" fill="' + F + '" fill-opacity=".55" x="165" y="' + bt + '" width="70" height="' + (200 - bt) + '" rx="8"/>';
    if (o.cut) {
      g += '<ellipse class="o" fill="' + F + '" fill-opacity=".25" cx="200" cy="100" rx="35" ry="6"/>';
      g += '<g transform="translate(112 80) rotate(30 200 80)">' + top() + '<rect class="o" fill="' + F + '" fill-opacity=".55" x="165" y="90" width="70" height="10"/></g>';
    } else {
      g += top();
    }
    if (o.label) g += '<rect fill="#1e66c8" x="165" y="125" width="70" height="34"/><text class="t" x="200" y="147" text-anchor="middle">AIR</text>';
    if (o.dirty) g += speck(178, 175) + speck(220, 168) + speck(195, 188) + speck(226, 190) + speck(184, 112);
    if (o.paint) g += '<rect fill="#E0AE00" fill-opacity=".92" x="165" y="140" width="70" height="60" rx="8"/><rect fill="#C23B2E" x="165" y="158" width="70" height="12"/><rect fill="#fff" fill-opacity=".9" x="165" y="176" width="70" height="6"/>';
    if (o.holes) g += '<circle cx="182" cy="193" r="3" fill="#1a2630"/><circle cx="200" cy="193" r="3" fill="#1a2630"/><circle cx="218" cy="193" r="3" fill="#1a2630"/>' + drop(182, 207) + drop(218, 212);
    if (o.soil) g += '<path fill="#5b3a1e" d="M167 104 Q200 82 233 104 Z"/><path d="M200 94 V66" stroke="#2E7D4F" stroke-width="3" fill="none"/><path fill="#3f9b4a" d="M200 80 q-24 -2 -28 -22 q24 0 28 22z"/><path fill="#4DAA74" d="M200 72 q22 -2 26 -20 q-22 0 -26 20z"/>';
    if (o.spark) g += star(150, 110, 9) + star(255, 140, 7) + star(240, 80, 6) + star(160, 175, 6) + drop(150, 135) + drop(252, 170);
    return g;
  }

  /* ----- kaleng ----- */
  function can(o) {
    var g = shadow(200, 44);
    g += '<path class="o" fill="' + (o.wrap ? 'url(#pp)' : '#c9ced3') + '" d="M160 100 v100 a40 9 0 0 0 80 0 v-100 z"/>';
    if (!o.wrap) g += '<rect fill="#d23a2f" x="160.8" y="128" width="78.4" height="38"/>';
    if (o.dirty) g += speck(172, 118) + speck(228, 112) + speck(186, 180) + speck(222, 186) + speck(205, 144);
    if (o.clean) g += '<rect fill="#fff" fill-opacity=".55" x="170" y="104" width="8" height="92" rx="4"/>';
    g += '<ellipse class="o" fill="#4a5058" cx="200" cy="100" rx="40" ry="9"/>';
    if (o.tape) g += '<ellipse fill="none" stroke="#6a4cc2" stroke-width="6" cx="200" cy="100" rx="40" ry="9"/><path fill="#6a4cc2" d="M160 100 v10 a40 9 0 0 0 80 0 v-10 a40 9 0 0 1 -80 0z"/>';
    if (o.pens) {
      [["#1e66c8", -16, 186], ["#C23B2E", 4, 200], ["#2E7D4F", 22, 214]].forEach(function (p) {
        g += '<g transform="rotate(' + p[1] + ' ' + p[2] + ' 104)"><rect class="o" fill="' + p[0] + '" x="' + (p[2] - 4) + '" y="34" width="8" height="70"/><polygon class="o" fill="#e8c89a" points="' + (p[2] - 4) + ',34 ' + (p[2] + 4) + ',34 ' + p[2] + ',22"/></g>';
      });
      g += '<ellipse fill="none" stroke="#6a4cc2" stroke-width="6" cx="200" cy="100" rx="40" ry="9"/>';
    }
    if (o.spark) g += star(150, 120, 9) + star(250, 150, 7) + star(245, 92, 6);
    return g;
  }

  /* ----- kertas ----- */
  function paper(s) {
    var g = '';
    if (s === 0) {
      g += shadow(190, 70);
      for (var i = 0; i < 5; i++) g += '<rect class="o" fill="#fff" x="' + (135 + (i % 2) * 5) + '" y="' + (192 - i * 7) + '" width="110" height="7" />';
      g += '<line x1="152" y1="160" x2="228" y2="160" stroke="#9aa7b3"/><line x1="152" y1="168" x2="215" y2="168" stroke="#9aa7b3"/>';
      g += '<polygon class="o" fill="#fff" points="280,192 296,184 304,196 290,202"/><polygon class="o" fill="#fff" points="310,196 322,190 330,200 316,204"/><polygon class="o" fill="#fff" points="262,200 274,196 280,204 266,206"/>';
    } else if (s === 1) {
      g += shadow(200, 100);
      g += '<path class="o" fill="#e8e4dc" d="M95 140 Q200 258 305 140 Z"/><ellipse fill="#8fcbe6" stroke="#5a9bb8" cx="200" cy="140" rx="105" ry="14"/>';
      g += '<polygon fill="#fff" stroke="#9aa7b3" points="150,136 164,132 168,142 154,146"/><polygon fill="#fff" stroke="#9aa7b3" points="190,140 204,136 210,146 194,148"/><polygon fill="#fff" stroke="#9aa7b3" points="232,134 246,134 248,144 234,146"/><polygon fill="#fff" stroke="#9aa7b3" points="205,128 216,124 222,132 210,134"/>';
      g += '<text class="t2" x="200" y="100" text-anchor="middle">direndam beberapa jam</text>';
    } else if (s === 2) {
      g += shadow(200, 60);
      g += '<polygon class="o" fill="#cfe8f3" fill-opacity=".5" points="165,66 235,66 228,168 172,168"/><polygon fill="#e9e1cf" points="169.5,106 230.5,106 228,168 172,168"/>';
      g += '<path d="M178 126 q22 -10 44 0 M176 144 q24 -10 48 0" fill="none" stroke="#c9bfa5" stroke-width="3"/>';
      g += '<rect class="o" fill="#3a3f44" x="158" y="58" width="84" height="9" rx="2"/><rect class="o" fill="#3a3f44" x="150" y="168" width="100" height="30" rx="5"/><circle cx="200" cy="184" r="5" fill="#E0AE00"/>';
    } else if (s === 3) {
      g += shadow(200, 100);
      g += '<rect fill="#e9e1cf" x="114" y="124" width="172" height="62"/>';
      for (var x = 126; x < 286; x += 14) g += '<line x1="' + x + '" y1="124" x2="' + x + '" y2="186" stroke="#b7b0a0" stroke-opacity=".7"/>';
      for (var y = 136; y < 186; y += 12) g += '<line x1="114" y1="' + y + '" x2="286" y2="' + y + '" stroke="#b7b0a0" stroke-opacity=".7"/>';
      g += '<rect fill="none" stroke="#8a5a2b" stroke-width="9" x="110" y="120" width="180" height="70"/>';
      g += '<text class="t2" x="200" y="108" text-anchor="middle">ratakan tipis</text>';
    } else {
      g += '<circle fill="#F0C23A" cx="334" cy="52" r="18"/>';
      for (var a = 0; a < 8; a++) { var r = a * Math.PI / 4; g += '<line stroke="#F0C23A" stroke-width="3" stroke-linecap="round" x1="' + (334 + Math.cos(r) * 26).toFixed(1) + '" y1="' + (52 + Math.sin(r) * 26).toFixed(1) + '" x2="' + (334 + Math.cos(r) * 35).toFixed(1) + '" y2="' + (52 + Math.sin(r) * 35).toFixed(1) + '"/>'; }
      g += shadow(190, 90);
      g += '<rect class="o" fill="#7aa9c9" x="105" y="188" width="190" height="10"/><rect class="o" fill="#fffdf6" x="120" y="156" width="160" height="32"/>';
      g += speck(150, 170) + speck(200, 176) + speck(242, 166) + speck(176, 164);
      g += star(130, 140, 7) + star(262, 134, 6);
    }
    return g;
  }

  /* ----- organizer kardus ----- */
  function organizer(s) {
    var g = shadow(200, 100), i;
    if (s === 0) {
      g += '<rect class="o" fill="#b98a56" x="100" y="140" width="200" height="60"/>';
      g += '<line stroke="#fff" stroke-width="2" stroke-dasharray="7 5" x1="100" y1="170" x2="300" y2="170"/><line stroke="#fff" stroke-width="2" stroke-dasharray="7 5" x1="170" y1="140" x2="170" y2="170"/><line stroke="#fff" stroke-width="2" stroke-dasharray="7 5" x1="230" y1="140" x2="230" y2="170"/>';
      g += '<rect class="o" fill="#F0C23A" x="100" y="112" width="200" height="20"/>';
      for (i = 0; i <= 10; i++) g += '<line stroke="#1b1500" x1="' + (100 + i * 20) + '" y1="112" x2="' + (100 + i * 20) + '" y2="' + (i % 5 === 0 ? 126 : 120) + '"/>';
    } else if (s === 1) {
      g += '<rect class="o" fill="#b98a56" x="110" y="176" width="180" height="24"/>';
      g += '<rect class="o" fill="#c99a66" x="120" y="124" width="70" height="38"/><rect class="o" fill="#c99a66" x="210" y="124" width="70" height="38"/>';
      g += '<polygon class="o" fill="#cfd3d6" points="318,120 352,160 340,166 308,128"/><rect class="o" fill="#C23B2E" x="296" y="116" width="22" height="14" rx="2" transform="rotate(48 307 123)"/>';
    } else {
      var fill = s >= 3 ? 'url(#pk)' : '#b98a56';
      g += '<rect class="o" fill="' + fill + '" x="110" y="110" width="180" height="90"/>';
      g += '<rect fill="#6e4d2a" x="120" y="118" width="50" height="72"/><rect fill="#6e4d2a" x="175" y="118" width="50" height="72"/><rect fill="#6e4d2a" x="230" y="118" width="50" height="72"/>';
      if (s === 4) {
        g += '<rect class="o" fill="#1e66c8" x="134" y="78" width="8" height="90" transform="rotate(-8 138 168)"/><rect class="o" fill="#C23B2E" x="148" y="82" width="8" height="90" transform="rotate(6 152 172)"/>';
        g += '<path d="M186 188 q12 -34 24 -10 t24 -14" fill="none" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/><path d="M186 182 q-10 -20 6 -24" fill="none" stroke="#1b1b1b" stroke-width="4" stroke-linecap="round"/>';
        g += '<rect class="o" fill="#F0C23A" x="240" y="140" width="30" height="30"/>';
        g += star(100, 100, 8) + star(300, 96, 7);
      }
    }
    return g;
  }

  /* ================= data proyek ================= */
  var OTHER = "Bahan ini dipakai untuk proyek lain, bukan untuk proyek ini.";
  var PROJ = [
    {
      id: "botol", name: "Pot tanaman dari botol", meta: ["Mudah", "±30 menit", "Botol PET 1,5 L"],
      mats: [
        { t: "Botol plastik bekas, bersih", ok: 1 }, { t: "Cutter atau gunting kuat", ok: 1 },
        { t: "Cat atau spidol permanen", ok: 1 }, { t: "Tanah dan bibit kecil", ok: 1 },
        { t: "Blender dan baskom air", fb: OTHER }, { t: "Lem dan lakban kain", fb: OTHER }, { t: "Kaleng minuman bekas", fb: OTHER }
      ],
      steps: [
        { d: "Bilas botol dan lepas labelnya.", o: [
          { t: "Bilas botol, lalu lepas labelnya", ok: 1 },
          { t: "Langsung potong tanpa dibersihkan", fb: "Botol yang kotor dan masih berlabel menyulitkan pemotongan dan pengecatan." },
          { t: "Isi tanah dulu", fb: "Tanah baru diisi paling akhir, setelah botol dipotong dan dihias." }] },
        { d: "Potong sepertiga bagian atas botol.", o: [
          { t: "Potong sepertiga bagian atas dengan cutter", ok: 1 },
          { t: "Potong separuh bagian bawah", fb: "Bagian bawah dibutuhkan sebagai wadah tanah." },
          { t: "Patahkan dengan tangan", fb: "Hasilnya tidak rapi dan tepinya bisa tajam. Pakai cutter dengan hati-hati." }] },
        { d: "Lubangi bagian bawah untuk saluran air.", o: [
          { t: "Lubangi bagian bawah untuk saluran air", ok: 1 },
          { t: "Lubangi bagian atas", fb: "Air siraman keluar lewat dasar pot, jadi lubangnya di bagian bawah." },
          { t: "Biarkan tanpa lubang", fb: "Air akan menggenang dan akar tanaman bisa membusuk." }] },
        { d: "Hias dengan cat, lalu isi tanah dan bibit.", o: [
          { t: "Hias dengan cat, lalu isi tanah dan bibit", ok: 1 },
          { t: "Isi tanah dulu, baru dicat", fb: "Cat yang basah akan terkena tanah. Cat dulu sampai kering, baru isi tanah." },
          { t: "Isi bibit tanpa tanah", fb: "Bibit membutuhkan tanah untuk tumbuh." }] }
      ],
      warn: "Minta bantuan teman untuk memegang botol saat memotong dan hati-hati dengan cutter.", warnAt: 1,
      caps: ["Botol bekas masih kotor dan berlabel.", "Botol sudah bersih dan tanpa label.", "Sepertiga bagian atas sudah terpotong.", "Dasar botol sudah berlubang untuk saluran air.", "Pot sudah dihias dan berisi tanah dengan bibit."],
      scene: function (s) { return [bottle({ label: 1, dirty: 1 }), bottle({ spark: 1 }), bottle({ cut: 1 }), bottle({ cut: 1, holes: 1 }), bottle({ cut: 1, holes: 1, paint: 1, soil: 1 })][s]; },
      done: "Botol bekas yang tadinya akan dibuang kini jadi pot tanaman."
    },
    {
      id: "kaleng", name: "Tempat pensil dari kaleng", meta: ["Mudah", "±20 menit", "Kaleng minuman"],
      mats: [
        { t: "Kaleng bekas, bersih dan kering", ok: 1 }, { t: "Kertas bekas atau kain perca", ok: 1 }, { t: "Lem dan lakban kain", ok: 1 },
        { t: "Blender dan baskom air", fb: OTHER }, { t: "Tanah dan bibit kecil", fb: OTHER }, { t: "Botol plastik bekas", fb: OTHER }
      ],
      steps: [
        { d: "Cuci kaleng dan keringkan.", o: [
          { t: "Cuci kaleng, lalu keringkan", ok: 1 },
          { t: "Biarkan basah lalu langsung ditempel", fb: "Lem sulit menempel pada permukaan yang basah atau berminyak." },
          { t: "Langsung tempel kertas tanpa dibersihkan", fb: "Sisa minuman membuat lem tidak menempel dan kaleng cepat bau." }] },
        { d: "Lapisi tepi atas dengan lakban kain supaya tidak tajam.", o: [
          { t: "Lapisi tepi atas dengan lakban kain", ok: 1 },
          { t: "Biarkan tepi terbuka", fb: "Tepi kaleng tajam dan bisa melukai tangan." },
          { t: "Ratakan tepi dengan gunting", fb: "Memotong logam dengan gunting kertas berbahaya dan tidak efektif." }] },
        { d: "Tempel kertas bekas atau kain di sekeliling kaleng.", o: [
          { t: "Tempel kertas bekas atau kain di sisi luar kaleng", ok: 1 },
          { t: "Tempel lem di bagian dalam kaleng", fb: "Hiasan menempel di sisi luar, jadi lem dioles di sisi luar." },
          { t: "Bungkus dengan plastik kresek", fb: "Plastik licin dan tidak menempel awet, sedangkan tujuannya memakai kertas atau kain bekas." }] },
        { d: "Biarkan lem kering sebelum dipakai.", o: [
          { t: "Biarkan lem kering sebelum dipakai", ok: 1 },
          { t: "Langsung isi pensil saat lem masih basah", fb: "Lapisan hias bisa bergeser dan menempel di tangan." },
          { t: "Panaskan di atas api supaya cepat kering", fb: "Berbahaya. Kaleng jadi panas dan lem bisa rusak." }] }
      ],
      warn: "Gunakan kaleng yang tutupnya sudah terbuka rata dan pastikan tepinya tidak melukai tangan.", warnAt: 1,
      caps: ["Kaleng bekas masih kotor.", "Kaleng sudah bersih dan kering.", "Tepi atas sudah dilapisi lakban kain.", "Sisi luar sudah ditempel kertas atau kain.", "Lem sudah kering dan siap diisi pensil."],
      scene: function (s) { return [can({ dirty: 1 }), can({ clean: 1, spark: 1 }), can({ clean: 1, tape: 1 }), can({ wrap: 1, tape: 1 }), can({ wrap: 1, tape: 1, pens: 1, spark: 1 })][s]; },
      done: "Kaleng minuman bekas kini jadi tempat pensil di meja belajarmu."
    },
    {
      id: "kertas", name: "Kertas daur ulang", meta: ["Sedang", "±1 jam + jemur sehari", "Kertas HVS bekas"],
      mats: [
        { t: "Kertas bekas tanpa banyak tinta", ok: 1 }, { t: "Blender dan baskom air", ok: 1 },
        { t: "Saringan atau bingkai berkain kasa", ok: 1 }, { t: "Kain bersih dan penindih", ok: 1 },
        { t: "Cutter atau gunting kuat", fb: OTHER }, { t: "Lem dan lakban kain", fb: OTHER }, { t: "Kaleng minuman bekas", fb: OTHER }
      ],
      steps: [
        { d: "Sobek kertas kecil-kecil dan rendam beberapa jam.", o: [
          { t: "Sobek kecil-kecil, lalu rendam beberapa jam", ok: 1 },
          { t: "Blender kertas kering langsung", fb: "Kertas kering merusak pisau blender dan buburnya tidak merata." },
          { t: "Rendam kertas utuh selama 5 menit", fb: "Kertas utuh dan hanya sebentar direndam sulit hancur menjadi bubur." }] },
        { d: "Blender bersama air sampai jadi bubur.", o: [
          { t: "Blender bersama air sampai jadi bubur", ok: 1 },
          { t: "Blender tanpa air", fb: "Tanpa air kertas tidak hancur jadi bubur halus." },
          { t: "Remas dengan tangan saja", fb: "Hasilnya masih bergerombol. Blender membuat serat lebih halus dan rata." }] },
        { d: "Tuang bubur ke saringan dan ratakan tipis.", o: [
          { t: "Tuang bubur ke saringan dan ratakan tipis", ok: 1 },
          { t: "Tuang tebal dan biarkan menggumpal", fb: "Lembaran tebal lama kering dan mudah retak." },
          { t: "Tuang langsung ke lantai", fb: "Bubur tidak berbentuk lembaran dan air tidak bisa tersaring." }] },
        { d: "Tekan dengan kain, lalu jemur sampai kering.", o: [
          { t: "Tekan dengan kain, lalu jemur sampai kering", ok: 1 },
          { t: "Jemur tanpa ditekan", fb: "Air masih banyak tersisa dan lembaran jadi bergelombang." },
          { t: "Setrika bubur yang masih basah", fb: "Bubur basah menempel pada setrika dan lembarannya rusak." }] }
      ],
      warn: "Blender hanya dipakai untuk bahan praktik, lalu cuci bersih sebelum dipakai untuk makanan.", warnAt: 1,
      caps: ["Tumpukan kertas bekas dan sobekan kertas.", "Sobekan kertas sedang direndam di air.", "Kertas sudah menjadi bubur di dalam blender.", "Bubur sudah diratakan tipis di bingkai saringan.", "Lembaran kertas baru sudah kering di bawah matahari."],
      scene: function (s) { return paper(s); },
      done: "Kertas bekas kini jadi lembaran kertas baru."
    },
    {
      id: "kardus", name: "Organizer meja dari kardus", meta: ["Sedang", "±45 menit", "Kardus bekas"],
      mats: [
        { t: "Kardus tebal bersih", ok: 1 }, { t: "Cutter, penggaris, lem", ok: 1 }, { t: "Kertas bekas atau kain untuk pelapis", ok: 1 },
        { t: "Blender dan baskom air", fb: OTHER }, { t: "Tanah dan bibit kecil", fb: OTHER }, { t: "Botol plastik bekas", fb: OTHER }
      ],
      steps: [
        { d: "Ukur dan potong kardus jadi alas dan sekat.", o: [
          { t: "Ukur, lalu potong jadi alas dan sekat", ok: 1 },
          { t: "Potong tanpa mengukur", fb: "Ukuran alas dan sekat jadi tidak pas dan kotaknya miring." },
          { t: "Potong sambil dipegang di tangan", fb: "Berbahaya. Potong di atas alas cutter." }] },
        { d: "Rekatkan sekat pada alas dengan lem.", o: [
          { t: "Rekatkan sekat berdiri di atas alas dengan lem", ok: 1 },
          { t: "Susun saja tanpa lem", fb: "Sekat akan lepas dan roboh saat dipakai." },
          { t: "Tempel sekat di sisi luar alas", fb: "Sekat harus berdiri di atas alas supaya membentuk ruang." }] },
        { d: "Lapisi dengan kertas atau kain.", o: [
          { t: "Lapisi dengan kertas atau kain", ok: 1 },
          { t: "Basahi dengan banyak air", fb: "Kardus basah melunak dan mudah rusak." },
          { t: "Biarkan polos dan kusam", fb: "Boleh saja, tetapi pelapis membuat organizer lebih rapi dan awet." }] },
        { d: "Pakai untuk alat tulis dan kabel di meja belajar.", o: [
          { t: "Pakai untuk alat tulis dan kabel", ok: 1 },
          { t: "Isi dengan makanan basah", fb: "Kardus akan lembap dan melunak." },
          { t: "Isi dengan benda yang sangat berat", fb: "Kardus tipis tidak kuat menahan beban berat." }] }
      ],
      warn: "Potong di atas alas cutter dan arahkan pisau menjauh dari tubuh.", warnAt: 0,
      caps: ["Selembar kardus tebal dengan garis ukur.", "Alas dan dua sekat sudah terpotong.", "Sekat sudah direkatkan pada alas.", "Organizer sudah dilapisi kertas atau kain.", "Organizer terisi alat tulis dan kabel."],
      scene: function (s) { return organizer(s); },
      done: "Kardus bekas kini jadi organizer untuk meja belajarmu."
    }
  ];

  /* ================= logika ================= */
  var st, doneSet = {};
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function range(n) { var r = []; for (var i = 0; i < n; i++) r.push(i); return r; }
  function cur() { return PROJ[st.p]; }
  function matsNeeded(p) { return p.mats.filter(function (m) { return m.ok; }).length; }

  function begin(i) {
    var p = PROJ[i];
    st = { p: i, phase: "bahan", step: 0, picked: {}, bad: {}, mist: 0, ok: false, ord: shuffle(range(p.mats.length)), wrong: {}, fb: null };
    drawScene(0);
    render();
  }
  function drawScene(s) {
    var p = cur();
    $("sim-svg").innerHTML = wrap(p.scene(s));
    $("sim-cap").textContent = p.caps[s];
    $("sim-svg").setAttribute("aria-label", p.name + ". " + p.caps[s]);
  }
  function setFb(cls, strong, text) {
    var fb = $("sim-fb"); fb.textContent = "";
    if (!strong && !text) return;
    var b = document.createElement("b"); b.className = cls; b.textContent = strong; fb.appendChild(b);
    fb.appendChild(document.createTextNode(text || ""));
  }
  function btn(label, cls, fn) {
    var b = document.createElement("button"); b.type = "button"; b.className = "btn " + cls; b.textContent = label;
    b.addEventListener("click", fn); return b;
  }

  function renderTabs() {
    var box = $("sim-tabs"); box.textContent = "";
    PROJ.forEach(function (p, i) {
      var b = document.createElement("button"); b.type = "button";
      b.className = "sim-tab" + (i === st.p ? " on" : "") + (doneSet[p.id] ? " done" : "");
      b.setAttribute("aria-pressed", i === st.p ? "true" : "false");
      var n = document.createElement("span"); n.textContent = p.name;
      var m = document.createElement("small"); m.textContent = p.meta.join(" · ");
      b.appendChild(n); b.appendChild(m);
      b.addEventListener("click", function () { if (i !== st.p) begin(i); });
      box.appendChild(b);
    });
  }

  function render() {
    var p = cur(), n = p.steps.length;
    renderTabs();
    var opts = $("sim-opts"); opts.textContent = "";
    var act = $("sim-actions"); act.textContent = "";
    var warn = $("sim-warn");
    var pct = 0;

    if (st.phase === "bahan") {
      var got = Object.keys(st.picked).length, need = matsNeeded(p);
      $("sim-phase").textContent = "Persiapan";
      $("sim-title").textContent = "Siapkan bahan dan alat";
      $("sim-text").textContent = "Ketuk hanya bahan dan alat yang dipakai untuk membuat " + p.name.toLowerCase() + ". Ada beberapa yang sengaja tidak diperlukan. Terkumpul " + got + " dari " + need + ".";
      warn.hidden = true;
      st.ord.forEach(function (mi) {
        var m = p.mats[mi], b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = m.t;
        if (st.picked[mi]) { b.classList.add("right"); b.disabled = true; }
        else if (st.bad[mi]) { b.classList.add("wrong"); b.disabled = true; }
        b.addEventListener("click", function () {
          if (m.ok) { st.picked[mi] = 1; setFbState("ok", "Tepat. ", m.t + " siap di meja kerja."); }
          else { st.bad[mi] = 1; st.mist++; setFbState("no", "Belum tepat. ", m.fb); }
          render();
        });
        opts.appendChild(b);
      });
      if (got === need) act.appendChild(btn("Mulai langkah 1", "primary", function () { st.phase = "langkah"; st.step = 0; st.ok = false; st.wrong = {}; st.fb = null; st.ord = shuffle(range(p.steps[0].o.length)); render(); }));
    } else if (st.phase === "langkah") {
      var s = p.steps[st.step];
      $("sim-phase").textContent = "Langkah " + (st.step + 1) + " dari " + n;
      $("sim-title").textContent = st.ok ? "Langkah selesai" : "Pilih tindakan yang tepat";
      $("sim-text").textContent = st.ok ? s.d : "Lihat kondisi benda di gambar, lalu pilih langkah berikutnya.";
      warn.hidden = st.step !== p.warnAt; warn.textContent = "Keselamatan: " + p.warn;
      pct = (st.step + (st.ok ? 1 : 0)) / n * 100;
      st.ord.forEach(function (oi) {
        var o = s.o[oi], b = document.createElement("button"); b.type = "button"; b.className = "opt"; b.textContent = o.t;
        if (st.ok) { b.disabled = true; if (o.ok) b.classList.add("right"); }
        else if (st.wrong[oi]) { b.classList.add("wrong"); b.disabled = true; }
        b.addEventListener("click", function () {
          if (o.ok) { st.ok = true; drawScene(st.step + 1); setFbState("ok", "Tepat. ", s.d); }
          else { st.wrong[oi] = 1; st.mist++; setFbState("no", "Belum tepat. ", o.fb); }
          render();
        });
        opts.appendChild(b);
      });
      if (st.ok) {
        var last = st.step === n - 1;
        act.appendChild(btn(last ? "Selesaikan proyek" : "Lanjut ke langkah " + (st.step + 2), "primary", function () {
          if (last) { st.phase = "selesai"; doneSet[p.id] = 1; setFbState(null); }
          else { st.step++; st.ok = false; st.wrong = {}; st.ord = shuffle(range(p.steps[st.step].o.length)); setFbState(null); }
          render();
        }));
      }
    } else {
      pct = 100;
      $("sim-phase").textContent = "Selesai";
      $("sim-title").textContent = p.name + " jadi";
      var all = PROJ.every(function (q) { return doneSet[q.id]; });
      $("sim-text").textContent = p.done + (st.mist ? " Kamu salah pilih " + st.mist + " kali dan sudah memperbaikinya." : " Semua pilihanmu tepat.") + (all ? " Keempat proyek sudah kamu selesaikan." : "");
      warn.hidden = true;
      act.appendChild(btn("Ulangi proyek ini", "", function () { begin(st.p); }));
      var nextI = -1, k;
      for (k = 1; k < PROJ.length; k++) { var ix = (st.p + k) % PROJ.length; if (!doneSet[PROJ[ix].id]) { nextI = ix; break; } }
      if (nextI >= 0) act.appendChild(btn("Coba: " + PROJ[nextI].name, "primary", function () { begin(nextI); }));
    }
    $("sim-bar").style.width = pct + "%";
    var fbEl = $("sim-fb");
    fbEl.hidden = !st.fb;
    if (st.fb) setFb(st.fb[0], st.fb[1], st.fb[2]); else setFb();
  }
  function setFbState(cls, strong, text) { st.fb = cls ? [cls, strong, text] : null; }

  begin(0);
})();
