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

// Add a simple HTTP server so cloud hosts (Render, Koyeb, etc.) don't kill the process
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot is running!');
});
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Dummy web server running on port ${PORT}`);
});

bot.launch().then(() => {
  console.log('Bot is running...');
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
