// =========================================================
// Common names + Plan 2.0 page (tree view, quest.js)
// =========================================================
const SOURCE_NAMES = { S: "Striver A2Z", L: "Love Babbar", C: "Common: Striver + Babbar", R: "Roadmap only", W: "Warm-up workbook" };

const Plan2Page = {
  render: () => QuestTree.render("advanced"),
  afterRender: () => QuestTree.afterRender("advanced"),
};
