// Special achievements system for Innovation
// Handles auto-claiming of special achievements when conditions are met

import type { GameData, PlayerId } from '../types/index.js';
import type { SpecialAchievementId } from '../types/core.js';
import { emitEvent } from './events.js';
import { countIcons } from './state-manipulation.js';
import { CARDS } from '../cards/database.js';

// Check if a player qualifies for any special achievements
export function checkSpecialAchievements(gameData: GameData, playerId: PlayerId): SpecialAchievementId[] {
  const achievements: SpecialAchievementId[] = [];
  
  // Check each special achievement condition
  if (checkMonument(gameData, playerId)) {
    achievements.push('Monument');
  }
  
  if (checkEmpire(gameData, playerId)) {
    achievements.push('Empire');
  }
  
  if (checkWorld(gameData, playerId)) {
    achievements.push('World');
  }
  
  if (checkWonder(gameData, playerId)) {
    achievements.push('Wonder');
  }
  
  if (checkUniverse(gameData, playerId)) {
    achievements.push('Universe');
  }
  
  return achievements;
}

// Monument: Claim when tucking 6+ cards OR scoring 6+ cards in single turn
function checkMonument(gameData: GameData, playerId: PlayerId): boolean {
  const turnActions = gameData.turnActions?.[playerId];
  if (!turnActions) return false;
  
  // Check if player has scored 6+ cards OR tucked 6+ cards OR total of 6+ cards
  const totalCards = turnActions.cardsScored.length + turnActions.cardsTucked.length;
  return turnActions.cardsScored.length >= 6 || turnActions.cardsTucked.length >= 6 || totalCards >= 6;
}

// Empire: Claim when having 3+ icons of all 6 basic icon types
function checkEmpire(gameData: GameData, playerId: PlayerId): boolean {
  const iconTypes = ['Leaf', 'Bulbs', 'Crown', 'Castle', 'Factory', 'Clock'];
  
  for (const iconType of iconTypes) {
    if (countIcons(gameData, playerId, iconType) < 3) {
      return false;
    }
  }
  
  return true;
}

// World: Claim when having 12+ icons on board
function checkWorld(gameData: GameData, playerId: PlayerId): boolean {
  const iconTypes = ['Leaf', 'Bulbs', 'Crown', 'Castle', 'Factory', 'Clock'];
  let totalIcons = 0;
  
  for (const iconType of iconTypes) {
    totalIcons += countIcons(gameData, playerId, iconType);
  }
  
  return totalIcons >= 12;
}

// Wonder: Claim when having 5 colors, each splayed up or right
function checkWonder(gameData: GameData, playerId: PlayerId): boolean {
  const player = gameData.players[playerId];
  if (!player) return false;
  
  // Need exactly 5 colors
  if (player.colors.length !== 5) return false;
  
  // Each color must be splayed up or right
  for (const colorStack of player.colors) {
    if (!colorStack.splayDirection || 
        (colorStack.splayDirection !== 'up' && colorStack.splayDirection !== 'right')) {
      return false;
    }
  }
  
  return true;
}

// Universe: Claim when having 5 top cards, each of value 8 or higher
function checkUniverse(gameData: GameData, playerId: PlayerId): boolean {
  const player = gameData.players[playerId];
  if (!player) return false;
  
  // Need exactly 5 colors
  if (player.colors.length !== 5) return false;
  
  // Each top card must be age 8 or higher
  for (const colorStack of player.colors) {
    if (colorStack.cards.length === 0) return false;
    
    const topCardId = colorStack.cards[colorStack.cards.length - 1];
    if (topCardId === undefined) return false;
    
    const card = CARDS.cardsById.get(topCardId);
    
    if (!card || card.age < 8) {
      return false;
    }
  }
  
  return true;
}

// Auto-claim special achievements for a player
export function autoClaimSpecialAchievements(
  gameData: GameData, 
  playerId: PlayerId
): { newState: GameData; claimedAchievements: SpecialAchievementId[] } {
  const newState = { ...gameData };
  const player = newState.players[playerId]!;
  
  // Check what achievements the player qualifies for
  const availableAchievements = gameData.shared.availableSpecialAchievements;
  const qualifyingAchievements = checkSpecialAchievements(gameData, playerId);
  
  // Filter to only available achievements
  const claimableAchievements = qualifyingAchievements.filter(
    achievement => availableAchievements.includes(achievement)
  );
  
  if (claimableAchievements.length === 0) {
    return { newState, claimedAchievements: [] };
  }
  
  // Claim each achievement
  for (const achievement of claimableAchievements) {
    // Add to player's special achievements
    player.specialAchievements.push(achievement);
    
    // Remove from available achievements
    const availableIndex = newState.shared.availableSpecialAchievements.indexOf(achievement);
    if (availableIndex !== -1) {
      newState.shared.availableSpecialAchievements.splice(availableIndex, 1);
    }
    
    // Emit achievement claimed event
    emitEvent(newState, 'achievement_claimed', {
      playerId,
      achievementId: achievement as any, // Type assertion since achievement is SpecialAchievementId
      achievementType: 'special',
      source: 'auto_claim_special_achievement'
    });
  }
  
  return { newState, claimedAchievements: claimableAchievements };
} 