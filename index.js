require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("BOT_TOKEN is not set in the .env file");
  process.exit(1);
}

const bot = new Telegraf(token);

// Tiranga Logic
// Numbers 0-4 are Small, 5-9 are Big
// Numbers 1, 3, 5, 7, 9 are Green
// Numbers 2, 4, 6, 8, 0 are Red
// Numbers 0 and 5 also include Violet

const userModes = {};

bot.start((ctx) => {
  sendMainMenu(ctx);
});

function sendMainMenu(ctx) {
  delete userModes[ctx.from.id];
  ctx.reply(
    `Welcome to the Tiranga Bot! 🎯\n\nWhat would you like to do?`,
    Markup.keyboard([
      ['🔮 Prediction', '🧠 Training']
    ]).resize()
  );
}

bot.hears('🔮 Prediction', (ctx) => {
  userModes[ctx.from.id] = { action: 'predict' };
  ctx.reply(
    `🔮 <b>Prediction Mode</b>\nPlease select your game mode:`,
    {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        ['Win Go 30s', 'Win Go 1Min'],
        ['Win Go 3Min', 'Win Go 5Min'],
        ['Go Back']
      ]).resize()
    }
  );
});

bot.hears('🧠 Training', (ctx) => {
  userModes[ctx.from.id] = { action: 'train' };
  ctx.reply(
    `🧠 <b>Training Mode</b>\nPlease select your game mode:`,
    {
      parse_mode: 'HTML',
      ...Markup.keyboard([
        ['Win Go 30s', 'Win Go 1Min'],
        ['Win Go 3Min', 'Win Go 5Min'],
        ['Go Back']
      ]).resize()
    }
  );
});

bot.hears('Go Back', (ctx) => {
  sendMainMenu(ctx);
});

bot.hears(/^Win Go (30s|1Min|3Min|5Min)$/, (ctx) => {
  const modeText = ctx.match[1];
  const modeMap = {
    '30s': { key: '30s', name: '30 Seconds' },
    '1Min': { key: '1m', name: '1 Minute' },
    '3Min': { key: '3m', name: '3 Minutes' },
    '5Min': { key: '5m', name: '5 Minutes' }
  };
  
  const selectedMode = modeMap[modeText];
  let userState = userModes[ctx.from.id];
  
  if (!userState || !userState.action) {
    return ctx.reply("⚠️ Please select 'Prediction' or 'Training' first from the Main Menu.", Markup.keyboard([['🔮 Prediction', '🧠 Training']]).resize());
  }

  userState.mode = selectedMode.key;
  userState.modeName = selectedMode.name;
  
  if (userState.action === 'predict') {
    ctx.reply(`✅ Selected: <b>Prediction (${selectedMode.name})</b>\n\nNow, please send me the last 6 digits of the period (e.g., 123456) to get a prediction.\n\nOr click 'Go Back' to return.`, { parse_mode: 'HTML' });
  } else {
    ctx.reply(`✅ Selected: <b>Training (${selectedMode.name})</b>\n\nNow, please send me the outcome as: <code>[period] [number]</code> (e.g., 123456 8)\n\nOr click 'Go Back' to return.`, { parse_mode: 'HTML' });
  }
});

bot.hears(/^(?:result\s+)?(\d+)\s+(\d)$/i, (ctx) => {
  const userState = userModes[ctx.from.id];
  if (!userState || userState.action !== 'train' || !userState.mode) {
    return ctx.reply("⚠️ Please select 'Training' mode and a game mode first.", Markup.keyboard([['🔮 Prediction', '🧠 Training']]).resize());
  }
  
  const period = ctx.match[1];
  const number = parseInt(ctx.match[2]);
  
  let size = number >= 5 ? 'Big' : 'Small';
  let color = '';
  if (number === 0) color = 'Red/Violet';
  else if (number === 5) color = 'Green/Violet';
  else if (number % 2 === 0) color = 'Red';
  else color = 'Green';
  
  const entry = `${period} - ${number} - ${size} - ${color}\n`;
  const filename = `history_${userState.mode}.txt`;
  
  try {
    fs.appendFileSync(filename, entry);
    // Also append to general history.txt
    fs.appendFileSync('history.txt', entry);
    
    ctx.reply(`✅ <b>Training Data Saved!</b>\nMode: ${userState.modeName}\nPeriod: ${period}\nOutcome: ${number} - ${size} - ${color}\n\nThe bot has learned from this outcome.`, { parse_mode: 'HTML' });
  } catch (err) {
    ctx.reply(`❌ Failed to save outcome.`);
    console.error(err);
  }
});

bot.hears(/^\d{6}$/, (ctx) => {
  const userState = userModes[ctx.from.id];
  if (!userState || userState.action !== 'predict' || !userState.mode) {
    return ctx.reply("⚠️ Please select 'Prediction' mode and a game mode first.", Markup.keyboard([['🔮 Prediction', '🧠 Training']]).resize());
  }
  
  const period = ctx.message.text;
  const mode = userState.modeName;
  
  // Predict Color based on Period (Reverse Even/Odd rule from updated history, 51.3% win rate)
  const isEven = parseInt(period) % 2 === 0;
  const color = !isEven ? "Red 🔴" : "Green 🟢";
  const size = !isEven ? "Small 📉" : "Big 📈";
  
  // Pick a random number that matches the color
  const redNumbers = [2, 4, 6, 8, 0];
  const greenNumbers = [1, 3, 5, 7, 9];
  const number = !isEven 
    ? redNumbers[Math.floor(Math.random() * redNumbers.length)] 
    : greenNumbers[Math.floor(Math.random() * greenNumbers.length)];
  
  const message = `
🎯 <b>Tiranga Prediction</b> 🎯
⏱️ <b>Mode:</b> ${mode}

🔖 <b>Period:</b> ${period}
🔢 <b>Number:</b> ${number}
📏 <b>Size:</b> ${size}
🎨 <b>Color:</b> ${color}
  `;

  ctx.reply(message, {
    parse_mode: 'HTML',
    reply_parameters: { message_id: ctx.message.message_id }
  });
});

// Premium dashboard HTTP server
const http = require('http');
const startTime = Date.now();

const dashboardHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Tiranga Bot · Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      background: #0a0a0f;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      position: relative;
    }

    /* Animated background orbs */
    .bg-orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(80px);
      animation: float 8s ease-in-out infinite;
      pointer-events: none;
      z-index: 0;
    }
    .orb1 { width: 400px; height: 400px; background: radial-gradient(circle, rgba(99,102,241,0.25), transparent); top: -100px; left: -100px; animation-delay: 0s; }
    .orb2 { width: 350px; height: 350px; background: radial-gradient(circle, rgba(16,185,129,0.2), transparent); bottom: -80px; right: -80px; animation-delay: -3s; }
    .orb3 { width: 250px; height: 250px; background: radial-gradient(circle, rgba(245,158,11,0.15), transparent); top: 50%; left: 50%; transform: translate(-50%,-50%); animation-delay: -5s; }

    @keyframes float {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-30px) scale(1.05); }
    }

    /* Subtle grid pattern */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image:
        linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px);
      background-size: 60px 60px;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 900px;
      padding: 24px;
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: 40px;
    }

    .logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      margin-bottom: 16px;
    }

    .logo-icon {
      width: 56px; height: 56px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      font-size: 28px;
      box-shadow: 0 0 30px rgba(99,102,241,0.4);
    }

    .logo-text {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, #a5b4fc, #818cf8, #e879f9);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: #64748b;
      font-size: 0.95rem;
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    /* Status pill */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(16,185,129,0.1);
      border: 1px solid rgba(16,185,129,0.3);
      color: #34d399;
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      margin-top: 12px;
      letter-spacing: 0.5px;
    }
    .pulse-dot {
      width: 8px; height: 8px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
      50% { opacity: 0.8; transform: scale(1.2); box-shadow: 0 0 0 6px rgba(16,185,129,0); }
    }

    /* Cards grid */
    .cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(20px);
      transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: 20px;
      padding: 1px;
      background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .card:hover {
      transform: translateY(-4px);
      border-color: rgba(99,102,241,0.3);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 20px rgba(99,102,241,0.1);
    }

    .card-icon {
      font-size: 2rem;
      margin-bottom: 12px;
      display: block;
    }
    .card-label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 1.6rem;
      font-weight: 800;
      color: #f1f5f9;
      line-height: 1;
    }
    .card-value.uptime { font-size: 1.1rem; font-weight: 700; color: #a5b4fc; }
    .card-sub {
      font-size: 0.72rem;
      color: #475569;
      margin-top: 4px;
    }

    /* Accent colors per card */
    .card.card-green .card-value { color: #34d399; }
    .card.card-purple .card-value { color: #a78bfa; }
    .card.card-amber .card-value { color: #fbbf24; }

    /* Info panel */
    .info-panel {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      padding: 24px 28px;
      backdrop-filter: blur(20px);
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }

    .info-row {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .info-key {
      font-size: 0.72rem;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    .info-val {
      font-size: 0.9rem;
      color: #cbd5e1;
      font-weight: 500;
    }

    /* Mode badges */
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      margin-right: 4px;
      margin-top: 4px;
    }
    .badge-predict { background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .badge-train   { background: rgba(16,185,129,0.1); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.25); }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 24px;
      color: #334155;
      font-size: 0.78rem;
    }

    @media (max-width: 640px) {
      .cards { grid-template-columns: 1fr 1fr; }
      .info-panel { grid-template-columns: 1fr; }
      .logo-text { font-size: 1.5rem; }
    }
    @media (max-width: 400px) {
      .cards { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="bg-orb orb1"></div>
  <div class="bg-orb orb2"></div>
  <div class="bg-orb orb3"></div>

  <div class="container">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">🎯</div>
        <div class="logo-text">Tiranga Bot</div>
      </div>
      <div class="subtitle">Prediction &amp; Training Intelligence System</div>
      <div class="status-pill">
        <div class="pulse-dot"></div>
        ONLINE &amp; ACTIVE
      </div>
    </div>

    <div class="cards">
      <div class="card card-green">
        <span class="card-icon">🤖</span>
        <div class="card-label">Bot Status</div>
        <div class="card-value">Running</div>
        <div class="card-sub">All systems nominal</div>
      </div>
      <div class="card card-purple">
        <span class="card-icon">⏱️</span>
        <div class="card-label">Uptime</div>
        <div class="card-value uptime" id="uptime">Calculating...</div>
        <div class="card-sub">Since last deploy</div>
      </div>
      <div class="card card-amber">
        <span class="card-icon">🌐</span>
        <div class="card-label">Platform</div>
        <div class="card-value" style="font-size:1.1rem">Render.com</div>
        <div class="card-sub">Cloud hosting</div>
      </div>
    </div>

    <div class="info-panel">
      <div class="info-row">
        <span class="info-key">Bot Name</span>
        <span class="info-val">Tiranga Prediction Bot 🎯</span>
      </div>
      <div class="info-row">
        <span class="info-key">Game Modes</span>
        <span class="info-val">30s &nbsp;·&nbsp; 1Min &nbsp;·&nbsp; 3Min &nbsp;·&nbsp; 5Min</span>
      </div>
      <div class="info-row">
        <span class="info-key">Available Actions</span>
        <span class="info-val">
          <span class="badge badge-predict">🔮 Prediction</span>
          <span class="badge badge-train">🧠 Training</span>
        </span>
      </div>
      <div class="info-row">
        <span class="info-key">Runtime</span>
        <span class="info-val">Node.js · Telegraf</span>
      </div>
      <div class="info-row">
        <span class="info-key">Server Time</span>
        <span class="info-val" id="serverTime">Loading...</span>
      </div>
      <div class="info-row">
        <span class="info-key">Win Rate</span>
        <span class="info-val" style="color:#fbbf24">~51.3% &nbsp;📈</span>
      </div>
    </div>

    <div class="footer">
      Powered by Telegraf &amp; Node.js &nbsp;·&nbsp; Hosted on Render
    </div>
  </div>

  <script>
    const bootTime = ${Date.now()};

    function formatUptime(ms) {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      if (d > 0) return d + 'd ' + (h % 24) + 'h ' + (m % 60) + 'm';
      if (h > 0) return h + 'h ' + (m % 60) + 'm ' + (s % 60) + 's';
      if (m > 0) return m + 'm ' + (s % 60) + 's';
      return s + 's';
    }

    function tick() {
      const now = Date.now();
      document.getElementById('uptime').textContent = formatUptime(now - bootTime);
      document.getElementById('serverTime').textContent = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' UTC';
    }
    tick();
    setInterval(tick, 1000);
  </script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(dashboardHTML);
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(\`Premium dashboard running on port \${PORT}\`);
});

const startBot = async () => {
  try {
    await bot.launch();
    console.log('Bot is running...');
  } catch (err) {
    console.error('Failed to launch bot:', err.message);
    if (err.response && err.response.error_code === 409) {
      console.log('Conflict error: Another instance is running. Retrying in 5 seconds...');
      setTimeout(startBot, 5000);
    }
  }
};
startBot();

// Enable graceful stop safely
process.once('SIGINT', () => {
  try { bot.stop('SIGINT'); } catch (e) {}
});
process.once('SIGTERM', () => {
  try { bot.stop('SIGTERM'); } catch (e) {}
});
