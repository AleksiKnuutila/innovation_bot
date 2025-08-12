// Victory condition checking system for Innovation
// Handles achievement victory, score victory, and card-based victory conditions

import type { GameData, PlayerId } from '../types/index.js';
import type { WinCondition } from '../types/core.js';

// Check all victory conditions and return winner if any
export function checkVictoryConditions(gameData: GameData): { winner: PlayerId | null; condition: WinCondition | null } {
  // Check achievement victory first (most common)
  const achievementWinner = checkAchievementVictory(gameData);
  if (achievementWinner !== null) {
    return { winner: achievementWinner, condition: 'achievements' };
  }
  
  // Check score victory (when trying to draw age 11+)
  const scoreWinner = checkScoreVictory(gameData);
  if (scoreWinner !== null) {
    return { winner: scoreWinner, condition: 'score' };
  }
  
  // Check card-based victory conditions
  const cardWinner = checkCardBasedVictory(gameData);
  if (cardWinner !== null) {
    return { winner: cardWinner, condition: 'achievements' }; // Use valid WinCondition type
  }
  
  return { winner: null, condition: null };
}

// Check achievement victory (6 achievements for 2-player base game)
function checkAchievementVictory(gameData: GameData): PlayerId | null {
  const requiredAchievements = 6; // For 2-player base game
  
  for (const playerId of [0, 1] as PlayerId[]) {
    const player = gameData.players[playerId]!;
    const totalAchievements = player.normalAchievements.length + player.specialAchievements.length;
    
    if (totalAchievements >= requiredAchievements) {
      return playerId;
    }
  }
  
  return null;
}

// Check score victory (when someone tries to draw age 11+)
function checkScoreVictory(gameData: GameData): PlayerId | null {
  // This is now handled in drawCard function when age 11+ is requested
  // The function will emit a game_end event and return GameOver state
  // We just need to check if the game is already over
  if (gameData.phase.state === 'GameOver') {
    // Find the player with highest score
    const scores = getPlayerScores(gameData);
    const maxScore = Math.max(...Object.values(scores));
    const winners = Object.entries(scores)
      .filter(([_, score]) => score === maxScore)
      .map(([playerId, _]) => parseInt(playerId) as PlayerId)
      .filter((playerId): playerId is PlayerId => playerId !== undefined);
  
    if (winners.length === 1) {
      return winners[0];
    } else {
      // Tie - use tie-breaking logic
      return breakScoreTie(gameData);
    }
  }
  
  return null;
}

// Check card-based victory conditions
function checkCardBasedVictory(gameData: GameData): PlayerId | null {
  // This would check for cards with "win the game" effects
  // For now, return null - will be implemented when we add those cards
  return null;
}

// Get player scores for score-based victory
export function getPlayerScores(gameData: GameData): Record<PlayerId, number> {
  const scores: Record<PlayerId, number> = { 0: 0, 1: 0 }; // Initialize with default values
  
  for (const playerId of [0, 1] as PlayerId[]) {
    const player = gameData.players[playerId]!;
    let score = 0;
    
    // Count score from score pile
    for (const cardId of player.scores) {
      const card = gameData.shared.supplyPiles.find(pile => 
        pile.cards.includes(cardId)
      );
      if (card) {
        score += card.age;
      }
    }
    
    scores[playerId] = score;
  }
  
  return scores;
}

// Determine winner in case of score tie (most achievements wins)
export function breakScoreTie(gameData: GameData): PlayerId | null {
  const scores = getPlayerScores(gameData);
  const maxScore = Math.max(...Object.values(scores));
  
  // Find players with max score
  const tiedPlayers = Object.entries(scores)
    .filter(([_, score]) => score === maxScore)
    .map(([playerId, _]) => parseInt(playerId) as PlayerId)
    .filter((playerId): playerId is PlayerId => playerId !== undefined);
  
  if (tiedPlayers.length === 1) {
    return tiedPlayers[0];
  }
  
  // Break tie by most achievements
  let maxAchievements = 0;
  let winner: PlayerId | null = null;
  
  for (const playerId of tiedPlayers) {
    const player = gameData.players[playerId]!;
    const totalAchievements = player.normalAchievements.length + player.specialAchievements.length;
    
    if (totalAchievements > maxAchievements) {
      maxAchievements = totalAchievements;
      winner = playerId;
    }
  }
  
  return winner;
} 