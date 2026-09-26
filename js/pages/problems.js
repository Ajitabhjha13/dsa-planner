// =========================================================
// PROBLEMS: "sab kuch ek jagah" library
// 522 problems + 322 warm-ups, ek search, clickable cards, filters,
// aur "My Notes" view. List bina poora page dobara banaye update hoti hai.
// =========================================================
const ProblemsPage = {
  state: { q: "", source: "all", topic: "all", status: "all", level: "all", tier: "all", hf: false, view: "all", sort: "default", limit: 60 },
  items: [],

  // Problems + warm-ups ko ek hi shape mein lao
  async loadItems() {
    const problems = await Data.problems();
    const wb = await Data.workbook();
    const pr = Store.state.progress;
    const w = Store.state.warmup;
    const main = problems.map((p, i) => ({
      id: p.id, type: "main", title: p.title, alt: (p.altTitles || []).join(" "),
      source: p.source, topic: p.topic, level: p.level, tier: p.tier, hf: p.highFrequency, order: i,
      status: pr[p.id]?.status === "done" ? "done" : pr[p.id]?.status === "skipped" ? "skipped" : "pending",
      doneOn: pr[p.id]?.doneOn || "", time: pr[p.id]?.timeSpent || 0,
    }));
    const warm = wb.map((x, i) => ({
      id: x.id, type: "warmup", title: x.title, alt: x.id, source: "W", topic: "Basics (Warm-up)", category: x.category,
      level: "basic", tier: "warmup", hf: false, order: 10000 + i,
      status: w.tooEasy.includes(x.id) ? "easy" : (w.history?.[x.id] || 0) > 0 ? "done" : "pending",
      doneOn: w.lastDone?.[x.id] || "", time: pr[x.id]?.timeSpent || 0,
    }));
    this.items = [...main, ...warm];
  },

  hasNotes(id) {
    const n = Store.state.notes[id];
    return !!(n && (n.solution?.trim() || n.keyPoints?.trim() || n.notes?.trim() || n.hints?.some(h => h.trim())));
  },

  filtered() {
    const s = this.state;
    const q = s.q.trim().toLowerCase();
    let list = this.items.filter(it =>
      (s.source === "all" || it.source === s.source)
      && (s.topic === "all" || it.topic === s.topic)
      && (s.level === "all" || it.level === s.level)
      && (s.tier === "all" || it.tier === s.tier)
      && (!s.hf || it.hf)
      && (s.status === "all"
        || (s.status === "review" ? !!Store.state.review[it.id] : s.status === "notes" ? this.hasNotes(it.id) : it.status === s.status))
      && (!q || `${it.id} ${it.title} ${it.alt}`.toLowerCase().includes(q)));
    if (s.view === "notes") list = list.filter(it => this.hasNotes(it.id));
    const by = {
      default: (a, b) => a.order - b.order,
      recent: (a, b) => (b.doneOn || "").localeCompare(a.doneOn || "") || a.order - b.order,
      time: (a, b) => b.time - a.time || a.order - b.order,
      az: (a, b) => a.title.localeCompare(b.title),
    }[s.sort];
    return list.sort(by);
  },

  // ---------------- ROWS ----------------
  row(it) {
    const review = !!Store.state.review[it.id];
    const notes = this.hasNotes(it.id);
    const tierPill = it.tier === "advanced" ? `<span class="pill">Plan 2.0</span>` : "";
    return `
      <li class="qrow lib-row ${it.status === "done" ? "is-done" : ""} ${it.status === "skipped" || it.status === "easy" ? "is-skipped" : ""}"
          data-id="${it.id}" data-type="${it.type}">
        ${it.status === "easy"
          ? `<span class="check check-off" title="Too easy">–</span>`
          : `<button class="check" data-action="done" aria-label="${it.status === "done" ? "Undo" : "Mark done"}">✓</button>`}
        <span class="src src-${it.source}" title="${SOURCE_NAMES[it.source] || ""}">${it.source}</span>
        <button class="title-btn qrow-title" data-action="open">${esc(it.title)}</button>
        <span class="qrow-meta">
          ${it.time ? `<span class="muted small" title="Time spent">⏱ ${formatDuration(it.time)}</span>` : ""}
          ${notes ? `<button class="linkbtn" data-action="notes" title="Open notes">📝</button>` : ""}
          ${tierPill}
          ${it.hf ? `<span class="hf">HF</span>` : ""}
          <span class="tag">${esc(it.type === "warmup" ? it.category : it.topic)}</span>
          <span class="lvl lvl-${it.level}">${LEVEL_NAMES[it.level]}</span>
          <button class="rv ${review ? "on" : ""}" data-action="review" title="${review ? "Remove from review" : "Mark for review"}">🔁</button>
        </span>
      </li>`;
  },

  noteCard(it) {
    const n = Store.state.notes[it.id] || {};
    const hints = (n.hints || []).filter(h => h.trim()).length;
    const snippet = (n.notes || "").trim().slice(0, 160);
    return `
      <div class="card note-card" data-id="${it.id}" data-type="${it.type}">
        <div class="note-head">
          <span class="src src-${it.source}">${it.source}</span>
          <button class="title-btn note-title" data-action="notes">${esc(it.title)}</button>
        </div>
        <div class="note-tags">
          ${n.solution?.trim() ? `<span class="tag">💻 Solution</span>` : ""}
          ${hints ? `<span class="tag">💡 ${hints} hint${hints > 1 ? "s" : ""}</span>` : ""}
          ${n.help === "self" ? `<span class="tag ok">💪 On my own</span>` : n.help === "help" ? `<span class="tag">🤝 With help</span>` : ""}
        </div>
        ${n.keyPoints?.trim() ? `<p class="note-kp">${esc(n.keyPoints)}</p>` : `<p class="muted small">No key points yet.</p>`}
        ${snippet ? `<p class="muted small note-snip">${esc(snippet)}${(n.notes || "").length > 160 ? "…" : ""}</p>` : ""}
      </div>`;
  },

  renderList() {
    const list = this.filtered();
    const s = this.state;
    const box = document.getElementById("lib-list");
    if (!box) return;
    const shown = list.slice(0, s.limit);
    box.innerHTML = !list.length
      ? `<div class="card empty">Nothing matches these filters.</div>`
      : s.view === "notes"
        ? `<div class="notes-grid">${shown.map(it => this.noteCard(it)).join("")}</div>`
        : `<ul class="qlist lib-list">${shown.map(it => this.row(it)).join("")}</ul>`;
    if (list.length > s.limit) box.innerHTML += `<div class="more"><button class="btn" data-action="more">Show more (${list.length - s.limit} left)</button></div>`;
    document.getElementById("lib-count").textContent = `${list.length} result${list.length === 1 ? "" : "s"}`;

    // Active card highlight
    document.querySelectorAll("[data-pick]").forEach(el => {
      const [k, v] = el.dataset.pick.split("|");
      el.classList.toggle("on", s[k] === v);
    });
    document.querySelectorAll(".lib-tab").forEach(b => b.classList.toggle("on", b.dataset.view === s.view));
  },

  // ---------------- PAGE ----------------
  async render() {
    await this.loadItems();
    const it = this.items;
    const count = src => it.filter(x => x.source === src);
    const solved = list => list.filter(x => x.status === "done").length;
    const s = this.state;

    const srcCard = (src, label) => {
      const l = count(src);
      return `<button class="card pick-card" data-pick="source|${src}">
        <div class="stat-value"><span class="src src-${src}">${src}</span> ${l.length}</div>
        <div class="stat-label">${label}</div>
        <div class="mini-bar"><span style="width:${l.length ? Math.round(solved(l) / l.length * 100) : 0}%"></span></div>
        <div class="muted small">${solved(l)} solved</div>
      </button>`;
    };

    const topics = [...new Set(it.filter(x => x.type === "main").map(x => x.topic))];
    const topicCards = topics.map(t => {
      const l = it.filter(x => x.topic === t);
      const core = l.filter(x => x.tier === "core").length;
      return `<button class="card pick-card" data-pick="topic|${esc(t)}">
        <div class="stat-value">${l.length}</div>
        <div class="stat-label">${esc(t)}</div>
        <div class="mini-bar"><span style="width:${Math.round(solved(l) / l.length * 100)}%"></span></div>
        <div class="muted small">${solved(l)} solved · ${core} Plan · ${l.length - core} Plan 2.0</div>
      </button>`;
    }).join("");

    const totalSolved = solved(it);
    const inReview = it.filter(x => Store.state.review[x.id]).length;
    const withNotes = it.filter(x => this.hasNotes(x.id)).length;
    const opts = (k, list) => list.map(([v, l]) => `<option value="${v}" ${s[k] === v ? "selected" : ""}>${l}</option>`).join("");

    return `
      <div class="dash-head">
        <div>
          <h1 class="page-title">Problems</h1>
          <p class="page-sub">Everything in one place: ${it.length - 322} problems and 322 warm-ups.</p>
        </div>
        <div class="btn-row">
          <button class="btn btn-sm" data-action="random">🎲 Random unsolved</button>
          <button class="btn btn-sm" data-action="export">⬇ Export my notes</button>
        </div>
      </div>

      <div class="lib-stats">
        <button class="card pick-card" data-pick="status|done"><div class="stat-value">${totalSolved}</div><div class="stat-label">Solved</div></button>
        <button class="card pick-card" data-pick="status|review"><div class="stat-value">${inReview}</div><div class="stat-label">🔁 In review</div></button>
        <button class="card pick-card" data-pick="status|notes"><div class="stat-value">${withNotes}</div><div class="stat-label">📝 With notes</div></button>
        <button class="card pick-card" data-pick="status|skipped"><div class="stat-value">${it.filter(x => x.status === "skipped").length}</div><div class="stat-label">Skipped</div></button>
      </div>

      <h2 class="section-title lib-h">Sources</h2>
      <div class="grid source-grid">
        ${srcCard("S", "Striver A2Z only")}
        ${srcCard("L", "Love Babbar only")}
        ${srcCard("C", "Common to both")}
        ${srcCard("R", "Roadmap only")}
        ${srcCard("W", "Basics (warm-up workbook)")}
      </div>

      <h2 class="section-title lib-h">Topics</h2>
      <div class="grid topic-grid">${topicCards}</div>

      <div class="lib-browser" id="lib-browser">
        <div class="lib-tabs">
          <button class="lib-tab" data-view="all" data-action="view">All problems</button>
          <button class="lib-tab" data-view="notes" data-action="view">📝 My notes</button>
          <span class="grow"></span>
          <span class="muted small" id="lib-count"></span>
        </div>
        <div class="qtoolbar">
          <input type="search" id="lib-q" placeholder="Search all problems and warm-ups (name, Babbar name or ID)..." value="${esc(s.q)}">
          <select data-key="source">${opts("source", [["all", "All sources"], ["S", "S · Striver"], ["L", "L · Love Babbar"], ["C", "C · Common"], ["R", "R · Roadmap"], ["W", "W · Warm-up basics"]])}</select>
          <select data-key="topic">${opts("topic", [["all", "All topics"], ...topics.map(t => [t, t]), ["Basics (Warm-up)", "Basics (Warm-up)"]])}</select>
          <select data-key="status">${opts("status", [["all", "Any status"], ["pending", "Pending"], ["done", "Solved"], ["review", "🔁 In review"], ["notes", "📝 With notes"], ["skipped", "Skipped"], ["easy", "Too easy"]])}</select>
          <select data-key="level">${opts("level", [["all", "All levels"], ["basic", "Basic"], ["core", "Core"], ["pro", "Pro"]])}</select>
          <select data-key="tier">${opts("tier", [["all", "All plans"], ["core", "Plan"], ["advanced", "Plan 2.0"], ["warmup", "Warm-up"]])}</select>
          <select data-key="sort">${opts("sort", [["default", "Sort: plan order"], ["recent", "Sort: recently solved"], ["time", "Sort: most time spent"], ["az", "Sort: A → Z"]])}</select>
          <label class="check-label"><input type="checkbox" id="lib-hf" ${s.hf ? "checked" : ""}> HF only</label>
          <button class="linkbtn" data-action="clear">Clear filters</button>
        </div>
        <div id="lib-list"></div>
      </div>`;
  },

  update(patch, scroll = false) {
    Object.assign(this.state, patch, { limit: 60 });
    this.renderList();
    // select boxes ko state ke saath sync rakho
    document.querySelectorAll("#lib-browser select[data-key]").forEach(sel => { sel.value = this.state[sel.dataset.key]; });
    if (scroll) document.getElementById("lib-browser").scrollIntoView({ behavior: "smooth", block: "start" });
  },

  exportNotes() {
    const byId = Object.fromEntries(this.items.map(x => [x.id, x]));
    const ids = Object.keys(Store.state.notes).filter(id => this.hasNotes(id) && byId[id]).sort((a, b) => byId[a].order - byId[b].order);
    if (!ids.length) { showToast("You have no notes yet."); return; }
    let md = `# My DSA Notes\n\nExported on ${prettyDate(todayStr())}\n`;
    let topic = "";
    ids.forEach(id => {
      const it = byId[id], n = Store.state.notes[id];
      const t = it.type === "warmup" ? "Basics (Warm-up)" : it.topic;
      if (t !== topic) { topic = t; md += `\n## ${t}\n`; }
      md += `\n### ${it.title}\n`;
      if (n.keyPoints?.trim()) md += `\n**Key points:** ${n.keyPoints.trim()}\n`;
      (n.hints || []).filter(h => h.trim()).forEach((h, i) => { md += `\n- Hint ${i + 1}: ${h.trim()}`; });
      if (n.notes?.trim()) md += `\n\n${n.notes.trim()}\n`;
      if (n.solution?.trim()) md += `\n\`\`\`java\n${n.solution.trim()}\n\`\`\`\n`;
    });
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dsa-notes-${todayStr()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast(`Exported notes for ${ids.length} problem${ids.length > 1 ? "s" : ""}.`);
  },

  afterRender() {
    const app = document.getElementById("app");
    this.renderList();

    app.oninput = e => {
      if (e.target.id === "lib-q") { this.state.q = e.target.value; this.state.limit = 60; this.renderList(); }
    };
    app.onchange = e => {
      if (e.target.dataset.key) this.update({ [e.target.dataset.key]: e.target.value });
      if (e.target.id === "lib-hf") this.update({ hf: e.target.checked });
    };

    app.onclick = async e => {
      const pick = e.target.closest("[data-pick]");
      if (pick) {
        const [k, v] = pick.dataset.pick.split("|");
        // Card dobara dabao toh filter hat jaye
        this.update({ [k]: this.state[k] === v ? "all" : v }, true);
        return;
      }
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest("[data-id]");
      const task = row ? { id: row.dataset.id, type: row.dataset.type } : null;

      switch (btn.dataset.action) {
        case "open": QuestionPanel.open(task); return;
        case "notes": QuestionPanel.open(task, task.type === "main" || task.type === "warmup" ? "notes" : "question"); return;
        case "view": this.update({ view: btn.dataset.view }); return;
        case "more": this.state.limit += 60; this.renderList(); return;
        case "clear":
          this.state = { ...this.state, q: "", source: "all", topic: "all", status: "all", level: "all", tier: "all", hf: false, sort: "default" };
          document.getElementById("lib-q").value = "";
          document.getElementById("lib-hf").checked = false;
          this.update({});
          return;
        case "export": this.exportNotes(); return;
        case "random": {
          const pool = this.filtered().filter(x => x.status === "pending");
          const pick = pool[Math.floor(Math.random() * pool.length)];
          if (pick) QuestionPanel.open({ id: pick.id, type: pick.type });
          else showToast("No unsolved problems match these filters.");
          return;
        }
        case "done":
          if (task.type === "warmup" && Store.state.warmup.done[task.id] === undefined && (Store.state.warmup.history?.[task.id] || 0) > 0) {
            // Pichhle round mein solve hua tha: history hata do (undo)
            Store.state.warmup.history[task.id] = 0;
            Store.save();
          } else Tracker.toggleDone(task);
          break;
        case "review":
          if (Store.state.review[task.id]) delete Store.state.review[task.id];
          else Store.state.review[task.id] = true;
          Store.save();
          break;
        default: return;
      }
      // Sirf data dobara padho aur list update karo (upar ke cards bhi)
      const y = window.scrollY;
      await renderRoute();
      window.scrollTo(0, y);
    };
  },
};
