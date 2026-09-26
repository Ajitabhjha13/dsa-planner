// =========================================================
// LECTURES: playlist import + sprints + lecture list
//
// SPRINTS ("fixed packets"): lectures order mein ek sprint mein bharte jao
// jab tak sprint ka video-time (sprintSize) poora na ho, phir agla sprint.
// Packing sirf order + duration pe depend karti hai, isliye:
//   - miss karne se sprints nahi badalte
//   - naye lectures sirf aakhri sprint / naye sprint mein judte hain
// Sprint k ki dates: sprintStart + (k-1) hafte.
// =========================================================
const VideosPage = {
  filter: "all",
  busy: false,
  message: "",
  openSprints: null,

  fmtLen(secs) {
    const h = Math.floor(secs / 3600), m = Math.round((secs % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  },

  fmtClock(secs) {
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(s).padStart(2, "0")}`;
  },

  // "23:40" ya "1:05:20" -> seconds
  parseClock(str) {
    const parts = String(str).trim().split(":").map(Number);
    if (!parts.length || parts.some(n => isNaN(n) || n < 0)) return null;
    return parts.reduce((a, n) => a * 60 + n, 0);
  },

  status(id) { return Store.state.progress[id]?.status || "pending"; },

  // Ek hafte mein lectures ko kitna time milta hai (settings se), video-minutes mein
  defaultSprintSize() {
    const s = Store.settings;
    let studyMin = 0;
    Object.values(s.hours).forEach(h => {
      if (h > 0) studyMin += Math.max(0, h * 60 - s.warmupCount * WARMUP_MINUTES) * s.lectureShare / 100;
    });
    const videoMin = studyMin * s.playbackSpeed / s.studyMultiplier;
    return Math.max(60, Math.round(videoMin / 30) * 30);
  },

  ensureSprintSettings() {
    const v = Store.state.videos;
    let changed = false;
    if (!v.sprintSize) { v.sprintSize = this.defaultSprintSize(); changed = true; }
    if (!v.sprintStart) {
      const today = todayStr();
      v.sprintStart = Store.settings.startDate > today ? Store.settings.startDate : today;
      changed = true;
    }
    if (changed) Store.save();
  },

  buildSprints(items) {
    const v = Store.state.videos;
    const size = v.sprintSize * 60;
    const sprints = [];
    let cur = null;
    items.filter(x => x.tier === "core").forEach(x => {
      if (!cur || (cur.secs + x.durationSec > size && cur.items.length)) {
        cur = { number: sprints.length + 1, items: [], secs: 0 };
        sprints.push(cur);
      }
      cur.items.push(x);
      cur.secs += x.durationSec;
    });
    const start = parseDate(v.sprintStart);
    sprints.forEach(sp => {
      sp.start = formatDate(addDays(start, (sp.number - 1) * 7));
      sp.end = formatDate(addDays(start, (sp.number - 1) * 7 + 6));
      sp.done = sp.items.filter(x => this.status(x.id) !== "pending").length;
      sp.complete = sp.done === sp.items.length;
    });
    return sprints;
  },

  importForm(hasVideos) {
    const key = YouTube.getKey();
    const pl = Store.state.videos?.playlistId ? `https://www.youtube.com/playlist?list=${Store.state.videos.playlistId}` : DEFAULT_PLAYLIST;
    return `
      <details class="card import-card" ${hasVideos ? "" : "open"}>
        <summary><b>${hasVideos ? "Re-import or change playlist" : "Import your playlist"}</b>
          <span class="muted small">${key ? "API key saved in this browser" : "API key needed"}</span></summary>
        <div class="import-body">
          <label class="field"><span>Playlist link</span>
            <input id="yt-playlist" value="${esc(pl)}" placeholder="https://www.youtube.com/playlist?list=PL..."></label>
          <label class="field"><span>YouTube API key</span>
            <input id="yt-key" type="password" value="${esc(key)}" placeholder="AIza..." autocomplete="off"></label>
          <p class="muted small">The key is stored only in this browser. It is never added to your code, GitHub or backup files.</p>
          <div class="btn-row">
            <button class="btn btn-primary" data-action="import" ${this.busy ? "disabled" : ""}>${this.busy ? "Importing..." : "Import playlist"}</button>
            ${key ? `<button class="btn" data-action="forget-key">Forget key</button>` : ""}
          </div>
          <p class="import-msg" id="yt-msg">${this.message}</p>
        </div>
      </details>`;
  },

  row(x, ctx) {
    const status = this.status(x.id);
    const isNext = ctx.next?.id === x.id;
    const review = !!Store.state.review[x.id];
    const resume = Store.state.progress[x.id]?.resumeAt || 0;
    return `
      <li class="vrow ${status === "done" ? "is-done" : ""} ${status === "skipped" ? "is-skipped" : ""} ${isNext ? "is-next" : ""}"
          data-id="${x.id}" data-status="${status}${review ? " review" : ""}" data-tier="${x.tier}">
        <button class="check" data-action="done" aria-label="${status === "done" ? "Undo" : "Mark watched"}">✓</button>
        <span class="vnum">${x.position}</span>
        <a class="vtitle" href="${YouTube.watchUrl(x.videoId, status === "done" ? 0 : resume)}" target="_blank" rel="noopener">${esc(x.title)}</a>
        <span class="vmeta">
          ${isNext ? `<span class="pill pill-next">Up next</span>` : ctx.todayIds.has(x.id) && status === "pending" ? `<span class="pill pill-today">Today</span>` : ""}
          ${status === "skipped" ? `<span class="pill">Skipped</span>` : ""}
          ${resume && status !== "done" ? `<a class="pill pill-resume" href="${YouTube.watchUrl(x.videoId, resume)}" target="_blank" rel="noopener" title="Resume from here">⏵ ${this.fmtClock(resume)}</a>` : ""}
          <span class="muted small">${this.fmtLen(x.durationSec)}</span>
          <button class="rv ${review ? "on" : ""}" data-action="review" title="${review ? "Remove from rewatch" : "Mark to rewatch"}">🔁</button>
          <details class="vmenu">
            <summary title="More">⋯</summary>
            <div class="vmenu-list">
              <button data-action="resume">${resume ? `Update saved position (${this.fmtClock(resume)})` : "Save position (resume later)"}</button>
              ${resume ? `<button data-action="resume-clear">Clear saved position</button>` : ""}
              <button data-action="skip">${status === "skipped" ? "Unskip" : "Skip (already know it)"}</button>
              <button data-action="tier">${x.tier === "core" ? "Move to Plan 2.0" : "Move back to Plan"}</button>
              <button data-action="tier-from">${x.tier === "core" ? "Move this and all after to Plan 2.0" : "Move this and all after back to Plan"}</button>
            </div>
          </details>
        </span>
      </li>`;
  },

  async render() {
    await DashboardPage.ensureToday();
    const v = Store.state.videos;
    const items = v?.items || [];
    const s = Store.settings;

    if (!items.length) {
      return `
        <h1 class="page-title">Lectures</h1>
        <p class="page-sub">Import the lecture playlist once. Lectures are then split into sprints and added to your daily plan.</p>
        ${this.importForm(false)}`;
    }

    this.ensureSprintSettings();
    const core = items.filter(x => x.tier === "core");
    const adv = items.filter(x => x.tier === "advanced");
    const watched = core.filter(x => this.status(x.id) === "done").length;
    const skipped = core.filter(x => this.status(x.id) === "skipped").length;
    const pendingItems = core.filter(x => this.status(x.id) === "pending");
    const rewatch = items.filter(x => Store.state.review[x.id]).length;
    const pct = core.length ? Math.round(((watched + skipped) / core.length) * 100) : 0;
    const next = pendingItems[0];

    const todayIds = new Set(Store.state.today?.date === todayStr() ? Store.state.today.tasks.filter(t => t.type === "lecture").map(t => t.id) : []);
    const todayDone = [...todayIds].filter(id => this.status(id) === "done").length;

    const plan = await Scheduler.buildPlan("core");
    const leftSecs = pendingItems.reduce((a, x) => a + x.durationSec, 0);
    const finish = plan.lectureEnd;
    const diff = finish ? daysBetween(parseDate(finish), parseDate(s.targetDate)) : null;

    const sprints = this.buildSprints(items);
    const current = sprints.find(sp => !sp.complete);
    const completed = sprints.filter(sp => sp.complete).length;
    if (!this.openSprints) this.openSprints = new Set(current ? [current.number] : []);
    const overdue = current && daysBetween(parseDate(current.end), parseDate(todayStr())) > 0;
    const daysLeft = current ? daysBetween(parseDate(todayStr()), parseDate(current.end)) : 0;
    const nextResume = next ? Store.state.progress[next.id]?.resumeAt || 0 : 0;

    const ctx = { next, todayIds };
    const sprintBoxes = sprints.map(sp => {
      const pctS = Math.round((sp.done / sp.items.length) * 100);
      const allSkipped = sp.items.every(x => this.status(x.id) === "skipped");
      const late = !sp.complete && daysBetween(parseDate(sp.end), parseDate(todayStr())) > 0;
      return `
        <details class="qtopic vsprint" data-sprint="${sp.number}" ${this.openSprints.has(sp.number) ? "open" : ""}>
          <summary>
            <span class="chev-sm">›</span>
            <span class="qtopic-name">Sprint ${sp.number}</span>
            <span class="eta ${sp.complete ? "done" : late ? "late" : ""}">${prettyDate(sp.start)} – ${prettyDate(sp.end)}${sp.complete ? " · ✓ Completed" : late ? " · Overdue" : ""}</span>
            <span class="muted small vsp-len">${this.fmtLen(sp.secs)}</span>
            <span class="qbar"><span style="width:${pctS}%"></span></span>
            <span class="qcount">${sp.done}/${sp.items.length}</span>
          </summary>
          <div class="qtopic-body">
            <div class="vsp-actions"><button class="linkbtn" data-action="skip-sprint" data-sprint="${sp.number}">${allSkipped ? "Unskip whole sprint" : "Skip whole sprint"}</button></div>
            <ul class="vlist">${sp.items.map(x => this.row(x, ctx)).join("")}</ul>
          </div>
        </details>`;
    }).join("");

    const advBox = adv.length ? `
      <details class="qtopic vsprint" data-sprint="adv" ${this.openSprints.has("adv") ? "open" : ""}>
        <summary><span class="chev-sm">›</span><span class="qtopic-name">Plan 2.0 lectures</span>
          <span class="qcount">${adv.filter(x => this.status(x.id) === "done").length}/${adv.length}</span></summary>
        <div class="qtopic-body"><ul class="vlist">${adv.map(x => this.row(x, ctx)).join("")}</ul></div>
      </details>` : "";

    const tab = (k, l) => `<button class="seg ${this.filter === k ? "on" : ""}" data-action="filter" data-f="${k}">${l}</button>`;

    return `
      <div class="dash-head">
        <div>
          <h1 class="page-title">Lectures</h1>
          <p class="page-sub">${esc(v.title || "Lecture playlist")} · ${items.length} lectures · ${sprints.length} sprints</p>
        </div>
        <div class="check-now">
          <span class="muted small">Last checked ${this.ago(v.lastChecked || v.importedAt)}</span>
          <button class="btn btn-sm" data-action="check-now">↻ Check now</button>
        </div>
      </div>
      ${v.notice ? `<div class="card notice">🎉 <b>${v.notice.added} new lecture${v.notice.added === 1 ? "" : "s"}</b> added to the playlist${v.notice.removed ? ` (${v.notice.removed} removed)` : ""}. They were added to the last sprint and join your plan from tomorrow.
        <button class="linkbtn" data-action="dismiss">Dismiss</button></div>` : ""}

      <div class="qhead">
        <div class="card ring-card">
          ${ringHtml(pct)}
          <div class="grow">
            <div class="muted small">LECTURES IN PLAN</div>
            <div class="big"><b>${watched}</b> / ${core.length} watched</div>
            <div class="stat-lines">
              <div><span>Remaining</span><b>${pendingItems.length}</b></div>
              <div><span>Skipped</span><b>${skipped}</b></div>
              <div><span>🔁 To rewatch</span><b>${rewatch}</b></div>
              <div><span>Today</span><b>${todayDone} / ${todayIds.size}</b></div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">TIME LEFT</div>
          <div class="big"><b>${this.fmtLen(leftSecs)}</b> of video</div>
          <div class="stat-lines">
            <div><span>At your speed (${s.playbackSpeed}x)</span><b>~${this.fmtLen(Math.round(leftSecs / s.playbackSpeed))}</b></div>
            <div><span>Finish</span><b>${finish ? prettyDate(finish) : "-"}</b></div>
            <div><span>Target</span><b>${prettyDate(s.targetDate)}</b></div>
            <div><span>Result</span><b class="${diff === null ? "" : diff >= 0 ? "ok" : "late"}">${diff === null ? "-" : diff >= 0 ? `${diff} days early` : `${-diff} days late`}</b></div>
          </div>
        </div>
        <div class="card">
          <div class="muted small">SPRINT</div>
          ${current ? `
            <div class="big"><b>Sprint ${current.number}</b> of ${sprints.length}</div>
            <div class="stat-lines">
              <div><span>Sprints completed</span><b>${completed} / ${sprints.length}</b></div>
              <div><span>This sprint</span><b>${current.done} / ${current.items.length}</b></div>
              <div><span>Due</span><b class="${overdue ? "late" : ""}">${prettyDate(current.end)} · ${overdue ? `${-daysLeft} days overdue` : daysLeft === 0 ? "today" : `${daysLeft} days left`}</b></div>
            </div>
            <div class="bar" style="margin:10px 0 12px"><div style="width:${Math.round((current.done / current.items.length) * 100)}%"></div></div>
            ${next ? `<a class="btn btn-primary" href="${YouTube.watchUrl(next.videoId, nextResume)}" target="_blank" rel="noopener" title="${esc(next.title)}">
              ${nextResume ? `▶ Resume at ${this.fmtClock(nextResume)}` : "▶ Watch next"}</a>` : ""}`
          : `<div class="big ok">🎉 All sprints completed!</div>`}
        </div>
      </div>

      <div class="qtoolbar">
        <div class="segs">${tab("all", "All")}${tab("pending", "Pending")}${tab("done", "Watched")}${tab("skipped", "Skipped")}${tab("review", "🔁 Rewatch")}</div>
        <span class="qtoolbar-right">
          <span class="muted small">Sprint size</span>
          <input id="sprint-size" type="number" min="1" max="40" step="0.5" value="${v.sprintSize / 60}" title="Hours of video per sprint">
          <span class="muted small">h of video</span>
          <button class="btn btn-sm" data-action="sprint-size">Apply</button>
        </span>
      </div>

      <div class="qtree">${sprintBoxes}${advBox}</div>

      ${this.importForm(true)}`;
  },

  ago(iso) {
    if (!iso) return "never";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  },

  applyFilter() {
    const f = this.filter;
    document.querySelectorAll(".vrow").forEach(li => {
      li.hidden = !(f === "all" || li.dataset.status.split(" ").includes(f));
    });
    document.querySelectorAll(".vsprint").forEach(d => {
      const any = d.querySelector(".vrow:not([hidden])");
      d.hidden = !any;
      if (f !== "all" && any) d.open = true;
    });
  },

  afterRender() {
    const app = document.getElementById("app");
    this.applyFilter();

    app.querySelectorAll("details.vsprint").forEach(d => d.addEventListener("toggle", () => {
      const k = d.dataset.sprint === "adv" ? "adv" : Number(d.dataset.sprint);
      d.open ? this.openSprints.add(k) : this.openSprints.delete(k);
    }));

    // Background auto-check (har 7 din). Page pehle dikh jaata hai, check baad mein.
    if (YouTube.isCheckDue()) {
      YouTube.checkForNew()
        .then(() => { if (location.hash === "#/lectures") renderRoute(); })
        .catch(() => { /* chupchaap skip */ });
    }

    app.onclick = async e => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;
      const row = btn.closest("[data-id]");
      const id = row?.dataset.id;
      const v = Store.state.videos;
      const pr = () => (Store.state.progress[id] ??= { status: "pending", timeSpent: 0 });

      switch (btn.dataset.action) {
        case "filter":
          this.filter = btn.dataset.f;
          app.querySelectorAll(".seg").forEach(b => b.classList.toggle("on", b === btn));
          this.applyFilter();
          return;
        case "done":
          Tracker.toggleDone({ id, type: "lecture" });
          if (this.status(id) === "done") delete pr().resumeAt;
          Store.save();
          break;
        case "review":
          if (Store.state.review[id]) delete Store.state.review[id];
          else Store.state.review[id] = true;
          Store.save();
          break;
        case "resume": {
          const cur = Store.state.progress[id]?.resumeAt;
          const val = prompt("Where did you stop? Enter the time from the video (e.g. 23:40 or 1:05:20)", cur ? this.fmtClock(cur) : "");
          if (val === null) return;
          const secs = this.parseClock(val);
          if (secs === null) { showToast("That time format did not work. Try something like 23:40."); return; }
          pr().resumeAt = secs;
          Store.save();
          showToast(`Saved. Resume at ${this.fmtClock(secs)}.`);
          break;
        }
        case "resume-clear": delete pr().resumeAt; Store.save(); break;
        case "skip":
          pr().status = this.status(id) === "skipped" ? "pending" : "skipped";
          Store.save();
          break;
        case "skip-sprint": {
          const sp = this.buildSprints(v.items).find(x => x.number === Number(btn.dataset.sprint));
          const allSkipped = sp.items.every(x => this.status(x.id) === "skipped");
          sp.items.forEach(x => {
            if (this.status(x.id) === "done") return;
            (Store.state.progress[x.id] ??= { timeSpent: 0 }).status = allSkipped ? "pending" : "skipped";
          });
          Store.save();
          break;
        }
        case "tier": {
          const it = v.items.find(x => x.id === id);
          it.tier = it.tier === "core" ? "advanced" : "core";
          Store.save();
          break;
        }
        case "tier-from": {
          const idx = v.items.findIndex(x => x.id === id);
          const to = v.items[idx].tier === "core" ? "advanced" : "core";
          v.items.slice(idx).forEach(x => { x.tier = to; });
          Store.save();
          break;
        }
        case "sprint-size": {
          const h = parseFloat(document.getElementById("sprint-size").value);
          if (!(h > 0)) return;
          if (!confirm(`Re-split all lectures into sprints of ${h}h of video? Sprint numbers will change.`)) return;
          v.sprintSize = Math.round(h * 60);
          this.openSprints = null;
          Store.save();
          break;
        }
        case "check-now": {
          if (!YouTube.getKey()) { showToast("Add your API key in the import box at the bottom first."); return; }
          btn.disabled = true;
          btn.textContent = "Checking...";
          try {
            const res = await YouTube.checkForNew();
            if (!res.added && !res.removed) showToast("✅ No new lectures. You are up to date.");
          } catch (err) {
            showToast(`❌ ${err.message}`);
          }
          break;
        }
        case "dismiss":
          v.notice = null;
          Store.save();
          break;
        case "forget-key":
          YouTube.setKey("");
          showToast("Key removed from this browser.");
          break;
        case "import": {
          const pid = YouTube.playlistIdFrom(document.getElementById("yt-playlist").value);
          const key = document.getElementById("yt-key").value.trim();
          const msg = document.getElementById("yt-msg");
          if (!pid) { msg.textContent = "That link has no playlist ID (list=...)."; return; }
          if (!key) { msg.textContent = "Please paste your API key."; return; }
          YouTube.setKey(key);
          this.busy = true;
          btn.disabled = true;
          btn.textContent = "Importing...";
          try {
            const res = await YouTube.importPlaylist(pid, t => { msg.textContent = t; });
            this.message = res.first
              ? `✅ Imported ${res.videos.items.length} lectures.`
              : `✅ Up to date. ${res.added} new, ${res.removed} removed.`;
            if (res.first) { Store.state.today = null; Store.save(); }
          } catch (err) {
            this.message = `❌ ${esc(err.message)}`;
          }
          this.busy = false;
          break;
        }
        default: return;
      }
      const y = window.scrollY;
      await renderRoute();
      window.scrollTo(0, y);
    };
  },
};
