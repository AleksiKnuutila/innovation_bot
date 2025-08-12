// Action legality and turn management system

import type { GameData } from '@/types/game-data.js';
import type { Action } from '@/types/actions.js';
import type { PlayerId, CardId, AchievementId, SpecialAchievementId } from '@/types/core.js';
import { CARDS } from '@/cards/database.js';
import { getPlayerHand, getPlayerScore, getAllTopCards } from '@/types/game-data.js';

// Result of legality check
export interface LegalityResult {
  readonly legal: boolean;
  readonly reason?: string; // Human-readable explanation if not legal
  readonly code?: string;   // Machine-readable error code
}

// Check if an action is legal in the current game state
export function isActionLegal(gameData: GameData, action: Action): LegalityResult {
  // Basic validation
  const basicCheck = validateBasicAction(gameData, action);
  if (!basicCheck.legal) return basicCheck;
  
  // Action-specific validation
  switch (action.type) {
    case 'draw':
      return validateDrawAction(gameData, action.playerId);
    case 'meld':
      return validateMeldAction(gameData, action.playerId, action.cardId);
    case 'dogma':
      return validateDogmaAction(gameData, action.playerId, action.cardId);
    case 'achieve':
      return validateAchieveAction(gameData, action.playerId, action.achievementType, action.achievementId);
    default:
      return { legal: false, reason: 'Unknown action type', code: 'UNKNOWN_ACTION' };
  }
}

// Get all legal actions for a player in the current state
export function getLegalActions(gameData: GameData, playerId: PlayerId): Action[] {
  if (gameData.phase.state !== 'AwaitingAction') return [];
  if (gameData.phase.currentPlayer !== playerId) return [];
  if (gameData.phase.actionsRemaining <= 0) return [];
  
  const legalActions: Action[] = [];
  const timestamp = Date.now();
  
  // Draw is always legal if it's your turn
  if (validateDrawAction(gameData, playerId).legal) {
    legalActions.push({
      type: 'draw',
      playerId,
      timestamp,
    });
  }
  
  // Check meld actions for each card in hand
  const hand = getPlayerHand(gameData, playerId);
  for (const cardId of hand) {
    if (validateMeldAction(gameData, playerId, cardId).legal) {
      legalActions.push({
        type: 'meld',
        playerId,
        cardId,
        timestamp,
      });
    }
  }
  
  // Check dogma actions for each top card
  const topCards = getAllTopCards(gameData, playerId);
  for (const cardId of topCards) {
    if (validateDogmaAction(gameData, playerId, cardId).legal) {
      legalActions.push({
        type: 'dogma',
        playerId,
        cardId,
        timestamp,
      });
    }
  }
  
  // Check achieve actions for all achievements
  for (const achievementId of gameData.shared.availableNormalAchievements) {
    if (validateAchieveAction(gameData, playerId, 'normal', achievementId).legal) {
      legalActions.push({
        type: 'achieve',
        playerId,
        achievementType: 'normal',
        achievementId,
        timestamp,
      });
    }
  }
  
  for (const achievementId of gameData.shared.availableSpecialAchievements) {
    if (validateAchieveAction(gameData, playerId, 'special', achievementId).legal) {
      legalActions.push({
        type: 'achieve',
        playerId,
        achievementType: 'special',
        achievementId,
        timestamp,
      });
    }
  }
  
  return legalActions;
}

// Basic action validation (turn, player, etc.)
function validateBasicAction(gameData: GameData, action: Action): LegalityResult {
  // Must be awaiting action
  if (gameData.phase.state !== 'AwaitingAction') {
    return { legal: false, reason: 'Not awaiting action', code: 'WRONG_PHASE' };
  }
  
  // Must be current player's turn
  if (action.playerId !== gameData.phase.currentPlayer) {
    return { legal: false, reason: 'Not your turn', code: 'WRONG_PLAYER' };
  }
  
  // Must have actions remaining
  if (gameData.phase.actionsRemaining <= 0) {
    return { legal: false, reason: 'No actions remaining this turn', code: 'NO_ACTIONS' };
  }
  
  return { legal: true };
}

// Validate draw action
function validateDrawAction(gameData: GameData, playerId: PlayerId): LegalityResult {
  // Get highest top card value to determine draw age
  const topCards = getAllTopCards(gameData, playerId);
  
  if (topCards.length === 0) {
    return { legal: false, reason: 'No top cards to determine draw age', code: 'NO_TOP_CARDS' };
  }
  
  const highestValue = Math.max(...topCards.map(cardId => {
    const card = CARDS.cardsById.get(cardId);
    return card?.age || 0;
  }));
  
  // Check if there are cards available to draw (including age skipping)
  let ageToDrawFrom = highestValue;
  while (ageToDrawFrom <= 10) {
    const pile = gameData.shared.supplyPiles.find(p => p.age === ageToDrawFrom);
    if (pile && pile.cards.length > 0) {
      return { legal: true };
    }
    ageToDrawFrom++;
  }
  
  return { legal: false, reason: 'No cards available to draw', code: 'NO_DRAW_CARDS' };
}

// Validate meld action
function validateMeldAction(gameData: GameData, playerId: PlayerId, cardId: CardId): LegalityResult {
  const hand = getPlayerHand(gameData, playerId);
  
  if (!hand.includes(cardId)) {
    return { legal: false, reason: 'Card not in hand', code: 'CARD_NOT_IN_HAND' };
  }
  
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    return { legal: false, reason: 'Invalid card ID', code: 'INVALID_CARD' };
  }
  
  // Meld is always legal if you have the card in hand
  return { legal: true };
}

// Validate dogma action
function validateDogmaAction(gameData: GameData, playerId: PlayerId, cardId: CardId): LegalityResult {
  const topCards = getAllTopCards(gameData, playerId);
  
  if (!topCards.includes(cardId)) {
    return { legal: false, reason: 'Card is not a top card', code: 'NOT_TOP_CARD' };
  }
  
  const card = CARDS.cardsById.get(cardId);
  if (!card) {
    return { legal: false, reason: 'Invalid card ID', code: 'INVALID_CARD' };
  }
  
  // Check if card has any dogma effects
  const hasEffects = card.dogmaEffects.some(effect => effect.trim().length > 0);
  if (!hasEffects) {
    return { legal: false, reason: 'Card has no dogma effects', code: 'NO_EFFECTS' };
  }
  
  return { legal: true };
}

// Validate achieve action
function validateAchieveAction(
  gameData: GameData, 
  playerId: PlayerId, 
  achievementType: 'normal' | 'special',
  achievementId: AchievementId | SpecialAchievementId
): LegalityResult {
  
  if (achievementType === 'normal') {
    return validateNormalAchievement(gameData, playerId, achievementId as AchievementId);
  } else {
    return validateSpecialAchievement(gameData, playerId, achievementId as SpecialAchievementId);
  }
}

// Validate normal achievement
function validateNormalAchievement(gameData: GameData, playerId: PlayerId, achievementId: AchievementId): LegalityResult {
  // Check if achievement is available
  if (!gameData.shared.availableNormalAchievements.includes(achievementId)) {
    return { legal: false, reason: 'Achievement not available', code: 'ACHIEVEMENT_TAKEN' };
  }
  
  // Check score requirement: score >= 5 * achievement age
  const requiredScore = 5 * achievementId;
  const playerScore = getPlayerScore(gameData, playerId);
  
  if (playerScore < requiredScore) {
    return { 
      legal: false, 
      reason: `Need ${requiredScore} points, have ${playerScore}`, 
      code: 'INSUFFICIENT_SCORE' 
    };
  }
  
  // Check top card requirement: need top card >= achievement age
  const topCards = getAllTopCards(gameData, playerId);
  const highestTopCard = Math.max(...topCards.map(cardId => {
    const card = CARDS.cardsById.get(cardId);
    return card?.age || 0;
  }));
  
  if (highestTopCard < achievementId) {
    return { 
      legal: false, 
      reason: `Need top card of age ${achievementId} or higher, highest is ${highestTopCard}`, 
      code: 'INSUFFICIENT_TOP_CARD' 
    };
  }
  
  return { legal: true };
}

// Validate special achievement (simplified - would need full condition checking)
function validateSpecialAchievement(gameData: GameData, playerId: PlayerId, achievementId: SpecialAchievementId): LegalityResult {
  // Check if achievement is available
  if (!gameData.shared.availableSpecialAchievements.includes(achievementId)) {
    return { legal: false, reason: 'Special achievement not available', code: 'ACHIEVEMENT_TAKEN' };
  }
  
  // For now, special achievements are not manually achievable (they're auto-claimed)
  // This would need to be implemented based on specific conditions
  return { legal: false, reason: 'Special achievements are auto-claimed', code: 'AUTO_CLAIM_ONLY' };
}

// Check if game should end due to achievement victory
export function checkAchievementVictory(gameData: GameData): PlayerId | null {
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

// Advance to next turn
export function advanceTurn(gameData: GameData): GameData {
  const currentPlayer = gameData.phase.currentPlayer;
  const actionsRemaining = gameData.phase.actionsRemaining;
  
  if (actionsRemaining > 1) {
    // Same player, one less action
    return {
      ...gameData,
      phase: {
        ...gameData.phase,
        actionsRemaining: actionsRemaining - 1,
      },
    };
  } else {
    // Switch to other player, new turn - clear turn actions
    const nextPlayer = currentPlayer === 0 ? 1 : 0;
    const nextTurn = gameData.phase.turnNumber + 1;
    
    return {
      ...gameData,
      phase: {
        state: 'AwaitingAction',
        currentPlayer: nextPlayer,
        turnNumber: nextTurn,
        actionsRemaining: 2, // Full actions for new turn
      },
      // Clear turn actions for the new turn
      turnActions: undefined,
    };
  }
}