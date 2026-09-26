// =========================================================
// DATA LOADER
// JSON files ko ek baar load karke memory mein rakhta hai (cache),
// taaki har page change pe dobara download na ho.
// =========================================================
const Data = {
  cache: {},

  async load(name) {
    if (this.cache[name]) return this.cache[name];

    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`data/${name}.json failed to load (${res.status})`);

    this.cache[name] = await res.json();
    return this.cache[name];
  },

  // Saare problems: Striver (S) + Love Babbar (L) + dono (C) + Roadmap-only (R)
  problems() { return this.load("problems"); },
  // 166 LeetCode problems ke poore statements (examples, constraints, hints)
  statements() { return this.load("statements"); },
  workbook() { return this.load("workbook"); },

  // Lectures: YouTube se import hoke Store mein save hote hain (Videos page)
  async videos() {
    return Store.state.videos?.items || [];
  },
};
