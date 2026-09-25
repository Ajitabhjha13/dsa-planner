const VideosPage = {
  async render() {
    return `
      <h1 class="page-title">Videos</h1>
      <p class="page-sub">All lectures from the CodeHelp Java DSA playlist.</p>

      <div class="upcoming">
        <b>Coming here next:</b>
        <ul>
          <li>Import the playlist from YouTube (titles and durations)</li>
          <li>Mark lectures as watched or skipped</li>
          <li>Alternate video links for any topic</li>
        </ul>
      </div>
    `;
  },
};
