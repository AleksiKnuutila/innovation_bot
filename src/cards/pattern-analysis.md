# Card Effect Pattern Analysis

## Overview
Analysis of all 105 Innovation cards to identify common patterns and implementation strategy.

## Effect Complexity Distribution

### Simple Effects (No Choices Needed)
Cards that execute immediately without player choices:
- **Draw effects**: Writing (Draw 2), The Wheel (Draw two 1), Tools (Draw 3)
- **Score effects**: Basic scoring from hand
- **Meld effects**: Basic melding from hand
- **Splay effects**: Basic splaying in any direction

**Count**: ~30-40 cards

### Medium Effects (Single Choice)
Cards that require one player choice:
- **Yes/No choices**: Code of Laws (Tuck all cards?), Philosophy (Splay any color?)
- **Single card selection**: Clothing (Meld different color), Mathematics (Return card)
- **Single color selection**: Paper (Splay green or blue)

**Count**: ~40-50 cards

### Complex Effects (Multiple Choices/Loops)
Cards that require multiple choices or have complex logic:
- **Multiple card selection**: Pottery (Return up to 3), Democracy (Return any number)
- **Demand effects**: Archery, City States, Oars (I demand...)
- **Conditional effects**: Metalworking (Repeat if castle), Alchemy (Return if red)
- **Multi-step effects**: Oars (Demand → Transfer → Optional draw)

**Count**: ~15-25 cards

## Common Effect Patterns

### 1. Draw + Action Patterns
- **Draw and Score**: Agriculture, Pottery, Optics
- **Draw and Meld**: Sailing, Mathematics, Alchemy
- **Draw and Tuck**: Code of Laws, Monotheism, Colonialism
- **Draw and Splay**: Philosophy, Paper, Invention

**Frequency**: Very High (30+ cards)

### 2. Demand Patterns
- **I demand you transfer**: Archery, City States, Oars
- **I demand you return**: Anatomy, Fission, Databases
- **I demand you exchange**: Machinery, Medicine, Combustion

**Frequency**: High (20+ cards)

### 3. Splay Patterns
- **Splay left**: Philosophy, Code of Laws
- **Splay right**: Invention, Banking, Chemistry
- **Splay up**: Clockmaking, Experiments, Flight

**Frequency**: High (15+ cards)

### 4. Conditional Patterns
- **If you have X icons**: Clothing, Paper, Invention
- **If you melded X cards**: Masonry, Code of Laws
- **If condition, repeat**: Metalworking, Colonialism

**Frequency**: Medium (10+ cards)

### 5. Exchange Patterns
- **Exchange hand/score**: Canal Building, Bicycle
- **Exchange with opponent**: Machinery, Medicine, Sanitation

**Frequency**: Medium (8+ cards)

## Implementation Priority

### Phase 1: Simple Effects (Week 1)
Start with basic draw/score/meld effects:
- Writing, The Wheel, Tools
- Sailing, Calendar, Fermenting
- Experimentation, Invention, Measurement

### Phase 2: Medium Effects (Week 2)
Add single-choice effects:
- Code of Laws, Clothing, Mathematics
- Philosophy, Paper, Banking
- Chemistry, Statistics, Steam Engine

### Phase 3: Complex Effects (Week 3)
Implement demand and multi-step effects:
- Archery, City States, Oars
- Alchemy, Engineering, Machinery
- Colonialism, Gunpowder, Democracy

### Phase 4: Advanced Effects (Week 4)
Handle the most complex cards:
- Fission, Computers, Genetics
- A.I., Bioengineering, The Internet

## Primitive Function Candidates

### High Priority
1. **`drawAndScore(player, age, count)`** - Used in 20+ cards
2. **`drawAndMeld(player, age, count)`** - Used in 15+ cards
3. **`drawAndTuck(player, age, count)`** - Used in 10+ cards
4. **`demandTransfer(player, target, cardType, fromZone, toZone)`** - Used in 15+ cards

### Medium Priority
5. **`splayColor(player, color, direction)`** - Used in 10+ cards
6. **`conditionalEffect(condition, effectFunction)`** - Used in 8+ cards
7. **`repeatEffect(condition, effectFunction, maxIterations)`** - Used in 5+ cards

### Low Priority
8. **`exchangeCards(player, handCards, scoreCards)`** - Used in 5+ cards
9. **`revealAndChoose(player, cards, choiceType)`** - Used in 3+ cards

## Testing Strategy

### Unit Tests
- Test each effect function independently
- Test state transitions for complex effects
- Test edge cases (empty hands, no valid targets)

### Integration Tests
- Test multi-card interactions
- Test achievement claiming during effects
- Test icon counting and splay mechanics

### Golden Tests
- Scripted game scenarios
- Complex multi-turn interactions
- Edge case handling

## Risk Assessment

### High Risk Areas
1. **Demand effects with multiple conditions** (City States, Engineering)
2. **Effects that modify game state during execution** (Metalworking, Colonialism)
3. **Icon counting with splay mechanics** (Clothing, Paper, Invention)
4. **Achievement claiming during effects** (Masonry, World, Universe)

### Mitigation Strategies
1. **Extensive testing** of complex effects
2. **Clear state machine patterns** for multi-step effects
3. **Comprehensive error handling** for edge cases
4. **Performance monitoring** for complex icon calculations

## Success Metrics

### Phase 7b Complete When
- [ ] Pattern analysis document completed
- [ ] Implementation priority list finalized
- [ ] Primitive function candidates identified
- [ ] Testing strategy defined
- [ ] Risk assessment completed 