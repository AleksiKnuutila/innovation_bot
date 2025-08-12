// Bot module exports

export type { Bot, BotConfig, BotDecision } from './types.js';
export { RandomBot } from './random-bot.js';
export { runBotVsBotGame, runBotTournament } from './game-runner.js';
export type { BotGameConfig, BotGameResult } from './game-runner.js'; 