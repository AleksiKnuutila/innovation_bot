# Card Effect Implementation Template

## Overview
Standardized template and guidelines for implementing new Innovation card effects using the callback-based state machine pattern.

## Implementation Pattern

### Basic Structure
```typescript
interface CardNameState {
  step: 'check_condition' | 'waiting_choice' | 'execute_effect';
  // Add any state variables needed
}

export function cardNameEffect(
  context: DogmaContext, 
  state: CardNameState, 
  choiceAnswer?: ChoiceAnswer
): EffectResult {
  const { gameData, activatingPlayer } = context;
  
  switch (state.step) {
    case 'check_condition': {
      // Check if effect can execute
      // Return 'complete' if no action needed
      // Return 'need_choice' if choice required
      // Return 'continue' if more processing needed
    }
    
    case 'waiting_choice': {
      // Handle player choice
      // Execute effect based on choice
      // Return 'complete' when done
    }
    
    case 'execute_effect': {
      // Execute the main effect
      // Return 'complete' when done
    }
  }
}
```

## Step Guidelines

### 1. Check Condition Step
- **Purpose**: Validate if effect can execute
- **Return**: 
  - `complete` if no action needed
  - `need_choice` if player choice required
  - `continue` if more processing needed
- **Examples**:
  - Check icon counts
  - Check if player has cards
  - Check if demand conditions met

### 2. Waiting Choice Step
- **Purpose**: Handle player decisions
- **Return**: `complete` when choice processed
- **Examples**:
  - Yes/No choices
  - Card selection
  - Color selection

### 3. Execute Effect Step
- **Purpose**: Perform the main card effect
- **Return**: `complete` when effect done
- **Examples**:
  - Draw cards
  - Transfer cards
  - Splay colors

## State Management

### State Variables
- **Keep it simple**: Use enums over complex objects
- **Minimal data**: Only store what's needed between steps
- **Serializable**: All state must be JSON-serializable

### State Transitions
- **Clear progression**: Each step should have obvious next step
- **No loops**: Avoid circular state transitions
- **Error handling**: Include error states if needed

## Choice Handling

### Choice Types
```typescript
// Yes/No choice
{
  type: 'yes_no',
  prompt: 'Do you want to...?',
  yesText: 'Yes, do it',
  noText: 'No, skip it'
}

// Card selection
{
  type: 'select_cards',
  prompt: 'Select cards to...',
  from: { playerId, zone: 'hand' },
  minCards: 1,
  maxCards: 3
}

// Color selection
{
  type: 'select_color',
  prompt: 'Choose a color to splay',
  colors: ['Red', 'Green', 'Blue', 'Yellow', 'Purple']
}
```

### Choice Validation
- **Always validate**: Check choice answers before processing
- **Type guards**: Use proper TypeScript type checking
- **Error handling**: Throw clear errors for invalid choices

## Effect Execution

### Using Primitives
```typescript
// Draw and score
newState = drawCard(newState, playerId, age, events);
const drawnCard = newState.players[playerId]!.hands[newState.players[playerId]!.hands.length - 1]!;
newState = scoreCard(newState, playerId, drawnCard, events);

// Transfer card
newState = transferCard(newState, fromPlayer, toPlayer, cardId, 'hand', 'hand', events);

// Splay color
newState = splayColor(newState, playerId, color, 'left', events);
```

### Event Emission
```typescript
// Always emit dogma event when effect completes
const dogmaEvent = emitEvent(newState, 'dogma_activated', {
  playerId: activatingPlayer,
  cardId: context.cardId,
  dogmaLevel: context.dogmaLevel,
  source: 'cardName_card_effect',
});
events.push(dogmaEvent);
```

## Error Handling

### Common Errors
- **Invalid choices**: Wrong choice type or invalid data
- **Missing cards**: Cards not found in expected zones
- **Invalid state**: Game state doesn't allow effect

### Error Responses
```typescript
// Throw clear errors
throw new Error('Expected yes/no choice answer');

// Validate before use
if (!choiceAnswer || choiceAnswer.type !== 'select_cards') {
  throw new Error('Expected card selection choice answer');
}
```

## Testing Template

### Basic Test Structure
```typescript
describe('CardName Effect', () => {
  it('should complete immediately if condition not met', () => {
    const context = createTestContext();
    const state = { step: 'check_condition' as const };

    const result = cardNameEffect(context, state);

    expect(result.type).toBe('complete');
    expect(result.events).toHaveLength(0);
  });

  it('should offer choice if condition met', () => {
    const context = createTestContextWithCondition();
    const state = { step: 'check_condition' as const };

    const result = cardNameEffect(context, state);

    expect(result.type).toBe('need_choice');
    expect(result.choice.type).toBe('yes_no');
  });

  it('should execute effect when choice made', () => {
    const context = createTestContext();
    const state = { step: 'waiting_choice' as const };
    const choiceAnswer = createYesNoAnswer('test', 0, true);

    const result = cardNameEffect(context, state, choiceAnswer);

    expect(result.type).toBe('complete');
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'drew' })
    );
  });
});
```

## Implementation Checklist

### Before Starting
- [ ] Read card text carefully
- [ ] Identify effect complexity (simple/medium/complex)
- [ ] Plan state machine steps
- [ ] Identify required primitives

### During Implementation
- [ ] Follow established patterns
- [ ] Use existing primitives where possible
- [ ] Handle edge cases gracefully
- [ ] Emit appropriate events

### Before Completion
- [ ] Test all state transitions
- [ ] Test edge cases
- [ ] Test error conditions
- [ ] Verify event emission
- [ ] Add to effect registry

## Common Patterns

### Simple Draw Effect
```typescript
case 'start': {
  let newState = gameData;
  const events: GameEvent[] = [];
  
  newState = drawCard(newState, activatingPlayer, age, events);
  
  const dogmaEvent = emitEvent(newState, 'dogma_activated', {
    playerId: activatingPlayer,
    cardId: context.cardId,
    dogmaLevel: context.dogmaLevel,
    source: 'cardName_card_effect',
  });
  events.push(dogmaEvent);
  
  return { 
    type: 'complete', 
    newState, 
    events,
    effectType: 'non-demand'
  };
}
```

### Conditional Effect
```typescript
case 'check_condition': {
  if (!hasRequiredIcons(gameData, activatingPlayer, 'Crown')) {
    return { type: 'complete', newState: gameData, events: [] };
  }

  return {
    type: 'need_choice',
    newState: gameData,
    events: [],
    choice: createYesNoChoice('Execute effect?'),
    nextState: { step: 'waiting_choice' }
  };
}
```

### Demand Effect
```typescript
case 'execute_demand': {
  const affectedPlayers = getPlayersWithFewerIcons(gameData, activatingPlayer, 'Crown');
  
  if (affectedPlayers.length === 0) {
    return executeNonDemandEffect(gameData, activatingPlayer);
  }

  return {
    type: 'need_choice',
    newState: gameData,
    events: [],
    choice: createSelectCardsChoice(affectedPlayers[0], 'Select card to transfer'),
    nextState: { step: 'waiting_transfer', affectedPlayers, currentIndex: 0 }
  };
}
```

## Success Criteria

### Effect Implementation Complete When
- [ ] All state transitions work correctly
- [ ] Player choices are handled properly
- [ ] Edge cases are handled gracefully
- [ ] Appropriate events are emitted
- [ ] Effect integrates with existing system
- [ ] Tests pass with good coverage 