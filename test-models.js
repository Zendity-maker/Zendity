require('dotenv').config();

async function run() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { console.log('NO KEY'); return; }

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await res.json();
    if (data.models) {
      console.log(data.models.map(m => m.name).join('\n'));
    } else {
      console.log("ERROR LISTING:", data);
    }
  } catch (e) { console.error("ERR:", e); }
}
run();
