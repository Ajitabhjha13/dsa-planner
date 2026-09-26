// =========================================================
// TRACKER: Done / Undo, timer, roz ka log aur streak
// =========================================================
const Tracker = {
  // Roz ka poora hisaab (Activity calendar ke hover mein yahi dikhta hai):
  // { seconds, done, warmup, main, lecture, estMin, contests, contestsPassed, contestSecs }
  dayLog(date = todayStr()) {
    const l = (Store.state.log[date] ??= {});
    for (const k of ["seconds", "done", "warmup", "main", "lecture", "estMin", "contests", "contestsPassed", "contestSecs"]) l[k] ??= 0;
    return l;
  },

  // Task ka estimate (minutes), activity level nikalne ke liye
  estimateFor(task) {
    if (task.type === "warmup") return WARMUP_MINUTES;
    if (task.type === "main") return (Data.cache.problems || []).find(p => p.id === task.id)?.minutes || 30;
    const v = (Store.state.videos?.items || []).find(x => x.id === task.id);
    const s = Store.settings;
    return v ? Math.round((v.durationSec / 60 / s.playbackSpeed) * s.studyMultiplier) : 30;
  },

  isDone(task) {
    if (task.type === "warmup") {
      const w = Store.state.warmup;
      return !!w.done[task.id] || w.lastDone?.[task.id] === todayStr();
    }
    return Store.state.progress[task.id]?.status === "done";
  },

  toggleDone(task) {
    if (this.timer?.taskId === task.id) this.stopTimer();
    const log = this.dayLog();

    if (this.isDone(task)) {
      // Undo
      if (task.type === "warmup") Warmup.unmarkDone(task.id);
      else Store.state.progress[task.id].status = "pending";
      log.done = Math.max(0, log.done - 1);
      log[task.type] = Math.max(0, log[task.type] - 1);
      log.estMin = Math.max(0, log.estMin - this.estimateFor(task));
    } else {
      if (task.type === "warmup") Warmup.markDone(task.id);
      else {
        const p = (Store.state.progress[task.id] ??= { timeSpent: 0 });
        p.status = "done";
        p.doneOn = todayStr();
      }
      log.done++;
      log[task.type]++;
      log.estMin += this.estimateFor(task);
    }
    Store.state.lastActive = new Date().toISOString();
    Store.save();
  },

  // ---------- Timer (ek time pe ek hi task) ----------
  get timer() { return Store.state.timer; },

  startTimer(taskId) {
    if (this.timer) this.stopTimer();
    Store.state.timer = { taskId, startedAt: Date.now() };
    Store.save();
  },

  stopTimer() {
    const t = this.timer;
    if (!t) return;
    const secs = Math.round((Date.now() - t.startedAt) / 1000);
    const p = (Store.state.progress[t.taskId] ??= { status: "pending", timeSpent: 0 });
    p.timeSpent = (p.timeSpent || 0) + secs;
    p.lastTouched = Date.now(); // "Continue where you left off" ke liye
    this.dayLog().seconds += secs;
    Store.state.timer = null;
    Store.state.lastActive = new Date().toISOString();
    Store.save();
  },

  // Task pe ab tak kitna time laga (chalta timer mila ke), seconds mein
  timeSpent(taskId) {
    let secs = Store.state.progress[taskId]?.timeSpent || 0;
    if (this.timer?.taskId === taskId) secs += Math.round((Date.now() - this.timer.startedAt) / 1000);
    return secs;
  },

  todaySeconds() {
    let secs = this.dayLog().seconds;
    if (this.timer) secs += Math.round((Date.now() - this.timer.startedAt) / 1000);
    return secs;
  },

  // Streak: lagatar kitne din kam se kam 1 task done hua.
  // Aaj abhi tak kuch nahi kiya toh bhi kal tak ki streak zinda hai.
  // ---------------- STREAK (freeze ke saath) ----------------
  // Rules:
  //   - kaam kiya (done > 0)          → streak +1
  //   - rest day (0 hours)            → na +1, na toot-ta
  //   - study day miss kiya           → hafte ka ❄️ freeze lag jaata hai (hafte mein 1)
  //   - freeze pehle hi use ho gaya   → streak 0
  //   - aaj abhi tak kuch nahi kiya   → streak zinda (din abhi baaki hai)
  weekKey(date) {
    const d = parseDate(date);
    return formatDate(addDays(d, -((d.getDay() + 6) % 7))); // us hafte ka Monday
  },

  streakInfo() {
    const log = Store.state.log;
    const today = todayStr();
    const logged = Object.keys(log).filter(k => log[k]?.done > 0).sort();
    const startKey = [Store.settings.startDate, logged[0]].filter(Boolean).sort()[0] || today;
    const used = {}, frozen = new Set();
    let run = 0, best = 0;
    for (let d = parseDate(startKey); formatDate(d) <= today; d = addDays(d, 1)) {
      const k = formatDate(d);
      if (log[k]?.done > 0) { run++; best = Math.max(best, run); continue; }
      if (k === today) continue;
      if (Store.settings.hours[DAY_KEYS[d.getDay()]] === 0) continue;
      const wk = this.weekKey(k);
      if (run > 0 && !used[wk]) { used[wk] = true; frozen.add(k); continue; }
      run = 0;
    }
    return { current: run, best, frozen, freezeLeft: used[this.weekKey(today)] ? 0 : 1 };
  },

  streak() { return this.streakInfo().current; },
  bestStreak() { return this.streakInfo().best; },
};

function formatDuration(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
