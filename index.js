require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

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
    `Welcome to the Tiranga Prediction Bot! 🎯\n\nPlease select your game mode:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Win Go 30s', 'mode_30s'), Markup.button.callback('Win Go 1Min', 'mode_1m')],
      [Markup.button.callback('Win Go 3Min', 'mode_3m'), Markup.button.callback('Win Go 5Min', 'mode_5m')]
    ])
  );
});

bot.action(/mode_(.+)/, (ctx) => {
  const modeMap = {
    '30s': '30 Seconds',
    '1m': '1 Minute',
    '3m': '3 Minutes',
    '5m': '5 Minutes'
  };
  const mode = ctx.match[1];
  userModes[ctx.from.id] = modeMap[mode];
  
  ctx.reply(`✅ Selected Mode: <b>${modeMap[mode]}</b>\n\nNow, please send me the last 6 digits of the period (e.g., 123456) to get a prediction.`, { parse_mode: 'HTML' });
  ctx.answerCbQuery();
});

bot.hears(/^\d{6}$/, (ctx) => {
  const period = ctx.message.text;
  const mode = userModes[ctx.from.id] || '1 Minute'; // default to 1 min
  
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
