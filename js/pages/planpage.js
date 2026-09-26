// =========================================================
// PLAN: sidebar mein do pages
//   Plan → Warm-up     (#/plan/warmup)
//   Plan → Main Quest  (#/plan/main)   poora tree Step 6c mein
// =========================================================
const WARMUP_CATEGORIES = [
  "Basics", "Conditionals", "Basic Loops", "Digit Programs", "Number Theory", "Series", "Mixed Logic",
  "Star Patterns", "Number Patterns", "Alphabet Patterns", "Arrays", "Strings", "Matrix", "Recursion", "Bit Manipulation",
];

function ringHtml(pct, label) {
  return `<div class="ring" style="--p:${pct}"><span>${label ?? pct + "%"}</span></div>`;
}

// ---------------------------------------------------------
// WARM-UP PAGE
// ---------------------------------------------------------
const WarmupPage = {
  filters: { q: "", cat: "all", status: "all" },

  wStatus(id) {
    const w = Store.state.warmup;
    if (w.tooEasy.includes(id)) return "easy";
    if (w.done[id]) return "done";
    return "todo";
  },

  wRow(item) {
    const st = this.wStatus(item.id);
    const review = !!Store.state.review[item.id];
    const times = Store.state.warmup.history?.[item.id] || 0;
    return `
      <li class="wrow ${st === "done" ? "is-done" : ""} ${st === "easy" ? "is-easy" : ""}"
          data-id="${item.id}" data-type="warmup" data-cat="${esc(item.category)}" data-status="${st}${review ? " review" : ""}"
          data-search="${esc((item.id + " " + item.title).toLowerCase())}">
        ${st === "easy"
          ? `<span class="check check-off" title="Too easy">–</span>`
          : `<button class="check" data-action="done" aria-label="${st === "done" ? "Undo" : "Mark done"}">✓</button>`}
        <button class="title-btn wrow-title" data-action="open">${esc(item.title)}</button>
        <span class="wrow-meta">
          <span class="tag">${esc(item.category)}</span>
          ${times > 1 ? `<span class="muted small" title="Times solved">×${times}</span>` : ""}
          ${st === "easy"
            ? `<button class="linkbtn" data-action="uneasy">Restore</button>`
            : `<button class="rv ${review ? "on" : ""}" data-action="review" title="${review ? "Remove from review" : "Mark for review"}">🔁</button>`}
        </span>
      </li>`;
  },

  async render() {
    await DashboardPage.ensureToday();
    await Warmup.ensureRound();
    const wb = await Data.workbook();
    const byId = Object.fromEntries(wb.map(x => [x.id, x]));
    const w = Store.state.warmup;
    const review = Store.state.review;

    // Round progress
    const roundIds = w.order.filter(id => Warmup.inRound(id));
    const roundDone = roundIds.filter(id => w.done[id]).length;
    const roundPct = roundIds.length ? Math.round((roundDone / roundIds.length) * 100) : 0;
    const active = wb.filter(x => Warmup.isActive(x.id));
    const everSolved = active.filter(x => (w.history?.[x.id] || 0) > 0).length;
    const reviewCount = active.filter(x => review[x.id]).length;

    // Today's warm-ups (Dashboard ki locked list se)
    const todayIds = (Store.state.today?.date === todayStr() ? Store.state.today.tasks : [])
      .filter(t => t.type === "warmup").map(t => t.id);
    const todayDone = todayIds.filter(id => Tracker.isDone({ id, type: "warmup" })).length;
    const todaySecs = todayIds.reduce((a, id) => a + Tracker.timeSpent(id), 0);
    const todayPct = todayIds.length ? Math.round((todayDone / todayIds.length) * 100) : 0;

    // Category bars: kam se kam ek baar solve kiye
    const cats = WARMUP_CATEGORIES.map(c => {
      const items = active.filter(x => x.category === c);
      const done = items.filter(x => (w.history?.[x.id] || 0) > 0).length;
      const pct = items.length ? Math.round((done / items.length) * 100) : 0;
      return `<div class="catbar"><span>${c}</span><div class="bar"><div style="width:${pct}%"></div></div><b>${done}/${items.length}</b></div>`;
    }).join("");

    const todayList = todayIds.length
      ? `<ul class="wlist">${todayIds.map(id => byId[id] && this.wRow(byId[id])).join("")}</ul>`
      : `<p class="muted">Today's warm-ups are picked when you open the Dashboard. <a href="#/dashboard" class="linkbtn">Open Dashboard</a></p>`;

    const f = this.filters;
    const statusOptions = [["all", "All"], ["todo", "Pending this round"], ["done", "Done this round"], ["review", "🔁 In review"], ["easy", "Too easy"]];

    return `
      <h1 class="page-title">Warm-up</h1>
      <p class="page-sub">Quick daily practice from the coding round workbook.</p>

      <div class="wu-top">
        <div class="card ring-card">
          ${ringHtml(roundPct)}
          <div class="grow">
            <div class="muted small">OVERALL PROGRESS</div>
            <div class="big">${Warmup.roundName()}: <b>${roundDone}</b> / ${roundIds.length}</div>
            <div class="stat-lines">
              <div><span>Solved at least once</span><b>${everSolved} / ${active.length}</b></div>
              <div><span>🔁 In review</span><b>${reviewCount}</b></div>
              <div><span>Too easy</span><b>${w.tooEasy.length}</b></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">TODAY'S WARM-UP</div>
          <div class="today-stats">
            <div><span class="muted">Done</span><b>${todayDone} / ${todayIds.length}</b></div>
            <div><span class="muted">Time spent</span><b>${formatDuration(todaySecs)}</b></div>
          </div>
          <div class="bar"><div style="width:${todayPct}%"></div></div>
        </div>
      </div>

      <div class="wu-grid">
        <section>
          <div class="dash-title-row">
            <h3 class="section-title">Today's ${todayIds.length} warm-ups</h3>
            <button class="btn btn-sm" data-action="surprise" title="Open a random question">🎲 Surprise me</button>
          </div>
          ${todayList}
        </section>
        <section>
          <h3 class="section-title">By category</h3>
          <div class="card cats">${cats}</div>
        </section>
      </div>

      <h3 class="section-title" style="margin:24px 0 10px">🏆 Warm-up contests <span class="muted small">3 random questions · 45 min · unlocks when a category is fully solved</span></h3>
      <div class="wcontests">${(await Promise.all(WARMUP_CATEGORIES.map(async c => {
        const st = await Contest.warmupStatus(c);
        const rec = Contest.record("warmup", c);
        return `<div class="card wcontest ${st.unlocked ? "open" : ""}">
          <b>${c}</b>
          <span class="muted small">${st.unlocked ? (rec.taken ? `${rec.passed}/${rec.taken} passed` : "Ready") : `🔒 ${st.done}/${st.total} solved`}</span>
          ${st.unlocked ? `<button class="btn btn-sm btn-primary" data-action="wcontest" data-cat="${c}">Start</button>` : ""}
        </div>`;
      }))).join("")}</div>

      <details class="bank" ${f.q || f.cat !== "all" || f.status !== "all" ? "open" : ""}>
        <summary><span>📚 Full question bank</span><span class="muted">${wb.length} questions</span></summary>
        <div class="bank-filters">
          <input type="search" id="wb-q" placeholder="Search by name or ID (e.g. LD16)..." value="${esc(f.q)}">
          <select id="wb-cat">
            <option value="all">All categories</option>
            ${WARMUP_CATEGORIES.map(c => `<option ${f.cat === c ? "selected" : ""}>${c}</option>`).join("")}
          </select>
          <select id="wb-status">
            ${statusOptions.map(([v, l]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${l}</option>`).join("")}
          </select>
          <span class="muted small" id="wb-count"></span>
        </div>
        <ul class="wlist" id="wb-list">${wb.map(x => this.wRow(x)).join("")}</ul>
      </details>`;
  },

  // Search / filter: page dobara banaye bina sirf rows chhupao-dikhao (typing smooth rehti hai)
  applyFilters() {
    const { q, cat, status } = this.filters;
    let shown = 0;
    document.querySelectorAll("#wb-list .wrow").forEach(li => {
      const ok = (!q || li.dataset.search.includes(q.toLowerCase()))
        && (cat === "all" || li.dataset.cat === cat)
        && (status === "all" || li.dataset.status.split(" ").includes(status));
      li.hidden = !ok;
      if (ok) shown++;
    });
    const c = document.getElementById("wb-count");
    if (c) c.textContent = `${shown} shown`;
  },

  afterRender() {
    const app = document.getElementById("app");
    this.applyFilters();

    app.oninput = e => {
      if (e.target.id === "wb-q") { this.filters.q = e.target.value; this.applyFilters(); }
    };
    app.onchange = e => {
      if (e.target.id === "wb-cat") { this.filters.cat = e.target.value; this.applyFilters(); }
      if (e.target.id === "wb-status") { this.filters.status = e.target.value; this.applyFilters(); }
    };

    app.onclick = async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest("[data-id]");
      const task = row ? { id: row.dataset.id, type: row.dataset.type } : null;

      switch (btn.dataset.action) {
        case "open": QuestionPanel.open(task); return;
        case "done": Tracker.toggleDone(task); break;
        case "review":
          if (Store.state.review[task.id]) delete Store.state.review[task.id];
          else Store.state.review[task.id] = true;
          Store.save();
          break;
        case "uneasy": Warmup.undoTooEasy(task.id); break;
        case "wcontest":
          if (confirm(`Start the ${btn.dataset.cat} contest? 3 random questions, 45 minutes. Other features will be paused until you submit.`))
            await Contest.start("warmup", btn.dataset.cat);
          return;
        case "surprise": {
          const pool = (await Data.workbook()).filter(x => Warmup.isActive(x.id) && !Store.state.warmup.done[x.id]);
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) QuestionPanel.open({ id: pick.id, type: "warmup" });
          return;
        }
        default: return;
      }
      // scroll position bachao, taaki list mein jagah na khoye
      const y = window.scrollY;
      await renderRoute();
      window.scrollTo(0, y);
    };
  },
};

// ---------------------------------------------------------
// MAIN QUEST PAGE: tree view (quest.js)
// ---------------------------------------------------------
const MainQuestPage = {
  async render() {
    await DashboardPage.ensureToday();
    return QuestTree.render("core");
  },
  afterRender() { QuestTree.afterRender("core"); },
};
