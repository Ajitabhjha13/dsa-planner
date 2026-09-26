// =========================================================
// CONTEST: timed random questions (TUF / LeetCode virtual contest jaisa)
//
//   Topic contest   : topic 100% done → 3 questions, 2 hours
//   Warm-up contest : category done   → 3 questions, 45 minutes
//   Grand contest   : 2+ topics done  → 3 mixed questions, 90 minutes
//   Weekly contest  : is hafte solve kiye problems se → 3 questions, 2 hours
//   Monthly contest : is mahine solve kiye problems se → 4 questions, 3 hours
//   Review contest  : 🔁 review list se → 3 questions, 90 minutes
//   Speed round     : 5 warm-ups, 15 minutes (tez sochne ki practice)
//   Custom contest  : tum khud banao: topics, count, time, pool, blind mode
//
// Contest chalu hone pe humari website ke baaki features band (focus mode).
// Pass = teeno "Solved", time ke andar. "Couldn't solve" wale → 🔁 Review.
// =========================================================
const CONTEST_RULES = {
  topic: { count: 3, minutes: 120 },
  warmup: { count: 3, minutes: 45 },
  grand: { count: 3, minutes: 90, minTopics: 2 },
  weekly: { count: 3, minutes: 120 },
  monthly: { count: 4, minutes: 180 },
  review: { count: 3, minutes: 90 },
  speed: { count: 5, minutes: 15 },
};

const LEVEL_RANK = { basic: 0, core: 1, pro: 2 };

const Contest = {
  get active() { return Store.state.contest || null; },
  get history() { return (Store.state.contests ??= []); },

  pick(list, n) {
    return shuffle(list).slice(0, n);
  },

  // Easy → tough mein sort karke 3 hisson mein baanto, har hisse se ek random.
  // Pichhle contest ke questions ho sake toh avoid karo.
  pickMixed(pool, n = 3, avoid = new Set()) {
    const rank = p => (LEVEL_RANK[p.level] ?? 1) + (p.babbarLevel === "medium" ? 0.5 : 0) + (p.babbarLevel === "hard" ? 1 : 0);
    const fresh = pool.filter(p => !avoid.has(p.id));
    const src = fresh.length >= n ? fresh : pool;
    const sorted = shuffle(src).sort((a, b) => rank(a) - rank(b));
    const size = Math.ceil(sorted.length / n);
    const out = [];
    for (let i = 0; i < n; i++) {
      const part = sorted.slice(i * size, (i + 1) * size).filter(p => !out.includes(p));
      if (part.length) out.push(part[Math.floor(Math.random() * part.length)]);
    }
    return out;
  },

  lastIds(kind, key) {
    const last = [...this.history].reverse().find(h => h.kind === kind && h.key === key);
    return new Set(last ? last.questions.map(q => q.id) : []);
  },

  // ---------------- UNLOCK CHECKS ----------------
  async topicStatus(topic) {
    const items = (await Data.problems()).filter(p => p.tier === "core" && p.topic === topic);
    const done = items.filter(p => Store.state.progress[p.id]?.status === "done").length;
    return { done, total: items.length, unlocked: items.length > 0 && done === items.length };
  },

  async completedTopics() {
    const problems = (await Data.problems()).filter(p => p.tier === "core");
    const topics = [...new Set(problems.map(p => p.topic))];
    return topics.filter(t => problems.filter(p => p.topic === t).every(p => Store.state.progress[p.id]?.status === "done"));
  },

  async warmupStatus(category) {
    const w = Store.state.warmup;
    const items = (await Data.workbook()).filter(x => x.category === category && Warmup.isActive(x.id));
    const done = items.filter(x => (w.history?.[x.id] || 0) > 0).length;
    return { done, total: items.length, unlocked: items.length > 0 && done === items.length };
  },

  record(kind, key) {
    const h = this.history.filter(x => x.kind === kind && x.key === key);
    return { taken: h.length, passed: h.filter(x => x.passed).length };
  },

  // ---------------- POOLS (weekly / monthly / review) ----------------
  solvedMain(problems) {
    return problems.filter(p => Store.state.progress[p.id]?.status === "done");
  },
  weekKey() { return Tracker.weekKey(todayStr()); },
  monthKey() { return todayStr().slice(0, 7); },

  async specialPool(kind) {
    const problems = await Data.problems();
    if (kind === "weekly") return this.solvedMain(problems).filter(p => (Store.state.progress[p.id].doneOn || "") >= this.weekKey());
    if (kind === "monthly") return this.solvedMain(problems).filter(p => (Store.state.progress[p.id].doneOn || "").startsWith(this.monthKey()));
    if (kind === "review") return problems.filter(p => Store.state.review[p.id]);
    if (kind === "speed") return (await Data.workbook()).filter(x => Warmup.isActive(x.id));
    return [];
  },

  // Custom contest ke liye questions (opts: source, topics, categories, count, pool)
  async customPool(o) {
    const st = id => Store.state.progress[id]?.status;
    const poolOk = (done) => o.pool === "all" || (o.pool === "solved" ? done : !done);
    const out = [];
    if (o.source !== "warmup") {
      (await Data.problems())
        .filter(p => (o.includeAdvanced || p.tier === "core") && (!o.topics.length || o.topics.includes(p.topic)) && poolOk(st(p.id) === "done"))
        .forEach(p => out.push({ ...p, _type: "main" }));
    }
    if (o.source !== "main") {
      const w = Store.state.warmup;
      (await Data.workbook())
        .filter(x => Warmup.isActive(x.id) && (!o.categories.length || o.categories.includes(x.category)) && poolOk((w.history?.[x.id] || 0) > 0))
        .forEach(x => out.push({ ...x, level: "basic", _type: "warmup" }));
    }
    return out;
  },

  // ---------------- START ----------------
  async start(kind, key, opts = null) {
    if (this.active) return;
    let questions = [], name = "", minutes = CONTEST_RULES[kind]?.minutes, blind = false;
    const avoid = this.lastIds(kind, key);

    if (["weekly", "monthly", "review"].includes(kind)) {
      const pool = await this.specialPool(kind);
      questions = this.pickMixed(pool, CONTEST_RULES[kind].count, avoid).map(p => ({ id: p.id, type: "main" }));
      name = { weekly: "Weekly Contest", monthly: "Monthly Contest", review: "Review Contest" }[kind];
      key = kind === "weekly" ? this.weekKey() : kind === "monthly" ? this.monthKey() : "review";
    } else if (kind === "speed") {
      const pool = await this.specialPool("speed");
      questions = this.pick(pool, CONTEST_RULES.speed.count).map(x => ({ id: x.id, type: "warmup" }));
      name = "Speed Round";
      key = "speed";
    } else if (kind === "custom") {
      const pool = await this.customPool(opts);
      const main = pool.filter(p => p._type === "main"), warm = pool.filter(p => p._type === "warmup");
      // "Both" ho toh dono se aadha-aadha
      let pickM = [], pickW = [];
      if (opts.source === "main") pickM = this.pickMixed(main, opts.count, avoid);
      else if (opts.source === "warmup") pickW = this.pick(warm, opts.count);
      else {
        const half = Math.ceil(opts.count / 2);
        pickM = this.pickMixed(main, Math.min(half, main.length), avoid);
        pickW = this.pick(warm, opts.count - pickM.length);
        // Ek taraf kam pade toh doosri taraf se poora karo
        if (pickM.length + pickW.length < opts.count) {
          const more = this.pick(main.filter(p => !pickM.includes(p)), opts.count - pickM.length - pickW.length);
          pickM = [...pickM, ...more];
        }
      }
      questions = [...pickM.map(p => ({ id: p.id, type: "main" })), ...pickW.map(x => ({ id: x.id, type: "warmup" }))];
      name = opts.name || "Custom Contest";
      minutes = opts.minutes;
      blind = !!opts.blind;
      key = opts.templateId || "custom";
    }

    if (kind === "topic") {
      const pool = (await Data.problems()).filter(p => p.tier === "core" && p.topic === key);
      questions = this.pickMixed(pool, CONTEST_RULES.topic.count, avoid).map(p => ({ id: p.id, type: "main" }));
      name = `${key} Contest`;
    } else if (kind === "warmup") {
      const pool = (await Data.workbook()).filter(x => x.category === key && Warmup.isActive(x.id));
      const fresh = pool.filter(x => !avoid.has(x.id));
      questions = this.pick(fresh.length >= 3 ? fresh : pool, CONTEST_RULES.warmup.count).map(x => ({ id: x.id, type: "warmup" }));
      name = `${key} Warm-up Contest`;
    } else if (kind === "grand") {
      const topics = await this.completedTopics();
      const pool = (await Data.problems()).filter(p => p.tier === "core" && topics.includes(p.topic));
      // Alag-alag topics se lo, taaki sach mein "mixed" ho
      const byTopic = shuffle(topics).map(t => pool.filter(p => p.topic === t));
      const picked = [];
      byTopic.slice(0, 3).forEach(list => picked.push(this.pickMixed(list, 1, avoid)[0]));
      while (picked.length < 3) {
        const extra = this.pickMixed(pool.filter(p => !picked.includes(p)), 1, avoid)[0];
        if (!extra) break;
        picked.push(extra);
      }
      questions = picked.filter(Boolean).map(p => ({ id: p.id, type: "main" }));
      name = "Grand Contest";
      key = "grand";
    }
    if (!questions.length) return;

    if (Tracker.timer) Tracker.stopTimer();
    Store.state.contest = {
      kind, key, name, questions, blind,
      startedAt: Date.now(),
      minutes,
      results: {},   // { id: "solved" | "unsolved" }
    };
    Store.save();
    // Pehle se contest page pe ho toh hash nahi badlega, isliye khud render karo
    if (location.hash === "#/contest") await renderRoute();
    else location.hash = "#/contest";
  },

  secondsLeft() {
    const c = this.active;
    if (!c) return 0;
    return Math.max(0, Math.round(c.startedAt / 1000 + c.minutes * 60 - Date.now() / 1000));
  },

  // ---------------- FINISH ----------------
  // reason: "submit" | "timeout" | "giveup"
  finish(reason) {
    const c = this.active;
    if (!c) return null;
    const usedSec = Math.min(c.minutes * 60, Math.round((Date.now() - c.startedAt) / 1000));
    const questions = c.questions.map(q => ({ ...q, result: c.results[q.id] === "solved" ? "solved" : "unsolved" }));
    const passed = reason !== "giveup" && questions.every(q => q.result === "solved");

    // Jo nahi hua, woh review mein
    questions.forEach(q => { if (q.result === "unsolved") Store.state.review[q.id] = true; });

    const entry = {
      kind: c.kind, key: c.key, name: c.name, questions, passed, reason, blind: !!c.blind,
      startedAt: c.startedAt, usedSec, minutes: c.minutes, date: todayStr(),
    };
    this.history.push(entry);
    const log = Tracker.dayLog();
    log.contests++;
    if (passed) log.contestsPassed++;
    log.contestSecs += usedSec;
    log.seconds += usedSec;          // contest ka time bhi padhai ka time hai
    Store.state.lastActive = new Date().toISOString();
    Store.state.contest = null;
    Store.state.lastContestResult = entry;
    Store.save();
    return entry;
  },

  // Har render se pehle: time khatam? toh apne aap submit
  checkTimeout() {
    if (this.active && this.secondsLeft() <= 0) this.finish("timeout");
  },
};

function formatClock(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return `${h ? h + ":" : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s).padStart(2, "0")}`;
}
