// Event types for game state change logging and replay system

import type { 
  CardId, 
  Color, 
  PlayerId, 
  AchievementId, 
  SpecialAchievementId,
  SplayDirection,
  WinCondition,
  ZoneRef 
} from './core.js';

// Event sequence number for ordering
export type EventId = number;

// Base event interface
interface BaseEvent {
  readonly id: EventId;
  readonly timestamp: number;
  readonly source: string; // Card ID, rule name, or system action that caused this
}

// Game flow events
export interface StartTurnEvent extends BaseEvent {
  readonly type: 'start_turn';
  readonly playerId: PlayerId;
  readonly turnNumber: number;
  readonly actionsRemaining: number;
}

export interface EndTurnEvent extends BaseEvent {
  readonly type: 'end_turn';
  readonly playerId: PlayerId;
  readonly turnNumber: number;
}

export interface GameEndEvent extends BaseEvent {
  readonly type: 'game_end';
  readonly winner: PlayerId | null; // null for draw
  readonly winCondition: WinCondition;
  readonly finalScores: Record<PlayerId, number>;
}

// Card movement events
export interface DrewEvent extends BaseEvent {
  readonly type: 'drew';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly fromAge: number;
  readonly toZone: ZoneRef;
}

export interface MeldedEvent extends BaseEvent {
  readonly type: 'melded';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly color: Color;
  readonly fromHand: boolean;
}

export interface ScoredEvent extends BaseEvent {
  readonly type: 'scored';
  readonly playerId: PlayerId;
  readonly cardIds: CardId[];
  readonly pointsGained: number;
  readonly fromZone: ZoneRef;
}

export interface TransferredEvent extends BaseEvent {
  readonly type: 'transferred';
  readonly cardId: CardId;
  readonly fromPlayer: PlayerId;
  readonly toPlayer: PlayerId;
  readonly fromZone: ZoneRef;
  readonly toZone: ZoneRef;
}

export interface ReturnedEvent extends BaseEvent {
  readonly type: 'returned';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly fromZone: ZoneRef;
  readonly toAge: number;
}

// Board manipulation events
export interface SplayedEvent extends BaseEvent {
  readonly type: 'splayed';
  readonly playerId: PlayerId;
  readonly color: Color;
  readonly direction: SplayDirection;
  readonly previousDirection?: SplayDirection;
}

export interface TuckedEvent extends BaseEvent {
  readonly type: 'tucked';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly color: Color;
}

// Dogma and effect events
export interface DogmaActivatedEvent extends BaseEvent {
  readonly type: 'dogma_activated';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly iconCount: number; // How many of the dogma icon they had
}

export interface DemandIssuedEvent extends BaseEvent {
  readonly type: 'demand_issued';
  readonly fromPlayer: PlayerId;
  readonly toPlayers: PlayerId[];
  readonly cardId: CardId;
  readonly effectIndex: number; // Which effect on the card (0, 1, 2)
}

export interface SharedEffectEvent extends BaseEvent {
  readonly type: 'shared_effect';
  readonly sharedBy: PlayerId[];
  readonly triggerPlayer: PlayerId;
  readonly cardId: CardId;
  readonly effectIndex: number;
}

export interface DrawBonusEvent extends BaseEvent {
  readonly type: 'draw_bonus';
  readonly playerId: PlayerId;
  readonly reason: 'sharing'; // Could add other bonus types later
  readonly triggeredBy: CardId;
}

// Achievement events
export interface AchievementClaimedEvent extends BaseEvent {
  readonly type: 'achievement_claimed';
  readonly playerId: PlayerId;
  readonly achievementType: 'normal' | 'special';
  readonly achievementId: AchievementId | SpecialAchievementId;
  readonly pointsRequired?: number; // For normal achievements
}

// Special condition events
export interface ConditionCheckedEvent extends BaseEvent {
  readonly type: 'condition_checked';
  readonly condition: string;
  readonly playerId: PlayerId;
  readonly result: boolean;
  readonly details?: Record<string, any>;
}

// Card revelation events
export interface CardRevealedEvent extends BaseEvent {
  readonly type: 'card_revealed';
  readonly playerId: PlayerId;
  readonly cardId: CardId;
  readonly fromZone: ZoneRef;
}

// Union of all event types
export type GameEvent = 
  | StartTurnEvent
  | EndTurnEvent  
  | GameEndEvent
  | DrewEvent
  | MeldedEvent
  | ScoredEvent
  | TransferredEvent
  | ReturnedEvent
  | SplayedEvent
  | TuckedEvent
  | DogmaActivatedEvent
  | DemandIssuedEvent
  | SharedEffectEvent
  | DrawBonusEvent
  | AchievementClaimedEvent
  | ConditionCheckedEvent
  | CardRevealedEvent;

// Event log for storing complete game history
export interface EventLog {
  readonly events: GameEvent[];
  readonly nextEventId: EventId;
}

// Helper functions to create events
export function createDrewEvent(
  id: EventId,
  playerId: PlayerId,
  cardId: CardId,
  fromAge: number,
  source: string
): DrewEvent {
  return {
    type: 'drew',
    id,
    timestamp: Date.now(),
    source,
    playerId,
    cardId,
    fromAge,
    toZone: { zone: 'hand', playerId },
  };
}

export function createMeldedEvent(
  id: EventId,
  playerId: PlayerId,
  cardId: CardId,
  color: Color,
  source: string
): MeldedEvent {
  return {
    type: 'melded',
    id,
    timestamp: Date.now(),
    source,
    playerId,
    cardId,
    color,
    fromHand: true,
  };
}

export function createSplayedEvent(
  id: EventId,
  playerId: PlayerId,
  color: Color,
  direction: SplayDirection,
  source: string,
  previousDirection?: SplayDirection
): SplayedEvent {
  const event: SplayedEvent = {
    type: 'splayed',
    id,
    timestamp: Date.now(),
    source,
    playerId,
    color,
    direction,
  };
  
  if (previousDirection !== undefined) {
    (event as any).previousDirection = previousDirection;
  }
  
  return event;
}

// Event filtering helpers
export function getEventsByType<T extends GameEvent['type']>(
  events: GameEvent[],
  type: T
): Extract<GameEvent, { type: T }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: T }> => 
    event.type === type
  );
}

export function getEventsByPlayer(events: GameEvent[], playerId: PlayerId): GameEvent[] {
  return events.filter(event => 
    'playerId' in event && event.playerId === playerId
  );
}

// Replay validation
export function validateEventSequence(events: GameEvent[]): boolean {
  // Check that event IDs are sequential
  for (let i = 0; i < events.length; i++) {
    if (events[i]?.id !== i) {
      return false;
    }
  }
  
  // Check timestamps are non-decreasing
  for (let i = 1; i < events.length; i++) {
    if (events[i]!.timestamp < events[i - 1]!.timestamp) {
      return false;
    }
  }
  
  return true;
}