// Step 1: check karta hai ki data files sahi se load ho rahi hain ya nahi.
async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} load nahi hua (${res.status})`);
  return res.json();
}

async function checkSetup() {
  const status = document.getElementById("status");
  try {
    const roadmap = await loadJSON("data/roadmap-problems.json");
    const workbook = await loadJSON("data/workbook.json");

    const core = roadmap.filter(p => !p.optional).length;
    const highFreq = roadmap.filter(p => p.highFrequency).length;

    status.innerHTML = `
      <p class="ok">✅ Setup sahi hai!</p>
      <p>Roadmap problems: <b>${roadmap.length}</b> (core: ${core}, optional: ${roadmap.length - core})</p>
      <p>High-Frequency: <b>${highFreq}</b></p>
      <p>Workbook questions: <b>${workbook.length}</b></p>
    `;
  } catch (err) {
    status.innerHTML = `<p class="err">❌ ${err.message}</p>
      <p>Check karo: kya tumne file ko Live Server se khola hai?</p>`;
  }
}

checkSetup();
