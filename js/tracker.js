// =========================================================
// TRACKER: Done / Undo, timer, roz ka log aur streak
// =========================================================
const Tracker = {
  dayLog(date = todayStr()) {
    Store.state.log[date] ??= { seconds: 0, done: 0 };
    return Store.state.log[date];
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
    } else {
      if (task.type === "warmup") Warmup.markDone(task.id);
      else {
        const p = (Store.state.progress[task.id] ??= { timeSpent: 0 });
        p.status = "done";
        p.doneOn = todayStr();
      }
      log.done++;
    }
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
    this.dayLog().seconds += secs;
    Store.state.timer = null;
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
  streak() {
    let d = parseDate(todayStr());
    if (!(Store.state.log[formatDate(d)]?.done > 0)) d = addDays(d, -1);
    let count = 0;
    while (Store.state.log[formatDate(d)]?.done > 0) {
      count++;
      d = addDays(d, -1);
    }
    return count;
  },
};

function formatDuration(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
