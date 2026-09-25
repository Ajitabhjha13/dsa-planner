const ProfilePage = {
  async render() {
    return `
      <h1 class="page-title">Profile</h1>
      <p class="page-sub">Your public DSA portfolio.</p>

      <div class="upcoming">
        <b>Coming here next:</b>
        <ul>
          <li>About, education and skills</li>
          <li>GitHub, LinkedIn, LeetCode and GFG links</li>
          <li>Consistency heatmap and topic-wise analysis</li>
        </ul>
      </div>
    `;
  },
};
