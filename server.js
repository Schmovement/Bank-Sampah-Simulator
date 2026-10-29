require("dotenv").config();
const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const QUIZ = require("./quiz-data");

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "live_experiment";
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!MONGODB_URI || !ADMIN_KEY) {
  console.error("MONGODB_URI dan ADMIN_KEY wajib diisi di file .env");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5 }); // payload maks ~100 KB
app.use(express.static(path.join(__dirname, "public")));

/* ---------- helpers ---------- */
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const validAdmin = (key) => typeof key === "string" && crypto.timingSafeEqual(sha(key), sha(ADMIN_KEY));
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isUid = (v) => typeof v === "string" && /^[a-z0-9]{16,40}$/.test(v);
const noop = () => { };
const MAX_MS = 3600000; // batas wajar waktu satu permainan: 1 jam

/* Pre-task dan post-task memakai soal yang sama (quiz-data.js).
   Kunci jawaban hanya ada di server; browser menerima pertanyaan dan pilihan saja. */
const PUBLIC_QUIZ = QUIZ.map(({ q, o }) => ({ q, o }));

function cleanQuiz(d) {
  if (!d || typeof d !== "object" || !Array.isArray(d.jawaban) || d.jawaban.length !== QUIZ.length) return null;
  for (let i = 0; i < QUIZ.length; i++) {
    const j = d.jawaban[i];
    if (!Number.isInteger(j) || j < 0 || j >= QUIZ[i].o.length) return null;
  }
  const jawaban = d.jawaban.slice();
  const skor = jawaban.reduce((n, j, i) => n + (j === QUIZ[i].a ? 1 : 0), 0);
  return { jawaban, skor };
}

// hasil lengkap, dikirim hanya setelah post-task tersimpan: skor pre, skor post, skor terbaik
// latihan memilah, serta pembahasan tiap soal (jawaban pre dan post disandingkan dengan kunci)
function buildResult(doc) {
  if (!doc || !doc.post || !Array.isArray(doc.post.jawaban)) return null;
  const prePicks = doc.pre && Array.isArray(doc.pre.jawaban) ? doc.pre.jawaban : [];
  const g = doc.game && Number.isInteger(doc.game.best) ? doc.game : null;
  return {
    skor: doc.post.skor,
    preSkor: doc.pre && Number.isInteger(doc.pre.skor) ? doc.pre.skor : null,
    total: QUIZ.length,
    game: g ? { best: g.best, first: Number.isInteger(g.first) ? g.first : null, total: g.total, plays: g.plays || 0 } : null,
    review: QUIZ.map((it, i) => ({
      picked: doc.post.jawaban[i],
      prePicked: Number.isInteger(prePicks[i]) ? prePicks[i] : -1,
      a: it.a,
      t: it.t
    }))
  };
}

// top 3 permainan PERTAMA (game.first): skor tertinggi dulu, seri dipecah waktu tercepat (game.firstMs), lalu nama.
// Data tanpa waktu dianggap paling lambat. Permainan ulang tidak dihitung, supaya adil bagi yang baru main sekali.
async function topScorers(uid) {
  const docs = await users.find(
    { "game.first": { $gte: 1 } },
    { projection: { nama: 1, "game.first": 1, "game.firstMs": 1, "game.total": 1 } }
  ).toArray();
  if (!docs.length) return null; // belum ada yang mencetak skor
  const ms = (d) => (Number.isInteger(d.game.firstMs) ? d.game.firstMs : Infinity);
  docs.sort((x, y) => (y.game.first - x.game.first) || (ms(x) - ms(y)) || String(x.nama).localeCompare(String(y.nama)));
  const rows = docs.map((d, i) => ({
    rank: i + 1, nama: d.nama, skor: d.game.first, total: d.game.total,
    ms: Number.isInteger(d.game.firstMs) ? d.game.firstMs : null, me: d._id === uid
  }));
  const mine = rows.find((r) => r.me);
  return { list: rows.slice(0, 3), myRank: mine ? mine.rank : null, count: rows.length };
}

// hasil lengkap + peserta terbaik. Kegagalan mengambil peserta terbaik tidak boleh menggagalkan penyimpanan post-task.
async function resultFor(doc, uid) {
  const r = buildResult(doc);
  if (!r) return null;
  try { r.top = await topScorers(uid); } catch (e) { console.error("top:", e.message); r.top = null; }
  return r;
}

/* ---------- state + database ---------- */
let users, state, archive;
let phase = "simulator"; // "simulator" | "post"
let sessionId = crypto.randomBytes(8).toString("hex"); // berganti setiap admin menekan reset

let statsTimer = null;
function pushStats() {
  if (statsTimer) return; // gabungkan banyak event jadi satu update
  statsTimer = setTimeout(async () => {
    statsTimer = null;
    try {
      const [total, preDone, postDone] = await Promise.all([
        users.countDocuments({}),
        users.countDocuments({ pre: { $exists: true } }),
        users.countDocuments({ post: { $exists: true } })
      ]);
      const room = io.sockets.adapter.rooms.get("users");
      io.to("admins").emit("stats", { phase, online: room ? room.size : 0, total, preDone, postDone });
    } catch (e) { console.error("stats:", e.message); }
  }, 300);
}

/* ---------- socket.io ---------- */
io.on("connection", (socket) => {
  /* user masuk / masuk kembali (refresh, sinyal putus) */
  socket.on("user:join", async (p, ack = noop) => {
    try {
      const uid = p && p.uid, nama = str(p && p.nama, 60);
      const sid = p && p.sid;
      if (!isUid(uid) || nama.length < 2) return ack({ ok: false, error: "Nama atau ID tidak valid." });
      if (sid) {
        if (sid !== sessionId) return ack({ ok: false, reset: true }); // browser dari sesi lama
      } else if (await users.findOne({ _id: uid }, { projection: { _id: 1 } })) {
        return ack({ ok: false, reset: true }); // ID lama tanpa tanda sesi
      }
      socket.data.uid = uid;
      socket.data.sid = sessionId;
      socket.join("users");
      // upsert: dokumen dibuat sekali per User ID, selanjutnya hanya diperbarui
      await users.updateOne(
        { _id: uid },
        { $set: { nama, lastSeen: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      );
      const doc = await users.findOne({ _id: uid }, { projection: { pre: 1, post: 1, game: 1 } });
      const result = await resultFor(doc, uid);
      ack({ ok: true, sid: sessionId, phase, hasPre: !!doc.pre, hasPost: !!doc.post, quiz: PUBLIC_QUIZ, result });
      pushStats();
    } catch (e) { console.error("join:", e.message); ack({ ok: false, error: "Server bermasalah." }); }
  });

  /* simpan pre-task: hanya sekali, tidak bisa ditimpa */
  socket.on("pre:submit", async (data, ack = noop) => {
    try {
      const uid = socket.data.uid;
      if (!uid) return ack({ ok: false, error: "Belum masuk sesi." });
      if (socket.data.sid !== sessionId) return ack({ ok: false, reset: true });
      const pre = cleanQuiz(data);
      if (!pre) return ack({ ok: false, error: "Jawaban belum lengkap atau tidak valid." });
      const r = await users.updateOne(
        { _id: uid, pre: { $exists: false } },
        { $set: { pre, preAt: new Date() } }
      );
      ack({ ok: true, duplicate: r.matchedCount === 0, phase }); // kirim ulang = aman
      pushStats();
    } catch (e) { console.error("pre:", e.message); ack({ ok: false, error: "Gagal menyimpan." }); }
  });

  /* simpan post-task: update dokumen yang sama, data pre-task tidak disentuh */
  socket.on("post:submit", async (data, ack = noop) => {
    try {
      const uid = socket.data.uid;
      if (!uid) return ack({ ok: false, error: "Belum masuk sesi." });
      if (socket.data.sid !== sessionId) return ack({ ok: false, reset: true });
      if (phase !== "post") return ack({ ok: false, error: "Post-task belum dibuka admin." });
      const post = cleanQuiz(data);
      if (!post) return ack({ ok: false, error: "Jawaban belum lengkap atau tidak valid." });
      const doc = await users.findOneAndUpdate(
        { _id: uid, pre: { $exists: true }, post: { $exists: false } },
        { $set: { post, postAt: new Date() } },
        { returnDocument: "after", projection: { pre: 1, post: 1, game: 1 } }
      );
      if (!doc) {
        const cur = await users.findOne({ _id: uid }, { projection: { pre: 1, post: 1, game: 1 } });
        if (cur && cur.post) return ack({ ok: true, duplicate: true, result: await resultFor(cur, uid) });
        return ack({ ok: false, error: "Selesaikan pre-task terlebih dahulu." });
      }
      ack({ ok: true, result: await resultFor(doc, uid) });
      pushStats();
    } catch (e) { console.error("post:", e.message); ack({ ok: false, error: "Gagal menyimpan." }); }
  });

  /* skor latihan memilah: simpan skor permainan pertama (sekali), skor terbaik pribadi, dan jumlah permainan.
     Setelah post-task tersimpan, skor tidak diubah lagi. */
  socket.on("game:score", async (data, ack = noop) => {
    try {
      const uid = socket.data.uid;
      if (!uid) return ack({ ok: false, error: "Belum masuk sesi." });
      if (socket.data.sid !== sessionId) return ack({ ok: false, reset: true });
      const skor = data && data.skor, total = data && data.total;
      const ms = data && data.ms;
      const msOk = Number.isInteger(ms) && ms >= 1 && ms <= MAX_MS ? ms : null; // waktu tidak valid: dianggap paling lambat
      if (!Number.isInteger(skor) || !Number.isInteger(total) || total < 1 || total > 50 || skor < 0 || skor > total) {
        return ack({ ok: false, error: "Skor tidak valid." });
      }
      const mine = { _id: uid, pre: { $exists: true }, post: { $exists: false } };
      // skor + waktu permainan pertama: ditulis sekali saja, tidak pernah diubah oleh permainan berikutnya
      await users.updateOne({ ...mine, "game.first": { $exists: false } }, { $set: { "game.first": skor, "game.firstMs": msOk } });
      // skor terbaik pribadi (hanya naik) dan jumlah permainan
      await users.updateOne(mine, { $max: { "game.best": skor }, $set: { "game.total": total, "game.lastAt": new Date() }, $inc: { "game.plays": 1 } });
      ack({ ok: true });
    } catch (e) { console.error("game:", e.message); ack({ ok: false, error: "Gagal menyimpan." }); }
  });

  /* ---- admin ---- */
  socket.on("admin:auth", (key, ack = noop) => {
    if (!validAdmin(key)) {
      socket.data.fails = (socket.data.fails || 0) + 1;
      ack({ ok: false });
      if (socket.data.fails >= 5) socket.disconnect(true);
      return;
    }
    socket.data.admin = true;
    socket.join("admins");
    ack({ ok: true });
    pushStats();
  });

  socket.on("admin:set-phase", async (next, ack = noop) => {
    try {
      if (!socket.data.admin) return ack({ ok: false, error: "Unauthorized" });
      if (!["simulator", "post"].includes(next)) return ack({ ok: false, error: "Phase tidak valid" });
      phase = next;
      await state.updateOne({ _id: "session" }, { $set: { phase } }, { upsert: true });
      io.to("users").emit("phase:change", phase); // broadcast ke semua user aktif
      ack({ ok: true, phase });
      pushStats();
    } catch (e) { console.error("set-phase:", e.message); ack({ ok: false, error: "Server bermasalah." }); }
  });

  socket.on("admin:goto-info", (ack = noop) => {
    if (!socket.data.admin) return ack({ ok: false, error: "Unauthorized" });
    console.log("admin menekan tombol info");
    io.to("users").emit("goto:info");
    ack({ ok: true });
  });

  /* clear memory: arsipkan semua data user, hapus, lalu mulai sesi baru dari awal */
  socket.on("admin:reset", async (ack = noop) => {
    try {
      if (!socket.data.admin) return ack({ ok: false, error: "Unauthorized" });
      const docs = await users.find({}).toArray();
      if (docs.length) {
        const now = new Date();
        await archive.insertMany(docs.map(({ _id, ...rest }) => ({ ...rest, uid: _id, archivedAt: now })));
      }
      await users.deleteMany({});
      phase = "simulator";
      sessionId = crypto.randomBytes(8).toString("hex");
      await state.updateOne({ _id: "session" }, { $set: { phase, sessionId } }, { upsert: true });
      io.to("users").emit("session:reset"); // semua user kembali ke Screen 0
      ack({ ok: true, cleared: docs.length });
      pushStats();
    } catch (e) { console.error("reset:", e.message); ack({ ok: false, error: "Server bermasalah." }); }
  });

  socket.on("disconnect", () => { if (socket.data.uid) pushStats(); });
});

/* ---------- export hasil (khusus admin) ---------- */
app.get("/api/export", async (req, res) => {
  if (!validAdmin(req.get("x-admin-key"))) return res.status(401).json({ error: "Unauthorized" });
  try {
    const docs = await users.find({}).sort({ createdAt: 1 }).toArray();
    res.setHeader("Content-Disposition", 'attachment; filename="hasil.json"');
    res.json(docs);
  } catch (e) { res.status(500).json({ error: "Server bermasalah." }); }
});

/* ---------- start ---------- */
(async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  users = db.collection("users");
  state = db.collection("state");
  archive = db.collection("users_archive");
  const saved = await state.findOne({ _id: "session" });
  if (saved && saved.phase) phase = saved.phase; // phase bertahan walau server restart
  if (saved && saved.sessionId) sessionId = saved.sessionId;
  else await state.updateOne({ _id: "session" }, { $set: { phase, sessionId } }, { upsert: true });
  server.listen(PORT, () => console.log("Server jalan di http://localhost:" + PORT + " (phase: " + phase + ")"));
})().catch((e) => { console.error("Gagal start:", e.message); process.exit(1); });
