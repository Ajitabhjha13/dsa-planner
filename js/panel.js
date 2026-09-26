// =========================================================
// QUESTION PANEL (shared component)
// Warm-up aur Main Quest dono ke questions isi panel mein khulte hain.
// Tabs: Question | My Solution | Hints | Notes
// Usage: QuestionPanel.open({ id: "Q013", type: "main" })
// =========================================================

// User ka likha text HTML mein daalne se pehle "safe" banao
function esc(str = "") {
  return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const LEVEL_NAMES = { basic: "Basic", core: "Core", pro: "Pro" };

const QuestionPanel = {
  item: null,       // { id, type }
  data: null,       // problem / workbook entry
  statement: null,  // LeetCode statement (agar hai)
  tab: "question",
  editSolution: false,
  editHints: false,
  hintsShown: 0,
  solutionShown: false,
  lcHintsShown: false,
  saveTimer: null,

  notes() {
    return (Store.state.notes[this.item.id] ??= { solution: "", hints: [], keyPoints: "", notes: "", help: null, statement: "" });
  },

  async open(item, tab = "question") {
    this.item = item;
    this.tab = tab;
    this.editSolution = this.editHints = this.solutionShown = this.lcHintsShown = false;
    this.hintsShown = 0;

    if (item.type === "warmup") {
      this.data = (await Data.workbook()).find(w => w.id === item.id);
      this.statement = null;
    } else {
      this.data = (await Data.problems()).find(p => p.id === item.id);
      this.statement = (await Data.statements())[item.id] || null;
    }
    if (!this.data) return;

    this.ensureRoot();
    this.render();
    document.body.classList.add("panel-open");
  },

  close() {
    this.flushSave();
    document.getElementById("qpanel")?.remove();
    document.body.classList.remove("panel-open");
    renderRoute(); // list ka status (done / review) update karo
  },

  ensureRoot() {
    if (document.getElementById("qpanel")) return;
    const root = document.createElement("div");
    root.id = "qpanel";
    root.innerHTML = `<div class="qp-backdrop" data-qp="close"></div><aside class="qp" role="dialog" aria-modal="true" aria-label="Question"></aside>`;
    document.body.appendChild(root);
    root.addEventListener("click", e => this.onClick(e));
    root.addEventListener("input", e => this.onInput(e));
    document.addEventListener("keydown", this.onKey);
  },

  onKey(e) {
    if (e.key === "Escape" && document.getElementById("qpanel")) QuestionPanel.close();
  },

  // ---------------- RENDER ----------------
  render() {
    const t = this.item, d = this.data;
    const done = Tracker.isDone(t);
    const review = !!Store.state.review[t.id];
    const running = Tracker.timer?.taskId === t.id;
    const skipped = Store.state.progress[t.id]?.status === "skipped";
    const inContest = !!Contest.active;
    // No peeking: contest ke dauran sirf Question tab
    const tabs = inContest ? [["question", "Question"]]
      : [["question", "Question"], ["solution", "My Solution"], ["hints", "Hints"], ["notes", "Notes"]];
    if (inContest) this.tab = "question";

    document.querySelector("#qpanel .qp").innerHTML = `
      <header class="qp-head">
        <div class="qp-title-row">
          <h2 class="qp-title">${esc(d.title)}</h2>
          <button class="qp-close" data-qp="close" aria-label="Close">×</button>
        </div>
        <div class="qp-badges">${this.badges()}</div>
        <nav class="qp-tabs">
          ${tabs.map(([k, l]) => `<button class="qp-tab ${this.tab === k ? "active" : ""}" data-qp="tab" data-tab="${k}">${l}${this.tabDot(k)}</button>`).join("")}
        </nav>
      </header>
      <div class="qp-body">${this[`tab_${this.tab}`]()}</div>
      ${inContest ? `<footer class="qp-foot"><span class="muted small">🏆 Contest mode: solutions, hints and notes are hidden.</span>
        <button class="btn btn-sm btn-primary" data-qp="close">Back to contest</button></footer>` : `
      <footer class="qp-foot">
        <span class="qp-time" data-qp-elapsed>${this.timeText()}</span>
        <div class="qp-actions">
          ${t.type === "main" && !done ? `<button class="btn btn-sm" data-qp="skip" title="Move it out of the plan for now">${skipped ? "Unskip" : "Skip for now"}</button>` : ""}
          ${done ? "" : `<button class="btn btn-sm ${running ? "btn-primary" : ""}" data-qp="timer">${running ? "Pause" : "Start timer"}</button>`}
          <button class="btn btn-sm ${review ? "btn-review" : ""}" data-qp="review" title="Mark for the review round">🔁 ${review ? "In review" : "Review"}</button>
          <button class="btn btn-sm ${done ? "btn-done" : "btn-primary"}" data-qp="done">${done ? "✓ Done" : "Mark done"}</button>
        </div>
      </footer>`}
    `;

    if (window.hljs) document.querySelectorAll("#qpanel pre code.language-java").forEach(el => hljs.highlightElement(el));
  },

  tabDot(k) {
    const n = this.notes();
    const has = { solution: n.solution, hints: n.hints.some(h => h.trim()), notes: n.keyPoints || n.notes }[k];
    return has ? ` <span class="qp-dot" title="Saved"></span>` : "";
  },

  timeText() {
    const spent = Tracker.timeSpent(this.item.id);
    const est = this.item.type === "warmup" ? WARMUP_MINUTES : this.data.minutes;
    return `⏱ ${spent ? formatDuration(spent) : "0s"} <span class="muted">/ ~${est} min</span>`;
  },

  badges() {
    const d = this.data;
    if (Contest.active?.blind) return `<span class="tag">🙈 Blind mode</span>`;
    if (this.item.type === "warmup") {
      return `<span class="tag">Warm-up</span><span class="tag">${esc(d.category)}</span><span class="tag muted">${d.id}</span>`;
    }
    const src = `<span class="src src-${d.source}" title="${SOURCE_NAMES[d.source]}">${d.source}</span>`;
    const lvl = `<span class="lvl lvl-${d.level}">${LEVEL_NAMES[d.level]}</span>`;
    const hf = d.highFrequency ? `<span class="hf">HF</span>` : "";
    const lcd = this.statement ? `<span class="tag">LeetCode: ${this.statement.difficulty}</span>` : "";
    return `${src}${lvl}${hf}<span class="tag">${esc(d.topic)}</span>${lcd}`;
  },

  links() {
    const d = this.data;
    const q = encodeURIComponent(d.title);
    const out = [];
    if (this.item.type === "main") {
      out.push(d.leetcode?.slug
        ? `<a class="btn btn-sm" href="https://leetcode.com/problems/${d.leetcode.slug}/" target="_blank" rel="noopener">LeetCode ${d.leetcode.number} ↗</a>`
        : `<a class="btn btn-sm" href="https://www.google.com/search?q=${q}+site%3Aleetcode.com%2Fproblems" target="_blank" rel="noopener">Search on LeetCode ↗</a>`);
      out.push(`<a class="btn btn-sm" href="https://www.google.com/search?q=${q}+site%3Ageeksforgeeks.org" target="_blank" rel="noopener">Search on GFG ↗</a>`);
    }
    return out.length ? `<div class="qp-links">${out.join("")}</div>` : "";
  },

  // ---------------- TAB: QUESTION ----------------
  tab_question() {
    const d = this.data;

    if (this.item.type === "warmup") {
      const body = d.output
        ? `<p>Print the pattern shown below. Your program should work for any value of N.</p>
           <div class="qp-label">Expected output</div><pre class="qp-pre">${esc(d.output)}</pre>
           <div class="qp-callout">Challenge: also run it for N = 1, 2 and 9. Then take the character (*, #, $) as input too.</div>`
        : `<p class="qp-statement">${esc(d.title)}</p>
           ${d.example ? `<div class="qp-label">Example (Input → Output)</div><pre class="qp-pre">${esc(d.example)}</pre>` : ""}
           <div class="qp-callout">Test the edge cases: 0, 1, negative numbers, very large numbers and repeated values.</div>`;
      return body + this.links();
    }

    const st = this.statement;
    const n = this.notes();
    let html = "";
    if (d.altTitles?.length) html += `<p class="muted small">On the Love Babbar sheet: ${d.altTitles.map(esc).join(", ")}</p>`;

    if (st) {
      html += st.description.map(p => `<p class="qp-statement">${esc(p)}</p>`).join("");
      html += st.examples.map((e, i) => `<div class="qp-label">Example ${i + 1}</div><pre class="qp-pre">${esc(e)}</pre>`).join("");
      if (st.constraints.length) html += `<div class="qp-label">Constraints</div><ul class="qp-list">${st.constraints.map(c => `<li><code>${esc(c)}</code></li>`).join("")}</ul>`;
      if (st.followUps.length) html += `<div class="qp-callout">Follow up: ${st.followUps.map(esc).join(" ")}</div>`;
      if (st.hints.length && !Contest.active) {
        html += this.lcHintsShown
          ? `<div class="qp-label">LeetCode hints</div><ol class="qp-list">${st.hints.map(h => `<li>${esc(h)}</li>`).join("")}</ol>`
          : `<button class="linkbtn" data-qp="lchints">Show ${st.hints.length} official LeetCode hint${st.hints.length > 1 ? "s" : ""}</button>`;
      }
      html += `<p class="muted small qp-src">Statement source: LeetCode (${esc(st.lcTitle)})</p>`;
    } else {
      html += `<div class="qp-callout">The statement for this problem is not available. Open it using the links below and paste it here if you like. It will be saved.</div>
        <textarea class="qp-textarea" data-field="statement" rows="6" placeholder="Paste the problem statement here...">${esc(n.statement)}</textarea>`;
    }

    if (d.advice && !Contest.active) html += `<details class="tip"><summary>📌 Roadmap tip</summary><p>${esc(d.advice)}</p></details>`;
    return html + this.links();
  },

  // ---------------- TAB: SOLUTION ----------------
  tab_solution() {
    const n = this.notes();
    if (!n.solution) this.editSolution = true;
    if (this.editSolution) {
      return `
        <p class="muted small">Paste your Java solution here. It saves automatically.</p>
        <textarea class="qp-textarea qp-code" data-field="solution" rows="16" spellcheck="false" placeholder="class Solution {\n    ...\n}">${esc(n.solution)}</textarea>
        <button class="btn btn-sm btn-primary" data-qp="solution-done">Save solution</button>`;
    }
    if (!this.solutionShown) {
      return `<div class="qp-spoiler">
          <p>The solution is hidden so you can try it yourself first when revising.</p>
          <button class="btn btn-primary" data-qp="solution-show">Show solution</button>
        </div>`;
    }
    return `
      <div class="qp-code-head">
        <button class="btn btn-sm" data-qp="copy">Copy</button>
        <button class="btn btn-sm" data-qp="solution-edit">Edit</button>
        <button class="btn btn-sm" data-qp="solution-hide">Hide</button>
      </div>
      <pre class="qp-pre qp-codeview"><code class="language-java">${esc(n.solution)}</code></pre>`;
  },

  // ---------------- TAB: HINTS ----------------
  tab_hints() {
    const n = this.notes();
    const hints = n.hints.filter(h => h.trim());

    if (!hints.length) this.editHints = true; // khaali hai toh seedha edit mode
    if (this.editHints) {
      const list = (n.hints.length ? n.hints : [""]).map((h, i) => `
        <div class="qp-hint-edit">
          <label class="qp-label">Hint ${i + 1}</label>
          <textarea class="qp-textarea" data-field="hint" data-index="${i}" rows="2" placeholder="A small nudge, not the full solution...">${esc(h)}</textarea>
        </div>`).join("");
      return `
        <p class="muted small">Write hints for yourself, from the gentlest to the strongest. They open one at a time when you revise.</p>
        ${list}
        <div class="btn-row">
          <button class="btn btn-sm" data-qp="hint-add">+ Add hint</button>
          <button class="btn btn-sm btn-primary" data-qp="hints-done">Save hints</button>
        </div>`;
    }

    const shown = hints.slice(0, this.hintsShown)
      .map((h, i) => `<div class="qp-hint"><b>Hint ${i + 1}</b><p>${esc(h)}</p></div>`).join("");
    return `
      ${shown}
      ${this.hintsShown < hints.length
        ? `<button class="btn btn-primary" data-qp="hint-next">Show hint ${this.hintsShown + 1}</button>`
        : `<p class="muted small">All hints shown.</p>`}
      <p><button class="linkbtn" data-qp="hints-edit">Edit hints</button></p>`;
  },

  // ---------------- TAB: NOTES ----------------
  tab_notes() {
    const n = this.notes();
    return `
      <label class="qp-label">Key points (the approach in 1-2 lines)</label>
      <textarea class="qp-textarea" data-field="keyPoints" rows="3" placeholder="e.g. Kadane: keep a running sum, reset to 0 when it goes negative">${esc(n.keyPoints)}</textarea>
      <p class="muted small">This is what Revision Mode shows, so keep it short and clear.</p>

      <label class="qp-label">How did you solve it?</label>
      <div class="qp-toggle">
        <button class="btn btn-sm ${n.help === "self" ? "btn-done" : ""}" data-qp="help" data-value="self">💪 On my own</button>
        <button class="btn btn-sm ${n.help === "help" ? "btn-review" : ""}" data-qp="help" data-value="help">🤝 With help</button>
      </div>

      <label class="qp-label">Notes</label>
      <textarea class="qp-textarea" data-field="notes" rows="8" placeholder="Mistakes, edge cases, time complexity, anything...">${esc(n.notes)}</textarea>`;
  },

  // ---------------- EVENTS ----------------
  async onClick(e) {
    const el = e.target.closest("[data-qp]");
    if (!el) return;
    const n = this.notes();

    switch (el.dataset.qp) {
      case "close": return this.close();
      case "tab": this.flushSave(); this.tab = el.dataset.tab; break;
      case "done": Tracker.toggleDone(this.item); break;
      case "review":
        if (Store.state.review[this.item.id]) delete Store.state.review[this.item.id];
        else Store.state.review[this.item.id] = true;
        Store.save();
        break;
      case "timer":
        Tracker.timer?.taskId === this.item.id ? Tracker.stopTimer() : Tracker.startTimer(this.item.id);
        break;
      case "skip": {
        const pr = (Store.state.progress[this.item.id] ??= { timeSpent: 0 });
        pr.status = pr.status === "skipped" ? "pending" : "skipped";
        Store.save();
        break;
      }
      case "lchints": this.lcHintsShown = true; break;
      case "solution-show": this.solutionShown = true; break;
      case "solution-hide": this.solutionShown = false; break;
      case "solution-edit": this.editSolution = true; break;
      case "solution-done":
        this.flushSave();
        this.editSolution = false;
        this.solutionShown = !!n.solution.trim();
        break;
      case "copy":
        try { await navigator.clipboard.writeText(n.solution); el.textContent = "Copied ✓"; } catch { el.textContent = "Copy failed"; }
        return;
      case "hint-add": this.flushSave(); n.hints.push(""); Store.save(); break;
      case "hint-next": this.hintsShown++; break;
      case "hints-edit": this.editHints = true; break;
      case "hints-done":
        n.hints = n.hints.filter(h => h.trim());
        this.flushSave();
        this.editHints = false;
        this.hintsShown = 0;
        break;
      case "help":
        n.help = n.help === el.dataset.value ? null : el.dataset.value;
        // "Help li" = kamzor, isliye apne aap review mein daal do
        if (n.help === "help") Store.state.review[this.item.id] = true;
        Store.save();
        break;
      default: return;
    }
    this.render();
  },

  // Typing ke waqt har letter pe save nahi, 400ms rukne ke baad (debounce)
  onInput(e) {
    const f = e.target.dataset.field;
    if (!f) return;
    const n = this.notes();
    if (f === "hint") n.hints[+e.target.dataset.index] = e.target.value;
    else n[f] = e.target.value;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => Store.save(), 400);
  },

  flushSave() {
    clearTimeout(this.saveTimer);
    Store.save();
  },
};

// Panel khula ho toh timer har second update karo
setInterval(() => {
  const el = document.querySelector("[data-qp-elapsed]");
  if (el && QuestionPanel.item) el.innerHTML = QuestionPanel.timeText();
}, 1000);
