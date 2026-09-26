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

  // COMPACT: har section ek patli bar, sirf agla unfinished task; baaki "More" mein
  openSecs: new Set(),

  section(key, label, cls, tasks) {
    if (!tasks.length) return "";
    const doneCount = tasks.filter(t => Tracker.isDone(t)).length;
    const next = tasks.find(t => !Tracker.isDone(t));
    const rest = tasks.filter(t => t !== next);
    const pct = Math.round((doneCount / tasks.length) * 100);
    return `
      <div class="dsec cbar ${cls}">
        <div class="sec-head">
          <span>${label}</span>
          <span class="cbar-prog"><span class="qbar"><span style="width:${pct}%"></span></span>${doneCount} / ${tasks.length}</span>
        </div>
        ${next ? `<ul class="dtask-list">${this.taskRow(next)}</ul>` : `<div class="cbar-done">✓ All ${tasks.length} done</div>`}
        ${rest.length ? `
          <details class="cbar-more" data-sec="${key}" ${this.openSecs.has(key) ? "open" : ""}>
            <summary>${this.openSecs.has(key) ? "Less ▴" : `More (${rest.length}) ▾`}</summary>
            <ul class="dtask-list">${rest.map(t => this.taskRow(t)).join("")}</ul>
          </details>` : ""}
      </div>`;
  },

  // ---------------- DAILY QUOTE (roz ek, date ke hisaab se) ----------------
  QUOTES: [
    "Small progress every day beats big plans you never start.",
    "You do not need to feel ready. You need to begin.",
    "Every problem you solve today is one less surprise in the interview.",
    "Consistency is the real shortcut.",
    "Stuck is not failing. Stuck is where learning happens.",
    "One more problem. Then decide if you are tired.",
    "Discipline is choosing what you want most over what you want now.",
    "Your future offer letter is built in today's quiet hours.",
    "Understand it once, and you will never have to memorise it.",
    "Slow is fine. Stopping is not.",
    "Read the problem twice. Code it once.",
    "The best time to revise was yesterday. The next best is today.",
    "Hard problems are just easy problems you have not met yet.",
    "Show up for 30 minutes. Momentum will do the rest.",
    "Dry run it on paper. Bugs hate paper.",
    "You are closer than you were yesterday.",
    "Patterns, not problems. Learn the pattern and a hundred problems open up.",
    "Every expert was once a beginner who refused to quit.",
    "A streak is a promise you keep to yourself.",
    "Do the boring reps. They win the exciting interviews.",
    "Edge cases are where interviews are decided.",
    "Today's confusion is tomorrow's confidence.",
    "Focus on the next problem, not the whole list.",
    "Code, test, break, fix, repeat.",
    "You compete with who you were last week.",
    "Time complexity first, code second.",
    "Rest if you must, but do not quit.",
    "Clarity comes from solving, not from waiting.",
    "One solid hour beats three distracted ones.",
    "Write it, explain it, and then you really know it.",
    "December is closer than it looks. Make today count.",
  ],

  quote() {
    const d = parseDate(todayStr());
    const dayOfYear = daysBetween(new Date(d.getFullYear(), 0, 1), d);
    return this.QUOTES[dayOfYear % this.QUOTES.length];
  },

  lastActiveText() {
    const iso = Store.state.lastActive;
    if (!iso) return "Not active yet";
    const days = daysBetween(parseDate(formatDate(new Date(iso))), parseDate(todayStr()));
    const time = new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    return days === 0 ? `Last active today, ${time}` : days === 1 ? "Last active yesterday" : `Last active ${days} days ago`;
  },

  // Apple-watch jaisa: 3 rings ek ke andar ek (Main Quest bahar, Lectures beech, Warm-up andar)
  concentric(rings, center) {
    const size = 200, stroke = 13, gap = 5;
    const circles = rings.map((r, i) => {
      const rad = size / 2 - stroke / 2 - i * (stroke + gap);
      const c = 2 * Math.PI * rad;
      const len = Math.max(0, Math.min(1, r.pct / 100)) * c;
      return `
        <circle cx="${size / 2}" cy="${size / 2}" r="${rad}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}"/>
        ${len > 0 ? `<circle cx="${size / 2}" cy="${size / 2}" r="${rad}" fill="none" stroke="${r.color}" stroke-width="${stroke}"
          stroke-linecap="${r.pct < 5 ? "butt" : "round"}" stroke-dasharray="${len} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${r.label}: ${r.pct}%</title></circle>` : ""}`;
    }).join("");
    return `<svg class="concentric" viewBox="0 0 ${size} ${size}" role="img" aria-label="Combined progress">${circles}
      <text x="50%" y="48%" text-anchor="middle" class="cc-big">${center}%</text>
      <text x="50%" y="60%" text-anchor="middle" class="cc-small">overall</text></svg>`;
  },

  ring(pct, color) {
    return `<div class="ring" style="--p:${pct};--ring:${color}"><span>${pct}%</span></div>`;
  },

  // Semicircle gauge (contest confidence)
  gauge(value) {
    const r = 70, c = Math.PI * r, len = (value / 100) * c;
    const color = value >= 75 ? "var(--green)" : value >= 45 ? "var(--accent)" : "var(--red)";
    return `<svg class="gauge" viewBox="0 0 180 104" role="img" aria-label="Confidence ${value}">
      <path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="var(--surface-2)" stroke-width="14" stroke-linecap="round"/>
      ${len > 0 ? `<path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len} ${c}"/>` : ""}
      <text x="90" y="86" text-anchor="middle" class="cc-big">${value}</text></svg>`;
  },

  // ---------------- ACTIVITY CALENDAR ----------------
  monthOffset: 0,

  // 0 = kuch nahi, 1-4 = us din ke scheduled time ke mukable kitna kaam
  dayLevel(date) {
    const log = Store.state.log[date];
    if (!log) return 0;
    const work = Math.max((log.seconds || 0) / 60, log.estMin || 0, (log.done || 0) * 10);
    if (work <= 0) return 0;
    const cap = (Store.settings.hours[DAY_KEYS[parseDate(date).getDay()]] || 1) * 60;
    const r = work / cap;
    return r < 0.25 ? 1 : r < 0.6 ? 2 : r < 1 ? 3 : 4;
  },

  calendar() {
    const frozen = Tracker.streakInfo().frozen;
    const now = parseDate(todayStr());
    const first = new Date(now.getFullYear(), now.getMonth() + this.monthOffset, 1);
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday se shuru
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(`<span class="cal-cell blank"></span>`);
    let active = 0, secs = 0, tasks = 0, contests = 0;
    for (let d = 1; d <= daysIn; d++) {
      const date = formatDate(new Date(first.getFullYear(), first.getMonth(), d));
      const log = Store.state.log[date];
      if (log?.done || log?.seconds) { active++; secs += log.seconds || 0; tasks += log.done || 0; contests += log.contests || 0; }
      const fz = frozen.has(date);
      cells.push(`<span class="cal-cell lvl${this.dayLevel(date)} ${fz ? "frozen" : ""} ${date === todayStr() ? "today" : ""} ${date > todayStr() ? "future" : ""}" data-date="${date}">${fz ? "❄️" : d}</span>`);
    }
    const title = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return `
      <div class="cal-head">
        <button class="linkbtn" data-action="month" data-d="-1" aria-label="Previous month">‹</button>
        <b>${title}</b>
        <button class="linkbtn" data-action="month" data-d="1" aria-label="Next month" ${this.monthOffset >= 0 ? "disabled" : ""}>›</button>
      </div>
      <div class="cal-grid">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<span class="cal-dow">${x}</span>`).join("")}${cells.join("")}</div>
      <div class="cal-foot">
        <span class="muted small">${active} active day${active === 1 ? "" : "s"} · ${formatDuration(secs)} · ${tasks} tasks${contests ? ` · ${contests} contests` : ""}</span>
        <span class="cal-legend"><span class="muted small">Less</span>${[1, 2, 3, 4].map(l => `<i class="lvl${l}"></i>`).join("")}<span class="muted small">More</span></span>
      </div>
      <div class="cal-tip" id="cal-tip" hidden></div>`;
  },

  dayTip(date) {
    const l = Store.state.log[date] || {};
    const frozen = Tracker.streakInfo().frozen.has(date);
    const lvlName = frozen ? "❄️ Streak freeze used" : ["No activity", "Light day", "Decent day", "Good day", "Great day 🔥"][this.dayLevel(date)];
    const d = parseDate(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
    return `<b>${d}</b> · ${lvlName}
      <div class="tip-grid">
        <span>Time studied</span><b>${formatDuration(l.seconds || 0)}</b>
        <span>Tasks done</span><b>${l.done || 0}</b>
        <span class="c-warm">Warm-ups</span><b>${l.warmup || 0}</b>
        <span class="c-main">Problems</span><b>${l.main || 0}</b>
        <span class="c-lec">Lectures</span><b>${l.lecture || 0}</b>
        <span>Contests</span><b>${l.contests || 0}${l.contests ? ` (${l.contestsPassed || 0} passed)` : ""}</b>
      </div>
      ${l.reflection ? `<div class="tip-reflect">✍️ ${esc(l.reflection)}</div>` : ""}`;
  },

  // ---------------- TROPHY CABINET ----------------
  // Header mein: sabse naya trophy dikhta hai, baaki sab dropdown mein (kyun mila + kab mila)
  trophyCabinet(badges) {
    const won = badges.filter(b => b.done && b.on).sort((a, b) => String(b.on).localeCompare(String(a.on)));
    const next = badges.filter(b => !b.done).sort((a, b) => b.cur / b.goal - a.cur / a.goal)[0];
    if (!won.length) {
      return `<div class="trophy-cab empty"><span class="tc-icon">🏆</span>
        <span class="small">Trophy Cabinet is empty. First up: ${next.icon} <b>${next.name}</b> (${next.desc.toLowerCase()})</span></div>`;
    }
    const latest = won[0];
    const item = b => `
      <li class="tc-item r-${b.rarity}">
        <span class="bicon">${b.icon}</span>
        <div class="grow">
          <div class="tc-name"><b>${b.name}</b><span class="rar r-${b.rarity}">${Insights.RARITY[b.rarity]}</span></div>
          <div class="muted small">Why: ${b.desc}</div>
          <div class="muted small">Earned on ${Insights.earnedText(b.on)}</div>
        </div>
      </li>`;
    return `
      <details class="trophy-cab" ${this.cabOpen ? "open" : ""}>
        <summary>
          <span class="tc-icon">🏆</span>
          <span class="tc-label">Trophy Cabinet</span>
          <span class="tc-latest r-${latest.rarity}" title="Latest: ${latest.desc}">${latest.icon} ${latest.name}</span>
          <span class="tc-count">${won.length}</span>
          <span class="tc-chev">▾</span>
        </summary>
        <div class="tc-panel">
          <div class="tc-head"><b>Your trophies</b><span class="muted small">${won.length} of ${badges.length} earned</span></div>
          <div class="muted small tc-sub">LATEST</div>
          <ul class="tc-list">${item(latest)}</ul>
          ${won.length > 1 ? `<div class="muted small tc-sub">EARLIER</div><ul class="tc-list">${won.slice(1).map(item).join("")}</ul>` : ""}
          ${next ? `<div class="tc-next">Next up: ${next.icon} <b>${next.name}</b> · ${next.cur}/${next.goal} · ${next.desc}</div>` : `<div class="tc-next ok">🎉 You have earned every trophy!</div>`}
        </div>
      </details>`;
  },

  // ---------------- CONTEST STATS ----------------
  contestStats() {
    const h = Contest.history;
    const passed = h.filter(x => x.passed).length;
    const totalSecs = h.reduce((a, x) => a + x.usedSec, 0);
    const recent = h.slice(-5);
    // Confidence: pichhle 5 contests mein kitne questions solve hue (70%) + pass rate (30%)
    const conf = recent.length
      ? Math.round(recent.reduce((a, x) => a + x.questions.filter(q => q.result === "solved").length / x.questions.length, 0) / recent.length * 70
        + recent.filter(x => x.passed).length / recent.length * 30)
      : 0;
    return { taken: h.length, passed, totalSecs, avgSecs: h.length ? Math.round(totalSecs / h.length) : 0, conf, last: h[h.length - 1] };
  },

  async readyContests() {
    const out = [];
    const topics = [...new Set((await Data.problems()).filter(p => p.tier === "core").map(p => p.topic))];
    for (const t of topics) {
      const st = await Contest.topicStatus(t);
      if (st.unlocked && !Contest.record("topic", t).passed) out.push({ name: `${t} Contest`, href: "#/plan/main" });
    }
    if ((await Contest.completedTopics()).length >= CONTEST_RULES.grand.minTopics) out.push({ name: "Grand Contest", href: "#/contest" });
    return out;
  },

  async render() {
    await this.ensureToday();
    const plan = await Scheduler.buildPlan("core");
    if (plan.error) {
      return `<h1 class="page-title">Dashboard</h1><p class="error">${plan.error}</p><a class="btn" href="#/settings">Open settings</a>`;
    }
    const s = Store.settings;
    const st = id => Store.state.progress[id]?.status;
    const problems = await Data.problems();
    const fmtH = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`;

    // ---- Main Quest ----
    const mainTasks = await Scheduler.mainQuestTasks("core");
    const coreP = problems.filter(p => p.tier === "core");
    const mDone = coreP.filter(p => st(p.id) === "done").length;
    const mPct = coreP.length ? Math.round(mDone / coreP.length * 100) : 0;
    const lvlCount = l => `${coreP.filter(p => p.level === l && st(p.id) === "done").length}/${coreP.filter(p => p.level === l).length}`;

    // ---- Lectures ----
    const lecTasks = await Scheduler.lectureTasks("core");
    const lDone = lecTasks.filter(t => st(t.id) === "done" || st(t.id) === "skipped").length;
    const lPct = lecTasks.length ? Math.round(lDone / lecTasks.length * 100) : 0;
    let sprintText = "Import your playlist";
    if (Store.state.videos?.items?.length) {
      VideosPage.ensureSprintSettings();
      const sps = VideosPage.buildSprints(Store.state.videos.items);
      const cur = sps.find(x => !x.complete);
      sprintText = cur ? `Sprint ${cur.number} of ${sps.length} · ${cur.done}/${cur.items.length}` : "All sprints done 🎉";
    }

    // ---- Warm-up ----
    const w = Store.state.warmup;
    const wPct = plan.warmup.total ? Math.round(plan.warmup.done / plan.warmup.total * 100) : 0;
    const wb = await Data.workbook();
    const wEver = wb.filter(x => Warmup.isActive(x.id) && (w.history?.[x.id] || 0) > 0).length;
    const wActive = wb.filter(x => Warmup.isActive(x.id)).length;

    // ---- Combined (time ke hisaab se weighted) ----
    const sumMin = (list, pred) => list.filter(pred).reduce((a, t) => a + t.minutes, 0);
    const doneMin = sumMin(mainTasks, t => st(t.id) === "done") + sumMin(lecTasks, t => st(t.id) === "done" || st(t.id) === "skipped") + plan.warmup.done * WARMUP_MINUTES;
    const allMin = sumMin(mainTasks, () => true) + sumMin(lecTasks, () => true) + plan.warmup.total * WARMUP_MINUTES;
    const pct = allMin ? Math.round(doneMin / allMin * 100) : 0;
    const totalSecs = Object.values(Store.state.log).reduce((a, l) => a + (l.seconds || 0), 0)
      + (Tracker.timer ? Math.round((Date.now() - Tracker.timer.startedAt) / 1000) : 0);

    // ---- Today ----
    const today = plan.days[0]?.date === todayStr() ? plan.days[0] : null;
    const all = today ? [...today.warmup, ...today.main, ...today.lectures] : [];
    const done = all.filter(t => Tracker.isDone(t)).length;
    const todayPct = all.length ? Math.round(done / all.length * 100) : 0;
    const scheduled = s.hours[DAY_KEYS[new Date().getDay()]] * 60;
    const spentSecs = Tracker.todaySeconds();
    const timePct = scheduled ? Math.min(100, Math.round(spentSecs / 60 / scheduled * 100)) : 0;
    const tLog = Store.state.log[todayStr()] || {};
    const reviewCount = Object.keys(Store.state.review).length;
    const ready = await this.readyContests();

    // ---- Contest + streak ----
    const cs = this.contestStats();
    const si = Tracker.streakInfo();
    const streak = si.current, best = si.best;

    // ---- Smart cards ----
    const potd = await Insights.problemOfTheDay();
    const cont = await Insights.continueItem();
    const cd = await Insights.countdown();
    const mastery = await Insights.mastery();
    const weak = await Insights.weakAreas();
    const badges = await Insights.achievements();
    const earnedCount = badges.filter(b => b.done).length;
    this._badges = badges;
    const nextBadges = badges.filter(b => !b.done).sort((a, b) => b.cur / b.goal - a.cur / a.goal).slice(0, 3);
    const reflection = (Store.state.log[todayStr()] || {}).reflection || "";
    const confLabel = !cs.taken ? "No contests yet" : cs.conf >= 75 ? "Strong" : cs.conf >= 45 ? "Building up" : "Needs practice";

    let tasksHtml;
    if (parseDate(s.startDate) > parseDate(todayStr())) {
      tasksHtml = `<div class="empty-note">Your plan starts on <b>${prettyDate(s.startDate)}</b>. You can do some warm-ups until then! 💪</div>`;
    } else if (!all.length) {
      tasksHtml = `<div class="empty-note">Today is a rest day 😌 <button class="btn btn-sm" data-action="pull">Solve one problem anyway</button></div>`;
    } else {
      tasksHtml = `
        <div class="dsec-grid">
          ${this.section("warmup", "Warm-up", "sec-warmup", today.warmup)}
          ${this.section("main", "Main Quest", "sec-main", today.main)}
          ${this.section("lectures", "Lectures", "sec-lectures", today.lectures)}
        </div>
        ${done === all.length ? `<div class="allclear">🎉 You finished everything for today! <button class="btn btn-sm" data-action="pull">Take one more problem</button></div>` : ""}`;
    }

    return `
      <div class="dash-head">
        <div>
          <h1 class="page-title">${this.greeting()}, Ajitabh</h1>
          <p class="page-sub">${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p class="quote">“${this.quote()}”</p>
        </div>
        <div class="head-right">
          <div class="head-pills">
            <div class="countdown-pill" title="${cd.pending} Plan problems left">⏳ <b>${cd.daysLeft}</b> days to ${prettyDate(s.targetDate)} <span class="muted small">· ~${cd.pace.toFixed(1)} problems/day needed</span></div>
            <div class="streak ${streak ? "" : "cold"}" title="Current streak">🔥 <b>${streak}</b> <span>day${streak === 1 ? "" : "s"}</span></div>
          </div>
          <span class="muted small">Best ${best} · ❄️ ${si.freezeLeft} freeze left this week · ${this.lastActiveText()}</span>
          ${this.trophyCabinet(badges)}
        </div>
      </div>

      <div class="dash-charts">
        <div class="card combined">
          <div class="muted small">OVERALL PROGRESS</div>
          <div class="combined-body">
            ${this.concentric([
              { pct: mPct, color: "var(--c-main)", label: "Main Quest" },
              { pct: lPct, color: "var(--c-lectures)", label: "Lectures" },
              { pct: wPct, color: "var(--c-warmup)", label: "Warm-up round" },
            ], pct)}
            <div class="grow">
              <div class="legend-row"><i style="background:var(--c-main)"></i><span>Main Quest</span><b>${mPct}%</b></div>
              <div class="legend-row"><i style="background:var(--c-lectures)"></i><span>Lectures</span><b>${lPct}%</b></div>
              <div class="legend-row"><i style="background:var(--c-warmup)"></i><span>Warm-up (${Warmup.roundName()})</span><b>${wPct}%</b></div>
              <div class="stat-lines">
                <div><span>Total time left</span><b>~${fmtH(plan.workMinutes)}</b></div>
                <div><span>Everything done by</span><b class="${plan.lateBy > 0 ? "late" : "ok"}">${prettyDate(plan.endDate)}${plan.lateBy > 0 ? ` (${plan.lateBy}d late)` : ""}</b></div>
                <div><span>Studied so far</span><b>${formatDuration(totalSecs)}</b></div>
              </div>
            </div>
          </div>
        </div>

        <div class="ring-stack">
          <a class="card ring-card mini-ring" href="#/plan/main">
            ${this.ring(mPct, "var(--c-main)")}
            <div class="grow">
              <div class="muted small">MAIN QUEST</div>
              <div class="big"><b>${mDone}</b> / ${coreP.length} solved</div>
              <div class="lvl-split"><span class="lvl lvl-basic">Basic ${lvlCount("basic")}</span><span class="lvl lvl-core">Core ${lvlCount("core")}</span><span class="lvl lvl-pro">Pro ${lvlCount("pro")}</span></div>
            </div>
          </a>
          <a class="card ring-card mini-ring" href="#/lectures">
            ${this.ring(lPct, "var(--c-lectures)")}
            <div class="grow">
              <div class="muted small">LECTURES</div>
              <div class="big"><b>${lDone}</b> / ${lecTasks.length} watched</div>
              <div class="muted small">${sprintText}</div>
            </div>
          </a>
          <a class="card ring-card mini-ring" href="#/plan/warmup">
            ${this.ring(wPct, "var(--c-warmup)")}
            <div class="grow">
              <div class="muted small">WARM-UP</div>
              <div class="big">${Warmup.roundName()}: <b>${plan.warmup.done}</b> / ${plan.warmup.total}</div>
              <div class="muted small">Solved at least once: ${wEver}/${wActive}</div>
            </div>
          </a>
        </div>
      </div>

      <div class="dash-main">
        <section class="card today-box">
          <div class="today-head">
            <div>
              <h2 class="section-title">Today's tasks</h2>
              <span class="muted small">${new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>
            </div>
            <button class="linkbtn" data-action="refresh" title="Use this after changing Settings">↻ Refresh list</button>
          </div>

          <div class="today-meters">
            <div class="meter">
              <div class="meter-top"><span>Tasks</span><b>${done} / ${all.length}</b></div>
              <div class="bar"><div style="width:${todayPct}%"></div></div>
            </div>
            <div class="meter">
              <div class="meter-top"><span>Hours</span><b><span data-today-time>${formatDuration(spentSecs)}</span> <span class="muted small">/ ${fmtH(scheduled)}</span></b></div>
              <div class="bar b-lec"><div style="width:${timePct}%" data-time-bar></div></div>
            </div>
            <div class="meter">
              <div class="meter-top"><span>Contests today</span><b>${tLog.contests || 0}${tLog.contests ? ` · ${tLog.contestsPassed || 0} passed` : ""}</b></div>
              <div class="muted small">${ready.length ? `🏆 ${ready.length} ready: <a href="${ready[0].href}">${esc(ready[0].name)}</a>${ready.length > 1 ? ` +${ready.length - 1} more` : ""}` : "No contest unlocked yet"}</div>
            </div>
          </div>

          <div class="smart-row">
            <div class="smart potd">
              <div class="muted small">⭐ PROBLEM OF THE DAY</div>
              ${potd ? `<div class="smart-body" data-id="${potd.id}" data-type="main">
                  <span class="src src-${potd.source}">${potd.source}</span>
                  <button class="title-btn smart-title" data-action="open">${esc(potd.title)}</button>
                  <span class="lvl lvl-${potd.level}">${LEVEL_NAMES[potd.level]}</span>
                  <button class="btn btn-sm btn-primary" data-action="open">Revise</button>
                </div>
                <div class="muted small">🔁 Revision: you solved this${Store.state.progress[potd.id]?.doneOn ? ` on ${prettyDate(Store.state.progress[potd.id].doneOn)}` : ""}. Solve it again without looking at your notes.</div>`
              : `<div class="muted small">Solve a few problems first. Problem of the Day brings back one you have already solved, for revision.</div>`}
            </div>
            <div class="smart cont">
              <div class="muted small">▶ CONTINUE WHERE YOU LEFT OFF</div>
              ${cont ? `<div class="smart-body" data-id="${cont.id}" data-type="${cont.type}">
                  ${cont.type === "lecture"
                    ? `<a class="title-btn smart-title" href="${cont.href}" target="_blank" rel="noopener">${esc(cont.title)}</a>`
                    : `<button class="title-btn smart-title" data-action="open">${esc(cont.title)}</button>`}
                  <span class="muted small">${cont.running ? "⏱ running · " : ""}${cont.sub}</span>
                </div>` : `<div class="muted small">Nothing half-done. Start a task with its timer and it will show up here.</div>`}
            </div>
          </div>

          ${reviewCount ? `<div class="review-note">🔁 <b>${reviewCount}</b> question${reviewCount === 1 ? "" : "s"} waiting for review. <button class="linkbtn" data-action="open-review">Open review list →</button></div>` : ""}

          ${tasksHtml}

          <div class="reflect">
            <label class="muted small" for="reflect-in">✍️ WHAT DID YOU LEARN TODAY?</label>
            <div class="reflect-row">
              <input id="reflect-in" maxlength="200" placeholder="One line is enough, e.g. 'Two pointers work because the array is sorted'" value="${esc(reflection)}">
              <button class="btn btn-sm" data-action="reflect">${reflection ? "Update" : "Save"}</button>
            </div>
          </div>
        </section>

        <aside class="dash-side">
          <div class="card cal-card">
            <div class="muted small">ACTIVITY</div>
            ${this.calendar()}
          </div>

          <div class="card contest-stats">
            <div class="muted small">CONTESTS</div>
            <div class="gauge-wrap">${this.gauge(cs.conf)}<div class="gauge-label">Confidence: <b>${confLabel}</b></div></div>
            <div class="stat-lines">
              <div><span>Passed / taken</span><b>${cs.passed} / ${cs.taken}${cs.taken ? ` (${Math.round(cs.passed / cs.taken * 100)}%)` : ""}</b></div>
              <div><span>Time in contests</span><b>${formatDuration(cs.totalSecs)}</b></div>
              <div><span>Average time</span><b>${cs.taken ? formatClock(cs.avgSecs) : "-"}</b></div>
              <div><span>Last contest</span><b>${cs.last ? `${esc(cs.last.name)} ${cs.last.passed ? "✓" : "✗"}` : "-"}</b></div>
            </div>
            <div class="muted small spark-title">CONFIDENCE OVER TIME</div>
            ${Insights.sparkline(Insights.confidenceHistory())}
            <a class="btn btn-sm" href="#/contest" style="margin-top:12px">All contests →</a>
          </div>
        </aside>
      </div>

      <div class="dash-bottom">
        <section class="card">
          <div class="dash-title-row"><h2 class="section-title">📊 Topic mastery</h2>
            <span class="muted small">Mastered = 100% solved + topic contest passed</span></div>
          <div class="mastery-grid">
            ${mastery.map(m => `
              <a class="mchip m${m.level}" href="#/plan/main" title="${m.done}/${m.total} solved">
                <span class="mchip-top"><b>${esc(m.topic)}</b><span>${m.pct}%</span></span>
                <span class="mchip-bar"><span style="width:${m.pct}%"></span></span>
                <span class="mchip-lvl">${MASTERY_LEVELS[m.level]}</span>
              </a>`).join("")}
          </div>
          <h3 class="section-title weak-h">⚠️ Weak areas</h3>
          ${weak.length ? `<div class="weak-list">${weak.map(w => `
            <div class="weak">
              <b>${esc(w.topic)}</b>
              <span class="muted small">${[w.review ? `${w.review} in review` : "", w.help ? `${w.help} solved with help` : "", w.slow ? `${w.slow} took much longer than expected` : ""].filter(Boolean).join(" · ")}</span>
              <button class="btn btn-sm" data-action="practice" data-topic="${esc(w.topic)}">Practice</button>
            </div>`).join("")}</div>`
          : `<p class="muted small">No weak areas yet. They show up from problems in review, solved with help, or that took much longer than expected.</p>`}
        </section>

        <section class="card badges-card">
          <div class="dash-title-row"><h2 class="section-title">🏅 Achievements</h2><span class="muted small">${earnedCount} / ${badges.length}</span></div>
          <div class="badge-next">
            ${nextBadges.map(b => `
              <div class="badge-row r-${b.rarity}">
                <span class="bicon">${b.icon}</span>
                <div class="grow"><b>${b.name}</b><span class="muted small">${b.desc}</span>
                  <span class="mini-bar"><span style="width:${Math.round(b.cur / b.goal * 100)}%"></span></span></div>
                <span class="muted small">${b.cur}/${b.goal}</span>
              </div>`).join("")}
          </div>
          <details class="badge-all" ${this.showBadges ? "open" : ""}>
            <summary>All badges <span class="muted small">(${earnedCount}/${badges.length})</span> ▾</summary>
            ${Insights.BADGE_CATS.map(([k, label]) => {
              const list = badges.filter(x => x.cat === k);
              return `<div class="bcat"><div class="bcat-head"><span>${label}</span><span class="muted small">${list.filter(x => x.done).length}/${list.length}</span></div>
                <div class="btiles">${list.map(x => `<span class="btile r-${x.rarity} ${x.done ? "earned" : ""}" data-badge="${x.id}">${x.icon}</span>`).join("")}</div></div>`;
            }).join("")}
            <div class="cal-tip badge-tip" id="badge-tip" hidden></div>
          </details>
        </section>
      </div>
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
      const row = btn.closest(".dtask, [data-id]");
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
        case "reflect": {
          const v = document.getElementById("reflect-in").value.trim();
          Tracker.dayLog().reflection = v;
          Store.save();
          showToast(v ? "Reflection saved ✍️" : "Reflection cleared");
          break;
        }
        case "practice":
          ProblemsPage.state = { ...ProblemsPage.state, topic: btn.dataset.topic, status: "all", view: "all", q: "" };
          location.hash = "#/problems";
          return;
        case "month": this.monthOffset = Math.min(0, this.monthOffset + Number(btn.dataset.d)); break;
        case "open-review":
          ProblemsPage.state = { ...ProblemsPage.state, status: "review", view: "all" };
          location.hash = "#/problems";
          return;
        case "refresh": await this.refreshToday(); break;
        default: return;
      }
      await renderRoute();
    };

    // "More / Less" dropdown aur badges ka khulna yaad rakho
    app.querySelectorAll(".cbar-more").forEach(d => d.addEventListener("toggle", () => {
      d.open ? this.openSecs.add(d.dataset.sec) : this.openSecs.delete(d.dataset.sec);
      d.querySelector("summary").textContent = d.open ? "Less ▴" : `More (${d.querySelectorAll(".dtask").length}) ▾`;
    }));
    app.querySelector(".badge-all")?.addEventListener("toggle", e => { this.showBadges = e.target.open; });
    const cab = app.querySelector("details.trophy-cab");
    cab?.addEventListener("toggle", () => { this.cabOpen = cab.open; });
    // Cabinet ke bahar click karo toh band
    document.onclick = e => { if (cab?.open && !e.target.closest(".trophy-cab")) { cab.open = false; this.cabOpen = false; } };
    document.getElementById("reflect-in")?.addEventListener("keydown", e => {
      if (e.key === "Enter") app.querySelector("[data-action=reflect]").click();
    });

    // Activity calendar: din pe mouse le jao toh us din ka poora hisaab
    const tip = document.getElementById("cal-tip");
    const btip = document.getElementById("badge-tip");
    app.onmouseover = e => {
      const tile = e.target.closest(".btile[data-badge]");
      if (btip) {
        if (tile) {
          const x = this._badges.find(b => b.id === tile.dataset.badge);
          btip.innerHTML = `<div class="tc-name"><span class="bicon">${x.icon}</span><b>${x.name}</b><span class="rar r-${x.rarity}">${Insights.RARITY[x.rarity]}</span></div>
            <div class="muted small">Why: ${x.desc}</div>
            <div class="small ${x.done ? "ok" : ""}">${x.done ? `✓ Earned on ${Insights.earnedText(x.on) || "—"}` : `Progress: ${x.cur} / ${x.goal}`}</div>
            ${x.done ? "" : `<span class="mini-bar"><span style="width:${Math.round(x.cur / x.goal * 100)}%"></span></span>`}`;
          btip.hidden = false;
          const box = tile.closest(".badges-card").getBoundingClientRect(), r = tile.getBoundingClientRect();
          btip.style.left = Math.min(box.width - 244, Math.max(8, r.left - box.left - 100)) + "px";
          btip.style.top = (r.bottom - box.top + 8) + "px";
        } else btip.hidden = true;
      }
      if (!tip) return;
      const cell = e.target.closest(".cal-cell[data-date]");
      if (!cell) { tip.hidden = true; return; }
      tip.innerHTML = this.dayTip(cell.dataset.date);
      tip.hidden = false;
      const box = cell.closest(".cal-card").getBoundingClientRect(), r = cell.getBoundingClientRect();
      tip.style.left = Math.min(box.width - 236, Math.max(8, r.left - box.left - 100)) + "px";
      tip.style.top = (r.bottom - box.top + 8) + "px";
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
      const tb = document.querySelector("[data-time-bar]");
      const cap = Store.settings.hours[DAY_KEYS[new Date().getDay()]] * 60;
      if (tb && cap) tb.style.width = Math.min(100, Math.round(Tracker.todaySeconds() / 60 / cap * 100)) + "%";
    }, 1000);
  },
};
