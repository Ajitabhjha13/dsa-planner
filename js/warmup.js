// =========================================================
// WARM-UP: "Shuffle Bag" system
//
// Round shuru hone pe saare warm-up questions ek balanced, shuffled
// order mein lag jaate hain. Roz agle 10 aate hain. Jab tak round ke
// saare questions khatam nahi hote, koi repeat nahi hota.
// Round khatam -> naya round, naye shuffle ke saath.
// "Too easy" mark kiye questions kisi round mein wapas nahi aate.
// =========================================================

// Roz ke 10 questions in 4 groups se aate hain (balanced mix)
const WARMUP_BUCKETS = [
  { name: "basics",   prefixes: ["B", "C"],                    perDay: 2 },
  { name: "loops",    prefixes: ["LB", "LD", "LN", "LS", "LM"], perDay: 3 },
  { name: "patterns", prefixes: ["PS", "PN", "PA"],            perDay: 3 },
  { name: "dsa",      prefixes: ["AR", "ST", "MX", "RC", "BT"], perDay: 2 },
];

function prefixOf(id) {
  return id.match(/^[A-Z]+/)[0];
}

// Fisher-Yates shuffle: har order equally likely (interview favourite!)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const Warmup = {
  // Balanced order banao: har "din" ke slot mein 2+3+3+2 pattern
  buildOrder(ids) {
    const buckets = WARMUP_BUCKETS.map(b =>
      shuffle(ids.filter(id => b.prefixes.includes(prefixOf(id))))
    );
    const order = [];
    while (buckets.some(b => b.length)) {
      WARMUP_BUCKETS.forEach((b, i) => {
        for (let k = 0; k < b.perDay; k++) {
          // Agar is bucket mein kuch nahi bacha, sabse bade bucket se le lo
          let source = buckets[i].length ? buckets[i] : buckets.reduce((x, y) => (y.length > x.length ? y : x));
          if (source.length) order.push(source.shift());
        }
      });
    }
    return order;
  },

  // ---------------- ROUND CYCLE ----------------
  // Round 1 (saare) -> Review Round (sirf 🔁 wale) -> Round 2 (saare) -> Review Round -> ...
  // Koi 🔁 wala nahi? Review Round skip, seedha agla full round.
  isActive(id) {
    return !Store.state.warmup.tooEasy.includes(id);
  },

  // Review Round mein sirf woh gine jaate hain jo abhi bhi 🔁 marked hain
  inRound(id) {
    const w = Store.state.warmup;
    if (!this.isActive(id)) return false;
    return w.mode === "review" ? !!Store.state.review[id] || !!w.done[id] : true;
  },

  async ensureRound() {
    const all = (await Data.workbook()).map(x => x.id);
    const w = Store.state.warmup;
    w.mode ??= "full";

    const finished = w.order.length > 0 && w.order.filter(id => this.inRound(id)).every(id => w.done[id]);
    if (w.order.length === 0 || finished) {
      const flagged = all.filter(id => this.isActive(id) && Store.state.review[id]);

      if (w.order.length === 0) {
        w.round = 1; w.mode = "full";
        w.order = this.buildOrder(all.filter(id => this.isActive(id)));
      } else if (w.mode === "full" && flagged.length) {
        w.mode = "review";                       // Round N ke baad Review Round N
        w.order = shuffle(flagged);
      } else {
        w.round += 1; w.mode = "full";           // naya full round, naya shuffle
        w.order = this.buildOrder(all.filter(id => this.isActive(id)));
      }
      w.done = {};
      Store.save();
    }
    return w;
  },

  // Is round ke bache hue questions, order mein
  async remaining() {
    const w = await this.ensureRound();
    return w.order.filter(id => this.inRound(id) && !w.done[id]);
  },

  roundName() {
    const w = Store.state.warmup;
    return w.mode === "review" ? `Review Round ${w.round}` : `Round ${w.round}`;
  },

  markDone(id) {
    const w = Store.state.warmup;
    w.done[id] = todayStr();
    w.history ??= {};
    w.history[id] = (w.history[id] || 0) + 1;   // kitni baar solve kiya (saare rounds mila ke)
    w.lastDone ??= {};
    w.lastDone[id] = todayStr();                 // round badal jaye toh bhi aaj ki list mein ✓ dikhe
    Store.save();
  },

  unmarkDone(id) {
    const w = Store.state.warmup;
    delete w.done[id];
    if (w.history?.[id]) w.history[id] -= 1;
    if (w.lastDone?.[id] === todayStr()) delete w.lastDone[id];
    Store.save();
  },

  markTooEasy(id) {
    const w = Store.state.warmup;
    if (!w.tooEasy.includes(id)) w.tooEasy.push(id);
    Store.save();
  },

  undoTooEasy(id) {
    const w = Store.state.warmup;
    w.tooEasy = w.tooEasy.filter(x => x !== id);
    Store.save();
  },
};
