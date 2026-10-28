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
const noop = () => {};

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

// hasil post-task beserta pembahasan; dikirim hanya setelah post-task tersimpan
function buildResult(doc) {
  if (!doc || !doc.post || !Array.isArray(doc.post.jawaban)) return null;
  return {
    skor: doc.post.skor,
    preSkor: doc.pre && Number.isInteger(doc.pre.skor) ? doc.pre.skor : null,
    total: QUIZ.length,
    review: QUIZ.map((it, i) => ({ picked: doc.post.jawaban[i], a: it.a, t: it.t }))
  };
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
      const doc = await users.findOne({ _id: uid }, { projection: { pre: 1, post: 1 } });
      ack({ ok: true, sid: sessionId, phase, hasPre: !!doc.pre, hasPost: !!doc.post, quiz: PUBLIC_QUIZ, result: buildResult(doc) });
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
        { returnDocument: "after", projection: { pre: 1, post: 1 } }
      );
      if (!doc) {
        const cur = await users.findOne({ _id: uid }, { projection: { pre: 1, post: 1 } });
        if (cur && cur.post) return ack({ ok: true, duplicate: true, result: buildResult(cur) });
        return ack({ ok: false, error: "Selesaikan pre-task terlebih dahulu." });
      }
      ack({ ok: true, result: buildResult(doc) });
      pushStats();
    } catch (e) { console.error("post:", e.message); ack({ ok: false, error: "Gagal menyimpan." }); }
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
