// =========================================================
// CONTEST PAGE (#/contest): chalta hua contest, result, aur hub (history)
// =========================================================
const ContestPage = {
  interval: null,

  async qInfo(q) {
    if (q.type === "warmup") {
      const w = (await Data.workbook()).find(x => x.id === q.id);
      return { title: w?.title || q.id, tag: w?.category || "", level: null, link: null };
    }
    const p = (await Data.problems()).find(x => x.id === q.id);
    return {
      title: p?.title || q.id, tag: p?.topic || "", level: p?.level, source: p?.source,
      link: p?.leetcode?.slug ? `https://leetcode.com/problems/${p.leetcode.slug}/` : null,
    };
  },

  async activeView(c) {
    const left = Contest.secondsLeft();
    const cards = await Promise.all(c.questions.map(async (q, i) => {
      const info = await this.qInfo(q);
      const r = c.results[q.id];
      return `
        <div class="card ccard ${r ? "is-" + r : ""}" data-id="${q.id}" data-type="${q.type}">
          <div class="ccard-head">
            <span class="cnum">Q${i + 1}</span>
            ${c.blind ? `<span class="tag">🙈 Blind mode</span>` : `
            ${info.source ? `<span class="src src-${info.source}">${info.source}</span>` : ""}
            ${info.level ? `<span class="lvl lvl-${info.level}">${LEVEL_NAMES[info.level]}</span>` : ""}
            <span class="tag">${esc(info.tag)}</span>`}
          </div>
          <button class="title-btn ctitle" data-action="open">${esc(info.title)}</button>
          <div class="ccard-actions">
            <button class="btn btn-sm" data-action="open">Read question</button>
            ${info.link ? `<a class="btn btn-sm" href="${info.link}" target="_blank" rel="noopener">Open on LeetCode ↗</a>`
              : q.type === "main" ? `<a class="btn btn-sm" href="https://www.google.com/search?q=${encodeURIComponent(info.title)}+site%3Aleetcode.com%2Fproblems" target="_blank" rel="noopener">Search on LeetCode ↗</a>
                 <a class="btn btn-sm" href="https://www.google.com/search?q=${encodeURIComponent(info.title)}+site%3Ageeksforgeeks.org" target="_blank" rel="noopener">Search on GFG ↗</a>` : ""}
            <span class="grow"></span>
            <button class="btn btn-sm ${r === "solved" ? "btn-done" : ""}" data-action="solved">✓ Solved</button>
            <button class="btn btn-sm ${r === "unsolved" ? "btn-fail" : ""}" data-action="unsolved">✗ Couldn't solve</button>
          </div>
        </div>`;
    }));
    const marked = Object.keys(c.results).length;
    return `
      <div class="contest-bar">
        <div>
          <div class="muted small">🏆 CONTEST IN PROGRESS</div>
          <h1 class="page-title">${esc(c.name)}</h1>
          <p class="page-sub">Solve in your own editor or on LeetCode. Mark each question when you are done. Pass = all ${c.questions.length} solved in time.</p>
        </div>
        <div class="countdown ${left < 600 ? "low" : ""}">
          <div class="muted small">TIME LEFT</div>
          <div class="clock" data-clock>${formatClock(left)}</div>
          <div class="muted small">of ${c.minutes} min</div>
        </div>
      </div>
      <div class="ccards">${cards.join("")}</div>
      <div class="contest-foot">
        <span class="muted small">${marked} / ${c.questions.length} marked. Unmarked questions count as not solved.</span>
        <span class="grow"></span>
        <button class="btn btn-danger" data-action="giveup">Give up</button>
        <button class="btn btn-primary" data-action="submit">Submit contest</button>
      </div>`;
  },

  async resultView(r) {
    const rows = await Promise.all(r.questions.map(async (q, i) => {
      const info = await this.qInfo(q);
      return `<li class="wrow"><span class="cnum">Q${i + 1}</span><span class="wrow-title">${esc(info.title)}</span>
        <span class="pill ${q.result === "solved" ? "pill-ok" : "pill-bad"}">${q.result === "solved" ? "✓ Solved" : "✗ Not solved"}</span></li>`;
    }));
    const why = r.reason === "timeout" ? "Time ran out." : r.reason === "giveup" ? "You gave up." : "";
    const back = r.kind === "warmup" ? "#/plan/warmup" : "#/plan/main";
    return `
      <div class="card result ${r.passed ? "pass" : "fail"}">
        <div class="result-emoji">${r.passed ? "🎉" : "💪"}</div>
        <h1 class="page-title">${r.passed ? "Passed!" : "Not passed this time"}</h1>
        <p class="page-sub">${esc(r.name)} · used ${formatClock(r.usedSec)} of ${r.minutes} min. ${why}
          ${r.questions.some(q => q.result === "unsolved") ? "Unsolved questions were added to 🔁 Review." : ""}</p>
        <ul class="wlist">${rows.join("")}</ul>
        <div class="btn-row" style="margin-top:18px">
          <button class="btn btn-primary" data-action="again" data-kind="${r.kind}" data-key="${esc(r.key)}">Try another random set</button>
          <a class="btn" href="${back}">Back</a>
          <a class="btn" href="#/contest" data-action="hub">All contests</a>
        </div>
      </div>`;
  },

  // ---------------- CUSTOM BUILDER STATE ----------------
  builder: { name: "", source: "main", topics: [], categories: [], count: 3, minutes: 90, pool: "solved", blind: false, includeAdvanced: false },

  async specialCards() {
    const cards = [];
    const add = async (kind, icon, title, info, needTxt, need) => {
      const pool = await Contest.specialPool(kind);
      const rec = Contest.record(kind, kind === "weekly" ? Contest.weekKey() : kind === "monthly" ? Contest.monthKey() : kind);
      const ok = pool.length >= need;
      cards.push(`
        <div class="card special ${ok ? "open" : ""}">
          <div class="sp-top"><span class="sp-icon">${icon}</span><b>${title}</b></div>
          <div class="muted small">${info}</div>
          <div class="muted small sp-pool">${ok ? `${pool.length} questions in the pool` : `🔒 ${needTxt} (${pool.length}/${need})`}${rec.taken ? ` · ${rec.passed}/${rec.taken} passed` : ""}</div>
          ${ok ? `<button class="btn btn-sm btn-primary" data-action="start" data-kind="${kind}" data-key="${kind}">Start</button>` : ""}
        </div>`);
    };
    await add("weekly", "📅", "Weekly Contest", `3 questions · 2 hours · from problems you solved this week (since ${prettyDate(Contest.weekKey())})`, "Solve 3 problems this week", 3);
    await add("monthly", "🗓️", "Monthly Contest", "4 questions · 3 hours · from everything you solved this month", "Solve 4 problems this month", 4);
    await add("review", "🔁", "Review Contest", "3 questions · 90 min · straight from your review list, to turn weak spots into strong ones", "Mark 3 problems for review", 3);
    await add("speed", "⚡", "Speed Round", "5 warm-ups · 15 minutes · think fast, like the first round of a service-company test", "Needs warm-up questions", 5);
    const topics = await Contest.completedTopics();
    const need = CONTEST_RULES.grand.minTopics, gr = Contest.record("grand", "grand");
    cards.push(`
      <div class="card special ${topics.length >= need ? "open" : ""}">
        <div class="sp-top"><span class="sp-icon">🏆</span><b>Grand Contest</b></div>
        <div class="muted small">3 mixed questions · 90 min · from every topic you have completed</div>
        <div class="muted small sp-pool">${topics.length >= need ? `${topics.length} topics completed` : `🔒 Complete ${need} topics (${topics.length}/${need})`}${gr.taken ? ` · ${gr.passed}/${gr.taken} passed` : ""}</div>
        ${topics.length >= need ? `<button class="btn btn-sm btn-primary" data-action="start" data-kind="grand" data-key="grand">Start</button>` : ""}
      </div>`);
    return cards.join("");
  },

  async builderView() {
    const b = this.builder;
    const problems = await Data.problems();
    const topics = [...new Set(problems.filter(p => b.includeAdvanced || p.tier === "core").map(p => p.topic))];
    const pool = await Contest.customPool(b);
    const chip = (group, v, on) => `<button class="chip ${on ? "on" : ""}" data-action="chip" data-group="${group}" data-v="${esc(v)}">${esc(v)}</button>`;
    const seg = (k, list) => `<div class="segs">${list.map(([v, l]) => `<button class="seg ${b[k] === v ? "on" : ""}" data-action="bset" data-k="${k}" data-v="${v}">${l}</button>`).join("")}</div>`;
    const templates = Store.state.contestTemplates || [];
    return `
      <div class="card builder">
        <div class="dash-title-row"><h3 class="section-title">🛠️ Design your own contest</h3>
          <span class="muted small" id="b-avail">${pool.length} questions match</span></div>

        <div class="b-grid">
          <label class="field"><span>Contest name</span><input id="b-name" maxlength="40" placeholder="e.g. Linked List + Stack mix" value="${esc(b.name)}"></label>
          <div class="field"><span>Questions from</span>${seg("source", [["main", "Main Quest"], ["warmup", "Warm-up"], ["both", "Both"]])}</div>
          <div class="field"><span>Which questions</span>${seg("pool", [["solved", "Solved only"], ["unsolved", "Unsolved only"], ["all", "Any"]])}</div>
          <div class="field b-nums">
            <label><span>Questions</span><input id="b-count" type="number" min="1" max="10" value="${b.count}"></label>
            <label><span>Time (minutes)</span><input id="b-min" type="number" min="5" max="360" step="5" value="${b.minutes}"></label>
            <div class="presets">${[45, 90, 120, 180].map(m => `<button class="chip ${b.minutes === m ? "on" : ""}" data-action="bmin" data-v="${m}">${m}m</button>`).join("")}</div>
          </div>
        </div>

        ${b.source !== "warmup" ? `
          <div class="field"><span>Main Quest topics <span class="muted small">(none selected = all)</span></span>
            <div class="chips">${topics.map(t => chip("topics", t, b.topics.includes(t))).join("")}</div>
            <label class="check-label"><input type="checkbox" id="b-adv" ${b.includeAdvanced ? "checked" : ""}> Include Plan 2.0 topics and problems</label>
          </div>` : ""}
        ${b.source !== "main" ? `
          <div class="field"><span>Warm-up categories <span class="muted small">(none selected = all)</span></span>
            <div class="chips">${WARMUP_CATEGORIES.map(c => chip("categories", c, b.categories.includes(c))).join("")}</div>
          </div>` : ""}

        <label class="check-label"><input type="checkbox" id="b-blind" ${b.blind ? "checked" : ""}> 🙈 Blind mode: hide topic names and difficulty, like a real interview</label>

        <div class="btn-row" style="margin-top:14px">
          <button class="btn btn-primary" data-action="custom-start" ${pool.length ? "" : "disabled"}>Start contest</button>
          <button class="btn" data-action="custom-save" ${pool.length ? "" : "disabled"}>Save as template</button>
        </div>

        ${templates.length ? `
          <h4 class="section-title" style="margin:18px 0 8px;font-size:15px">Saved contests</h4>
          <div class="tpl-list">${templates.map(t => {
            const rec = Contest.record("custom", t.id);
            return `<div class="tpl" data-tpl="${t.id}">
              <div class="grow"><b>${esc(t.name || "Custom Contest")}</b>
                <span class="muted small">${t.count} questions · ${t.minutes} min · ${{ main: "Main Quest", warmup: "Warm-up", both: "Both" }[t.source]}${t.topics.length ? ` · ${t.topics.join(", ")}` : ""}${t.categories.length ? ` · ${t.categories.join(", ")}` : ""}${t.blind ? " · 🙈 blind" : ""}${rec.taken ? ` · ${rec.passed}/${rec.taken} passed` : ""}</span></div>
              <button class="btn btn-sm btn-primary" data-action="tpl-run">Start</button>
              <button class="btn btn-sm" data-action="tpl-edit">Edit</button>
              <button class="btn btn-sm btn-danger" data-action="tpl-del">Delete</button>
            </div>`;
          }).join("")}</div>` : ""}
      </div>`;
  },

  async hubView() {
    const hist = [...Contest.history].reverse();
    const taken = hist.length, passed = hist.filter(h => h.passed).length;
    return `
      <div class="dash-head">
        <div>
          <h1 class="page-title">Contests</h1>
          <p class="page-sub">Timed practice with random questions. Take them as many times as you like.</p>
        </div>
        <div class="countdown-pill">🏆 <b>${passed}</b> passed / ${taken} taken</div>
      </div>

      <h3 class="section-title" style="margin:6px 0 10px">Special contests</h3>
      <div class="special-grid">${await this.specialCards()}</div>

      <div style="margin-top:18px">${await this.builderView()}</div>

      <h3 class="section-title" style="margin:22px 0 10px">History</h3>
      ${hist.length ? `<div class="card history"><table>
        <thead><tr><th>Date</th><th>Contest</th><th>Result</th><th>Solved</th><th>Time used</th></tr></thead>
        <tbody>${hist.map(h => `<tr>
          <td>${prettyDate(h.date)}</td><td>${esc(h.name)}${h.blind ? " 🙈" : ""}</td>
          <td><span class="pill ${h.passed ? "pill-ok" : "pill-bad"}">${h.passed ? "Passed" : h.reason === "giveup" ? "Gave up" : h.reason === "timeout" ? "Timed out" : "Not passed"}</span></td>
          <td>${h.questions.filter(q => q.result === "solved").length}/${h.questions.length}</td>
          <td>${formatClock(h.usedSec)} / ${h.minutes}m</td></tr>`).join("")}</tbody></table></div>`
        : `<div class="card empty">No contests yet. Try a Speed Round, or design your own contest above.</div>`}`;
  },

  async render() {
    Contest.checkTimeout();
    const c = Contest.active;
    if (c) return this.activeView(c);
    const r = Store.state.lastContestResult;
    if (r) return this.resultView(r);
    return this.hubView();
  },

  cleanup() { clearInterval(this.interval); },

  afterRender() {
    const app = document.getElementById("app");
    clearInterval(this.interval);
    if (Contest.active) {
      this.interval = setInterval(() => {
        const left = Contest.secondsLeft();
        const el = document.querySelector("[data-clock]");
        if (el) {
          el.textContent = formatClock(left);
          el.closest(".countdown")?.classList.toggle("low", left < 600);
        }
        if (left <= 0) { Contest.finish("timeout"); renderRoute(); }
      }, 1000);
    }

    // Builder inputs (bina re-render, taaki typing smooth rahe)
    const b = this.builder;
    const refreshAvail = async () => {
      const el = document.getElementById("b-avail");
      if (!el) return;
      const n = (await Contest.customPool(b)).length;
      el.textContent = `${n} questions match`;
      app.querySelectorAll("[data-action=custom-start],[data-action=custom-save]").forEach(x => { x.disabled = !n; });
    };
    app.oninput = e => {
      if (e.target.id === "b-name") b.name = e.target.value;
      if (e.target.id === "b-count") b.count = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
      if (e.target.id === "b-min") b.minutes = Math.max(5, Math.min(360, parseInt(e.target.value) || 5));
    };
    app.onchange = async e => {
      if (e.target.id === "b-blind") b.blind = e.target.checked;
      if (e.target.id === "b-adv") { b.includeAdvanced = e.target.checked; await renderRoute(); return; }
      refreshAvail();
    };

    app.onclick = async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const card = btn.closest("[data-id]");
      const c = Contest.active;
      const tplEl = btn.closest("[data-tpl]");
      const tpls = (Store.state.contestTemplates ??= []);
      switch (btn.dataset.action) {
        case "chip": {
          const list = b[btn.dataset.group];
          const i = list.indexOf(btn.dataset.v);
          i === -1 ? list.push(btn.dataset.v) : list.splice(i, 1);
          btn.classList.toggle("on");
          refreshAvail();
          return;
        }
        case "bset": b[btn.dataset.k] = btn.dataset.v; break;
        case "bmin": b.minutes = Number(btn.dataset.v); break;
        case "custom-start":
          if (!confirm(`Start "${b.name || "Custom Contest"}"? ${b.count} questions, ${b.minutes} minutes. Other features will be paused until you submit.`)) return;
          await Contest.start("custom", "custom", { ...b, topics: [...b.topics], categories: [...b.categories] });
          return;
        case "custom-save": {
          const t = { ...b, topics: [...b.topics], categories: [...b.categories], id: b.editing || "t" + Date.now() };
          delete t.editing;
          const i = tpls.findIndex(x => x.id === t.id);
          i === -1 ? tpls.push(t) : (tpls[i] = t);
          b.editing = null;
          Store.save();
          showToast(`Saved "${t.name || "Custom Contest"}"`);
          break;
        }
        case "tpl-run": {
          const t = tpls.find(x => x.id === tplEl.dataset.tpl);
          if (!confirm(`Start "${t.name || "Custom Contest"}"? ${t.count} questions, ${t.minutes} minutes.`)) return;
          await Contest.start("custom", t.id, { ...t, templateId: t.id });
          return;
        }
        case "tpl-edit": {
          const t = tpls.find(x => x.id === tplEl.dataset.tpl);
          Object.assign(b, { ...t, topics: [...t.topics], categories: [...t.categories], editing: t.id });
          break;
        }
        case "tpl-del":
          if (!confirm("Delete this saved contest?")) return;
          Store.state.contestTemplates = tpls.filter(x => x.id !== tplEl.dataset.tpl);
          Store.save();
          break;
        case "open": QuestionPanel.open({ id: card.dataset.id, type: card.dataset.type }); return;
        case "solved":
        case "unsolved": {
          const v = btn.dataset.action;
          c.results[card.dataset.id] = c.results[card.dataset.id] === v ? undefined : v;
          if (!c.results[card.dataset.id]) delete c.results[card.dataset.id];
          Store.save();
          break;
        }
        case "submit": {
          const unmarked = c.questions.length - Object.keys(c.results).length;
          if (unmarked && !confirm(`${unmarked} question(s) are not marked and will count as not solved. Submit anyway?`)) return;
          Contest.finish("submit");
          break;
        }
        case "giveup":
          if (!confirm("Give up this contest? It will be recorded as not passed.")) return;
          Contest.finish("giveup");
          break;
        case "again": {
          Store.state.lastContestResult = null;
          Store.save();
          if (btn.dataset.kind === "custom") {
            const t = (Store.state.contestTemplates || []).find(x => x.id === btn.dataset.key);
            if (t) await Contest.start("custom", t.id, { ...t, templateId: t.id });
            else await Contest.start("custom", "custom", { ...this.builder });
            return;
          }
          await Contest.start(btn.dataset.kind, btn.dataset.key);
          return;
        }
        case "hub":
          Store.state.lastContestResult = null;
          Store.save();
          break;
        case "start":
          if (!confirm("Start this contest? Other features will be paused until you submit.")) return;
          await Contest.start(btn.dataset.kind, btn.dataset.key);
          return;
        default: return;
      }
      await renderRoute();
    };
  },
};
