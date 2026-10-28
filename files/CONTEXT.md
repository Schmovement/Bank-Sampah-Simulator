# Project Context: Bank Sampah Simulator (live-sync)

Handoff document. Paste it into a new chat, or keep it in the repo root, so work can continue without re-explaining.
Contains no secrets. `.env` values are never recorded here.

## 1. What this is
A live classroom experiment for a Civics course at UMN (Indonesia), built by an informatics student.
- 30 to 50 participants at once, mostly on mobile phones, no login. Each participant is a guest who types their name.
- Flow: **name -> pre-task -> simulation (3D sorting game + info page) -> post-task**.
- The admin controls timing. One button forces every active participant from the simulation to the post-task.
- Topic: waste sorting and bank sampah (SDG 12, ecological citizenship). UI text is **Indonesian**.
- The owner writes casually in Indonesian. Reply in the language they use.

## 2. Stack
Node.js >= 18, Express 4, Socket.io 4, MongoDB official driver 6 (MongoDB Atlas), dotenv.
Client: vanilla JS (ES5 style: `var`, `function`), no build step. Three.js r128 from CDN for the 3D game.
Design tokens and dark mode come from `style.css` and `theme.js` (localStorage key `bsp-theme`).

## 3. File structure
```
live-sync/
  .env               MONGODB_URI, ADMIN_KEY (required); DB_NAME (default live_experiment), PORT (default 3000)
  package.json
  server.js          Express + Socket.io + MongoDB, all rules and validation
  quiz-data.js       4 questions: q, o (options), a (correct index), t (explanation). Shared by pre and post.
  CONTEXT.md         this file
  public/
    index.html       SPA: s0 gate, s1 pre-task, s2 3D game, s3 post-task and results
    app.js           SPA logic, socket client, quiz rendering, results panel
    app.css          SPA and admin styles
    pilah.js         3D sorting game (window.initPilah() returns { restart })
    pilah.css        game styles
    style.css        shared design system
    theme.js         light/dark toggle
    admin.html       admin console
    info.html        the original site (info, calculator, recycling crafts, values), without the quiz
    info-guard.js    session guard for info.html
    script.js        calculator script for info.html
```

## 4. Phases and participant flow
Server phase is `"simulator"` or `"post"` (persisted in MongoDB, survives restarts).

`app.js` `route()`:
- no guest identity -> s0 (name)
- no pre-task yet -> s1
- phase `post` -> s3 (results if already finished, otherwise the post-task quiz), otherwise s2 (game)
- So when the admin returns the phase to `simulator`, participants who already finished post-task go back to the simulation too (`info.html` also allows them in that phase).
- When the phase goes to `post` again, `app.js` calls `join()` for finished participants to refresh `result` (leaderboard).

Inside the simulation stage the participant moves freely between `index.html` (game) and `info.html`.
The result panel of the game offers "Main lagi" and "Buka halaman info".
When the admin forces post, everyone is moved to s3, including people on `info.html`.

Client storage: `sim-guest` = `{ uid, nama, sid }` (uid is random hex made in the browser; sid is the session id from the server).
`bsp-best` = local best game score. It is wiped on reset and when a new guest enters.

## 5. Game rules (`pilah.js`)
- 12 items, drag to one of 4 bins (organik, anorganik, residu, B3) or tap the bin buttons.
- Score = items correct on the **first drop**.
- A wrong drop returns the item and the player retries. Right after a correct drop the game **auto-advances** after `AUTO_NEXT_MS = 1200`. There is no next button.
- On finish it dispatches `window` event `pilah:finish` with `{ skor, total }`. `app.js` forwards it as `game:score`.

## 6. Database (database `live_experiment`)
- `users`, `_id` = uid:
  `{ nama, createdAt, lastSeen, pre: { jawaban: [idx x4], skor }, preAt, post: { jawaban, skor }, postAt, game: { first, firstMs, best, total, plays, lastAt } }`
- `state`, one doc `_id: "session"`: `{ phase, sessionId }`
- `users_archive`: copies of `users` made on Clear memory (field `uid`, `archivedAt`)

## 7. Socket events and HTTP
Client to server:
- `user:join { uid, nama, sid }` -> ack `{ ok, sid, phase, hasPre, hasPost, quiz, result }` or `{ ok:false, reset:true }`
- `pre:submit { jawaban }`, `post:submit { jawaban }` -> ack `{ ok, duplicate?, phase?, result? }`
- `game:score { skor, total }`
- Admin: `admin:auth(key)`, `admin:set-phase("simulator"|"post")`, `admin:reset`

Server to client: `phase:change`, `session:reset`, `stats` (admins room only: phase, online, total, preDone, postDone).
HTTP: `GET /api/export` with header `x-admin-key` returns all users as JSON. Static files are served from `public/`.

## 8. Server rules (all enforced in `server.js`)
- **Pre-task** is saved once only (`pre` must not exist). A resend returns `duplicate: true`.
- **Post-task** needs phase `post`, an existing `pre`, and no existing `post`. The answer key never leaves the server.
- **Answers are hidden until post-task is saved.** Only then does the server return `result`:
  `{ skor, preSkor, total, game: { best, first, total, plays }, review: [{ picked, prePicked, a, t }], top }`.
- **`game:score { skor, total, ms? }`** is accepted only after pre and before post (people who finished post-task can replay, but nothing is saved). It writes `game.first` and `game.firstMs` **once** (first play only), keeps `game.best` as the max, and increments `plays`.
  Range check: integers, `0 <= skor <= total <= 50`. `ms` is play time measured in the browser (first touch/click in the game area until `pilah:finish`); valid range 1 to 3,600,000, otherwise stored as null (ranked slowest on ties).
- **`top`** = top 3 by `game.first` (first play only), ties broken by shortest `game.firstMs`, then name. Shape: `{ list: [{ rank, nama, skor, total, ms, me }], myRank, count }`. It is null if nobody scored at least 1. Repeat plays never count.
- **Session id:** every Clear memory creates a new `sessionId`. A browser or socket with an old `sid` gets `reset:true` and returns to the name screen.
- Admin events need a successful `admin:auth` (ADMIN_KEY, constant-time compare). 5 failures disconnect the socket.
- Input is validated and trimmed (name 2 to 60 chars). Names are rendered with `textContent`. Socket payload cap is about 100 KB.

## 9. Admin console (`admin.html`)
Login with ADMIN_KEY. Shows phase and counters (online, registered, pre done, post done). Buttons:
- **PAKSA SEMUA USER KE POST-TASK**
- **Kembalikan ke Simulator**
- **Unduh data (JSON)**
- **Clear memory (reset kuis)**: asks to type `RESET`, archives to `users_archive`, deletes `users`, sets a new `sessionId`, sets phase to simulator, and emits `session:reset` (everyone returns to the name screen).

## 10. Decisions made so far
- Firebase was tried first and then dropped. The final stack is Node + Express + Socket.io + MongoDB Atlas.
- Pre and post use the same 4 questions (`quiz-data.js`) so scores are comparable.
- The quiz was removed from `info.html` because it showed correct answers immediately.
- The leaderboard is now a **top 3** (first-try score, fastest time as tiebreaker), first play only. An earlier version showed only the single best score and used the best of all plays, which was wrong.
- The results panel after post-task shows pre score, post score, personal best game score, the leaderboard box, and a per-question review that includes the participant's pre-task answer.
- The leaderboard shows other participants' names as typed. The owner asked for this.

## 11. Environment and status
- Developer machine: Windows, Node.js installed, `npm install` done, server runs locally at http://localhost:3000.
- Atlas cluster is created. A database user with read/write is set. IP access list is `0.0.0.0/0`. The connection string is in `.env`.
- Run: `npm start`. After editing `server.js`, stop with Ctrl + C and start again. Hard refresh the browser (Ctrl + F5).
- Pages: `/` (participants), `/admin.html`, `/info.html` (participants only, after pre-task).

## 12. Known limitations and open items
- **Not deployed yet.** It runs on localhost only. Phones need a Node host (Render or Railway). Static hosts such as GitHub Pages will not work.
  Free Render sleeps when idle, so open it a few minutes before the session.
- Game scores come from the browser. The server checks the range but cannot prove the game was played.
- `game.first` is the first `game:score` event the server receives. If that first event is lost to a network failure, a later play becomes "first".
- Play time is measured in the browser, so like the score it can be faked. Documents created before `game.first` existed are ignored by the leaderboard, and ones without `game.firstMs` rank slowest on ties. Run Clear memory before a real session.
- `info.html` text still covers the quiz topics (bilas botol, SDG 12, kewargaan ekologis). That is intended as learning material between pre and post.
- Logic that touches MongoDB was unit-tested with mocks only (result building, leaderboard, score validation). It has not been verified end to end against a real database, and there are no automated tests in the repo.
- The `Online` counter counts sockets in the users room. Page navigation reconnects the socket, so it can flicker.

## 13. Conventions
- Comments are in Indonesian, UI strings in Indonesian.
- Client JS stays ES5 style and uses `textContent`, never `innerHTML` with user data.
- Do not change server rules without checking the client flow in section 4.
- Never print, log or commit the contents of `.env`.

## 14. How to start a new session
Say: "Read CONTEXT.md. I want to continue the live-sync project." Then describe the next change.
Likely next steps: deploy to Render, a rehearsal with 5 to 10 phones, tune the pre/post questions, decide whether names should be shown in the leaderboard.
