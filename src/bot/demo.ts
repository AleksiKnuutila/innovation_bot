#!/usr/bin/env node

/**
 * Simple demo script to showcase the RandomBot functionality
 * Run with: npm run bot:demo
 */

import { RandomBot } from './random-bot.js';
import { runBotVsBotGame } from './game-runner.js';
import { initializeGame } from '../engine/index.js';

async function runDemo() {
  console.log('🤖 Innovation RandomBot Demo\n');

  // Create two bots with different seeds
  const bot0 = new RandomBot({ seed: 42, verbose: true });
  const bot1 = new RandomBot({ seed: 123, verbose: true });

  console.log(`Bot 0: ${bot0.getName()}`);
  console.log(`Bot 1: ${bot1.getName()}\n`);

  // Initialize a game
  const gameState = initializeGame({
    gameId: 'demo-game',
    playerNames: ['RandomBot-42', 'RandomBot-123'],
    rngSeed: 999,
  });

  console.log('🎮 Game initialized:');
  console.log(`- Current player: ${gameState.phase.currentPlayer}`);
  console.log(`- Turn number: ${gameState.phase.turnNumber}`);
  console.log(`- Phase: ${gameState.phase.state}\n`);

  // Let bot 1 (current player) make a decision
  try {
    const action = bot1.decideAction(gameState, 1);
    console.log(`✅ Bot 1 chose action: ${action.type}`);
    console.log(`   Player ID: ${action.playerId}`);
    console.log(`   Timestamp: ${new Date(action.timestamp).toISOString()}\n`);
  } catch (error) {
    console.error(`❌ Bot 1 failed to decide action:`, error);
  }

  // Run a quick bot vs bot game
  console.log('🏆 Running a quick bot vs bot game...\n');
  
  try {
    const result = await runBotVsBotGame({
      seed: 777,
      playerNames: ['DemoBot0', 'DemoBot1'],
      bot0,
      bot1,
      maxTurns: 10,
      verbose: true,
    });

    console.log('\n📊 Game Results:');
    console.log(`- Turns played: ${result.turnsPlayed}`);
    console.log(`- Actions processed: ${result.actionsProcessed}`);
    console.log(`- Duration: ${result.duration.toFixed(2)}ms`);
    console.log(`- Natural end: ${result.naturalEnd}`);
    console.log(`- Final state: ${result.finalState.phase.state}`);
    
    if (result.winner !== null) {
      console.log(`- Winner: Player ${result.winner}`);
    }
    
  } catch (error) {
    console.error('❌ Bot vs bot game failed:', error);
  }

  console.log('\n🎉 Demo completed!');
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}

export { runDemo }; 