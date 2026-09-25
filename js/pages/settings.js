const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const SettingsPage = {
  async render() {
    const s = Store.settings;

    const dayInputs = DAYS.map(([key, label]) => `
      <label class="day-input">
        <span>${label.slice(0, 3)}</span>
        <input type="number" name="hours-${key}" min="0" max="16" step="0.5" value="${s.hours[key]}">
        <small>hrs</small>
      </label>
    `).join("");

    const speedOptions = [1, 1.25, 1.5, 1.75, 2]
      .map(v => `<option value="${v}" ${v === s.playbackSpeed ? "selected" : ""}>${v}x</option>`)
      .join("");

    return `
      <h1 class="page-title">Settings</h1>
      <p class="page-sub">Your daily plan and finish date are calculated from these settings.</p>

      <form id="settings-form">
        <section class="card form-section">
          <h2 class="section-title">Weekly study hours</h2>
          <p class="hint">How many hours can you study each day? Use 0 for days off.</p>
          <div class="days-grid">${dayInputs}</div>
        </section>

        <section class="card form-section">
          <h2 class="section-title">Timeline</h2>
          <div class="row">
            <label class="field">
              <span>Start date</span>
              <input type="date" name="startDate" value="${s.startDate}">
            </label>
            <label class="field">
              <span>Target date (placement ready)</span>
              <input type="date" name="targetDate" value="${s.targetDate}">
            </label>
          </div>
        </section>

        <section class="card form-section">
          <h2 class="section-title">Study style</h2>
          <div class="row">
            <label class="field">
              <span>YouTube playback speed</span>
              <select name="playbackSpeed">${speedOptions}</select>
            </label>
            <label class="field">
              <span>Study multiplier</span>
              <input type="number" name="studyMultiplier" min="1" max="3" step="0.1" value="${s.studyMultiplier}">
              <small class="hint">1.5 means a 1-hour video takes 1.5 hours (pausing and coding along)</small>
            </label>
            <label class="field">
              <span>Warm-up questions per day</span>
              <input type="number" name="warmupCount" min="0" max="20" value="${s.warmupCount}">
              <small class="hint">About 5 min each. Plan only; Plan 2.0 has no warm-ups.</small>
            </label>
            <label class="field">
              <span>Lecture share: <b id="share-val">${s.lectureShare}%</b></span>
              <input type="range" name="lectureShare" min="0" max="100" step="5" value="${s.lectureShare}">
              <small class="hint">Share of the time left after warm-ups that goes to videos. The rest goes to Main Quest.</small>
            </label>
          </div>
        </section>

        <div id="summary" class="card summary"></div>

        <button type="submit" class="btn btn-primary">Save settings</button>
      </form>

      <section class="card form-section danger-zone">
        <h2 class="section-title">Backup</h2>
        <p class="hint">Your data is saved only in this browser. Download a backup once a week.</p>
        <div class="btn-row">
          <button id="export-btn" class="btn">Download backup</button>
          <label class="btn">
            Restore backup
            <input type="file" id="import-file" accept=".json" hidden>
          </label>
          <button id="reset-warmup-btn" class="btn">Restart warm-up rounds</button>
          <button id="reset-btn" class="btn btn-danger">Reset everything</button>
        </div>
      </section>

      <div id="toast" class="toast" role="status"></div>
    `;
  },

  // Form ki values padh ke ek settings object banao
  readForm() {
    const f = document.getElementById("settings-form");
    const hours = {};
    DAYS.forEach(([key]) => {
      hours[key] = Math.max(0, parseFloat(f[`hours-${key}`].value) || 0);
    });
    return {
      hours,
      startDate: f.startDate.value,
      targetDate: f.targetDate.value,
      playbackSpeed: parseFloat(f.playbackSpeed.value),
      studyMultiplier: parseFloat(f.studyMultiplier.value) || 1,
      warmupCount: parseInt(f.warmupCount.value) || 0,
      lectureShare: parseInt(f.lectureShare.value),
    };
  },

  // Live summary: jaise hi kuch badlo, numbers turant update
  updateSummary() {
    const s = this.readForm();
    const weekly = Object.values(s.hours).reduce((a, b) => a + b, 0);

    const start = new Date(s.startDate);
    const end = new Date(s.targetDate);
    const days = Math.round((end - start) / 86400000) + 1;
    const weeks = days / 7;

    const box = document.getElementById("summary");
    if (!s.startDate || !s.targetDate || days <= 0) {
      box.innerHTML = `<p class="error">The target date must be after the start date.</p>`;
      return;
    }

    document.getElementById("share-val").textContent = s.lectureShare + "%";

    box.innerHTML = `
      <div class="summary-item"><b>${weekly}</b><span>hours / week</span></div>
      <div class="summary-item"><b>${days}</b><span>days left</span></div>
      <div class="summary-item"><b>${Math.round(weekly * weeks)}</b><span>total hours available</span></div>
    `;
  },

  toast(msg) {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  },

  afterRender() {
    const form = document.getElementById("settings-form");
    this.updateSummary();

    form.addEventListener("input", () => this.updateSummary());

    form.addEventListener("submit", e => {
      e.preventDefault(); // page reload hone se roko
      Store.updateSettings(this.readForm());
      this.toast("Settings saved");
    });

    document.getElementById("export-btn").addEventListener("click", () => {
      Store.exportData();
      this.toast("Backup downloaded");
    });

    document.getElementById("import-file").addEventListener("change", async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        Store.importData(await file.text());
        await renderRoute(); // naye data ke saath page dobara banao
        this.toast("Backup restored");
      } catch (err) {
        this.toast("Restore failed: " + err.message);
      }
    });

    document.getElementById("reset-warmup-btn").addEventListener("click", () => {
      if (!confirm("Warm-ups will restart from Round 1 with a new shuffle. The Too easy list will also be cleared.")) return;
      Store.resetWarmup();
      this.toast("Warm-up restarted");
    });

    document.getElementById("reset-btn").addEventListener("click", async () => {
      if (!confirm("This will delete all your data. Are you sure?")) return;
      Store.reset();
      await renderRoute();
      this.toast("Everything reset");
    });
  },
};
