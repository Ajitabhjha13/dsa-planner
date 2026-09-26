// =========================================================
// INSIGHTS: dashboard ke "smart" hisse
//   - Topic mastery, Weak areas
//   - Problem of the Day, Continue where you left off
//   - Countdown / pace, Confidence history
//   - Achievements (badges)
// =========================================================
const MASTERY_LEVELS = ["Not started", "Started", "Familiar", "Proficient", "Mastered"];

const Insights = {
  st(id) { return Store.state.progress[id]?.status; },

  // ---------------- TOPIC MASTERY ----------------
  // Not started → Started → Familiar (50%+) → Proficient (100%) → Mastered (100% + topic contest passed)
  async mastery() {
    const core = (await Data.problems()).filter(p => p.tier === "core");
    const topics = [...new Set(core.map(p => p.topic))];
    return topics.map(t => {
      const items = core.filter(p => p.topic === t);
      const done = items.filter(p => this.st(p.id) === "done").length;
      const pct = Math.round((done / items.length) * 100);
      let level = done === 0 ? 0 : pct < 50 ? 1 : pct < 100 ? 2 : 3;
      if (level === 3 && Contest.record("topic", t).passed) level = 4;
      return { topic: t, done, total: items.length, pct, level };
    });
  },

  // ---------------- WEAK AREAS ----------------
  // Score = 🔁 review ×2 + "help li" ×2 + estimate se 1.5× zyada time ×1
  async weakAreas() {
    const core = (await Data.problems()).filter(p => p.tier === "core");
    const byTopic = {};
    core.forEach(p => {
      const t = (byTopic[p.topic] ??= { topic: p.topic, review: 0, help: 0, slow: 0 });
      if (Store.state.review[p.id]) t.review++;
      if (Store.state.notes[p.id]?.help === "help") t.help++;
      const pr = Store.state.progress[p.id];
      if (pr?.status === "done" && pr.timeSpent > p.minutes * 60 * 1.5) t.slow++;
    });
    return Object.values(byTopic)
      .map(t => ({ ...t, score: t.review * 2 + t.help * 2 + t.slow }))
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  },

  // ---------------- PROBLEM OF THE DAY ----------------
  // Sirf wahi problems jo tum SOLVE kar chuke ho (roz ek revision).
  // Order: 🔁 review wale → "help li" wale → sabse purane solve kiye hue → baaki solved.
  // Pure din wahi rehta hai.
  async problemOfTheDay() {
    const today = todayStr();
    const solved = (await Data.problems()).filter(p => this.st(p.id) === "done");
    const saved = Store.state.potd;
    if (saved?.date === today && saved.rule === 3) return solved.find(x => x.id === saved.id) || null;
    if (!solved.length) return null;

    const seed = [...today].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const pickFrom = list => list.length ? list[seed % list.length] : null;
    const last = new Set((Store.state.potdHistory || []).slice(-7)); // pichhle 7 din wale dobara nahi
    const fresh = solved.filter(p => !last.has(p.id));
    const base = fresh.length ? fresh : solved;
    const oldest = [...base].sort((a, b) => (Store.state.progress[a.id].doneOn || "").localeCompare(Store.state.progress[b.id].doneOn || "")).slice(0, 10);
    const pick = pickFrom(base.filter(p => Store.state.review[p.id]))
      || pickFrom(base.filter(p => Store.state.notes[p.id]?.help === "help"))
      || pickFrom(oldest)
      || pickFrom(base);
    Store.state.potd = { date: today, id: pick.id, rule: 3 };
    (Store.state.potdHistory ??= []).push(pick.id);
    Store.save();
    return pick;
  },

  // ---------------- CONTINUE WHERE YOU LEFT OFF ----------------
  async continueItem() {
    const t = Tracker.timer;
    const problems = await Data.problems();
    const videos = Store.state.videos?.items || [];
    const find = id => {
      const p = problems.find(x => x.id === id);
      if (p) return { id, type: "main", title: p.title, sub: `${formatDuration(Tracker.timeSpent(id))} spent` };
      const v = videos.find(x => x.id === id);
      if (v) {
        const at = Store.state.progress[id]?.resumeAt || 0;
        return { id, type: "lecture", title: `${v.position}. ${v.title}`, sub: at ? `Resume at ${VideosPage.fmtClock(at)}` : "In progress",
          href: YouTube.watchUrl(v.videoId, at) };
      }
      return null;
    };
    if (t) { const x = find(t.taskId); if (x) return { ...x, running: true }; }
    const cands = Object.entries(Store.state.progress)
      .filter(([id, pr]) => pr.lastTouched && pr.status !== "done" && pr.status !== "skipped" && (pr.timeSpent > 0 || pr.resumeAt))
      .sort((a, b) => b[1].lastTouched - a[1].lastTouched);
    for (const [id] of cands) { const x = find(id); if (x) return x; }
    return null;
  },

  // ---------------- COUNTDOWN ----------------
  async countdown() {
    const s = Store.settings;
    const today = parseDate(todayStr()), target = parseDate(s.targetDate);
    const daysLeft = Math.max(0, daysBetween(today, target));
    let studyDays = 0;
    for (let d = new Date(today); d <= target; d = addDays(d, 1)) if (s.hours[DAY_KEYS[d.getDay()]] > 0) studyDays++;
    const pending = (await Data.problems()).filter(p => p.tier === "core" && this.st(p.id) !== "done" && this.st(p.id) !== "skipped").length;
    return { daysLeft, pace: studyDays ? pending / studyDays : pending, pending };
  },

  // ---------------- CONFIDENCE OVER TIME ----------------
  // Har contest ke baad: pichhle 5 contests ka confidence (dashboard wala formula)
  confidenceHistory() {
    const h = Contest.history;
    return h.map((_, i) => {
      const recent = h.slice(Math.max(0, i - 4), i + 1);
      const solved = recent.reduce((a, x) => a + x.questions.filter(q => q.result === "solved").length / x.questions.length, 0) / recent.length;
      const pass = recent.filter(x => x.passed).length / recent.length;
      return Math.round(solved * 70 + pass * 30);
    });
  },

  sparkline(values) {
    if (values.length < 2) return `<p class="muted small">The graph appears after 2 contests.</p>`;
    const w = 240, h = 60, pad = 4;
    const pts = values.map((v, i) => `${pad + (i * (w - pad * 2)) / (values.length - 1)},${h - pad - (v / 100) * (h - pad * 2)}`);
    const last = pts[pts.length - 1].split(",");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Confidence over time">
      <line x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}" stroke="var(--line)" stroke-dasharray="3 4"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="var(--accent)"/></svg>`;
  },

  // ---------------- ACHIEVEMENTS ----------------
  async context() {
    const problems = await Data.problems();
    const core = problems.filter(p => p.tier === "core");
    const log = Store.state.log;
    const videos = (Store.state.videos?.items || []).filter(v => v.tier === "core");
    const mastery = await this.mastery();
    let sprintsDone = 0;
    if (Store.state.videos?.items?.length) {
      VideosPage.ensureSprintSettings();
      sprintsDone = VideosPage.buildSprints(Store.state.videos.items).filter(s => s.complete).length;
    }
    return {
      solved: problems.filter(p => this.st(p.id) === "done").length,
      coreTotal: core.length,
      coreSolved: core.filter(p => this.st(p.id) === "done").length,
      best: Tracker.bestStreak(),
      hours: Object.values(log).reduce((a, l) => a + (l.seconds || 0), 0) / 3600,
      contestsPassed: Contest.history.filter(h => h.passed).length,
      grandPassed: Contest.history.some(h => h.kind === "grand" && h.passed) ? 1 : 0,
      lecturesDone: videos.filter(v => this.st(v.id) === "done" || this.st(v.id) === "skipped").length,
      lecturesTotal: videos.length,
      sprintsDone,
      warmRounds: Math.max(0, (Store.state.warmup.round || 1) - 1) + (Store.state.warmup.mode === "review" ? 1 : 0),
      mastered: mastery.filter(m => m.level === 4).length,
      lecturesWatched: videos.filter(v => this.st(v.id) === "done").length,
      rewatched: videos.filter(v => this.st(v.id) === "done" && Store.state.review[v.id]).length,
      contestsTaken: Contest.history.length,
      weeklyPassed: Contest.history.filter(h => h.kind === "weekly" && h.passed).length,
      monthlyPassed: Contest.history.filter(h => h.kind === "monthly" && h.passed).length,
      customTaken: Contest.history.filter(h => h.kind === "custom").length,
      blindPassed: Contest.history.filter(h => h.blind && h.passed).length,
      speedPassed: Contest.history.filter(h => h.kind === "speed" && h.passed).length,
      fastPass: Contest.history.filter(h => h.passed && h.usedSec <= h.minutes * 30).length,
      winRun: (() => { let best = 0, run = 0; Contest.history.forEach(h => { run = h.passed ? run + 1 : 0; best = Math.max(best, run); }); return best; })(),
      reflections: Object.values(log).filter(l => l.reflection?.trim()).length,
    };
  },

  BADGES: [
    { id: "first", cat: "problems", icon: "🚀", name: "First Step", rarity: "common", desc: "Solve your first problem", v: c => c.solved, goal: 1 },
    { id: "p25", cat: "problems", icon: "🌱", name: "Getting Going", rarity: "common", desc: "Solve 25 problems", v: c => c.solved, goal: 25 },
    { id: "p50", cat: "problems", icon: "🔥", name: "Half Century", rarity: "rare", desc: "Solve 50 problems", v: c => c.solved, goal: 50 },
    { id: "p100", cat: "problems", icon: "💯", name: "Century", rarity: "epic", desc: "Solve 100 problems", v: c => c.solved, goal: 100 },
    { id: "p200", cat: "problems", icon: "🏔️", name: "Mountain Climber", rarity: "legendary", desc: "Solve 200 problems", v: c => c.solved, goal: 200 },
    { id: "plan", cat: "problems", icon: "👑", name: "Plan Complete", rarity: "legendary", desc: "Finish every problem in the Plan", v: c => c.coreSolved, goal: c => c.coreTotal },
    { id: "s7", cat: "habit", icon: "📅", name: "One Week Strong", rarity: "rare", desc: "Reach a 7-day streak", v: c => c.best, goal: 7 },
    { id: "s30", cat: "habit", icon: "🗓️", name: "Unstoppable", rarity: "legendary", desc: "Reach a 30-day streak", v: c => c.best, goal: 30 },
    { id: "h10", cat: "habit", icon: "⏱️", name: "10 Hours In", rarity: "common", desc: "Study for 10 hours", v: c => Math.floor(c.hours), goal: 10 },
    { id: "h50", cat: "habit", icon: "⌛", name: "Deep Worker", rarity: "rare", desc: "Study for 50 hours", v: c => Math.floor(c.hours), goal: 50 },
    { id: "h100", cat: "habit", icon: "🧠", name: "100-Hour Club", rarity: "epic", desc: "Study for 100 hours", v: c => Math.floor(c.hours), goal: 100 },
    { id: "c1", cat: "contests", icon: "🏆", name: "First Win", rarity: "rare", desc: "Pass your first contest", v: c => c.contestsPassed, goal: 1 },
    { id: "c5", cat: "contests", icon: "🥇", name: "Contest Regular", rarity: "epic", desc: "Pass 5 contests", v: c => c.contestsPassed, goal: 5 },
    { id: "grand", cat: "contests", icon: "🎖️", name: "Grand Champion", rarity: "legendary", desc: "Pass a Grand Contest", v: c => c.grandPassed, goal: 1 },
    { id: "sprint1", cat: "lectures", icon: "🎬", name: "Sprint Finisher", rarity: "rare", desc: "Complete a lecture sprint", v: c => c.sprintsDone, goal: 1 },
    { id: "lec", cat: "lectures", icon: "📺", name: "Binge Learner", rarity: "epic", desc: "Finish every lecture in the Plan", v: c => c.lecturesDone, goal: c => c.lecturesTotal || 1 },
    { id: "warm", cat: "mastery", icon: "⚡", name: "Warmed Up", rarity: "common", desc: "Complete a full warm-up round", v: c => c.warmRounds, goal: 1 },
    { id: "m1", cat: "mastery", icon: "⭐", name: "Topic Master", rarity: "epic", desc: "Master your first topic", v: c => c.mastered, goal: 1 },
    { id: "m5", cat: "mastery", icon: "🌟", name: "Five-Star", rarity: "legendary", desc: "Master 5 topics", v: c => c.mastered, goal: 5 },
    { id: "l1", cat: "lectures", icon: "▶️", name: "Lights, Camera", rarity: "common", desc: "Watch your first lecture", v: c => c.lecturesWatched, goal: 1 },
    { id: "l25", cat: "lectures", icon: "🍿", name: "Binge Starter", rarity: "rare", desc: "Watch 25 lectures", v: c => c.lecturesWatched, goal: 25 },
    { id: "l50", cat: "lectures", icon: "🎞️", name: "Halfway Hero", rarity: "epic", desc: "Watch 50 lectures", v: c => c.lecturesWatched, goal: 50 },
    { id: "sp3", cat: "lectures", icon: "🏃", name: "Sprint Streak", rarity: "rare", desc: "Complete 3 lecture sprints", v: c => c.sprintsDone, goal: 3 },
    { id: "rw", cat: "lectures", icon: "🔁", name: "Second Look", rarity: "common", desc: "Rewatch a lecture you marked 🔁", v: c => c.rewatched, goal: 1 },
    { id: "ct1", cat: "contests", icon: "🎟️", name: "Brave Beginner", rarity: "common", desc: "Take your first contest", v: c => c.contestsTaken, goal: 1 },
    { id: "wk", cat: "contests", icon: "📅", name: "Weekly Warrior", rarity: "rare", desc: "Pass a Weekly Contest", v: c => c.weeklyPassed, goal: 1 },
    { id: "mo", cat: "contests", icon: "🗓️", name: "Monthly Master", rarity: "epic", desc: "Pass a Monthly Contest", v: c => c.monthlyPassed, goal: 1 },
    { id: "cu", cat: "contests", icon: "🛠️", name: "Contest Architect", rarity: "common", desc: "Take a contest you designed yourself", v: c => c.customTaken, goal: 1 },
    { id: "bl", cat: "contests", icon: "🙈", name: "Blindfolded", rarity: "epic", desc: "Pass a contest in Blind mode", v: c => c.blindPassed, goal: 1 },
    { id: "sd", cat: "contests", icon: "⚡", name: "Lightning Fingers", rarity: "rare", desc: "Pass a Speed Round", v: c => c.speedPassed, goal: 1 },
    { id: "fast", cat: "contests", icon: "🚀", name: "Speedster", rarity: "epic", desc: "Pass a contest using less than half the time", v: c => c.fastPass, goal: 1 },
    { id: "run3", cat: "contests", icon: "🔥", name: "Hat-trick", rarity: "legendary", desc: "Pass 3 contests in a row", v: c => c.winRun, goal: 3 },
    { id: "r7", cat: "habit", icon: "✍️", name: "Reflective", rarity: "common", desc: "Write 7 daily reflections", v: c => c.reflections, goal: 7 },
  ],

  RARITY: { common: "Common", rare: "Rare", epic: "Epic", legendary: "Legendary" },
  BADGE_CATS: [["problems", "Problems"], ["habit", "Streak & time"], ["contests", "Contests"], ["lectures", "Lectures"], ["mastery", "Mastery & warm-up"]],

  earnedText(iso) {
    if (!iso) return "";
    const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  },

  // Saare badges ka status; naye mile hue toast ke saath save
  async achievements() {
    const c = await this.context();
    const earned = (Store.state.badges ??= {});
    const fresh = [];
    const list = this.BADGES.map(b => {
      const goal = typeof b.goal === "function" ? b.goal(c) : b.goal;
      const cur = Math.min(b.v(c), goal);
      const done = goal > 0 && cur >= goal;
      if (done && !earned[b.id]) { earned[b.id] = new Date().toISOString(); fresh.push(b); }
      return { ...b, goal, cur, done: !!earned[b.id] || done, on: earned[b.id] };
    });
    if (fresh.length) {
      Store.save();
      showToast(`🏅 Badge unlocked: ${fresh.map(b => `${b.icon} ${b.name}`).join(", ")}`);
    }
    return list;
  },
};
