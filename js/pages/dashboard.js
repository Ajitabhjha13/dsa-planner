// =========================================================
// DASHBOARD: aaj ka kaam
// Upar: overall progress, sprint ke 7 din, aaj ki progress
// Neeche: aaj ke tasks (Warm-up / Main Quest / Lectures) with Done + timer
// =========================================================
const DashboardPage = {
  interval: null,

  // Aaj ki list pehli baar dashboard khulne pe fix hoti hai
  async ensureToday() {
    if (Store.state.today?.date === todayStr()) return;
    Store.state.today = null;
    const plan = await Scheduler.buildPlan("core");
    const d0 = plan.days?.[0];
    const tasks = [];
    if (d0 && d0.date === todayStr()) {
      d0.warmup.forEach(t => tasks.push({ id: t.id, type: "warmup" }));
      d0.main.forEach(t => tasks.push({ id: t.id, type: "main" }));
      d0.lectures.forEach(t => tasks.push({ id: t.id, type: "lecture" }));
    }
    Store.state.today = { date: todayStr(), tasks };
    Store.save();
  },

  // Settings badli? Aaj ki list dobara banao, jo done ho chuke woh rakh ke
  async refreshToday() {
    const old = Store.state.today?.tasks || [];
    const keep = old.filter(t => Tracker.isDone(t));
    Store.state.today = null;
    await this.ensureToday();
    const ids = new Set(Store.state.today.tasks.map(t => t.id));
    Store.state.today.tasks = [...keep.filter(t => !ids.has(t.id)), ...Store.state.today.tasks];
    Store.save();
  },

  // Aaj ka kaam khatam? Agla Main Quest problem aaj ki list mein daalo
  async pullNext() {
    const plan = await Scheduler.buildPlan("core");
    const next = plan.days.slice(1).flatMap(d => d.main)[0];
    if (next) {
      Store.state.today.tasks.push({ id: next.id, type: "main" });
      Store.save();
    }
  },

  greeting() {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  },

  links(t) {
    if (t.type === "lecture") {
      return `<a href="${YouTube.watchUrl(t.videoId)}" target="_blank" rel="noopener">Watch on YouTube ↗</a>`;
    }
    if (t.type !== "main") return "";
    const q = encodeURIComponent(t.title);
    const lc = t.leetcode?.slug
      ? `<a href="https://leetcode.com/problems/${t.leetcode.slug}/" target="_blank" rel="noopener">LeetCode ${t.leetcode.number}</a>`
      : `<a href="https://www.google.com/search?q=${q}+site%3Aleetcode.com%2Fproblems" target="_blank" rel="noopener">Search on LeetCode</a>`;
    const gfg = `<a href="https://www.google.com/search?q=${q}+site%3Ageeksforgeeks.org" target="_blank" rel="noopener">Search on GFG</a>`;
    return `${lc} <span class="dot">•</span> ${gfg}`;
  },

  taskRow(t) {
    const done = Tracker.isDone(t);
    const running = Tracker.timer?.taskId === t.id;
    const spent = Tracker.timeSpent(t.id);
    const badge = t.source ? `<span class="src src-${t.source}" title="${SOURCE_NAMES[t.source]}">${t.source}</span>` : "";
    const hf = t.highFrequency ? ` <span class="hf" title="High-frequency">HF</span>` : "";
    const tip = t.advice && !done
      ? `<details class="tip"><summary>📌 Roadmap tip</summary><p>${t.advice}</p></details>` : "";

    return `
      <li class="dtask ${done ? "is-done" : ""} ${running ? "is-running" : ""}" data-id="${t.id}" data-type="${t.type}">
        <button class="check" data-action="done" aria-label="${done ? "Undo" : "Mark done"}" title="${done ? "Undo" : "Done"}">✓</button>
        <div class="dtask-main">
          <div class="dtask-title">${badge}<button class="title-btn" data-action="open">${esc(t.title)}</button>${hf}</div>
          <div class="dtask-meta">
            <span>~${t.minutes} min</span>
            ${t.type !== "warmup" ? `<span class="dot">•</span> ${this.links(t)}` : ""}
            ${t.type === "warmup" && !done ? `<span class="dot">•</span> <button class="linkbtn" data-action="easy">Too easy</button>` : ""}
          </div>
          ${tip}
        </div>
        <div class="dtask-timer">
          <span class="elapsed" data-elapsed="${t.id}">${spent ? formatDuration(spent) : ""}</span>
          ${done ? "" : `<button class="btn btn-sm ${running ? "btn-primary" : ""}" data-action="timer">${running ? "Pause" : "Start"}</button>`}
        </div>
      </li>`;
  },

  section(key, label, cls, tasks) {
    if (!tasks.length) return "";
    const doneCount = tasks.filter(t => Tracker.isDone(t)).length;
    return `
      <div class="dsec ${cls}">
        <div class="sec-head"><span>${label}</span><span>${doneCount} / ${tasks.length}</span></div>
        <ul class="dtask-list">${tasks.map(t => this.taskRow(t)).join("")}</ul>
      </div>`;
  },

  // Is hafte ke 7 din (Monday se Sunday)
  weekStrip() {
    const today = parseDate(todayStr());
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    const s = Store.settings;
    return [...Array(7)].map((_, i) => {
      const d = addDays(monday, i);
      const key = formatDate(d);
      const log = Store.state.log[key];
      const rest = s.hours[DAY_KEYS[d.getDay()]] === 0;
      let cls = "future";
      if (key === todayStr()) cls = "today";
      else if (d < today) cls = log?.done > 0 ? "hit" : rest ? "rest" : "miss";
      const label = d.toLocaleDateString("en-IN", { weekday: "short" });
      return `<div class="sday ${cls}" title="${prettyDate(key)}${log?.done ? ` • ${log.done} done` : ""}"><span>${d.getDate()}</span><small>${label}</small></div>`;
    }).join("");
  },

  async render() {
    await this.ensureToday();
    const plan = await Scheduler.buildPlan("core");
    if (plan.error) {
      return `<h1 class="page-title">Dashboard</h1><p class="error">${plan.error}</p><a class="btn" href="#/settings">Open settings</a>`;
    }

    const s = Store.settings;
    const problems = await Data.problems();
    const coreTotal = problems.filter(p => p.tier === "core").length;
    const coreDone = problems.filter(p => p.tier === "core" && Store.state.progress[p.id]?.status === "done").length;
    const pct = coreTotal ? Math.round((coreDone / coreTotal) * 100) : 0;
    const totalSecs = Object.values(Store.state.log).reduce((a, l) => a + (l.seconds || 0), 0)
      + (Tracker.timer ? Math.round((Date.now() - Tracker.timer.startedAt) / 1000) : 0);

    const today = plan.days[0]?.date === todayStr() ? plan.days[0] : null;
    const all = today ? [...today.warmup, ...today.main, ...today.lectures] : [];
    const done = all.filter(t => Tracker.isDone(t)).length;
    const todayPct = all.length ? Math.round((done / all.length) * 100) : 0;
    const scheduled = s.hours[DAY_KEYS[new Date().getDay()]] * 60;
    const streak = Tracker.streak();

    let body;
    if (parseDate(s.startDate) > parseDate(todayStr())) {
      body = `<div class="card empty">Your plan starts on <b>${prettyDate(s.startDate)}</b>. You can do some warm-ups until then! 💪</div>`;
    } else if (!all.length) {
      body = `<div class="card empty">Today is a rest day 😌
        <button class="btn" data-action="pull">Solve one problem anyway</button></div>`;
    } else {
      body = `
        <div class="dsec-grid">
          ${this.section("warmup", "Warm-up", "sec-warmup", today.warmup)}
          ${this.section("main", "Main Quest", "sec-main", today.main)}
          ${this.section("lectures", "Lectures", "sec-lectures", today.lectures)}
        </div>
        ${done === all.length ? `<div class="card allclear">🎉 You finished everything for today!
          <button class="btn" data-action="pull">Take one more problem</button></div>` : ""}`;
    }

    return `
      <div class="dash-head">
        <div>
          <h1 class="page-title">${this.greeting()}, Ajitabh</h1>
          <p class="page-sub">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <div class="streak ${streak ? "" : "cold"}" title="Streak">🔥 <b>${streak}</b> <span>day${streak === 1 ? "" : "s"}</span></div>
      </div>

      <div class="dash-top">
        <div class="card ring-card">
          <div class="ring" style="--p:${pct}"><span>${pct}%</span></div>
          <div>
            <div class="muted small">OVERALL PROGRESS</div>
            <div><b>${coreDone}</b> / ${coreTotal} problems in Plan</div>
            <div class="muted small">Warm-up ${plan.warmup.name}: ${plan.warmup.done} / ${plan.warmup.total}</div>
            <div class="muted small">Total study time: ${formatDuration(totalSecs)}</div>
            <div class="muted small">Finish: ${prettyDate(plan.endDate)} ${plan.lateBy > 0 ? `<span class="late">(${plan.lateBy} days late)</span>` : ""}</div>
          </div>
        </div>

        <div class="card">
          <div class="muted small">THIS WEEK</div>
          <div class="sprint-strip">${this.weekStrip()}</div>
        </div>

        <div class="card">
          <div class="muted small">TODAY'S PROGRESS</div>
          <div class="today-stats">
            <div><span class="muted">Tasks</span><b>${done} / ${all.length}</b></div>
            <div><span class="muted">Time spent</span><b data-today-time>${formatDuration(Tracker.todaySeconds())}</b></div>
            <div><span class="muted">Scheduled</span><b>${Math.floor(scheduled / 60)}h ${scheduled % 60}m</b></div>
          </div>
          <div class="bar"><div style="width:${todayPct}%"></div></div>
        </div>
      </div>

      <div class="dash-title-row">
        <h2 class="section-title">Today's tasks</h2>
        <button class="linkbtn" data-action="refresh" title="Use this after changing Settings">↻ Refresh list</button>
      </div>
      ${body}
    `;
  },

  cleanup() {
    clearInterval(this.interval);
  },

  afterRender() {
    const app = document.getElementById("app");

    // Event delegation: ek hi listener saare buttons ke liye
    app.onclick = async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest(".dtask");
      const task = row ? { id: row.dataset.id, type: row.dataset.type } : null;

      switch (btn.dataset.action) {
        case "done": Tracker.toggleDone(task); break;
        case "timer":
          Tracker.timer?.taskId === task.id ? Tracker.stopTimer() : Tracker.startTimer(task.id);
          break;
        case "easy":
          if (!Tracker.isDone(task)) Tracker.toggleDone(task);
          Warmup.markTooEasy(task.id);
          break;
        case "open":
          if (task.type === "lecture") {
            const v = (await Data.videos()).find(x => x.id === task.id);
            if (v) window.open(YouTube.watchUrl(v.videoId), "_blank", "noopener");
            return;
          }
          QuestionPanel.open(task);
          return;
        case "pull": await this.pullNext(); break;
        case "refresh": await this.refreshToday(); break;
        default: return;
      }
      await renderRoute();
    };

    // Har second chalta timer update karo (poora page dobara nahi banana)
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      const t = Tracker.timer;
      if (t) {
        const el = document.querySelector(`[data-elapsed="${t.taskId}"]`);
        if (el) el.textContent = formatDuration(Tracker.timeSpent(t.taskId));
      }
      const tt = document.querySelector("[data-today-time]");
      if (tt) tt.textContent = formatDuration(Tracker.todaySeconds());
    }, 1000);
  },
};
