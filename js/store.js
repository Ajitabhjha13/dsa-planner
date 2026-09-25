// =========================================================
// STORE
// Saara user data browser ke localStorage mein save hota hai.
// Ek hi key ("dsaPlanner") ke andar poora object JSON ban ke jaata hai.
// Phase 2 mein yahi data Spring Boot backend pe shift hoga.
// =========================================================
const STORAGE_KEY = "dsaPlanner";

// Local date "YYYY-MM-DD" (toISOString UTC deta hai, jo India mein subah galat date de sakta hai)
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DEFAULT_STATE = {
  version: 1,
  settings: {
    // Har din kitne ghante (0 = chhutti)
    hours: { mon: 3, tue: 3, wed: 3, thu: 3, fri: 3, sat: 5, sun: 5 },
    startDate: todayStr(), // aaj ki date "YYYY-MM-DD"
    targetDate: "2026-12-31",
    playbackSpeed: 1.5,     // YouTube kis speed pe dekhoge
    studyMultiplier: 1.5,   // video pause karke code likhne ka extra time
    warmupCount: 10,        // roz kitne warm-up questions
    lectureShare: 45,       // warm-up ke baad bache time ka kitna % Lectures ko
  },
  // Warm-up shuffle bag
  warmup: { round: 0, mode: "full", order: [], done: {}, tooEasy: [], history: {} },
  // Har task ki progress: { "Q013": { status: "done", doneOn: "2026-09-26", timeSpent: 1800 } }
  progress: {},
  // Aaj ki fixed task list: { date: "2026-09-26", tasks: [{ id, type }] }
  today: null,
  // Roz ka hisaab: { "2026-09-26": { seconds: 5400, done: 6 } }
  log: {},
  // Chalta hua timer: { taskId, startedAt (ms) }
  timer: null,
  // Review ke liye mark kiye questions: { "Q013": true, "B04": true }
  review: {},
  // Har question ki apni notes:
  // { "Q013": { solution, hints: [], keyPoints, notes, help: "self" | "help", statement } }
  notes: {},
};

const Store = {
  state: null,

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      // Default ke upar saved data merge karo, taaki naye fields bhi mil jayein
      this.state = saved
        ? { ...DEFAULT_STATE, ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings }, progress: saved.progress || {}, warmup: { ...DEFAULT_STATE.warmup, ...saved.warmup }, log: saved.log || {}, review: saved.review || {}, notes: saved.notes || {} }
        : structuredClone(DEFAULT_STATE);
    } catch {
      this.state = structuredClone(DEFAULT_STATE);
    }
    return this.state;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
  },

  get settings() {
    if (!this.state) this.load();
    return this.state.settings;
  },

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.save();
  },

  // ---------- BACKUP ----------
  resetWarmup() {
    this.state.warmup = structuredClone(DEFAULT_STATE.warmup);
    this.save();
  },

  exportData() {
    const blob = new Blob([JSON.stringify(this.state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dsa-planner-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  importData(jsonText) {
    const data = JSON.parse(jsonText); // galat file hui toh yahin error aayega
    if (!data.settings) throw new Error("This does not look like a DSA Planner backup file");
    this.state = data;
    this.save();
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    this.load();
  },
};

Store.load();
