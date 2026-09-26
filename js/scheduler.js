// =========================================================
// SCHEDULER: project ka "dimaag"
//
// Do plans banata hai:
//   "core"     -> Plan     : 6-8 LPA wala moderate DSA (Warm-up + Main Quest + Lectures)
//   "advanced" -> Plan 2.0 : baaki advanced topics (sirf Main Quest + Lectures),
//                            Plan khatam hone ke agle din se shuru
//
// Core plan har din ko 3 sections mein baant-ta hai:
//   1. Warm-up    : roz fixed count (shuffle bag se)
//   2. Main Quest : problems.json (Striver + Babbar + Roadmap)
//   3. Lectures   : playlist videos
//
// Har din:
//   capacity   = us din ke hours x 60
//   warm-up    = warmupCount x 5 min (pehle yeh)
//   baaki time = Lectures (lectureShare %) + Main Quest (baaki %)
//   Agar ek section khatam, toh uska time doosre ko mil jaata hai.
// Har section apne budget mein GREEDY tareeke se bharta hai.
//
// Plan hamesha AAJ se dobara banta hai, toh miss hua din
// apne aap aage shift ho jaata hai.
// =========================================================
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // getDay(): 0 = Sunday
const WARMUP_MINUTES = 5;

// ---------- Date helpers ----------
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d); // local time, UTC nahi
}
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}
function prettyDate(str) {
  return parseDate(str).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const Scheduler = {
  isDone(id) {
    const st = Store.state.progress[id]?.status;
    return st === "done" || st === "skipped";
  },

  // problems.json pehle se sahi order mein hai (topic order + basic pehle),
  // aur har problem ka tier (core / advanced) aur time estimate (minutes) usi mein hai.
  // SMART ESTIMATES: 15+ timed problems ke baad dekho ki tum estimate se
  // tez ho ya dheere (median ratio), aur saare estimates usi hisaab se badlo.
  speedFactor() {
    const ratios = [];
    const problems = Data.cache.problems || [];
    problems.forEach(p => {
      const pr = Store.state.progress[p.id];
      if (pr?.status === "done" && pr.timeSpent >= 60) ratios.push(pr.timeSpent / 60 / p.minutes);
    });
    if (ratios.length < 15) return { factor: 1, samples: ratios.length };
    ratios.sort((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    return { factor: Math.min(2, Math.max(0.5, median)), samples: ratios.length };
  },

  async mainQuestTasks(mode) {
    const problems = await Data.problems();
    const { factor } = this.speedFactor();
    return problems
      .filter(p => p.tier === mode)
      .map(p => ({
        id: p.id, type: "main", title: p.title, topic: p.topic,
        minutes: Math.max(5, Math.round((p.minutes * factor) / 5) * 5), highFrequency: p.highFrequency, source: p.source,
        leetcode: p.leetcode, level: p.level, advice: p.advice,
      }));
  },

  async lectureTasks(mode) {
    const s = Store.settings;
    return (await Data.videos())
      .filter(v => (v.tier || "core") === mode)
      .map(v => ({
        id: v.id, type: "lecture", title: v.title, videoId: v.videoId, position: v.position,
        // Video length / speed x multiplier = asli padhai ka time
        minutes: Math.round((v.durationSec / 60 / s.playbackSpeed) * s.studyMultiplier),
      }));
  },

  // Roz ka average time har section ko (pehle 14 study days ke plan se), minutes mein
  dailySplit(plan) {
    const days = (plan.days || []).filter(d => d.capacity > 0).slice(0, 14);
    const avg = key => days.length ? Math.round(days.reduce((a, d) => a + d[key].reduce((x, t) => x + t.minutes, 0), 0) / days.length) : 0;
    return { warmup: avg("warmup"), main: avg("main"), lectures: avg("lectures") };
  },

  // Ek section ko uske budget mein greedy bharo
  fill(queue, budget, day) {
    let used = 0, count = 0;
    while (queue.length && budget > 0) {
      const task = queue[0];
      const left = budget - used;
      // Fit ho, ya aadha fit ho (thoda overtime chalega), ya abhi tak ek bhi nahi liya
      if (task.minutes <= left || left >= task.minutes / 2 || count === 0) {
        day.push(queue.shift());
        used += task.minutes;
        count++;
      } else break;
    }
    return used;
  },

  // overrides: "what if" ke liye, jaise { lectureShare: 0 } (kuch save nahi hota)
  async buildPlan(mode = "core", overrides = null) {
    const s = overrides ? { ...Store.settings, ...overrides } : Store.settings;
    const weeklyHours = Object.values(s.hours).reduce((a, b) => a + b, 0);
    if (weeklyHours === 0) return { error: "Add study hours for at least one day in Settings." };

    const withWarmup = mode === "core";
    const allMain = await this.mainQuestTasks(mode);
    const allLectures = await this.lectureTasks(mode);
    let mainQ = allMain.filter(t => !this.isDone(t.id));
    let lectureQ = allLectures.filter(t => !this.isDone(t.id));

    // Warm-up queue (sirf core plan): is round ke bache hue, phir aage ke rounds ka projection
    const workbook = await Data.workbook();
    const wbById = Object.fromEntries(workbook.map(w => [w.id, w]));
    const remainingIds = await Warmup.remaining();
    const w = Store.state.warmup;
    const nextRoundIds = workbook.map(x => x.id).filter(id => !w.tooEasy.includes(id)); // agle rounds ka andaza
    let warmQ = [...remainingIds];

    // Start date: core -> aaj (ya start date), advanced -> core khatam hone ke agle din
    const startDate = parseDate(s.startDate);
    const today = parseDate(todayStr());
    let date = today > startDate ? today : startDate;
    if (mode === "advanced") {
      const core = await this.buildPlan("core");
      if (core.days.length) date = addDays(parseDate(core.endDate), 1);
    }
    const planStart = new Date(date);

    const days = [];
    let mainTotal = 0, lectureTotal = 0;

    // ---------- Aaj ki "locked" list ----------
    // Dashboard aaj ke tasks ek baar fix kar deta hai (Store.state.today).
    // Taaki Done karte hi list badal na jaye: aaj wahi tasks, planning kal se.
    const snap = Store.state.today;
    if (mode === "core" && snap && snap.date === todayStr() && formatDate(date) === snap.date) {
      const snapIds = new Set(snap.tasks.map(t => t.id));
      const mainById = Object.fromEntries(allMain.map(t => [t.id, t]));
      const lecById = Object.fromEntries(allLectures.map(t => [t.id, t]));
      mainQ = mainQ.filter(t => !snapIds.has(t.id));
      lectureQ = lectureQ.filter(t => !snapIds.has(t.id));
      warmQ = warmQ.filter(id => !snapIds.has(id));

      const day0 = {
        date: snap.date, sprint: Math.floor(daysBetween(startDate, date) / 7) + 1,
        capacity: s.hours[DAY_KEYS[date.getDay()]] * 60, warmup: [], main: [], lectures: [], minutes: 0, locked: true,
      };
      snap.tasks.forEach(({ id, type }) => {
        let t = null;
        if (type === "warmup") t = { id, type, title: wbById[id]?.title || id, topic: wbById[id]?.category, minutes: WARMUP_MINUTES };
        if (type === "main") t = mainById[id];
        if (type === "lecture") t = lecById[id];
        if (!t) return;
        day0[type === "main" ? "main" : type === "lecture" ? "lectures" : "warmup"].push(t);
        day0.minutes += t.minutes;
      });
      days.push(day0);
      date = addDays(date, 1);
    }

    while ((mainQ.length || lectureQ.length) && days.length < 730) {
      const capacity = s.hours[DAY_KEYS[date.getDay()]] * 60;
      const day = {
        date: formatDate(date),
        sprint: Math.floor(daysBetween(mode === "core" ? startDate : planStart, date) / 7) + 1,
        capacity, warmup: [], main: [], lectures: [], minutes: 0,
      };

      if (capacity > 0) {
        // 1) Warm-up
        if (withWarmup) {
          for (let k = 0; k < s.warmupCount; k++) {
            if (!warmQ.length) warmQ = [...nextRoundIds]; // round khatam: agla round (projection)
            if (!warmQ.length) break;
            const id = warmQ.shift();
            day.warmup.push({ id, type: "warmup", title: wbById[id]?.title || id, topic: wbById[id]?.category, minutes: WARMUP_MINUTES });
          }
        }
        const warmMin = day.warmup.length * WARMUP_MINUTES;

        // 2) Baaki time Lectures aur Main Quest mein baanto
        const rest = Math.max(0, capacity - warmMin);
        let lectureBudget = lectureQ.length ? Math.round(rest * s.lectureShare / 100) : 0;
        if (!mainQ.length) lectureBudget = rest;
        const mainBudget = rest - lectureBudget;

        const l = this.fill(lectureQ, lectureBudget, day.lectures);
        const m = this.fill(mainQ, mainBudget, day.main);
        lectureTotal += l;
        mainTotal += m;
        day.minutes = warmMin + l + m;
      }

      days.push(day);
      date = addDays(date, 1);
    }

    // ---------- Summary ----------
    const lastWith = key => [...days].reverse().find(d => d[key].length)?.date || null;
    const endDate = days.length ? days[days.length - 1].date : todayStr();
    const target = parseDate(s.targetDate);
    const lateBy = daysBetween(target, parseDate(endDate));
    const workMinutes = mainTotal + lectureTotal;
    const weeksLeft = Math.max(1, (daysBetween(days.length ? parseDate(days[0].date) : today, target) + 1) / 7);

    const sprints = [];
    days.forEach(d => {
      let sp = sprints.find(x => x.number === d.sprint);
      if (!sp) { sp = { number: d.sprint, days: [], minutes: 0, topics: [] }; sprints.push(sp); }
      sp.days.push(d);
      sp.minutes += d.minutes;
      d.main.forEach(t => { if (!sp.topics.includes(t.topic)) sp.topics.push(t.topic); });
    });

    const activeWarmups = workbook.length - w.tooEasy.length;
    return {
      mode, days, sprints, endDate, lateBy,
      startDate: days.length ? days[0].date : null,
      mainEnd: lastWith("main"), lectureEnd: lastWith("lectures"),
      main: { total: allMain.length, pending: allMain.filter(t => !this.isDone(t.id)).length },
      lectures: { total: allLectures.length, pending: allLectures.filter(t => !this.isDone(t.id)).length },
      warmup: { round: w.round, name: Warmup.roundName(), done: w.order.filter(id => Warmup.inRound(id)).length - remainingIds.length, total: w.order.filter(id => Warmup.inRound(id)).length },
      workMinutes, weeklyHours,
      requiredWeeklyHours: Math.ceil((workMinutes / 60) / weeksLeft + (withWarmup ? (s.warmupCount * WARMUP_MINUTES * 7) / 60 : 0)),
    };
  },
};
