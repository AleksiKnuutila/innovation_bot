// Event emission and logging system

import type { GameData } from '@/types/game-data.js';
import type { GameEvent, EventId } from '@/types/events.js';
import type { PlayerId, CardId, Color, SplayDirection } from '@/types/core.js';
import { getCurrentTimestamp } from './utils.js';

// Emit a new event and add it to the game's event log
export function emitEvent(gameData: GameData, eventType: GameEvent['type'], eventData: any): GameEvent {
  const eventId = gameData.eventLog.nextEventId;
  const timestamp = getCurrentTimestamp();
  
  const event: GameEvent = {
    id: eventId,
    timestamp,
    type: eventType,
    ...eventData,
  } as GameEvent;
  
  // Add event to log
  gameData.eventLog.events.push(event);
  (gameData.eventLog as any).nextEventId = eventId + 1;
  
  return event;
}

// Helper functions to emit specific event types
export function emitDrewEvent(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  fromAge: number,
  source: string
): GameEvent {
  return emitEvent(gameData, 'drew', {
    playerId,
    cardId,
    fromAge,
    toZone: { zone: 'hand', playerId },
    source,
  });
}

export function emitMeldedEvent(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  color: Color,
  source: string
): GameEvent {
  return emitEvent(gameData, 'melded', {
    playerId,
    cardId,
    color,
    fromHand: true,
    source,
  });
}

export function emitSplayedEvent(
  gameData: GameData,
  playerId: PlayerId,
  color: Color,
  direction: SplayDirection,
  source: string,
  previousDirection?: SplayDirection
): GameEvent {
  return emitEvent(gameData, 'splayed', {
    playerId,
    color,
    direction,
    previousDirection,
    source,
  });
}

export function emitScoredEvent(
  gameData: GameData,
  playerId: PlayerId,
  cardIds: CardId[],
  pointsGained: number,
  fromZone: import('@/types/core.js').ZoneRef,
  source: string
): GameEvent {
  return emitEvent(gameData, 'scored', {
    playerId,
    cardIds,
    pointsGained,
    fromZone,
    source,
  });
}

export function emitDogmaActivatedEvent(
  gameData: GameData,
  playerId: PlayerId,
  cardId: CardId,
  iconCount: number,
  source: string
): GameEvent {
  return emitEvent(gameData, 'dogma_activated', {
    playerId,
    cardId,
    iconCount,
    source,
  });
}

export function emitAchievementClaimedEvent(
  gameData: GameData,
  playerId: PlayerId,
  achievementType: 'normal' | 'special',
  achievementId: import('@/types/core.js').AchievementId | import('@/types/core.js').SpecialAchievementId,
  source: string,
  pointsRequired?: number
): GameEvent {
  return emitEvent(gameData, 'achievement_claimed', {
    playerId,
    achievementType,
    achievementId,
    pointsRequired,
    source,
  });
}

export function emitStartTurnEvent(
  gameData: GameData,
  playerId: PlayerId,
  turnNumber: number,
  actionsRemaining: number
): GameEvent {
  return emitEvent(gameData, 'start_turn', {
    playerId,
    turnNumber,
    actionsRemaining,
    source: 'turn_system',
  });
}

export function emitEndTurnEvent(
  gameData: GameData,
  playerId: PlayerId,
  turnNumber: number
): GameEvent {
  return emitEvent(gameData, 'end_turn', {
    playerId,
    turnNumber,
    source: 'turn_system',
  });
}

export function emitGameEndEvent(
  gameData: GameData,
  winner: PlayerId | null,
  winCondition: import('@/types/core.js').WinCondition,
  finalScores: Record<PlayerId, number>
): GameEvent {
  return emitEvent(gameData, 'game_end', {
    winner,
    winCondition,
    finalScores,
    source: 'game_system',
  });
}

// Get events of a specific type from the log
export function getEventsByType<T extends GameEvent['type']>(
  gameData: GameData,
  eventType: T
): Extract<GameEvent, { type: T }>[] {
  return gameData.eventLog.events.filter((event): event is Extract<GameEvent, { type: T }> => 
    event.type === eventType
  );
}

// Get events by a specific player
export function getEventsByPlayer(gameData: GameData, playerId: PlayerId): GameEvent[] {
  return gameData.eventLog.events.filter(event => 
    'playerId' in event && event.playerId === playerId
  );
}

// Get the last N events
export function getRecentEvents(gameData: GameData, count: number): GameEvent[] {
  const events = gameData.eventLog.events;
  return events.slice(-count);
}

// Get event by ID
export function getEventById(gameData: GameData, eventId: EventId): GameEvent | undefined {
  return gameData.eventLog.events.find(event => event.id === eventId);
}