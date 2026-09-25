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

  // Videos Step 5 mein import honge. Tab tak khaali list.
  async videos() {
    try { return await this.load("videos"); }
    catch { return (this.cache.videos = []); } // file nahi hai: baar-baar request mat bhejo
  },
};
