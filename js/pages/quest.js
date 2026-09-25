// =========================================================
// QUEST TREE: TUF jaisa Topic → Section → Problems
// Main Quest (core) aur Plan 2.0 (advanced) dono yahi use karte hain.
// =========================================================
const QuestTree = {
  // Har mode ka apna UI state (page badalne pe bhi yaad rehta hai)
  ui: {
    core: { topics: null, groups: null, filters: { q: "", level: "all", source: "all", status: "all", hf: false }, revision: false, revealAll: false, revOnly: false },
    advanced: { topics: null, groups: null, filters: { q: "", level: "all", source: "all", status: "all", hf: false }, revision: false, revealAll: false, revOnly: false },
  },
  revealed: new Set(),
  mode: "core",

  status(id) {
    return Store.state.progress[id]?.status || "pending";
  },

  // Topic → groups → problems
  buildTree(problems) {
    const topics = [];
    problems.forEach(p => {
      let t = topics.find(x => x.name === p.topic);
      if (!t) topics.push(t = { name: p.topic, groups: [] });
      let g = t.groups.find(x => x.name === p.group);
      if (!g) t.groups.push(g = { name: p.group, items: [] });
      g.items.push(p);
    });
    return topics;
  },

  counts(items) {
    const done = items.filter(p => this.status(p.id) === "done").length;
    return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
  },

  // Target date tak kitne problems ho jaane chahiye the (hours ke hisaab se)
  pace(total, done) {
    const s = Store.settings;
    const start = parseDate(s.startDate), target = parseDate(s.targetDate), today = parseDate(todayStr());
    let capAll = 0, capSoFar = 0;
    for (let d = new Date(start); d <= target; d = addDays(d, 1)) {
      const c = s.hours[DAY_KEYS[d.getDay()]];
      capAll += c;
      if (d < today) capSoFar += c; // kal tak ka hisaab, taaki subah-subah 'behind' na dikhe
    }
    const expected = capAll ? Math.round((total * capSoFar) / capAll) : 0;
    return { expected, diff: done - expected };
  },

  row(p, ctx) {
    const st = this.status(p.id);
    const review = !!Store.state.review[p.id];
    const n = Store.state.notes[p.id];
    const hasNotes = n && (n.solution || n.keyPoints || n.notes || n.hints?.some(h => h.trim()));
    const isToday = ctx.todayIds.has(p.id);
    const isNext = ctx.nextId === p.id;
    return `
      <li class="qrow ${st === "done" ? "is-done" : ""} ${st === "skipped" ? "is-skipped" : ""} ${isNext ? "is-next" : ""}"
          data-id="${p.id}" data-type="main" data-level="${p.level}" data-source="${p.source}"
          data-status="${st}${review ? " review" : ""}" data-hf="${p.highFrequency ? 1 : 0}"
          data-search="${esc((p.title + " " + (p.altTitles || []).join(" ")).toLowerCase())}">
        <button class="check" data-action="done" aria-label="${st === "done" ? "Undo" : "Mark done"}">✓</button>
        <span class="src src-${p.source}" title="${SOURCE_NAMES[p.source]}">${p.source}</span>
        <button class="title-btn qrow-title" data-action="open">${esc(p.title)}</button>
        <span class="qrow-meta">
          ${isNext ? `<span class="pill pill-next">Up next</span>` : isToday && st !== "done" ? `<span class="pill pill-today">Today</span>` : ""}
          ${st === "skipped" ? `<span class="pill">Skipped</span>` : ""}
          ${hasNotes ? `<span class="muted" title="Has notes">📝</span>` : ""}
          ${p.highFrequency ? `<span class="hf" title="High-frequency">HF</span>` : ""}
          <span class="lvl lvl-${p.level}">${LEVEL_NAMES[p.level]}</span>
          <button class="rv ${review ? "on" : ""}" data-action="review" title="${review ? "Remove from review" : "Mark for review"}">🔁</button>
        </span>
      </li>`;
  },

  async render(mode) {
    this.mode = mode;
    const ui = this.ui[mode];
    const problems = (await Data.problems()).filter(p => p.tier === mode);
    const tree = this.buildTree(problems);
    const plan = await Scheduler.buildPlan(mode);

    const todayIds = new Set(mode === "core" && Store.state.today?.date === todayStr()
      ? Store.state.today.tasks.filter(t => t.type === "main").map(t => t.id) : []);
    const next = problems.find(p => this.status(p.id) === "pending");
    const ctx = { todayIds, nextId: next?.id };

    // Pehli baar: "next" wala topic + group khula rakho
    if (!ui.topics) {
      ui.topics = new Set(next ? [next.topic] : tree[0] ? [tree[0].name] : []);
      ui.groups = new Set(next ? [`${next.topic}|${next.group}`] : []);
    }

    // Topic ETA: plan mein us topic ka aakhri din
    const eta = {};
    (plan.days || []).forEach(d => d.main.forEach(t => { eta[t.topic] = d.date; }));

    const all = this.counts(problems);
    const header = mode === "core" ? await this.headerCore(problems, all, plan, todayIds, next) : this.headerAdv(all, plan);

    if (ui.revision) return header + this.revisionView(problems, ui);

    const f = ui.filters;
    const opts = (list, val) => list.map(([v, l]) => `<option value="${v}" ${val === v ? "selected" : ""}>${l}</option>`).join("");
    const toolbar = `
      <div class="qtoolbar">
        <input type="search" id="qt-q" placeholder="Search problems..." value="${esc(f.q)}">
        <select id="qt-level">${opts([["all", "All levels"], ["basic", "Basic"], ["core", "Core"], ["pro", "Pro"]], f.level)}</select>
        <select id="qt-source">${opts([["all", "All sources"], ["S", "S · Striver"], ["L", "L · Love Babbar"], ["C", "C · Common"], ["R", "R · Roadmap"]], f.source)}</select>
        <select id="qt-status">${opts([["all", "All status"], ["pending", "Pending"], ["done", "Done"], ["review", "🔁 In review"], ["skipped", "Skipped"]], f.status)}</select>
        <label class="check-label"><input type="checkbox" id="qt-hf" ${f.hf ? "checked" : ""}> HF only</label>
        <span class="muted small" id="qt-count"></span>
        <span class="qtoolbar-right">
          <button class="linkbtn" data-action="expand">Expand all</button>
          <button class="linkbtn" data-action="collapse">Collapse all</button>
        </span>
      </div>`;

    const topicsHtml = tree.map(t => {
      const all = t.groups.flatMap(g => g.items);
      const c = this.counts(all);
      const etaText = mode !== "core" ? "" : c.done === c.total ? `<span class="eta done">✓ Completed</span>`
        : eta[t.name] ? `<span class="eta">ETA ${prettyDate(eta[t.name])}</span>` : "";
      const groups = t.groups.map(g => {
        const gc = this.counts(g.items);
        const key = `${t.name}|${g.name}`;
        return `
          <details class="qgroup" data-key="${esc(key)}" ${ui.groups.has(key) ? "open" : ""}>
            <summary>
              <span class="chev-sm">›</span>
              <span class="qgroup-name">${esc(g.name)}</span>
              <span class="qbar"><span style="width:${gc.pct}%"></span></span>
              <span class="qcount">${gc.done}/${gc.total}</span>
            </summary>
            <ul class="qlist">${g.items.map(p => this.row(p, ctx)).join("")}</ul>
          </details>`;
      }).join("");
      return `
        <details class="qtopic" data-topic="${esc(t.name)}" ${ui.topics.has(t.name) ? "open" : ""}>
          <summary>
            <span class="chev-sm">›</span>
            <span class="qtopic-name">${esc(t.name)}</span>
            ${etaText}
            <span class="qbar"><span style="width:${c.pct}%"></span></span>
            <span class="qcount">${c.done}/${c.total}</span>
          </summary>
          <div class="qtopic-body">${groups}</div>
        </details>`;
    }).join("");

    return header + toolbar + `<div class="qtree">${topicsHtml}</div>`;
  },

  async headerCore(problems, all, plan, todayIds, next) {
    const pace = this.pace(all.total, all.done);
    const sp = Scheduler.speedFactor();
    const todayItems = problems.filter(p => todayIds.has(p.id));
    const todayDone = todayItems.filter(p => this.status(p.id) === "done").length;
    const late = plan.lateBy > 0;
    const paceText = pace.diff > 0 ? `<b class="ok">${pace.diff} ahead</b>` : pace.diff < 0 ? `<b class="late">${-pace.diff} behind</b>` : `<b>Right on pace</b>`;

    return `
      <h1 class="page-title">Main Quest</h1>
      <p class="page-sub">Go topic by topic, section by section. Fundamentals first, then gradually harder.</p>
      <div class="qhead">
        <div class="card ring-card">
          ${ringHtml(all.pct)}
          <div class="grow">
            <div class="muted small">OVERALL PROGRESS</div>
            <div class="big"><b>${all.done}</b> / ${all.total} problems</div>
            <div class="stat-lines">
              <div><span>Projected finish</span><b class="${late ? "late" : ""}">${prettyDate(plan.mainEnd || plan.endDate)}</b></div>
              <div><span>Target</span><b>${prettyDate(Store.settings.targetDate)}</b></div>
              <div><span>Status</span><b class="${late ? "late" : "ok"}">${late ? `${plan.lateBy} days late` : "On track"}</b></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">PACE</div>
          <div class="big">${paceText}</div>
          <div class="stat-lines">
            <div><span>Expected by yesterday</span><b>${pace.expected}</b></div>
            <div><span>Done</span><b>${all.done}</b></div>
            <div><span>Your speed</span><b>${sp.samples >= 15 ? `${sp.factor.toFixed(2)}× estimate` : `learning (${sp.samples}/15)`}</b></div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">TODAY'S TARGET</div>
          <div class="big"><b>${todayDone}</b> / ${todayItems.length} problems</div>
          <div class="bar"><div style="width:${todayItems.length ? Math.round((todayDone / todayItems.length) * 100) : 0}%"></div></div>
          <div class="qhead-actions">
            ${next ? `<button class="btn btn-primary" data-action="continue">Continue → ${esc(next.title)}</button>` : `<span class="ok">🎉 All done!</span>`}
            <button class="btn" data-action="revision">🧠 Revision Mode</button>
          </div>
        </div>
      </div>`;
  },

  headerAdv(all, plan) {
    return `
      <h1 class="page-title">Plan 2.0</h1>
      <p class="page-sub">Advanced topics and Pro-level problems. Starts after the core plan${plan.startDate ? `, around ${prettyDate(plan.startDate)}` : ""}.</p>
      <div class="qhead two">
        <div class="card ring-card">
          ${ringHtml(all.pct)}
          <div class="grow">
            <div class="muted small">OVERALL PROGRESS</div>
            <div class="big"><b>${all.done}</b> / ${all.total} problems</div>
            <div class="stat-lines"><div><span>Projected finish</span><b>${plan.endDate ? prettyDate(plan.endDate) : "-"}</b></div></div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">REVISION</div>
          <p class="muted small">Flip through solved problems with just their key points.</p>
          <button class="btn" data-action="revision">🧠 Revision Mode</button>
        </div>
      </div>`;
  },

  // ---------------- REVISION MODE ----------------
  revisionView(problems, ui) {
    const solved = problems.filter(p => this.status(p.id) === "done" && (!ui.revOnly || Store.state.review[p.id]));
    const byTopic = this.buildTree(solved);
    const cards = byTopic.map(t => `
      <h3 class="section-title rev-topic">${esc(t.name)} <span class="muted small">${t.groups.reduce((a, g) => a + g.items.length, 0)}</span></h3>
      <div class="rev-grid">
        ${t.groups.flatMap(g => g.items).map(p => {
          const kp = Store.state.notes[p.id]?.keyPoints?.trim();
          const open = ui.revealAll || this.revealed.has(p.id);
          return `
            <div class="rev-card ${open ? "open" : ""}" data-id="${p.id}" data-type="main">
              <button class="rev-front" data-action="flip">
                <span class="rev-title">${esc(p.title)}</span>
                <span class="lvl lvl-${p.level}">${LEVEL_NAMES[p.level]}</span>
              </button>
              ${open ? `<div class="rev-back">${kp ? esc(kp) : `<span class="muted">No key points yet.</span>`}
                <button class="linkbtn" data-action="open-notes">${kp ? "Open" : "Add key points"}</button></div>` : ""}
            </div>`;
        }).join("")}
      </div>`).join("");

    return `
      <div class="rev-bar">
        <b>🧠 Revision Mode</b>
        <span class="muted small">${solved.length} solved problem${solved.length === 1 ? "" : "s"}. Recall the approach, then flip the card.</span>
        <span class="qtoolbar-right">
          <label class="check-label"><input type="checkbox" id="rev-only" ${ui.revOnly ? "checked" : ""}> 🔁 Review only</label>
          <button class="btn btn-sm" data-action="reveal-all">${ui.revealAll ? "Hide all" : "Reveal all"}</button>
          <button class="btn btn-sm btn-primary" data-action="revision">Exit</button>
        </span>
      </div>
      ${solved.length ? cards : `<div class="card empty">No solved problems yet. Solve a few, add key points, and come back here before interviews.</div>`}`;
  },

  // ---------------- FILTERS (DOM level, bina re-render) ----------------
  applyFilters() {
    const f = this.ui[this.mode].filters;
    const active = f.q || f.level !== "all" || f.source !== "all" || f.status !== "all" || f.hf;
    let shown = 0;
    document.querySelectorAll(".qrow").forEach(li => {
      const ok = (!f.q || li.dataset.search.includes(f.q.toLowerCase()))
        && (f.level === "all" || li.dataset.level === f.level)
        && (f.source === "all" || li.dataset.source === f.source)
        && (f.status === "all" || li.dataset.status.split(" ").includes(f.status))
        && (!f.hf || li.dataset.hf === "1");
      li.hidden = !ok;
      if (ok) shown++;
    });
    document.querySelectorAll(".qgroup").forEach(g => {
      const any = g.querySelector(".qrow:not([hidden])");
      g.hidden = !any;
      if (active && any) g.open = true;
    });
    document.querySelectorAll(".qtopic").forEach(t => {
      const any = t.querySelector(".qgroup:not([hidden])");
      t.hidden = !any;
      if (active && any) t.open = true;
    });
    const c = document.getElementById("qt-count");
    if (c) c.textContent = active ? `${shown} match${shown === 1 ? "" : "es"}` : "";
  },

  afterRender(mode) {
    const app = document.getElementById("app");
    const ui = this.ui[mode];
    this.applyFilters();

    // Expand / collapse yaad rakho
    app.querySelectorAll("details.qtopic").forEach(d => d.addEventListener("toggle", () => {
      d.open ? ui.topics.add(d.dataset.topic) : ui.topics.delete(d.dataset.topic);
    }));
    app.querySelectorAll("details.qgroup").forEach(d => d.addEventListener("toggle", () => {
      d.open ? ui.groups.add(d.dataset.key) : ui.groups.delete(d.dataset.key);
    }));

    const setF = (k, v) => { ui.filters[k] = v; this.applyFilters(); };
    app.oninput = e => { if (e.target.id === "qt-q") setF("q", e.target.value); };
    app.onchange = e => {
      const id = e.target.id;
      if (id === "qt-level") setF("level", e.target.value);
      if (id === "qt-source") setF("source", e.target.value);
      if (id === "qt-status") setF("status", e.target.value);
      if (id === "qt-hf") setF("hf", e.target.checked);
      if (id === "rev-only") { ui.revOnly = e.target.checked; renderRoute(); }
    };

    app.onclick = async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest("[data-id]");
      const task = row ? { id: row.dataset.id, type: "main" } : null;

      switch (btn.dataset.action) {
        case "open": QuestionPanel.open(task); return;
        case "open-notes": QuestionPanel.open(task, "notes"); return;
        case "done": Tracker.toggleDone(task); break;
        case "review":
          if (Store.state.review[task.id]) delete Store.state.review[task.id];
          else Store.state.review[task.id] = true;
          Store.save();
          break;
        case "expand":
          app.querySelectorAll("details.qtopic, details.qgroup").forEach(d => { d.open = true; });
          return;
        case "collapse":
          app.querySelectorAll("details.qtopic, details.qgroup").forEach(d => { d.open = false; });
          return;
        case "continue": {
          const next = (await Data.problems()).find(p => p.tier === mode && this.status(p.id) === "pending");
          if (!next) return;
          ui.topics.add(next.topic);
          ui.groups.add(`${next.topic}|${next.group}`);
          await renderRoute();
          document.querySelector(`.qrow[data-id="${next.id}"]`)?.scrollIntoView({ block: "center" });
          QuestionPanel.open({ id: next.id, type: "main" });
          return;
        }
        case "revision": ui.revision = !ui.revision; this.revealed.clear(); ui.revealAll = false; break;
        case "reveal-all": ui.revealAll = !ui.revealAll; this.revealed.clear(); break;
        case "flip":
          this.revealed.has(task.id) ? this.revealed.delete(task.id) : this.revealed.add(task.id);
          break;
        default: return;
      }
      const y = window.scrollY;
      await renderRoute();
      window.scrollTo(0, y);
    };
  },
};
