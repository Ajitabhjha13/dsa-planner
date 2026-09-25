const ProblemsPage = {
  async render() {
    const problems = await Data.problems();

    // Topic-wise count: { "Arrays": { core: 52, advanced: 10 }, ... }
    const topics = {};
    problems.forEach(p => {
      topics[p.topic] ??= { core: 0, advanced: 0 };
      topics[p.topic][p.tier]++;
    });

    const count = src => problems.filter(p => p.source === src).length;

    const topicCards = Object.entries(topics)
      .map(([name, c]) => `
        <div class="card">
          <div class="stat-value">${c.core + c.advanced}</div>
          <div class="stat-label">${name}<br>${c.core} Plan • ${c.advanced} Plan 2.0</div>
        </div>
      `)
      .join("");

    return `
      <h1 class="page-title">Problems</h1>
      <p class="page-sub">${problems.length} problems, ${Object.keys(topics).length} topics.</p>

      <div class="grid source-grid">
        <div class="card"><div class="stat-value"><span class="src src-S">S</span> ${count("S")}</div><div class="stat-label">Striver A2Z only</div></div>
        <div class="card"><div class="stat-value"><span class="src src-L">L</span> ${count("L")}</div><div class="stat-label">Love Babbar only</div></div>
        <div class="card"><div class="stat-value"><span class="src src-C">C</span> ${count("C")}</div><div class="stat-label">Common to both</div></div>
        <div class="card"><div class="stat-value"><span class="src src-R">R</span> ${count("R")}</div><div class="stat-label">Roadmap only</div></div>
      </div>

      <h2 class="section-title" style="margin: 28px 0 12px">Topics</h2>
      <div class="grid">${topicCards}</div>

      <div class="upcoming">
        <b>Coming here next:</b>
        <ul>
          <li>Status, LeetCode link and search buttons for every problem</li>
          <li>My solution, key points and comments</li>
          <li>Confidence rating and revision date</li>
        </ul>
      </div>
    `;
  },
};
