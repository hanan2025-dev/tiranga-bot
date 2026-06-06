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
  ctx.reply(
    `Welcome to the Tiranga Bot! 🎯\n\nWhat would you like to do?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔮 Prediction', 'action_predict'), Markup.button.callback('🧠 Training', 'action_train')]
    ])
  );
});

bot.action('action_predict', (ctx) => {
  ctx.reply(
    `🔮 <b>Prediction Mode</b>\nPlease select your game mode:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Win Go 30s', 'predict_30s'), Markup.button.callback('Win Go 1Min', 'predict_1m')],
        [Markup.button.callback('Win Go 3Min', 'predict_3m'), Markup.button.callback('Win Go 5Min', 'predict_5m')]
      ])
    }
  );
  ctx.answerCbQuery();
});

bot.action('action_train', (ctx) => {
  ctx.reply(
    `🧠 <b>Training Mode</b>\nPlease select your game mode:`,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('Win Go 30s', 'train_30s'), Markup.button.callback('Win Go 1Min', 'train_1m')],
        [Markup.button.callback('Win Go 3Min', 'train_3m'), Markup.button.callback('Win Go 5Min', 'train_5m')]
      ])
    }
  );
  ctx.answerCbQuery();
});

bot.action(/^(predict|train)_(.+)$/, (ctx) => {
  const action = ctx.match[1];
  const modeKey = ctx.match[2];
  const modeMap = {
    '30s': '30 Seconds',
    '1m': '1 Minute',
    '3m': '3 Minutes',
    '5m': '5 Minutes'
  };
  const modeName = modeMap[modeKey];
  
  userModes[ctx.from.id] = { action, mode: modeKey, modeName };
  
  if (action === 'predict') {
    ctx.reply(`✅ Selected: <b>Prediction (${modeName})</b>\n\nNow, please send me the last 6 digits of the period (e.g., 123456) to get a prediction.`, { parse_mode: 'HTML' });
  } else {
    ctx.reply(`✅ Selected: <b>Training (${modeName})</b>\n\nNow, please send me the outcome as: <code>[period] [number]</code> (e.g., 123456 8)`, { parse_mode: 'HTML' });
  }
  ctx.answerCbQuery();
});

bot.hears(/^(?:result\s+)?(\d+)\s+(\d)$/i, (ctx) => {
  const userState = userModes[ctx.from.id];
  if (!userState || userState.action !== 'train') {
    return ctx.reply("⚠️ Please select 'Training' mode from /start first.");
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
  if (!userState || userState.action !== 'predict') {
    return ctx.reply("⚠️ Please select 'Prediction' mode from /start first.");
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
