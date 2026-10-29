/* Penjaga halaman info (info.html).
   - Hanya peserta yang sudah mengerjakan pre-task yang boleh membuka halaman ini.
   - Saat admin menekan "PAKSA SEMUA USER KE POST-TASK", peserta di halaman ini ikut dipindah.
   - Saat admin menekan Clear memory, peserta kembali ke layar nama.
   index.html (SPA) yang menampilkan layar yang tepat: nama, pre-task, latihan, atau post-task. */
(function () {
  "use strict";
  var KEY = "sim-guest", HOME = "index.html";

  function show() { document.documentElement.classList.remove("wait"); }
  function leave() { location.replace(HOME); }
  function wipe() {
    try { localStorage.removeItem(KEY); localStorage.removeItem("bsp-best"); } catch (e) { }
    leave();
  }

  var guest = null;
  try { guest = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!guest || !guest.uid || !guest.nama) { leave(); return; } // belum masuk sesi

  var socket = io();
  var hasPost = false;

  socket.on("connect", function () { // juga jalan saat sinyal HP putus lalu tersambung lagi
    socket.emit("user:join", { uid: guest.uid, nama: guest.nama, sid: guest.sid }, function (res) {
      if (res && res.reset) return wipe();                       // sesi lama (admin sudah reset)
      hasPost = res.hasPost;
      if (!res.hasPre) return leave();                         // belum pre-task
      if (res.phase === "post" && !res.hasPost) return leave(); // fase post: hanya yang sudah post-task boleh di sini
      show();
    });
  });
  socket.on("phase:change", function (p) { if (p === "post" && !hasPost) leave(); }); // yang sudah post-task tidak diusir
  socket.on("session:reset", wipe);

  setTimeout(show, 10000); // jaring pengaman kalau server lambat merespons
})();
